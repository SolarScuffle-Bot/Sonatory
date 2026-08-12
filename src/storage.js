// @ts-check
import { createDefaultItemSources, isSafeMutationPath, parseDecimal } from './core.js';

const DB_NAME = 'sonatory';
const DB_VERSION = 4;
const STORE = 'vaults';
const HANDLE_STORE = 'folder-handles';
const SETTINGS_STORE = 'device-settings';
const SYNC_STORE = 'cloud-runtime';
const APPEARANCE_KEY = 'appearance';
const PANEL_STATE_KEY = 'panel-state';
const ACTIVE_KEY = 'active-vault';
const META_FILE = '.sonatory-vault.json';
const SNAPSHOT_FILE = 'vault.snapshot.json';
const NEXT_FILE = 'vault.snapshot.next.json';
const LAST_GOOD_FILE = 'vault.snapshot.last-good.json';
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_SETTINGS = Object.freeze({ density: 'normal', mode: 'system', theme: 'modern', accent: 'custom', hue: 33, motion: 'system' });
/** @type {Map<string, FileSystemDirectoryHandle>} */
const handleCache = new Map();

/** @param {unknown} value */
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

/** @param {unknown} value @param {number} maximum */
function isBoundedString(value, maximum) { return typeof value === 'string' && value.length <= maximum; }

/** @param {unknown} value */
function isTimestamp(value) { return isBoundedString(value, 80) && Number.isFinite(Date.parse(value)); }

/** @param {unknown} value */
function isPrivateImage(value) {
  return value === null || typeof value === 'string' && value.length <= 4_000_000 && /^data:image\/webp;base64,[a-z0-9+/]+=*$/i.test(value);
}

/** @param {unknown} value @returns {asserts value is import('./core.js').AppState['settings']} */
function validateSettings(value) {
  if (!isRecord(value)) throw new Error('The Vault appearance settings are invalid.');
  const settings = /** @type {Record<string, any>} */(value);
  const accents = ['custom','red','orange','yellow','green','cyan','blue','purple','magenta','white','light-gray','dark-gray','black'];
  if (!['compact','normal','spacious'].includes(settings.density) || !['system','light','dark'].includes(settings.mode) || !['system','reduced','full'].includes(settings.motion) || !isBoundedString(settings.theme, 80) || !accents.includes(settings.accent) || !Number.isInteger(settings.hue) || settings.hue < 0 || settings.hue > 359) throw new Error('The Vault appearance settings are invalid.');
}

/** Applies only backwards-compatible appearance defaults; invalid choices fall back without blocking Vault content. @param {unknown} value */
function normalizeSettings(value) {
  const candidate = { ...DEFAULT_SETTINGS, ...(isRecord(value) ? value : {}) };
  try { validateSettings(candidate); return structuredClone(candidate); }
  catch { return structuredClone(DEFAULT_SETTINGS); }
}

