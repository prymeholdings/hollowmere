// The Zodiac: twelve star signs, each a small constellation of perks. Star points come with levels
// (one every second level) and are spent on stars; a star needs the star before it in its sign.
// Data only plus the bonus sum: the panel lives in ui.js.
import { G } from './state.js';

// per rank values; keys are summed into the same bonus table as item affixes
// stat keys: str dex vit mag all life mana armor dmg_pct aspd crit regen leech spell fire cold light poison
// magic_find gold_find, and zodiac-only percentages: life_pct mana_pct armor_pct xp_pct pet_pct move_pct crit_dmg
const S = (id, name, x, y, from, ranks, eff, text) => ({ id, name, x, y, from, ranks, eff, text });
export const SIGNS = [
  { id: 'aries', name: 'The Ram', glyph: '♈', theme: 'Raw force', stars: [
    S('ram_horns', 'Horns of the Ram', 0.2, 0.75, null, 3, { str: 3 }, '+3 Strength per rank'),
    S('ram_charge', 'Headlong', 0.45, 0.5, 'ram_horns', 3, { dmg_pct: 4 }, '+4% damage per rank'),
    S('ram_haste', 'War Rhythm', 0.75, 0.62, 'ram_charge', 2, { aspd: 3 }, '+3% attack speed per rank'),
    S('ram_crown', 'Crown of Fire', 0.6, 0.18, 'ram_charge', 1, { dmg_pct: 10, crit_dmg: 20 }, '+10% damage and +20% critical damage'),
  ] },
  { id: 'taurus', name: 'The Bull', glyph: '♉', theme: 'Endurance', stars: [
    S('bull_hide', 'Thick Hide', 0.25, 0.7, null, 3, { vit: 3 }, '+3 Vitality per rank'),
    S('bull_heart', 'Bull Heart', 0.5, 0.45, 'bull_hide', 3, { life_pct: 4 }, '+4% maximum life per rank'),
    S('bull_stand', 'Planted Hooves', 0.8, 0.7, 'bull_heart', 3, { armor_pct: 5 }, '+5% armor per rank'),
    S('bull_star', 'Eye of the Bull', 0.55, 0.15, 'bull_heart', 1, { life_pct: 8, regen: 3 }, '+8% maximum life and +3 life per second'),
  ] },
  { id: 'gemini', name: 'The Twins', glyph: '♊', theme: 'Speed and luck', stars: [
    S('twin_feet', 'Light Feet', 0.3, 0.8, null, 3, { dex: 3 }, '+3 Dexterity per rank'),
    S('twin_edge', 'Twin Edge', 0.3, 0.45, 'twin_feet', 3, { crit: 1 }, '+1% critical chance per rank'),
    S('twin_step', 'Mirror Step', 0.7, 0.8, 'twin_feet', 2, { move_pct: 3 }, '+3% movement speed per rank'),
    S('twin_flurry', 'Flurry', 0.7, 0.45, 'twin_step', 3, { aspd: 2 }, '+2% attack speed per rank'),
    S('twin_bond', 'The Bond', 0.5, 0.12, 'twin_edge', 1, { crit: 3, aspd: 5 }, '+3% critical chance and +5% attack speed'),
  ] },
  { id: 'cancer', name: 'The Crab', glyph: '♋', theme: 'Defense', stars: [
    S('crab_shell', 'Hard Shell', 0.5, 0.8, null, 3, { armor: 15 }, '+15 armor per rank'),
    S('crab_claw', 'Pincer', 0.2, 0.45, 'crab_shell', 2, { leech: 0.5 }, '+0.5% life stolen per hit per rank'),
    S('crab_tide', 'Tidal Blood', 0.8, 0.45, 'crab_shell', 3, { life: 25 }, '+25 maximum life per rank'),
    S('crab_moon', 'Moon Shell', 0.5, 0.15, 'crab_tide', 1, { armor_pct: 15 }, '+15% armor'),
  ] },
  { id: 'leo', name: 'The Lion', glyph: '♌', theme: 'Glory', stars: [
    S('lion_mane', 'Golden Mane', 0.15, 0.6, null, 3, { all: 2 }, '+2 to all attributes per rank'),
    S('lion_roar', 'Roar', 0.4, 0.3, 'lion_mane', 3, { fire: 4 }, '+4 fire damage per rank'),
    S('lion_pride', 'Pride', 0.7, 0.3, 'lion_roar', 3, { dmg_pct: 5 }, '+5% damage per rank'),
    S('lion_heart', 'Heart of the Lion', 0.85, 0.7, 'lion_pride', 1, { all: 5, crit_dmg: 25 }, '+5 to all attributes and +25% critical damage'),
  ] },
  { id: 'virgo', name: 'The Maiden', glyph: '♍', theme: 'Fortune', stars: [
    S('maid_eye', 'Keen Eye', 0.2, 0.25, null, 3, { magic_find: 8 }, '+8% magic find per rank'),
    S('maid_purse', 'Full Purse', 0.5, 0.4, 'maid_eye', 3, { gold_find: 10 }, '+10% gold found per rank'),
    S('maid_lore', 'Old Lore', 0.75, 0.25, 'maid_purse', 3, { xp_pct: 4 }, '+4% experience per rank'),
    S('maid_harvest', 'Harvest Star', 0.6, 0.82, 'maid_purse', 1, { magic_find: 20, xp_pct: 6 }, '+20% magic find and +6% experience'),
  ] },
  { id: 'libra', name: 'The Scales', glyph: '♎', theme: 'Balance of mind', stars: [
    S('scale_mind', 'Clear Mind', 0.5, 0.8, null, 3, { mag: 3 }, '+3 Magic per rank'),
    S('scale_left', 'Left Pan', 0.2, 0.45, 'scale_mind', 3, { mana: 20 }, '+20 maximum mana per rank'),
    S('scale_right', 'Right Pan', 0.8, 0.45, 'scale_mind', 3, { life: 20 }, '+20 maximum life per rank'),
    S('scale_beam', 'The Beam', 0.5, 0.15, 'scale_left', 1, { mana_pct: 10, life_pct: 5 }, '+10% maximum mana and +5% maximum life'),
  ] },
  { id: 'scorpio', name: 'The Scorpion', glyph: '♏', theme: 'Venom', stars: [
    S('scorp_sting', 'Sting', 0.15, 0.3, null, 3, { poison: 4 }, '+4 poison damage per rank'),
    S('scorp_aim', 'True Aim', 0.4, 0.5, 'scorp_sting', 3, { crit: 1.5 }, '+1.5% critical chance per rank'),
    S('scorp_drink', 'Drink Deep', 0.65, 0.65, 'scorp_aim', 2, { leech: 0.5 }, '+0.5% life stolen per hit per rank'),
    S('scorp_tail', 'Raised Tail', 0.88, 0.3, 'scorp_drink', 1, { crit_dmg: 30, poison: 10 }, '+30% critical damage and +10 poison damage'),
  ] },
  { id: 'sagittarius', name: 'The Archer', glyph: '♐', theme: 'Precision', stars: [
    S('arch_draw', 'Steady Draw', 0.15, 0.8, null, 3, { dex: 3 }, '+3 Dexterity per rank'),
    S('arch_loose', 'Quick Loose', 0.4, 0.55, 'arch_draw', 3, { aspd: 3 }, '+3% attack speed per rank'),
    S('arch_hunt', 'The Hunt', 0.65, 0.75, 'arch_loose', 2, { move_pct: 4 }, '+4% movement speed per rank'),
    S('arch_arrow', 'Star Arrow', 0.85, 0.2, 'arch_loose', 1, { crit: 4, dmg_pct: 6 }, '+4% critical chance and +6% damage'),
  ] },
  { id: 'capricorn', name: 'The Sea-Goat', glyph: '♑', theme: 'Stubbornness', stars: [
    S('goat_climb', 'Mountain Blood', 0.2, 0.2, null, 3, { vit: 4 }, '+4 Vitality per rank'),
    S('goat_horn', 'Iron Horn', 0.45, 0.45, 'goat_climb', 3, { armor: 20 }, '+20 armor per rank'),
    S('goat_tail', 'Sea Tail', 0.75, 0.6, 'goat_horn', 2, { regen: 1.5 }, '+1.5 life per second per rank'),
    S('goat_peak', 'The Summit', 0.4, 0.85, 'goat_horn', 1, { life_pct: 10 }, '+10% maximum life'),
  ] },
  { id: 'aquarius', name: 'The Water-Bearer', glyph: '♒', theme: 'Frost and spells', stars: [
    S('aqua_chill', 'Cold Water', 0.15, 0.45, null, 3, { cold: 4 }, '+4 cold damage per rank'),
    S('aqua_well', 'Deep Well', 0.4, 0.25, 'aqua_chill', 3, { mana_pct: 5 }, '+5% maximum mana per rank'),
    S('aqua_pour', 'The Pouring', 0.65, 0.45, 'aqua_well', 3, { spell: 6 }, '+6% spell damage per rank'),
    S('aqua_urn', 'Star Urn', 0.88, 0.25, 'aqua_pour', 1, { spell: 15, mag: 8 }, '+15% spell damage and +8 Magic'),
  ] },
  { id: 'pisces', name: 'The Fish', glyph: '♓', theme: 'Companions and storms', stars: [
    S('fish_school', 'The School', 0.2, 0.3, null, 3, { pet_pct: 8 }, '+8% companion damage and life per rank'),
    S('fish_spark', 'Sea Spark', 0.2, 0.75, null, 3, { light: 4 }, '+4 lightning damage per rank'),
    S('fish_cord', 'The Cord', 0.5, 0.5, 'fish_school', 2, { regen: 1 }, '+1 life per second per rank'),
    S('fish_pair', 'Twin Fish', 0.82, 0.5, 'fish_cord', 1, { pet_pct: 20, gold_find: 20 }, '+20% companion damage and life, +20% gold found'),
  ] },
];

