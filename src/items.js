import { randi, rand, pick, shuffle, hex } from './util.js';

export const RARITY_NAMES = ['Common', 'Magic', 'Rare', 'Legendary'];
export const RARITY_COLORS = [0xebebeb, 0x6fa3ff, 0xffe14d, 0xff8c1f];
export const SLOT_NAMES = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Armor', ring: 'Ring', amulet: 'Amulet', fish: 'Fish', gem: 'Gem' };
export const SOCKET_SLOTS = ['weapon', 'offhand', 'armor', 'helm'];

// ---------------------------------------------------------------- materials (tiers)
// Each tier recolours the 3D model of the item and sets its level band.
export const MATS = [
  { key: 'rusted', name: 'Rusted', lvl: 1, tint: 0xb89a84 },
  { key: 'iron', name: 'Iron', lvl: 6, tint: 0xffffff },
  { key: 'steel', name: 'Steel', lvl: 12, tint: 0xdfe8f4 },
  { key: 'bronze', name: 'Bronze', lvl: 19, tint: 0xf0b070 },
  { key: 'gilded', name: 'Gilded', lvl: 26, tint: 0xffd86a, glow: 0x221500 },
  { key: 'bone', name: 'Bonecarved', lvl: 34, tint: 0xeee2c4, glow: 0x0a0a00 },
  { key: 'frost', name: 'Frostforged', lvl: 42, tint: 0xa8dcff, glow: 0x0c2a4a },
  { key: 'ember', name: 'Emberforged', lvl: 51, tint: 0xff9a66, glow: 0x3a0e00 },
  { key: 'venom', name: 'Venomglass', lvl: 60, tint: 0x9ce67a, glow: 0x0c2a00 },
  { key: 'storm', name: 'Stormbound', lvl: 69, tint: 0xa8b8ff, glow: 0x18225a },
  { key: 'void', name: 'Voidwrought', lvl: 78, tint: 0x8a5ac0, glow: 0x24003a },
  { key: 'star', name: 'Starforged', lvl: 88, tint: 0xfff2cc, glow: 0x4a3a18 },
];