/** @param {unknown} value @param {string} id */
function validateEntity(value, id) {
  if (!isRecord(value)) throw new Error('The Vault contains a malformed entity.');
  const entity = /** @type {Record<string, any>} */(value);
  if (entity.id !== id || !GUID_PATTERN.test(id) || !isBoundedString(entity.name, 10_000) || !entity.name.trim() || !isBoundedString(entity.description, 200_000) || !Array.isArray(entity.tags) || entity.tags.length > 10_000 || !entity.tags.every(tag => tag === 'Tag' || typeof tag === 'string' && GUID_PATTERN.test(tag)) || typeof entity.container !== 'boolean' || !Number.isSafeInteger(entity.quantity) || entity.quantity < 1 || !isBoundedString(entity.weight, 4_096) || !(entity.parentId === null || typeof entity.parentId === 'string' && GUID_PATTERN.test(entity.parentId)) || !isPrivateImage(entity.image ?? null) || !isTimestamp(entity.createdAt) || !isTimestamp(entity.updatedAt) || !(entity.deleted === undefined || typeof entity.deleted === 'boolean')) throw new Error('The Vault contains a malformed entity.');
  if (entity.order !== undefined && (!Number.isSafeInteger(entity.order) || entity.order < 0)) throw new Error('The Vault contains an invalid item order.');
  try { if (parseDecimal(entity.weight).coefficient < 0n) throw new Error(); } catch { throw new Error('The Vault contains an invalid exact Weight value.'); }
  if (entity.fields !== undefined) {
    if (!isRecord(entity.fields) || Object.keys(entity.fields).length > 100) throw new Error('The Vault contains invalid numerical fields.');
    for (const [name, number] of Object.entries(entity.fields)) {
      if (!name || name.length > 60 || !isBoundedString(number, 4_096)) throw new Error('The Vault contains invalid numerical fields.');
      try { parseDecimal(number); } catch { throw new Error('The Vault contains invalid numerical fields.'); }
    }
  }
  if (entity.fieldMeta !== undefined) {
    if (!isRecord(entity.fieldMeta) || Object.keys(entity.fieldMeta).length > 100) throw new Error('The Vault contains invalid numerical field constraints.');
    for (const [name, metaValue] of Object.entries(entity.fieldMeta)) {
      if (!entity.fields?.[name] || !isRecord(metaValue)) throw new Error('The Vault contains invalid numerical field constraints.');
      const meta = /** @type {Record<string,unknown>} */(metaValue);
      if (Object.keys(meta).some(key => !['precision','min','max','icon','iconImage'].includes(key)) || !(meta.precision === undefined || Number.isSafeInteger(meta.precision) && Number(meta.precision) >= 0 && Number(meta.precision) <= 12) || !(meta.icon === undefined || isBoundedString(meta.icon, 12)) || !isPrivateImage(meta.iconImage ?? null)) throw new Error('The Vault contains invalid numerical field constraints.');
      for (const key of ['min','max']) if (meta[key] !== undefined) { if (!isBoundedString(meta[key], 4_096)) throw new Error('The Vault contains invalid numerical field constraints.'); try { parseDecimal(meta[key]); } catch { throw new Error('The Vault contains invalid numerical field constraints.'); } }
      const value = parseDecimal(entity.fields[name]);
      if (meta.precision !== undefined && value.scale > Number(meta.precision)) throw new Error('The Vault contains numerical field data beyond its declared precision.');
      const minimum = meta.min === undefined ? null : parseDecimal(/** @type {string} */(meta.min));
      const maximum = meta.max === undefined ? null : parseDecimal(/** @type {string} */(meta.max));
      const compare = (left, right) => { const scale = Math.max(left.scale, right.scale); const a = left.coefficient * 10n ** BigInt(scale - left.scale); const b = right.coefficient * 10n ** BigInt(scale - right.scale); return a < b ? -1 : a > b ? 1 : 0; };
      if (minimum && maximum && compare(minimum, maximum) > 0 || minimum && compare(value, minimum) < 0 || maximum && compare(value, maximum) > 0) throw new Error('The Vault contains numerical field data outside its declared bounds.');
    }
  }
  if (entity.aliases !== undefined && (!Array.isArray(entity.aliases) || entity.aliases.length > 200 || !entity.aliases.every(alias => isBoundedString(alias, 300)))) throw new Error('The Vault contains invalid item aliases.');
  if (entity.managed !== undefined && typeof entity.managed !== 'boolean' && (!isRecord(entity.managed) || !isBoundedString(entity.managed.sourceId, 200) || !isBoundedString(entity.managed.version, 80) || !isBoundedString(entity.managed.key, 200) || !(entity.managed.override === undefined || typeof entity.managed.override === 'boolean') || !(entity.managed.detached === undefined || typeof entity.managed.detached === 'boolean'))) throw new Error('The Vault contains invalid managed-source metadata.');
}

