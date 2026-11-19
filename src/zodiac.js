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
