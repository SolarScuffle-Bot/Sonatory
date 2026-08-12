import test from 'node:test';
import assert from 'node:assert/strict';
import { addDecimal, canMove, commit, compareDecimal, computeAllWeights, computeWeight, decimalToString, formatExactDecimal, guid, managedBaseEntity, parseDecimal, parseQuery, prepareInventoryMove, prepareRestack, prepareStackSplit, redo, resolveQueryBindings, restackCandidates, searchEntities, structuralFingerprint, syncManagedItems, syncProductDefaults, undo } from '../src/core.js';
import { createExampleState as createState } from './helpers.mjs';

test('exact decimals normalize and add without floating point error', () => {
  assert.equal(decimalToString(parseDecimal('001.2300')), '1.23');
  assert.equal(decimalToString(addDecimal(parseDecimal('0.1'), parseDecimal('0.2'))), '0.3');
  assert.equal(compareDecimal(parseDecimal('9999999999999999.01'), parseDecimal('9999999999999999.001')), 1);
});

test('exact decimal display preserves values beyond floating-point precision', () => {
  assert.equal(formatExactDecimal('9007199254740993.0000000000000001', 'en-US'), '9,007,199,254,740,993.0000000000000001');
  assert.equal(formatExactDecimal('-0.125', 'en-US'), '-0.125');
  assert.equal(formatExactDecimal('not-a-number', 'en-US'), 'not-a-number');
  assert.throws(() => parseDecimal('1'.repeat(4_097)), /safety bound/);
});

test('new production Vaults contain only starter structure and managed definitions', async () => {
  const { createState: createProductionState } = await import('../src/core.js');
  const state = createProductionState('Fresh Vault', 'Fresh User');
  const localContent = Object.values(state.entities).filter(entity => !entity.tags.includes('Tag') && !entity.managed);
  assert.deepEqual(localContent, []);
  assert.deepEqual(state.collections.map(collection => collection.name), ['Characters', 'Parties', 'Bags']);
  assert.deepEqual(state.collections.map(collection => collection.createAction), ['character', 'container', 'container']);
  const containerTag = Object.values(state.entities).find(entity => entity.name === 'Container' && entity.tags.includes('Tag'));
  assert.ok(containerTag);
  assert.equal(containerTag.tags.some(id => state.entities[id]?.name === 'D&D5e'), false);
  assert.ok(Object.values(state.entities).filter(entity => entity.container).every(entity => entity.tags.includes(containerTag.id)));
  assert.deepEqual(state.groups, []);
  assert.deepEqual(state.friends, []);
  assert.deepEqual(state.history.events, []);
  assert.deepEqual(state.cloud, { enabled: true, status: 'Automatic' });
  assert.ok(searchEntities(state, '+Managed').length >= 416);
});