// ---------------------------------------------------------------- item types
// vis = the 3D mesh the hero wears. src = which model holds it ('' = standalone prop file).
export const TYPES = {
  // weapons
  sword: { slot: 'weapon', name: 'Sword', vis: '1H_Sword', dmg: [3, 6], icon: 'sword', anim: '1h' },
  greatsword: { slot: 'weapon', name: 'Greatsword', vis: '2H_Sword', dmg: [5, 10], two: true, icon: 'sword', anim: '2h', bonus: { str: 2 } },
  axe: { slot: 'weapon', name: 'Axe', vis: '1H_Axe', dmg: [3, 7], icon: 'axe', anim: '1h' },
  greataxe: { slot: 'weapon', name: 'Greataxe', vis: '2H_Axe', dmg: [6, 11], two: true, icon: 'axe', anim: '2h', bonus: { str: 2 } },
  dagger: { slot: 'weapon', name: 'Dagger', vis: 'Knife', dmg: [2, 5], icon: 'dagger', anim: 'dual', bonus: { dex: 2 } },
  wand: { slot: 'weapon', name: 'Wand', vis: '1H_Wand', dmg: [2, 5], icon: 'wand', anim: 'cast', ranged: 'magic', bonus: { mag: 3 } },
  staff: { slot: 'weapon', name: 'Staff', vis: '2H_Staff', dmg: [3, 8], two: true, icon: 'staff', anim: 'cast', ranged: 'magic', bonus: { mag: 5 } },
  handbow: { slot: 'weapon', name: 'Hand Crossbow', vis: '1H_Crossbow', dmg: [2, 6], icon: 'crossbow', anim: 'shoot1', ranged: 'bolt', bonus: { dex: 2 } },
  crossbow: { slot: 'weapon', name: 'Heavy Crossbow', vis: '2H_Crossbow', dmg: [5, 10], two: true, icon: 'crossbow', anim: 'shoot2', ranged: 'bolt', bonus: { dex: 3 } },
  cleaver: { slot: 'weapon', name: 'Cleaver', vis: 'Skeleton_Blade', dmg: [3, 7], icon: 'sword', anim: '1h' },
  reaver: { slot: 'weapon', name: 'Reaver Axe', vis: 'Skeleton_Axe', dmg: [4, 8], icon: 'axe', anim: '1h' },
  sceptre: { slot: 'weapon', name: 'Sceptre', vis: 'Skeleton_Staff', dmg: [3, 7], two: true, icon: 'staff', anim: 'cast', ranged: 'magic', bonus: { mag: 4 } },
  // off-hands
  buckler: { slot: 'offhand', name: 'Buckler', vis: 'Round_Shield', armor: 4, icon: 'shield' },
  crest: { slot: 'offhand', name: 'Crest Shield', vis: 'Badge_Shield', armor: 6, icon: 'shield' },
  tower: { slot: 'offhand', name: 'Tower Shield', vis: 'Rectangle_Shield', armor: 9, icon: 'shield', bonus: { vit: 2 } },
  spiked: { slot: 'offhand', name: 'Spiked Shield', vis: 'Spike_Shield', armor: 6, icon: 'shield', bonus: { dmg: 2 } },
  targe: { slot: 'offhand', name: 'Targe', vis: 'Barbarian_Round_Shield', armor: 5, icon: 'shield', bonus: { str: 1 } },
  wardshield: { slot: 'offhand', name: 'Bone Ward', vis: 'Skeleton_Shield_Small_A', armor: 5, icon: 'shield' },
  bulwark: { slot: 'offhand', name: 'Bulwark', vis: 'Skeleton_Shield_Large_A', armor: 10, icon: 'shield', bonus: { life: 6 } },
  tome: { slot: 'offhand', name: 'Tome', vis: 'Spellbook', armor: 1, icon: 'book', bonus: { mana: 8, mag: 2 } },
  grimoire: { slot: 'offhand', name: 'Grimoire', vis: 'Spellbook_open', armor: 1, icon: 'book', bonus: { mag: 4 } },
  parry: { slot: 'offhand', name: 'Parrying Dagger', vis: 'Knife_Offhand', armor: 2, icon: 'dagger', bonus: { dex: 3 } },
  sidearm: { slot: 'offhand', name: 'Off-hand Axe', vis: '1H_Axe_Offhand', armor: 2, icon: 'axe', bonus: { dmg: 2 } },
  sideblade: { slot: 'offhand', name: 'Off-hand Sword', vis: '1H_Sword_Offhand', armor: 2, icon: 'sword', bonus: { aspd: 4 } },
  // armor (whole outfit: body, arms and legs)
  robe: { slot: 'armor', name: 'Robes', vis: 'Mage', armor: 2, icon: 'robe', bonus: { mana: 6 } },
  leathers: { slot: 'armor', name: 'Leathers', vis: 'Rogue', armor: 4, icon: 'leather', bonus: { dex: 1 } },
  furs: { slot: 'armor', name: 'Furs', vis: 'Barbarian', armor: 5, icon: 'fur', bonus: { life: 6 } },
  plate: { slot: 'armor', name: 'Plate', vis: 'Knight', armor: 7, icon: 'plate' },
  // helms
  helm: { slot: 'helm', name: 'Helm', vis: 'Knight_Helmet', armor: 4, icon: 'helm' },
  horned: { slot: 'helm', name: 'Horned Helm', vis: 'Barbarian_Hat', armor: 3, icon: 'horned', bonus: { str: 1 } },
  hat: { slot: 'helm', name: 'Hat', vis: 'Mage_Hat', armor: 1, icon: 'hat', bonus: { mag: 2 } },
  hood: { slot: 'helm', name: 'Hood', vis: 'Rogue_Head_Hooded', armor: 2, icon: 'hood', bonus: { dex: 2 } },
  skullhelm: { slot: 'helm', name: 'Skull Helm', vis: 'Skeleton_Warrior_Helmet', armor: 4, icon: 'helm', bonus: { vit: 1 } },
  crown: { slot: 'helm', name: 'Lich Crown', vis: 'Skeleton_Mage_Hat', armor: 2, icon: 'hat', bonus: { mana: 6 } },
  // jewellery
  band: { slot: 'ring', name: 'Band', vis: 'ring', icon: 'ring' },
  signet: { slot: 'ring', name: 'Signet', vis: 'ring', icon: 'ring' },
  pendant: { slot: 'amulet', name: 'Pendant', vis: 'amulet', icon: 'amulet' },
  talisman: { slot: 'amulet', name: 'Talisman', vis: 'amulet', icon: 'amulet' },
};
// Jewellery metals and stones (purely visual + level band)
const JEWEL_METALS = [{ n: 'Copper', c: 0xd08850, lvl: 1 }, { n: 'Silver', c: 0xe0e6ee, lvl: 12 }, { n: 'Gold', c: 0xffd060, lvl: 28 }, { n: 'Mithril', c: 0xbfe6ff, lvl: 50 }, { n: 'Starmetal', c: 0xfff4d8, lvl: 80 }];
const JEWEL_STONES = [0xe03a3a, 0x3a7aff, 0x3ad06a, 0xc04aff, 0xffc030, 0xf0f8ff];

