// @ts-check
import { SRD_ITEMS, SRD_SOURCE } from './managed/srd-5.2.1.js';
import { BUILTIN_COMPONENTS, projectStateToEcs, queryProjectedGuids } from './ecs-projection.js';

/** @typedef {{coefficient: bigint, scale: number}} Decimal */
/** @typedef {{precision?:number,min?:string,max?:string,icon?:string,iconImage?:string}} NumericFieldMeta */
/** @typedef {{id:string,name:string,description:string,tags:string[],parentId:string|null,container:boolean,quantity:number,weight:string,image:string|null,order?:number,createdAt:string,updatedAt:string,deleted?:boolean,managed?:boolean|{sourceId:string,version:string,key:string,override?:boolean,detached?:boolean},fields?:Record<string,string>,fieldMeta?:Record<string,NumericFieldMeta>,aliases?:string[],importKey?:string,importState?:{adapter:string,profileVersion:string,items:Array<{key:string,name:string,quantity:number,weight:string,entityId:string}>}}} Entity */
/** @typedef {{operator:'include'|'exclude'|'containers',entityId:string,displayName:string}} QueryBinding */
/** @typedef {{id:string,name:string,query:string,queryBindings?:QueryBinding[],description:string}} Collection */
/** @typedef {{id:string,name:string,description:string,behavior:'create-item'|'create-container'|'create-character'|'browse-query'|'ddb-import'|'custom-create'|'dnd-tools',query:string,queryBindings?:QueryBinding[],presetTagNames?:string[],image?:string|null,enabled?:boolean,managed?:boolean}} ItemSource */
/** @typedef {{path:string,before:unknown,after:unknown}} Change */
/** @typedef {{id:string,label:string,at:string,kind:'action'|'undo'|'redo',changes:Change[],relatedTo?:string}} HistoryEvent */
/** @typedef {{events:HistoryEvent[],undoStack:string[],redoStack:string[],branches:Array<{id:string,createdAt:string,eventIds:string[]}>}} History */
/** @typedef {{version:number,sourceDefaultsVersion?:number,vault:{id:string,name:string,title:string,image:string|null,createdAt:string,folderName?:string},settings:{density:'compact'|'normal'|'spacious',mode:'system'|'light'|'dark',theme:string,accent:string,hue:number,motion:'system'|'reduced'|'full'},entities:Record<string,Entity>,collections:Collection[],itemSources:ItemSource[],history:History,recentTabs:string[],groups:unknown[],friends:Array<{vaultGuid:string,name:string}>,cloud:{enabled:boolean,status:string}}} AppState */

export const SCHEMA_VERSION = 1;
export const MANAGED_ITEM_COUNT = SRD_ITEMS.length;
export const MANAGED_SOURCE_VERSION = SRD_SOURCE.version;
export const SOURCE_DEFAULTS_VERSION = 7;

/** @returns {ItemSource[]} */
export function createDefaultItemSources() {
  return [
    { id: '20000000-0000-4000-8000-000000000001', name: 'Unique', description: 'Create a one-off Item, Container, Character, or Tag for this destination.', behavior: 'custom-create', query: '', presetTagNames: ['Unique'], enabled: true },
    { id: '20000000-0000-4000-8000-000000000002', name: 'Custom', description: 'Create an Item, Container, Character, or Tag.', behavior: 'custom-create', query: '', enabled: true },
    { id: '20000000-0000-4000-8000-000000000004', name: 'Created', description: 'Browse items and Containers created in this Vault.', behavior: 'browse-query', query: '+Created', enabled: true },
    { id: '20000000-0000-4000-8000-000000000003', name: 'Item', description: 'Browse every reusable item definition you can see.', behavior: 'browse-query', query: '+Item', enabled: true },
    { id: '20000000-0000-4000-8000-000000000005', name: 'D&D', description: 'Browse D&D items or import D&D Beyond inventory.', behavior: 'dnd-tools', query: '+D&D5e', enabled: true, managed: true }
  ];
}

