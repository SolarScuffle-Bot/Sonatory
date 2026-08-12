// @ts-check
import { canMove, commit, compareDecimal, computeAllWeights, computeWeight, createState, decimalToString, formatExactDecimal, guid, isEntityVisible, linkedContainerIds, managedBaseEntity, MANAGED_ITEM_COUNT, MANAGED_SOURCE_VERSION, parseDecimal, parseQuery, prepareContainerLink, prepareContainerUnlink, prepareInventoryMove, prepareRestack, prepareStackSplit, redo, resolveQueryBindings, restackCandidates, SEARCH_OPERATORS, searchEntities, syncManagedItems, syncProductDefaults, syncQueryBindings, undo } from './core.js';
import { createContactCode, parseContactCode } from './contacts.js';
import { AutomaticCloudReplica, relayBaseForLocation } from './cloud.js';
import { chooseVaultFolder, clearActiveVault, listVaults, loadActiveState, mirrorStateToFolder, purgeVault, saveDeviceSettings, saveState, setActiveVault, validateVaultState, vaultExportSnapshot } from './storage.js';

const app = /** @type {HTMLElement} */ (document.querySelector('#app'));
const live = /** @type {HTMLElement} */ (document.querySelector('#live'));
/** @type {import('./core.js').AppState|null} */
let state = null;
let view = 'home';
let activePanel = '';
let utility = '';
let utilityContext = {};
/** @type {Array<{name:string,context:Record<string,unknown>}>} */
let utilityStack = [];
const POPUP_ROOTS = new Set(['search','groups','activity','settings','profile','menu']);
let collectionsLayout = 'carousel';
/** @type {Map<string,'grid'|'list'>} */
const inventoryLayouts = new Map();
/** @type {WeakMap<Element,number>} */
const carouselWheelGrace = new WeakMap();
/** @type {{pointerId:number,entityId:string,source:HTMLElement,handle:HTMLElement,ghost:HTMLElement,target:HTMLElement|null,parentId:string,targetId:string,position:'before'|'after'|'append'}|null} */
let pointerDrag = null;
/** @type {{pointerId:number,entityId:string,source:HTMLElement,startX:number,startY:number}|null} */
let pointerCandidate = null;
let suppressClickUntil = 0;
let searchValue = '';
/** @type {import('./core.js').QueryBinding[]} */
let searchBindings = [];
let pendingImage = null;
let pendingRestore = null;
let pendingFolderSwitch = null;
let pendingImport = null;
let importWorker = null;
let saveInFlight = Promise.resolve();
let persistenceDepth = 0;
let storageWarning = '';
let cloudStatus = 'Automatic';
/** @type {AutomaticCloudReplica|null} */
let cloudReplica = null;
let cloudQueue = Promise.resolve();
/** @type {ServiceWorker|null} */
let pendingAppUpdate = null;
let updateRequested = false;
let reloadForUpdate = false;
let updateDismissed = false;
let uiActionsPending = 0;
let uiActionQueue = Promise.resolve();
/** @type {{id:string,action:string,dataId:string,ariaLabel:string}|null} */
let utilityReturnFocus = null;
let utilityReturnView = 'home';
let utilityReturnPanel = '';
/** @type {import('./core.js').Entity[]} */
let visibleEntityCache = [];
/** @type {Map<string,import('./core.js').Entity[]>} */
let childrenCache = new Map();
/** @type {Map<string,import('./core.js').Decimal>} */
let weightCache = new Map();

const icons = {
  home: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 11.2 12 4l9 7.2v8.3a.5.5 0 0 1-.5.5h-5v-6h-7v6h-5a.5.5 0 0 1-.5-.5z"/></svg>',
  undo: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 7H4v-5M4 7c2-3 5-4 8-4a8 8 0 1 1-7.2 11.5"/></svg>',
  redo: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 7h5v-5m0 5c-2-3-5-4-8-4a8 8 0 1 0 7.2 11.5"/></svg>',
  search: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>',
  users: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 2-5 6-5s6 2 6 5v2M16 5c2 0 3 1 3 3s-1 3-3 3m1 2c3 0 4 2 4 5v2"/></svg>',
  settings: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.6-1.4.9-2-2.1-2.1-2 .9-1.4-.6-.7-2h-3l-.7 2-1.4.6-2-.9-2.1 2.1.9 2-.6 1.4-2 .7v3l2 .7.6 1.4-.9 2 2.1 2.1 2-.9 1.4.6.7 2h3l.7-2 1.4-.6 2 .9 2.1-2.1-.9-2 .6-1.4z"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>',
  close: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 5 14 14M19 5 5 19"/></svg>',
  left: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  right: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  up: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 15 7-7 7 7"/></svg>',
  down: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 9 7 7 7-7"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
  more: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  edit: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16-.8 4.8L8 20 20 8l-4-4zM14.5 5.5l4 4"/></svg>',
  bag: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l1 13H4zM8 8V6a4 4 0 0 1 8 0v2"/></svg>',
  folder: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v11H3z"/></svg>',
  tools: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 6.5 3-3a4.2 4.2 0 0 1-5.4 5.4L5.5 15.5a2.1 2.1 0 1 0 3 3l6.6-6.6a4.2 4.2 0 0 1 5.4-5.4l-3 3"/><path d="m4 4 5 5M3 3l3.5 1L5 6.5Z"/></svg>',
  activity: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h4l2-7 4 14 2-7h4"/></svg>',
  tag: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5v6l9 9 7-7-9-9H5a1 1 0 0 0-1 1Z"/><circle cx="8" cy="8" r="1"/></svg>',
  grid: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>',
  carousel: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 8.5h3v7h-3zm6-2h7v11h-7zm10 2h3v7h-3z"/></svg>',
  list: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/></svg>',
  camera: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3"/></svg>',
  image: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 3 3 3-4 5 6"/></svg>',
  link: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 15 6-6m-8 9H5a4 4 0 0 1 0-8h3m8 0h3a4 4 0 0 1 0 8h-3"/></svg>',
  mass: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 9h10l3 11H4L7 9Z"/><path d="M9 9a3 3 0 1 1 6 0"/></svg>',
  split: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4v5m0 0-6 5m6-5 6 5M6 14v6m12-6v6"/></svg>',
  stack: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 8 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4"/></svg>',
  grip: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="8" cy="6" r="1.25"/><circle cx="16" cy="6" r="1.25"/><circle cx="8" cy="12" r="1.25"/><circle cx="16" cy="12" r="1.25"/><circle cx="8" cy="18" r="1.25"/><circle cx="16" cy="18" r="1.25"/></svg>',
  cloud: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 18H5a4 4 0 0 1-.5-8A7 7 0 0 1 18 8a5 5 0 0 1 1 10h-2M12 11v9m-4-5 4-4 4 4"/></svg>'
};
const ACCENT_PRESETS = ['custom','red','orange','yellow','green','cyan','blue','purple','magenta','white','light-gray','dark-gray','black'];
const ACCENT_HUES = { red: 0, orange: 30, yellow: 55, green: 125, cyan: 185, blue: 220, purple: 275, magenta: 315 };

function icon(name) { return `<span class="icon">${icons[name] || ''}</span>`; }
function escape(value) { return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || 'S'; }
function formatNumber(value) { return formatExactDecimal(value); }
function announce(message) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = message; }); }
function imageMarkup(entity, className = 'media') { return entity.image ? `<img class="${className}" src="${escape(entity.image)}" alt="">` : ''; }
function entityType(entity) { if (entity.tags.includes('Tag')) return 'Tag'; if (entity.container) return 'Container'; return 'Item'; }
function tagName(id) { return state?.entities[id]?.name || ''; }
function normalizedItemName(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}+]+/gu, ' ').trim().replace(/\s+/g, ' '); }
function activeEntities() { return visibleEntityCache; }
function childrenOf(id) { return childrenCache.get(id) || []; }
function isPartyContainer(entity) { return entity.container && entity.tags.some(tagId => tagName(tagId) === 'Party'); }
function containerConnections(entity) {
  const connections = new Map();
  if (entity.parentId && state?.entities[entity.parentId]?.container && isEntityVisible(state, entity.parentId)) connections.set(entity.parentId, { entity: state.entities[entity.parentId], kind: 'inside', explicit: false });
  for (const child of childrenOf(entity.id).filter(candidate => candidate.container)) connections.set(child.id, { entity: child, kind: 'contains', explicit: false });
  for (const id of linkedContainerIds(state, entity.id)) if (!connections.has(id)) connections.set(id, { entity: state.entities[id], kind: 'linked', explicit: true });
  return [...connections.values()].sort((a, b) => a.entity.name.localeCompare(b.entity.name) || a.entity.id.localeCompare(b.entity.id));
}
function displayNumericField(entity, name, value) {
  const precision = entity.fieldMeta?.[name]?.precision;
  if (precision === undefined) return value;
  const [whole, fraction = ''] = String(value).split('.');
  return precision ? `${whole}.${fraction.padEnd(precision, '0')}` : whole;
}
function safeWeight(id) { try { return decimalToString(weightCache.get(id) || computeWeight(state, id)); } catch { return '—'; } }

function rebuildRenderIndexes() {
  if (!state) return;
  visibleEntityCache = Object.values(state.entities).filter(entity => isEntityVisible(state, entity));
  childrenCache = new Map();
  for (const entity of visibleEntityCache) if (entity.parentId) childrenCache.set(entity.parentId, [...(childrenCache.get(entity.parentId) || []), entity]);
  for (const children of childrenCache.values()) children.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  weightCache = computeAllWeights(state);
}

function applyPreferences() {
  if (!state) return;
  document.documentElement.dataset.density = state.settings.density;
  document.documentElement.dataset.mode = state.settings.mode;
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.motion = state.settings.motion;
  document.documentElement.dataset.accent = state.settings.accent || 'custom';
  document.documentElement.style.setProperty('--hue', String(ACCENT_HUES[state.settings.accent] ?? state.settings.hue));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.settings.mode === 'light' ? '#f3f0e7' : '#11150f');
}

async function persist(message = '') {
  if (!state) return;
  const snapshot = structuredClone(state);
  saveInFlight = saveInFlight.catch(() => {}).then(async () => {
    await saveState(snapshot);
    try {
      const folderResult = await mirrorStateToFolder(snapshot);
      storageWarning = '';
      if (folderResult === 'permission-needed') console.info('The optional Vault folder is disconnected; the browser copy remains current.');
    } catch (error) {
      storageWarning = '';
      console.warn('Optional Vault folder update failed; the browser copy remains current.', error);
    }
  });
  persistenceDepth += 1;
  try {
    await saveInFlight;
    queueAutomaticCloudSync();
    if (message) announce(message);
  } catch (error) {
    showNotice(`Not saved locally: ${error instanceof Error ? error.message : 'Local storage failed.'}`, true);
  } finally { persistenceDepth -= 1; maybeActivateUpdate(); }
}

function activeCloudReplica() {
  if (!state) return null;
  if (!cloudReplica || cloudReplica.state.vault.id !== state.vault.id) cloudReplica = new AutomaticCloudReplica(state, relayBaseForLocation(location));
  else cloudReplica.state = state;
  return cloudReplica;
}

function refreshCloudIndicator() {
  const button = document.querySelector('.profile-button');
  if (!(button instanceof HTMLButtonElement)) return;
  const label = `Profile & Vault · ${backingStatus()}`;
  button.dataset.cloudStatus = cloudStatus.toLowerCase();
  button.setAttribute('aria-label', label);
  button.title = label;
}

function queueAutomaticCloudSync() {
  if (!state) return;
  const vaultId = state.vault.id;
  cloudStatus = 'Syncing';
  refreshCloudIndicator();
  cloudQueue = cloudQueue.catch(() => {}).then(async () => {
    const replica = activeCloudReplica();
    if (!replica || !state || state.vault.id !== vaultId) return;
    const changed = await replica.sync();
    if (!state || state.vault.id !== vaultId) return;
    cloudStatus = 'Saved';
    refreshCloudIndicator();
    if (changed) { await saveState(state); renderShell(); announce('Encrypted changes from another device were applied.'); }
  }).catch((error) => {
    if (state?.vault.id !== vaultId) return;
    console.error('Automatic encrypted storage failed.', error);
    cloudStatus = 'Offline';
    refreshCloudIndicator();
  });
}

function showNotice(message, important = false) {
  const notice = document.querySelector('#notice');
  if (!(notice instanceof HTMLElement)) return;
  notice.hidden = false;
  notice.innerHTML = `<strong>${important ? 'Action needed' : 'Saved locally'}</strong><span>${escape(message)}</span><button class="ghost" data-action="dismiss-notice">Dismiss</button>`;
}

function queueUiAction(action) {
  uiActionsPending += 1;
  uiActionQueue = uiActionQueue.then(action).catch(error => {
    showNotice(error instanceof Error ? error.message : 'The action could not be completed.', true);
  }).finally(() => { uiActionsPending -= 1; maybeActivateUpdate(); });
  return uiActionQueue;
}

function updateIsSafe() {
  return persistenceDepth === 0 && uiActionsPending === 0 && !pendingImport && !['editor','source-editor','group-editor','settings','profile','ddb-import'].includes(utility);
}

function refreshUpdateNotice() {
  const notice = document.querySelector('#update-notice');
  if (!(notice instanceof HTMLElement)) return;
  notice.hidden = !pendingAppUpdate || updateDismissed;
  if (!pendingAppUpdate) { notice.innerHTML = ''; return; }
  const safe = updateIsSafe();
  notice.innerHTML = `<strong>Update ready</strong><span>${safe ? 'The new app shell is downloaded. Your Vault data is already safe.' : 'Finish or close the current editor before updating.'}</span><button class="primary" data-action="activate-update">${safe ? 'Update now' : 'Update when safe'}</button><button class="ghost" data-action="dismiss-update">Later</button>`;
}

function maybeActivateUpdate() {
  refreshUpdateNotice();
  if (!updateRequested || !pendingAppUpdate || !updateIsSafe()) return;
  reloadForUpdate = true;
  updateRequested = false;
  pendingAppUpdate.postMessage({ type: 'ACTIVATE_UPDATE' });
}

function offerAppUpdate(worker) {
  pendingAppUpdate = worker;
  updateDismissed = false;
  refreshUpdateNotice();
  announce('An application update is ready. It will not interrupt unsaved work.');
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.register('/sw.js');
  if (registration.waiting && navigator.serviceWorker.controller) offerAppUpdate(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerAppUpdate(worker);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadForUpdate) location.reload();
  });
}

function avatarMarkup() {
  if (!state) return '';
  return state.vault.image ? `<img src="${escape(state.vault.image)}" alt="">` : escape(initials(state.vault.name));
}

function imagePicker(name, subject, label = 'Change Image') {
  const preview = pendingImage || subject?.image || '';
  return `<label class="image-picker" title="${escape(label)}"><span class="image-preview">${preview ? `<img src="${escape(preview)}" alt="">` : `<span class="image-placeholder">${icon('camera')}<small>Add Image</small></span>`}<span class="image-picker-action">${icon('camera')}<span>${preview ? 'Change' : 'Choose'}</span></span></span><input class="visually-hidden" name="${escape(name)}" type="file" accept="image/*"><span class="visually-hidden">${escape(label)}</span></label>`;
}

function filePicker(action, accept, label, fileName = '') {
  return `<label class="file-picker"><input type="file" accept="${escape(accept)}" data-action="${escape(action)}"><span class="file-picker-button">${icon('folder')}${escape(label)}</span><span class="file-picker-name">${escape(fileName || 'No file selected')}</span></label>`;
}

function sourceIcon(source) {
  const names = { Unique: 'tag', Custom: 'tools', Created: 'activity', Item: 'tools', 'D&D': 'mass' };
  return source.image ? `<img class="source-mark" src="${escape(source.image)}" alt="">` : `<span class="source-mark source-icon">${icon(names[source.name] || 'tools')}</span>`;
}

function collectionCreationDefaults(collectionId) {
  const collection = state?.collections.find(item => item.id === collectionId);
  if (!state || !collection) return { presetTagIds: [], parentId: '' };
  const parsed = parseQuery(collection.query);
  const bindings = [...(collection.queryBindings || []), ...resolveQueryBindings(state, collection.query)];
  const boundId = (operator, name) => bindings.find(binding => binding.operator === operator && binding.displayName.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)?.entityId || '';
  const presetTagIds = parsed.include.map(name => boundId('include', name) || activeEntities().find(entity => entity.tags.includes('Tag') && entity.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)?.id || '').filter(Boolean);
  const parentId = parsed.containers.map(name => boundId('containers', name) || activeEntities().find(entity => entity.container && entity.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)?.id || '').find(Boolean) || '';
  return { presetTagIds: [...new Set(presetTagIds)], parentId };
}

function openCollectionCreation(collectionId) {
  const collection = state?.collections.find(item => item.id === collectionId);
  if (!collection) return;
  const defaults = collectionCreationDefaults(collectionId);
  const context = { collectionId, parentId: defaults.parentId, presetTagIds: defaults.presetTagIds };
  const action = collection.createAction || 'custom';
  if (action === 'character') openUtility('character-setup', context);
  else if (action === 'container') openUtility('editor', { ...context, kind: 'container' });
  else if (action === 'item') openUtility('editor', { ...context, kind: 'item' });
  else if (action === 'tag') openUtility('editor', { ...context, kind: 'tag' });
  else if (action === 'sources') openUtility('sources', context);
  else openUtility('custom-create', context);
}