// Build the list of bases: every weapon/armor type in every material tier.
const BASES = [];
for (const [tk, t] of Object.entries(TYPES)) {
  if (t.slot === 'ring' || t.slot === 'amulet') continue;
  MATS.forEach((m, i) => {
    const g = 1 + i * 0.28;
    const b = { base: `${m.name} ${t.name}`, type: tk, mat: m.key, slot: t.slot, lvl: m.lvl + (t.two ? 1 : 0), vis: t.vis, tint: m.tint, glow: m.glow || 0 };
    if (t.dmg) b.dmg = [Math.round(t.dmg[0] * g), Math.round(t.dmg[1] * g)];
    if (t.armor) b.armor = Math.round(t.armor * g);
    if (t.bonus) b.bonus = Object.fromEntries(Object.entries(t.bonus).map(([k, v]) => [k, Math.round(v * (1 + i * 0.5))]));
    BASES.push(b);
  });
}
for (const t of ['band', 'signet', 'pendant', 'talisman']) {
  JEWEL_METALS.forEach((m) => BASES.push({ base: `${m.n} ${TYPES[t].name}`, type: t, slot: TYPES[t].slot, lvl: m.lvl, vis: TYPES[t].vis, tint: m.c }));
}
export const ALL_BASES = BASES;
export const baseByName = (n) => BASES.find((b) => b.base === n);

