// Building interiors: every proper building in Hollowmere can be entered. Each one becomes a small furnished
// room level ('interior', floor = the building's index in the town list) with its own people.
import * as THREE from 'three';
import { Settings } from './settings.js';
import { box, cyl } from './util.js';

const CELL = 2;
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function interiorType(name) {
  if (/tavern/.test(name)) return 'tavern';
  if (/market/.test(name)) return 'shop';
  if (/blacksmith/.test(name)) return 'smithy';
  if (/church/.test(name)) return 'temple';
  if (/castle/.test(name)) return 'hall';
  if (/barracks/.test(name)) return 'barracks';
  if (/tower/.test(name)) return 'study';
  if (/mine/.test(name)) return 'mine';
  if (/mill|grain/.test(name)) return 'mill';
  return 'home';
}
// room size in cells (w x h) by type
const SIZE = { home: [7, 6], tavern: [11, 8], shop: [8, 6], smithy: [8, 7], temple: [8, 10], hall: [12, 9], barracks: [10, 7], study: [6, 6], mill: [8, 7], mine: [9, 7] };

const FIRST = ['Alda', 'Bram', 'Cedric', 'Dora', 'Edwin', 'Fenna', 'Garret', 'Hilde', 'Ivo', 'Jessa', 'Kell', 'Lorna', 'Mags', 'Nyle', 'Orla', 'Piet', 'Quill', 'Rosa', 'Silas', 'Tilda', 'Ulric', 'Vera', 'Wim', 'Yara', 'Bess', 'Cole', 'Dunn', 'Elsie', 'Finch', 'Greta', 'Hob', 'Inga', 'Jory', 'Kit', 'Lark', 'Milo', 'Nell', 'Osk', 'Perrin', 'Ruth'];
const SURN = ['Ashby', 'Bramble', 'Cobb', 'Dunmore', 'Fallow', 'Gristle', 'Hearth', 'Ivywood', 'Kettle', 'Larkspur', 'Millward', 'Nettle', 'Oakes', 'Pennywhistle', 'Quarry', 'Reed', 'Stokes', 'Thatcher', 'Underhill', 'Wicke'];
const TAVERNS = ['The Drowned Lantern', 'The Thirsty Well', 'The Sleeping Fox', 'The Copper Kettle', 'The Last Candle'];
const TEMPLES = ['Chapel of the Wells', 'Shrine of the Morning Lamp', 'Chapel of Still Water', 'House of the Ember Saint'];
const SHOPS = ['General Goods', 'Curios and Cloth', 'Spice and Sundries', 'Odds and Ends'];
const SMITHS = ['Anvil and Ash', 'The Red Forge', 'Hammerfall Smithy', 'Coldiron Works'];
const TOWERS = ['Scholar\'s Tower', 'Lamplighter\'s Tower', 'Old Watchtower', 'Astronomer\'s Tower'];
const nameAt = (arr, i) => arr[i % arr.length];

export function buildingTitle(b) {
  const i = b.index || 0, t = interiorType(b.name);
  const owner = `${nameAt(FIRST, i * 7 + 3)} ${nameAt(SURN, i * 3 + 1)}`;
  switch (t) {
    case 'tavern': return nameAt(TAVERNS, i);
    case 'temple': return nameAt(TEMPLES, i);
    case 'shop': return `${nameAt(SURN, i * 5)}'s ${nameAt(SHOPS, i)}`;
    case 'smithy': return nameAt(SMITHS, i);
    case 'hall': return 'The Keep of Hollowmere';
    case 'barracks': return 'Town Barracks';
    case 'study': return nameAt(TOWERS, i);
    case 'mine': return 'Glowstone Mine';
    case 'mill': return /windmill/.test(b.name) ? 'The Windmill' : /watermill/.test(b.name) ? 'The Watermill' : /lumber/.test(b.name) ? 'Lumber Mill' : 'Granary';
    default: return `${owner.split(' ')[0]}'s House`;
  }
}