/** Adds general shipped definitions once, without recreating user-deleted tiles. @param {AppState} state */
export function syncProductDefaults(state) {
  const now = new Date().toISOString();
  const tagsByName = new Map(Object.values(state.entities).filter(entity => entity.tags.includes('Tag')).map(entity => [entity.name.toLocaleLowerCase(), entity]));
  const ensureTag = (name, description) => {
    const existing = tagsByName.get(name.toLocaleLowerCase());
    if (existing) return existing.id;
    const id = guid();
    const entity = { id, name, description, tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
    state.entities[id] = entity; tagsByName.set(name.toLocaleLowerCase(), entity); return id;
  };
  const itemTag = ensureTag('Item', 'Item marks an Entity that can appear in inventory. Containers may also be Items.');
  const createdTag = ensureTag('Created', 'Created marks local user-editable inventory definitions.');
  ensureTag('Tag', 'Tags label and organize items, Containers, and other Tags.');
  ensureTag('Unique', 'Unique marks an item with no managed-source match.');
  let tagged = 0;
  for (const entity of Object.values(state.entities)) {
    if (entity.tags.includes('Tag')) continue;
    if (!entity.tags.includes(itemTag)) { entity.tags.push(itemTag); tagged += 1; }
    if ((!entity.managed || typeof entity.managed === 'object' && entity.managed.detached) && !entity.tags.includes(createdTag)) { entity.tags.push(createdTag); tagged += 1; }
  }
  let sourcesChanged = false;
  if (!state.sourceDefaultsVersion) {
    const legacyNames = new Set(['Unique item','Container item','Character','Managed items','D&D Beyond PDF']);
    const looksUnmodifiedLegacy = state.itemSources.length === 5 && state.itemSources.every(source => legacyNames.has(source.name));
    if (looksUnmodifiedLegacy || !state.itemSources.length) { state.itemSources = createDefaultItemSources(); sourcesChanged = true; }
    state.sourceDefaultsVersion = SOURCE_DEFAULTS_VERSION;
  }
  if ((state.sourceDefaultsVersion || 0) < 2) {
    const custom = state.itemSources.find(source => source.id === '20000000-0000-4000-8000-000000000002');
    if (custom?.description === 'Create an item, Container item, or Character.') { custom.description = 'Create an Item, Container item, Character, or Tag.'; sourcesChanged = true; }
    state.sourceDefaultsVersion = 2;
  }
  if ((state.sourceDefaultsVersion || 0) < 3) {
    const bagTag = Object.values(state.entities).find(entity => entity.tags.includes('Tag') && entity.name === 'Bag & Pack' && entity.description === 'Bag & Pack is an exact, direct Tag.');
    if (bagTag) { bagTag.name = 'Bag'; bagTag.description = 'Bag is an exact, direct Tag.'; bagTag.updatedAt = now; tagged += 1; }
    const bags = state.collections.find(collection => collection.name === 'Bags & packs' && collection.query === '+"Bag & Pack"');
    if (bags) { bags.name = 'Bags'; bags.query = '+Bag'; bags.description = 'Containers nested throughout your Vault.'; }
    const custom = state.itemSources.find(source => source.id === '20000000-0000-4000-8000-000000000002');
    if (custom?.description === 'Create an Item, Container item, Character, or Tag.') { custom.description = 'Create an Item, Container, Character, or Tag.'; sourcesChanged = true; }
    const dnd = state.itemSources.find(source => source.id === '20000000-0000-4000-8000-000000000005');
    if (dnd?.managed) { dnd.description = 'Browse D&D items or import D&D Beyond inventory.'; if (dnd.query === '+Managed') dnd.query = '+"D&D 5e"'; sourcesChanged = true; }
    state.sourceDefaultsVersion = 3;
  }
  if ((state.sourceDefaultsVersion || 0) < 4) {
    const dnd = state.itemSources.find(source => source.id === '20000000-0000-4000-8000-000000000005');
    if (dnd?.managed && dnd.query === '+Managed') { dnd.query = '+"D&D 5e"'; sourcesChanged = true; }
    state.sourceDefaultsVersion = 4;
  }
  if ((state.sourceDefaultsVersion || 0) < 5) {
    const dndTag = Object.values(state.entities).find(entity => entity.tags.includes('Tag') && entity.name === 'D&D 5e');
    if (dndTag) { dndTag.name = 'D&D5e'; dndTag.description = 'D&D5e marks items supplied by the D&D 5th Edition source.'; dndTag.updatedAt = now; tagged += 1; }
    const dnd = state.itemSources.find(source => source.id === '20000000-0000-4000-8000-000000000005');
    if (dnd?.managed && dnd.query === '+"D&D 5e"') { dnd.query = '+D&D5e'; sourcesChanged = true; }
    state.sourceDefaultsVersion = 5;
  }
  if ((state.sourceDefaultsVersion || 0) < 6) {
    for (const entity of Object.values(state.entities)) {
      if (!entity.tags.includes('Tag')) continue;
      if (entity.name === 'Tag' && entity.description === 'Tag is the component-definition Entity carried directly by every Tag Entity.') entity.description = 'Tags label and organize items, Containers, and other Tags.';
      else if (entity.description === `${entity.name} is an exact, direct Tag.`) entity.description = `${entity.name} groups matching things.`;
    }
    state.sourceDefaultsVersion = 6;
  }
  if ((state.sourceDefaultsVersion || 0) < 7) {
    const unique = state.itemSources.find(source => source.id === '20000000-0000-4000-8000-000000000001');
    if (unique?.description === 'Create a one-off item for this destination.') {
      unique.description = 'Create a one-off Item, Container, Character, or Tag for this destination.';
      if (unique.behavior === 'create-item') unique.behavior = 'custom-create';
      sourcesChanged = true;
    }
    const createdIndex = state.itemSources.findIndex(source => source.id === '20000000-0000-4000-8000-000000000004');
    const itemIndex = state.itemSources.findIndex(source => source.id === '20000000-0000-4000-8000-000000000003');
    if (createdIndex > itemIndex && itemIndex >= 0) {
      const [created] = state.itemSources.splice(createdIndex, 1);
      state.itemSources.splice(itemIndex, 0, created);
      sourcesChanged = true;
    }
    state.sourceDefaultsVersion = 7;
  }
  return { tagged, sourcesChanged };
}

/**
 * Materializes bundled managed definitions without reviving deleted entries or
 * overwriting a local override. Definitions use stable IDs across refreshes.
 * @param {AppState} state
 */
export function syncManagedItems(state) {
  const now = new Date().toISOString();
  const tagsByName = new Map(Object.values(state.entities).filter(entity => entity.tags.includes('Tag')).map(entity => [entity.name.toLocaleLowerCase(), entity]));
  const ensureTag = (name, metadataTags = []) => {
    const existing = tagsByName.get(name.toLocaleLowerCase());
    if (existing) {
      let changed = false;
      if (existing.deleted) { existing.deleted = false; changed = true; }
      for (const tagId of metadataTags) if (!existing.tags.includes(tagId)) { existing.tags.push(tagId); changed = true; }
      if (changed) existing.updatedAt = now;
      return existing.id;
    }
    const id = guid();
    const entity = { id, name, description: `${name} groups matching things.`, tags: ['Tag', ...metadataTags], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
    state.entities[id] = entity;
    tagsByName.set(name.toLocaleLowerCase(), entity);
    return id;
  };
  const managedTag = ensureTag('Managed');
  const dndTag = ensureTag('D&D5e');
  const managedMetadataNames = new Set(SRD_ITEMS.flatMap(definition => [definition.category, ...managedCategoryTagNames(definition.category), managedRarity(definition)]).map(name => name.toLocaleLowerCase()));
  for (const entity of Object.values(state.entities)) {
    if (!entity.tags.includes('Tag') || !managedMetadataNames.has(entity.name.toLocaleLowerCase()) || !/\s/u.test(entity.name)) continue;
    const oldKey = entity.name.toLocaleLowerCase();
    const compactName = managedTagName(entity.name);
    const compactKey = compactName.toLocaleLowerCase();
    const collision = tagsByName.get(compactKey);
    if (collision && collision.id !== entity.id) {
      if (!collision.tags.includes(dndTag)) collision.tags.push(dndTag);
      collision.updatedAt = now;
      for (const taggedEntity of Object.values(state.entities)) {
        if (!taggedEntity.tags.includes(entity.id)) continue;
        taggedEntity.tags = [...new Set(taggedEntity.tags.map(tagId => tagId === entity.id ? collision.id : tagId))];
        taggedEntity.updatedAt = now;
      }
      entity.deleted = true;
      entity.updatedAt = now;
      continue;
    }
    tagsByName.delete(oldKey);
    entity.name = compactName;
    entity.description = `${compactName} groups matching things.`;
    if (!entity.tags.includes(dndTag)) entity.tags.push(dndTag);
    entity.updatedAt = now;
    tagsByName.set(compactKey, entity);
  }
  const itemTag = tagsByName.get('item')?.id;
  const illustrativeDescriptions = new Set([
    'A dependable blade with a cord-wrapped grip.',
    'A crimson restorative in a square glass vial.'
  ]);
  for (const entity of Object.values(state.entities)) {
    if (!entity.managed && illustrativeDescriptions.has(entity.description)) entity.tags = entity.tags.filter(tagId => tagId !== managedTag);
  }
  let added = 0;
  let updated = 0;
  const categoryTags = new Map();
  for (const definition of SRD_ITEMS) {
    const categoryKey = definition.category.toLocaleLowerCase();
    if (!categoryTags.has(categoryKey)) categoryTags.set(categoryKey, managedCategoryTagNames(definition.category).map(name => ensureTag(name, [dndTag])));
  }
  for (const category of new Set(SRD_ITEMS.map(definition => definition.category))) {
    const replacementIds = categoryTags.get(category.toLocaleLowerCase()) || [];
    if (replacementIds.length < 2) continue;
    const legacy = tagsByName.get(managedTagName(category).toLocaleLowerCase());
    if (!legacy || legacy.deleted || !legacy.tags.includes('Tag')) continue;
    for (const taggedEntity of Object.values(state.entities)) {
      if (!taggedEntity.tags.includes(legacy.id)) continue;
      taggedEntity.tags = [...new Set([...taggedEntity.tags.filter(tagId => tagId !== legacy.id), ...replacementIds])];
      taggedEntity.updatedAt = now;
    }
    legacy.deleted = true;
    legacy.updatedAt = now;
  }
  for (const definition of SRD_ITEMS) {
    const definitionCategoryTags = categoryTags.get(definition.category.toLocaleLowerCase()) || [];
    const rarityTag = ensureTag(managedTagName(managedRarity(definition)), [dndTag]);
    const existing = state.entities[definition.id];
    const managed = typeof existing?.managed === 'object' ? existing.managed : null;
    if (existing?.deleted || managed?.override || managed?.detached) continue;
    const next = {
      ...(existing || {}), id: definition.id, name: definition.name,
      description: managedDescription(definition),
      tags: [managedTag, dndTag, ...definitionCategoryTags, rarityTag, ...(itemTag ? [itemTag] : [])], parentId: null, container: definition.category === 'Container', quantity: 1,
      weight: definition.weight, image: definition.image || null, fields: { Value: managedGoldValue(definition.cost) }, fieldMeta: { Value: { min: '0', icon: '◈' } }, aliases: [...definition.aliases],
      managed: { sourceId: SRD_SOURCE.id, version: SRD_SOURCE.version, key: definition.id },
      createdAt: existing?.createdAt || now, updatedAt: existing?.updatedAt || now
    };
    if (existing) updated += JSON.stringify(existing) === JSON.stringify(next) ? 0 : 1;
    else added += 1;
    state.entities[definition.id] = next;
  }
  return { added, updated, source: SRD_SOURCE };
}

function managedRarity(definition) {
  return definition.description.match(/^(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)\b/i)?.[1]?.replace(/\b\w/g, character => character.toUpperCase()) || 'Common';
}

function managedTagName(name) {
  return String(name).replace(/\s+/gu, '');
}

function managedCategoryTagNames(category) {
  const match = String(category).trim().match(/^(?:(Magic|Martial|Simple)\s+)?(?:(Melee|Ranged)\s+)?Weapon$/i);
  if (!match) return [managedTagName(category)];
  return [match[1], match[2], 'Weapon'].filter(Boolean).map(name => name.replace(/^\w/, character => character.toUpperCase()));
}

function managedDescription(definition) {
  const escapePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let description = String(definition.description || '').trim();
  description = description.replace(new RegExp(`^${escapePattern(definition.name)}\\s+`, 'i'), '');
  if (definition.cost && !/^See SRD$/i.test(definition.cost)) description = description.replace(new RegExp(`\\s+${escapePattern(definition.cost)}\\s*$`, 'i'), '');
  if (definition.weight && definition.weight !== '0') description = description.replace(new RegExp(`\\s+${escapePattern(definition.weight)}\\s+lb\\.\\s*$`, 'i'), '');
  return description.trim();
}

function managedGoldValue(cost) {
  const match = String(cost || '').match(/^([\d,.]+)\s*(CP|SP|EP|GP|PP)$/i);
  if (!match) return '0';
  const amount = parseDecimal(match[1].replaceAll(',', ''));
  const unit = match[2].toUpperCase();
  if (unit === 'CP') return decimalToString({ coefficient: amount.coefficient, scale: amount.scale + 2 });
  if (unit === 'SP') return decimalToString({ coefficient: amount.coefficient, scale: amount.scale + 1 });
  if (unit === 'EP') return decimalToString({ coefficient: amount.coefficient * 5n, scale: amount.scale + 1 });
  if (unit === 'PP') return decimalToString({ coefficient: amount.coefficient * 10n, scale: amount.scale });
  return decimalToString(amount);
}

/** @param {AppState} state @param {string} id @returns {Entity|null} */
export function managedBaseEntity(state, id) {
  const definition = SRD_ITEMS.find(item => item.id === id);
  const existing = state.entities[id];
  if (!definition || !existing || typeof existing.managed === 'object' && existing.managed.detached) return null;
  const tagId = name => Object.values(state.entities).find(entity => entity.tags.includes('Tag') && entity.name === name)?.id;
  const tags = [tagId('Managed'), tagId('D&D5e'), ...managedCategoryTagNames(definition.category).map(tagId), tagId(managedTagName(managedRarity(definition))), tagId('Item')].filter(Boolean);
  return {
    ...existing, name: definition.name,
    description: managedDescription(definition),
    tags, parentId: null, container: definition.category === 'Container', quantity: 1, weight: definition.weight,
    image: definition.image || null, fields: { Value: managedGoldValue(definition.cost) }, fieldMeta: { Value: { min: '0', icon: '◈' } }, aliases: [...definition.aliases], deleted: false,
    managed: { sourceId: SRD_SOURCE.id, version: SRD_SOURCE.version, key: definition.id }, updatedAt: new Date().toISOString()
  };
}

/** @returns {string} */
export function guid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** @param {string|number|bigint} input @returns {Decimal} */
export function parseDecimal(input) {
  const text = String(input).trim();
  if (text.length > 4_096) throw new TypeError('Exact decimal exceeds the supported safety bound');
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new TypeError(`Invalid exact decimal: ${text}`);
  const fraction = match[3] || '';
  let coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  let scale = fraction.length;
  while (scale && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

/** @param {Decimal} value @returns {string} */
export function decimalToString(value) {
  const negative = value.coefficient < 0n;
  let digits = (negative ? -value.coefficient : value.coefficient).toString();
  if (!value.scale) return `${negative ? '-' : ''}${digits}`;
  digits = digits.padStart(value.scale + 1, '0');
  const split = digits.length - value.scale;
  return `${negative ? '-' : ''}${digits.slice(0, split)}.${digits.slice(split)}`;
}

/** Formats an exact decimal without converting it to a floating-point Number. @param {string} value @param {string|string[]} [locale] */
export function formatExactDecimal(value, locale) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return String(value);
  const formatter = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 });
  const whole = formatter.format(BigInt(match[2]));
  if (!match[3]) return `${match[1]}${whole}`;
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value || '.';
  return `${match[1]}${whole}${decimal}${match[3]}`;
}

/** @param {Decimal} a @param {Decimal} b @returns {Decimal} */
export function addDecimal(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return normalizeDecimal({
    coefficient: a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale),
    scale
  });
}