// Old (v0.1 - v0.3) item names keep working: map them to a type + material.
const LEGACY = {
  'Rusted Shortblade': ['dagger', 'rusted'], 'Hand Axe': ['axe', 'iron'], 'Ashwood Staff': ['staff', 'rusted'], 'Iron Longsword': ['sword', 'iron'], 'Iron Sword': ['sword', 'iron'], 'Curved Dagger': ['dagger', 'iron'],
  Warpick: ['axe', 'steel'], 'Rune Glaive': ['greatsword', 'steel'], 'Starsteel Saber': ['sword', 'bronze'], Buckler: ['buckler', 'iron'], 'Kite Shield': ['crest', 'steel'], 'Tower Shield': ['tower', 'steel'],
  'Padded Tunic': ['leathers', 'rusted'], Ringmail: ['plate', 'iron'], 'Scale Hauberk': ['plate', 'steel'], 'Gilded Plate': ['plate', 'gilded'], 'Leather Cap': ['hood', 'rusted'], 'Iron Helm': ['helm', 'iron'],
  'Horned Greathelm': ['horned', 'steel'], 'Copper Band': ['band', null], 'Opal Ring': ['signet', null], 'Bone Charm': ['talisman', null], 'Sunstone Pendant': ['pendant', null],
};
// Fill in type/vis/tint for an item from any version.
export function upgradeItem(it) {
  if (!it || it.slot === 'fish' || it.slot === 'gem') return it;
  if (!it.type) {
    const b = baseByName(it.base);
    if (b) { it.type = b.type; it.mat = b.mat; }
    else if (LEGACY[it.base]) { [it.type, it.mat] = LEGACY[it.base]; }
    else it.type = { weapon: 'sword', offhand: 'buckler', armor: 'leathers', helm: 'helm', ring: 'band', amulet: 'pendant' }[it.slot] || 'sword';
  }
  if (!it.gems) it.gems = [];
  if (it.sockets === undefined) it.sockets = 0;
  return it;
}
export const typeOf = (it) => TYPES[upgradeItem(it).type] || TYPES.sword;
export const matOf = (it) => MATS.find((m) => m.key === it.mat);
// What the item looks like (respects transmog + dye)
export function lookOf(it) {
  upgradeItem(it);
  const t = TYPES[it.look] && TYPES[it.look].slot === it.slot ? TYPES[it.look] : typeOf(it);
  const m = matOf(it);
  let tint = m ? m.tint : 0xffffff;
  if (!m) { const b = baseByName(it.base); if (b) tint = b.tint; }
  if (it.dye) tint = parseInt(it.dye.slice(1), 16);
  const stone = JEWEL_STONES[(it.name || '').length % JEWEL_STONES.length];
  return { vis: t.vis, icon: t.icon, tint, glow: m?.glow || 0, rarity: it.rarity || 0, stone, slot: it.slot, gems: (it.gems || []).filter(Boolean).map((g) => GEMS[g.gem].color) };
}
export const isTwoHanded = (it) => !!(it && it.slot === 'weapon' && typeOf(it).two);

// ---------------------------------------------------------------- affixes
const AFFIXES = [
  { stat: 'str', name: 'of Might', min: 1, max: 3, scale: 0.4 },
  { stat: 'dex', name: 'of Grace', min: 1, max: 3, scale: 0.4 },
  { stat: 'vit', name: 'of the Bear', min: 1, max: 3, scale: 0.4 },
  { stat: 'mag', name: 'of Embers', min: 1, max: 3, scale: 0.4 },
  { stat: 'life', name: 'Hale', min: 5, max: 10, scale: 2.0, prefix: true },
  { stat: 'mana', name: 'Lucid', min: 4, max: 8, scale: 1.5, prefix: true },
  { stat: 'dmg', name: 'Jagged', min: 1, max: 3, scale: 0.5, prefix: true },
  { stat: 'dmg_pct', name: 'Cruel', min: 5, max: 12, scale: 0.6, prefix: true },
  { stat: 'armor', name: 'Sturdy', min: 2, max: 5, scale: 0.8, prefix: true },
  { stat: 'aspd', name: 'of Haste', min: 4, max: 10, scale: 0.15 },
  { stat: 'leech', name: 'Vampiric', min: 1, max: 3, scale: 0.04, prefix: true },
  { stat: 'gold_find', name: 'of Fortune', min: 10, max: 25, scale: 0.5 },
  { stat: 'magic_find', name: 'Lucky', min: 5, max: 15, scale: 0.5, prefix: true },
  { stat: 'fire', name: 'Burning', min: 1, max: 4, scale: 0.6, prefix: true, slots: ['weapon', 'ring', 'amulet'] },
  { stat: 'cold', name: 'Frozen', min: 1, max: 4, scale: 0.6, prefix: true, slots: ['weapon', 'ring', 'amulet'] },
  { stat: 'light', name: 'Shocking', min: 1, max: 4, scale: 0.6, prefix: true, slots: ['weapon', 'ring', 'amulet'] },
  { stat: 'poison', name: 'Venomous', min: 1, max: 4, scale: 0.6, prefix: true, slots: ['weapon', 'ring', 'amulet'] },
  { stat: 'crit', name: 'of Precision', min: 1, max: 3, scale: 0.05, slots: ['weapon', 'ring', 'amulet', 'helm'] },
  { stat: 'spell', name: 'of Sorcery', min: 3, max: 8, scale: 0.3, slots: ['weapon', 'offhand', 'amulet', 'helm', 'ring'] },
  { stat: 'regen', name: 'of Renewal', min: 1, max: 2, scale: 0.08, slots: ['armor', 'helm', 'amulet', 'ring'] },
];
// caps for percentage-based stats so very deep items stay sane
const CAPS = { aspd: 40, leech: 8, crit: 15, gold_find: 150, magic_find: 120, spell: 60, dmg_pct: 120 };

