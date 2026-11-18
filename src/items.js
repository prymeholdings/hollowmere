import { randi, rand, pick, shuffle, hex } from './util.js';

export const RARITY_NAMES = ['Common', 'Magic', 'Rare', 'Legendary'];
export const RARITY_COLORS = [0xebebeb, 0x6fa3ff, 0xffe14d, 0xff8c1f];
export const SLOT_NAMES = { weapon: 'Weapon', offhand: 'Shield', helm: 'Helm', armor: 'Armor', ring: 'Ring', amulet: 'Amulet', fish: 'Fish' };
export const SLOT_ICONS = { weapon: '⚔', offhand: '🛡', helm: '⛑', armor: '🥋', ring: '💍', amulet: '📿', fish: '🐟' };

const BASES = [
  { base: 'Rusted Shortblade', slot: 'weapon', dmg: [2, 5], lvl: 1 },
  { base: 'Hand Axe', slot: 'weapon', dmg: [3, 6], lvl: 2 },
  { base: 'Ashwood Staff', slot: 'weapon', dmg: [2, 6], lvl: 3, bonus: { mag: 4 } },
  { base: 'Iron Longsword', slot: 'weapon', dmg: [4, 9], lvl: 5 },
  { base: 'Warpick', slot: 'weapon', dmg: [6, 11], lvl: 9 },
  { base: 'Rune Glaive', slot: 'weapon', dmg: [8, 16], lvl: 14 },
  { base: 'Starsteel Saber', slot: 'weapon', dmg: [12, 22], lvl: 20 },
  { base: 'Buckler', slot: 'offhand', armor: 4, lvl: 1 },
  { base: 'Kite Shield', slot: 'offhand', armor: 9, lvl: 6 },
  { base: 'Tower Shield', slot: 'offhand', armor: 16, lvl: 13 },
  { base: 'Padded Tunic', slot: 'armor', armor: 3, lvl: 1 },
  { base: 'Ringmail', slot: 'armor', armor: 8, lvl: 5 },
  { base: 'Scale Hauberk', slot: 'armor', armor: 14, lvl: 10 },
  { base: 'Gilded Plate', slot: 'armor', armor: 22, lvl: 16 },
  { base: 'Leather Cap', slot: 'helm', armor: 2, lvl: 1 },
  { base: 'Iron Helm', slot: 'helm', armor: 5, lvl: 6 },
  { base: 'Horned Greathelm', slot: 'helm', armor: 9, lvl: 12 },
  { base: 'Copper Band', slot: 'ring', lvl: 1 },
  { base: 'Opal Ring', slot: 'ring', lvl: 8 },
  { base: 'Bone Charm', slot: 'amulet', lvl: 2 },
  { base: 'Sunstone Pendant', slot: 'amulet', lvl: 10 },
];

const AFFIXES = [
  { stat: 'str', name: 'of Might', min: 1, max: 3, scale: 0.4 },
  { stat: 'dex', name: 'of Grace', min: 1, max: 3, scale: 0.4 },
  { stat: 'vit', name: 'of the Bear', min: 1, max: 3, scale: 0.4 },
  { stat: 'mag', name: 'of Embers', min: 1, max: 3, scale: 0.4 },
  { stat: 'life', name: 'Hale', min: 5, max: 10, scale: 2.0, prefix: true },
  { stat: 'mana', name: 'Lucid', min: 4, max: 8, scale: 1.5, prefix: true },
  { stat: 'dmg', name: 'Jagged', min: 1, max: 3, scale: 0.5, prefix: true },
  { stat: 'dmg_pct', name: 'Cruel', min: 5, max: 12, scale: 1.0, prefix: true },
  { stat: 'armor', name: 'Sturdy', min: 2, max: 5, scale: 0.8, prefix: true },
  { stat: 'aspd', name: 'of Haste', min: 4, max: 10, scale: 0.4 },
  { stat: 'leech', name: 'Vampiric', min: 1, max: 3, scale: 0.1, prefix: true },
  { stat: 'gold_find', name: 'of Fortune', min: 10, max: 25, scale: 1.0 },
  { stat: 'magic_find', name: 'Lucky', min: 5, max: 15, scale: 1.0, prefix: true },
];

export const STAT_LABELS = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', mag: 'Magic', life: 'Life', mana: 'Mana', dmg: 'Damage', dmg_pct: '% Damage', armor: 'Armor', aspd: '% Attack Speed', leech: '% Life Steal', gold_find: '% Gold Find', magic_find: '% Magic Find' };