/** @param {unknown} value */
function validateQueryBindings(value) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 10_000 || !value.every(binding => isRecord(binding) && ['include','exclude','containers'].includes(binding.operator) && typeof binding.entityId === 'string' && GUID_PATTERN.test(binding.entityId) && isBoundedString(binding.displayName, 10_000) && binding.displayName.trim())) throw new Error('The Vault contains invalid saved-query bindings.');
}

/** @param {unknown} value */
function validateCollections(value) {
  if (!Array.isArray(value) || value.length > 10_000 || new Set(value.map(collection => isRecord(collection) ? collection.id : '')).size !== value.length || !value.every(collection => isRecord(collection) && typeof collection.id === 'string' && GUID_PATTERN.test(collection.id) && isBoundedString(collection.name, 200) && collection.name.trim() && isBoundedString(collection.query, 10_000) && isBoundedString(collection.description, 10_000))) throw new Error('The Vault contains a malformed collection.');
  for (const collection of value) validateQueryBindings(collection.queryBindings);
}

/** @param {unknown} value */
function validateItemSources(value) {
  const allowed = new Set(['create-item','create-container','create-character','custom-create','browse-query','dnd-tools','ddb-import']);
  if (!Array.isArray(value) || !value.every(source => isRecord(source) && isBoundedString(source.id, 200) && isBoundedString(source.name, 200) && source.name.trim() && isBoundedString(source.description, 10_000) && isBoundedString(source.query, 10_000) && allowed.has(source.behavior) && (source.managed === undefined || typeof source.managed === 'boolean') && (source.enabled === undefined || typeof source.enabled === 'boolean') && isPrivateImage(source.image ?? null) && (source.presetTagNames === undefined || Array.isArray(source.presetTagNames) && source.presetTagNames.length <= 100 && source.presetTagNames.every(name => isBoundedString(name, 200) && name.trim())))) throw new Error('The Vault contains a malformed item source.');
  for (const source of value) validateQueryBindings(source.queryBindings);
}

/** @param {unknown} value */
function validateGroups(value) {
  const roles = new Set(['Viewer', 'Editor', 'Manager', 'Owner']);
  if (!Array.isArray(value) || value.length > 10_000 || new Set(value.map(group => isRecord(group) ? group.id : '')).size !== value.length || !value.every(group => {
    if (!isRecord(group) || typeof group.id !== 'string' || !GUID_PATTERN.test(group.id) || !isBoundedString(group.name, 200) || !group.name.trim() || !isTimestamp(group.createdAt) || !Array.isArray(group.members) || !group.members.length || group.members.length > 10_000) return false;
    const memberIds = group.members.map(member => isRecord(member) ? member.vaultGuid || member.id : '');
    return new Set(memberIds).size === memberIds.length && group.members.every(member => isRecord(member) && typeof (member.vaultGuid || member.id) === 'string' && GUID_PATTERN.test(member.vaultGuid || member.id) && isBoundedString(member.name, 200) && member.name.trim() && typeof member.role === 'string' && roles.has(member.role)) && group.members.some(member => member.role === 'Owner');
  })) throw new Error('The Vault contains malformed Group data.');
}

/** @param {unknown} value */
function validateFriends(value) {
  if (!Array.isArray(value) || value.length > 10_000 || !value.every(friend => isRecord(friend) && typeof friend.vaultGuid === 'string' && GUID_PATTERN.test(friend.vaultGuid) && isBoundedString(friend.name, 200) && friend.name.trim()) || new Set(value.map(friend => friend.vaultGuid)).size !== value.length) throw new Error('The Vault contains malformed friend contacts.');
}