export const STAT_LABELS = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', mag: 'Magic', life: 'Life', mana: 'Mana', dmg: 'Damage', dmg_pct: '% Damage', armor: 'Armor', aspd: '% Attack Speed', leech: '% Life Steal', gold_find: '% Gold Find', magic_find: '% Magic Find',
  fire: 'Fire Damage', cold: 'Cold Damage', light: 'Lightning Damage', poison: 'Poison Damage', crit: '% Critical Chance', spell: '% Spell Damage', regen: 'Life per Second', all: 'All Attributes' };

const RARE_A = ['Grim', 'Dusk', 'Storm', 'Blood', 'Hollow', 'Ember', 'Frost', 'Raven', 'Salt', 'Gloom', 'Bright', 'Wraith', 'Deep', 'Thorn', 'Ash', 'Star'];
const RARE_B = ['Bite', 'Ward', 'Song', 'Mark', 'Shroud', 'Edge', 'Coil', 'Veil', 'Thorn', 'Oath', 'Spire', 'Gaze', 'Fang', 'Crown', 'Brand', 'Howl'];
const LEGENDS = ['Duskreaver', 'Marrowsong', 'The Patient Tide', 'Hearthwarden', 'Gloamfang', "Widow's Lantern", 'Saltglass Oath', 'Thistlecrown', 'Embermaw', 'The Quiet Bell', 'Wellbreaker', 'Mournlight', 'The Last Ember', 'Sorrowtide', 'Hollowheart', 'Kingsbane'];

// ---------------------------------------------------------------- gems
export const GEM_TIERS = ['Chipped', 'Flawed', 'Polished', 'Flawless', 'Radiant'];
const GEM_MULT = [1, 2, 3.5, 5.5, 8];
export const GEMS = {
  ruby: { name: 'Ruby', color: 0xff3344, weapon: ['fire', 4], armor: ['life', 12], offhand: ['str', 3] },
  sapphire: { name: 'Sapphire', color: 0x3a7aff, weapon: ['cold', 4], armor: ['mana', 10], offhand: ['mag', 3] },
  topaz: { name: 'Topaz', color: 0xffc030, weapon: ['light', 4], armor: ['magic_find', 6], offhand: ['gold_find', 10] },
  emerald: { name: 'Emerald', color: 0x2fd06a, weapon: ['poison', 4], armor: ['dex', 3], offhand: ['aspd', 2] },
  amethyst: { name: 'Amethyst', color: 0xb04aff, weapon: ['dmg_pct', 5], armor: ['vit', 3], offhand: ['armor', 8] },
  diamond: { name: 'Diamond', color: 0xeaf6ff, weapon: ['crit', 1], armor: ['armor', 10], offhand: ['spell', 4] },
  skull: { name: 'Skull', color: 0xb8b0a0, weapon: ['leech', 0.5], armor: ['regen', 0.6], offhand: ['life', 10] },
};
export const gemSlotGroup = (slot) => (slot === 'weapon' ? 'weapon' : slot === 'offhand' ? 'offhand' : 'armor');
export function gemEffect(g, slot) {
  const [stat, v] = GEMS[g.gem][gemSlotGroup(slot)];
  const val = v * GEM_MULT[g.tier];
  return [stat, stat === 'leech' || stat === 'crit' || stat === 'regen' ? Math.round(val * 10) / 10 : Math.round(val)];
}
export function makeGem(gem, tier) {
  const G0 = GEMS[gem];
  return { slot: 'gem', gem, tier, name: `${GEM_TIERS[tier]} ${G0.name}`, rarity: Math.min(3, Math.floor(tier / 1.5)), value: Math.floor(30 * Math.pow(3.2, tier)), affixes: {}, req: 1 };
}
export function randomGem(floor) {
  const keys = Object.keys(GEMS);
  let tier = 0;
  const r = Math.random();
  if (floor >= 15 && r < 0.35) tier = 1;
  if (floor >= 35 && r < 0.18) tier = 2;
  if (floor >= 60 && r < 0.08) tier = 3;
  if (floor >= 85 && r < 0.03) tier = 4;
  return makeGem(pick(keys), tier);
}
export const maxSockets = (it) => (SOCKET_SLOTS.includes(it.slot) ? (isTwoHanded(it) || it.slot === 'armor' ? 3 : 2) : 0);

