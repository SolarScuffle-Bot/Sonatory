// @ts-check

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RUNTIME_ID = Symbol('sonatory.runtime-entity-id');

/** @typedef {{index:number,generation:number,[RUNTIME_ID]:true}} EntityId */
/** @typedef {{storage:'tag'|'data',codecId:string,schemaVersion:number}} ComponentDefinition */
/** @typedef {{members:number[],rowByEntity:Map<number,number>,columns:Map<number,unknown[]>}} Archetype */

function assertGuid(guid) {
  if (typeof guid !== 'string' || !GUID_PATTERN.test(guid)) throw new Error('Durable Entity GUID must be a canonical lowercase UUID.');
}

function runtimeId(index, generation) {
  return Object.freeze({ index, generation, [RUNTIME_ID]: /** @type {true} */(true) });
}

function assertDurableValue(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (value[RUNTIME_ID]) throw new Error('Runtime Entity IDs cannot be stored in component data.');
  if (seen.has(value)) throw new Error('Component data must be an acyclic durable value.');
  seen.add(value);
  if (Array.isArray(value)) for (const item of value) assertDurableValue(item, seen);
  else for (const item of Object.values(value)) assertDurableValue(item, seen);
  seen.delete(value);
}

export class EcsWorld {
  constructor() {
    /** @type {number[]} */ this.generations = [];
    /** @type {boolean[]} */ this.alive = [];
    /** @type {(string|null)[]} */ this.guidByIndex = [];
    /** @type {Map<string,number>} */ this.indexByGuid = new Map();
    /** @type {number[]} */ this.free = [];
    /** @type {Map<number,ComponentDefinition>} */ this.definitions = new Map();
    /** @type {Map<number,Set<number>>} */ this.signatures = new Map();
    /** @type {Map<number,string>} */ this.archetypeByEntity = new Map();
    /** @type {Map<string,Archetype>} */ this.archetypes = new Map();
    /** @type {Map<number,Map<number,Set<number>>>} */ this.pairsBySubject = new Map();
    /** @type {Map<number,Map<number,Set<number>>>} */ this.subjectsByPair = new Map();
    this.archetypes.set('', { members: [], rowByEntity: new Map(), columns: new Map() });
  }

  /** @param {string} guid @returns {EntityId} */
  createEntity(guid) {
    assertGuid(guid);
    if (this.indexByGuid.has(guid)) throw new Error(`Entity GUID already exists: ${guid}`);
    const index = this.free.length ? /** @type {number} */(this.free.pop()) : this.generations.length;
    if (index === this.generations.length) this.generations.push(0);
    this.alive[index] = true;
    this.guidByIndex[index] = guid;
    this.indexByGuid.set(guid, index);
    this.signatures.set(index, new Set());
    this._insertIntoArchetype(index, '', new Map());
    return runtimeId(index, this.generations[index]);
  }

  /** @param {string} guid @returns {EntityId|null} */
  byGuid(guid) {
    const index = this.indexByGuid.get(guid);
    return index === undefined ? null : runtimeId(index, this.generations[index]);
  }

  /** @param {EntityId|string} reference @returns {number} */
  _resolve(reference) {
    if (typeof reference === 'string') {
      const index = this.indexByGuid.get(reference);
      if (index === undefined || !this.alive[index]) throw new Error(`Unknown Entity GUID: ${reference}`);
      return index;
    }
    if (!reference?.[RUNTIME_ID] || !Number.isSafeInteger(reference.index) || !this.alive[reference.index] || this.generations[reference.index] !== reference.generation) throw new Error('Stale or invalid runtime Entity ID.');
    return reference.index;
  }

  /** @param {EntityId|string} reference */
  guid(reference) { return /** @type {string} */(this.guidByIndex[this._resolve(reference)]); }

  /** @param {EntityId|string} entity @param {Partial<ComponentDefinition>} definition */
  registerComponent(entity, definition = {}) {
    const index = this._resolve(entity);
    if (this.definitions.has(index)) throw new Error('Entity is already a component definition.');
    const complete = { storage: definition.storage || 'data', codecId: definition.codecId || 'json', schemaVersion: definition.schemaVersion || 1 };
    if (!['tag','data'].includes(complete.storage) || !complete.codecId || !Number.isSafeInteger(complete.schemaVersion) || complete.schemaVersion < 1) throw new Error('Invalid component definition.');
    this.definitions.set(index, /** @type {ComponentDefinition} */(complete));
  }

  /** @param {number} index @param {string} key @param {Map<number,unknown>} values */
  _insertIntoArchetype(index, key, values) {
    let archetype = this.archetypes.get(key);
    if (!archetype) {
      archetype = { members: [], rowByEntity: new Map(), columns: new Map() };
      for (const component of key ? key.split(',').map(Number) : []) archetype.columns.set(component, []);
      this.archetypes.set(key, archetype);
    }
    const row = archetype.members.length;
    archetype.members.push(index);
    archetype.rowByEntity.set(index, row);
    for (const [component, column] of archetype.columns) column.push(values.get(component));
    this.archetypeByEntity.set(index, key);
  }