function collectionCreateActionOptions(selected = 'custom') {
  const options = [
    ['custom', 'Choose Type'],
    ['item', 'Item Editor'],
    ['container', 'Container Editor'],
    ['character', 'Character Setup'],
    ['tag', 'Tag Editor'],
    ['sources', 'Add To Inventory']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function popupLayerOpen() {
  const root = utilityStack[0]?.name || utility;
  return POPUP_ROOTS.has(root);
}

function backingStatus() {
  if (!state) return '';
  return state.vault.folderName ? `${cloudStatus} + ${state.vault.folderName}` : cloudStatus;
}

/** @param {File} file */
async function normalizeImage(file) {
  if (file.size > 12_000_000) throw new Error('Choose an image smaller than 12 MB.');
  if (!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or AVIF image.');
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('That image could not be decoded safely. Try another file.'); }
  try {
    const size = Math.min(bitmap.width, bitmap.height);
    if (!size) throw new Error('That image has no visible pixels.');
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.clearRect(0, 0, 512, 512);
    context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
    if (!blob) throw new Error('The image could not be normalized.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(new Error('The normalized image could not be read.'));
      reader.readAsDataURL(blob);
    });
  } finally { bitmap.close(); }
}

function downloadVault() {
  if (!state) return;
  const blob = new Blob([JSON.stringify(vaultExportSnapshot(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.vault.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'sonatory-vault'}.sonatory.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  announce('Vault export downloaded. Keep it somewhere safe.');
}

async function copyText(value, message) {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
  else {
    const input = document.createElement('textarea'); input.value = value; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
    if (!document.execCommand('copy')) { input.remove(); throw new Error('Copy is unavailable. Select the code manually.'); }
    input.remove();
  }
  announce(message);
}

async function applyFolderSelection(result, deviceSettings) {
  state = result.state;
  cloudReplica = null; cloudStatus = 'Automatic';
  state.settings = deviceSettings;
  await saveState(state);
  storageWarning = '';
  pendingFolderSwitch = null;
  utility = 'profile'; utilityContext = {}; view = 'panels'; activePanel = state.recentTabs.at(-1) || '';
  renderShell();
  announce(!result.existing ? `Vault folder ${result.folderName} created and verified.` : result.source === 'folder' ? `Newer Vault history opened from ${result.folderName}.` : `Vault folder ${result.folderName} verified and brought up to date.`);
}

async function renderOnboarding() {
  pendingImage = null;
  const vaults = await listVaults().catch(() => []);
  const folderSupported = typeof globalThis.showDirectoryPicker === 'function';
  app.innerHTML = `
    <main class="onboarding" id="main">
      <section class="onboarding-form-wrap">
        <form class="onboarding-form" data-form="onboarding" aria-labelledby="welcome-title">
          <span class="eyebrow">Create a Vault</span>
          <h1 id="welcome-title">One setup, then you’re in.</h1>
          <p class="muted">A Vault is both your workspace and your identity. The defaults below are ready to use.</p>
          ${vaults.length ? `<section class="recent-vaults" aria-labelledby="recent-vaults-title"><div class="recent-vaults-copy"><strong id="recent-vaults-title">Recent Vaults</strong><p>Choose one to continue as that identity.</p></div><div class="recent-vault-list">${vaults.map(vault => `<button type="button" data-action="open-vault" data-id="${vault.id}">${escape(vault.name)}</button>`).join('')}</div></section>` : ''}
          <div class="form-grid">
            <div class="onboarding-identity-row full">${imagePicker('image', null, 'Add Profile Image')}<label>Display Name<input name="displayName" autocomplete="name" maxlength="80" required placeholder="Yohan the Great"></label><label>Vault Name<input name="vaultName" maxlength="80" placeholder="My Adventures"></label></div>
          </div>
          <label class="folder-backup-choice"><input type="checkbox" name="folderBackup" value="folder" ${folderSupported ? '' : 'disabled'}><span>${icon('folder')}<span><strong>Add A Vault Folder Backup</strong><small>${folderSupported ? 'Optional. Keep a portable copy in a folder you choose.' : 'Folder access is unavailable here; you can export a backup after creating the Vault.'}</small></span></span></label>
          <fieldset class="settings-group">
            <legend>Accessibility Density</legend>
            <div class="segmented" role="group" aria-label="Accessibility density">
              <label class="choice"><input type="radio" name="density" value="compact"><strong>Compact</strong></label>
              <label class="choice"><input type="radio" name="density" value="normal" checked><strong>Normal</strong></label>
              <label class="choice"><input type="radio" name="density" value="spacious"><strong>Spacious</strong></label>
            </div>
          </fieldset>
          <div class="form-actions"><button class="primary" type="submit">Create Vault</button></div>
        </form>
      </section>
    </main>`;
  app.setAttribute('aria-busy', 'false');
}

function renderShell() {
  if (!state) return;
  rebuildRenderIndexes();
  applyPreferences();
  const tabs = state.recentTabs.map(id => state.entities[id]).filter(Boolean).filter(entity => !entity.deleted);
  app.innerHTML = `
    <header class="app-header">
      <a class="brand" href="#home" data-action="home"><span class="brand-mark">S</span><span>Sonatory</span></a>
      <button class="ghost" data-action="undo" ${state.history.undoStack.length ? '' : 'disabled'} title="Undo">${icon('undo')}<span class="header-label">Undo</span></button>
      <button class="ghost" data-action="redo" ${state.history.redoStack.length ? '' : 'disabled'} title="Redo">${icon('redo')}<span class="header-label">Redo</span></button>
      <span class="header-create-group" role="group" aria-label="Items and Tags"><button class="primary" data-action="create-root" aria-label="Add item">${icon('tools')}<span class="header-label">Item</span></button><button data-action="tags" title="Tags">${icon('tag')}<span class="header-label">Tags</span></button></span>
      <span class="header-spacer"></span>
      <button class="ghost" data-action="search" title="Search">${icon('search')}<span class="header-label">Search</span></button>
      <button class="ghost header-optional" data-action="groups" title="Groups & Friends">${icon('users')}<span class="header-label">Groups</span></button>
      <button class="ghost header-optional" data-action="activity" title="Activity">${icon('activity')}<span class="header-label">Activity</span></button>
      <button class="ghost header-optional" data-action="settings" title="Settings">${icon('settings')}<span class="header-label">Settings</span></button>
      <button class="avatar profile-button header-optional" data-cloud-status="${cloudStatus.toLowerCase()}" data-action="profile" aria-label="Profile & Vault · ${escape(backingStatus())}" title="${escape(backingStatus())}">${avatarMarkup()}<span class="status-dot" aria-hidden="true"></span></button>
      <button class="icon-button mobile-more" data-action="mobile-menu" aria-label="More navigation">${icon('more')}</button>
    </header>
    <nav class="recent-tabs" aria-label="Recent containers">
      <button class="recent-tab ${view === 'home' ? 'active' : ''}" data-action="home">Collections</button>
      ${tabs.map(entity => { const active = view === 'panels' && activePanel === entity.id; return `<span class="recent-tab-group ${active ? 'active' : ''}"><button class="recent-tab" data-action="select-tab" data-id="${entity.id}" aria-pressed="${active}">${escape(entity.name)}</button><button class="tab-close" data-action="close-tab" data-id="${entity.id}" aria-label="Close ${escape(entity.name)}">×</button></span>`; }).join('')}
    </nav>
    <div id="notice" class="notice" ${storageWarning ? '' : 'hidden'}>${storageWarning ? `<strong>Action needed</strong><span>${escape(storageWarning)}</span><button class="ghost" data-action="dismiss-notice">Dismiss</button>` : ''}</div>
    <div id="update-notice" class="notice" hidden></div>
    <main id="main" class="${popupLayerOpen() ? 'background-page' : ''}">${view === 'home' ? renderHome() : renderWorkspace()}</main>
    ${popupLayerOpen() ? renderPopupLayer() : ''}`;
  document.documentElement.classList.toggle('popup-open', popupLayerOpen());
  app.setAttribute('aria-busy', 'false');
  requestAnimationFrame(setupCarousels);
  maybeActivateUpdate();
}

function renderHome() {
  if (!state) return '';
  return `<div class="collections-view ${collectionsLayout === 'grid' ? 'dense-collections' : 'carousel-collections'}"><div class="page-tools" role="group" aria-label="Collection view"><button class="icon-button ${collectionsLayout === 'carousel' ? 'selected' : ''}" data-action="collections-layout" data-layout="carousel" aria-label="Carousel view" title="Carousel view">${icon('carousel')}</button><button class="icon-button ${collectionsLayout === 'grid' ? 'selected' : ''}" data-action="collections-layout" data-layout="grid" aria-label="Grid view" title="Grid view">${icon('grid')}</button></div>${state.collections.length ? state.collections.map(collection => renderCollection(collection)).join('') : `<div class="empty-state collection-empty"><strong>No Collections yet</strong><p>Save a search to keep the things you use together.</p></div>`}<button class="collection-ghost" data-action="new-collection" aria-label="Add Collection">${icon('plus')}<span>Add Collection</span></button></div>`;
}

function renderCollection(collection) {
  const entities = searchEntities(state, collection.query, collection.queryBindings || []);
  const carousel = collectionsLayout === 'carousel';
  return `<section class="collection-section" aria-labelledby="collection-${collection.id}">
    <div class="section-heading"><div><h2 id="collection-${collection.id}">${escape(collection.name)}</h2><p>${collection.description ? `${escape(collection.description)} · ` : ''}${entities.length} ${entities.length === 1 ? 'result' : 'results'}</p></div>
      <div class="carousel-controls"><button class="icon-button" data-action="edit-collection" data-id="${collection.id}" aria-label="Edit ${escape(collection.name)} Collection">${icon('edit')}</button>${carousel ? `<button class="icon-button" data-action="carousel-prev" data-target="track-${collection.id}" aria-label="Previous ${escape(collection.name)}">${icon('left')}</button><button class="icon-button" data-action="carousel-next" data-target="track-${collection.id}" aria-label="Next ${escape(collection.name)}">${icon('right')}</button>` : ''}</div>
    </div>
    ${carousel ? `<div class="carousel-frame"><div class="carousel-track" id="track-${collection.id}" tabindex="0" aria-label="${escape(collection.name)} carousel">${entities.map(renderContainerCard).join('')}<button class="container-card empty-card ghost-card" data-action="add-collection-item" data-collection="${collection.id}" aria-label="Add item from ${escape(collection.name)}">${icon('plus')}<span>Add Item</span></button></div></div>` : `<div class="collection-grid" data-collection-grid="${collection.id}">${entities.map(renderDenseCollectionCard).join('')}<button class="dense-card ghost-card" data-action="add-collection-item" data-collection="${collection.id}" aria-label="Add item from ${escape(collection.name)}">${icon('plus')}<span>Add</span></button></div>`}
  </section>`;
}

function renderDenseCollectionCard(entity) {
  const action = entity.container ? 'open-entity' : 'edit-entity';
  return `<button class="dense-card" data-action="${action}" data-id="${entity.id}" title="${escape(entity.description || entity.name)}">${imageMarkup(entity, 'dense-image')}<span class="dense-item-copy"><strong>${escape(entity.name)}</strong>${renderCompactStats(entity)}</span></button>`;
}

function fieldIconMarkup(entity, name) {
  const meta = entity.fieldMeta?.[name];
  if (meta?.iconImage) return `<img class="stat-symbol-image" src="${escape(meta.iconImage)}" alt="">`;
  return `<span class="stat-symbol" aria-hidden="true">${escape(meta?.icon || '#')}</span>`;
}

function renderCompactStats(entity) {
  const basic = entity.tags.includes('Tag')
    ? [{ label: 'Metadata Tags', value: entity.tags.filter(tag => tag !== 'Tag').length, mark: icon('tag') }]
    : entity.container
    ? [{ label: 'Things', value: childrenOf(entity.id).reduce((sum, child) => sum + child.quantity, 0), mark: icon('bag') }, { label: 'Weight', value: formatNumber(safeWeight(entity.id)), mark: icon('mass') }, { label: 'Connected Containers', value: containerConnections(entity).length, mark: icon('link') }]
    : [{ label: 'Quantity', value: entity.quantity, mark: icon('bag') }, { label: 'Weight', value: formatNumber(safeWeight(entity.id)), mark: icon('mass') }, ...Object.entries(entity.fields || {}).slice(0, 1).map(([name, value]) => ({ label: name, value: displayNumericField(entity, name, value), mark: fieldIconMarkup(entity, name) }))];
  return `<span class="compact-stats">${basic.map(stat => `<span title="${escape(stat.label)}"><strong>${escape(stat.value)}</strong>${stat.mark}</span>`).join('')}</span>`;
}

function renderContainerCard(entity) {
  const children = childrenOf(entity.id);
  const visible = children.slice(0, 3);
  const isTagEntity = entity.tags.includes('Tag');
  const tagNames = entity.tags.map(tagName).filter(name => name && name !== 'Tag');
  const action = entity.container ? 'open-entity' : 'edit-entity';
  return `<article class="container-card ${children.length ? 'has-items' : ''} ${isTagEntity ? 'tag-card' : ''}" data-entity="${entity.id}" data-action="${action}" data-id="${entity.id}" tabindex="0" role="link" aria-label="${isTagEntity ? 'Edit' : 'Open'} ${escape(entity.name)}">
    <div class="card-link">
      <div class="card-primary-link"><div class="card-top">${imageMarkup(entity)}<div class="card-title-wrap"><h3>${escape(entity.name)}</h3></div></div><p class="card-description">${escape(entity.description || 'No description yet.')}</p></div>
      <footer class="card-footer">${isTagEntity ? `<div class="tag-card-meta">${icon('tag')}<span>${tagNames.length ? `${tagNames.length} metadata ${tagNames.length === 1 ? 'Tag' : 'Tags'}` : 'Tag'}</span></div>` : `<div class="preview-chips">${visible.map(child => renderChip(child, true)).join('')}${children.length > visible.length ? `<span class="chip" aria-label="${children.length - visible.length} more items">+${children.length - visible.length}</span>` : ''}</div><div class="card-stats"><div class="stat"><span>Things</span><strong>${children.reduce((sum, child) => sum + child.quantity, 0)}</strong></div><div class="stat"><span>Weight</span><strong>${formatNumber(safeWeight(entity.id))}</strong></div><div class="stat"><span>Tags</span><strong>${tagNames.length}</strong></div></div>`}</footer>
    </div>
    <div class="card-actions"><button class="card-action-button" data-action="edit-entity" data-id="${entity.id}" aria-label="Edit ${escape(entity.name)}">${icon('edit')}</button></div>
  </article>`;
}

function renderChip(entity, linked = true) {
  const content = `${imageMarkup(entity, 'chip-image')}<span class="chip-title">${escape(entity.name)}</span><span class="chip-count">×${entity.quantity}</span>`;
  return linked ? `<a class="chip" href="#entity-${entity.id}" data-action="open-entity" data-id="${entity.id}">${content}</a>` : `<span class="chip">${content}</span>`;
}

function renderWorkspace() {
  if (!state) return '';
  const ids = state.recentTabs.filter(id => state.entities[id] && isEntityVisible(state, id));
  const panelUtility = utility && !popupLayerOpen() ? utility : '';
  const panelIds = panelUtility ? [...ids, panelUtility] : ids;
  if (!panelIds.length) { view = 'home'; return renderHome(); }
  const only = panelIds.length === 1 ? 'single' : '';
  const utilityClass = panelUtility && ids.length ? 'utility-open' : '';
  return `<div class="workspace ${only} ${utilityClass}" aria-label="Panels">${ids.map(id => renderContainerPanel(state.entities[id], activePanel === id && !panelUtility)).join('')}${panelUtility ? renderUtilityPanel() : ''}</div>`;
}

function renderPopupLayer() {
  return `<div class="popup-layer"><button class="popup-backdrop" data-action="close-utility" aria-label="Close popup"></button><div class="popup-workspace" role="dialog" aria-modal="true" aria-label="Popup panels">${renderUtilityPanel()}</div></div>`;
}

function renderContainerPanel(entity, active) {
  const children = childrenOf(entity.id);
  const tagEntities = entity.tags.map(id => state.entities[id]).filter(Boolean).filter(tag => tag.name !== 'Tag');
  const tagNames = tagEntities.map(tag => tag.name);
  const restackable = restackCandidates(state, entity.id).length;
  const layout = inventoryLayouts.get(entity.id) || 'list';
  const linked = containerConnections(entity);
  const party = isPartyContainer(entity);
  return `<section class="panel ${active ? 'active' : ''}" data-panel-id="${entity.id}" aria-labelledby="panel-title-${entity.id}">
    <header class="panel-header"><div class="panel-title"><h2 id="panel-title-${entity.id}">${escape(entity.name)}</h2><p>${escape(tagNames.join(' · ') || 'Container')} · ×${entity.quantity}</p></div><div class="panel-actions">${entity.quantity > 1 ? `<button data-action="split-stack" data-id="${entity.id}" aria-label="Split one ${escape(entity.name)}">${icon('split')}<span class="header-label">Split one</span></button>` : ''}${restackable ? `<button data-action="restack" data-id="${entity.id}" aria-label="Restack ${restackable + 1} ${escape(entity.name)} containers">${icon('stack')}<span class="header-label">Restack ${restackable + 1}</span></button>` : ''}<button class="icon-button" data-action="edit-entity" data-id="${entity.id}" aria-label="Edit ${escape(entity.name)}">${icon('edit')}</button><button class="icon-button" data-action="close-tab" data-id="${entity.id}" aria-label="Close ${escape(entity.name)}">${icon('close')}</button></div></header>
    <div class="panel-body">
      <div class="panel-overview"><div class="hero-summary">${imageMarkup(entity)}<div class="hero-copy"><p>${escape(entity.description || 'No description yet.')}</p><div class="summary-stats"><div class="stat"><span>Things</span><strong>${children.reduce((sum, child) => sum + child.quantity, 0)}</strong></div><div class="stat"><span>Weight</span><strong>${formatNumber(safeWeight(entity.id))}</strong></div><div class="stat"><span>Containers</span><strong>${children.filter(child => child.container).length}</strong></div>${Object.entries(entity.fields || {}).map(([name, value]) => `<div class="stat"><span>${escape(name)}</span><strong>${escape(displayNumericField(entity, name, value))}</strong></div>`).join('')}</div></div></div><div class="preview-chips container-tags" aria-label="Tags">${tagEntities.map(tag => `<a class="chip" href="#search" data-action="search-tag" data-id="${tag.id}" data-value="${escape(tag.name)}">${imageMarkup(tag, 'chip-image')}<span class="chip-title">${escape(tag.name)}</span></a>`).join('')}</div></div>
      <section class="linked-containers" aria-label="Linked Containers"><div class="inventory-heading"><div><h3>${icon('link')} Linked Containers</h3><span class="muted">${linked.length ? 'Open one, or drop an item onto it' : party ? 'Connect every Character in this Party' : 'Keep related Containers one tap away'}</span></div><div class="linked-heading-actions"><span class="destination-key">${linked.length} ${linked.length === 1 ? 'destination' : 'destinations'}</span><button data-action="manage-container-links" data-id="${entity.id}">${icon('link')} Link${party ? '<span class="link-action-detail"> Characters</span>' : ''}</button></div></div>${linked.length ? `<div class="linked-container-rail">${linked.map(connection => renderLinkedDestination(connection.entity, connection.kind)).join('')}</div>` : `<button class="linked-empty" data-action="manage-container-links" data-id="${entity.id}">${icon('plus')}<span>${party ? 'Add Characters To This Party' : 'Link A Container'}</span></button>`}</section>
      <div class="inventory-heading"><div><h3>Inventory</h3><span class="muted">${children.length} ${children.length === 1 ? 'entry' : 'entries'}</span></div><div class="view-toggle" role="group" aria-label="Inventory view"><button class="icon-button ${layout === 'list' ? 'selected' : ''}" data-action="inventory-layout" data-id="${entity.id}" data-layout="list" aria-label="List view" title="List view">${icon('list')}</button><button class="icon-button ${layout === 'grid' ? 'selected' : ''}" data-action="inventory-layout" data-id="${entity.id}" data-layout="grid" aria-label="Grid view" title="Grid view">${icon('grid')}</button></div></div>
      <div class="inventory-grid ${layout}-view" data-inventory-parent="${entity.id}">${children.map(child => layout === 'grid' ? renderDenseInventoryCard(child) : renderInventoryRow(child)).join('')}${layout === 'grid' ? `<button class="dense-item-card empty-item-card" data-action="add-item" data-parent="${entity.id}" aria-label="Add item to ${escape(entity.name)}">${icon('plus')}<span>Add</span></button>` : `<button class="inventory-row empty-item-card" data-action="add-item" data-parent="${entity.id}" aria-label="Add item to ${escape(entity.name)}">${icon('plus')}<span>Add Item</span></button>`}</div>
    </div>
  </section>`;
}

function quantityControls(entity) {
  return `<span class="quantity" aria-label="Quantity ${entity.quantity}"><button data-action="quantity" data-id="${entity.id}" data-delta="-1" aria-label="Decrease ${escape(entity.name)} quantity">−</button><button class="quantity-value" data-action="edit-quantity" data-id="${entity.id}" aria-label="Set ${escape(entity.name)} quantity" title="Set quantity">${entity.quantity}</button><button data-action="quantity" data-id="${entity.id}" data-delta="1" aria-label="Increase ${escape(entity.name)} quantity">+</button></span>`;
}

function dragHandle(entity) {
  return `<button class="drag-handle" data-action="drag-item" data-drag-handle aria-label="Drag ${escape(entity.name)} to reorder or move" title="Drag to reorder or move">${icon('grip')}</button>`;
}

function renderInventoryRow(entity) {
  const action = entity.container ? 'open-entity' : 'edit-entity';
  return `<article class="inventory-row clickable" data-drag-id="${entity.id}" data-action="${action}" data-id="${entity.id}" tabindex="0" role="link" aria-label="Open ${escape(entity.name)}" title="${escape(entity.description || entity.name)}">
    ${dragHandle(entity)}${imageMarkup(entity, 'inventory-row-image')}<span class="inventory-row-copy"><strong>${escape(entity.name)}</strong><small>${entity.container ? 'Container' : 'Item'}</small></span><span class="inventory-row-description">${escape(entity.description || '')}</span><span class="inventory-row-stat" title="Weight"><strong>${formatNumber(safeWeight(entity.id))}</strong>${icon('mass')}</span>${quantityControls(entity)}
  </article>`;
}

function renderLinkedDestination(entity, relationship = 'linked') {
  const label = relationship === 'inside' ? 'Parent Container' : relationship === 'contains' ? 'Contained Container' : entity.tags.some(tagId => tagName(tagId) === 'Character') ? 'Linked Character' : 'Linked Container';
  return `<article class="inventory-row linked-destination clickable" data-action="open-entity" data-id="${entity.id}" data-drop-parent="${entity.id}" tabindex="0" role="link" aria-label="Open linked Container ${escape(entity.name)}; drop an item here to move it">
    <span class="row-leading-icon" aria-hidden="true">${icon('link')}</span>${imageMarkup(entity, 'inventory-row-image')}<span class="inventory-row-copy"><strong>${escape(entity.name)}</strong><small>${escape(label)}</small></span><span class="inventory-row-stat" title="Things"><strong>${childrenOf(entity.id).reduce((sum, child) => sum + child.quantity, 0)}</strong>${icon('bag')}</span><span class="drop-cta">Drop here</span>
  </article>`;
}

function renderDenseInventoryCard(entity) {
  const action = entity.container ? 'open-entity' : 'edit-entity';
  return `<article class="dense-item-card clickable" data-drag-id="${entity.id}" data-action="${action}" data-id="${entity.id}" tabindex="0" role="link" aria-label="Open ${escape(entity.name)}" title="${escape(entity.description || entity.name)}">${dragHandle(entity)}${imageMarkup(entity, 'dense-image')}<span class="dense-item-copy"><strong>${escape(entity.name)}</strong>${renderCompactStats(entity)}</span></article>`;
}

function renderUtilityPanel() {
  if (utility === 'settings') return renderSettings();
  if (utility === 'search') return renderSearch();
  if (utility === 'groups') return renderGroups();
  if (utility === 'activity') return renderActivity();
  if (utility === 'profile') return renderProfile();
  if (utility === 'tags') return renderTagManager();
  if (utility === 'menu') return renderMobileMenu();
  if (utility === 'editor') return renderEditor();
  if (utility === 'group-editor') return renderGroupEditor();
  if (utility === 'permissions') return renderPermissions();
  if (utility === 'sources') return renderSources();
  if (utility === 'source-browser') return renderSourceBrowser();
  if (utility === 'source-editor') return renderSourceEditor();
  if (utility === 'collection-editor') return renderCollectionEditor();
  if (utility === 'custom-create') return renderCustomCreate();
  if (utility === 'dnd-tools') return renderDndTools();
  if (utility === 'character-setup') return renderCharacterSetup();
  if (utility === 'ddb-import') return renderDdbImport();
  if (utility === 'container-links') return renderContainerLinks();
  return '';
}

function utilityHeader(title, subtitle = '') {
  const canGoBack = utilityStack.length > 0;
  return `<header class="panel-header"><div class="panel-title"><h2 id="${escape(utility)}-title">${escape(title)}</h2>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}</div><div class="panel-actions"><button class="icon-button" data-action="${canGoBack ? 'utility-back' : 'close-utility'}" aria-label="${canGoBack ? 'Back' : `Close ${title}`}">${icon(canGoBack ? 'back' : 'close')}</button></div></header>`;
}

function renderContainerLinks() {
  const container = state.entities[String(/** @type {any} */(utilityContext).containerId || '')];
  if (!container?.container || !isEntityVisible(state, container)) return `<section class="panel active">${utilityHeader('Link Containers')}<div class="panel-body"><div class="empty-state"><strong>Container Unavailable</strong><p>Close this panel and choose another Container.</p></div></div></section>`;
  const rawFilter = String(/** @type {any} */(utilityContext).containerLinkFilter || '');
  const matches = rawFilter ? new Set(searchEntities(state, rawFilter).map(entity => entity.id)) : null;
  const explicit = new Set(linkedContainerIds(state, container.id));
  const structural = new Map();
  if (container.parentId && state.entities[container.parentId]?.container) structural.set(container.parentId, 'inside');
  for (const child of childrenOf(container.id).filter(entity => entity.container)) structural.set(child.id, 'contains');
  const party = isPartyContainer(container);
  const character = entity => entity.tags.some(tagId => tagName(tagId) === 'Character');
  const candidates = activeEntities().filter(entity => entity.container && !entity.managed && entity.id !== container.id && (!matches || matches.has(entity.id))).sort((a, b) => {
    const rank = entity => explicit.has(entity.id) || structural.has(entity.id) ? 0 : party && character(entity) ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  const row = entity => {
    const relation = structural.get(entity.id);
    const linked = explicit.has(entity.id);
    const names = entity.tags.map(tagName).filter(name => name && !['Item','Container','Created'].includes(name)).slice(0, 3);
    const structureStatus = relation === 'inside' ? 'Parent' : relation === 'contains' ? 'Inside Inventory' : '';
    const status = linked ? `Linked${structureStatus ? ` · ${structureStatus}` : ''}` : structureStatus || (character(entity) ? 'Character' : 'Container');
    return `<article class="link-candidate ${linked || relation ? 'connected' : ''}"><div class="link-candidate-copy">${imageMarkup(entity, 'inventory-row-image')}<span><strong>${escape(entity.name)}</strong><small>${escape(names.join(' · ') || status)}</small></span></div><span class="link-status">${escape(status)}</span>${linked ? `<button data-action="unlink-container" data-container="${container.id}" data-id="${entity.id}" aria-label="Unlink ${escape(entity.name)} from ${escape(container.name)}">${icon('close')} Unlink</button>` : relation ? `<button disabled aria-label="${escape(entity.name)} is connected through inventory">${escape(relation === 'inside' ? 'Parent' : 'Contained')}</button>` : `<button class="primary" data-action="link-container" data-container="${container.id}" data-id="${entity.id}" aria-label="Link ${escape(entity.name)} to ${escape(container.name)}">${icon('link')} Link</button>`}</article>`;
  };
  return `<section class="panel active" aria-labelledby="container-links-title">${utilityHeader('Link Containers', container.name)}<div class="panel-body link-manager"><div class="link-manager-intro"><div><strong>${party ? 'Build This Party’s Character Roster' : 'Connect Related Containers'}</strong><p>${party ? 'Characters are listed first. Links never change inventory or Weight.' : 'Links create shortcuts and drag destinations without moving inventory.'}</p></div><span class="destination-key">${explicit.size} linked</span></div><label class="tag-search">Find A Container<input type="search" data-action="container-link-filter" value="${escape(rawFilter)}" placeholder="Name, +Character, +Bag…" autocomplete="off"></label><div class="link-manager-list">${candidates.length ? candidates.map(row).join('') : `<div class="empty-state compact"><strong>No Containers Found</strong><p>${rawFilter ? 'Try another name or Tag query.' : 'Create another Container, then return here to link it.'}</p></div>`}</div></div></section>`;
}

function utilityDismissAction() {
  return utilityStack.length ? 'utility-back' : 'close-utility';
}

function renderSettings() {
  return `<section class="panel active" aria-labelledby="settings-title">${utilityHeader('Settings', 'Appearance and accessibility')}
    <form class="panel-body" data-form="settings">
      <fieldset class="settings-group"><legend>Density</legend><div class="segmented">${['compact','normal','spacious'].map(value => `<button type="button" data-action="preview-density" data-value="${value}" class="${state.settings.density === value ? 'selected' : ''}">${value[0].toUpperCase() + value.slice(1)}</button>`).join('')}</div></fieldset>
      <fieldset class="settings-group"><legend>Color mode</legend><div class="segmented">${['system','light','dark'].map(value => `<button type="button" data-action="preview-mode" data-value="${value}" class="${state.settings.mode === value ? 'selected' : ''}">${value[0].toUpperCase() + value.slice(1)}</button>`).join('')}</div></fieldset>
      <label>Theme<select name="theme">${['flat','modern','high fantasy','low fantasy','dark fantasy','sci-fi','cozy'].map(value => `<option value="${value}" ${state.settings.theme === value ? 'selected' : ''}>${value.replace(/\b\w/g, char => char.toUpperCase())}</option>`).join('')}</select></label>
      <fieldset class="settings-group"><legend>Accent</legend><div class="accent-grid">${ACCENT_PRESETS.map(value => `<button type="button" data-action="preview-accent" data-value="${value}" class="${(state.settings.accent || 'custom') === value ? 'selected' : ''}"><span class="accent-swatch" aria-hidden="true"></span>${value.replace('-', ' ').replace(/\b\w/g, character => character.toUpperCase())}</button>`).join('')}</div></fieldset>
      ${(state.settings.accent || 'custom') === 'custom' ? `<label class="hue-control"><span>Custom Accent Hue (<output>${state.settings.hue}°</output>)</span><input name="hue" type="range" min="0" max="359" value="${state.settings.hue}" data-action="preview-hue"></label>` : `<input type="hidden" name="hue" value="${state.settings.hue}">`}
      <label>Motion<select name="motion"><option value="system" ${state.settings.motion === 'system' ? 'selected' : ''}>Follow system</option><option value="reduced" ${state.settings.motion === 'reduced' ? 'selected' : ''}>Reduced</option><option value="full" ${state.settings.motion === 'full' ? 'selected' : ''}>Full</option></select></label>
      <p class="muted">Appearance stays on this device and never changes content, order, permissions, or target sizes.</p>
      <div class="form-actions"><button type="button" data-action="reset-settings">Reset</button><button class="primary" type="submit">Apply</button></div>
    </form></section>`;
}

function renderTagManager() {
  const rawFilter = String(/** @type {any} */(utilityContext).tagFilter || '');
  const filter = rawFilter.trim().toLocaleLowerCase();
  const tags = searchEntities(state, '+Tag').filter(entity => entity.tags.includes('Tag')).filter(entity => !filter || `${entity.name} ${entity.description}`.toLocaleLowerCase().includes(filter));
  return `<section class="panel active" aria-labelledby="tags-title">${utilityHeader('Tags', `${tags.length} available`)}<div class="panel-body"><div class="locked-query"><code class="query-token include">+Tag</code><span>Only Tags appear here</span></div><div class="inventory-heading"><label class="tag-search">Find a Tag<input type="search" data-action="tag-filter" value="${escape(rawFilter)}" placeholder="Name or description"></label><button data-action="custom-tag">${icon('plus')} Tag</button></div><div class="tag-manager-grid">${tags.map(tag => `<button class="tag-manager-card" data-action="edit-entity" data-id="${tag.id}">${imageMarkup(tag, 'chip-image')}<span><strong>${escape(tag.name)}</strong><small>${escape(tag.description || 'No description')}</small></span>${icon('edit')}</button>`).join('')}<button class="tag-manager-card ghost-card" data-action="custom-tag">${icon('plus')}<span><strong>Add Tag</strong><small>Create a reusable label</small></span></button></div></div></section>`;
}

function renderSearch() {
  const results = searchValue ? searchEntities(state, searchValue, searchBindings).slice(0, 40) : [];
  return `<section class="panel active" aria-labelledby="search-title">${utilityHeader('Search', 'Text first; +Tag, -Tag, or =Container')}
    <div class="panel-body"><div class="search-box"><label class="live-region" for="global-search">Search every visible entity</label><span class="query-input-shell search-query"><span class="query-highlight" aria-hidden="true">${renderQueryHighlight(searchValue)}</span><input class="query-input" id="global-search" type="search" role="combobox" value="${escape(searchValue)}" placeholder="Search, or try +Character" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="search-suggestions" aria-expanded="${Boolean(activeSearchOperand())}" aria-describedby="search-help" data-action="search-input"></span></div><div id="search-assist">${renderSearchAssist()}</div><p class="muted" id="search-help">Type + or - for Tags, or = for a Container. Choose from the matching suggestions; quotes are added only when needed.</p><div class="search-results" id="search-results">${renderSearchResults(results)}</div></div></section>`;
}

function renderQueryHighlight(value) {
  const source = String(value || '');
  const pattern = /(^|\s)([+\-=])(?:"(?:[^"\\]|\\.)*"|[^\s]*)/g;
  let html = '';
  let index = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index || 0;
    const prefix = match[1] || '';
    html += escape(source.slice(index, start)) + escape(prefix);
    const token = match[0].slice(prefix.length);
    const tone = match[2] === '+' ? 'include' : match[2] === '-' ? 'exclude' : 'container';
    html += `<span class="query-token ${tone}">${escape(token)}</span>`;
    index = start + match[0].length;
  }
  return html + escape(source.slice(index));
}

function queryOperand(value) {
  const escaped = String(value).replace(/["\\]/g, '\\$&');
  return /\s|"/.test(value) ? `"${escaped}"` : escaped;
}

function activeQueryOperand(searchValue) {
  const match = /(?:^|\s)([+\-=])(?:"([^"]*)|([^\s]*))$/.exec(searchValue);
  if (!match) return null;
  const operator = SEARCH_OPERATORS.find(item => item.symbol === match[1]);
  return operator ? { operator, value: match[2] ?? match[3] ?? '', start: match.index + (match[0].startsWith(' ') ? 1 : 0) } : null;
}

function activeSearchOperand() { return activeQueryOperand(searchValue); }

function renderSearchAssist() {
  return renderQueryAssist(searchValue, 'search');
}

function renderQueryAssist(searchValue, context = 'search') {
  const active = activeQueryOperand(searchValue);
  if (!active) return '';
  const candidates = activeEntities().filter(entity => active.operator.kind === 'tag' ? entity.tags.includes('Tag') : entity.container);
  const term = active.value.toLocaleLowerCase();
  const suggestions = candidates.filter(entity => entity.name.toLocaleLowerCase().includes(term)).slice(0, 8);
  const suggestionsId = `${context}-suggestions`;
  const action = context === 'search' ? 'search-suggestion' : 'query-suggestion';
  return suggestions.length ? `<div class="search-suggestions" id="${suggestionsId}" role="listbox" aria-label="${escape(active.operator.label)} suggestions">${suggestions.map(entity => `<button role="option" aria-selected="false" tabindex="-1" data-action="${action}" data-context="${escape(context)}" data-symbol="${escape(active.operator.symbol)}" data-operator="${escape(active.operator.key)}" data-start="${active.start}" data-id="${entity.id}" data-value="${escape(entity.name)}"><span><strong>${escape(entity.name)}</strong><small>${active.operator.kind === 'tag' ? 'Tag' : 'Container'} · ${escape(entity.id.slice(0, 8))}</small></span></button>`).join('')}</div>` : `<div class="search-suggestions empty" id="${suggestionsId}"><span>No matching ${active.operator.kind}s.</span></div>`;
}

function pruneSearchBindings() {
  const parsed = parseQuery(searchValue);
  searchBindings = searchBindings.filter(binding => parsed[binding.operator].some(value => value.localeCompare(binding.displayName, undefined, { sensitivity: 'accent' }) === 0));
}

function renderSearchResults(results) {
  if (!searchValue) return `<div class="empty-state"><strong>Search your whole Vault.</strong><p>Try a name, +Character, -Managed, or ="Aria Thorn".</p></div>`;
  if (!results.length) return `<div class="empty-state"><strong>No exact results.</strong><p>Check the spelling or remove a structured constraint.</p></div>`;
  return results.map(entity => `<button class="search-result" data-action="${entity.container ? 'open-entity' : 'edit-entity'}" data-id="${entity.id}">${imageMarkup(entity, 'chip-image')}<span><strong>${escape(entity.name)}</strong><small class="muted">${escape(entityType(entity))}${entity.parentId ? ` · in ${escape(state.entities[entity.parentId]?.name || 'Unknown')}` : ''}</small></span></button>`).join('');
}

function renderGroups() {
  const groups = /** @type {Array<any>} */(state.groups);
  const selectedGroupId = /** @type {any} */(utilityContext).selectedGroupId || groups[0]?.id || '';
  const selectedMemberId = /** @type {any} */(utilityContext).selectedMemberId || '';
  const people = new Map(state.friends.map(friend => [friend.vaultGuid, { member: { ...friend, role: 'Friend' }, group: null }]));
  for (const group of groups) for (const member of group.members || []) if ((member.vaultGuid || member.id) !== state.vault.id) people.set(member.vaultGuid || member.id, { member, group });
  const memberCard = (member, group) => {
    const memberId = member.vaultGuid || member.id;
    const selected = memberId === selectedMemberId;
    const explicitFriend = state.friends.some(friend => friend.vaultGuid === memberId);
    return `<div class="member-entry"><button class="member-row ${selected ? 'selected' : ''}" data-action="select-member" data-group="${group?.id || ''}" data-id="${memberId}"><span class="avatar">${escape(initials(member.name))}</span><span><strong>${escape(member.name)}</strong><small>${escape(member.role || 'Member')}</small></span><span class="muted">${member.role === 'Owner' ? 'Owner' : explicitFriend ? 'Friend' : 'Member'}</span></button>${selected ? `<div class="member-detail"><strong>${escape(member.name)}</strong><p>${memberId === state.vault.id ? 'This is your Vault identity in the Group.' : explicitFriend ? 'Saved contact. Contact codes identify a Vault but never grant permission.' : 'Shared profile details are limited to this Group.'}</p><code>${escape(memberId)}</code>${explicitFriend ? `<button class="ghost" data-action="remove-friend" data-id="${memberId}">Remove friend</button>` : ''}</div>` : ''}</div>`;
  };
  return `<section class="panel active" aria-labelledby="groups-title">${utilityHeader('Groups & Friends', 'Friends, members, and shared work')}
    <div class="panel-body groups-body">
      <section><span class="eyebrow">Join a Group</span><h3>Have an invite?</h3><form data-form="join-group" class="form-grid"><label class="full">Invite code or link<input name="invite" required placeholder="Paste an invite code or link"></label><div class="form-actions full"><button type="submit">Join Group</button></div></form></section>
      <hr><section><span class="eyebrow">Add a friend</span><h3>Save another Vault identity</h3><form data-form="add-friend" class="form-grid"><label class="full">Contact code<input name="contact" required placeholder="sonatory-contact-v1..."><span>Ask your friend to copy their code from Profile & Vault. A contact never grants access.</span></label><div class="form-actions full"><button type="submit">Add friend</button></div></form></section>
      <hr><section><span class="eyebrow">Friends & Members</span><h3>People you know</h3>${people.size ? `<div class="member-list">${[...people.values()].map(item => memberCard(item.member, item.group)).join('')}</div>` : `<div class="empty-state"><strong>No friends yet</strong><p>Exchange contact codes or accept a future Group invitation. Each person keeps their own Vault GUID.</p></div>`}</section>
      <hr><section><div class="inventory-heading"><div><span class="eyebrow">Your Groups</span><h3>Collaboration spaces</h3></div><button data-action="new-group">${icon('plus')} Create Group</button></div>
      ${groups.length ? `<div class="group-list">${groups.map(group => { const expanded = group.id === selectedGroupId; const members = [...(group.members || [])].sort((a, b) => (a.role === 'Owner' ? -1 : b.role === 'Owner' ? 1 : a.name.localeCompare(b.name))); return `<article class="group-card"><div class="group-row"><button class="group-summary" data-action="select-group" data-id="${group.id}" aria-expanded="${expanded}"><span><strong>${escape(group.name)}</strong><small>${members.length} ${members.length === 1 ? 'member' : 'members'} · ${escape(members.find(member => (member.vaultGuid || member.id) === state.vault.id)?.role || 'Member')}</small></span></button><button class="icon-button" data-action="group-more" data-id="${group.id}" aria-label="Permissions for ${escape(group.name)}">${icon('more')}</button></div>${expanded ? `<div class="group-detail"><h4>Members</h4><div class="member-list">${members.map(member => memberCard(member, group)).join('')}</div></div>` : ''}</article>`; }).join('')}</div>` : `<div class="empty-state"><strong>No Groups yet</strong><p>A Group controls collaboration; it does not automatically create a Party container.</p></div>`}</section>
    </div></section>`;
}

function renderGroupEditor() {
  return `<section class="panel active" aria-labelledby="group-editor-title">${utilityHeader('Create Group', 'A collaboration principle, separate from Party containers')}<form class="panel-body" data-form="group-editor"><label>Group name<input name="name" required maxlength="100" autofocus placeholder="The Wayfarers"></label><p class="muted">You become Owner. No Party, Character, or other Container is created automatically.</p><div class="form-actions"><button type="button" data-action="close-utility">Cancel</button><button class="primary" type="submit">Create Group</button></div></form></section>`;
}

function renderPermissions() {
  const group = /** @type {Array<any>} */(state.groups).find(item => item.id === /** @type {any} */(utilityContext).groupId);
  if (!group) return `<section class="panel active">${utilityHeader('Permissions')}<div class="panel-body empty-state"><strong>Group not found</strong></div></section>`;
  const self = group.members.find(member => (member.vaultGuid || member.id) === state.vault.id);
  const confirming = Boolean(/** @type {any} */(utilityContext).confirmDisband);
  return `<section class="panel active" aria-labelledby="permissions-title">${utilityHeader(`${group.name} permissions`, 'Who can see and change shared work')}<div class="panel-body"><span class="eyebrow">Your role</span><h3>${escape(self?.role || 'Member')}</h3><p class="muted">Hosted collaboration is not enabled for this local Group yet.</p><div class="permission-grid"><div><strong>View Group data</strong><span>Allowed</span></div><div><strong>Edit Group data</strong><span>Allowed</span></div><div><strong>Invite members</strong><span>${self?.role === 'Owner' ? 'Owner' : 'Not allowed'}</span></div><div><strong>Manage permissions</strong><span>${self?.role === 'Owner' ? 'Owner' : 'Not allowed'}</span></div></div>${self?.role === 'Owner' ? `<hr><div class="danger-zone"><div><strong>Disband Group</strong><p>Removes this Group. Party containers and personal inventory are not deleted. Undo remains available.</p></div>${confirming ? `<div class="inline-confirm" role="alert"><strong>Disband ${escape(group.name)}?</strong><span>This does not delete containers or inventory.</span><div><button data-action="cancel-disband">Cancel</button><button class="danger" data-action="confirm-disband" data-id="${group.id}">Yes, disband</button></div></div>` : `<button class="danger" data-action="disband-group" data-id="${group.id}">Disband ${escape(group.name)}</button>`}</div>` : ''}</div></section>`;
}

function renderSources() {
  const parentId = /** @type {any} */(utilityContext).parentId || '';
  const collection = state.collections.find(item => item.id === /** @type {any} */(utilityContext).collectionId);
  const destination = parentId ? state.entities[parentId]?.name : collection?.name || 'Vault Root';
  const sourceCard = source => `<article class="source-card"><button class="source-choice" data-action="choose-source" data-id="${source.id}">${sourceIcon(source)}<span><strong>${escape(source.name)}</strong><small>${escape(source.description)}</small></span></button><button class="icon-button" data-action="edit-source" data-id="${source.id}" aria-label="Edit ${escape(source.name)} source">${icon('edit')}</button></article>`;
  const visible = state.itemSources.filter(source => source.enabled !== false);
  const hidden = state.itemSources.filter(source => source.enabled === false);
  return `<section class="panel active" aria-labelledby="sources-title">${utilityHeader('Add To Inventory', `Destination: ${destination}`)}<div class="panel-body"><div class="source-heading"><div><span class="eyebrow">Item Sources</span><h3>What Are You Adding?</h3><p class="muted">Choose the shortest path for what you want to add.</p></div></div><div class="source-grid">${visible.map(sourceCard).join('')}</div>${hidden.length ? `<details class="hidden-sources"><summary>${hidden.length} Hidden ${hidden.length === 1 ? 'Source' : 'Sources'}</summary><div class="source-grid">${hidden.map(sourceCard).join('')}</div></details>` : ''}</div></section>`;
}

function renderSourceBrowser() {
  const query = String(/** @type {any} */(utilityContext).query || '');
  const filter = String(/** @type {any} */(utilityContext).sourceFilter || '');
  const bindings = /** @type {any} */(utilityContext).queryBindings || [];
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const results = searchEntities(state, `${filter} ${query}`.trim(), bindings).filter(entity => !entity.tags.includes('Tag')).sort((a, b) => {
    const rank = entity => entity.name.toLocaleLowerCase() === normalizedFilter ? 0 : entity.name.toLocaleLowerCase().startsWith(normalizedFilter) ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  return `<section class="panel active" aria-labelledby="source-browser-title">${utilityHeader(String(/** @type {any} */(utilityContext).name || 'Items'), `${results.length} Available`)}<div class="panel-body">${query ? `<div class="locked-query" aria-label="Required Query Filters">${renderQueryHighlight(query)}</div>` : ''}<label>Find An Item<input type="search" value="${escape(filter)}" placeholder="Search ${escape(String(/** @type {any} */(utilityContext).name || 'items'))}" autocomplete="off" data-action="source-filter"></label><p class="muted">Choosing an Item or Container creates an independent local copy in the selected destination.</p>${query.includes('Managed') || query.includes('D&D5e') ? `<details class="source-provenance"><summary>About This Source</summary><p>${MANAGED_ITEM_COUNT} bundled D&D definitions generated from the official SRD ${MANAGED_SOURCE_VERSION}. Suppress, edit, delete, or replace them like other local data.</p><a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">Official D&D Source</a></details>` : ''}${results.length ? `<div class="source-results">${results.map(entity => `<button class="search-result" data-action="copy-source-item" data-id="${entity.id}">${imageMarkup(entity, 'chip-image')}<span><strong>${escape(entity.name)}</strong><small>${entity.container ? 'Container · ' : ''}${escape(entity.description || 'No Description')}</small></span></button>`).join('')}</div>` : `<div class="empty-state"><strong>No Matching Source Items.</strong><p>Change the search or choose a different Item Source.</p></div>`}</div></section>`;
}

function renderSourceEditor() {
  const source = state.itemSources.find(item => item.id === /** @type {any} */(utilityContext).sourceId);
  const index = source ? state.itemSources.indexOf(source) : -1;
  const queryDraft = String(/** @type {any} */(utilityContext).queryDraft ?? source?.query ?? '');
  return `<section class="panel active" aria-labelledby="source-editor-title">${utilityHeader(source ? 'Edit Item Source' : 'New Item Source', 'Configure supported behavior without scripting')}<form class="panel-body" data-form="source-editor"><div class="editor-identity-row">${imagePicker('image', source, source?.image ? 'Change Tile Image' : 'Add Tile Image')}<label>Name<input name="name" required maxlength="80" value="${escape(source?.name || '')}"></label></div><label>Description<textarea name="description" maxlength="300">${escape(source?.description || '')}</textarea></label><label>Behavior<select name="behavior">${[['create-item','Create An Item'],['create-container','Create A Container'],['create-character','Create A Character Container'],['custom-create','Choose Item, Container, Or Character'],['browse-query','Browse A Saved Query'],['dnd-tools','D&D Tools'],['ddb-import','D&D Beyond PDF Import']].map(([value, label]) => `<option value="${value}" ${source?.behavior === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Query<span class="query-input-shell"><span class="query-highlight" aria-hidden="true">${renderQueryHighlight(queryDraft)}</span><input class="query-input" name="query" value="${escape(queryDraft)}" placeholder="+Managed" data-action="collection-query" role="combobox" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="collection-suggestions" aria-expanded="${Boolean(activeQueryOperand(queryDraft))}"></span><span>Used by Browse behavior and as the D&D Item filter.</span></label><div id="collection-query-assist">${renderQueryAssist(queryDraft, 'collection')}</div><label class="choice"><input name="enabled" type="checkbox" ${source?.enabled === false ? '' : 'checked'}><strong>Show This Source</strong><span>Hidden Sources remain editable from the collapsed list.</span></label>${source ? `<div class="form-actions source-order"><button class="square-button" type="button" data-action="source-move" data-id="${source.id}" data-direction="-1" ${index <= 0 ? 'disabled' : ''} aria-label="Move Up" title="Move Up">${icon('up')}</button><button class="square-button" type="button" data-action="source-move" data-id="${source.id}" data-direction="1" ${index >= state.itemSources.length - 1 ? 'disabled' : ''} aria-label="Move Down" title="Move Down">${icon('down')}</button></div>` : ''}<p class="muted">Only reviewed behaviors are available. Source data never runs user JavaScript.</p><div class="editor-actions"><div class="destructive-actions">${source ? `<button class="danger" type="button" data-action="delete-source" data-id="${source.id}">Delete</button>` : ''}</div><div class="form-actions"><button type="button" data-action="sources-back">Cancel</button><button class="primary" type="submit">Save</button></div></div></form></section>`;
}

function renderCollectionEditor() {
  const id = /** @type {any} */(utilityContext).collectionId || '';
  const collection = state.collections.find(item => item.id === id);
  const index = collection ? state.collections.indexOf(collection) : -1;
  const queryDraft = String(/** @type {any} */(utilityContext).queryDraft ?? collection?.query ?? '');
  const resultCount = searchEntities(state, queryDraft, /** @type {any} */(utilityContext).queryBindings || collection?.queryBindings || []).length;
  return `<section class="panel active" aria-labelledby="collection-editor-title">${utilityHeader(collection ? 'Collection Settings' : 'Create Collection', 'A saved exact query over your Vault')}
    <form class="panel-body" data-form="collection-editor">
      <div class="form-grid"><label class="full">Name<input name="name" required maxlength="120" value="${escape(collection?.name || '')}" autofocus></label><label class="full">Description<textarea name="description" maxlength="1000">${escape(collection?.description || '')}</textarea></label><label class="full">Add Button Opens<select name="createAction">${collectionCreateActionOptions(collection?.createAction || 'custom')}</select><span>The Collection query is applied to the new Entity automatically.</span></label><label class="full">Query<span class="query-input-shell"><span class="query-highlight" aria-hidden="true">${renderQueryHighlight(queryDraft)}</span><input class="query-input" name="query" maxlength="10000" value="${escape(queryDraft)}" placeholder='+Character' data-action="collection-query" role="combobox" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="collection-suggestions" aria-expanded="${Boolean(activeQueryOperand(queryDraft))}"></span><span>Type +, -, or = and choose a matching Tag or Container.</span></label><div class="full" id="collection-query-assist">${renderQueryAssist(queryDraft, 'collection')}</div></div>
      ${collection ? `<div class="source-provenance"><strong><span id="collection-match-count">${resultCount}</span> matching ${resultCount === 1 ? 'result' : 'results'}</strong><p>Changing or deleting this Collection never deletes matching Entities.</p></div><div class="managed-actions"><button class="square-button" type="button" data-action="move-collection" data-id="${collection.id}" data-delta="-1" ${index <= 0 ? 'disabled' : ''} aria-label="Move up" title="Move up">${icon('up')}</button><button class="square-button" type="button" data-action="move-collection" data-id="${collection.id}" data-delta="1" ${index >= state.collections.length - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down">${icon('down')}</button><button type="button" data-action="add-collection-item" data-id="${collection.id}">${icon('plus')} Add Item</button></div>` : '<p class="muted">The Collection appears as one flat carousel and does not own its results.</p>'}
      <div class="form-actions">${collection ? `<button class="danger" type="button" data-action="delete-collection" data-id="${collection.id}">Delete</button>` : ''}<button type="button" data-action="close-utility">Cancel</button><button class="primary" type="submit">${collection ? 'Save' : 'Create'}</button></div>
    </form></section>`;
}

function renderCustomCreate() {
  return `<section class="panel active" aria-labelledby="custom-create-title">${utilityHeader('Custom', 'Choose the structure that fits')}<div class="panel-body"><div class="source-grid"><article class="source-card"><button class="source-choice" data-action="custom-item"><span class="source-mark">I</span><span><strong>Item</strong><small>Create an ordinary inventory entry.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="custom-container"><span class="source-mark">C</span><span><strong>Container</strong><small>Create an item that can hold other items.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="custom-character"><span class="source-mark">P</span><span><strong>Character</strong><small>Blank or import D&D Beyond inventory.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="custom-tag"><span class="source-mark">T</span><span><strong>Tag</strong><small>Create a reusable label.</small></span></button></article></div></div></section>`;
}

function renderDndTools() {
  return `<section class="panel active" aria-labelledby="dnd-tools-title">${utilityHeader('D&D', 'Items and D&D Beyond inventory')}<div class="panel-body"><div class="source-grid"><article class="source-card"><button class="source-choice" data-action="dnd-browse"><span class="source-mark">D</span><span><strong>Browse D&D items</strong><small>${MANAGED_ITEM_COUNT} ready-to-use definitions.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="custom-item" data-unique="true"><span class="source-mark">U</span><span><strong>New D&D item</strong><small>Enter a private item yourself.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="custom-character"><span class="source-mark">P</span><span><strong>Character PDF</strong><small>Import D&D Beyond inventory.</small></span></button></article></div></div></section>`;
}

function renderCharacterSetup() {
  const parentId = /** @type {any} */(utilityContext).parentId || '';
  return `<section class="panel active" aria-labelledby="character-setup-title">${utilityHeader('Character setup', parentId ? `Inside ${state.entities[parentId]?.name || 'container'}` : 'Vault root')}<div class="panel-body"><p class="muted">A Character is an ordinary Container carrying the direct Character Tag.</p><div class="source-grid"><article class="source-card"><button class="source-choice" data-action="blank-character"><span class="source-mark">B</span><span><strong>Blank Character</strong><small>Create and fill inventory yourself.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="ddb-new"><span class="source-mark">P</span><span><strong>Import New from D&D Beyond PDF</strong><small>Recognized Export-to-PDF inventory only.</small></span></button></article><article class="source-card"><button class="source-choice" data-action="ddb-update"><span class="source-mark">U</span><span><strong>Update Existing from D&D Beyond PDF</strong><small>Three-way comparison protects local edits.</small></span></button></article></div></div></section>`;
}

function importPreviewRows(result, targetId = '') {
  const managed = activeEntities().filter(entity => entity.managed || entity.tags.some(id => tagName(id) === 'Managed'));
  const target = targetId ? state.entities[targetId] : null;
  const previous = new Map((target?.importState?.items || []).map(item => [item.key, item]));
  const local = new Map(childrenOf(targetId).map(item => [item.importKey || normalizedItemName(item.name), item]));
  return result.items.map(item => {
    const key = normalizedItemName(item.name);
    const exact = managed.filter(entity => normalizedItemName(entity.name) === key);
    const aliases = managed.filter(entity => (entity.aliases || []).some(alias => normalizedItemName(alias) === key));
    const template = exact.length === 1 ? exact[0] : exact.length ? null : aliases.length === 1 ? aliases[0] : null;
    let status = template ? 'Managed match' : 'Unique item';
    const prior = previous.get(key);
    const current = local.get(key);
    if (target && current && !current.importKey) status = 'Keep manual item';
    else if (target && prior && current && (current.name !== prior.name || current.quantity !== prior.quantity || current.weight !== prior.weight)) status = 'Keep local edit';
    else if (target && prior && current && (current.quantity !== item.quantity || current.weight !== item.weight)) status = 'Update';
    else if (target && current) status = 'Unchanged';
    else if (target) status = 'Add';
    return { ...item, key, template, status };
  });
}

function prepareDdbImport(result, targetId = '') {
  const rows = importPreviewRows(result, targetId);
  const now = new Date().toISOString();
  /** @type {Array<{path:string,value:unknown}>} */ const writes = [];
  let characterTag = activeEntities().find(entity => entity.tags.includes('Tag') && entity.name === 'Character');
  if (!characterTag) { const id = guid(); characterTag = { id, name: 'Character', description: 'Character is an exact, direct Tag.', tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now }; writes.push({ path: `/entities/${id}`, value: characterTag }); }
  let uniqueTag = activeEntities().find(entity => entity.tags.includes('Tag') && entity.name === 'Unique');
  if (!uniqueTag) { const id = guid(); uniqueTag = { id, name: 'Unique', description: 'Unique identifies a local item not resolved to a managed source.', tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now }; writes.push({ path: `/entities/${id}`, value: uniqueTag }); }
  const itemTag = activeEntities().find(entity => entity.tags.includes('Tag') && entity.name === 'Item');
  const createdTag = activeEntities().find(entity => entity.tags.includes('Tag') && entity.name === 'Created');
  const containerTag = activeEntities().find(entity => entity.tags.includes('Tag') && entity.name === 'Container');
  const presetTagNames = new Set(/** @type {any} */(utilityContext).presetTagNames || []);
  const presetTagIds = [...(/** @type {any} */(utilityContext).presetTagIds || []), ...activeEntities().filter(entity => entity.tags.includes('Tag') && presetTagNames.has(entity.name)).map(entity => entity.id)];
  const inventoryTags = [...new Set([itemTag?.id, createdTag?.id].filter(Boolean))];
  const characterTags = [...new Set([characterTag.id, containerTag?.id, ...inventoryTags, ...presetTagIds].filter(Boolean))];
  let target = targetId ? state.entities[targetId] : null;
  const characterId = target?.id || guid();
  if (!target) target = { id: characterId, name: result.characterName, description: 'Inventory imported locally from a recognized D&D Beyond PDF.', tags: characterTags, parentId: /** @type {any} */(utilityContext).parentId || null, container: true, quantity: 1, weight: '0', image: null, fields: {}, createdAt: now, updatedAt: now };
  const previous = new Map((target.importState?.items || []).map(item => [item.key, item]));
  const local = new Map(childrenOf(characterId).map(item => [item.importKey || normalizedItemName(item.name), item]));
  /** @type {Array<{key:string,name:string,quantity:number,weight:string,entityId:string}>} */ const snapshots = [];
  const newKeys = new Set();
  for (const row of rows) {
    newKeys.add(row.key);
    const current = local.get(row.key);
    const prior = previous.get(row.key);
    if (row.status === 'Keep manual item') continue;
    if (row.status === 'Keep local edit' && current && prior) { snapshots.push(prior); continue; }
    const id = current?.id || guid();
    const baseTags = row.template?.tags || current?.tags || [uniqueTag.id];
    const templateTags = [...new Set([...baseTags.filter(tagId => !['Managed','Character'].includes(tagName(tagId))), ...inventoryTags])];
    const entity = { ...(row.template ? structuredClone(row.template) : current ? structuredClone(current) : {}), id, name: row.name, description: row.template?.description || current?.description || 'Imported from D&D Beyond; no managed item matched this exact name.', tags: templateTags, parentId: characterId, container: Boolean(row.template?.container || current?.container), quantity: row.quantity, weight: row.template?.weight && row.weight === '0' ? row.template.weight : row.weight, image: row.template?.image || current?.image || null, managed: false, importKey: row.key, fields: structuredClone(row.template?.fields || current?.fields || {}), fieldMeta: structuredClone(row.template?.fieldMeta || current?.fieldMeta || {}), createdAt: current?.createdAt || now, updatedAt: now };
    writes.push({ path: `/entities/${id}`, value: entity });
    snapshots.push({ key: row.key, name: entity.name, quantity: entity.quantity, weight: entity.weight, entityId: id });
  }
  for (const [key, prior] of previous) {
    if (newKeys.has(key)) continue;
    const current = state.entities[prior.entityId];
    if (!current || current.deleted) continue;
    if (current.name === prior.name && current.quantity === prior.quantity && current.weight === prior.weight) writes.push({ path: `/entities/${current.id}`, value: { ...current, deleted: true, updatedAt: now } });
    else snapshots.push(prior);
  }
  const fields = { ...(target.fields || {}), 'Reported weight': result.reportedWeight, 'Carrying capacity': result.carryingCapacity };
  const fieldMeta = { ...(target.fieldMeta || {}), 'Reported weight': { min: '0', icon: '⚖' }, 'Carrying capacity': { min: '0', icon: '⚖' } };
  target = { ...target, name: result.characterName || target.name, tags: [...new Set([...(target.tags || []), ...characterTags])], container: true, fields, fieldMeta, importState: { adapter: 'dnd-beyond-pdf', profileVersion: result.profileVersion, items: snapshots }, updatedAt: now };
  writes.push({ path: `/entities/${characterId}`, value: target });
  return { characterId, characterName: target.name, writes, rows };
}

function renderDdbImport() {
  const mode = /** @type {any} */(utilityContext).mode === 'update' ? 'update' : 'new';
  const characters = activeEntities().filter(entity => entity.container && entity.tags.some(id => tagName(id) === 'Character'));
  const targetId = String(/** @type {any} */(utilityContext).targetId || characters[0]?.id || '');
  const rows = pendingImport ? importPreviewRows(pendingImport, mode === 'update' ? targetId : '') : [];
  return `<section class="panel active" aria-labelledby="ddb-import-title">${utilityHeader(mode === 'update' ? 'Update Character Inventory' : 'Import Character Inventory', 'D&D Beyond Export To PDF Only')}<div class="panel-body"><div class="import-guard"><strong>Local And Strict</strong><span>The PDF is parsed on this device, is never uploaded, and is not retained after this preview.</span></div>${mode === 'update' ? `<label>Character To Update<select data-action="import-target">${characters.map(character => `<option value="${character.id}" ${targetId === character.id ? 'selected' : ''}>${escape(character.name)}</option>`).join('')}</select></label>` : ''}<div class="file-field"><strong>Exported PDF</strong>${filePicker('ddb-file', 'application/pdf,.pdf', 'Choose PDF', String(/** @type {any} */(utilityContext).fileName || ''))}<span>Only a D&D Beyond Export-to-PDF file is accepted.</span></div><div class="import-status" aria-live="polite">${escape(String(/** @type {any} */(utilityContext).importStatus || 'Choose a PDF to create a dry-run preview.'))}</div>${pendingImport ? `<div class="import-preview"><div class="hero-copy"><span class="eyebrow">Dry-Run Preview</span><h3>${escape(pendingImport.characterName)}</h3><p>${pendingImport.items.length} carried ${pendingImport.items.length === 1 ? 'Item' : 'Items'} · Reported Weight ${escape(pendingImport.reportedWeight)} · Capacity ${escape(pendingImport.carryingCapacity)}</p></div>${pendingImport.warnings.map(warning => `<div class="notice"><strong>Review</strong><span>${escape(warning)}</span></div>`).join('')}<div class="import-table" role="table" aria-label="Inventory Import Preview"><div class="import-row import-head" role="row"><span>Name</span><span>Qty</span><span>Weight</span><span>Action</span></div>${rows.map(row => `<div class="import-row" role="row"><strong>${escape(row.name)}</strong><span>${row.quantity}</span><span>${escape(row.weight)}</span><span>${escape(row.status)}</span></div>`).join('')}</div><div class="form-actions"><button data-action="clear-import">Try Different File</button><button class="primary" data-action="apply-import" data-target="${escape(targetId)}" ${mode === 'update' && !targetId ? 'disabled' : ''}>${mode === 'update' ? 'Apply Safe Update' : 'Import Character'}</button></div></div>` : `<div class="empty-state"><strong>No PDF Loaded</strong><p>Nothing in your Vault changes until a recognized file has a complete preview and you apply it.</p></div>`}</div></section>`;
}

function renderActivity() {
  const filter = String(/** @type {any} */(utilityContext).activityFilter || 'all');
  const search = String(/** @type {any} */(utilityContext).activitySearch || '').trim().toLocaleLowerCase();
  const limit = Math.max(80, Number(/** @type {any} */(utilityContext).activityLimit || 80));
  const matching = [...state.history.events].reverse().filter(event => {
    if (filter !== 'all' && event.kind !== filter) return false;
    if (!search) return true;
    const entityNames = event.changes.map(change => /^\/entities\/([0-9a-f-]+)$/i.exec(change.path)?.[1]).filter(Boolean).map(id => state.entities[id]?.name || '').join(' ');
    return `${event.label} ${entityNames}`.toLocaleLowerCase().includes(search);
  });
  const events = matching.slice(0, limit);
  const eventEntities = event => [...new Set(event.changes.map(change => /^\/entities\/([0-9a-f-]+)$/i.exec(change.path)?.[1]).filter(id => id && state.entities[id] && !state.entities[id].deleted))].slice(0, 4).map(id => state.entities[id]);
  const activityLabel = (event, entities) => {
    let remaining = String(event.label || '').replace(/^Detatch\b/i, 'Detach');
    let html = '';
    for (const entity of [...entities].sort((a, b) => b.name.length - a.name.length)) {
      const index = remaining.toLocaleLowerCase().indexOf(entity.name.toLocaleLowerCase());
      if (index < 0) continue;
      html += escape(remaining.slice(0, index));
      html += `<button class="chip inline-chip" data-action="${entity.container ? 'open-entity' : 'edit-entity'}" data-id="${entity.id}">${imageMarkup(entity, 'chip-image')}<span class="chip-title">${escape(entity.name)}</span></button>`;
      remaining = remaining.slice(index + entity.name.length);
    }
    return html + escape(remaining);
  };
  return `<section class="panel active" aria-labelledby="activity-title">${utilityHeader('Activity', 'Local changes and retained history')}
    <div class="panel-body"><div class="activity-tools"><label>Filter<select data-action="activity-filter"><option value="all" ${filter === 'all' ? 'selected' : ''}>All changes</option><option value="action" ${filter === 'action' ? 'selected' : ''}>Actions</option><option value="undo" ${filter === 'undo' ? 'selected' : ''}>Undo</option><option value="redo" ${filter === 'redo' ? 'selected' : ''}>Redo</option></select></label><label>Find in history<input type="search" id="activity-search" data-action="activity-search" value="${escape(String(/** @type {any} */(utilityContext).activitySearch || ''))}" placeholder="Action, item, Container, or Tag"></label></div><p class="muted">${matching.length} matching of ${state.history.events.length} retained events · ${state.history.branches.length} abandoned ${state.history.branches.length === 1 ? 'branch' : 'branches'} preserved</p>${events.length ? `<ol class="activity-list">${events.map(event => { const entities = eventEntities(event); return `<li><strong>${activityLabel(event, entities)}</strong><time datetime="${event.at}">${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.at))}</time></li>`; }).join('')}</ol>${events.length < matching.length ? `<div class="form-actions"><button data-action="activity-more">Load older changes</button></div>` : ''}` : `<div class="empty-state"><strong>No matching changes</strong><p>Change the filter or search. Your retained history was not removed.</p></div>`}</div></section>`;
}

function renderProfile() {
  const confirmingRestore = Boolean(/** @type {any} */(utilityContext).confirmRestore && pendingRestore);
  const confirmingFolder = Boolean(/** @type {any} */(utilityContext).confirmFolderSwitch && pendingFolderSwitch);
  const confirmingPurge = Boolean(/** @type {any} */(utilityContext).confirmPurgeVault);
  const contactCode = createContactCode({ id: state.vault.id, name: state.vault.name });
  return `<section class="panel active" aria-labelledby="profile-title">${utilityHeader('Profile & Vault', state.vault.id)}
    <form class="panel-body" data-form="profile"><div class="hero-summary profile-summary">${imagePicker('image', state.vault, 'Change Profile Image')}<div class="hero-copy"><span class="eyebrow">Vault Identity</span><h3>${escape(state.vault.name)}</h3><p>${escape(state.vault.title)} · Saved automatically${state.vault.folderName ? ` with a folder backup in ${escape(state.vault.folderName)}.` : '.'}</p></div></div><div class="form-grid"><label>Display Name<input name="name" required maxlength="80" value="${escape(state.vault.name)}"></label><label>Vault Name<input name="vaultTitle" required maxlength="80" value="${escape(state.vault.title)}"></label></div><div class="form-actions"><button type="button" data-action="switch-vault">Switch Vault</button><button class="primary" type="submit">Save</button></div></form>
    <div class="panel-body contact-tools"><details class="contact-disclosure"><summary><span>Your Contact Code</span><code>${escape(contactCode.slice(0, 23))}…</code></summary><p>This shares only your display name and stable Vault GUID. It cannot grant access or recover your Vault.</p><div class="contact-code"><code>${escape(contactCode)}</code><button type="button" data-action="copy-contact">${icon('link')} Copy</button></div></details></div>
    <div class="panel-body backup-tools"><hr><span class="eyebrow">Backup & Recovery</span><h3>Keep Another Complete Copy</h3><p class="muted">A Vault folder or exported file contains your identity and should be kept somewhere you trust.</p><div class="backup-actions"><button type="button" data-action="connect-folder">${state.vault.folderName ? 'Reconnect Or Open Folder' : 'Add Vault Folder'}</button><button type="button" data-action="export-vault">Export Vault</button></div>${confirmingFolder ? `<div class="inline-confirm" role="alert"><strong>Switch to ${escape(pendingFolderSwitch.result.state.vault.name)}?</strong><span>The selected folder has a different Vault identity. Your current browser copy remains available from Switch Vault.</span><div><button type="button" data-action="cancel-folder-switch">Cancel</button><button class="primary" type="button" data-action="confirm-folder-switch">Switch Vault</button></div></div>` : ''}<div class="file-field"><strong>Restore Or Open An Export</strong>${filePicker('restore-file', 'application/json,.json', 'Choose Export')}<span>Sonatory validates the complete file before changing the active Vault.</span></div><div class="form-actions"><button type="button" data-action="restore-backup" ${pendingRestore ? '' : 'disabled'}>Open Validated Export</button></div>${confirmingRestore ? `<div class="inline-confirm" role="alert"><strong>Open ${escape(pendingRestore.vault.name)}?</strong><span>Its validated identity and data become active. This Vault remains available from Switch Vault.</span><div><button type="button" data-action="cancel-restore">Cancel</button><button class="primary" type="button" data-action="confirm-restore">Open Vault</button></div></div>` : ''}</div>
    <div class="panel-body vault-danger"><hr><div class="danger-zone"><div><span class="eyebrow">Danger Zone</span><h3>Purge This Vault</h3><p>Delete this Vault and everything it contains or owns.</p></div><button class="danger" type="button" data-action="request-purge-vault">Purge Vault</button></div></div>
    ${confirmingPurge ? `<div class="panel-confirm-layer" role="presentation"><form class="confirm-dialog" data-form="purge-vault" role="alertdialog" aria-modal="true" aria-labelledby="purge-vault-title" aria-describedby="purge-vault-description"><span class="eyebrow">Permanent Deletion</span><h3 id="purge-vault-title">Purge ${escape(state.vault.title)}?</h3><p id="purge-vault-description">This removes the Vault from this browser${state.vault.folderName ? ` and deletes its Sonatory files from ${escape(state.vault.folderName)}` : ''}, including every Item, Container, Tag, Collection, Group, friend, and Activity entry. It cannot be undone.</p><label>Type <strong>${escape(state.vault.title)}</strong> to confirm<input name="confirmation" required autocomplete="off" data-action="purge-vault-confirmation" autofocus></label><div class="form-actions destructive-confirm"><button class="danger" type="submit" data-purge-vault-submit disabled>Purge Vault</button><button type="button" data-action="cancel-purge-vault">Cancel</button></div></form></div>` : ''}</section>`;
}

function renderMobileMenu() {
  return `<section class="panel active" aria-labelledby="more-title">${utilityHeader('More', 'Navigation and Vault controls')}
    <nav class="panel-body menu-list" aria-label="More navigation">
      <button data-action="search">${icon('search')}<span><strong>Search</strong><small>Find anything in this Vault</small></span></button>
      <button data-action="groups">${icon('users')}<span><strong>Groups & Friends</strong><small>Members, invitations, and collaboration</small></span></button>
      <button data-action="activity">${icon('activity')}<span><strong>Activity</strong><small>Durable changes, Undo, and recovery</small></span></button>
      <button data-action="settings">${icon('settings')}<span><strong>Settings</strong><small>Density, theme, hue, and motion</small></span></button>
      <button data-action="profile"><span class="avatar">${avatarMarkup()}</span><span><strong>Profile & Vault</strong><small>${escape(state.vault.name)} · ${escape(backingStatus())}</small></span></button>
    </nav></section>`;
}

function renderTagPicker(tags, selectedTagIds, label) {
  return `<details class="tag-picker"><summary>${escape(label)} · ${selectedTagIds.size} selected</summary><div class="tag-picker-filter"><label class="search-box"><span class="visually-hidden">Find Tags by name or metadata</span><input type="search" data-action="tag-choice-filter" placeholder="Find Tags or type +MetadataTag" autocomplete="off" spellcheck="false"></label><small data-tag-choice-count>${tags.length} available</small></div><div class="tag-options">${tags.map(tag => `<label class="chip" data-tag-choice="${tag.id}">${imageMarkup(tag, 'chip-image')}<input type="checkbox" name="tags" value="${tag.id}" ${selectedTagIds.has(tag.id) ? 'checked' : ''}><span class="chip-title">${escape(tag.name)}</span></label>`).join('')}<p class="tag-choice-empty" data-tag-choice-empty hidden>No matching Tags.</p></div></details>`;
}

function renderEditor() {
  const context = /** @type {{id?:string,parentId?:string,kind?:string,presetTagName?:string,presetTagNames?:string[],presetTagIds?:string[]}} */(utilityContext);
  const existing = context.id ? state.entities[context.id] : null;
  const isCreate = !existing;
  const isTag = context.kind === 'tag' || Boolean(existing?.tags.includes('Tag'));
  const initialContainer = context.kind === 'container' || existing?.container || false;
  const parentId = context.parentId ?? existing?.parentId ?? '';
  const tags = activeEntities().filter(entity => entity.tags.includes('Tag') && entity.name !== 'Tag' && entity.id !== existing?.id).sort((a, b) => a.name.localeCompare(b.name));
  const presetNames = new Set([...(context.presetTagNames || []), ...(context.presetTagName ? [context.presetTagName] : [])]);
  const selectedTagIds = new Set(tags.filter(tag => existing?.tags.includes(tag.id) || presetNames.has(tag.name) || context.presetTagIds?.includes(tag.id)).map(tag => tag.id));
  if (initialContainer) {
    const containerTag = tags.find(tag => tag.name === 'Container');
    if (containerTag) selectedTagIds.add(containerTag.id);
  }
  const containers = activeEntities().filter(entity => entity.container && !entity.managed && entity.id !== existing?.id && canMove(state, existing?.id || '__new__', entity.id).ok).sort((a, b) => a.name.localeCompare(b.name));
  const managedBase = existing && typeof existing.managed === 'object' ? managedBaseEntity(state, existing.id) : null;
  const showManagedCompare = Boolean(/** @type {any} */(utilityContext).showManagedCompare);
  const directChildren = existing ? childrenOf(existing.id).length : 0;
  const confirmingDelete = Boolean(existing && /** @type {any} */(utilityContext).confirmDelete);
  if (isTag) {
    const directUses = existing ? activeEntities().filter(entity => entity.id !== existing.id && entity.tags.includes(existing.id)).length : 0;
    const confirmingPurge = Boolean(existing && /** @type {any} */(utilityContext).confirmPurge);
    return `<section class="panel active" aria-labelledby="editor-title">${utilityHeader(isCreate ? 'Create Tag' : 'Tag Settings', 'Reusable label and metadata')}
      <form class="panel-body editor-form" data-form="entity-editor"><input type="hidden" name="entityMode" value="tag"><div class="form-grid"><div class="editor-identity-row full">${imagePicker('image', existing, existing?.image ? 'Change Tag image' : 'Add Tag image')}<label>Name<input name="name" required maxlength="120" value="${escape(existing?.name || '')}" autofocus><span>Optional image appears beside the Tag wherever it is shown.</span></label></div><label class="full">Description<textarea name="description" maxlength="1000">${escape(existing?.description || '')}</textarea></label><fieldset class="settings-group full"><legend>Metadata Tags</legend><p class="muted">Use other Tags to describe or organize this Tag.</p><div class="selected-tag-summary">${selectedTagIds.size ? tags.filter(tag => selectedTagIds.has(tag.id)).map(tag => `<span class="chip">${imageMarkup(tag, 'chip-image')}<span class="chip-title">${escape(tag.name)}</span></span>`).join('') : '<span class="muted">No metadata Tags selected.</span>'}</div>${renderTagPicker(tags, selectedTagIds, 'Choose Metadata Tags')}</fieldset></div>
      ${existing ? `<div class="source-provenance"><strong>${directUses} ${directUses === 1 ? 'use' : 'uses'}</strong><p>Delete hides the Tag from new choices without changing anything already tagged. Undo restores it.</p></div>` : ''}
      ${confirmingDelete ? `<div class="inline-confirm" role="alert"><strong>Delete ${escape(existing.name)}?</strong><span>${directUses ? `${directUses} tagged ${directUses === 1 ? 'thing keeps' : 'things keep'} the hidden Tag.` : 'Nothing visible currently uses it.'} Undo restores the Tag.</span><div><button type="button" data-action="cancel-delete">Cancel</button><button class="danger" type="button" data-action="delete-entity" data-id="${existing.id}">Yes, delete</button></div></div>` : ''}
      <div class="editor-actions"><div class="destructive-actions">${existing ? `<button class="danger purge-button" type="button" data-action="request-purge-tag" data-id="${existing.id}">Purge</button><button class="danger" type="button" data-action="request-delete-entity" data-id="${existing.id}">Delete</button>` : ''}</div><div class="form-actions"><button type="button" data-action="${utilityDismissAction()}">Cancel</button><button class="primary" type="submit">${isCreate ? 'Create' : 'Save'}</button></div></div></form>${confirmingPurge ? `<div class="panel-confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="purge-title"><div class="confirm-dialog"><span class="eyebrow">Permanent Cleanup</span><h3 id="purge-title">Purge ${escape(existing.name)}?</h3><p>This deletes the Tag and ${directUses} ${directUses === 1 ? 'thing' : 'things'} currently using it. Deleted Containers also hide everything inside them. Undo restores the full change.</p><div class="form-actions destructive-confirm"><button class="danger" data-action="purge-tag" data-id="${existing.id}">Purge ${directUses + 1}</button><button data-action="cancel-purge-tag">Cancel</button></div></div></div>` : ''}</section>`;
  }
  return `<section class="panel active" aria-labelledby="editor-title">${utilityHeader(isCreate ? 'Create' : 'Item Settings', parentId ? `Inside ${state.entities[parentId]?.name || 'container'}` : 'Vault root')}
    <form class="panel-body" data-form="entity-editor">
      ${managedBase && existing.managed.override ? `<div class="managed-editor"><div><span class="eyebrow">Managed · SRD ${escape(existing.managed.version)}</span><strong>Local override active</strong><p>Your local choices win until you reset. Detaching makes this an ordinary independent item.</p></div><div class="managed-actions"><button type="button" data-action="managed-compare" data-id="${existing.id}">${showManagedCompare ? 'Hide comparison' : 'Compare'}</button><button type="button" data-action="managed-reset" data-id="${existing.id}">Reset</button><button type="button" data-action="managed-detach" data-id="${existing.id}">Detach</button></div>${showManagedCompare ? `<div class="managed-compare"><div><span>Field</span><strong>Local</strong><strong>Source</strong></div>${[['Name',existing.name,managedBase.name],['Description',existing.description,managedBase.description],['Weight',existing.weight,managedBase.weight]].map(([label, local, base]) => `<div class="${local === base ? '' : 'changed'}"><span>${escape(label)}</span><span>${escape(local)}</span><span>${escape(base)}</span></div>`).join('')}</div>` : ''}</div>` : ''}
      <div class="form-grid">
        <div class="editor-identity-row full">${imagePicker('image', existing, existing?.image ? 'Change image' : 'Add image')}<label>Name<input name="name" required maxlength="120" value="${escape(existing?.name || '')}" autofocus></label></div>
        <label class="full">Description<textarea name="description" maxlength="1000">${escape(existing?.description || '')}</textarea></label>
        <input type="hidden" name="kind" value="${initialContainer ? 'container' : 'item'}">
        <div class="compact-number-fields"><label>Quantity<input name="quantity" type="number" min="1" step="1" required value="${existing?.quantity || 1}"></label><label>Weight<input name="weight" inputmode="decimal" maxlength="4096" required value="${escape(existing?.weight || '0')}"></label></div>
        <label>Parent container<select name="parentId"><option value="">None</option>${containers.map(container => `<option value="${container.id}" ${parentId === container.id ? 'selected' : ''}>${escape(container.name)}</option>`).join('')}</select>${existing?.container ? '<span>Its descendants are omitted because recursive containers are not allowed.</span>' : ''}</label>
        <fieldset class="settings-group full numerical-fields"><legend>Numerical fields</legend><p class="muted">Optional exact numbers such as Value, Charges, or Capacity. Units are implied by your context.</p><div data-field-rows>${Object.entries(existing?.fields || {}).map(([name, value]) => renderNumericalField(name, value, existing?.fieldMeta?.[name])).join('')}</div><button type="button" data-action="add-field">${icon('plus')} New</button></fieldset>
        <fieldset class="settings-group full"><legend>Tags</legend><div class="selected-tag-summary">${selectedTagIds.size ? tags.filter(tag => selectedTagIds.has(tag.id)).map(tag => `<span class="chip">${imageMarkup(tag, 'chip-image')}<span class="chip-title">${escape(tag.name)}</span></span>`).join('') : '<span class="muted">No Tags selected.</span>'}</div>${renderTagPicker(tags, selectedTagIds, 'Choose Tags')}</fieldset>
      </div>
      ${confirmingDelete ? `<div class="inline-confirm" role="alert"><strong>Delete ${escape(existing.name)}?</strong><span>${directChildren ? `Its ${directChildren} direct ${directChildren === 1 ? 'entry becomes' : 'entries become'} hidden with it.` : 'The item becomes hidden.'} Undo restores the complete state.</span><div><button type="button" data-action="cancel-delete">Cancel</button><button class="danger" type="button" data-action="delete-entity" data-id="${existing.id}">Yes, delete</button></div></div>` : ''}
      <div class="editor-actions"><div class="destructive-actions">${existing ? `<button class="danger" type="button" data-action="request-delete-entity" data-id="${existing.id}">Delete</button>` : ''}</div><div class="form-actions"><button type="button" data-action="${utilityDismissAction()}">Cancel</button><button class="primary" type="submit">${isCreate ? 'Create' : 'Save'}</button></div></div>
    </form></section>`;
}

function renderNumericalField(name = '', value = '', meta = {}) {
  const iconImage = meta.iconImage || '';
  return `<div class="field-row"><label>Field Name<input name="fieldName" maxlength="60" value="${escape(name)}" placeholder="Value"></label><label>Number<input name="fieldValue" inputmode="decimal" maxlength="4096" value="${escape(value)}" placeholder="0"></label><label class="field-symbol-label">Icon<input name="fieldIcon" maxlength="4" value="${escape(meta.icon || '')}" placeholder="#" aria-label="Unicode icon"></label><label class="field-icon-picker" title="Choose an image icon"><span class="field-icon-preview">${iconImage ? `<img src="${escape(iconImage)}" alt="">` : icon('image')}</span><input class="visually-hidden" type="file" data-action="field-icon-image" accept="image/*"><input type="hidden" name="fieldIconImage" value="${escape(iconImage)}"><span class="visually-hidden">Choose an image icon</span></label><button class="icon-button" type="button" data-action="remove-field" aria-label="Remove numerical field">${icon('close')}</button><details class="field-constraints"><summary>Precision & Bounds</summary><div><label>Decimal Places<input name="fieldPrecision" type="number" min="0" max="12" step="1" value="${meta.precision ?? ''}" placeholder="Auto"></label><label>Minimum<input name="fieldMin" inputmode="decimal" maxlength="4096" value="${escape(meta.min || '')}" placeholder="None"></label><label>Maximum<input name="fieldMax" inputmode="decimal" maxlength="4096" value="${escape(meta.max || '')}" placeholder="None"></label></div></details></div>`;
}

function setupCarousels() {
  document.querySelectorAll('.carousel-track').forEach(track => {
    track.addEventListener('wheel', event => {
      if (!(event instanceof WheelEvent) || !(track instanceof HTMLElement)) return;
      const overCard = event.target instanceof Element && Boolean(event.target.closest('.container-card'));
      if (overCard) carouselWheelGrace.set(track, performance.now() + 180);
      else if ((carouselWheelGrace.get(track) || 0) < performance.now()) return;
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const atStart = track.scrollLeft <= 1;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd) || track.scrollWidth <= track.clientWidth) return;
      event.preventDefault();
      track.scrollLeft += delta;
    }, { passive: false });
    track.addEventListener('keydown', event => {
      if (!(event instanceof KeyboardEvent) || !(track instanceof HTMLElement)) return;
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const cards = [...track.querySelectorAll('.container-card')];
      if (!cards.length) return;
      if (event.key === 'Home') cards[0].scrollIntoView({ inline: 'center', block: 'nearest' });
      else if (event.key === 'End') cards.at(-1)?.scrollIntoView({ inline: 'center', block: 'nearest' });
      else {
        const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
        track.scrollBy({ left: (event.key === 'ArrowLeft' ? -1 : 1) * (cards[0].getBoundingClientRect().width + gap), behavior: effectiveReducedMotion() ? 'auto' : 'smooth' });
      }
    });
  });
}

function effectiveReducedMotion() {
  return state?.settings.motion === 'reduced' || (state?.settings.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function openEntity(id) {
  const entity = state?.entities[id];
  if (!state || !entity) return;
  revertUtilityPreview();
  if (!entity.container) { openUtility('editor', { id }); return; }
  if (!state.recentTabs.includes(id)) state.recentTabs.push(id);
  activePanel = id;
  utility = '';
  utilityStack = [];
  view = 'panels';
  persist();
  renderShell();
}

function openUtility(name, context = {}) {
  const focused = document.activeElement;
  if (!utility) { utilityReturnView = view; utilityReturnPanel = activePanel; utilityStack = []; }
  if (!utility || focused instanceof Element && focused.closest('.app-header')) {
    utilityReturnFocus = focused instanceof HTMLElement ? {
      id: focused.id,
      action: focused.dataset.action || '',
      dataId: focused.dataset.id || '',
      ariaLabel: focused.getAttribute('aria-label') || ''
    } : null;
  }
  if (utility && utility !== name) utilityStack.push({ name: utility, context: structuredClone(utilityContext) });
  utility = name;
  utilityContext = name === 'settings' ? { ...context, originalSettings: structuredClone(state.settings) } : context;
  pendingImage = null;
  pendingRestore = null;
  pendingFolderSwitch = null;
  if (name !== 'ddb-import') { pendingImport = null; importWorker?.terminate(); importWorker = null; }
  if (!popupLayerOpen()) view = 'panels';
  renderShell();
  requestAnimationFrame(() => {
    const panel = document.querySelector('.panel.active');
    const target = panel?.querySelector('input:not(.visually-hidden):not([type="hidden"]), textarea, select, button:not([data-action="close-utility"]):not([data-action="utility-back"])') || panel?.querySelector('button');
    if (target instanceof HTMLElement) target.focus();
  });
}

function toggleUtility(name, context = {}) {
  if (utility === name && !utilityStack.length) { closeUtility(); return; }
  const hadUtility = Boolean(utility);
  const returnView = utilityReturnView;
  const returnPanel = utilityReturnPanel;
  revertUtilityPreview();
  utility = '';
  utilityContext = {};
  utilityStack = [];
  openUtility(name, context);
  if (hadUtility) { utilityReturnView = returnView; utilityReturnPanel = returnPanel; }
}

function utilityBack() {
  const previous = utilityStack.pop();
  if (!previous) { closeUtility(); return; }
  utility = previous.name;
  utilityContext = previous.context;
  pendingImage = null;
  pendingRestore = null;
  pendingFolderSwitch = null;
  if (utility !== 'ddb-import') { pendingImport = null; importWorker?.terminate(); importWorker = null; }
  renderShell();
  requestAnimationFrame(() => document.querySelector('.panel.active [data-action="group-more"], .panel.active input, .panel.active button')?.focus());
}

function closeUtility() {
  const returnFocus = utilityReturnFocus;
  revertUtilityPreview();
  utility = '';
  utilityContext = {};
  utilityStack = [];
  pendingImage = null;
  pendingRestore = null;
  pendingFolderSwitch = null;
  pendingImport = null;
  importWorker?.terminate(); importWorker = null;
  view = utilityReturnView === 'panels' && !state.recentTabs.length ? 'home' : utilityReturnView;
  if (utilityReturnPanel && state.entities[utilityReturnPanel] && isEntityVisible(state, utilityReturnPanel)) activePanel = utilityReturnPanel;
  renderShell();
  utilityReturnFocus = null;
  requestAnimationFrame(() => {
    let target = returnFocus?.id ? document.getElementById(returnFocus.id) : null;
    if (!target && returnFocus?.action) target = [...document.querySelectorAll(`[data-action="${returnFocus.action}"]`)].find(candidate => !returnFocus.dataId || candidate instanceof HTMLElement && candidate.dataset.id === returnFocus.dataId) || null;
    if (!target && returnFocus?.ariaLabel) target = [...document.querySelectorAll('[aria-label]')].find(candidate => candidate.getAttribute('aria-label') === returnFocus.ariaLabel) || null;
    if (target instanceof HTMLElement) target.focus();
  });
}

function revertUtilityPreview() {
  const settingsEntry = utility === 'settings' ? { context: utilityContext } : [...utilityStack].reverse().find(entry => entry.name === 'settings');
  const original = /** @type {any} */(settingsEntry?.context)?.originalSettings;
  if (original && state) {
    state.settings = structuredClone(original);
    applyPreferences();
  }
}

function makeEntity(form) {
  const data = new FormData(form);
  const context = /** @type {{id?:string,parentId?:string}} */(utilityContext);
  const existing = context.id ? state.entities[context.id] : null;
  const id = existing?.id || guid();
  const now = new Date().toISOString();
  if (data.get('entityMode') === 'tag') return {
    ...(existing || {}), id, name: String(data.get('name') || '').trim(), description: String(data.get('description') || '').trim(),
    tags: ['Tag', ...data.getAll('tags').map(String).filter(tagId => tagId !== id)], parentId: null, container: false, quantity: 1, weight: '0',
    image: pendingImage ?? existing?.image ?? null, fields: {}, fieldMeta: {}, managed: false,
    createdAt: existing?.createdAt || now, updatedAt: now
  };
  const quantity = Number(data.get('quantity'));
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be a whole number of at least 1.');
  const weight = decimalToString(parseDecimal(String(data.get('weight') || '0')));
  if (weight.startsWith('-')) throw new Error('Weight cannot be negative.');
  const parentId = String(data.get('parentId') || '') || null;
  if (existing?.container && data.get('kind') !== 'container' && childrenOf(existing.id).length) throw new Error('Move or delete this Container’s contents before changing it into an item.');
  const move = canMove(state, id, parentId);
  if (!move.ok) throw new Error(move.reason);
  const fieldNames = data.getAll('fieldName').map(value => String(value).trim());
  const fieldValues = data.getAll('fieldValue').map(value => String(value).trim());
  const fieldPrecisions = data.getAll('fieldPrecision').map(value => String(value).trim());
  const fieldMins = data.getAll('fieldMin').map(value => String(value).trim());
  const fieldMaxes = data.getAll('fieldMax').map(value => String(value).trim());
  const fieldIcons = data.getAll('fieldIcon').map(value => String(value).trim());
  const fieldIconImages = data.getAll('fieldIconImage').map(value => String(value).trim());
  /** @type {Record<string,string>} */ const fields = {};
  /** @type {Record<string,import('./core.js').NumericFieldMeta>} */ const fieldMeta = {};
  const normalizedNames = new Set();
  for (let index = 0; index < Math.max(fieldNames.length, fieldValues.length); index += 1) {
    const name = fieldNames[index] || '';
    const value = fieldValues[index] || '';
    if (!name && !value) continue;
    if (!name || !value) throw new Error('Every numerical field needs both a name and a number.');
    const normalized = name.toLocaleLowerCase();
    if (normalizedNames.has(normalized)) throw new Error(`Numerical field names must be unique: ${name}.`);
    normalizedNames.add(normalized);
    const parsedValue = parseDecimal(value);
    fields[name] = decimalToString(parsedValue);
    const precisionText = fieldPrecisions[index] || '';
    const minText = fieldMins[index] || '';
    const maxText = fieldMaxes[index] || '';
    const iconText = fieldIcons[index] || '';
    const iconImage = fieldIconImages[index] || '';
    /** @type {import('./core.js').NumericFieldMeta} */ const meta = {};
    if (iconText) meta.icon = iconText;
    if (iconImage) meta.iconImage = iconImage;
    if (precisionText) {
      const precision = Number(precisionText);
      if (!Number.isSafeInteger(precision) || precision < 0 || precision > 12) throw new Error(`${name} precision must be a whole number from 0 to 12.`);
      if (parsedValue.scale > precision) throw new Error(`${name} has more than ${precision} decimal places.`);
      meta.precision = precision;
    }
    const minimum = minText ? parseDecimal(minText) : null;
    const maximum = maxText ? parseDecimal(maxText) : null;
    if (minimum) meta.min = decimalToString(minimum);
    if (maximum) meta.max = decimalToString(maximum);
    if (minimum && maximum && compareDecimal(minimum, maximum) > 0) throw new Error(`${name} minimum cannot exceed its maximum.`);
    if (minimum && compareDecimal(parsedValue, minimum) < 0) throw new Error(`${name} must be at least ${meta.min}.`);
    if (maximum && compareDecimal(parsedValue, maximum) > 0) throw new Error(`${name} must be at most ${meta.max}.`);
    if (Object.keys(meta).length) fieldMeta[name] = meta;
  }
  const isContainer = data.get('kind') === 'container';
  const autoTagNames = typeof existing?.managed === 'object' && !existing.managed.detached ? ['Item'] : ['Item', 'Created'];
  if (isContainer) autoTagNames.push('Container');
  const entity = {
    ...(existing || {}), id, name: String(data.get('name') || '').trim(), description: String(data.get('description') || '').trim(),
    tags: [...new Set([...data.getAll('tags').map(String), ...activeEntities().filter(entity => entity.tags.includes('Tag') && autoTagNames.includes(entity.name)).map(entity => entity.id)])], parentId, container: isContainer, quantity, weight,
    image: pendingImage ?? existing?.image ?? null, fields, fieldMeta,
    managed: existing?.managed,
    createdAt: existing?.createdAt || now, updatedAt: now
  };
  if (typeof existing?.managed === 'object') {
    const base = managedBaseEntity(state, id);
    const comparable = value => JSON.stringify({ name: value?.name, description: value?.description, tags: [...(value?.tags || [])].sort(), parentId: value?.parentId, container: value?.container, quantity: value?.quantity, weight: value?.weight, image: value?.image, fields: value?.fields || {}, fieldMeta: value?.fieldMeta || {} });
    entity.managed = { ...existing.managed, override: !base || comparable(entity) !== comparable(base) };
  }
  return entity;
}

async function handleSubmit(form) {
  try {
    if (form.dataset.form === 'onboarding') {
      const data = new FormData(form);
      state = createState(String(data.get('vaultName') || 'My adventures'), String(data.get('displayName') || ''), { density: /** @type {any} */(data.get('density') || 'normal') });
      state.vault.image = pendingImage;
      const folderBackup = data.get('folderBackup') === 'folder';
      let openedExistingFolder = false;
      if (folderBackup) {
        const result = await chooseVaultFolder(state);
        openedExistingFolder = result.existing && result.state.vault.id !== state.vault.id;
        state = result.state;
      }
      await saveDeviceSettings(state.settings);
      await saveState(state);
      activePanel = '';
      view = 'home';
      utility = '';
      utilityContext = {};
      utilityStack = [];
      utilityReturnView = 'home';
      utilityReturnPanel = '';
      window.scrollTo(0, 0);
      pendingImage = null;
      renderShell();
      queueAutomaticCloudSync();
      announce(openedExistingFolder ? 'Existing Vault opened from its folder.' : state.vault.folderName ? 'Vault created with automatic saving and a folder backup.' : 'Vault created. Changes save automatically.');
    }
    if (!state) return;
    if (form.dataset.form === 'purge-vault') {
      const expected = state.vault.title;
      if (String(new FormData(form).get('confirmation') || '') !== expected) throw new Error(`Type ${expected} exactly to purge this Vault.`);
      await cloudQueue.catch(() => {});
      const replica = activeCloudReplica();
      let cloudWarning = '';
      if (replica) {
        try { await replica.purge(); }
        catch (error) { cloudWarning = `The hosted copy could not be cleaned up: ${error instanceof Error ? error.message : 'relay unavailable'}`; }
      } else cloudWarning = 'The hosted copy could not be reached.';
      const { folderWarning } = await purgeVault(state);
      state = null;
      cloudReplica = null; cloudStatus = 'Automatic';
      utility = ''; utilityContext = {}; utilityStack = []; activePanel = ''; view = 'home';
      pendingImage = null; pendingRestore = null; pendingFolderSwitch = null;
      await renderOnboarding();
      announce([`${expected} was purged from this browser.`, cloudWarning, folderWarning].filter(Boolean).join(' '));
      return;
    }
    if (form.dataset.form === 'entity-editor') {
      const entity = makeEntity(form);
      const exists = Boolean(state.entities[entity.id]);
      commit(state, exists ? `Edit ${entity.name}` : `Create ${entity.name}`, [{ path: `/entities/${entity.id}`, value: entity }]);
      utility = '';
      utilityStack = [];
      if (entity.container) openEntity(entity.id); else { await persist(`${entity.name} saved locally.`); renderShell(); }
    }
    if (form.dataset.form === 'settings') {
      const data = new FormData(form);
      const next = { ...state.settings, theme: String(data.get('theme')), hue: Number(data.get('hue')), motion: /** @type {any} */(data.get('motion')) };
      const original = /** @type {any} */(utilityContext).originalSettings;
      state.settings = next;
      await saveDeviceSettings(next);
      announce('Appearance saved on this device.');
      utility = '';
      utilityStack = [];
      view = utilityReturnView;
      renderShell();
    }
    if (form.dataset.form === 'profile') {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const vaultTitle = String(data.get('vaultTitle') || '').trim();
      if (!name) throw new Error('Display name is required.');
      if (!vaultTitle) throw new Error('Vault name is required.');
      const groups = /** @type {Array<any>} */(state.groups).map(group => ({ ...group, members: (group.members || []).map(member => (member.vaultGuid || member.id) === state.vault.id ? { ...member, name } : member) }));
      const writes = [{ path: '/vault/name', value: name }, { path: '/vault/title', value: vaultTitle }, { path: '/groups', value: groups }];
      if (pendingImage !== null) writes.push({ path: '/vault/image', value: pendingImage });
      commit(state, 'Update profile', writes);
      await persist('Profile saved locally.');
      utility = '';
      utilityStack = [];
      view = utilityReturnView;
      renderShell();
    }
    if (form.dataset.form === 'group-editor') {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      if (!name) throw new Error('Group name is required.');
      if (/** @type {Array<any>} */(state.groups).some(group => group.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) throw new Error('A Group with that name already exists in this Vault.');
      const group = { id: guid(), name, members: [{ vaultGuid: state.vault.id, name: state.vault.name, role: 'Owner' }], createdAt: new Date().toISOString(), sync: { enabled: false, status: 'Local only' } };
      commit(state, `Create Group ${name}`, [{ path: '/groups', value: [...state.groups, group] }]);
      utility = 'groups'; utilityContext = { selectedGroupId: group.id };
      utilityStack = [];
      await persist(`${name} created. No Party container was added.`); renderShell();
    }
    if (form.dataset.form === 'source-editor') {
      const data = new FormData(form);
      const existing = state.itemSources.find(source => source.id === /** @type {any} */(utilityContext).sourceId);
      const source = { id: existing?.id || guid(), name: String(data.get('name') || '').trim(), description: String(data.get('description') || '').trim(), behavior: String(data.get('behavior') || ''), query: String(data.get('query') || '').trim(), queryBindings: existing?.queryBindings || [], presetTagNames: existing?.presetTagNames || [], image: pendingImage ?? existing?.image ?? null, enabled: data.get('enabled') === 'on', managed: existing?.managed || false };
      if (!source.name) throw new Error('Source name is required.');
      if (!['create-item','create-container','create-character','custom-create','browse-query','dnd-tools','ddb-import'].includes(source.behavior)) throw new Error('Choose a supported source behavior.');
      if (source.behavior === 'browse-query' && !source.query) throw new Error('Browse behavior needs a query.');
      const parsedSourceQuery = parseQuery(source.query);
      const selectedSourceBindings = [...(/** @type {any} */(utilityContext).queryBindings || existing?.queryBindings || [])]
        .filter(binding => parsedSourceQuery[binding.operator]?.some(value => value.localeCompare(binding.displayName, undefined, { sensitivity: 'accent' }) === 0));
      source.queryBindings = [...selectedSourceBindings, ...resolveQueryBindings(state, source.query).filter(binding => !selectedSourceBindings.some(selected => selected.operator === binding.operator && selected.displayName === binding.displayName))];
      const next = existing ? state.itemSources.map(item => item.id === source.id ? source : item) : [...state.itemSources, source];
      commit(state, `${existing ? 'Edit' : 'Create'} item source ${source.name}`, [{ path: '/itemSources', value: next }]);
      utility = 'sources'; utilityContext = { parentId: /** @type {any} */(utilityContext).parentId || '' };
      await persist(`${source.name} source saved.`); renderShell();
    }
    if (form.dataset.form === 'collection-editor') {
      const data = new FormData(form);
      const existing = state.collections.find(collection => collection.id === /** @type {any} */(utilityContext).collectionId);
      const name = String(data.get('name') || '').trim();
      const description = String(data.get('description') || '').trim();
      const query = String(data.get('query') || '').trim();
      const createAction = String(data.get('createAction') || 'custom');
      if (!name) throw new Error('Collection name is required.');
      if (!['custom','item','container','character','tag','sources'].includes(createAction)) throw new Error('Choose a supported creation panel.');
      const parsed = parseQuery(query);
      const selectedBindings = [...(/** @type {any} */(utilityContext).queryBindings || existing?.queryBindings || [])]
        .filter(binding => parsed[binding.operator]?.some(value => value.localeCompare(binding.displayName, undefined, { sensitivity: 'accent' }) === 0));
      const inferredBindings = resolveQueryBindings(state, query);
      const queryBindings = [...selectedBindings, ...inferredBindings.filter(binding => !selectedBindings.some(selected => selected.operator === binding.operator && selected.displayName === binding.displayName))];
      const collection = { id: existing?.id || guid(), name, description, query, queryBindings, createAction };
      const next = existing ? state.collections.map(item => item.id === existing.id ? collection : item) : [...state.collections, collection];
      commit(state, `${existing ? 'Edit' : 'Create'} Collection ${name}`, [{ path: '/collections', value: next }]);
      utility = ''; utilityContext = {}; view = 'home';
      utilityStack = [];
      await persist(`${name} Collection saved. Undo is available.`); renderShell();
    }
    if (form.dataset.form === 'add-friend') {
      const contact = parseContactCode(String(new FormData(form).get('contact') || ''));
      if (contact.vaultGuid === state.vault.id) throw new Error('That is this Vault’s own contact code. Share it with someone else.');
      if (state.friends.some(friend => friend.vaultGuid === contact.vaultGuid)) throw new Error(`${contact.name} is already saved as a friend.`);
      commit(state, `Add friend ${contact.name}`, [{ path: '/friends', value: [...state.friends, contact] }]);
      utility = 'groups'; utilityContext = { selectedMemberId: contact.vaultGuid };
      await persist(`${contact.name} added as a friend. No permissions were granted.`); renderShell();
    }
    if (form.dataset.form === 'join-group') throw new Error('That invite cannot be verified until the encrypted relay stage is enabled. Your Vault was not changed.');
  } catch (error) {
    announce(error instanceof Error ? error.message : 'The action could not be completed.');
    const first = form.querySelector(':invalid');
    if (first instanceof HTMLElement) first.focus();
    else showNotice(error instanceof Error ? error.message : 'The action could not be completed.', true);
  }
}

app.addEventListener('submit', event => {
  if (!(event.target instanceof HTMLFormElement)) return;
  event.preventDefault();
  queueUiAction(() => handleSubmit(event.target));
});

app.addEventListener('input', async event => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.dataset.action === 'search-input') {
    searchValue = target.value;
    pruneSearchBindings();
    const highlight = target.parentElement?.querySelector('.query-highlight');
    if (highlight) highlight.innerHTML = renderQueryHighlight(searchValue);
    const assist = document.querySelector('#search-assist');
    if (assist) assist.innerHTML = renderSearchAssist();
    const results = document.querySelector('#search-results');
    if (results) results.innerHTML = renderSearchResults(searchValue ? searchEntities(state, searchValue, searchBindings).slice(0, 40) : []);
  }
  if (target.dataset.action === 'collection-query') {
    const query = target.value;
    utilityContext = { ...utilityContext, queryDraft: query };
    const highlight = target.parentElement?.querySelector('.query-highlight');
    if (highlight) highlight.innerHTML = renderQueryHighlight(query);
    const assist = document.querySelector('#collection-query-assist');
    if (assist) assist.innerHTML = renderQueryAssist(query, 'collection');
    const count = document.querySelector('#collection-match-count');
    if (count) count.textContent = String(searchEntities(state, query, /** @type {any} */(utilityContext).queryBindings || []).length);
    target.setAttribute('aria-expanded', String(Boolean(activeQueryOperand(query))));
  }
  if (target.dataset.action === 'tag-choice-filter') {
    const picker = target.closest('.tag-picker');
    const query = target.value.trim();
    const matching = query ? new Set(searchEntities(state, query).filter(entity => entity.tags.includes('Tag')).map(entity => entity.id)) : null;
    let visible = 0;
    picker?.querySelectorAll('[data-tag-choice]').forEach(option => {
      const show = !matching || matching.has(option.getAttribute('data-tag-choice') || '');
      option.toggleAttribute('hidden', !show);
      if (show) visible += 1;
    });
    const count = picker?.querySelector('[data-tag-choice-count]');
    if (count) count.textContent = `${visible} matching`;
    picker?.querySelector('[data-tag-choice-empty]')?.toggleAttribute('hidden', visible !== 0);
  }
  if (target.dataset.action === 'tag-filter') {
    utilityContext = { ...utilityContext, tagFilter: target.value };
    const panel = target.closest('.panel');
    const next = document.createRange().createContextualFragment(renderTagManager()).firstElementChild;
    if (panel && next) panel.replaceWith(next);
    requestAnimationFrame(() => {
      const input = document.querySelector('[data-action="tag-filter"]');
      if (input instanceof HTMLInputElement) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }
  if (target.dataset.action === 'container-link-filter') {
    utilityContext = { ...utilityContext, containerLinkFilter: target.value };
    const panel = target.closest('.panel');
    const next = document.createRange().createContextualFragment(renderContainerLinks()).firstElementChild;
    if (panel && next) panel.replaceWith(next);
    requestAnimationFrame(() => {
      const input = document.querySelector('[data-action="container-link-filter"]');
      if (input instanceof HTMLInputElement) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }
  if (target.dataset.action === 'source-filter') {
    utilityContext = { ...utilityContext, sourceFilter: target.value };
    const panel = target.closest('.panel');
    if (panel) {
      const next = document.createRange().createContextualFragment(renderSourceBrowser());
      const replacement = next.firstElementChild;
      if (replacement) {
        panel.replaceWith(replacement);
        const input = document.querySelector('[data-action="source-filter"]');
        if (input instanceof HTMLInputElement) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      }
    }
  }
  if (target.dataset.action === 'activity-filter' || target.dataset.action === 'activity-search') {
    utilityContext = { ...utilityContext, activityFilter: target.dataset.action === 'activity-filter' ? target.value : /** @type {any} */(utilityContext).activityFilter || 'all', activitySearch: target.dataset.action === 'activity-search' ? target.value : /** @type {any} */(utilityContext).activitySearch || '', activityLimit: 80 };
    renderShell();
    if (target.dataset.action === 'activity-search') requestAnimationFrame(() => { const input = document.querySelector('#activity-search'); if (input instanceof HTMLInputElement) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } });
  }
  if (target.dataset.action === 'preview-hue' && state) {
    state.settings.hue = Number(target.value);
    state.settings.accent = 'custom';
    applyPreferences();
    const output = target.closest('label')?.querySelector('output');
    if (output) output.textContent = `${target.value}°`;
  }
  if (target.dataset.action === 'purge-vault-confirmation' && state) {
    const button = document.querySelector('[data-purge-vault-submit]');
    if (button instanceof HTMLButtonElement) button.disabled = target.value !== state.vault.title;
  }
  if (target.name === 'theme' && state) { state.settings.theme = target.value; applyPreferences(); }
  if (target.name === 'motion' && state) { state.settings.motion = /** @type {any} */(target.value); applyPreferences(); }
  if (target.name === 'image' && target instanceof HTMLInputElement && target.files?.[0]) {
    try {
      pendingImage = await normalizeImage(target.files[0]);
      const preview = target.closest('.image-picker')?.querySelector('.image-preview');
      if (preview && pendingImage) preview.innerHTML = `<img src="${escape(pendingImage)}" alt=""><span class="image-picker-action">${icon('camera')}<span>Change</span></span>`;
      announce('Image normalized to a private square preview and ready to save.');
    }
    catch (error) { pendingImage = null; target.value = ''; showNotice(error instanceof Error ? error.message : 'The image could not be prepared.', true); }
  }
  if (target.dataset.action === 'field-icon-image' && target instanceof HTMLInputElement && target.files?.[0]) {
    try {
      const normalized = await normalizeImage(target.files[0]);
      const row = target.closest('.field-row');
      const stored = row?.querySelector('[name="fieldIconImage"]');
      const preview = row?.querySelector('.field-icon-preview');
      if (stored instanceof HTMLInputElement) stored.value = normalized || '';
      if (preview && normalized) preview.innerHTML = `<img src="${escape(normalized)}" alt="">`;
      announce('Field icon converted to a transparent WebP and ready to save.');
    } catch (error) { target.value = ''; showNotice(error instanceof Error ? error.message : 'The icon could not be prepared.', true); }
  }
  if (target.dataset.action === 'restore-file' && target instanceof HTMLInputElement && target.files?.[0]) {
    try {
      if (target.files[0].size > 100_000_000) throw new Error('Choose a Vault export smaller than 100 MB. Use a Vault folder for larger workspaces.');
      const parsed = JSON.parse(await target.files[0].text());
      validateVaultState(parsed);
      pendingRestore = structuredClone(parsed);
      const restoreButton = document.querySelector('[data-action="restore-backup"]');
      if (restoreButton instanceof HTMLButtonElement) restoreButton.disabled = false;
      announce(`Validated ${parsed.vault.name}. Choose Open validated export to continue.`);
    } catch (error) {
      pendingRestore = null;
      target.value = '';
      showNotice(error instanceof Error ? error.message : 'That file is not a valid Sonatory Vault export.', true);
    }
  }
  if (target.dataset.action === 'import-target') { utilityContext = { ...utilityContext, targetId: target.value }; if (pendingImport) renderShell(); }
  if (target.dataset.action === 'ddb-file' && target instanceof HTMLInputElement && target.files?.[0]) {
    const file = target.files[0];
    try {
      if (file.size > 50_000_000) throw new Error('Choose a PDF smaller than 50 MB.');
      if (file.type && file.type !== 'application/pdf' && !file.name.toLocaleLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF exported directly from D&D Beyond.');
      pendingImport = null;
      importWorker?.terminate();
      utilityContext = { ...utilityContext, importStatus: 'Opening the PDF locally…', fileName: file.name };
      const status = document.querySelector('.import-status'); if (status) status.textContent = utilityContext.importStatus;
      const bytes = await file.arrayBuffer();
      importWorker = new Worker(new URL('./importers/ddb-worker.js', import.meta.url), { type: 'module', name: 'sonatory-ddb-import' });
      const importTimer = window.setTimeout(() => {
        if (!importWorker) return;
        pendingImport = null;
        utilityContext.importStatus = 'The local PDF parser did not start in time. Nothing was imported.';
        importWorker.terminate(); importWorker = null; renderShell(); showNotice(utilityContext.importStatus, true);
      }, 20_000);
      importWorker.onmessage = event => {
        if (event.data.type === 'ready') {
          utilityContext.importStatus = 'Parser ready. Reading the PDF locally…';
          const liveStatus = document.querySelector('.import-status'); if (liveStatus) liveStatus.textContent = utilityContext.importStatus;
          importWorker?.postMessage({ bytes }, [bytes]);
        }
        if (event.data.type === 'progress') {
          utilityContext.importStatus = `Reading page ${event.data.progress.page} of ${event.data.progress.total} locally…`;
          const liveStatus = document.querySelector('.import-status'); if (liveStatus) liveStatus.textContent = utilityContext.importStatus;
        }
        if (event.data.type === 'result') {
          window.clearTimeout(importTimer);
          pendingImport = event.data.result; utilityContext.importStatus = `Recognized ${file.name}. Review every change below.`;
          importWorker?.terminate(); importWorker = null; renderShell(); announce('D&D Beyond PDF recognized. Dry-run preview ready.');
        }
        if (event.data.type === 'error') {
          window.clearTimeout(importTimer);
          pendingImport = null; utilityContext.importStatus = event.data.error.message;
          importWorker?.terminate(); importWorker = null; renderShell(); showNotice(event.data.error.message, true);
        }
      };
      importWorker.onerror = () => { window.clearTimeout(importTimer); pendingImport = null; utilityContext.importStatus = 'The local PDF parser stopped unexpectedly. Nothing was imported.'; importWorker?.terminate(); importWorker = null; renderShell(); showNotice(utilityContext.importStatus, true); };
    } catch (error) { pendingImport = null; target.value = ''; showNotice(error instanceof Error ? error.message : 'The PDF could not be opened.', true); }
  }
});

async function handleClick(target) {
  const action = target.dataset.action;
  if (action === 'dismiss-notice') { storageWarning = ''; target.closest('.notice')?.setAttribute('hidden', ''); return; }
  if (action === 'dismiss-update') { updateDismissed = true; refreshUpdateNotice(); return; }
  if (action === 'activate-update') { updateDismissed = false; updateRequested = true; maybeActivateUpdate(); if (!updateIsSafe()) announce('Update queued. It will begin after the current editor closes and local saves finish.'); return; }
  if (action === 'open-vault') {
    setActiveVault(target.dataset.id || '');
    state = await loadActiveState();
    if (state) { cloudReplica = null; cloudStatus = 'Automatic'; view = 'home'; renderShell(); queueAutomaticCloudSync(); }
    return;
  }
  if (!state) return;
  if (action === 'home') { revertUtilityPreview(); utility = ''; utilityContext = {}; utilityStack = []; view = 'home'; window.scrollTo(0, 0); renderShell(); }
  if (action === 'open-entity') { openEntity(target.dataset.id || ''); }
  if (action === 'select-tab') { revertUtilityPreview(); activePanel = target.dataset.id || ''; utility = ''; utilityContext = {}; utilityStack = []; view = 'panels'; renderShell(); }
  if (action === 'close-tab') {
    const id = target.dataset.id || '';
    const index = state.recentTabs.indexOf(id);
    state.recentTabs = state.recentTabs.filter(tab => tab !== id);
    if (activePanel === id) activePanel = state.recentTabs[Math.min(index, state.recentTabs.length - 1)] || '';
    if (!state.recentTabs.length && !utility) view = 'home';
    await persist(); renderShell();
  }
  if (action === 'carousel-prev' || action === 'carousel-next') {
    const track = document.querySelector(`#${CSS.escape(target.dataset.target || '')}`);
    if (track instanceof HTMLElement) track.scrollBy({ left: (action === 'carousel-prev' ? -1 : 1) * track.clientWidth * .78, behavior: effectiveReducedMotion() ? 'auto' : 'smooth' });
  }
  if (action === 'collections-layout') { collectionsLayout = target.dataset.layout === 'grid' ? 'grid' : 'carousel'; renderShell(); }
  if (action === 'inventory-layout') { inventoryLayouts.set(target.dataset.id || '', target.dataset.layout === 'grid' ? 'grid' : 'list'); renderShell(); }
  if (action === 'create-root') toggleUtility('sources');
  if (action === 'new-collection') openUtility('collection-editor', {});
  if (action === 'add-collection-item') openCollectionCreation(target.dataset.collection || target.dataset.id || '');
  if (action === 'edit-collection') openUtility('collection-editor', { collectionId: target.dataset.id || '' });
  if (action === 'delete-collection') {
    const collection = state.collections.find(item => item.id === target.dataset.id);
    if (!collection) return;
    commit(state, `Delete Collection ${collection.name}`, [{ path: '/collections', value: state.collections.filter(item => item.id !== collection.id) }]);
    utility = ''; utilityContext = {}; view = 'home';
    utilityStack = [];
    await persist(`${collection.name} Collection removed. Matching Entities were not deleted. Undo is available.`); renderShell();
  }
  if (action === 'move-collection') {
    const index = state.collections.findIndex(item => item.id === target.dataset.id);
    const nextIndex = index + Number(target.dataset.delta || 0);
    if (index < 0 || nextIndex < 0 || nextIndex >= state.collections.length) return;
    const next = [...state.collections];
    const [moved] = next.splice(index, 1); next.splice(nextIndex, 0, moved);
    commit(state, `Reorder Collection ${moved.name}`, [{ path: '/collections', value: next }]);
    utilityContext = { collectionId: moved.id };
    await persist(`${moved.name} moved ${nextIndex < index ? 'earlier' : 'later'}.`); renderShell();
  }
  if (action === 'add-field') {
    const rows = document.querySelector('[data-field-rows]');
    if (rows instanceof HTMLElement) { rows.insertAdjacentHTML('beforeend', renderNumericalField()); rows.querySelector('.field-row:last-child input')?.focus(); }
  }
  if (action === 'remove-field') target.closest('.field-row')?.remove();
  if (action === 'add-item') openUtility('sources', { parentId: target.dataset.parent });
  if (action === 'manage-container-links') openUtility('container-links', { containerId: target.dataset.id || '' });
  if (action === 'link-container') {
    const containerId = target.dataset.container || '';
    const linkedId = target.dataset.id || '';
    const prepared = prepareContainerLink(state, containerId, linkedId);
    if (!prepared.ok) { announce(prepared.reason); return; }
    const container = state.entities[containerId];
    const linked = state.entities[linkedId];
    commit(state, `Link ${container.name} and ${linked.name}`, prepared.writes);
    await persist(`${linked.name} linked to ${container.name}. Both Containers now show the connection.`); renderShell();
  }
  if (action === 'unlink-container') {
    const containerId = target.dataset.container || '';
    const linkedId = target.dataset.id || '';
    const prepared = prepareContainerUnlink(state, containerId, linkedId);
    if (!prepared.ok) { announce(prepared.reason); return; }
    const container = state.entities[containerId];
    const linked = state.entities[linkedId];
    commit(state, `Unlink ${container.name} and ${linked.name}`, prepared.writes);
    await persist(`${linked.name} unlinked from ${container.name}. Inventory was not moved.`); renderShell();
  }
  if (action === 'edit-source') openUtility('source-editor', { sourceId: target.dataset.id, parentId: /** @type {any} */(utilityContext).parentId || '' });
  if (action === 'sources-back') utilityBack();
  if (action === 'choose-source') {
    const source = state.itemSources.find(item => item.id === target.dataset.id);
    if (!source) return;
    const collectionId = /** @type {any} */(utilityContext).collectionId || '';
    const defaults = collectionCreationDefaults(collectionId);
    const parentId = /** @type {any} */(utilityContext).parentId || defaults.parentId || '';
    const creation = { parentId, presetTagIds: defaults.presetTagIds, presetTagNames: source.presetTagNames || [], collectionId };
    if (source.behavior === 'create-item') openUtility('editor', { ...creation, kind: 'item', presetTagNames: source.presetTagNames || [] });
    if (source.behavior === 'create-container') openUtility('editor', { ...creation, kind: 'container' });
    if (source.behavior === 'create-character') openUtility('character-setup', creation);
    if (source.behavior === 'custom-create') openUtility('custom-create', creation);
    if (source.behavior === 'browse-query') openUtility('source-browser', { ...creation, query: source.query, queryBindings: source.queryBindings || [], name: source.name });
    if (source.behavior === 'dnd-tools') openUtility('dnd-tools', { ...creation, query: source.query || '+D&D5e', queryBindings: source.queryBindings || [], name: source.name });
    if (source.behavior === 'ddb-import') openUtility('ddb-import', { ...creation, mode: 'new' });
  }
  if (action === 'custom-item') openUtility('editor', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], kind: 'item', presetTagNames: [...(/** @type {any} */(utilityContext).presetTagNames || []), ...(target.dataset.unique ? ['Unique'] : [])] });
  if (action === 'custom-container') openUtility('editor', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], presetTagNames: /** @type {any} */(utilityContext).presetTagNames || [], kind: 'container' });
  if (action === 'custom-character') openUtility('character-setup', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], presetTagNames: /** @type {any} */(utilityContext).presetTagNames || [] });
  if (action === 'custom-tag') openUtility('editor', { kind: 'tag', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], presetTagNames: /** @type {any} */(utilityContext).presetTagNames || [] });
  if (action === 'dnd-browse') openUtility('source-browser', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], query: /** @type {any} */(utilityContext).query || '+D&D5e', queryBindings: /** @type {any} */(utilityContext).queryBindings || [], name: 'D&D Items' });
  if (action === 'blank-character') openUtility('editor', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], presetTagNames: [...(/** @type {any} */(utilityContext).presetTagNames || []), 'Character'], kind: 'container' });
  if (action === 'ddb-new') openUtility('ddb-import', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], presetTagNames: /** @type {any} */(utilityContext).presetTagNames || [], mode: 'new' });
  if (action === 'ddb-update') openUtility('ddb-import', { parentId: /** @type {any} */(utilityContext).parentId || '', presetTagIds: /** @type {any} */(utilityContext).presetTagIds || [], presetTagNames: /** @type {any} */(utilityContext).presetTagNames || [], mode: 'update' });
  if (action === 'clear-import') { pendingImport = null; utilityContext = { ...utilityContext, importStatus: 'Choose a different D&D Beyond PDF.' }; renderShell(); }
  if (action === 'apply-import' && pendingImport) {
    const targetId = /** @type {any} */(utilityContext).mode === 'update' ? target.dataset.target || '' : '';
    const prepared = prepareDdbImport(pendingImport, targetId);
    commit(state, `${targetId ? 'Update' : 'Import'} ${prepared.characterName} inventory from D&D Beyond PDF`, prepared.writes);
    pendingImport = null; importWorker?.terminate(); importWorker = null;
    if (!state.recentTabs.includes(prepared.characterId)) state.recentTabs.push(prepared.characterId);
    activePanel = prepared.characterId; utility = ''; view = 'panels';
    await persist(`${prepared.characterName} inventory imported from a recognized D&D Beyond PDF.`); renderShell();
  }
  if (action === 'copy-source-item') {
    const sourceEntity = state.entities[target.dataset.id || ''];
    if (!sourceEntity) return;
    const id = guid();
    const parentId = /** @type {any} */(utilityContext).parentId || null;
    const now = new Date().toISOString();
    const automaticTags = activeEntities().filter(entity => entity.tags.includes('Tag') && ['Item','Created'].includes(entity.name)).map(entity => entity.id);
    const presetTagIds = /** @type {any} */(utilityContext).presetTagIds || [];
    const copy = { ...structuredClone(sourceEntity), id, parentId, quantity: 1, tags: [...new Set([...sourceEntity.tags.filter(tagId => tagName(tagId) !== 'Managed'), ...automaticTags, ...presetTagIds])], managed: false, createdAt: now, updatedAt: now };
    commit(state, `Add ${copy.name}`, [{ path: `/entities/${id}`, value: copy }]);
    utility = ''; view = parentId ? 'panels' : copy.container ? 'panels' : 'home';
    if (parentId) activePanel = parentId;
    else if (copy.container) { if (!state.recentTabs.includes(copy.id)) state.recentTabs.push(copy.id); activePanel = copy.id; }
    await persist(`${copy.name} added as an independent local item.`); renderShell();
  }
  if (action === 'delete-source') {
    const source = state.itemSources.find(item => item.id === target.dataset.id);
    if (!source) return;
    commit(state, `Delete item source ${source.name}`, [{ path: '/itemSources', value: state.itemSources.filter(item => item.id !== source.id) }]);
    utility = 'sources'; utilityContext = { parentId: /** @type {any} */(utilityContext).parentId || '' };
    await persist(`${source.name} source removed. Undo is available.`); renderShell();
  }
  if (action === 'source-move') {
    const index = state.itemSources.findIndex(item => item.id === target.dataset.id);
    const nextIndex = index + Number(target.dataset.direction || 0);
    if (index < 0 || nextIndex < 0 || nextIndex >= state.itemSources.length) return;
    const next = [...state.itemSources];
    const [moved] = next.splice(index, 1); next.splice(nextIndex, 0, moved);
    commit(state, `Reorder item source ${moved.name}`, [{ path: '/itemSources', value: next }]);
    utilityContext = { ...utilityContext, sourceId: moved.id };
    await persist(`${moved.name} moved ${nextIndex < index ? 'earlier' : 'later'}.`); renderShell();
  }
  if (action === 'edit-entity') { openUtility('editor', { id: target.dataset.id }); }
  if (action === 'managed-compare') { utilityContext = { ...utilityContext, showManagedCompare: !/** @type {any} */(utilityContext).showManagedCompare }; renderShell(); }
  if (action === 'managed-reset') {
    const id = target.dataset.id || '';
    const base = managedBaseEntity(state, id);
    if (!base) return;
    commit(state, `Reset ${base.name} to managed source`, [{ path: `/entities/${id}`, value: base }]);
    utilityContext = { id }; await persist(`${base.name} reset to SRD ${MANAGED_SOURCE_VERSION}. Undo is available.`); renderShell();
  }
  if (action === 'managed-detach') {
    const id = target.dataset.id || '';
    const entity = state.entities[id];
    if (!entity || !entity.managed) return;
    const detached = { ...entity, managed: { .../** @type {any} */(entity.managed), detached: true, override: false }, tags: entity.tags.filter(tagId => tagName(tagId) !== 'Managed'), updatedAt: new Date().toISOString() };
    commit(state, `Detach ${entity.name} from managed source`, [{ path: `/entities/${id}`, value: detached }]);
    utilityContext = { id }; await persist(`${entity.name} detached and will no longer receive source updates. Undo is available.`); renderShell();
  }
  if (action === 'settings') toggleUtility('settings');
  if (action === 'search') toggleUtility('search');
  if (action === 'tags') toggleUtility('tags');
  if (action === 'groups') toggleUtility('groups');
  if (action === 'activity') toggleUtility('activity');
  if (action === 'activity-more') { utilityContext = { ...utilityContext, activityLimit: Number(/** @type {any} */(utilityContext).activityLimit || 80) + 80 }; renderShell(); }
  if (action === 'profile') toggleUtility('profile');
  if (action === 'mobile-menu') toggleUtility('menu');
  if (action === 'export-vault') downloadVault();
  if (action === 'copy-contact') await copyText(createContactCode({ id: state.vault.id, name: state.vault.name }), 'Contact code copied. It shares identity only, never access.');
  if (action === 'connect-folder') {
    try {
      const currentId = state.vault.id;
      const deviceSettings = structuredClone(state.settings);
      const result = await chooseVaultFolder(state);
      if (result.state.vault.id !== currentId) {
        pendingFolderSwitch = { result, deviceSettings };
        utilityContext = { ...utilityContext, confirmFolderSwitch: true };
        renderShell(); announce('The selected folder belongs to a different Vault. Confirm the identity switch in the panel.'); return;
      }
      await applyFolderSelection(result, deviceSettings);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') announce('Folder selection cancelled.');
      else showNotice(error instanceof Error ? error.message : 'The Vault folder could not be opened.', true);
    }
  }
  if (action === 'cancel-folder-switch') { pendingFolderSwitch = null; utilityContext = { ...utilityContext, confirmFolderSwitch: false }; renderShell(); }
  if (action === 'confirm-folder-switch' && pendingFolderSwitch) {
    const pending = pendingFolderSwitch;
    await applyFolderSelection(pending.result, pending.deviceSettings);
  }
  if (action === 'restore-backup' && pendingRestore) { utilityContext = { ...utilityContext, confirmRestore: true }; renderShell(); }
  if (action === 'cancel-restore') { utilityContext = { ...utilityContext, confirmRestore: false }; renderShell(); }
  if (action === 'confirm-restore' && pendingRestore) {
    const restored = structuredClone(pendingRestore);
    restored.settings = structuredClone(state.settings);
    state = restored;
    cloudReplica = null; cloudStatus = 'Automatic';
    pendingRestore = null;
    storageWarning = '';
    utility = ''; view = 'home'; activePanel = state.recentTabs.at(-1) || '';
    await saveState(state); renderShell(); announce(`${state.vault.name} opened from the validated export.`);
  }
  if (action === 'request-purge-vault') { utilityContext = { ...utilityContext, confirmPurgeVault: true }; renderShell(); requestAnimationFrame(() => document.querySelector('[data-action="purge-vault-confirmation"]')?.focus()); }
  if (action === 'cancel-purge-vault') { utilityContext = { ...utilityContext, confirmPurgeVault: false }; renderShell(); }
  if (action === 'close-utility') closeUtility();
  if (action === 'utility-back') utilityBack();
  if (action === 'search-tag') {
    const displayName = target.dataset.value || '';
    searchValue = `+${queryOperand(displayName)}`;
    searchBindings = target.dataset.id ? [{ operator: 'include', entityId: target.dataset.id, displayName }] : [];
    openUtility('search');
  }
  if (action === 'search-suggestion') {
    const start = Number(target.dataset.start || 0);
    const symbol = target.dataset.symbol || '+';
    const value = target.dataset.value || '';
    searchValue = `${searchValue.slice(0, start)}${symbol}${queryOperand(value)} `;
    pruneSearchBindings();
    const operator = target.dataset.operator;
    const entityId = target.dataset.id;
    if (entityId && ['include','exclude','containers'].includes(operator || '')) {
      searchBindings = searchBindings.filter(binding => !(binding.operator === operator && binding.displayName.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0));
      searchBindings.push({ operator: /** @type {any} */(operator), entityId, displayName: value });
    }
    renderShell();
    requestAnimationFrame(() => { const input = document.querySelector('#global-search'); if (input instanceof HTMLInputElement) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } });
  }
  if (action === 'query-suggestion') {
    const input = document.querySelector('[data-action="collection-query"]');
    if (!(input instanceof HTMLInputElement)) return;
    const start = Number(target.dataset.start || 0);
    const symbol = target.dataset.symbol || '+';
    const displayName = target.dataset.value || '';
    const query = `${input.value.slice(0, start)}${symbol}${queryOperand(displayName)} `;
    const operator = target.dataset.operator;
    const entityId = target.dataset.id;
    const bindings = [...(/** @type {any} */(utilityContext).queryBindings || [])].filter(binding => !(binding.operator === operator && binding.displayName === displayName));
    if (entityId && ['include', 'exclude', 'containers'].includes(operator || '')) bindings.push({ operator, entityId, displayName });
    utilityContext = { ...utilityContext, queryDraft: query, queryBindings: bindings };
    input.value = query;
    const highlight = input.parentElement?.querySelector('.query-highlight');
    if (highlight) highlight.innerHTML = renderQueryHighlight(query);
    const assist = document.querySelector('#collection-query-assist');
    if (assist) assist.innerHTML = renderQueryAssist(query, 'collection');
    const count = document.querySelector('#collection-match-count');
    if (count) count.textContent = String(searchEntities(state, query, bindings).length);
    input.setAttribute('aria-expanded', 'false');
    input.focus(); input.setSelectionRange(query.length, query.length);
  }
  if (action === 'preview-density') { state.settings.density = /** @type {any} */(target.dataset.value); applyPreferences(); renderShell(); }
  if (action === 'preview-mode') { state.settings.mode = /** @type {any} */(target.dataset.value); applyPreferences(); renderShell(); }
  if (action === 'preview-accent') { state.settings.accent = target.dataset.value || 'custom'; applyPreferences(); renderShell(); }
  if (action === 'reset-settings') { state.settings = { density: 'normal', mode: 'system', theme: 'modern', accent: 'custom', hue: 33, motion: 'system' }; applyPreferences(); renderShell(); }
  if (action === 'undo') { const item = undo(state); if (item) { await persist(item.label); renderShell(); } }
  if (action === 'redo') { const item = redo(state); if (item) { await persist(item.label); renderShell(); } }
  if (action === 'quantity') {
    const id = target.dataset.id || '';
    const entity = state.entities[id];
    const next = entity.quantity + Number(target.dataset.delta || 0);
    if (next < 1) { announce('Quantity cannot go below one. Delete the item if you no longer need it.'); return; }
    commit(state, `${Number(target.dataset.delta) > 0 ? 'Increase' : 'Decrease'} ${entity.name} quantity`, [{ path: `/entities/${id}`, value: { ...entity, quantity: next, updatedAt: new Date().toISOString() } }]);
    await persist(`${entity.name} quantity is now ${next}.`); renderShell();
  }
  if (action === 'edit-quantity') {
    const entity = state.entities[target.dataset.id || ''];
    if (!entity) return;
    const input = document.createElement('input');
    input.className = 'quantity-input'; input.type = 'number'; input.min = '1'; input.step = '1'; input.value = String(entity.quantity);
    input.dataset.quantityInput = entity.id; input.setAttribute('aria-label', `Set ${entity.name} quantity`);
    target.replaceWith(input); input.focus(); input.select();
  }
  if (action === 'split-stack') {
    const id = target.dataset.id || '';
    const entity = state.entities[id];
    const split = prepareStackSplit(state, id, 1);
    commit(state, `Split one ${entity.name}`, split.writes);
    if (!state.recentTabs.includes(split.cloneId)) state.recentTabs.push(split.cloneId);
    activePanel = split.cloneId; utility = ''; view = 'panels';
    await persist(`${entity.name} split into independent stacks. You are viewing the new copy.`); renderShell();
  }
  if (action === 'restack') {
    const id = target.dataset.id || '';
    const entity = state.entities[id];
    const candidateIds = restackCandidates(state, id).map(item => item.id);
    const merge = prepareRestack(state, id);
    commit(state, `Restack ${entity.name}`, merge.writes);
    state.recentTabs = state.recentTabs.filter(tabId => !candidateIds.includes(tabId));
    activePanel = id; utility = ''; view = 'panels';
    await persist(`${entity.name} combined into one stack of ${state.entities[id].quantity}.`); renderShell();
  }
  if (action === 'request-delete-entity') {
    const id = target.dataset.id || '';
    const entity = state.entities[id];
    if (!entity) return;
    if (entity.container && childrenOf(id).length) { utilityContext = { ...utilityContext, confirmDelete: true }; renderShell(); }
    else {
      const synthetic = document.createElement('button');
      synthetic.dataset.action = 'delete-entity'; synthetic.dataset.id = id;
      await handleClick(synthetic);
    }
  }
  if (action === 'cancel-delete') { utilityContext = { ...utilityContext, confirmDelete: false }; renderShell(); }
  if (action === 'request-purge-tag') { utilityContext = { ...utilityContext, confirmPurge: true }; renderShell(); requestAnimationFrame(() => document.querySelector('[data-action="cancel-purge-tag"]')?.focus()); }
  if (action === 'cancel-purge-tag') { utilityContext = { ...utilityContext, confirmPurge: false }; renderShell(); }
  if (action === 'purge-tag') {
    const id = target.dataset.id || '';
    const tag = state.entities[id];
    if (!tag?.tags.includes('Tag')) return;
    const targets = new Set([id, ...activeEntities().filter(entity => entity.tags.includes(id)).map(entity => entity.id)]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const entity of activeEntities()) if (entity.parentId && targets.has(entity.parentId) && !targets.has(entity.id)) { targets.add(entity.id); expanded = true; }
    }
    const now = new Date().toISOString();
    const writes = [...targets].map(entityId => ({ path: `/entities/${entityId}`, value: { ...state.entities[entityId], deleted: true, updatedAt: now } }));
    commit(state, `Purge Tag ${tag.name}`, writes);
    state.recentTabs = state.recentTabs.filter(tab => !targets.has(tab));
    if (utilityStack.length) {
      const previous = utilityStack.pop(); utility = previous.name; utilityContext = previous.context;
    } else { utility = ''; utilityContext = {}; view = state.recentTabs.length ? 'panels' : 'home'; }
    await persist(`${tag.name} and ${targets.size - 1} ${targets.size === 2 ? 'use' : 'uses'} purged. Undo is available.`); renderShell();
  }
  if (action === 'delete-entity') {
    const id = target.dataset.id || '';
    const entity = state.entities[id];
    commit(state, `Delete ${entity.name}`, [{ path: `/entities/${id}`, value: { ...entity, deleted: true, updatedAt: new Date().toISOString() } }]);
    state.recentTabs = state.recentTabs.filter(tab => tab !== id);
    if (utilityStack.length) {
      const previous = utilityStack.pop(); utility = previous.name; utilityContext = previous.context;
    } else { utility = ''; utilityContext = {}; view = state.recentTabs.length ? 'panels' : 'home'; }
    await persist(`${entity.name} deleted. Undo is available.`); renderShell();
  }
  if (action === 'new-group') openUtility('group-editor');
  if (action === 'select-group') {
    const scroller = target.closest('.panel');
    const scrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
    const selectedGroupId = /** @type {any} */(utilityContext).selectedGroupId === target.dataset.id ? '' : target.dataset.id || '';
    utilityContext = { ...utilityContext, selectedGroupId, selectedMemberId: '' }; renderShell();
    requestAnimationFrame(() => { const next = document.querySelector('.popup-workspace .panel'); if (next instanceof HTMLElement) next.scrollTop = scrollTop; });
  }
  if (action === 'select-member') {
    const scroller = target.closest('.panel');
    const scrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
    const selectedMemberId = /** @type {any} */(utilityContext).selectedMemberId === target.dataset.id ? '' : target.dataset.id || '';
    utilityContext = { ...utilityContext, selectedGroupId: target.dataset.group || '', selectedMemberId }; renderShell();
    requestAnimationFrame(() => { const next = document.querySelector('.popup-workspace .panel'); if (next instanceof HTMLElement) next.scrollTop = scrollTop; });
  }
  if (action === 'remove-friend') {
    const friend = state.friends.find(item => item.vaultGuid === target.dataset.id);
    if (!friend) return;
    commit(state, `Remove friend ${friend.name}`, [{ path: '/friends', value: state.friends.filter(item => item.vaultGuid !== friend.vaultGuid) }]);
    utilityContext = { ...utilityContext, selectedMemberId: '' };
    await persist(`${friend.name} removed from saved friends. Group membership, if any, is unchanged.`); renderShell();
  }
  if (action === 'group-more') openUtility('permissions', { groupId: target.dataset.id });
  if (action === 'disband-group') { utilityContext = { ...utilityContext, confirmDisband: true }; renderShell(); }
  if (action === 'cancel-disband') { utilityContext = { ...utilityContext, confirmDisband: false }; renderShell(); }
  if (action === 'confirm-disband') {
    const group = /** @type {Array<any>} */(state.groups).find(item => item.id === target.dataset.id);
    if (!group) return;
    commit(state, `Disband Group ${group.name}`, [{ path: '/groups', value: state.groups.filter(item => item.id !== group.id) }]);
    utility = 'groups'; utilityContext = {};
    await persist(`${group.name} disbanded. Undo is available.`); renderShell();
  }
  if (action === 'switch-vault') { clearActiveVault(); state = null; cloudReplica = null; cloudStatus = 'Automatic'; await renderOnboarding(); }
}