// ---------------------------------------------------------------- generation
export function generate(ilvl, magicFind = 0, minRarity = 0, forceType = null) {
  ilvl = Math.max(1, ilvl);
  let pool = BASES.filter((b) => b.lvl <= ilvl + 1 && b.lvl >= ilvl - 24);
  if (forceType) pool = BASES.filter((b) => b.type === forceType && b.lvl <= Math.max(1, ilvl + 1));
  if (!pool.length) pool = BASES.filter((b) => b.lvl <= 2);
  // favour the newest tiers
  let base = pick(pool);
  for (let k = 0; k < 2; k++) { const b2 = pick(pool); if (b2.lvl > base.lvl && Math.random() < 0.6) base = b2; }
  const mf = 1 + magicFind / 100;
  const roll = Math.random();
  let rarity = roll < 0.02 * mf ? 3 : roll < 0.11 * mf ? 2 : roll < 0.38 * mf ? 1 : 0;
  rarity = Math.max(rarity, minRarity);
  const it = { base: base.base, type: base.type, mat: base.mat, slot: base.slot, rarity, ilvl, req: base.lvl, affixes: {}, sockets: 0, gems: [] };
  const scale = 1 + Math.max(0, ilvl - base.lvl) * 0.03 + base.lvl * 0.045 + rarity * 0.12;
  if (base.dmg) it.dmg = [Math.max(1, Math.round(base.dmg[0] * scale)), Math.max(2, Math.round(base.dmg[1] * scale))];
  if (base.armor) it.armor = Math.round(base.armor * scale);
  if (base.bonus) Object.assign(it.affixes, base.bonus);
  const n = [0, randi(1, 2), randi(3, 4), 5][rarity];
  const picks = shuffle(AFFIXES.filter((a) => !a.slots || a.slots.includes(base.slot)));
  let prefix = '', suffix = '';
  for (let i = 0; i < n && i < picks.length; i++) {
    const a = picks[i];
    let v = Math.max(1, randi(a.min, a.max) + Math.floor(a.scale * ilvl * rand(0.5, 1)));
    if (CAPS[a.stat]) v = Math.min(CAPS[a.stat], v);
    it.affixes[a.stat] = (it.affixes[a.stat] || 0) + v;
    if (a.prefix) { if (!prefix) prefix = a.name; } else if (!suffix) suffix = a.name;
  }
  it.name = [base.base, `${prefix} ${base.base} ${suffix}`.trim(), `${pick(RARE_A)} ${pick(RARE_B)}`, pick(LEGENDS)][rarity];
  if (rarity >= 2) it.req = Math.max(it.req, Math.floor(ilvl * 0.8));
  // sockets
  const ms = maxSockets(it);
  if (ms) {
    const r = Math.random();
    const s = [[0.75, 0.97], [0.5, 0.85], [0.25, 0.7], [0, 0.4]][rarity];
    it.sockets = Math.min(ms, r < s[0] ? 0 : r < s[1] ? 1 : rarity >= 2 ? (Math.random() < 0.3 ? 3 : 2) : 2);
  }
  it.value = Math.floor((6 + ilvl * 3) * (1 + rarity * 2.5) * (1 + it.sockets * 0.2));
  return it;
}

