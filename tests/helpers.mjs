import { createState, guid, syncProductDefaults, syncQueryBindings } from '../src/core.js';

/** Test-only fixture. Production Vaults never receive this sample content. */
export function createExampleState(vaultName = 'Test', displayName = 'Tester') {
  const state = createState(vaultName, displayName);
  const now = new Date().toISOString();
  const tagByName = name => Object.values(state.entities).find(entity => entity.tags.includes('Tag') && entity.name === name);
  const makeTag = name => {
    const existing = tagByName(name);
    if (existing) return existing.id;
    const id = guid();
    state.entities[id] = { id, name, description: `${name} groups matching things.`, tags: ['Tag'], parentId: null, container: false, quantity: 1, weight: '0', image: null, createdAt: now, updatedAt: now };
    return id;
  };
  const make = (name, description, container, quantity, weight, tags = []) => {
    const id = guid();
    state.entities[id] = { id, name, description, tags, parentId: null, container, quantity, weight, image: null, createdAt: now, updatedAt: now };
    return id;
  };
  const characterTag = makeTag('Character');
  const partyTag = makeTag('Party');
  const bagTag = makeTag('Bag');
  const weaponTag = makeTag('Weapon');
  const supplyTag = makeTag('Supply');
  const consumableTag = makeTag('Consumable');
  const aria = make('Aria Thorn', 'A road-wise ranger prepared for long journeys.', true, 1, '142', [characterTag]);
  const wayfarers = make('The Wayfarers', 'A small company bound for the roads beyond Aldercross.', true, 1, '18', [partyTag]);
  const satchel = make('Ashen Satchel', 'A weathered field satchel with carefully arranged contents.', true, 1, '2', [bagTag]);
  const fieldKit = make('Field Kit', 'Everything needed to make camp before dark.', true, 1, '6', [bagTag]);
  const potionCase = make('Potion Case', 'A padded case for fragile supplies.', true, 1, '1', [bagTag]);
  const cache = make('Bridge Cache', 'Supplies left with friends near the old bridge.', true, 1, '4', [bagTag]);
  const sword = make('Iron Longsword', 'A dependable blade with a cord-wrapped grip.', false, 2, '3', [weaponTag]);
  const rations = make('Trail Rations', 'Dried fruit, hard cheese, and oat cakes.', false, 8, '2', [supplyTag, consumableTag]);
  const rope = make('Silk Rope', 'Fifty feet, tightly coiled.', false, 1, '5', [supplyTag]);
  const potion = make('Potion of Healing', 'A crimson restorative in a square glass vial.', false, 3, '0.5', [consumableTag]);
  const lantern = make('Hooded Lantern', 'Warm light with a shuttered brass hood.', false, 1, '2', [supplyTag]);
  const bedroll = make('Bedroll', 'Waxed canvas and wool.', false, 2, '7', [supplyTag]);
  state.entities[sword].parentId = aria;
  state.entities[rations].parentId = wayfarers;
  state.entities[rope].parentId = satchel;
  state.entities[potion].parentId = potionCase;
  state.entities[lantern].parentId = fieldKit;
  state.entities[bedroll].parentId = cache;
  state.entities[satchel].parentId = aria;
  state.entities[potionCase].parentId = wayfarers;
  for (const [name, description, weight] of [
    ['Mira Fen', 'An alchemist who labels everything twice.', '96'], ['Yohan the Great', 'A cheerful knight with an impractical number of capes.', '188'],
    ['Sable Voss', 'A quiet scout who travels lighter than rumor.', '74'], ['Brother Cal', 'A patient healer and keeper of the road shrine.', '121'],
    ['Tess Ember', 'A fire-touched scholar with a portable library.', '109'], ['Orin Pike', 'A veteran delver who never leaves rope behind.', '166'],
    ['Nim Underbough', 'A quick-handed courier with hidden pockets.', '62']
  ]) make(name, description, true, 1, weight, [characterTag]);
  for (const [name, description, weight] of [
    ['Lantern Company', 'Night-road travelers sharing light and supplies.', '22'], ['Aldercross Watch', 'A volunteer patrol provisioned for the north road.', '31'],
    ['The Green Table', 'Friends, maps, and provisions for a weekly expedition.', '16'], ['Cinderbound', 'A compact crew prepared for smoke and stone.', '28'],
    ['Harbor Runners', 'Dockside problem-solvers with a communal cache.', '25'], ['Moonwake Crew', 'Sailors and stargazers between long voyages.', '37'],
    ['Quiet Compass', 'Explorers who prefer careful plans and lighter packs.', '19']
  ]) make(name, description, true, 1, weight, [partyTag]);
  for (const [name, description, weight] of [
    ['Herbalist Pouch', 'Small paper packets sorted by scent.', '1'], ['Map Case', 'Oiled leather with a snug brass cap.', '1.5'],
    ['Quartermaster Crate', 'A stout shared crate with divided trays.', '9'], ['Rope Basket', 'A broad basket designed to prevent knots.', '3'],
    ['Winter Pack', 'Fur-lined and ready for deep snow.', '8'], ['Scroll Tube', 'Waxed oak with a watertight seam.', '1'],
    ['Spice Box', 'Six tiny compartments and one stubborn latch.', '2'], ['Traveler Trunk', 'A low iron-bound trunk for long roads.', '12']
  ]) make(name, description, true, 1, weight, [bagTag]);
  syncProductDefaults(state);
  syncQueryBindings(state);
  return state;
}