app.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!(target instanceof HTMLElement)) return;
  if (target instanceof HTMLInputElement && target.type === 'file') return;
  event.preventDefault();
  if (Date.now() < suppressClickUntil || target.dataset.action === 'drag-item') return;
  queueUiAction(() => handleClick(target));
});

async function saveInlineQuantity(input) {
  if (!state || input.dataset.saving) return;
  input.dataset.saving = 'true';
  const entity = state.entities[input.dataset.quantityInput || ''];
  const quantity = Number(input.value);
  if (!entity || !Number.isSafeInteger(quantity) || quantity < 1) { renderShell(); announce('Quantity must be a whole number of at least one.'); return; }
  if (quantity === entity.quantity) { renderShell(); return; }
  commit(state, `Set ${entity.name} quantity`, [{ path: `/entities/${entity.id}`, value: { ...entity, quantity, updatedAt: new Date().toISOString() } }]);
  await persist(`${entity.name} quantity is now ${quantity}.`); renderShell();
}

app.addEventListener('change', event => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.dataset.quantityInput) queueUiAction(() => saveInlineQuantity(input));
});

app.addEventListener('focusout', event => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.dataset.quantityInput) queueMicrotask(() => queueUiAction(() => saveInlineQuantity(input)));
});

function clearDragMarkers() {
  document.querySelectorAll('.drag-over, .dragging, .drop-before, .drop-after').forEach(node => node.classList.remove('drag-over', 'dragging', 'drop-before', 'drop-after'));
}