// Starting weapon / off-hand that match the look picked at character creation.
const START_VIS = { '1H_Sword': 'sword', '2H_Sword': 'greatsword', '1H_Axe': 'axe', '2H_Axe': 'greataxe', '2H_Staff': 'staff', '1H_Wand': 'wand', Knife: 'dagger', '1H_Crossbow': 'handbow',
  Round_Shield: 'buckler', Badge_Shield: 'crest', Rectangle_Shield: 'tower', Barbarian_Round_Shield: 'targe', Spellbook: 'tome', Spellbook_open: 'grimoire', Knife_Offhand: 'parry', '1H_Axe_Offhand': 'sidearm', '1H_Sword_Offhand': 'sideblade' };
export function starterItem(vis) {
  const t = START_VIS[vis];
  if (!t) return null;
  const b = BASES.find((x) => x.type === t && x.mat === 'rusted');
  const it = { base: b.base, name: b.base, type: t, mat: 'rusted', slot: b.slot, rarity: 0, ilvl: 1, req: 1, affixes: { ...(b.bonus || {}) }, sockets: 0, gems: [], value: 6 };
  if (b.dmg) it.dmg = [...b.dmg];
  if (b.armor) it.armor = b.armor;
  return it;
}

// ---------------------------------------------------------------- class-fitted gear (fishing treasure)
export const CLASS_GEAR = {
  Knight: ['sword', 'greatsword', 'plate', 'helm', 'crest', 'tower', 'bulwark'],
  Barbarian: ['axe', 'greataxe', 'reaver', 'furs', 'horned', 'targe', 'spiked', 'sidearm'],
  Mage: ['staff', 'wand', 'sceptre', 'robe', 'hat', 'crown', 'tome', 'grimoire'],
  Rogue: ['dagger', 'handbow', 'crossbow', 'leathers', 'hood', 'parry', 'sideblade'],
};
const CLASS_STAT = { Knight: ['str', 'vit'], Barbarian: ['str', 'dex'], Mage: ['mag', 'mana'], Rogue: ['dex', 'crit'] };
// A weapon or armor piece that suits the class, at least `minRarity`. Legendaries get the class's main stats.
export function classItem(cls, ilvl, minRarity = 3) {
  const types = CLASS_GEAR[cls] || CLASS_GEAR.Knight;
  const it = generate(ilvl, 0, minRarity, pick(types));
  if (it.rarity >= 3) {
    const [a, b] = CLASS_STAT[cls] || CLASS_STAT.Knight;
    it.affixes[a] = (it.affixes[a] || 0) + Math.max(3, Math.round(4 + ilvl * 0.25));
    const vb = b === 'crit' ? Math.min(CAPS.crit || 15, 4 + Math.floor(ilvl / 25)) : Math.max(4, Math.round(6 + ilvl * 0.35));
    it.affixes[b] = (it.affixes[b] || 0) + vb;
    it.sockets = Math.max(it.sockets, Math.min(maxSockets(it), 1));
    it.fished = true;
  }
  return it;
}

// ---------------------------------------------------------------- fish
const FISH = [
  { name: 'Old Boot', form: '', value: 2, rarity: 0, w: 14 },
  { name: 'Mudgill', form: '', value: 8, rarity: 0, w: 30 },
  { name: 'Glimmerperch', form: 'golem', value: 24, rarity: 1, w: 24 },
  { name: 'Ashfin', form: 'wyrm', value: 30, rarity: 1, w: 18 },
  { name: 'Moonscale Eel', form: 'stag', value: 46, rarity: 2, w: 11 },
];
export const FORM_INFO = {
  golem: 'Stone Golem: tough and hard-hitting.',
  wyrm: 'Ember Wyrm: deals double damage.',
  stag: 'Spirit Stag: fast, and slowly heals you.',
};
export function makeFish() {
  const total = FISH.reduce((s, f) => s + f.w, 0);
  let r = Math.random() * total;
  for (const f of FISH) { r -= f.w; if (r < 0) return { name: f.name, slot: 'fish', rarity: f.rarity, form: f.form, value: f.value, affixes: {}, req: 1 }; }
  return null;
}

