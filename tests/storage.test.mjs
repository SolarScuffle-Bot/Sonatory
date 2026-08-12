import test from 'node:test';
import assert from 'node:assert/strict';
import { commit, createState, guid } from '../src/core.js';
import { compareVaultHistory, DEFAULT_SETTINGS, validateVaultState, vaultExportSnapshot } from '../src/storage.js';

test('Vault export validation accepts a complete local state', () => {
  const state = createState('Test Vault', 'Test User');
  assert.doesNotThrow(() => validateVaultState(JSON.parse(JSON.stringify(state))));
});

test('Vault validation rejects duplicate or malformed Collection identities', () => {
  const duplicate = createState('Collections', 'User');
  duplicate.collections.push(structuredClone(duplicate.collections[0]));
  assert.throws(() => validateVaultState(duplicate), /malformed collection/);
  const malformed = createState('Collections', 'User');
  malformed.collections[0].id = 'not-a-guid';
  assert.throws(() => validateVaultState(malformed), /malformed collection/);
  const unsupportedPanel = createState('Collections', 'User');
  unsupportedPanel.collections[0].createAction = 'run-script';
  assert.throws(() => validateVaultState(unsupportedPanel), /malformed collection/);
});

test('Vault validation accepts unique friend contacts and rejects malformed or duplicate identities', () => {
  const valid = createState('Friends', 'User');
  valid.friends = [{ vaultGuid: '00000000-0000-4000-8000-000000000123', name: 'Mira Fen' }];
  assert.doesNotThrow(() => validateVaultState(valid));

  const duplicate = structuredClone(valid);
  duplicate.friends.push({ ...duplicate.friends[0], name: 'Renamed Mira' });
  assert.throws(() => validateVaultState(duplicate), /malformed friend contacts/);

  const malformed = structuredClone(valid);
  malformed.friends[0].vaultGuid = 'not-a-guid';
  assert.throws(() => validateVaultState(malformed), /malformed friend contacts/);
});