function cancelPointerDrag() {
  pointerCandidate = null;
  if (!pointerDrag) return;
  pointerDrag.ghost.remove();
  pointerDrag.source.removeAttribute('aria-grabbed');
  pointerDrag = null;
  document.body.classList.remove('inventory-drag-active');
  clearDragMarkers();
}

/** @param {PointerEvent} event @param {HTMLElement} source @param {HTMLElement} handle */
function startPointerDrag(event, source, handle) {
  if (!state) return;
  const entityId = source.dataset.dragId || '';
  if (!entityId || !state.entities[entityId]) return;
  const ghost = /** @type {HTMLElement} */ (source.cloneNode(true));
  ghost.classList.add('pointer-drag-ghost');
  ghost.classList.remove('clickable', 'dragging', 'drop-before', 'drop-after');
  ghost.removeAttribute('data-action'); ghost.removeAttribute('tabindex');
  ghost.querySelectorAll('[id], [tabindex]').forEach(node => { node.removeAttribute('id'); node.removeAttribute('tabindex'); });
  const rect = source.getBoundingClientRect();
  ghost.style.setProperty('--drag-width', `${Math.min(rect.width, 360)}px`);
  document.body.append(ghost);
  pointerDrag = { pointerId: event.pointerId, entityId, source, handle, ghost, target: null, parentId: '', targetId: '', position: 'append' };
  pointerCandidate = null; suppressClickUntil = Date.now() + 350;
  source.classList.add('dragging'); source.setAttribute('aria-grabbed', 'true');
  document.body.classList.add('inventory-drag-active');
  handle.setPointerCapture?.(event.pointerId);
  ghost.style.transform = `translate3d(${event.clientX + 12}px, ${event.clientY + 12}px, 0) rotate(-1.5deg)`;
  updatePointerDropTarget(event.clientX, event.clientY);
}