export const itemColor = (it) => RARITY_COLORS[it.rarity || 0];
export const displayName = (it) => it.customName || it.name;
export const sellPrice = (it) => it.slot === 'fish' ? Math.floor(it.value / 2) : Math.max(1, Math.floor((it.value || 4) / 4));
export const buyPrice = (it) => Math.floor((it.value || 4) * 1.5) + 10;

const fmt = (k, v) => (STAT_LABELS[k] || k).startsWith('%') ? `+${v}${STAT_LABELS[k]}` : `+${v} ${STAT_LABELS[k] || k}`;
export function describe(it, playerLevel) {
  if (!it) return '';
  let s = `<div class="tt-name" style="color:${hex(itemColor(it))}">${displayName(it)}</div>`;
  if (it.customName) s += `<div class="tt-dim">(${it.name})</div>`;
  if (it.fished) s += '<div class="tt-dim" style="color:#7fd0ff">Hooked from the Deepwater Millpond</div>';
  if (it.slot === 'fish') {
    s += '<div class="tt-sub">Fish</div>';
    s += it.form ? `<div class="tt-aff">Feed to your pet to become a ${FORM_INFO[it.form]}</div>` : '<div class="tt-dim">Not much use except to sell.</div>';
    s += `<div class="tt-dim">Sells for ${sellPrice(it)} gold</div>`;
    return s;
  }
  if (it.slot === 'gem') {
    s += `<div class="tt-sub">Gem · tier ${it.tier + 1} of 5</div>`;
    for (const grp of ['weapon', 'armor', 'offhand']) {
      const [k, v] = gemEffect(it, grp);
      s += `<div class="tt-aff"><span class="tt-dim">${{ weapon: 'Weapon', armor: 'Armor / Helm', offhand: 'Off-hand' }[grp]}:</span> ${fmt(k, v)}</div>`;
    }
    s += '<div class="tt-dim">Right-click to socket into an item. The blacksmith combines 3 into the next tier.</div>';
    s += `<div class="tt-dim">Sells for ${sellPrice(it)} gold</div>`;
    return s;
  }
  upgradeItem(it);
  const t = typeOf(it);
  s += `<div class="tt-sub">${RARITY_NAMES[it.rarity]} ${t.two ? 'Two-Handed ' : ''}${SLOT_NAMES[it.slot]}${it.rarity > 0 ? ` (${it.base})` : ''}</div>`;
  if (it.dmg) s += `<div>Damage: ${it.dmg[0]} - ${it.dmg[1]}${t.ranged ? ' <span class="tt-dim">(ranged)</span>' : ''}</div>`;
  if (it.armor) s += `<div>Armor: ${it.armor}</div>`;
  for (const k in it.affixes) s += `<div class="tt-aff">${fmt(k, it.affixes[k])}</div>`;
  if (it.sockets) {
    s += '<div class="tt-sockets">';
    for (let i = 0; i < it.sockets; i++) {
      const g = it.gems[i];
      if (g) { const [k, v] = gemEffect(g, it.slot); s += `<div><span class="sock" style="background:${hex(GEMS[g.gem].color)}"></span>${fmt(k, v)} <span class="tt-dim">(${g.name})</span></div>`; }
      else s += '<div class="tt-dim"><span class="sock empty"></span>Empty socket</div>';
    }
    s += '</div>';
  }
  if (it.dye || it.look) s += `<div class="tt-dim">${it.look ? `Appearance: ${TYPES[it.look]?.name}` : ''}${it.dye && it.look ? ' · ' : ''}${it.dye ? 'Dyed' : ''}</div>`;
  s += `<div class="${it.req > playerLevel ? 'tt-bad' : 'tt-dim'}">Requires level ${it.req}</div>`;
  s += `<div class="tt-dim">Sells for ${sellPrice(it)} gold</div>`;
  return s;
}