// ---- v0.6: every sign grows to eight or nine stars. Compact records: [id, name, x, y, from, ranks, eff]
const LBL = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', mag: 'Magic', all: 'to all attributes', life: 'maximum life', mana: 'maximum mana', armor: 'armor', dmg_pct: '% damage', aspd: '% attack speed', crit: '% critical chance', regen: 'life per second', leech: '% life stolen per hit', spell: '% spell damage', fire: 'fire damage', cold: 'cold damage', light: 'lightning damage', poison: 'poison damage', magic_find: '% magic find', gold_find: '% gold found', life_pct: '% maximum life', mana_pct: '% maximum mana', armor_pct: '% armor', xp_pct: '% experience', pet_pct: '% companion damage and life', move_pct: '% movement speed', crit_dmg: '% critical damage', dr: '% less damage taken', dodge: '% dodge', thorns: '% of damage taken reflected', life_kill: 'life per kill', mana_kill: 'mana per kill' };
const autoText = (eff, ranks) => Object.entries(eff).map(([k, v]) => { const l = LBL[k] || k; return l.startsWith('%') ? `+${v}${l}` : `+${v} ${l}`; }).join(' and ') + (ranks > 1 ? ' per rank' : '');
const EXTRA = {
  aries: [['ram_fury', 'Blood Fury', 0.1, 0.4, 'ram_horns', 2, { dmg_pct: 3, leech: 0.3 }], ['ram_hardhorn', 'Hardened Horns', 0.9, 0.3, 'ram_haste', 3, { armor_pct: 3, life_pct: 2 }], ['ram_warcry', 'Rally Cry', 0.28, 0.2, 'ram_charge', 2, { crit: 1, crit_dmg: 8 }], ['ram_stampede', 'Stampede', 0.55, 0.92, 'ram_haste', 2, { move_pct: 4, dmg_pct: 2 }], ['ram_apex', 'Apex of Wrath', 0.85, 0.08, 'ram_crown', 1, { str: 12, aspd: 6, dmg_pct: 6 }]],
  taurus: [['bull_ox', 'Ox Strength', 0.1, 0.4, 'bull_hide', 3, { str: 2, vit: 2 }], ['bull_root', 'Rooted', 0.35, 0.92, 'bull_hide', 2, { dr: 2 }], ['bull_gore', 'Gore', 0.9, 0.4, 'bull_stand', 2, { thorns: 5, dmg_pct: 2 }], ['bull_feast', 'Harvest Feast', 0.8, 0.12, 'bull_star', 2, { regen: 1.5, life_kill: 1 }], ['bull_titan', 'Titan Hide', 0.3, 0.12, 'bull_star', 1, { life_pct: 6, armor_pct: 10, dr: 3 }]],
  gemini: [['twin_mirror', 'Mirror Image', 0.1, 0.55, 'twin_edge', 2, { dodge: 2 }], ['twin_gambit', 'Gambit', 0.9, 0.55, 'twin_flurry', 2, { crit_dmg: 8, gold_find: 5 }], ['twin_whisper', 'Whisper', 0.5, 0.65, 'twin_step', 3, { dex: 2, mag: 2 }], ['twin_spark', 'Twin Spark', 0.82, 0.12, 'twin_flurry', 2, { light: 3, aspd: 2 }], ['twin_eclipse', 'Eclipse', 0.18, 0.12, 'twin_edge', 1, { crit: 4, dodge: 4, move_pct: 5 }]],
  cancer: [['crab_tide2', 'Rising Tide', 0.1, 0.8, 'crab_claw', 2, { life_kill: 1.5, regen: 1 }], ['crab_armor', 'Barnacle Plate', 0.9, 0.8, 'crab_tide', 3, { armor_pct: 4, dr: 1 }], ['crab_pearl', 'Hidden Pearl', 0.5, 0.58, 'crab_shell', 3, { gold_find: 6, magic_find: 4 }], ['crab_snap', 'Snap', 0.12, 0.15, 'crab_claw', 2, { thorns: 6, leech: 0.3 }], ['crab_moon2', 'Moonlit Shore', 0.88, 0.15, 'crab_moon', 1, { life_pct: 6, mana_pct: 6, regen: 3 }]],
  leo: [['lion_hunt', 'The Hunt', 0.12, 0.2, 'lion_mane', 2, { dmg_pct: 3, crit: 0.8 }], ['lion_sun', 'Sun Crown', 0.55, 0.12, 'lion_roar', 2, { fire: 3, spell: 3 }], ['lion_claw', 'Rending Claws', 0.5, 0.62, 'lion_roar', 3, { str: 2, aspd: 1.5 }], ['lion_throne', 'Throne', 0.9, 0.15, 'lion_pride', 2, { xp_pct: 3, gold_find: 4 }], ['lion_king', 'The Lion King', 0.7, 0.88, 'lion_heart', 1, { dmg_pct: 12, life_pct: 8, crit_dmg: 20 }]],
  virgo: [['maid_grace', 'Grace', 0.08, 0.6, 'maid_eye', 2, { dodge: 1.5, move_pct: 2 }], ['maid_sheaf', 'Golden Sheaf', 0.88, 0.62, 'maid_lore', 3, { gold_find: 6, life_pct: 1.5 }], ['maid_balm', 'Healing Balm', 0.3, 0.8, 'maid_purse', 2, { regen: 1.5, life_kill: 1 }], ['maid_scholar', 'Scholar', 0.45, 0.1, 'maid_eye', 2, { mag: 3, mana_pct: 2 }], ['maid_virtue', 'Virtue', 0.9, 0.9, 'maid_harvest', 1, { all: 4, magic_find: 15, xp_pct: 5 }]],
  libra: [['scale_law', 'Law', 0.1, 0.85, 'scale_mind', 3, { armor: 8, dr: 1 }], ['scale_chaos', 'Chaos', 0.9, 0.85, 'scale_mind', 3, { crit: 1, spell: 3 }], ['scale_weigh', 'Weighing', 0.5, 0.52, 'scale_mind', 2, { mana_kill: 1, life_kill: 1 }], ['scale_verdict', 'Verdict', 0.2, 0.12, 'scale_left', 2, { mana: 15, spell: 3 }], ['scale_justice', 'Perfect Justice', 0.8, 0.12, 'scale_right', 1, { life_pct: 6, mana_pct: 6, dr: 4 }]],
  scorpio: [['scorp_venom', 'Potent Venom', 0.1, 0.65, 'scorp_sting', 3, { poison: 3, crit: 0.5 }], ['scorp_claw', 'Pincers', 0.4, 0.88, 'scorp_aim', 2, { dmg_pct: 3, aspd: 2 }], ['scorp_shell', 'Chitin', 0.9, 0.55, 'scorp_drink', 2, { armor_pct: 4, thorns: 4 }], ['scorp_ambush', 'Ambush', 0.65, 0.12, 'scorp_aim', 2, { crit_dmg: 10, dodge: 1 }], ['scorp_antares', 'Heart of Antares', 0.5, 0.45, 'scorp_aim', 1, { poison: 12, dmg_pct: 8, leech: 1 }]],
  sagittarius: [['arch_eye', 'Hawk Eye', 0.1, 0.5, 'arch_draw', 3, { crit: 1, dex: 1 }], ['arch_barb', 'Barbed Heads', 0.65, 0.4, 'arch_loose', 2, { dmg_pct: 3, poison: 2 }], ['arch_wind', 'Following Wind', 0.4, 0.9, 'arch_hunt', 2, { move_pct: 3, dodge: 1 }], ['arch_quiver', 'Deep Quiver', 0.88, 0.62, 'arch_hunt', 3, { gold_find: 4, life_kill: 1 }], ['arch_centaur', 'Centaur Spirit', 0.5, 0.1, 'arch_arrow', 1, { dex: 10, aspd: 8, move_pct: 8 }]],
  capricorn: [['goat_craft', 'Craft of Ages', 0.08, 0.6, 'goat_climb', 3, { gold_find: 4, armor: 6 }], ['goat_ice', 'Glacier Heart', 0.7, 0.2, 'goat_horn', 3, { cold: 3, armor_pct: 2 }], ['goat_grit', 'Grit', 0.9, 0.5, 'goat_tail', 2, { dr: 2, life_kill: 1 }], ['goat_ledge', 'Narrow Ledge', 0.2, 0.9, 'goat_peak', 2, { dodge: 1.5, thorns: 4 }], ['goat_apex', 'Roof of the World', 0.65, 0.9, 'goat_peak', 1, { life_pct: 6, armor_pct: 12, regen: 3 }]],
  aquarius: [['aqua_rain', 'Spring Rain', 0.08, 0.15, 'aqua_chill', 2, { regen: 1, mana_kill: 1 }], ['aqua_tide', 'Undertow', 0.4, 0.85, 'aqua_well', 3, { cold: 3, move_pct: 2 }], ['aqua_storm', 'Storm Water', 0.7, 0.8, 'aqua_pour', 2, { light: 3, spell: 3 }], ['aqua_flow', 'Flow State', 0.9, 0.62, 'aqua_pour', 3, { mana_pct: 3, aspd: 1.5 }], ['aqua_deluge', 'Deluge', 0.6, 0.1, 'aqua_urn', 1, { spell: 12, mana_pct: 8, cold: 8 }]],
  pisces: [['fish_deep', 'Deep Current', 0.5, 0.88, 'fish_cord', 2, { move_pct: 3, regen: 1 }], ['fish_pearl', 'Pearl Diver', 0.82, 0.88, 'fish_pair', 2, { magic_find: 8, gold_find: 4 }], ['fish_mist', 'Sea Mist', 0.5, 0.12, 'fish_school', 2, { dodge: 1.5, mana_pct: 2 }], ['fish_swarm', 'Swarm', 0.85, 0.15, 'fish_pair', 3, { pet_pct: 6, dmg_pct: 1.5 }], ['fish_tide2', 'Moon Tide', 0.1, 0.5, 'fish_school', 1, { pet_pct: 15, life_pct: 6, spell: 6 }]],
};
for (const sg of SIGNS) {
  const fixed = sg.stars.map((st) => ({ x: st.x, y: st.y }));
  const fresh = [];
  for (const [id, name, x, y, from, ranks, eff] of EXTRA[sg.id] || []) {
    const st = S(id, name, x, y, from, ranks, eff, autoText(eff, ranks));
    sg.stars.push(st); fresh.push(st);
  }
  // nudge new stars apart so the constellation stays readable
  for (let it = 0; it < 80; it++) for (const a of fresh) for (const b of sg.stars) {
    if (a === b) continue;
    const dx = a.x - b.x, dy = (a.y - b.y) * 0.75, d = Math.hypot(dx, dy);
    if (d < 0.17) { const push = (0.17 - d) / 2 + 0.002; const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0; a.x += nx * push; a.y += ny * push / 0.75; if (!fresh.includes(b)) { /* old stars stay */ } }
    a.x = Math.min(0.94, Math.max(0.06, a.x)); a.y = Math.min(0.9, Math.max(0.1, a.y));
  }
}