/** @param {number} x @param {number} y */
function updatePointerDropTarget(x, y) {
  if (!pointerDrag || !state) return;
  clearDragMarkers();
  pointerDrag.source.classList.add('dragging');
  const hit = document.elementFromPoint(x, y);
  const destination = hit?.closest('[data-drag-id], [data-drop-parent], [data-inventory-parent]');
  pointerDrag.target = null;
  pointerDrag.parentId = '';
  pointerDrag.targetId = '';
  pointerDrag.position = 'append';
  if (!(destination instanceof HTMLElement)) return;
  const targetId = destination.dataset.dragId || '';
  if (targetId === pointerDrag.entityId) return;
  const parentId = targetId ? state.entities[targetId]?.parentId || '' : destination.dataset.dropParent || destination.dataset.inventoryParent || '';
  if (!parentId) return;
  const check = prepareInventoryMove(state, pointerDrag.entityId, parentId, targetId, targetId ? 'before' : 'append');
  if (!check.ok) return;

  pointerDrag.target = destination;
  pointerDrag.parentId = parentId;
  pointerDrag.targetId = targetId;
  if (targetId) {
    const rect = destination.getBoundingClientRect();
    const inventory = destination.closest('.inventory-grid');
    const grid = inventory?.classList.contains('grid-view');
    const before = grid && y >= rect.top && y <= rect.bottom ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
    pointerDrag.position = before ? 'before' : 'after';
    destination.classList.add(before ? 'drop-before' : 'drop-after');
  } else destination.classList.add('drag-over');

  const panel = hit?.closest('.panel');
  if (panel instanceof HTMLElement) {
    const rect = panel.getBoundingClientRect();
    if (y < rect.top + 40) panel.scrollBy({ top: -18 });
    else if (y > rect.bottom - 40) panel.scrollBy({ top: 18 });
  }
}