test('product migration exposes Container as a component Tag and removes leaked Character tags from imported children', async () => {
  const { createState: createProductionState } = await import('../src/core.js');
  const state = createProductionState('Migration', 'Tester');
  const characterTag = Object.values(state.entities).find(entity => entity.name === 'Character' && entity.tags.includes('Tag'));
  const containerTag = Object.values(state.entities).find(entity => entity.name === 'Container' && entity.tags.includes('Tag'));
  assert.ok(characterTag && containerTag);
  const now = new Date().toISOString();
  const characterId = guid();
  const childId = guid();
  state.entities[characterId] = { id: characterId, name: 'Imported Hero', description: '', tags: [characterTag.id, characterTag.id], parentId: null, container: true, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
  state.entities[childId] = { id: childId, name: 'Shortsword', description: '', tags: [characterTag.id], parentId: characterId, container: false, quantity: 1, weight: '2', image: null, importKey: 'shortsword', createdAt: now, updatedAt: now };
  state.collections.forEach(collection => { delete collection.createAction; });
  state.sourceDefaultsVersion = 7;
  syncProductDefaults(state);
  assert.equal(state.entities[characterId].tags.filter(id => id === characterTag.id).length, 1);
  assert.ok(state.entities[characterId].tags.includes(containerTag.id));
  assert.equal(state.entities[childId].tags.includes(characterTag.id), false);
  assert.equal(state.entities[childId].tags.includes(containerTag.id), false);
  assert.deepEqual(state.collections.map(collection => collection.createAction), ['character', 'container', 'container']);
});

test('recursive weight includes quantities and nested container contents', () => {
  const state = createState('Test', 'Tester');
  const character = Object.values(state.entities).find(entity => entity.name === 'Aria Thorn');
  assert.ok(character);
  assert.equal(decimalToString(computeWeight(state, character.id)), '155');
  const all = computeAllWeights(state);
  for (const entity of Object.values(state.entities).filter(entity => !entity.deleted)) assert.equal(decimalToString(all.get(entity.id)), decimalToString(computeWeight(state, entity.id)));
});

test('containment cycles are rejected', () => {
  const state = createState('Test', 'Tester');
  const aria = Object.values(state.entities).find(entity => entity.name === 'Aria Thorn');
  const satchel = Object.values(state.entities).find(entity => entity.name === 'Ashen Satchel');
  assert.ok(aria && satchel);
  assert.equal(canMove(state, aria.id, satchel.id).ok, false);
  assert.equal(canMove(state, satchel.id, aria.id).ok, true);
});

test('inventory moves deterministically reorder, transfer, reject cycles, and undo', () => {
  const state = createState('Test', 'Tester');
  const aria = Object.values(state.entities).find(entity => entity.name === 'Aria Thorn');
  const satchel = Object.values(state.entities).find(entity => entity.name === 'Ashen Satchel');
  const sword = Object.values(state.entities).find(entity => entity.name === 'Iron Longsword');
  assert.ok(aria && satchel && sword);

  const reorder = prepareInventoryMove(state, sword.id, aria.id, satchel.id, 'before', '2026-01-01T00:00:00.000Z');
  assert.equal(reorder.ok, true);
  if (!reorder.ok) return;
  commit(state, 'Reorder sword', reorder.writes);
  const ordered = Object.values(state.entities).filter(entity => entity.parentId === aria.id && !entity.deleted).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  assert.deepEqual(ordered.slice(0, 2).map(entity => entity.name), ['Iron Longsword', 'Ashen Satchel']);
  undo(state);
  assert.equal(state.entities[sword.id].order, undefined);

  const transfer = prepareInventoryMove(state, sword.id, satchel.id, '', 'append', '2026-01-01T00:00:01.000Z');
  assert.equal(transfer.ok, true);
  if (!transfer.ok) return;
  commit(state, 'Move sword', transfer.writes);
  assert.equal(state.entities[sword.id].parentId, satchel.id);
  undo(state);
  assert.equal(state.entities[sword.id].parentId, aria.id);

  const recursive = prepareInventoryMove(state, aria.id, satchel.id);
  assert.equal(recursive.ok, false);
  if (!recursive.ok) assert.match(recursive.reason, /inside itself|cannot contain itself/i);
});

test('search operators are direct and quoted values remain intact', () => {
  const parsed = parseQuery('iron +Weapon -Consumable ="Aria Thorn"');
  assert.deepEqual(parsed, { text: 'iron', include: ['Weapon'], exclude: ['Consumable'], containers: ['Aria Thorn'] });
  const state = createState('Test', 'Tester');
  assert.deepEqual(searchEntities(state, '+Character').map(entity => entity.name), ['Aria Thorn', 'Brother Cal', 'Mira Fen', 'Nim Underbough', 'Orin Pike', 'Sable Voss', 'Tess Ember', 'Yohan the Great']);
  const bags = searchEntities(state, '+Bag');
  const bagTag = Object.values(state.entities).find(entity => entity.name === 'Bag' && entity.tags.includes('Tag'));
  assert.ok(bagTag);
  assert.equal(bags.length, 12);
  assert.ok(bags.every(entity => entity.tags.includes(bagTag.id)));
  const tagEntities = searchEntities(state, '+Tag');
  assert.ok(tagEntities.length > 20);
  assert.ok(tagEntities.every(entity => entity.tags.includes('Tag')));
});

test('GUID-backed structured search survives renames and disambiguates duplicate names', () => {
  const state = createState('Test', 'Tester');
  const characterTag = Object.values(state.entities).find(entity => entity.name === 'Character' && entity.tags.includes('Tag'));
  assert.ok(characterTag);
  const bindings = resolveQueryBindings(state, '+Character');
  assert.equal(bindings.length, 1);
  characterTag.name = 'Player Character';
  assert.equal(searchEntities(state, '+Character').length, 0);
  assert.equal(searchEntities(state, '+Character', bindings).length, 8);

  const duplicateId = guid();
  const containerId = guid();
  const now = new Date().toISOString();
  state.entities[duplicateId] = { id: duplicateId, name: 'Player Character', description: '', tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
  state.entities[containerId] = { id: containerId, name: 'Chosen duplicate', description: '', tags: [duplicateId], parentId: null, container: true, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
  const chosen = [{ operator: 'include', entityId: duplicateId, displayName: 'Player Character' }];
  assert.deepEqual(searchEntities(state, '+"Player Character"', chosen).map(entity => entity.id), [containerId]);
  assert.equal(resolveQueryBindings(state, '+"Player Character"').length, 0);
});

test('SRD managed defaults refresh by stable ID without reviving or overwriting local choices', () => {
  const state = createState('Test', 'Tester');
  const managed = searchEntities(state, '+Managed');
  assert.ok(managed.length >= 416);
  const longsword = managed.find(entity => entity.name === 'Longsword');
  const holding = managed.find(entity => entity.name === 'Bag of Holding');
  const basket = managed.find(entity => entity.name === 'Basket');
  const bucket = managed.find(entity => entity.name === 'Bucket');
  const battleaxe = managed.find(entity => entity.name === 'Battleaxe');
  const adamantine = managed.find(entity => entity.name === 'Adamantine Armor');
  assert.ok(longsword && holding && basket && bucket && battleaxe && adamantine);
  assert.equal(longsword.weight, '3');
  assert.equal(holding.weight, '0');
  assert.ok(longsword.description.includes('1d8 Slashing'));
  assert.doesNotMatch(longsword.description, /^Longsword\b|\b3 lb\. 15 GP$/);
  assert.equal(battleaxe.description, '1d8 Slashing Versatile (1d10) Topple');
  assert.match(holding.description, /interior space considerably larger/i);
  assert.equal(longsword.fields.Value, '15');
  assert.deepEqual(longsword.fieldMeta.Value, { min: '0', icon: '◈' });
  assert.equal(basket.fields.Value, '0.4');
  assert.equal(bucket.fields.Value, '0.05');
  assert.ok(adamantine.tags.some(id => state.entities[id]?.name === 'Uncommon'));
  assert.ok(longsword.tags.some(id => state.entities[id]?.name === 'D&D5e'));
  assert.ok(longsword.tags.some(id => state.entities[id]?.name === 'Weapon'));
  assert.ok(longsword.tags.some(id => state.entities[id]?.name === 'Martial'));
  assert.ok(longsword.tags.some(id => state.entities[id]?.name === 'Melee'));
  assert.equal(longsword.tags.some(id => state.entities[id]?.name === 'MartialMeleeWeapon'), false);
  assert.ok(longsword.tags.some(id => state.entities[id]?.name === 'Common'));
  const rarity = Object.values(state.entities).find(entity => entity.name === 'Common' && entity.tags.includes('Tag'));
  assert.ok(rarity?.tags.some(id => state.entities[id]?.name === 'D&D5e'));
  const dndTag = Object.values(state.entities).find(entity => entity.name === 'D&D5e' && entity.tags.includes('Tag'));
  const managedMetadata = Object.values(state.entities).filter(entity => !entity.deleted && entity.tags.includes('Tag') && entity.tags.includes(dndTag.id));
  assert.equal(managedMetadata.some(entity => /\s/u.test(entity.name)), false);
  longsword.name = 'My Longsword';
  longsword.managed = { ...longsword.managed, override: true };
  holding.deleted = true;
  const result = syncManagedItems(state);
  assert.equal(result.added, 0);
  assert.equal(state.entities[longsword.id].name, 'My Longsword');
  assert.equal(state.entities[holding.id].deleted, true);
});

test('managed items expose a resettable base and detach into normal local data', () => {
  const state = createState('Test', 'Tester');
  const longsword = searchEntities(state, '+Managed').find(entity => entity.name === 'Longsword');
  assert.ok(longsword);
  const base = managedBaseEntity(state, longsword.id);
  assert.ok(base);
  longsword.name = 'Campaign Longsword';
  longsword.managed = { ...longsword.managed, override: true };
  assert.equal(managedBaseEntity(state, longsword.id)?.name, 'Longsword');
  commit(state, 'Reset source', [{ path: `/entities/${longsword.id}`, value: base }]);
  assert.equal(state.entities[longsword.id].name, 'Longsword');
  commit(state, 'Detach', [{ path: `/entities/${longsword.id}`, value: { ...state.entities[longsword.id], managed: { ...state.entities[longsword.id].managed, detached: true }, tags: state.entities[longsword.id].tags.filter(id => state.entities[id]?.name !== 'Managed') } }]);
  syncManagedItems(state);
  assert.equal(state.entities[longsword.id].managed.detached, true);
  assert.equal(managedBaseEntity(state, longsword.id), null);
});

test('managed weapon categories decompose into reusable direct Tags', () => {
  const state = createState('Migration', 'Tester');
  const longsword = searchEntities(state, '+Managed').find(entity => entity.name === 'Longsword');
  assert.ok(longsword);
  const names = longsword.tags.map(id => state.entities[id]?.name);
  assert.ok(names.includes('Weapon') && names.includes('Martial') && names.includes('Melee'));
  const legacyId = guid();
  state.entities[legacyId] = { id: legacyId, name: 'MartialMeleeWeapon', description: '', tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  longsword.tags = [...longsword.tags, legacyId];
  syncManagedItems(state);
  assert.equal(state.entities[legacyId].deleted, true);
  assert.equal(state.entities[longsword.id].tags.includes(legacyId), false);
});

test('data-defined item source defaults are editable and never resurrect after user deletion', () => {
  const state = createState('Test', 'Tester');
  assert.deepEqual(state.itemSources.map(source => source.name), ['Unique', 'Custom', 'Created', 'Item', 'D&D']);
  assert.match(state.itemSources[1].description, /Tag/);
  const removedId = state.itemSources[0].id;
  state.itemSources = state.itemSources.slice(1);
  syncProductDefaults(state);
  assert.equal(state.itemSources.some(source => source.id === removedId), false);
  assert.ok(searchEntities(state, '+Item').length >= 416);
  assert.ok(searchEntities(state, '+Created').some(entity => entity.name === 'Aria Thorn'));

  const migration = createState('Migration', 'Tester');
  migration.sourceDefaultsVersion = 1;
  migration.itemSources[1].description = 'Create an item, Container item, or Character.';
  syncProductDefaults(migration);
  assert.match(migration.itemSources[1].description, /Tag/);
  migration.sourceDefaultsVersion = 1;
  migration.itemSources[1].description = 'My intentionally customized description.';
  syncProductDefaults(migration);
  assert.equal(migration.itemSources[1].description, 'My intentionally customized description.');
});

test('product migration uses the compact D&D5e Tag and managed refresh restores a purged source Tag', () => {
  const state = createState('Migration', 'Tester');
  const dndTag = Object.values(state.entities).find(entity => entity.tags.includes('Tag') && entity.name === 'D&D5e');
  const dndSource = state.itemSources.find(source => source.name === 'D&D');
  assert.ok(dndTag && dndSource);
  dndTag.name = 'D&D 5e';
  dndTag.description = 'D&D 5e is an exact, direct Tag.';
  dndSource.query = '+"D&D 5e"';
  state.sourceDefaultsVersion = 4;
  syncProductDefaults(state);
  assert.equal(dndTag.name, 'D&D5e');
  assert.equal(dndSource.query, '+D&D5e');
  assert.equal(dndTag.description, 'D&D5e marks items supplied by the D&D 5th Edition source.');

  dndTag.deleted = true;
  syncManagedItems(state);
  assert.equal(dndTag.deleted, false);
});

test('undo, redo, and retained abandoned branch preserve changes', () => {
  const state = createState('Test', 'Tester');
  const aria = Object.values(state.entities).find(entity => entity.name === 'Aria Thorn');
  assert.ok(aria);
  commit(state, 'Rename', [{ path: `/entities/${aria.id}`, value: { ...aria, name: 'Aria Vale' } }]);
  assert.equal(state.entities[aria.id].name, 'Aria Vale');
  undo(state);
  assert.equal(state.entities[aria.id].name, 'Aria Thorn');
  redo(state);
  assert.equal(state.entities[aria.id].name, 'Aria Vale');
  undo(state);
  commit(state, 'Rename differently', [{ path: `/entities/${aria.id}`, value: { ...state.entities[aria.id], name: 'Aria Reed' } }]);
  assert.equal(state.history.branches.length, 1);
  assert.equal(state.entities[aria.id].name, 'Aria Reed');
});

test('container stacks split by cloning nested state and restack only after exact equality', () => {
  const state = createState('Test', 'Tester');
  const satchel = Object.values(state.entities).find(entity => entity.name === 'Ashen Satchel');
  assert.ok(satchel);
  satchel.quantity = 2;
  assert.equal(decimalToString(computeWeight(state, satchel.id)), '14');
  const split = prepareStackSplit(state, satchel.id);
  commit(state, 'Split satchel', split.writes);
  assert.equal(state.entities[satchel.id].quantity, 1);
  assert.equal(state.entities[split.cloneId].quantity, 1);
  assert.equal(decimalToString(addDecimal(computeWeight(state, satchel.id), computeWeight(state, split.cloneId))), '14');
  const clonedRope = Object.values(state.entities).find(entity => entity.parentId === split.cloneId && entity.name === 'Silk Rope');
  assert.ok(clonedRope);
  commit(state, 'Change cloned rope', [{ path: `/entities/${clonedRope.id}`, value: { ...clonedRope, quantity: 2 } }]);
  assert.equal(restackCandidates(state, satchel.id).length, 0);
  commit(state, 'Restore cloned rope', [{ path: `/entities/${clonedRope.id}`, value: { ...state.entities[clonedRope.id], quantity: 1 } }]);
  assert.equal(restackCandidates(state, satchel.id).length, 1);
  commit(state, 'Restack satchel', prepareRestack(state, satchel.id).writes);
  assert.equal(state.entities[satchel.id].quantity, 2);
  assert.equal(state.entities[split.cloneId], undefined);
  assert.equal(decimalToString(computeWeight(state, satchel.id)), '14');
});

test('deleting a container hides descendants from search without deleting their history', () => {
  const state = createState('Test', 'Tester');
  const satchel = Object.values(state.entities).find(entity => entity.name === 'Ashen Satchel');
  assert.ok(satchel);
  commit(state, 'Delete satchel', [{ path: `/entities/${satchel.id}`, value: { ...satchel, deleted: true } }]);
  assert.equal(searchEntities(state, 'Silk Rope').length, 0);
  undo(state);
  assert.equal(searchEntities(state, 'Silk Rope').length, 1);
});

test('deleting a Tag disables its query component without rewriting tagged Entities', () => {
  const state = createState('Test', 'Tester');
  const weapon = Object.values(state.entities).find(entity => entity.name === 'Weapon' && entity.tags.includes('Tag'));
  const sword = Object.values(state.entities).find(entity => entity.name === 'Iron Longsword');
  assert.ok(weapon && sword && sword.tags.includes(weapon.id));
  const bindings = resolveQueryBindings(state, '+Weapon');
  commit(state, 'Delete Weapon Tag', [{ path: `/entities/${weapon.id}`, value: { ...weapon, deleted: true } }]);
  assert.equal(searchEntities(state, '+Weapon', bindings).length, 0);
  assert.ok(sword.tags.includes(weapon.id));
  undo(state);
  assert.ok(searchEntities(state, '+Weapon', bindings).some(entity => entity.id === sword.id));
});

test('deep legal container trees use iterative weight, fingerprint, and split traversals', () => {
  const state = createState('Test', 'Tester');
  let parentId = null;
  let rootId = '';
  const now = new Date().toISOString();
  for (let index = 0; index < 1500; index += 1) {
    const id = `deep-${String(index).padStart(4, '0')}`;
    if (!rootId) rootId = id;
    state.entities[id] = { id, name: `Layer ${index}`, description: '', tags: [], parentId, container: true, quantity: index === 0 ? 2 : 1, weight: '1', image: null, createdAt: now, updatedAt: now };
    parentId = id;
  }
  assert.equal(decimalToString(computeWeight(state, rootId)), '3000');
  assert.equal(structuralFingerprint(state, rootId).hash.length, 16);
  const split = prepareStackSplit(state, rootId);
  assert.equal(split.writes.length, 1501);
});