// people who live or work inside, with lines for each kind of place
const LINES = {
  home: ['Wipe your boots, hero.', 'Make yourself at home. Not too much at home.', 'The kettle is on if you want some.', 'We hear the Well at night through the floorboards.', 'My grandmother swore the town was built on a giant\'s back.', 'Close the door, you are letting the cold in.'],
  tavern: ['Another round for the Well-diver!', 'Ale is cheap, stories are free.', 'I saw a skeleton dance once. Or I had too much cider.', 'Sit, drink, forget the deep for a while.', 'Mind the floor, it is sticky with heroics.', 'Have you tried the stew? Nobody knows what is in it.'],
  shop: ['Browse all you like. Break it, buy it.', 'Fresh stock from the coast every week.', 'Looking for something shiny?', 'Prices are fair. Mostly.'],
  smithy: ['Hot iron waits for no one.', 'A blade is only as good as its edge.', 'Bring me ore from the deep and I will make you something wicked.', 'Careful, the anvil bites.'],
  temple: ['Peace be on your lantern.', 'Light a candle for those still below.', 'The Wells take, the light gives back.', 'Speak softly here.'],
  hall: ['The Keep welcomes you, adventurer.', 'The council meets at dusk.', 'Kneel? No need. You are more use standing.', 'These banners have seen three hundred winters.'],
  barracks: ['Lights out at the tenth bell.', 'Sharpen, polish, repeat.', 'Recruits snore like trolls.', 'You want to spar? Maybe later.'],
  study: ['Do not touch the star charts.', 'I am writing a history of the Wells. Volume nine.', 'The deep floors glow with old magic.', 'Knowledge is a lantern too.'],
  mill: ['Flour in your hair is a mark of honest work.', 'The stones never stop turning.', 'Mind the sacks, they are heavier than they look.', 'Bread for the whole town starts here.'],
  mine: ['Glowstone, iron and the odd old bone.', 'Watch your head.', 'We stopped digging east. Something knocked back.', 'Bring a lantern, always.'],
};
const WHO = { home: 2, tavern: 6, shop: 2, smithy: 2, temple: 3, hall: 4, barracks: 4, study: 1, mill: 2, mine: 3 };
const MODELS = ['Knight', 'Mage', 'Rogue', 'Barbarian', 'Rogue_Hooded'];
const SPECS = ['v_m1', 'v_f1', 'v_m2', 'v_f2', 'v_m3', 'v_f3', 'v_m4', 'v_m5', 'v_f4', 'v_m6', 'v_f5'];
const ROLE = { tavern: ['Barkeep', 'Patron', 'Patron', 'Patron', 'Patron', 'Bard'], shop: ['Shopkeeper', 'Customer'], smithy: ['Smith', 'Apprentice'], temple: ['Priest', 'Pilgrim', 'Pilgrim'], hall: ['Steward', 'Guard', 'Guard', 'Councillor'], barracks: ['Sergeant', 'Guard', 'Guard', 'Recruit'], study: ['Scholar'], mill: ['Miller', 'Porter'], mine: ['Foreman', 'Miner', 'Miner'], home: ['', ''] };

export function genInterior(L, b) {
  const type = interiorType(b.name);
  const [rw, rh] = SIZE[type];
  L.itype = type; L.building = b; L.title = buildingTitle(b);
  L.alloc(rw + 4, rh + 4);
  L.room = { x: 2, y: 2, w: rw, h: rh };
  L.carve(2, 2, rw, rh);
  const dx = 2 + Math.floor(rw / 2);
  L.carve(dx, 2 + rh, 1, 1);
  L.doorCell = [dx, 2 + rh];
  L.startPos = L.toWorld(dx, 1 + rh);
  L.rooms = [L.room];
}

export function buildInteriorEnv(L) {
  const warm = L.itype === 'mine' ? 0x8a7a6a : 0xffd8a8;
  L.scene.background = new THREE.Color(0x060403);
  L.scene.fog = new THREE.Fog(0x060403, 40, 90);
  L.ambient = new THREE.HemisphereLight(warm, 0x2a1c10, Settings.grit === 'classic' ? 1.6 : 1.25);
  L.sun.color.set(0xffe0b0); L.sun.intensity = 0.9;
  L.scene.environmentIntensity = 0.18;
}