app.addEventListener('pointerdown', event => {
  const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
  const source = event.target instanceof Element ? event.target.closest('[data-drag-id]') : null;
  if (!(source instanceof HTMLElement) || event.button !== 0 || !state) return;
  const entityId = source.dataset.dragId || '';
  if (!entityId || !state.entities[entityId]) return;
  if (handle instanceof HTMLElement) { event.preventDefault(); startPointerDrag(event, source, handle); return; }
  const interactive = event.target instanceof Element && event.target.closest('button, input, select, textarea, a, label');
  if (!interactive) pointerCandidate = { pointerId: event.pointerId, entityId, source, startX: event.clientX, startY: event.clientY };
});

app.addEventListener('pointermove', event => {
  if (!pointerDrag && pointerCandidate?.pointerId === event.pointerId) {
    if (Math.hypot(event.clientX - pointerCandidate.startX, event.clientY - pointerCandidate.startY) < 6) return;
    startPointerDrag(event, pointerCandidate.source, pointerCandidate.source);
  }
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  event.preventDefault();
  pointerDrag.ghost.style.transform = `translate3d(${event.clientX + 12}px, ${event.clientY + 12}px, 0) rotate(-1.5deg)`;
  updatePointerDropTarget(event.clientX, event.clientY);
});

app.addEventListener('pointerup', event => {
  if (!pointerDrag && pointerCandidate?.pointerId === event.pointerId) { pointerCandidate = null; return; }
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId || !state) return;
  event.preventDefault();
  const drag = pointerDrag;
  const entity = state.entities[drag.entityId];
  const prepared = drag.parentId ? prepareInventoryMove(state, drag.entityId, drag.parentId, drag.targetId, drag.position) : { ok: false, reason: 'Drop the item onto another item, its inventory, or a linked Container.' };
  suppressClickUntil = Date.now() + 350;
  cancelPointerDrag();
  if (!prepared.ok || !entity) { announce(prepared.reason || 'That item could not be moved.'); return; }
  commit(state, `${prepared.sameParent ? 'Reorder' : 'Move'} ${entity.name}`, prepared.writes);
  const message = `${entity.name} ${prepared.sameParent ? 'reordered' : `moved to ${state.entities[drag.parentId]?.name || 'Container'}`}.`;
  queueUiAction(async () => { await persist(message); renderShell(); });
});