const RARE_A = ['Grim', 'Dusk', 'Storm', 'Blood', 'Hollow', 'Ember', 'Frost', 'Raven', 'Salt', 'Gloom', 'Bright', 'Wraith'];
const RARE_B = ['Bite', 'Ward', 'Song', 'Mark', 'Shroud', 'Edge', 'Coil', 'Veil', 'Thorn', 'Oath', 'Spire', 'Gaze'];
const LEGENDS = ['Duskreaver', 'Marrowsong', 'The Patient Tide', 'Hearthwarden', 'Gloamfang', "Widow's Lantern", 'Saltglass Oath', 'Thistlecrown', 'Embermaw', 'The Quiet Bell'];

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

export function generate(ilvl, magicFind = 0, minRarity = 0) {
  ilvl = Math.max(1, ilvl);
  const pool = BASES.filter((b) => b.lvl <= ilvl + 1);
  let base = pick(pool);
  if (Math.random() < 0.5) { const b2 = pick(pool); if (b2.lvl > base.lvl) base = b2; }
  const mf = 1 + magicFind / 100;
  const roll = Math.random();
  let rarity = roll < 0.02 * mf ? 3 : roll < 0.11 * mf ? 2 : roll < 0.38 * mf ? 1 : 0;
  rarity = Math.max(rarity, minRarity);
  const it = { base: base.base, slot: base.slot, rarity, ilvl, req: base.lvl, affixes: {} };
  const scale = 1 + ilvl * 0.07 + rarity * 0.1;
  if (base.dmg) it.dmg = [Math.round(base.dmg[0] * scale), Math.round(base.dmg[1] * scale)];
  if (base.armor) it.armor = Math.round(base.armor * scale);
  if (base.bonus) Object.assign(it.affixes, base.bonus);
  const n = [0, randi(1, 2), randi(3, 4), 5][rarity];
  const picks = shuffle(AFFIXES.slice());
  let prefix = '', suffix = '';
  for (let i = 0; i < n; i++) {
    const a = picks[i];
    const v = Math.max(1, randi(a.min, a.max) + Math.floor(a.scale * ilvl * rand(0.5, 1)));
    it.affixes[a.stat] = (it.affixes[a.stat] || 0) + v;
    if (a.prefix) { if (!prefix) prefix = a.name; } else if (!suffix) suffix = a.name;
  }
  it.name = [base.base, `${prefix} ${base.base} ${suffix}`.trim(), `${pick(RARE_A)} ${pick(RARE_B)}`, pick(LEGENDS)][rarity];
  if (rarity >= 2 && it.slot === 'weapon') it.req = Math.max(it.req, Math.floor(ilvl * 0.8));
  it.value = Math.floor((6 + ilvl * 3) * (1 + rarity * 2.5));
  return it;
}

export function makeFish() {
  const total = FISH.reduce((s, f) => s + f.w, 0);
  let r = Math.random() * total;
  for (const f of FISH) { r -= f.w; if (r < 0) return { name: f.name, slot: 'fish', rarity: f.rarity, form: f.form, value: f.value, affixes: {}, req: 1 }; }
  return null;
}

export const itemColor = (it) => RARITY_COLORS[it.rarity || 0];
export const sellPrice = (it) => it.slot === 'fish' ? Math.floor(it.value / 2) : Math.max(1, Math.floor((it.value || 4) / 4));
export const buyPrice = (it) => Math.floor((it.value || 4) * 1.5) + 10;

export function describe(it, playerLevel) {
  if (!it) return '';
  let s = `<div class="tt-name" style="color:${hex(itemColor(it))}">${it.name}</div>`;
  if (it.slot === 'fish') {
    s += '<div class="tt-sub">Fish</div>';
    s += it.form ? `<div class="tt-aff">Feed to your pet to become a ${FORM_INFO[it.form]}</div>` : '<div class="tt-dim">Not much use except to sell.</div>';
    s += `<div class="tt-dim">Sells for ${sellPrice(it)} gold</div>`;
    return s;
  }
  s += `<div class="tt-sub">${RARITY_NAMES[it.rarity]} ${SLOT_NAMES[it.slot]}${it.rarity > 0 ? ` (${it.base})` : ''}</div>`;
  if (it.dmg) s += `<div>Damage: ${it.dmg[0]} - ${it.dmg[1]}</div>`;
  if (it.armor) s += `<div>Armor: ${it.armor}</div>`;
  for (const k in it.affixes) s += `<div class="tt-aff">+${it.affixes[k]} ${STAT_LABELS[k] || k}</div>`;
  s += `<div class="${it.req > playerLevel ? 'tt-bad' : 'tt-dim'}">Requires level ${it.req}</div>`;
  s += `<div class="tt-dim">Sells for ${sellPrice(it)} gold</div>`;
  return s;
}