export function buildInterior(L) {
  const R = rng(1000 + (L.building.index || 0) * 7919);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const { x: rx, y: ry, w: rw, h: rh } = L.room;
  const t = L.itype;
  const stone = t === 'temple' || t === 'hall' || t === 'barracks';
  const W = (cx, cy) => L.toWorld(cx, cy);
  const put = (name, cx, cy, s = 0.5, rot = 0, block = true, y = 0) => {
    const o = L.placeProp(name, W(cx, cy).setY(y), s, rot);
    if (block) for (const [bx, by] of Array.isArray(block) ? block : [[Math.round(cx), Math.round(cy)]]) if (L.isFloor(bx, by)) L.cells[L.idx(bx, by)] = 2;
    return o;
  };
  // ---- floor
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
    const f = t === 'mine' ? (R() < 0.7 ? 'floor_dirt_large' : 'floor_tile_large_rocks') : stone ? 'floor_tile_large' : (R() < 0.85 ? 'floor_wood_large' : 'floor_wood_large_dark');
    L.placeProp(f, W(x, y), 0.5, Math.floor(R() * 4) * Math.PI / 2);
  }
  const [dcx, dcy] = L.doorCell;
  L.placeProp(stone ? 'floor_tile_large' : 'floor_wood_large_dark', W(dcx, dcy), 0.5, 0);
  // a rug in homes, a runner in the temple and the hall
  if (t === 'home' || t === 'temple' || t === 'hall' || t === 'tavern') {
    const col = [0x7a2a24, 0x2a3a6a, 0x5a3a1a, 0x2a5a3a][(L.building.index || 0) % 4];
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true;
    const long = t === 'temple' || t === 'hall';
    rug.scale.set(long ? 2.2 : rw * 0.9, long ? rh * CELL * 0.8 : rh * 0.7, 1);
    rug.position.copy(W(rx + (rw - 1) / 2, ry + (rh - 1) / 2 + (long ? 0.5 : 0.3))).setY(0.03);
    L.root.add(rug);
    const edge = rug.clone(); edge.material = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.9 }); edge.scale.x += 0.25; edge.scale.y += 0.25; edge.position.y = 0.025; L.root.add(edge);
  }
  // ---- walls (north and sides full height, south low so the camera sees in)
  const tall = new THREE.Vector3(0.5, 0.72, 0.5), low = new THREE.Vector3(0.5, 0.16, 0.5);
  const wallFor = (side) => {
    const r = R();
    if (t === 'mine') return r < 0.3 ? 'wall_cracked' : 'wall';
    if (side !== 'S' && r < 0.22) return stone ? 'wall_archedwindow_open' : 'wall_window_open';
    if (side !== 'S' && r < 0.3) return 'wall_window_closed';
    return 'wall';
  };
  L.northWalls = [];
  const dirs = [[0, -1, 0, 'N'], [0, 1, Math.PI, 'S'], [-1, 0, Math.PI / 2, 'W'], [1, 0, -Math.PI / 2, 'E']];
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
    for (const [dx, dy, rot, side] of dirs) {
      if (L.isFloor(x + dx, y + dy)) continue;
      const p = new THREE.Vector3(x * CELL + dx * (CELL / 2 + 0.25), 0, y * CELL + dy * (CELL / 2 + 0.25));
      const o = L.placeProp(side === 'S' ? 'wall' : wallFor(side), p, 0.5, rot);
      o.scale.copy(side === 'S' ? low : tall);
    }
  }
  // corner pillars
  for (const [cx, cz] of [[rx - 0.5, ry - 0.5], [rx + rw - 0.5, ry - 0.5], [rx - 0.5, ry + rh - 0.5], [rx + rw - 0.5, ry + rh - 0.5]]) {
    const pl = L.placeProp(t === 'temple' || t === 'hall' ? 'pillar_decorated' : 'pillar', new THREE.Vector3(cx * CELL, 0, cz * CELL), 0.4, 0);
    pl.scale.y = cz > ry + 1 ? 0.12 : 0.55;
  }
  // ---- lighting: candles, wall torches, a hearth
  L.torches = []; L.flames = [];
  const light = (p, color = 0xffaa55, inten = 9, dist = 9) => { if (L.torches.length >= 4) return null; const l = new THREE.PointLight(color, inten, dist, 1.4); l.position.copy(p); L.root.add(l); L.torches.push(l); return l; };
  const hearth = (cx, cy) => {
    const base = W(cx, cy);
    const hb = box(1.9, 1.3, 0.9, 0x5a5048); hb.position.copy(base).add(new THREE.Vector3(0, 0.65, -0.35)); L.root.add(hb);
    const mouth = box(1.1, 0.75, 0.4, 0x120804); mouth.position.copy(base).add(new THREE.Vector3(0, 0.45, 0.02)); L.root.add(mouth);
    const fire = box(0.7, 0.28, 0.25, 0xff7a20, 3); fire.position.copy(base).add(new THREE.Vector3(0, 0.2, 0.12)); L.root.add(fire);
    const chim = box(1.1, 1.6, 0.6, 0x4a4038); chim.position.copy(base).add(new THREE.Vector3(0, 2.0, -0.5)); L.root.add(chim);
    light(base.clone().add(new THREE.Vector3(0, 0.8, 0.9)), 0xff8a3a, 14, 10);
    L.flames.push(base.clone().add(new THREE.Vector3(0, 0.35, 0.15)));
    L.cells[L.idx(cx, cy)] = 2;
  };
  const sconce = (cx, cy) => { const p = W(cx, cy).add(new THREE.Vector3(0, 1.4, -0.75)); L.placeProp('torch_mounted', p, 0.5, 0); light(p.clone().add(new THREE.Vector3(0, 0.4, 0.6)), 0xffa050, 8, 8); L.flames.push(p.clone().add(new THREE.Vector3(0, 0.45, 0.3))); };
  const candleOn = (o, dx = 0, dz = 0, h = 0.52) => { const c = L.placeProp(R() < 0.5 ? 'candle_lit' : 'candle_thin_lit', o.position.clone().add(new THREE.Vector3(dx, h, dz)), 0.5, 0); return c; };
  const midX = rx + Math.floor(rw / 2);
  const banners = ['banner_patternB_red', 'banner_shield_blue', 'banner_triple_yellow', 'banner_patternC_green'];
  const onNorth = (name, cx, s = 0.5, y = 0) => L.placeProp(name, new THREE.Vector3(cx * CELL, y, (ry - 0.5) * CELL + 0.3), s, 0);

  switch (t) {
    case 'home': {
      put('bed_decorated', rx + 0.5, ry + 0.5, 0.5, 0, [[rx, ry], [rx + 1, ry], [rx, ry + 1], [rx + 1, ry + 1]]);
      put(pick(['trunk_medium_A', 'trunk_small_B']), rx + 0.5, ry + 2, 0.5, 0);
      hearth(rx + rw - 2, ry);
      const tb = put('table_medium', midX - 0.5, ry + 2.6, 0.5, Math.PI / 2, [[midX - 1, ry + 2], [midX, ry + 2], [midX - 1, ry + 3], [midX, ry + 3]]);
      put('chair', midX - 1.6, ry + 2.6, 0.5, Math.PI / 2, false); put('chair', midX + 0.6, ry + 2.6, 0.5, -Math.PI / 2, false);
      L.placeProp(pick(['plate_food_A', 'plate_food_B']), tb.position.clone().setY(0.5), 0.5, R() * 6); candleOn(tb, 0.4, 0.1);
      put('shelf_large', midX - 1, ry, 0.5, 0); put('wall_shelves', rx + rw - 1, ry + rh - 2, 0.5, -Math.PI / 2);
      put('barrel_large_decorated', rx + rw - 1, ry + rh - 1, 0.45, R() * 6); put('keg_decorated', rx, ry + rh - 1, 0.45, R() * 6);
      put('stool', rx + rw - 2, ry + 1.6, 0.5, R() * 6, false);
      break;
    }
    case 'tavern': {
      // the bar along the north wall, kegs and bottles behind
      for (let x = rx + 2; x < rx + rw - 3; x += 2) { const bar = put('table_long', x + 0.5, ry + 2, 0.5, 0, [[x, ry + 2], [x + 1, ry + 2]]); for (let k = 0; k < 2; k++) L.placeProp(pick(['bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'plate_stack']), bar.position.clone().add(new THREE.Vector3(R() * 1.6 - 0.8, 0.52, 0)), 0.5, R() * 6); }
      for (let x = rx + 2; x < rx + rw - 3; x += 1.5) put(pick(['keg_decorated', 'barrel_small_stack']), x, ry, 0.45, 0);
      put('shelves', rx + rw - 2, ry, 0.5, 0); hearth(rx, ry);
      for (const [cx, cy] of [[rx + 2, ry + 4], [rx + 5, ry + 4], [rx + 2, ry + 6], [rx + 8, ry + 6], [rx + 9, ry + 4]]) {
        const tb = put(pick(['table_medium', 'table_medium_tablecloth', 'table_small_decorated_A']), cx, cy, 0.5, R() * 0.4, [[Math.round(cx), Math.round(cy)]]);
        for (const [sx, sz] of [[-1.1, 0], [1.1, 0], [0, 1.1]]) L.placeProp('stool', tb.position.clone().add(new THREE.Vector3(sx, 0, sz)), 0.5, R() * 6);
        L.placeProp(pick(['plate_food_A', 'plate_food_B', 'bottle_A_green']), tb.position.clone().setY(0.5), 0.5, R() * 6); if (R() < 0.6) candleOn(tb, 0.3, -0.2);
      }
      put('barrel_large_decorated', rx + rw - 1, ry + rh - 1, 0.45, 0);
      onNorth(banners[0], rx + 1, 0.5);
      sconce(rx + rw - 1, ry);
      break;
    }
    case 'shop': {
      for (let x = rx; x < rx + rw; x += 2) put(R() < 0.5 ? 'shelf_large' : 'shelves', x + 0.5, ry, 0.5, 0, [[x, ry], [x + 1, ry]]);
      const ct = put('table_long_decorated_A', midX, ry + 2, 0.5, 0, [[midX - 1, ry + 2], [midX, ry + 2], [midX + 1, ry + 2]]);
      L.placeProp('coin_stack_large', ct.position.clone().add(new THREE.Vector3(0.6, 0.52, 0)), 0.5, 0); candleOn(ct, -0.7, 0);
      for (const [cx, cy] of [[rx, ry + 3], [rx, ry + 4], [rx + rw - 1, ry + 3], [rx + rw - 1, ry + 4]]) put(pick(['crate_A_small', 'barrel', 'sack', 'crate_B_small']), cx, cy, 5, R() * 6);
      put('box_small_decorated', rx + 1, ry + rh - 1, 0.5, 0); put('trunk_small_B', rx + rw - 2, ry + rh - 1, 0.5, 0);
      sconce(rx + 1, ry); sconce(rx + rw - 2, ry);
      break;
    }
    case 'smithy': {
      hearth(rx + 1, ry); hearth(rx + 2, ry);
      const anvil = box(0.9, 0.5, 0.4, 0x2a2a30); anvil.position.copy(W(rx + 2, ry + 2)).setY(0.55); L.root.add(anvil);
      const block = cyl(0.3, 0.35, 0.3, 0x5a3a1a); block.position.copy(W(rx + 2, ry + 2)).setY(0.15); L.root.add(block); L.cells[L.idx(rx + 2, ry + 2)] = 2;
      put('weaponrack', rx + rw - 1, ry + 1, 2.6, -Math.PI / 2); put('weaponrack', rx + rw - 1, ry + 3, 2.6, -Math.PI / 2);
      onNorth('sword_shield', rx + rw - 3, 0.5, 0.8); onNorth('sword_shield_gold', rx + rw - 2, 0.5, 0.8);
      put('barrel_large_decorated', rx, ry + rh - 1, 0.45, 0); put('resource_stone', rx + rw - 1, ry + rh - 1, 4, R() * 6); put('crate_open', rx + 4, ry, 4, 0);
      break;
    }
    case 'temple': {
      const alt = put('table_long_tablecloth_decorated_A', midX, ry + 1, 0.5, 0, [[midX - 1, ry + 1], [midX, ry + 1], [midX + 1, ry + 1]]);
      for (const dx of [-0.8, -0.3, 0.3, 0.8]) candleOn(alt, dx, -0.1);
      for (let y = ry + 3; y < ry + rh - 2; y += 1.5) for (const x of [rx + 1.5, rx + rw - 2.5]) put('table_long', x, y, 0.5, 0, [[Math.floor(x), Math.round(y)], [Math.ceil(x), Math.round(y)]]);
      for (const x of [rx + 0.2, rx + rw - 1.2]) for (let y = ry + 2; y < ry + rh - 1; y += 3) L.placeProp('pillar_decorated', W(x, y), 0.4, 0);
      onNorth(banners[1], midX - 2); onNorth(banners[2], midX + 2);
      sconce(rx, ry); sconce(rx + rw - 1, ry);
      break;
    }
    case 'hall': {
      const tl = put('table_long_tablecloth_decorated_A', midX, ry + 4, 0.5, Math.PI / 2, [[midX, ry + 3], [midX, ry + 4], [midX, ry + 5]]);
      for (const dz of [-1.6, 0, 1.6]) { L.placeProp('chair', tl.position.clone().add(new THREE.Vector3(-1.1, 0, dz)), 0.5, Math.PI / 2); L.placeProp('chair', tl.position.clone().add(new THREE.Vector3(1.1, 0, dz)), 0.5, -Math.PI / 2); L.placeProp(pick(['plate_food_A', 'plate_food_B']), tl.position.clone().add(new THREE.Vector3(0, 0.52, dz)), 0.5, 0); }
      const throne = put('chair', midX, ry + 0.6, 0.85, 0); throne.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(1.2).add(new THREE.Color(0x302000)); } });
      banners.forEach((bn, i) => onNorth(bn, rx + 1 + i * (rw - 2) / 3));
      for (const x of [rx + 1, rx + rw - 2]) for (let y = ry + 2; y < ry + rh - 1; y += 3) put('pillar_decorated', x, y, 0.4, 0);
      put('trunk_medium_A', rx, ry + rh - 1, 0.5, 0); put('coin_stack_large', rx + rw - 1, ry + rh - 1, 0.6, 0);
      sconce(rx + 2, ry); sconce(rx + rw - 3, ry);
      break;
    }
    case 'barracks': {
      for (let x = rx; x < rx + rw - 1; x += 2) { put('bed_frame', x + 0.5, ry + 0.6, 0.5, 0, [[x, ry], [x + 1, ry]]); put('trunk_small_B', x + 0.5, ry + 1.7, 0.5, 0); }
      put('weaponrack', rx, ry + 4, 2.6, Math.PI / 2); put('weaponrack', rx + rw - 1, ry + 4, 2.6, -Math.PI / 2);
      const tb = put('table_long', midX, ry + 4, 0.5, 0, [[midX - 1, ry + 4], [midX, ry + 4]]); candleOn(tb, 0, 0);
      put('stool', midX - 1, ry + 5, 0.5, 0, false); put('stool', midX + 1, ry + 5, 0.5, 0, false);
      put('sword_shield', rx + 2, ry + rh - 1, 0.5, Math.PI); sconce(midX, ry);
      break;
    }
    case 'study': {
      for (let x = rx; x < rx + rw; x += 2) put('shelves', x + 0.5, ry, 0.5, 0, [[x, ry], [x + 1, ry]]);
      put('wall_shelves', rx, ry + 2, 0.5, Math.PI / 2); put('shelf_small', rx + rw - 1, ry + 2, 0.5, -Math.PI / 2);
      const tb = put('table_small_decorated_B', midX, ry + 2.5, 0.5, 0); candleOn(tb, 0.2, 0); put('chair', midX, ry + 3.4, 0.5, Math.PI, false);
      put('stairs_wood', rx + rw - 1, ry + rh - 2, 0.5, -Math.PI / 2, [[rx + rw - 1, ry + rh - 2], [rx + rw - 1, ry + rh - 1]]);
      put('trunk_small_B', rx, ry + rh - 1, 0.5, 0); sconce(rx + 1, ry);
      break;
    }
    case 'mill': {
      const stoneW = cyl(0.9, 0.9, 0.35, 0x8a8478); stoneW.position.copy(W(midX, ry + 2)).setY(0.6); L.root.add(stoneW);
      const stoneB = cyl(1.0, 1.1, 0.45, 0x6a645a); stoneB.position.copy(W(midX, ry + 2)).setY(0.22); L.root.add(stoneB);
      L.cells[L.idx(midX, ry + 2)] = 2; L.mill = stoneW;
      for (let i = 0; i < 9; i++) put(pick(['sack', 'sack', 'crate_A_small', 'barrel', 'resource_lumber']), rx + (i % 3 === 0 ? 0 : rw - 1), ry + (i % (rh - 1)), i % 5 === 4 ? 4 : 6, R() * 6);
      put('pallet', rx + 2, ry + rh - 1, 5, 0); put('wheelbarrow', rx + rw - 3, ry + rh - 1, 5, R() * 6); sconce(rx + 1, ry);
      break;
    }
    case 'mine': {
      for (let x = rx; x < rx + rw; x += 3) put(pick(['crates_stacked', 'box_stacked', 'barrel_large']), x, ry, 0.45, R() * 6);
      for (let i = 0; i < 5; i++) put(pick(['rubble_half', 'rubble_large', 'resource_stone']), rx + Math.floor(R() * rw), ry + 1 + Math.floor(R() * (rh - 3)), R() < 0.5 ? 0.4 : 4, R() * 6);
      // a timbered tunnel mouth in the north wall, glowing faintly
      const mouth = box(1.6, 2.1, 0.1, 0x050403); mouth.position.copy(W(midX, ry)).add(new THREE.Vector3(0, 1.05, -0.8)); L.root.add(mouth);
      for (const dx of [-0.9, 0.9]) { const post = box(0.2, 2.3, 0.2, 0x5a3a1a); post.position.copy(W(midX, ry)).add(new THREE.Vector3(dx, 1.15, -0.7)); L.root.add(post); }
      const lintel = box(2.1, 0.22, 0.22, 0x5a3a1a); lintel.position.copy(W(midX, ry)).add(new THREE.Vector3(0, 2.3, -0.7)); L.root.add(lintel);
      light(W(midX, ry).add(new THREE.Vector3(0, 0.8, 0)), 0x66ccff, 6, 6);
      sconce(rx + 1, ry); sconce(rx + rw - 2, ry);
      break;
    }
  }
  // always at least a couple of lights
  if (L.torches.length < 2) sconce(rx + rw - 1, ry);
  // light through the windows by day (a soft cool fill from the south-west)
  const fill = new THREE.PointLight(0xc8d8ff, 4, 18, 1.2); fill.position.copy(W(rx + rw / 2, ry + rh)).setY(4.5); L.root.add(fill);
}