/** @param {string} path @param {unknown} value */
function validateHistoryValue(path, value) {
  if (value === undefined) return;
  if (path.startsWith('/entities/')) { validateEntity(value, path.slice('/entities/'.length)); return; }
  if (path === '/settings') { if (!isRecord(value)) throw new Error('The Vault history contains invalid legacy appearance data.'); return; }
  if (path === '/collections') { validateCollections(value); return; }
  if (path === '/itemSources') { validateItemSources(value); return; }
  if (path === '/groups') { validateGroups(value); return; }
  if (path === '/friends') { validateFriends(value); return; }
  if (path === '/vault/image') { if (!isPrivateImage(value)) throw new Error('The Vault history contains an unsafe image.'); return; }
  if ((path === '/vault/name' || path === '/vault/title') && (!isBoundedString(value, 200) || !String(value).trim())) throw new Error('The Vault history contains invalid profile text.');
}

/** @returns {Promise<IDBDatabase>} */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'vault.id' });
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
      if (!db.objectStoreNames.contains(SYNC_STORE)) db.createObjectStore(SYNC_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local storage.'));
  });
}

/** @param {IDBRequest} request @returns {Promise<any>} */
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local storage request failed.'));
  });
}

/** @returns {Promise<import('./core.js').AppState|null>} */
export async function loadActiveState() {
  const id = localStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  const db = await openDatabase();
  const transaction = db.transaction([STORE, SETTINGS_STORE], 'readonly');
  const state = await requestResult(transaction.objectStore(STORE).get(id));
  const deviceSettings = await requestResult(transaction.objectStore(SETTINGS_STORE).get(APPEARANCE_KEY));
  const panelState = await requestResult(transaction.objectStore(SETTINGS_STORE).get(PANEL_STATE_KEY));
  db.close();
  if (state && !state.vault.title) state.vault.title = `${state.vault.name}'s Vault`;
  if (state && !Array.isArray(state.itemSources)) state.itemSources = defaultItemSources();
  if (state && !Array.isArray(state.friends)) state.friends = [];
  const legacySettings = normalizeSettings(state?.settings);
  const validRecentTabs = candidate => Array.isArray(candidate) ? candidate.filter(tabId => typeof tabId === 'string' && state?.entities?.[tabId]?.container && !state.entities[tabId].deleted) : [];
  const legacyRecentTabs = validRecentTabs(state?.recentTabs);
  if (state) {
    state.settings = structuredClone(DEFAULT_SETTINGS);
    state.recentTabs = [];
    validateVaultState(state);
    state.recentTabs = isRecord(panelState) && Array.isArray(panelState.recentTabs) ? validRecentTabs(panelState.recentTabs) : legacyRecentTabs;
  }
  let effectiveSettings = legacySettings;
  if (deviceSettings) {
    effectiveSettings = normalizeSettings(deviceSettings);
    if (JSON.stringify(effectiveSettings) !== JSON.stringify(deviceSettings)) await saveDeviceSettings(effectiveSettings);
  }
  if (state) state.settings = effectiveSettings;
  if (state && !deviceSettings) await saveDeviceSettings(legacySettings);
  return state || null;
}

/** @param {import('./core.js').AppState} state */
export async function saveState(state) {
  const db = await openDatabase();
  const durable = vaultExportSnapshot(state);
  validateVaultState(durable);
  await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, SETTINGS_STORE], 'readwrite');
    transaction.objectStore(STORE).put(durable);
    transaction.objectStore(SETTINGS_STORE).put({ recentTabs: [...state.recentTabs] }, PANEL_STATE_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the Vault locally.'));
    transaction.onabort = () => reject(transaction.error || new Error('Saving the Vault was cancelled.'));
  });
  db.close();
  localStorage.setItem(ACTIVE_KEY, state.vault.id);
}

/** Device-local appearance is deliberately excluded from Vault/folder/cloud data. @param {import('./core.js').AppState['settings']} settings */
export async function saveDeviceSettings(settings) {
  validateSettings(settings);
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    transaction.objectStore(SETTINGS_STORE).put(structuredClone(settings), APPEARANCE_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save device appearance settings.'));
    transaction.onabort = () => reject(transaction.error || new Error('Saving device appearance settings was cancelled.'));
  });
  db.close();
}