  /** @param {number} index @returns {Map<number,unknown>} */
  _removeFromArchetype(index) {
    const key = /** @type {string} */(this.archetypeByEntity.get(index));
    const archetype = /** @type {Archetype} */(this.archetypes.get(key));
    const row = /** @type {number} */(archetype.rowByEntity.get(index));
    const values = new Map();
    for (const [component, column] of archetype.columns) values.set(component, column[row]);
    const lastRow = archetype.members.length - 1;
    const moved = archetype.members[lastRow];
    if (row !== lastRow) {
      archetype.members[row] = moved;
      archetype.rowByEntity.set(moved, row);
      for (const column of archetype.columns.values()) column[row] = column[lastRow];
    }
    archetype.members.pop();
    archetype.rowByEntity.delete(index);
    for (const column of archetype.columns.values()) column.pop();
    this.archetypeByEntity.delete(index);
    return values;
  }

  /** @param {number} index @param {Set<number>} next @param {number} changed @param {unknown} value */
  _transition(index, next, changed, value) {
    const values = this._removeFromArchetype(index);
    values.set(changed, value);
    const key = [...next].sort((a, b) => a - b).join(',');
    this.signatures.set(index, next);
    this._insertIntoArchetype(index, key, values);
  }

  /** @param {EntityId|string} entity @param {EntityId|string} component @param {unknown} [value] */
  add(entity, component, value) {
    const entityIndex = this._resolve(entity);
    const componentIndex = this._resolve(component);
    const definition = this.definitions.get(componentIndex);
    if (!definition) throw new Error('Only registered component Entities can be attached.');
    const signature = /** @type {Set<number>} */(this.signatures.get(entityIndex));
    if (definition.storage === 'data') assertDurableValue(value);
    const stored = definition.storage === 'tag' ? undefined : structuredClone(value);
    if (signature.has(componentIndex)) {
      if (definition.storage === 'data') {
        const archetype = /** @type {Archetype} */(this.archetypes.get(/** @type {string} */(this.archetypeByEntity.get(entityIndex))));
        const row = /** @type {number} */(archetype.rowByEntity.get(entityIndex));
        /** @type {unknown[]} */(archetype.columns.get(componentIndex))[row] = stored;
      }
      return;
    }
    this._transition(entityIndex, new Set([...signature, componentIndex]), componentIndex, stored);
  }

  /** @param {EntityId|string} entity @param {EntityId|string} component */
  remove(entity, component) {
    const entityIndex = this._resolve(entity);
    const componentIndex = this._resolve(component);
    const signature = /** @type {Set<number>} */(this.signatures.get(entityIndex));
    if (!signature.has(componentIndex)) return;
    const next = new Set(signature); next.delete(componentIndex);
    const values = this._removeFromArchetype(entityIndex); values.delete(componentIndex);
    const key = [...next].sort((a, b) => a - b).join(',');
    this.signatures.set(entityIndex, next);
    this._insertIntoArchetype(entityIndex, key, values);
  }

  /** @param {EntityId|string} entity @param {EntityId|string} component */
  has(entity, component) { return /** @type {Set<number>} */(this.signatures.get(this._resolve(entity))).has(this._resolve(component)); }

  /** @param {EntityId|string} entity @param {EntityId|string} component */
  get(entity, component) {
    const entityIndex = this._resolve(entity); const componentIndex = this._resolve(component);
    if (!this.has(entity, component)) return undefined;
    const archetype = /** @type {Archetype} */(this.archetypes.get(/** @type {string} */(this.archetypeByEntity.get(entityIndex))));
    return structuredClone(/** @type {unknown[]} */(archetype.columns.get(componentIndex))[/** @type {number} */(archetype.rowByEntity.get(entityIndex))]);
  }

  /** @param {EntityId|string} subject @param {EntityId|string} predicate @param {EntityId|string} target @param {{exclusive?:boolean}} [options] */
  addPair(subject, predicate, target, options = {}) {
    const subjectIndex = this._resolve(subject); const predicateIndex = this._resolve(predicate); const targetIndex = this._resolve(target);
    if (options.exclusive) {
      const priorTargets = [...(this.pairsBySubject.get(subjectIndex)?.get(predicateIndex) || [])];
      for (const prior of priorTargets) this.removePair(runtimeId(subjectIndex, this.generations[subjectIndex]), runtimeId(predicateIndex, this.generations[predicateIndex]), runtimeId(prior, this.generations[prior]));
    }
    let byPredicate = this.pairsBySubject.get(subjectIndex);
    if (!byPredicate) this.pairsBySubject.set(subjectIndex, byPredicate = new Map());
    let targets = byPredicate.get(predicateIndex);
    if (!targets) byPredicate.set(predicateIndex, targets = new Set());
    targets.add(targetIndex);
    let byTarget = this.subjectsByPair.get(predicateIndex);
    if (!byTarget) this.subjectsByPair.set(predicateIndex, byTarget = new Map());
    let subjects = byTarget.get(targetIndex);
    if (!subjects) byTarget.set(targetIndex, subjects = new Set());
    subjects.add(subjectIndex);
  }

