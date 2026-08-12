import test from 'node:test';
import assert from 'node:assert/strict';
import { EcsWorld, isRuntimeEntityId } from '../src/ecs.js';

const ids = {
  tag: '00000000-0000-4000-8000-000000000001',
  weight: '00000000-0000-4000-8000-000000000002',
  containedBy: '00000000-0000-4000-8000-000000000003',
  character: '00000000-0000-4000-8000-000000000004',
  party: '00000000-0000-4000-8000-000000000005',
  aria: '00000000-0000-4000-8000-000000000006',
  bag: '00000000-0000-4000-8000-000000000007',
  spare: '00000000-0000-4000-8000-000000000008'
};

test('ECS uses component Entities, archetype columns, exact Tags, and sparse pairs', () => {
  const world = new EcsWorld();
  for (const guid of Object.values(ids)) world.createEntity(guid);
  world.registerComponent(ids.tag, { storage: 'tag', codecId: 'presence' });
  world.registerComponent(ids.weight, { storage: 'data', codecId: 'exact-decimal' });
  world.registerComponent(ids.character, { storage: 'tag', codecId: 'presence' });
  world.registerComponent(ids.party, { storage: 'tag', codecId: 'presence' });
  world.add(ids.character, ids.tag);
  world.add(ids.party, ids.tag);
  world.add(ids.aria, ids.character);
  world.add(ids.aria, ids.weight, '142.5');
  world.add(ids.bag, ids.weight, '2');
  world.addPair(ids.bag, ids.containedBy, ids.aria, { exclusive: true });

  assert.deepEqual(world.query({ all: [ids.character] }).map(id => world.guid(id)), [ids.aria]);
  assert.deepEqual(world.query({ all: [ids.tag] }).map(id => world.guid(id)), [ids.character, ids.party]);
  assert.deepEqual(world.query({ all: [ids.character], none: [ids.party] }).map(id => world.guid(id)), [ids.aria]);
  assert.deepEqual(world.query({ pairsAny: [{ predicate: ids.containedBy, target: ids.aria }] }).map(id => world.guid(id)), [ids.bag]);
  assert.equal(world.get(ids.aria, ids.weight), '142.5');

  world.addPair(ids.bag, ids.containedBy, ids.spare, { exclusive: true });
  assert.equal(world.hasPair(ids.bag, ids.containedBy, ids.aria), false);
  assert.equal(world.hasPair(ids.bag, ids.containedBy, ids.spare), true);
});

test('ECS rejects dense runtime IDs in durable component data and fences recycled IDs', () => {
  const world = new EcsWorld();
  for (const guid of Object.values(ids)) world.createEntity(guid);
  world.registerComponent(ids.weight, { storage: 'data' });
  const stale = world.byGuid(ids.spare);
  assert.ok(stale && isRuntimeEntityId(stale));
  assert.throws(() => world.add(ids.aria, ids.weight, { leaked: stale }), /Runtime Entity IDs/);
  world.deleteEntity(stale);
  const replacementGuid = '00000000-0000-4000-8000-000000000009';
  const replacement = world.createEntity(replacementGuid);
  assert.equal(replacement.index, stale.index);
  assert.notEqual(replacement.generation, stale.generation);
  assert.throws(() => world.guid(stale), /Stale/);
});

test('ECS snapshot contains only durable GUIDs and active component definitions cannot be blindly deleted', () => {
  const world = new EcsWorld();
  for (const guid of Object.values(ids)) world.createEntity(guid);
  world.registerComponent(ids.character, { storage: 'tag' });
  world.add(ids.aria, ids.character);
  assert.throws(() => world.deleteEntity(ids.character), /dependency-preview migration/);
  const serialized = JSON.stringify(world.snapshot());
  assert.match(serialized, new RegExp(ids.character));
  assert.doesNotMatch(serialized, /generation|runtime-entity-id/);
  world.remove(ids.aria, ids.character);
  world.deleteEntity(ids.character);
  assert.equal(world.byGuid(ids.character), null);
});