/** @param {string} vaultId */
export async function loadCloudRuntime(vaultId) {
  const db = await openDatabase();
  const value = await requestResult(db.transaction(SYNC_STORE, 'readonly').objectStore(SYNC_STORE).get(vaultId));
  db.close();
  return value || null;
}

/** CryptoKey objects are structured-cloned by IndexedDB and never exported to JSON. @param {string} vaultId @param {unknown} runtime */
export async function saveCloudRuntime(vaultId, runtime) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_STORE, 'readwrite');
    transaction.objectStore(SYNC_STORE).put(runtime, vaultId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save encrypted cloud state.'));
    transaction.onabort = () => reject(transaction.error || new Error('Saving encrypted cloud state was cancelled.'));
  });
  db.close();
}

/** @param {import('./core.js').AppState} state @returns {import('./core.js').AppState} */
export function vaultExportSnapshot(state) {
  const durable = structuredClone(state);
  delete durable.vault.folderName;
  durable.settings = structuredClone(DEFAULT_SETTINGS);
  durable.recentTabs = [];
  durable.history.events = durable.history.events.map(event => ({ ...event, changes: event.changes.filter(change => change.path !== '/settings') }));
  return durable;
}

/** @param {unknown} value @returns {asserts value is import('./core.js').AppState} */
export function validateVaultState(value) {
  if (!isRecord(value)) throw new Error('The backup does not contain a Vault.');
  const state = /** @type {Record<string, any>} */(value);
  if (state.version !== 1) throw new Error('This Vault version is not supported by this build.');
  if (!(state.sourceDefaultsVersion === undefined || Number.isSafeInteger(state.sourceDefaultsVersion) && state.sourceDefaultsVersion >= 1)) throw new Error('The Vault item-source defaults version is invalid.');
  if (!isRecord(state.vault) || typeof state.vault.id !== 'string' || !GUID_PATTERN.test(state.vault.id) || !isBoundedString(state.vault.name, 200) || !state.vault.name.trim() || !(state.vault.title === undefined || isBoundedString(state.vault.title, 200)) || !isPrivateImage(state.vault.image ?? null) || !isTimestamp(state.vault.createdAt) || !(state.vault.folderName === undefined || isBoundedString(state.vault.folderName, 255))) throw new Error('The Vault identity metadata is invalid.');
  if (!state.vault.title) state.vault.title = `${state.vault.name}'s Vault`;
  if (state.settings && !state.settings.accent) state.settings.accent = 'custom';
  validateSettings(state.settings);
  if (!isRecord(state.entities)) throw new Error('The Vault entity store is invalid.');
  const entries = Object.entries(state.entities);
  if (entries.length > 250_000) throw new Error('The Vault contains more entities than this build can safely open.');
  if (!Array.isArray(state.itemSources)) state.itemSources = defaultItemSources();
  if (!Array.isArray(state.friends)) state.friends = [];
  validateCollections(state.collections);
  validateItemSources(state.itemSources);
  validateGroups(state.groups);
  validateFriends(state.friends);
  if (!isRecord(state.history) || !Array.isArray(state.history.events) || !Array.isArray(state.history.undoStack) || !Array.isArray(state.history.redoStack) || !Array.isArray(state.history.branches) || !Array.isArray(state.recentTabs) || !isRecord(state.cloud) || typeof state.cloud.enabled !== 'boolean' || !isBoundedString(state.cloud.status, 200)) throw new Error('The Vault is incomplete or malformed.');
  for (const [id, entity] of entries) validateEntity(entity, id);
  for (const [, entityValue] of entries) {
    const entity = /** @type {Record<string, any>} */(entityValue);
    if (entity.parentId !== null && (!state.entities[entity.parentId] || !state.entities[entity.parentId].container)) throw new Error('The Vault contains an invalid parent relationship.');
    for (const tagId of entity.tags) if (tagId !== 'Tag' && (!state.entities[tagId] || !state.entities[tagId].tags.includes('Tag'))) throw new Error('The Vault contains an invalid Tag reference.');
  }
  for (const subject of [...state.collections, ...state.itemSources]) for (const binding of subject.queryBindings || []) {
    const entity = state.entities[binding.entityId];
    if (!entity) throw new Error('The Vault contains a saved query bound to a missing entity.');
    const typeMatches = binding.operator === 'containers' ? entity.container : entity.tags.includes('Tag');
    if (!typeMatches) throw new Error('The Vault contains a saved query bound to the wrong entity type.');
  }
  const resolved = new Set();
  for (const [id] of entries) {
    if (resolved.has(id)) continue;
    const path = new Set();
    let cursor = id;
    while (cursor && !resolved.has(cursor)) {
      if (path.has(cursor)) throw new Error('The Vault contains a recursive container relationship.');
      path.add(cursor);
      cursor = state.entities[cursor]?.parentId || '';
    }
    for (const visitedId of path) resolved.add(visitedId);
  }
  if (!state.recentTabs.every(id => typeof id === 'string' && state.entities[id]?.container && !state.entities[id]?.deleted)) throw new Error('The Vault recent panel state is invalid.');

  const eventsById = new Map();
  for (const event of state.history.events) {
    if (!isRecord(event) || typeof event.id !== 'string' || !GUID_PATTERN.test(event.id) || eventsById.has(event.id) || !isBoundedString(event.label, 2_000) || !isTimestamp(event.at) || !['action','undo','redo'].includes(event.kind) || !Array.isArray(event.changes) || event.changes.length > 250_000 || !(event.relatedTo === undefined || typeof event.relatedTo === 'string' && GUID_PATTERN.test(event.relatedTo))) throw new Error('The Vault history contains a malformed event.');
    for (const change of event.changes) {
      if (!isRecord(change) || !isSafeMutationPath(change.path)) throw new Error('The Vault history targets an unsupported state path.');
      validateHistoryValue(change.path, change.before);
      validateHistoryValue(change.path, change.after);
    }
    eventsById.set(event.id, event);
  }
  const validActionId = id => typeof id === 'string' && eventsById.get(id)?.kind === 'action';
  if (!state.history.undoStack.every(validActionId) || !state.history.redoStack.every(validActionId)) throw new Error('The Vault history stacks are invalid.');
  const activeStackIds = [...state.history.undoStack, ...state.history.redoStack];
  if (new Set(activeStackIds).size !== activeStackIds.length) throw new Error('The Vault history stacks contain duplicate actions.');
  for (const event of state.history.events) if (event.relatedTo && !eventsById.has(event.relatedTo)) throw new Error('The Vault history contains a missing related event.');
  if (!state.history.branches.every(branch => isRecord(branch) && typeof branch.id === 'string' && GUID_PATTERN.test(branch.id) && isTimestamp(branch.createdAt) && Array.isArray(branch.eventIds) && new Set(branch.eventIds).size === branch.eventIds.length && branch.eventIds.every(validActionId))) throw new Error('The Vault retained history branches are invalid.');
}

