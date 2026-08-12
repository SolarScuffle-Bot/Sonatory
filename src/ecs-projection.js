// @ts-check
import { EcsWorld } from './ecs.js';

export const BUILTIN_COMPONENTS = Object.freeze({
  tag: '10000000-0000-4000-8000-000000000001',
  container: '10000000-0000-4000-8000-000000000002',
  containedBy: '10000000-0000-4000-8000-000000000003'
});

/**
 * Builds the deterministic ECS materialization used by query systems. The
 * current JSON document remains the journal/checkpoint compatibility codec;
 * runtime IDs never cross this boundary.
 * @param {import('./core.js').AppState} state
 */
export function projectStateToEcs(state) {
  const world = new EcsWorld();
  for (const guid of Object.values(BUILTIN_COMPONENTS)) world.createEntity(guid);
  for (const entity of Object.values(state.entities)) world.createEntity(entity.id);
  world.registerComponent(BUILTIN_COMPONENTS.tag, { storage: 'tag', codecId: 'presence', schemaVersion: 1 });
  world.registerComponent(BUILTIN_COMPONENTS.container, { storage: 'tag', codecId: 'presence', schemaVersion: 1 });

  for (const entity of Object.values(state.entities)) {
    if (entity.deleted || !entity.tags.includes('Tag')) continue;
    world.registerComponent(entity.id, { storage: 'tag', codecId: 'presence', schemaVersion: 1 });
    world.add(entity.id, BUILTIN_COMPONENTS.tag);
  }
  for (const entity of Object.values(state.entities)) {
    if (entity.container) world.add(entity.id, BUILTIN_COMPONENTS.container);
    for (const tagId of entity.tags) if (tagId !== 'Tag' && state.entities[tagId] && !state.entities[tagId].deleted && state.entities[tagId].tags.includes('Tag')) world.add(entity.id, tagId);
    if (entity.parentId && world.byGuid(entity.parentId)) world.addPair(entity.id, BUILTIN_COMPONENTS.containedBy, entity.parentId, { exclusive: true });
  }
  return world;
}

/** @param {EcsWorld} world @param {{include:string[][],exclude:string[],containers:string[]}} terms */
export function queryProjectedGuids(world, terms) {
  return world.query({
    any: terms.include,
    none: terms.exclude,
    pairsAny: terms.containers.map(target => ({ predicate: BUILTIN_COMPONENTS.containedBy, target }))
  }).map(entityId => world.guid(entityId));
}