/** @param {Decimal} a @param {Decimal} b */
export function compareDecimal(a, b) {
  const scale = Math.max(a.scale, b.scale);
  const left = a.coefficient * 10n ** BigInt(scale - a.scale);
  const right = b.coefficient * 10n ** BigInt(scale - b.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {Decimal} value @param {number} multiplier @returns {Decimal} */
export function multiplyDecimal(value, multiplier) {
  if (!Number.isSafeInteger(multiplier)) throw new TypeError('Multiplier must be a safe integer');
  return normalizeDecimal({ coefficient: value.coefficient * BigInt(multiplier), scale: value.scale });
}

/** @param {Decimal} value @returns {Decimal} */
function normalizeDecimal(value) {
  let { coefficient, scale } = value;
  while (scale && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

/** @param {AppState} state @param {string} id @returns {Decimal} */
export function computeWeight(state, id) {
  const root = state.entities[id];
  if (!root || root.deleted) return parseDecimal('0');
  const children = new Map();
  for (const entity of Object.values(state.entities)) if (!entity.deleted && entity.parentId) children.set(entity.parentId, [...(children.get(entity.parentId) || []), entity.id]);
  /** @type {Map<string,0|1|2>} */ const color = new Map();
  /** @type {Map<string,Decimal>} */ const totals = new Map();
  const stack = [{ id, expanded: false }];
  while (stack.length) {
    const frame = stack.pop();
    if (!frame) break;
    const entity = state.entities[frame.id];
    if (!entity || entity.deleted) { totals.set(frame.id, parseDecimal('0')); continue; }
    if (frame.expanded) {
      let perCopy = parseDecimal(entity.weight || '0');
      if (entity.container) for (const childId of children.get(entity.id) || []) perCopy = addDecimal(perCopy, totals.get(childId) || parseDecimal('0'));
      totals.set(entity.id, multiplyDecimal(perCopy, entity.quantity || 1));
      color.set(entity.id, 2);
      continue;
    }
    if (color.get(entity.id) === 1) throw new Error('Containment cycle detected');
    if (color.get(entity.id) === 2) continue;
    color.set(entity.id, 1);
    stack.push({ id: entity.id, expanded: true });
    const childIds = children.get(entity.id) || [];
    for (let index = childIds.length - 1; index >= 0; index -= 1) stack.push({ id: childIds[index], expanded: false });
  }
  return totals.get(id) || parseDecimal('0');
}

/** Computes every available Entity's recursive total in one linear forest traversal. @param {AppState} state @returns {Map<string,Decimal>} */
export function computeAllWeights(state) {
  /** @type {Map<string,string[]>} */ const children = new Map();
  for (const entity of Object.values(state.entities)) if (!entity.deleted && entity.parentId) children.set(entity.parentId, [...(children.get(entity.parentId) || []), entity.id]);
  /** @type {Map<string,0|1|2>} */ const color = new Map();
  /** @type {Map<string,Decimal>} */ const totals = new Map();
  for (const root of Object.values(state.entities)) {
    if (root.deleted || color.get(root.id) === 2) continue;
    const stack = [{ id: root.id, expanded: false }];
    while (stack.length) {
      const frame = stack.pop();
      if (!frame) break;
      const entity = state.entities[frame.id];
      if (!entity || entity.deleted) { totals.set(frame.id, parseDecimal('0')); continue; }
      if (frame.expanded) {
        let perCopy = parseDecimal(entity.weight || '0');
        if (entity.container) for (const childId of children.get(entity.id) || []) perCopy = addDecimal(perCopy, totals.get(childId) || parseDecimal('0'));
        totals.set(entity.id, multiplyDecimal(perCopy, entity.quantity || 1));
        color.set(entity.id, 2);
        continue;
      }
      if (color.get(entity.id) === 1) throw new Error('Containment cycle detected');
      if (color.get(entity.id) === 2) continue;
      color.set(entity.id, 1);
      stack.push({ id: entity.id, expanded: true });
      const childIds = children.get(entity.id) || [];
      for (let index = childIds.length - 1; index >= 0; index -= 1) if (color.get(childIds[index]) !== 2) stack.push({ id: childIds[index], expanded: false });
    }
  }
  return totals;
}

/** @param {AppState} state @param {string} childId @param {string|null} parentId @returns {{ok:true}|{ok:false,reason:string}} */
export function canMove(state, childId, parentId) {
  if (!parentId) return { ok: true };
  if (childId === parentId) return { ok: false, reason: 'A container cannot contain itself.' };
  const parent = state.entities[parentId];
  if (!parent?.container || parent.deleted) return { ok: false, reason: 'Choose an available container.' };
  const visited = new Set();
  let cursor = parent;
  while (cursor) {
    if (visited.has(cursor.id)) return { ok: false, reason: 'This inventory already contains a cycle and must be repaired.' };
    if (cursor.id === childId) return { ok: false, reason: 'That move would place a container inside itself through one of its descendants.' };
    visited.add(cursor.id);
    cursor = cursor.parentId ? state.entities[cursor.parentId] : undefined;
  }
  return { ok: true };
}

/**
 * Build one atomic, undoable inventory move. The visible order and the stored
 * order use the same comparison so rendering never disagrees with a drop.
 *
 * @param {AppState} state
 * @param {string} entityId
 * @param {string} parentId
 * @param {string} [targetId]
 * @param {'before'|'after'|'append'} [position]
 * @param {string} [updatedAt]
 * @returns {{ok:true,writes:Array<{path:string,value:Entity}>,sameParent:boolean}|{ok:false,reason:string}}
 */
export function prepareInventoryMove(state, entityId, parentId, targetId = '', position = 'append', updatedAt = new Date().toISOString()) {
  const entity = state.entities[entityId];
  if (!entity || entity.deleted) return { ok: false, reason: 'That item is no longer available.' };
  const allowed = canMove(state, entityId, parentId);
  if (!allowed.ok) return allowed;
  const target = targetId ? state.entities[targetId] : null;
  if (targetId && (!target || target.deleted || target.parentId !== parentId)) return { ok: false, reason: 'That drop position is no longer available.' };
  if (targetId === entityId) return { ok: false, reason: 'Choose a different position for this item.' };

  const sameParent = entity.parentId === parentId;
  const orderedChildren = id => Object.values(state.entities)
    .filter(candidate => !candidate.deleted && candidate.parentId === id && candidate.id !== entityId)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const destination = orderedChildren(parentId);
  let insertAt = destination.length;
  if (targetId) {
    const targetIndex = destination.findIndex(candidate => candidate.id === targetId);
    if (targetIndex < 0) return { ok: false, reason: 'That drop position is no longer available.' };
    insertAt = targetIndex + (position === 'after' ? 1 : 0);
  }
  destination.splice(insertAt, 0, entity);

  const changed = new Map();
  if (!sameParent && entity.parentId) {
    orderedChildren(entity.parentId).forEach((candidate, order) => changed.set(candidate.id, { ...candidate, order, updatedAt }));
  }
  destination.forEach((candidate, order) => changed.set(candidate.id, { ...candidate, parentId, order, updatedAt }));
  return { ok: true, sameParent, writes: [...changed].map(([id, value]) => ({ path: `/entities/${id}`, value })) };
}

/** @param {AppState} state @param {Entity|string} entityOrId */
export function isEntityVisible(state, entityOrId) {
  let entity = typeof entityOrId === 'string' ? state.entities[entityOrId] : entityOrId;
  const visited = new Set();
  while (entity) {
    if (entity.deleted || visited.has(entity.id)) return false;
    visited.add(entity.id);
    entity = entity.parentId ? state.entities[entity.parentId] : undefined;
  }
  return true;
}

/** @param {unknown} value */
function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

/** @param {string} text */
function fastHash(text) {
  let hash = 14695981039346656037n;
  for (let index = 0; index < text.length; index += 1) { hash ^= BigInt(text.charCodeAt(index)); hash = BigInt.asUintN(64, hash * 1099511628211n); }
  return hash.toString(16).padStart(16, '0');
}

/** @param {AppState} state */
function structuralIndex(state) {
  const entities = Object.values(state.entities).filter(entity => !entity.deleted);
  const childIds = new Map();
  for (const entity of entities) if (entity.parentId) {
    const list = childIds.get(entity.parentId) || [];
    list.push(entity.id);
    childIds.set(entity.parentId, list);
  }
  /** @type {Map<string,0|1|2>} */ const color = new Map();
  /** @type {Map<string,number>} */ const nestedClass = new Map();
  /** @type {Map<string,number>} */ const intern = new Map();
  let nextClass = 1;
  for (const start of entities) {
    if (color.get(start.id) === 2) continue;
    const stack = [{ id: start.id, expanded: false }];
    while (stack.length) {
      const frame = stack.pop();
      if (!frame) break;
      const entity = state.entities[frame.id];
      if (!entity || entity.deleted) continue;
      if (frame.expanded) {
        const children = (childIds.get(entity.id) || []).map(childId => nestedClass.get(childId) || 0).sort((a, b) => a - b);
        const local = { name: entity.name, description: entity.description, tags: [...entity.tags].sort(), container: entity.container, quantity: entity.quantity, weight: entity.weight, image: entity.image, fields: entity.fields || {}, fieldMeta: entity.fieldMeta || {}, children };
        const key = stableJson(local);
        let classId = intern.get(key);
        if (!classId) { classId = nextClass; nextClass += 1; intern.set(key, classId); }
        nestedClass.set(entity.id, classId);
        color.set(entity.id, 2);
        continue;
      }
      if (color.get(entity.id) === 1) throw new Error('Containment cycle detected while comparing stack entries.');
      if (color.get(entity.id) === 2) continue;
      color.set(entity.id, 1);
      stack.push({ id: entity.id, expanded: true });
      const children = childIds.get(entity.id) || [];
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push({ id: children[index], expanded: false });
    }
  }
  /** @type {Map<string,{hash:string,canonical:string}>} */ const results = new Map();
  for (const entity of entities) {
    const children = (childIds.get(entity.id) || []).map(childId => nestedClass.get(childId) || 0).sort((a, b) => a - b);
    const rootKey = stableJson({ name: entity.name, description: entity.description, tags: [...entity.tags].sort(), container: entity.container, weight: entity.weight, image: entity.image, fields: entity.fields || {}, fieldMeta: entity.fieldMeta || {}, children });
    results.set(entity.id, { hash: fastHash(rootKey), canonical: rootKey });
  }
  return results;
}

/** @param {AppState} state @param {string} id @returns {{hash:string,canonical:string}} */
export function structuralFingerprint(state, id) {
  return structuralIndex(state).get(id) || { hash: '0'.repeat(16), canonical: 'null' };
}

/** @param {AppState} state @param {string} id @param {number} [splitQuantity] */
export function prepareStackSplit(state, id, splitQuantity = 1) {
  const root = state.entities[id];
  if (!root?.container || root.deleted) throw new Error('Only an available container stack can be split.');
  if (!Number.isSafeInteger(splitQuantity) || splitQuantity < 1 || splitQuantity >= root.quantity) throw new Error('Split quantity must leave at least one copy in the original stack.');
  /** @type {Array<{path:string,value:unknown}>} */ const writes = [{ path: `/entities/${id}`, value: { ...root, quantity: root.quantity - splitQuantity, updatedAt: new Date().toISOString() } }];
  /** @type {Map<string,string>} */ const ids = new Map();
  /** @type {Map<string,Entity[]>} */ const children = new Map();
  for (const item of Object.values(state.entities)) if (!item.deleted && item.parentId) { const list = children.get(item.parentId) || []; list.push(item); children.set(item.parentId, list); }
  const cloneId = guid();
  ids.set(id, cloneId);
  writes.push({ path: `/entities/${cloneId}`, value: { ...structuredClone(root), id: cloneId, parentId: root.parentId, quantity: splitQuantity, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  const stack = [id];
  while (stack.length) {
    const sourceId = stack.pop();
    if (!sourceId) break;
    for (const source of children.get(sourceId) || []) {
      const childCloneId = guid();
      ids.set(source.id, childCloneId);
      writes.push({ path: `/entities/${childCloneId}`, value: { ...structuredClone(source), id: childCloneId, parentId: ids.get(sourceId) || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
      stack.push(source.id);
    }
  }
  return { cloneId, writes };
}

/** @param {AppState} state @param {string} id */
export function restackCandidates(state, id) {
  const entity = state.entities[id];
  if (!entity?.container || entity.deleted) return [];
  const fingerprints = structuralIndex(state);
  const fingerprint = fingerprints.get(id);
  if (!fingerprint) return [];
  return Object.values(state.entities).filter(candidate => candidate.id !== id && candidate.container && !candidate.deleted && candidate.parentId === entity.parentId).filter(candidate => {
    const other = fingerprints.get(candidate.id);
    if (!other) return false;
    return other.hash === fingerprint.hash && other.canonical === fingerprint.canonical;
  });
}

/** @param {AppState} state @param {string} id */
export function prepareRestack(state, id) {
  const entity = state.entities[id];
  const candidates = restackCandidates(state, id);
  if (!entity || !candidates.length) throw new Error('No identical sibling containers are available to restack.');
  /** @type {Array<{path:string,value:unknown}>} */ const writes = [{ path: `/entities/${id}`, value: { ...entity, quantity: entity.quantity + candidates.reduce((sum, item) => sum + item.quantity, 0), updatedAt: new Date().toISOString() } }];
  /** @type {Map<string,string[]>} */ const children = new Map();
  for (const item of Object.values(state.entities)) if (item.parentId) { const list = children.get(item.parentId) || []; list.push(item.id); children.set(item.parentId, list); }
  const removeTree = rootId => {
    const ordered = [];
    const stack = [rootId];
    while (stack.length) {
      const next = stack.pop();
      if (!next) break;
      ordered.push(next);
      for (const childId of children.get(next) || []) stack.push(childId);
    }
    for (let index = ordered.length - 1; index >= 0; index -= 1) writes.push({ path: `/entities/${ordered[index]}`, value: undefined });
  };
  for (const candidate of candidates) removeTree(candidate.id);
  return { mergedCount: candidates.length, writes };
}

export const SEARCH_OPERATORS = Object.freeze([
  Object.freeze({ symbol: '+', key: 'include', kind: 'tag', label: 'Must have Tag', tone: 'include' }),
  Object.freeze({ symbol: '-', key: 'exclude', kind: 'tag', label: 'Must not have Tag', tone: 'exclude' }),
  Object.freeze({ symbol: '=', key: 'containers', kind: 'container', label: 'Inside Container', tone: 'container' })
]);

const GUID_PATH = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ENTITY_MUTATION_PATH = new RegExp(`^/entities/${GUID_PATH}$`, 'i');
const ROOT_MUTATION_PATHS = new Set(['/settings', '/collections', '/itemSources', '/groups', '/friends', '/vault/name', '/vault/title', '/vault/image']);

/** Imported history may only address the same coarse state boundaries used by commands. @param {unknown} path */
export function isSafeMutationPath(path) {
  return typeof path === 'string' && (ROOT_MUTATION_PATHS.has(path) || ENTITY_MUTATION_PATH.test(path));
}

/** @param {unknown} path @returns {asserts path is string} */
function assertSafeMutationPath(path) {
  if (!isSafeMutationPath(path)) throw new Error('The change targets an unsupported state path.');
}

/** @param {string} query @returns {{text:string,include:string[],exclude:string[],containers:string[]}} */
export function parseQuery(query) {
  const result = { text: '', include: /** @type {string[]} */([]), exclude: /** @type {string[]} */([]), containers: /** @type {string[]} */([]) };
  const text = [];
  const pattern = /([+\-=])(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s]+))|"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s]+)/g;
  let match;
  while ((match = pattern.exec(query))) {
    const decode = value => String(value || '').replace(/\\([+\-=\\"'])/g, '$1');
    if (match[1]) {
      const operand = decode(match[2] ?? match[3] ?? match[4]);
      if (!operand) continue;
      const operator = SEARCH_OPERATORS.find(item => item.symbol === match[1]);
      if (operator) result[operator.key].push(operand);
    } else {
      text.push(decode(match[5] ?? match[6] ?? match[7]));
    }
  }
  result.text = text.join(' ').toLocaleLowerCase();
  return result;
}

/** Resolves exact structured operands once so saved queries survive renames and duplicate display names. @param {AppState} state @param {string} query @returns {QueryBinding[]} */
export function resolveQueryBindings(state, query) {
  const parsed = parseQuery(query);
  const entities = Object.values(state.entities);
  const bindings = [];
  for (const operator of SEARCH_OPERATORS) {
    for (const displayName of parsed[operator.key]) {
      const matches = entities.filter(entity => entity.name.localeCompare(displayName, undefined, { sensitivity: 'accent' }) === 0 && (operator.kind === 'tag' ? entity.tags.includes('Tag') : entity.container));
      if (matches.length === 1) bindings.push({ operator: /** @type {QueryBinding['operator']} */(operator.key), entityId: matches[0].id, displayName });
    }
  }
  return bindings;
}

/** @param {AppState} state */
export function syncQueryBindings(state) {
  let updated = 0;
  for (const subject of [...state.collections, ...state.itemSources]) {
    if (!subject.query || subject.queryBindings?.length) continue;
    const bindings = resolveQueryBindings(state, subject.query);
    if (bindings.length) { subject.queryBindings = bindings; updated += 1; }
  }
  return updated;
}

/** @param {AppState} state @param {string} query @param {QueryBinding[]} [bindings] @returns {Entity[]} */
export function searchEntities(state, query, bindings = []) {
  const parsed = parseQuery(query);
  /** @type {Map<string,string[]>} */ const tagsByName = new Map();
  /** @type {Map<string,string[]>} */ const containersByName = new Map();
  const entities = Object.values(state.entities);
  for (const entity of entities) {
    const name = entity.name.toLocaleLowerCase();
    if (!entity.deleted && entity.tags.includes('Tag')) tagsByName.set(name, [...(tagsByName.get(name) || []), entity.id]);
    if (entity.container) containersByName.set(name, [...(containersByName.get(name) || []), entity.id]);
  }
  const boundIds = (operator, value) => bindings.filter(binding => binding.operator === operator && binding.displayName.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0 && state.entities[binding.entityId] && !state.entities[binding.entityId].deleted).map(binding => binding.entityId);
  const componentGuid = id => state.entities[id]?.name === 'Tag' && state.entities[id]?.tags.includes('Tag') ? BUILTIN_COMPONENTS.tag : id;
  const tagIds = (value, operator) => (boundIds(operator, value).length ? boundIds(operator, value) : tagsByName.get(value.toLocaleLowerCase()) || []).map(componentGuid);
  const containerIds = value => boundIds('containers', value).length ? boundIds('containers', value) : containersByName.get(value.toLocaleLowerCase()) || [];
  const world = projectStateToEcs(state);
  const containerOperands = parsed.containers.flatMap(term => containerIds(term));
  const structuredMatches = parsed.containers.length && !containerOperands.length ? new Set() : new Set(queryProjectedGuids(world, {
    include: parsed.include.map(term => tagIds(term, 'include')),
    exclude: parsed.exclude.flatMap(term => tagIds(term, 'exclude')),
    containers: containerOperands
  }));
  return entities.filter(entity => {
    if (!isEntityVisible(state, entity)) return false;
    if (!structuredMatches.has(entity.id)) return false;
    const haystack = `${entity.name} ${entity.description} ${entity.tags.map(id => state.entities[id]?.name || '').join(' ')}`.toLocaleLowerCase();
    if (parsed.text && !haystack.includes(parsed.text)) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** @param {AppState} state @param {string} path @returns {unknown} */
function readPath(state, path) {
  assertSafeMutationPath(path);
  const parts = path.split('/').filter(Boolean);
  let value = /** @type {any} */(state);
  for (const part of parts) value = value?.[part];
  return structuredClone(value);
}

/** @param {AppState} state @param {string} path @param {unknown} value */
function writePath(state, path, value) {
  assertSafeMutationPath(path);
  const parts = path.split('/').filter(Boolean);
  let target = /** @type {any} */(state);
  for (let index = 0; index < parts.length - 1; index += 1) {
    target = target?.[parts[index]];
    if (!target || typeof target !== 'object') throw new Error('The change path is unavailable in this Vault.');
  }
  const key = parts.at(-1);
  if (!key) throw new Error('Invalid change path');
  if (value === undefined) delete target[key];
  else target[key] = structuredClone(value);
}

/** @param {AppState} state @param {string} label @param {Array<{path:string,value:unknown}>} writes @returns {HistoryEvent} */
export function commit(state, label, writes) {
  const changes = writes.map(write => ({ path: write.path, before: readPath(state, write.path), after: structuredClone(write.value) }));
  if (state.history.redoStack.length) {
    state.history.branches.push({ id: guid(), createdAt: new Date().toISOString(), eventIds: [...state.history.redoStack] });
    state.history.redoStack = [];
  }
  for (const change of changes) writePath(state, change.path, change.after);
  const event = { id: guid(), label, at: new Date().toISOString(), kind: /** @type {'action'} */('action'), changes };
  state.history.events.push(event);
  state.history.undoStack.push(event.id);
  return event;
}

/** @param {AppState} state @returns {HistoryEvent|null} */
export function undo(state) {
  const id = state.history.undoStack.pop();
  if (!id) return null;
  const original = state.history.events.find(event => event.id === id);
  if (!original) return null;
  for (const change of [...original.changes].reverse()) writePath(state, change.path, change.before);
  state.history.redoStack.push(id);
  const event = { id: guid(), label: `Undo ${original.label}`, at: new Date().toISOString(), kind: /** @type {'undo'} */('undo'), changes: original.changes.map(change => ({ path: change.path, before: structuredClone(change.after), after: structuredClone(change.before) })), relatedTo: id };
  state.history.events.push(event);
  return event;
}

/** @param {AppState} state @returns {HistoryEvent|null} */
export function redo(state) {
  const id = state.history.redoStack.pop();
  if (!id) return null;
  const original = state.history.events.find(event => event.id === id);
  if (!original) return null;
  for (const change of original.changes) writePath(state, change.path, change.after);
  state.history.undoStack.push(id);
  const event = { id: guid(), label: `Redo ${original.label}`, at: new Date().toISOString(), kind: /** @type {'redo'} */('redo'), changes: original.changes.map(change => ({ path: change.path, before: structuredClone(change.before), after: structuredClone(change.after) })), relatedTo: id };
  state.history.events.push(event);
  return event;
}

/** Applies one canonically ordered encrypted remote event once. @param {AppState} state @param {HistoryEvent} event */
export function applyRemoteEvent(state, event) {
  if (state.history.events.some(existing => existing.id === event.id)) return false;
  if (!event || typeof event.id !== 'string' || typeof event.label !== 'string' || !Array.isArray(event.changes)) throw new Error('The encrypted change is malformed.');
  for (const change of event.changes) {
    if (!change || typeof change.path !== 'string' || !isSafeMutationPath(change.path)) throw new Error('The encrypted change contains an unsupported state path.');
  }
  for (const change of event.changes) writePath(state, change.path, structuredClone(change.after));
  state.history.events.push(structuredClone(event));
  return true;
}

/** @param {string} vaultName @param {string} displayName @param {Partial<AppState['settings']>} [preferences] @returns {AppState} */
export function createState(vaultName, displayName, preferences = {}) {
  const now = new Date().toISOString();
  /** @type {AppState} */
  const state = {
    version: SCHEMA_VERSION,
    vault: { id: guid(), name: displayName || 'Local user', title: vaultName || `${displayName || 'My'} Vault`, image: null, createdAt: now },
    settings: { density: 'normal', mode: 'system', theme: 'modern', accent: 'custom', hue: 33, motion: 'system', ...preferences },
    sourceDefaultsVersion: SOURCE_DEFAULTS_VERSION,
    entities: {}, collections: [], itemSources: createDefaultItemSources(), history: { events: [], undoStack: [], redoStack: [], branches: [] }, recentTabs: [], groups: [], friends: [], cloud: { enabled: true, status: 'Automatic' }
  };
  const makeTag = (name, description) => {
    const id = guid();
    state.entities[id] = { id, name, description, tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
    return id;
  };
  makeTag('Tag', 'Tags label and organize items, Containers, and other Tags.');
  makeTag('Character', 'Character groups matching things.');
  makeTag('Party', 'Party groups matching things.');
  makeTag('Bag', 'Bag groups matching things.');
  state.collections = [
    { id: guid(), name: 'Characters', description: 'People whose inventories you manage.', query: '+Character' },
    { id: guid(), name: 'Parties', description: 'Shared travel and campaign inventories.', query: '+Party' },
    { id: guid(), name: 'Bags', description: 'Containers nested throughout your Vault.', query: '+Bag' }
  ];
  syncManagedItems(state);
  syncProductDefaults(state);
  syncQueryBindings(state);
  return state;
}