function defaultItemSources() {
  return createDefaultItemSources();
}

/** @param {import('./core.js').AppState} browserState @param {import('./core.js').AppState} folderState @returns {'browser'|'folder'|'diverged'} */
export function compareVaultHistory(browserState, folderState) {
  const browserEvents = browserState.history.events;
  const folderEvents = folderState.history.events;
  const isPrefix = (shorter, longer) => shorter.length <= longer.length && shorter.every((event, index) => JSON.stringify(event) === JSON.stringify(longer[index]));
  if (!isPrefix(browserEvents, folderEvents) && !isPrefix(folderEvents, browserEvents)) return 'diverged';
  return isPrefix(folderEvents, browserEvents) ? 'browser' : 'folder';
}

/** @param {string} text */
async function hashText(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** @param {FileSystemDirectoryHandle} directory @param {string} name */
async function readText(directory, name) {
  const handle = await directory.getFileHandle(name);
  return (await handle.getFile()).text();
}

/** @param {FileSystemDirectoryHandle} directory @param {string} name @param {string} text */
async function writeText(directory, name, text) {
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try { await writable.write(text); await writable.close(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
}

/** @param {FileSystemDirectoryHandle} directory @param {import('./core.js').AppState} state */
async function writeFolderSnapshot(directory, state) {
  const snapshot = JSON.stringify(vaultExportSnapshot(state), null, 2);
  const snapshotHash = await hashText(snapshot);
  let previous = '';
  try { previous = await readText(directory, SNAPSHOT_FILE); } catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
  if (previous) await writeText(directory, LAST_GOOD_FILE, previous);
  await writeText(directory, NEXT_FILE, snapshot);
  if (await hashText(await readText(directory, NEXT_FILE)) !== snapshotHash) throw new Error('The staged folder snapshot could not be verified.');
  await writeText(directory, SNAPSHOT_FILE, snapshot);
  if (await hashText(await readText(directory, SNAPSHOT_FILE)) !== snapshotHash) throw new Error('The folder snapshot could not be verified after writing.');
  await writeText(directory, META_FILE, JSON.stringify({ format: 'sonatory-vault', version: 1, vaultGuid: state.vault.id, snapshotFile: SNAPSHOT_FILE, snapshotHash, writtenAt: new Date().toISOString() }, null, 2));
}

/** @param {string} vaultId @param {FileSystemDirectoryHandle} directory */
async function rememberFolder(vaultId, directory) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(HANDLE_STORE, 'readwrite');
    transaction.objectStore(HANDLE_STORE).put(directory, vaultId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('The folder connection could not be remembered.'));
    transaction.onabort = () => reject(transaction.error || new Error('Remembering the folder connection was cancelled.'));
  });
  db.close();
  handleCache.set(vaultId, directory);
}