app.addEventListener('pointercancel', cancelPointerDrag);

document.addEventListener('keydown', event => {
  const keyTarget = event.target instanceof Element ? event.target : null;
  if (keyTarget instanceof HTMLInputElement && keyTarget.dataset.quantityInput) {
    if (event.key === 'Enter') { event.preventDefault(); keyTarget.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); renderShell(); }
    return;
  }
  if (pointerDrag && event.key === 'Escape') {
    event.preventDefault();
    suppressClickUntil = Date.now() + 250;
    cancelPointerDrag();
    announce('Move cancelled.');
    return;
  }
  if (keyTarget?.matches('[data-drag-handle]') && event.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && state) {
    event.preventDefault();
    const source = keyTarget.closest('[data-drag-id]');
    const entityId = source instanceof HTMLElement ? source.dataset.dragId || '' : '';
    const entity = state.entities[entityId];
    const siblings = entity?.parentId ? childrenOf(entity.parentId) : [];
    const index = siblings.findIndex(candidate => candidate.id === entityId);
    const earlier = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const target = siblings[index + (earlier ? -1 : 1)];
    if (!entity?.parentId || index < 0 || !target) { announce(`Cannot move ${entity?.name || 'item'} any ${earlier ? 'earlier' : 'later'}.`); return; }
    const prepared = prepareInventoryMove(state, entityId, entity.parentId, target.id, earlier ? 'before' : 'after');
    if (!prepared.ok) { announce(prepared.reason); return; }
    commit(state, `Reorder ${entity.name}`, prepared.writes);
    queueUiAction(async () => { await persist(`${entity.name} reordered.`); renderShell(); requestAnimationFrame(() => document.querySelector(`[data-drag-id="${CSS.escape(entityId)}"] [data-drag-handle]`)?.focus()); });
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && keyTarget?.matches('[role="link"][data-action]')) {
    event.preventDefault();
    if (keyTarget instanceof HTMLElement) keyTarget.click();
    return;
  }
  if (keyTarget?.matches('[data-action="search-input"]') && event.key === 'ArrowDown') {
    const first = document.querySelector('[data-action="search-suggestion"]');
    if (first instanceof HTMLElement) { event.preventDefault(); first.setAttribute('aria-selected', 'true'); first.focus(); }
  }
  if (keyTarget?.matches('[data-action="collection-query"]') && event.key === 'ArrowDown') {
    const first = document.querySelector('[data-action="query-suggestion"]');
    if (first instanceof HTMLElement) { event.preventDefault(); first.setAttribute('aria-selected', 'true'); first.focus(); }
  }
  if (keyTarget?.matches('[data-action="search-suggestion"]') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    keyTarget.click();
    return;
  }
  if (keyTarget?.matches('[data-action="search-suggestion"]') && ['ArrowDown','ArrowUp','Escape'].includes(event.key)) {
    event.preventDefault();
    const options = [...document.querySelectorAll('[data-action="search-suggestion"]')];
    const index = options.indexOf(keyTarget);
    const next = event.key === 'Escape' ? document.querySelector('#global-search') : options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length];
    options.forEach(option => option.setAttribute('aria-selected', 'false'));
    if (next instanceof HTMLElement) { if (next.matches('[role="option"]')) next.setAttribute('aria-selected', 'true'); next.focus(); }
    return;
  }
  if (keyTarget?.matches('[data-action="query-suggestion"]') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault(); keyTarget.click(); return;
  }
  if (keyTarget?.matches('[data-action="query-suggestion"]') && ['ArrowDown','ArrowUp','Escape'].includes(event.key)) {
    event.preventDefault();
    const options = [...document.querySelectorAll('[data-action="query-suggestion"]')];
    const index = options.indexOf(keyTarget);
    const next = event.key === 'Escape' ? document.querySelector('[data-action="collection-query"]') : options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length];
    options.forEach(option => option.setAttribute('aria-selected', 'false'));
    if (next instanceof HTMLElement) { if (next.matches('[role="option"]')) next.setAttribute('aria-selected', 'true'); next.focus(); }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (state) queueUiAction(() => toggleUtility('search')); }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); if (state) queueUiAction(async () => { const item = undo(state); if (item) { await persist(item.label); renderShell(); } }); }
  if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) { event.preventDefault(); if (state) queueUiAction(async () => { const item = redo(state); if (item) { await persist(item.label); renderShell(); } }); }
  if (event.key === 'Escape' && utility) {
    event.preventDefault();
    queueUiAction(() => {
      if (/** @type {any} */(utilityContext).confirmPurge) { utilityContext = { ...utilityContext, confirmPurge: false }; renderShell(); return; }
      if (/** @type {any} */(utilityContext).confirmPurgeVault) { utilityContext = { ...utilityContext, confirmPurgeVault: false }; renderShell(); return; }
      if (/** @type {any} */(utilityContext).confirmDelete) { utilityContext = { ...utilityContext, confirmDelete: false }; renderShell(); return; }
      if (/** @type {any} */(utilityContext).confirmDisband) { utilityContext = { ...utilityContext, confirmDisband: false }; renderShell(); return; }
      utilityStack.length ? utilityBack() : closeUtility();
    });
  }
});

async function init() {
  try {
    state = await loadActiveState();
    if (!state) await renderOnboarding();
    else {
      const cloudDefaultsChanged = !state.cloud.enabled || state.cloud.status !== 'Automatic';
      state.cloud = { enabled: true, status: 'Automatic' };
      const productRefresh = syncProductDefaults(state);
      const managedRefresh = syncManagedItems(state);
      const queryRefresh = syncQueryBindings(state);
      if (cloudDefaultsChanged || managedRefresh.added || managedRefresh.updated || productRefresh.tagged || productRefresh.sourcesChanged || queryRefresh) await saveState(state);
      activePanel = state.recentTabs.at(-1) || ''; renderShell(); queueAutomaticCloudSync();
    }
    registerServiceWorker().catch(() => {});
  } catch (error) {
    app.innerHTML = `<main class="boot" id="main"><div><h1>Sonatory could not open</h1><p>${escape(error instanceof Error ? error.message : 'Local storage is unavailable.')}</p><button data-action="switch-vault">Try another Vault</button></div></main>`;
    app.setAttribute('aria-busy', 'false');
  }
}

init();
