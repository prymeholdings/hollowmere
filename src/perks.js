// Perks (passive skills) and timed buffs added in v0.6. Perk ranks sum into the same bonus table as item affixes
// and zodiac stars; buffs are timers in G.buffs whose stats are added live.
import { G } from './state.js';

// per rank values. stat keys: str dex vit mag life mana armor dmg_pct aspd crit regen leech spell fire cold light poison
// move_pct life_pct mana_pct armor_pct crit_dmg pet_pct xp_pct gold_find magic_find, and v0.6 keys:
// dodge (% chance), dr (% less damage taken), thorns (% of damage taken returned), life_kill, mana_kill (restored per kill)
const P = (name, icon, eff, per) => ({ name, icon, eff, per });
export const PERKS = {
  berserker_rage: P('Berserker Rage', 'rage', { dmg_pct: 4, aspd: 2 }, '+4% damage, +2% attack speed'),
  unyielding: P('Unyielding', 'unyield', { dr: 2 }, '2% less damage taken'),
  battle_hardened: P('Battle Hardened', 'hardened', { life_pct: 3, armor_pct: 3 }, '+3% life, +3% armor'),
  executioner: P('Executioner', 'execperk', { crit_dmg: 10, crit: 0.5 }, '+10% critical damage, +0.5% crit'),
  thorned_hide: P('Thorned Hide', 'thorns', { thorns: 6 }, 'Reflect 6% of damage taken'),
  nimble: P('Nimble', 'nimble', { dodge: 1.5 }, '+1.5% dodge'),
  poisoners_craft: P("Poisoner's Craft", 'poisoner', { poison: 3 }, '+3 poison damage'),
  shadow_veil: P('Shadow Veil', 'veil', { move_pct: 3, dodge: 1 }, '+3% move speed, +1% dodge'),
  cutthroat: P('Cutthroat', 'cutthroat', { crit: 1, crit_dmg: 8 }, '+1% crit, +8% crit damage'),
  quick_hands: P('Quick Hands', 'quickhands', { aspd: 3 }, '+3% attack speed'),
  scavenger: P('Scavenger', 'scav', { life_kill: 2, gold_find: 4 }, '+2 life per kill, +4% gold'),
  mana_font: P('Mana Font', 'manafont', { mana_pct: 5, mana_kill: 0.5 }, '+5% mana, +0.5 mana per kill'),
  spell_weaving: P('Spell Weaving', 'weaving', { spell: 5 }, '+5% spell damage'),
  arcane_precision: P('Arcane Precision', 'precision', { crit: 0.8, spell: 3 }, '+0.8% crit, +3% spell damage'),
  sages_insight: P("Sage's Insight", 'sage', { xp_pct: 3, mag: 2 }, '+3% experience, +2 Magic'),
  radiant_soul: P('Radiant Soul', 'radiant', { regen: 1, light: 3 }, '+1 life/s, +3 light damage'),
  deathly_pact: P('Deathly Pact', 'pact', { life_pct: 3, leech: 0.3 }, '+3% life, +0.3% life steal'),
  curse_mastery: P('Curse Mastery', 'cursem', { spell: 4, poison: 2 }, '+4% spell damage, +2 poison'),
  soul_harvest: P('Soul Harvest', 'harvest', { mana_kill: 1.5, life_kill: 1 }, '+1.5 mana, +1 life per kill'),
  bone_armor: P('Bone Armor', 'bonearmor', { armor: 10, dr: 1 }, '+10 armor, 1% less damage taken'),
  dread_presence: P('Dread Presence', 'dread', { pet_pct: 6, dmg_pct: 2 }, '+6% companion strength, +2% damage'),
};
for (const k in PERKS) PERKS[k].id = k;
export const perkDesc = (id, r) => {
  const p = PERKS[id];
  return Object.entries(p.eff).map(([k, v]) => `+${+(v * r).toFixed(1)} ${LABEL[k] || k}`).join(', ') + '.';
};
const LABEL = { dmg_pct: '% damage', aspd: '% attack speed', dr: '% damage reduction', life_pct: '% life', armor_pct: '% armor', crit_dmg: '% crit damage', crit: '% crit', thorns: '% thorns', dodge: '% dodge', poison: 'poison', move_pct: '% move speed', mana_pct: '% mana', mana_kill: 'mana on kill', spell: '% spell damage', xp_pct: '% experience', mag: 'Magic', regen: 'life/s', light: 'light dmg', leech: '% life steal', pet_pct: '% companion', armor: 'armor', life_kill: 'life on kill', gold_find: '% gold' };

export function perkBonus(add) {
  const s = G.skills;
  if (!s) return;
  for (const id in PERKS) {
    const r = s[id] || 0;
    if (!r) continue;
    for (const k in PERKS[id].eff) add(k, PERKS[id].eff[k] * r);
  }
}
export const perkRanks = () => Object.keys(PERKS).reduce((a, k) => a + ((G.skills && G.skills[k]) || 0), 0);

// timed buffs: key -> display and stats while G.buffs[key] > 0
export const BUFF_DEFS = {
  mana_shield: { name: 'Mana Shield: 35% less damage', icon: 'manashield', stats: { dr: 35 } },
  divine: { name: 'Divine Shield: 75% less damage', icon: 'divine', stats: { dr: 75, regen: 15 } },
  frenzy: { name: 'Unholy Frenzy', icon: 'frenzy', stats: { aspd: 25, dmg_pct: 20, leech: 5 } },
  bulwark: { name: 'Bulwark: armor and 25% less damage', icon: 'bulwark', stats: { armor_pct: 60, dr: 25 } },
  rampage: { name: 'Rampage', icon: 'rampage', stats: { aspd: 30, dmg_pct: 25, move_pct: 15 } },
  bloodlust: { name: 'Bloodlust', icon: 'bloodlust', stats: { leech: 9, dmg_pct: 15 } },
  laststand: { name: 'Last Stand', icon: 'laststand', stats: { regen: 22, dr: 30 } },
  evasion: { name: 'Evasion: +40% dodge', icon: 'evasion', stats: { dodge: 40, move_pct: 20 } },
  vanish: { name: 'Vanish: +60% dodge', icon: 'vanishb', stats: { dodge: 60, move_pct: 30, crit: 20 } },
  timewarp: { name: 'Time Warp', icon: 'timewarp', stats: { aspd: 25, move_pct: 25 } },
  shadowform: { name: 'Shadow Form', icon: 'shadowform', stats: { dodge: 25, crit: 15 } },
};
export function liveBuff(stat) {
  const b = G.buffs;
  if (!b) return 0;
  let v = 0;
  for (const k in BUFF_DEFS) if (b[k] > 0) v += BUFF_DEFS[k].stats[stat] || 0;
  return v;
}