/** @param {string} vaultId */
async function storedFolder(vaultId) {
  if (handleCache.has(vaultId)) return handleCache.get(vaultId) || null;
  const db = await openDatabase();
  const handle = await requestResult(db.transaction(HANDLE_STORE, 'readonly').objectStore(HANDLE_STORE).get(vaultId));
  db.close();
  if (handle) handleCache.set(vaultId, handle);
  return /** @type {FileSystemDirectoryHandle|null} */(handle || null);
}

/**
 * Opens an existing Sonatory folder or initializes an empty folder with the candidate Vault.
 * @param {import('./core.js').AppState|null} candidate
 * @returns {Promise<{state:import('./core.js').AppState,existing:boolean,folderName:string,source:'created'|'browser'|'folder'}>}
 */
export async function chooseVaultFolder(candidate) {
  if (typeof globalThis.showDirectoryPicker !== 'function') throw new Error('Vault folders are not supported by this browser. Use Export Vault instead.');
  const directory = await globalThis.showDirectoryPicker({ id: 'sonatory-vault', mode: 'readwrite', startIn: 'documents' });
  /** @type {string[]} */ const names = [];
  for await (const [name] of directory.entries()) names.push(name);
  let metadata = null;
  try { metadata = JSON.parse(await readText(directory, META_FILE)); }
  catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw new Error('The Vault folder metadata is not valid JSON.');
  }
  if (!metadata) {
    if (names.length) throw new Error('Choose an empty folder or a folder containing valid Sonatory Vault metadata. Nothing was changed.');
    if (!candidate) throw new Error('An empty folder cannot be opened without a Vault to initialize it.');
    const next = structuredClone(candidate);
    next.vault.folderName = directory.name;
    await writeFolderSnapshot(directory, next);
    await rememberFolder(next.vault.id, directory);
    return { state: next, existing: false, folderName: directory.name, source: 'created' };
  }
  if (metadata.format !== 'sonatory-vault' || metadata.version !== 1 || typeof metadata.vaultGuid !== 'string' || metadata.snapshotFile !== SNAPSHOT_FILE || !/^[a-f0-9]{64}$/.test(metadata.snapshotHash)) throw new Error('This folder does not contain supported Sonatory Vault metadata. Nothing was changed.');
  const snapshotText = await readText(directory, SNAPSHOT_FILE).catch(() => { throw new Error('The Vault folder snapshot is missing. Nothing was changed.'); });
  if (await hashText(snapshotText) !== metadata.snapshotHash) throw new Error('The Vault folder snapshot does not match its integrity metadata. Open the last-good copy or another backup.');
  const folderState = JSON.parse(snapshotText);
  validateVaultState(folderState);
  if (folderState.vault.id !== metadata.vaultGuid) throw new Error('The snapshot identity does not match the folder metadata. Nothing was changed.');
  let next = folderState;
  let source = /** @type {'browser'|'folder'} */('folder');
  if (candidate && candidate.vault.id === folderState.vault.id) {
    const historyChoice = compareVaultHistory(candidate, folderState);
    if (historyChoice === 'diverged') throw new Error('This browser and folder contain divergent Vault histories. Neither copy was overwritten; export both before choosing a recovery branch.');
    if (historyChoice === 'browser') { next = structuredClone(candidate); source = 'browser'; }
  }
  next.vault.folderName = directory.name;
  if (source === 'browser') await writeFolderSnapshot(directory, next);
  await rememberFolder(next.vault.id, directory);
  return { state: next, existing: true, folderName: directory.name, source };
}