export const STARS = {};
for (const s of SIGNS) for (const st of s.stars) STARS[st.id] = { ...st, sign: s.id };

export const starRank = (id) => (G.stars && G.stars[id]) || 0;
export const starsSpent = () => Object.values(G.stars || {}).reduce((a, b) => a + b, 0);
export const starPointsTotal = () => Math.floor((G.lvl || 1) / 2);
export const starPoints = () => Math.max(0, starPointsTotal() - starsSpent());
export function canLearn(id) {
  const st = STARS[id];
  if (!st || starRank(id) >= st.ranks || starPoints() <= 0) return false;
  return !st.from || starRank(st.from) > 0;
}
export function learnStar(id) {
  if (!canLearn(id)) return false;
  G.stars = { ...(G.stars || {}), [id]: starRank(id) + 1 };
  return true;
}
export const signProgress = (sg) => ({ got: sg.stars.reduce((a, st) => a + starRank(st.id), 0), max: sg.stars.reduce((a, st) => a + st.ranks, 0) });
export const respecCost = () => Math.round(150 * (G.lvl || 1));
export function zodiacBonus(add) {
  for (const id in G.stars || {}) {
    const st = STARS[id], r = G.stars[id];
    if (!st || !r) continue;
    for (const k in st.eff) add(k, st.eff[k] * r);
  }
}
// signs where the hero has learned every star
export const signsCompleted = () => SIGNS.filter((s) => s.stars.every((st) => starRank(st.id) >= st.ranks)).length;