  /** @param {EntityId|string} subject @param {EntityId|string} predicate @param {EntityId|string} target */
  removePair(subject, predicate, target) {
    const subjectIndex = this._resolve(subject); const predicateIndex = this._resolve(predicate); const targetIndex = this._resolve(target);
    const targets = this.pairsBySubject.get(subjectIndex)?.get(predicateIndex); targets?.delete(targetIndex);
    if (targets && !targets.size) this.pairsBySubject.get(subjectIndex)?.delete(predicateIndex);
    const subjects = this.subjectsByPair.get(predicateIndex)?.get(targetIndex); subjects?.delete(subjectIndex);
    if (subjects && !subjects.size) this.subjectsByPair.get(predicateIndex)?.delete(targetIndex);
  }

  /** @param {EntityId|string} subject @param {EntityId|string} predicate @param {EntityId|string} target */
  hasPair(subject, predicate, target) { return Boolean(this.pairsBySubject.get(this._resolve(subject))?.get(this._resolve(predicate))?.has(this._resolve(target))); }

  /** @param {{all?:(EntityId|string)[],none?:(EntityId|string)[],any?:Array<(EntityId|string)[]>,pairsAny?:Array<{predicate:EntityId|string,target:EntityId|string}>}} [spec] @returns {EntityId[]} */
  query(spec = {}) {
    const all = (spec.all || []).map(item => this._resolve(item));
    const none = (spec.none || []).map(item => this._resolve(item));
    const any = (spec.any || []).map(group => group.map(item => this._resolve(item)));
    const pairsAny = (spec.pairsAny || []).map(pair => ({ predicate: this._resolve(pair.predicate), target: this._resolve(pair.target) }));
    const matches = [];
    for (let index = 0; index < this.alive.length; index += 1) {
      if (!this.alive[index]) continue;
      const signature = /** @type {Set<number>} */(this.signatures.get(index));
      if (all.some(component => !signature.has(component)) || none.some(component => signature.has(component))) continue;
      if (any.some(group => !group.some(component => signature.has(component)))) continue;
      if (pairsAny.length && !pairsAny.some(pair => this.pairsBySubject.get(index)?.get(pair.predicate)?.has(pair.target))) continue;
      matches.push(runtimeId(index, this.generations[index]));
    }
    return matches.sort((a, b) => /** @type {string} */(this.guidByIndex[a.index]).localeCompare(/** @type {string} */(this.guidByIndex[b.index])));
  }

  /** @param {EntityId|string} entity */
  deleteEntity(entity) {
    const index = this._resolve(entity);
    if (this.definitions.has(index) && this.query({ all: [runtimeId(index, this.generations[index])] }).length) throw new Error('A component definition with active instances requires a dependency-preview migration before deletion.');
    for (const [predicate, targets] of [...(this.pairsBySubject.get(index) || new Map())]) for (const target of [...targets]) this.removePair(runtimeId(index, this.generations[index]), runtimeId(predicate, this.generations[predicate]), runtimeId(target, this.generations[target]));
    for (const [predicate, byTarget] of [...this.subjectsByPair]) for (const subject of [...(byTarget.get(index) || [])]) this.removePair(runtimeId(subject, this.generations[subject]), runtimeId(predicate, this.generations[predicate]), runtimeId(index, this.generations[index]));
    this._removeFromArchetype(index);
    this.signatures.delete(index); this.definitions.delete(index); this.pairsBySubject.delete(index);
    const guid = /** @type {string} */(this.guidByIndex[index]); this.indexByGuid.delete(guid); this.guidByIndex[index] = null;
    this.alive[index] = false; this.generations[index] += 1; this.free.push(index);
  }

  snapshot() {
    const definitions = [...this.definitions].map(([index, definition]) => ({ entityGuid: this.guidByIndex[index], ...definition })).sort((a, b) => String(a.entityGuid).localeCompare(String(b.entityGuid)));
    const entities = [];
    for (const id of this.query()) {
      const index = id.index;
      const components = [...(this.signatures.get(index) || [])].map(component => ({ componentGuid: this.guidByIndex[component], value: this.definitions.get(component)?.storage === 'data' ? this.get(id, runtimeId(component, this.generations[component])) : undefined })).sort((a, b) => String(a.componentGuid).localeCompare(String(b.componentGuid)));
      const pairs = [...(this.pairsBySubject.get(index) || new Map())].flatMap(([predicate, targets]) => [...targets].map(target => ({ predicateGuid: this.guidByIndex[predicate], targetGuid: this.guidByIndex[target] }))).sort((a, b) => `${a.predicateGuid}:${a.targetGuid}`.localeCompare(`${b.predicateGuid}:${b.targetGuid}`));
      entities.push({ guid: this.guidByIndex[index], components, pairs });
    }
    return { version: 1, definitions, entities };
  }
}

export function isRuntimeEntityId(value) { return Boolean(value?.[RUNTIME_ID]); }