/** @param {import('./core.js').AppState} state @returns {Promise<'none'|'saved'|'permission-needed'>} */
export async function mirrorStateToFolder(state) {
  const directory = await storedFolder(state.vault.id);
  if (!directory) return 'none';
  const permission = await directory.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') return 'permission-needed';
  await writeFolderSnapshot(directory, state);
  return 'saved';
}

/** @returns {Promise<Array<{id:string,name:string,createdAt:string}>>} */
export async function listVaults() {
  const db = await openDatabase();
  const states = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  db.close();
  return states.map(state => ({ id: state.vault.id, name: state.vault.title || state.vault.name, createdAt: state.vault.createdAt }));
}

/** @param {string} id */
export function setActiveVault(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function clearActiveVault() {
  localStorage.removeItem(ACTIVE_KEY);
}

/**
 * Permanently removes one Vault from this browser and, when connected, its
 * known Sonatory files from the Vault folder. Folder access is resolved before
 * local deletion so the UI never reports a partial purge as complete.
 * @param {import('./core.js').AppState} state
 */
export async function purgeVault(state) {
  validateVaultState(state);
  const vaultId = state.vault.id;
  const directory = await storedFolder(vaultId);
  if (directory) {
    let permission = await directory.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') permission = await directory.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Folder access is required to remove this Vault’s mirrored files. Nothing was deleted.');
    for (const name of [META_FILE, SNAPSHOT_FILE, NEXT_FILE, LAST_GOOD_FILE]) {
      try { await directory.removeEntry(name); }
      catch (error) { if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error; }
    }
  }
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, HANDLE_STORE, SETTINGS_STORE, SYNC_STORE], 'readwrite');
    transaction.objectStore(STORE).delete(vaultId);
    transaction.objectStore(HANDLE_STORE).delete(vaultId);
    transaction.objectStore(SETTINGS_STORE).delete(PANEL_STATE_KEY);
    transaction.objectStore(SYNC_STORE).delete(vaultId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not purge the Vault.'));
    transaction.onabort = () => reject(transaction.error || new Error('Purging the Vault was cancelled.'));
  });
  db.close();
  handleCache.delete(vaultId);
  if (localStorage.getItem(ACTIVE_KEY) === vaultId) localStorage.removeItem(ACTIVE_KEY);
}