test('Vault validation migrates, persists, and constrains canonical Container links', () => {
  const legacy = createState('Legacy Links', 'User');
  delete legacy.containerLinks;
  assert.doesNotThrow(() => validateVaultState(legacy));
  assert.deepEqual(legacy.containerLinks, []);

  const state = createState('Links', 'User');
  const now = new Date().toISOString();
  const ids = [guid(), guid()].sort();
  for (const [index, id] of ids.entries()) state.entities[id] = { id, name: `Container ${index + 1}`, description: '', tags: [], parentId: null, container: true, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
  commit(state, 'Link Containers', [{ path: '/containerLinks', value: [{ a: ids[0], b: ids[1] }] }]);
  assert.doesNotThrow(() => validateVaultState(state));

  const duplicate = structuredClone(state);
  duplicate.containerLinks.push(structuredClone(duplicate.containerLinks[0]));
  assert.throws(() => validateVaultState(duplicate), /duplicate Container links/);
  const missing = structuredClone(state);
  missing.containerLinks[0].b = guid();
  if (missing.containerLinks[0].a.localeCompare(missing.containerLinks[0].b) > 0) [missing.containerLinks[0].a, missing.containerLinks[0].b] = [missing.containerLinks[0].b, missing.containerLinks[0].a];
  assert.throws(() => validateVaultState(missing), /invalid endpoint/);
});

test('Vault validation rejects duplicate, ownerless, and unknown-role Group policy data', () => {
  const base = createState('Groups', 'User');
  const owner = { vaultGuid: base.vault.id, name: base.vault.name, role: 'Owner' };
  const group = { id: guid(), name: 'Travelers', members: [owner], createdAt: new Date().toISOString(), sync: { enabled: false, status: 'Local only' } };
  base.groups = [group];
  assert.doesNotThrow(() => validateVaultState(base));

  const duplicateMember = structuredClone(base);
  duplicateMember.groups[0].members.push({ ...owner, role: 'Viewer' });
  assert.throws(() => validateVaultState(duplicateMember), /malformed Group data/);

  const ownerless = structuredClone(base);
  ownerless.groups[0].members[0].role = 'Editor';
  assert.throws(() => validateVaultState(ownerless), /malformed Group data/);

  const unknownRole = structuredClone(base);
  unknownRole.groups[0].members[0].role = 'Emperor';
  assert.throws(() => validateVaultState(unknownRole), /malformed Group data/);

  const duplicateGroup = structuredClone(base);
  duplicateGroup.groups.push(structuredClone(group));
  assert.throws(() => validateVaultState(duplicateGroup), /malformed Group data/);
});

test('Vault and folder snapshots exclude device-local appearance choices', () => {
  const state = createState('Test Vault', 'Test User', { density: 'compact', mode: 'dark', theme: 'sci-fi', accent: 'purple', hue: 275, motion: 'reduced' });
  state.vault.folderName = 'Local Documents';
  const snapshot = vaultExportSnapshot(state);
  assert.deepEqual(snapshot.settings, DEFAULT_SETTINGS);
  assert.deepEqual(snapshot.recentTabs, []);
  assert.equal(snapshot.vault.folderName, undefined);
  assert.equal(state.vault.folderName, 'Local Documents');
  assert.equal(state.settings.density, 'compact');
  assert.equal(state.settings.theme, 'sci-fi');
});

test('Vault export validation rejects incomplete data before mutation', () => {
  const state = createState('Test Vault', 'Test User');
  const firstId = Object.keys(state.entities)[0];
  state.entities[firstId].id = 'different-id';
  assert.throws(() => validateVaultState(state), /malformed entity/);
  assert.throws(() => validateVaultState({ version: 1, vault: state.vault }), /invalid|incomplete/);
  assert.throws(() => validateVaultState({ ...createState('Test', 'User'), version: 99 }), /not supported/);
});

test('Vault validation enforces exact custom numeric precision and bounds', () => {
  const state = createState('Fields', 'User');
  const entity = Object.values(state.entities).find(item => item.container);
  assert.ok(entity);
  entity.fields = { Capacity: '10.5' };
  entity.fieldMeta = { Capacity: { precision: 2, min: '0', max: '20', icon: '⚖', iconImage: 'data:image/webp;base64,AAAA' } };
  assert.doesNotThrow(() => validateVaultState(state));
  entity.fields.Capacity = '20.001';
  assert.throws(() => validateVaultState(state), /precision|bounds/);
  entity.fields.Capacity = '21';
  assert.throws(() => validateVaultState(state), /outside its declared bounds/);
});

test('Vault validation rejects unsafe images, references, and hostile history paths', () => {
  const externalImage = createState('Test', 'User');
  externalImage.vault.image = 'https://tracker.invalid/profile.png';
  assert.throws(() => validateVaultState(externalImage), /identity metadata/);
  const legacyImage = createState('Test', 'User');
  legacyImage.vault.image = 'data:image/png;base64,AAAA';
  assert.throws(() => validateVaultState(legacyImage), /identity metadata/);

  const missingTag = createState('Test', 'User');
  Object.values(missingTag.entities).find(entity => !entity.tags.includes('Tag')).tags.push(guid());
  assert.throws(() => validateVaultState(missingTag), /invalid Tag reference/);

  const hostile = createState('Test', 'User');
  const eventId = guid();
  hostile.history.events.push({ id: eventId, label: 'Hostile', at: new Date().toISOString(), kind: 'action', changes: [{ path: '/__proto__/polluted', before: undefined, after: { polluted: true } }] });
  hostile.history.undoStack.push(eventId);
  assert.throws(() => validateVaultState(hostile), /unsupported state path/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => commit(createState('Test', 'User'), 'Unsafe', [{ path: '/__proto__/polluted', value: true }]), /unsupported state path/);
  assert.equal({}.polluted, undefined);

  const missingBinding = createState('Test', 'User');
  missingBinding.collections[0].queryBindings = [{ operator: 'include', entityId: guid(), displayName: 'Character' }];
  assert.throws(() => validateVaultState(missingBinding), /saved query bound to a missing entity/);

  const wrongBinding = createState('Test', 'User');
  const container = Object.values(wrongBinding.entities).find(entity => entity.container);
  assert.ok(container);
  wrongBinding.collections[0].queryBindings = [{ operator: 'include', entityId: container.id, displayName: container.name }];
  assert.throws(() => validateVaultState(wrongBinding), /wrong entity type/);

  const badTimestamp = createState('Test', 'User');
  commit(badTimestamp, 'Dated change', [{ path: '/vault/title', value: 'Changed' }]);
  badTimestamp.history.events[0].at = 'not-a-date';
  assert.throws(() => validateVaultState(badTimestamp), /malformed event/);

  const duplicateStack = createState('Test', 'User');
  const event = commit(duplicateStack, 'Once', [{ path: '/vault/title', value: 'Changed' }]);
  duplicateStack.history.redoStack.push(event.id);
  assert.throws(() => validateVaultState(duplicateStack), /duplicate actions/);
});

test('Vault cycle validation remains iterative for a deep legal chain', () => {
  const state = createState('Deep', 'User');
  let parentId = null;
  for (let index = 0; index < 2_000; index += 1) {
    const id = guid();
    state.entities[id] = { id, name: `Container ${index}`, description: '', tags: [], parentId, container: true, quantity: 1, weight: '0', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    parentId = id;
  }
  assert.doesNotThrow(() => validateVaultState(state));
});

test('folder reconciliation selects descendants and stops divergent history', () => {
  const base = createState('Test', 'User');
  const browser = structuredClone(base);
  const folder = structuredClone(base);
  browser.history.events.push({ id: 'browser-event', label: 'Browser', at: new Date().toISOString(), kind: 'action', changes: [] });
  assert.equal(compareVaultHistory(browser, folder), 'browser');
  assert.equal(compareVaultHistory(folder, browser), 'folder');
  folder.history.events.push({ id: 'folder-event', label: 'Folder', at: new Date().toISOString(), kind: 'action', changes: [] });
  assert.equal(compareVaultHistory(browser, folder), 'diverged');

  const altered = structuredClone(browser);
  altered.history.events[0].label = 'Altered same-ID event';
  assert.equal(compareVaultHistory(browser, altered), 'diverged');
});