export function interiorPeople(L) {
  const t = L.itype, b = L.building, i0 = (b.index || 0) * 13;
  const R = rng(5000 + i0);
  const { x: rx, y: ry, w: rw, h: rh } = L.room;
  const out = [];
  const roles = ROLE[t];
  const n = WHO[t];
  const station = { shop: 'merchant', smithy: 'blacksmith', temple: 'healer' }[t];
  for (let k = station ? 1 : 0; k < n; k++) {
    const first = nameAt(FIRST, i0 + k * 11 + 5);
    const role = roles[k % roles.length];
    const name = role ? `${first} the ${role}` : (t === 'home' && k === 0 ? `${buildingTitle(b).replace("'s House", '')} ${nameAt(SURN, (b.index || 0) * 3 + 1)}` : `${first} ${nameAt(SURN, (b.index || 0) * 3 + 1)}`);
    let at = null;
    for (let tries = 0; tries < 30 && !at; tries++) {
      const cx = rx + 1 + Math.floor(R() * (rw - 2)), cy = ry + 1 + Math.floor(R() * (rh - 2));
      if (L.isFloor(cx, cy) && !(cx === L.doorCell[0] && cy >= L.doorCell[1] - 1)) at = [cx, cy];
    }
    if (!at) continue;
    const guard = role === 'Guard' || role === 'Sergeant';
    const d = { name, model: guard ? 'Knight' : MODELS[(i0 + k) % MODELS.length], at, roam: role === 'Barkeep' || role === 'Shopkeeper' || role === 'Smith' || role === 'Priest' ? 1.5 : 3.5,
      lines: LINES[t], indoor: true, spec: guard ? 'guard' : SPECS[(i0 + k * 3) % SPECS.length], scale: role === '' && k === 1 && t === 'home' && R() < 0.5 ? 0.62 : 1 };
    if (guard) Object.assign(d, { mode: 'guard', helm: true, headgear: 'Knight_Helmet', gear: { weapon: ['1H_Sword'], offhand: [] }, cape: '#1f3f8c' });
    if (role === 'Bard') d.mode = 'perform';
    if (role === 'Barkeep') { d.at = [rx + 4, ry + 1]; d.mode = 'stand'; }
    out.push(d);
  }
  return out;
}

// the shop counter, the forge and the altar are working stations (same services as the stalls outside)
export function interiorStation(L) {
  const t = L.itype, { x: rx, y: ry, w: rw } = L.room, i0 = (L.building.index || 0) * 13;
  const first = nameAt(FIRST, i0 + 5);
  if (t === 'shop') return { kind: 'merchant', at: [rx + Math.floor(rw / 2), ry + 1], name: `${first}, Shopkeeper` };
  if (t === 'smithy') return { kind: 'blacksmith', at: [rx + 3, ry + 2], name: `${first}, Smith` };
  if (t === 'temple') return { kind: 'healer', at: [rx + Math.floor(rw / 2), ry + 2], name: `${first}, Priest` };
  return null;
}
