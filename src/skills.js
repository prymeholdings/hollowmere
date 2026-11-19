import * as THREE from 'three';
import { G, stat, rollDamage, maxHp, critChance, critMult, itemBonus } from './state.js';
import { Projectile, Ally } from './entities.js';
import { flatDist, sfx, pick } from './util.js';

const mag = () => stat('mag');
const rank = (id) => G.skills[id] || 0;
const R = (id, base, per) => base * (1 + per * (rank(id) - 1));
const spellPower = () => (G.buffs.power > 0 ? 1.5 : 1) * (G.buffs.warcry > 0 ? 1.15 : 1) * (1 + 0.08 * rank('elemental')) * (1 + itemBonus('spell') / 100);
// synergies: each rank of the source skill adds pct% to this skill
export const SYNERGY = {
  firebolt: [['meteor', 8]], meteor: [['firebolt', 6]], lightning: [['nova', 4], ['blizzard', 4]],
  nova: [['blizzard', 6]], blizzard: [['nova', 6], ['lightning', 3]], slam: [['earthquake', 6]], earthquake: [['slam', 6], ['whirlwind', 3]],
  whirlwind: [['slam', 4]], knives: [['blades', 6]], blades: [['knives', 6], ['smoke', 3]], heal: [['bones', 5]],
  ice_lance: [['glacial', 6], ['nova', 3]], glacial: [['ice_lance', 6], ['blizzard', 4]], fire_wall: [['inferno', 6], ['firebolt', 3]], inferno: [['fire_wall', 6], ['meteor', 4]],
  venom: [['toxic_cloud', 6]], toxic_cloud: [['venom', 6]], ball_lightning: [['lightning', 6], ['conduit', 3]], cataclysm: [['meteor', 5], ['blizzard', 5], ['ball_lightning', 5]],
};
// slows from frost spells last longer with Cryomancy
const chill = (t) => t * (1 + 0.1 * rank('cryomancy'));
const syn = (id) => 1 + (SYNERGY[id] || []).reduce((a, [src, pct]) => a + rank(src) * pct / 100, 0);

export const SKILLS = {
  firebolt: { name: 'Firebolt', icon: 'fire', school: 'Fire', cost: () => 4 + rank('firebolt') * 1.5, cd: 0, anim: 'Spellcast_Shoot',
    dmg: () => R('firebolt', 6 + mag() * 1.1 + G.lvl * 1.5, 0.3) * spellPower() * syn('firebolt'),
    desc: (s) => `Hurls a bolt of fire for ${Math.round(s.dmg())} damage. At rank 5 it explodes on impact.` },
  lightning: { name: 'Chain Lightning', icon: 'bolt', school: 'Storm', cost: () => 10 + rank('lightning') * 2, cd: 0.8, anim: 'Spellcast_Shoot',
    dmg: () => R('lightning', 5 + mag() * 0.9 + G.lvl * 1.3, 0.25) * spellPower() * syn('lightning'), jumps: () => 2 + rank('lightning'),
    desc: (s) => `Lightning arcs between ${s.jumps() + 1} foes for ${Math.round(s.dmg())} damage each.` },
  nova: { name: 'Frost Nova', icon: 'frost', school: 'Frost', cost: () => 16 + rank('nova') * 2, cd: 4, anim: 'Spellcast_Raise',
    dmg: () => R('nova', 8 + mag() * 0.9 + G.lvl * 1.2, 0.3) * spellPower() * syn('nova'),
    desc: (s) => `Freezing blast around you: ${Math.round(s.dmg())} damage, slows enemies for 4s.` },
  meteor: { name: 'Meteor', icon: 'meteor', school: 'Fire', cost: () => 28 + rank('meteor') * 3, cd: 6, anim: 'Spellcast_Long',
    dmg: () => R('meteor', 20 + mag() * 2.2 + G.lvl * 3, 0.3) * spellPower() * syn('meteor'),
    desc: (s) => `Calls a meteor down at the cursor for ${Math.round(s.dmg())} damage in a wide area.` },
  blizzard: { name: 'Blizzard', icon: 'blizzard', school: 'Frost', cost: () => 34 + rank('blizzard') * 3, cd: 5, anim: 'Spellcast_Long',
    dmg: () => R('blizzard', 6 + mag() * 0.7 + G.lvl * 1.1, 0.28) * spellPower() * syn('blizzard'), dur: () => 4 + rank('blizzard') * 0.25,
    desc: (s) => `Ice storms the cursor area for ${s.dur().toFixed(1)}s, dealing ${Math.round(s.dmg())} damage twice a second and slowing foes.` },
  heal: { name: 'Mend Wounds', icon: 'heal', school: 'Light', cost: () => 12 + rank('heal'), cd: 3, anim: 'Spellcast_Raise',
    amount: () => R('heal', 18 + mag() * 1.6 + G.lvl * 2, 0.35) * syn('heal'),
    desc: (s) => `Restores ${Math.round(s.amount())} life to you and heals your pet.` },
  bones: { name: 'Raise Bones', icon: 'skull', school: 'Death', cost: () => 30 + rank('bones') * 2, cd: 20, anim: 'Spellcast_Raise',
    count: () => 1 + Math.ceil(rank('bones') / 3),
    desc: (s) => `Raises ${s.count()} skeleton warrior${s.count() > 1 ? 's' : ''} to fight for you for 30 seconds.` },
  whirlwind: { name: 'Whirlwind', icon: 'whirl', school: 'Might', cost: () => 12 + rank('whirlwind') * 1.5, cd: 2.5, anim: '2H_Melee_Attack_Spin',
    mult: () => R('whirlwind', 1.1, 0.2) * syn('whirlwind'),
    desc: (s) => `Spin with your weapon, hitting everything around you 3 times for ${Math.round(s.mult() * 100)}% weapon damage.` },
  slam: { name: 'Ground Slam', icon: 'slam', school: 'Might', cost: () => 9 + rank('slam'), cd: 2, anim: '2H_Melee_Attack_Chop',
    mult: () => R('slam', 1.8, 0.25) * syn('slam'),
    desc: (s) => `Smash the ground ahead for ${Math.round(s.mult() * 100)}% weapon damage and stun foes for 1.5s.` },
  earthquake: { name: 'Earthquake', icon: 'quake', school: 'Might', cost: () => 30 + rank('earthquake') * 2, cd: 8, anim: '2H_Melee_Attack_Slice',
    mult: () => R('earthquake', 1.4, 0.22) * syn('earthquake'),
    desc: (s) => `Three shockwaves roll out from you, each dealing ${Math.round(s.mult() * 100)}% weapon damage and stunning for 1s.` },
  knives: { name: 'Fan of Knives', icon: 'knives', school: 'Cunning', cost: () => 8 + rank('knives'), cd: 0.6, anim: 'Throw',
    mult: () => R('knives', 0.7, 0.2) * syn('knives'), count: () => 4 + Math.ceil(rank('knives') / 2),
    desc: (s) => `Throws ${s.count()} knives in a fan, each dealing ${Math.round(s.mult() * 100)}% weapon damage.` },
  blink: { name: 'Shadow Step', icon: 'blink', school: 'Cunning', cost: () => 10, cd: () => Math.max(1.5, 5 - rank('blink') * 0.35), anim: 'Dodge_Forward',
    desc: (s) => `Vanish and reappear at the cursor. ${s.cdv().toFixed(1)}s cooldown.` },
  smoke: { name: 'Smoke Bomb', icon: 'smoke', school: 'Cunning', cost: () => 14, cd: () => Math.max(5, 12 - rank('smoke') * 0.5), anim: 'Throw',
    dur: () => 2.5 + rank('smoke') * 0.25,
    desc: (s) => `Blinds nearby foes for ${s.dur().toFixed(1)}s and gives you +30% dodge for 5s.` },
  blades: { name: 'Rain of Blades', icon: 'blades', school: 'Cunning', cost: () => 24 + rank('blades') * 2, cd: 4, anim: 'Spellcast_Raise',
    mult: () => R('blades', 0.6, 0.18) * syn('blades'),
    desc: (s) => `Blades fall on the cursor area for 3s, about 10 strikes of ${Math.round(s.mult() * 100)}% weapon damage.` },
  // ---- Elements tree
  ice_lance: { name: 'Ice Lance', icon: 'icelance', school: 'Frost', cost: () => 6 + rank('ice_lance'), cd: 0, anim: 'Spellcast_Shoot',
    dmg: () => R('ice_lance', 7 + mag() * 1.0 + G.lvl * 1.4, 0.28) * spellPower() * syn('ice_lance'),
    desc: (s) => `A shard of ice pierces through every foe in a line for ${Math.round(s.dmg())} damage and chills them.` },
  venom: { name: 'Venom Bolt', icon: 'venom', school: 'Poison', cost: () => 7 + rank('venom'), cd: 0.3, anim: 'Spellcast_Shoot',
    dmg: () => R('venom', 5 + mag() * 0.8 + G.lvl * 1.2, 0.3) * spellPower() * syn('venom'),
    desc: (s) => `A glob of venom poisons its target for ${Math.round(s.dmg() * 5)} damage over 5 seconds. Poison stacks with other poisons.` },
  fire_wall: { name: 'Wall of Flame', icon: 'firewall', school: 'Fire', cost: () => 22 + rank('fire_wall') * 2, cd: 3, anim: 'Spellcast_Long',
    dmg: () => R('fire_wall', 5 + mag() * 0.6 + G.lvl * 0.9, 0.28) * spellPower() * syn('fire_wall'), dur: () => 4 + rank('fire_wall') * 0.2,
    desc: (s) => `Raises a wall of fire at the cursor for ${s.dur().toFixed(1)}s, burning anything inside for ${Math.round(s.dmg())} damage 2.5 times a second.` },
  toxic_cloud: { name: 'Toxic Cloud', icon: 'toxic', school: 'Poison', cost: () => 20 + rank('toxic_cloud') * 2, cd: 4, anim: 'Spellcast_Raise',
    dmg: () => R('toxic_cloud', 4 + mag() * 0.5 + G.lvl * 0.8, 0.3) * spellPower() * syn('toxic_cloud'), dur: () => 6 + rank('toxic_cloud') * 0.3,
    desc: (s) => `A choking cloud lingers at the cursor for ${s.dur().toFixed(1)}s. Foes inside are poisoned for ${Math.round(s.dmg())} damage per second and slowed.` },
  glacial: { name: 'Glacial Spike', icon: 'glacial', school: 'Frost', cost: () => 26 + rank('glacial') * 2, cd: 5, anim: 'Spellcast_Long',
    dmg: () => R('glacial', 18 + mag() * 1.8 + G.lvl * 2.6, 0.3) * spellPower() * syn('glacial'), freeze: () => 1.5 + rank('glacial') * 0.1,
    desc: (s) => `A huge spike of ice erupts at the cursor for ${Math.round(s.dmg())} damage, freezing foes solid for ${s.freeze().toFixed(1)}s.` },
  ball_lightning: { name: 'Ball Lightning', icon: 'ballzap', school: 'Storm', cost: () => 24 + rank('ball_lightning') * 2, cd: 2.5, anim: 'Spellcast_Shoot',
    dmg: () => R('ball_lightning', 5 + mag() * 0.55 + G.lvl * 0.8, 0.26) * spellPower() * syn('ball_lightning'),
    desc: (s) => `Releases a slow sphere of lightning that drifts forward for 3s, zapping up to 2 nearby foes 4 times a second for ${Math.round(s.dmg())} damage.` },
  inferno: { name: 'Inferno', icon: 'inferno', school: 'Fire', cost: () => 30 + rank('inferno') * 2.5, cd: 4, anim: 'Spellcast_Shoot',
    dmg: () => R('inferno', 16 + mag() * 1.6 + G.lvl * 2.2, 0.3) * spellPower() * syn('inferno'),
    desc: (s) => `Breathes a cone of fire for ${Math.round(s.dmg())} damage and sets foes ablaze for another ${Math.round(s.dmg() * 0.6)} over 3s.` },
  cataclysm: { name: 'Cataclysm', icon: 'cataclysm', school: 'Elements', cost: () => 60 + rank('cataclysm') * 4, cd: 22, anim: 'Spellcast_Raise',
    dmg: () => R('cataclysm', 14 + mag() * 1.3 + G.lvl * 2, 0.28) * spellPower() * syn('cataclysm'), dur: () => 5 + rank('cataclysm') * 0.2,
    desc: (s) => `For ${s.dur().toFixed(1)}s the elements rage around you: falling fire, lightning and ice strike nearby foes for ${Math.round(s.dmg())} damage each.` },
  warcry: { name: 'Battle Cry', icon: 'cry', school: 'Might', cost: () => 15, cd: 18, anim: 'Cheer',
    dur: () => 10 + rank('warcry') * 1.5,
    desc: (s) => `+30% damage and +40 armor for ${s.dur().toFixed(0)}s. Nearby foes are slowed.` },
};
for (const k in SKILLS) {
  const s = SKILLS[k];
  s.id = k;
  s.cdv = () => (typeof s.cd === 'function' ? s.cd() : s.cd);
}

export const PASSIVES = {
  mastery: { name: 'Weapon Mastery', icon: 'mastery', desc: (r) => `+${r * 10}% weapon damage and +${r * 3}% attack speed.` , per: '+10% weapon damage, +3% attack speed' },
  toughness: { name: 'Iron Skin', icon: 'toughness', desc: (r) => `+${r * 8}% maximum life and +${r * 5} armor.`, per: '+8% life, +5 armor' },
  brutality: { name: 'Brutality', icon: 'brutal', desc: (r) => `Critical hits deal ${200 + r * 15}% damage.`, per: '+15% critical damage' },
  second_wind: { name: 'Second Wind', icon: 'wind', desc: (r) => `+${(r * 0.6).toFixed(1)} life per second.`, per: '+0.6 life regeneration' },
  arcane_flow: { name: 'Arcane Flow', icon: 'arcane', desc: (r) => `+${r * 6}% maximum mana and +${r * 12}% mana regeneration.`, per: '+6% mana, +12% mana regen' },
  elemental: { name: 'Elemental Mastery', icon: 'elemental', desc: (r) => `+${r * 8}% damage with all spells.`, per: '+8% spell damage' },
  swift_feet: { name: 'Swift Feet', icon: 'feet', desc: (r) => `+${r * 4}% movement speed.`, per: '+4% movement speed' },
  pet_bond: { name: 'Pet Bond', icon: 'pet_bond', desc: (r) => `+${r * 15}% pet damage and life.`, per: '+15% pet damage and life' },
  lethality: { name: 'Lethality', icon: 'lethal', desc: (r) => `+${(r * 1.5).toFixed(1)}% critical hit chance.`, per: '+1.5% critical chance' },
  bloodthirst: { name: 'Bloodthirst', icon: 'blood', desc: (r) => `${(r * 0.5).toFixed(1)}% of weapon damage heals you.`, per: '+0.5% life steal' },
  pyromancy: { name: 'Pyromancy', icon: 'pyro', desc: (r) => `+${r * 10}% fire damage. Fire sets foes ablaze for ${r * 5}% extra damage.`, per: '+10% fire damage, +5% burn' },
  cryomancy: { name: 'Cryomancy', icon: 'cryo', desc: (r) => `+${r * 10}% frost damage. Chills last ${r * 10}% longer.`, per: '+10% frost damage, longer chills' },
  conduit: { name: 'Conduit', icon: 'conduit', desc: (r) => `+${r * 10}% lightning and poison damage. Lightning has a ${r * 3}% chance to stun.`, per: '+10% storm/poison damage, +3% stun' },
  fortune: { name: "Fortune's Favor", icon: 'fortune', desc: (r) => `+${r * 8}% gold and magic find.`, per: '+8% gold and magic find' },
};
for (const k in PASSIVES) PASSIVES[k].id = k;

// Three skill trees. tier = row (level gate), col = column, req = prerequisites (rank 1 needed)
export const TIER_LEVEL = [1, 6, 12, 18, 30];
export const MAX_ACTIVE = 15, MAX_PASSIVE = 10;
export const TREES = [
  { id: 'might', name: 'Might', color: '#e0a050', nodes: [
    { id: 'slam', tier: 0, col: 0 }, { id: 'mastery', tier: 0, col: 1 }, { id: 'toughness', tier: 0, col: 2 },
    { id: 'warcry', tier: 1, col: 0, req: ['slam'] }, { id: 'whirlwind', tier: 1, col: 1, req: ['mastery'] },
    { id: 'brutality', tier: 2, col: 1, req: ['whirlwind'] }, { id: 'second_wind', tier: 2, col: 2, req: ['toughness'] },
    { id: 'earthquake', tier: 3, col: 0, req: ['warcry', 'whirlwind'] }] },
  { id: 'sorcery', name: 'Sorcery', color: '#8ab8ff', nodes: [
    { id: 'firebolt', tier: 0, col: 0 }, { id: 'heal', tier: 0, col: 1 }, { id: 'arcane_flow', tier: 0, col: 2 },
    { id: 'lightning', tier: 1, col: 0, req: ['firebolt'] }, { id: 'nova', tier: 1, col: 2, req: ['arcane_flow'] },
    { id: 'meteor', tier: 2, col: 0, req: ['lightning'] }, { id: 'bones', tier: 2, col: 1, req: ['heal'] }, { id: 'elemental', tier: 2, col: 2, req: ['nova'] },
    { id: 'blizzard', tier: 3, col: 2, req: ['elemental'] }] },
  { id: 'cunning', name: 'Cunning', color: '#b48aff', nodes: [
    { id: 'knives', tier: 0, col: 0 }, { id: 'swift_feet', tier: 0, col: 1 }, { id: 'pet_bond', tier: 0, col: 2 },
    { id: 'lethality', tier: 1, col: 0, req: ['knives'] }, { id: 'blink', tier: 1, col: 1, req: ['swift_feet'] },
    { id: 'bloodthirst', tier: 2, col: 0, req: ['lethality'] }, { id: 'smoke', tier: 2, col: 1, req: ['blink'] }, { id: 'fortune', tier: 2, col: 2, req: ['pet_bond'] },
    { id: 'blades', tier: 3, col: 0, req: ['bloodthirst', 'smoke'] }] },
  { id: 'elements', name: 'Elements', color: '#5fd8a8', nodes: [
    { id: 'ice_lance', tier: 0, col: 0 }, { id: 'pyromancy', tier: 0, col: 1 }, { id: 'venom', tier: 0, col: 2 },
    { id: 'cryomancy', tier: 1, col: 0, req: ['ice_lance'] }, { id: 'fire_wall', tier: 1, col: 1, req: ['pyromancy'] }, { id: 'toxic_cloud', tier: 1, col: 2, req: ['venom'] },
    { id: 'glacial', tier: 2, col: 0, req: ['cryomancy'] }, { id: 'conduit', tier: 2, col: 2, req: ['toxic_cloud'] },
    { id: 'inferno', tier: 3, col: 1, req: ['fire_wall'] }, { id: 'ball_lightning', tier: 3, col: 2, req: ['conduit'] },
    { id: 'cataclysm', tier: 4, col: 1, req: ['inferno', 'glacial'] }] },
];
// damage multiplier for elemental affinities (used when foes take damage)
export function affinity(kind) {
  if (kind === 'fire') return 1 + 0.1 * rank('pyromancy');
  if (kind === 'frost') return 1 + 0.1 * rank('cryomancy');
  if (kind === 'storm' || kind === 'poison') return 1 + 0.1 * rank('conduit');
  return 1;
}
export const burnPct = () => 0.05 * rank('pyromancy');
export const stunChance = () => 0.03 * rank('conduit');
export const NODE = {};
for (const t of TREES) for (const n of t.nodes) NODE[n.id] = { ...n, tree: t.id };
export const isActive = (id) => !!SKILLS[id];
export const maxRank = (id) => (isActive(id) ? MAX_ACTIVE : MAX_PASSIVE);
export const skillName = (id) => (SKILLS[id] || PASSIVES[id]).name;
export const skillIconKey = (id) => (SKILLS[id] || PASSIVES[id]).icon;
export function treePoints(treeId) { return TREES.find((t) => t.id === treeId).nodes.reduce((a, n) => a + rank(n.id), 0); }
export function learnBlock(id) {
  const n = NODE[id];
  if (!n) return 'Unknown skill';
  if (rank(id) >= maxRank(id)) return 'Maximum rank';
  if (G.lvl < TIER_LEVEL[n.tier]) return `Requires level ${TIER_LEVEL[n.tier]}`;
  const miss = (n.req || []).filter((r) => rank(r) < 1);
  if (miss.length) return `Requires ${miss.map(skillName).join(' and ')}`;
  if (G.skillPoints <= 0) return 'No skill points';
  return null;
}
export function synergyText(id) {
  const l = SYNERGY[id];
  if (!l) return '';
  return l.map(([src, pct]) => `+${pct}% per rank of ${skillName(src)} (${rank(src)})`).join('<br>');
}

export const CLASSES = {
  Knight: { title: 'Knight', model: 'Knight', desc: 'A sworn shield of Hollowmere. Tough, steady, and hard to kill.', base: { str: 14, dex: 9, vit: 15, mag: 6 }, skills: { slam: 1, toughness: 1 }, hotbar: { rmb: 'slam', q: 'warcry', w: 'heal', e: 'whirlwind', r: 'earthquake' }, weapon: 'Iron Sword', cape: '#8c1f1f',
    gear: [{ key: 'sword_shield', label: 'Sword and shield', weapon: ['1H_Sword'], offhand: ['Round_Shield'] }, { key: 'sword_badge', label: 'Sword and crest shield', weapon: ['1H_Sword'], offhand: ['Badge_Shield'] }, { key: 'sword_tower', label: 'Sword and tower shield', weapon: ['1H_Sword'], offhand: ['Rectangle_Shield'] }, { key: 'greatsword', label: 'Greatsword', weapon: ['2H_Sword'], offhand: [] }, { key: 'dual', label: 'Twin swords', weapon: ['1H_Sword'], offhand: ['1H_Sword_Offhand'] }], headgear: 'Knight_Helmet' },
  Barbarian: { title: 'Berserker', model: 'Barbarian', desc: 'A wild axe-swinger from the northern fells. Fast, brutal, reckless.', base: { str: 16, dex: 12, vit: 12, mag: 4 }, skills: { whirlwind: 1, mastery: 1 }, hotbar: { rmb: 'whirlwind', q: 'warcry', w: 'slam', e: 'heal', r: 'earthquake' }, weapon: 'Hand Axe', cape: '#3a5a2a',
    gear: [{ key: 'axe_shield', label: 'Axe and shield', weapon: ['1H_Axe'], offhand: ['Barbarian_Round_Shield'] }, { key: 'greataxe', label: 'Great axe', weapon: ['2H_Axe'], offhand: [] }, { key: 'dual', label: 'Twin axes', weapon: ['1H_Axe'], offhand: ['1H_Axe_Offhand'] }, { key: 'mug', label: 'Axe and ale', weapon: ['1H_Axe'], offhand: ['Mug'] }], headgear: 'Barbarian_Hat' },
  Mage: { title: 'Mage', model: 'Mage', desc: 'A scholar of the burning arts. Fragile, but devastating from afar.', base: { str: 6, dex: 9, vit: 9, mag: 20 }, skills: { firebolt: 1, arcane_flow: 1 }, hotbar: { rmb: 'firebolt', q: 'heal', w: 'nova', e: 'lightning', r: 'meteor' }, weapon: 'Ashwood Staff', cape: '#4a2a7a',
    gear: [{ key: 'staff_book', label: 'Staff and tome', weapon: ['2H_Staff'], offhand: ['Spellbook'] }, { key: 'staff', label: 'Staff only', weapon: ['2H_Staff'], offhand: [] }, { key: 'wand_book', label: 'Wand and open tome', weapon: ['1H_Wand'], offhand: ['Spellbook_open'] }, { key: 'wand', label: 'Wand only', weapon: ['1H_Wand'], offhand: [] }], headgear: 'Mage_Hat' },
  Rogue: { title: 'Rogue', model: 'Rogue', alt: 'Rogue_Hooded', desc: 'A quick blade from the alleys of the old city. Strikes first, never stays.', base: { str: 10, dex: 17, vit: 10, mag: 7 }, skills: { knives: 1, swift_feet: 1 }, hotbar: { rmb: 'knives', q: 'blink', w: 'smoke', e: 'heal', r: 'blades' }, weapon: 'Curved Dagger', cape: '#1f5a3a',
    gear: [{ key: 'daggers', label: 'Twin daggers', weapon: ['Knife'], offhand: ['Knife_Offhand'] }, { key: 'dagger_star', label: 'Dagger and throwing star', weapon: ['Knife'], offhand: ['Throwable'] }, { key: 'crossbow', label: 'Hand crossbow', weapon: ['1H_Crossbow'], offhand: ['Knife_Offhand'] }] },
};
export const CAPE_COLORS = ['#8c1f1f', '#1f3f8c', '#2f6a2a', '#4a2a7a', '#8a6a1a', '#1a1a1a', '#e0e0e0', '#1f5a5a', '#b04a8a', '#d06a1a'];
export const ARMOR_TINTS = ['#ffffff', '#c8d4ff', '#ffd8a8', '#b8e0b0', '#e0b8e8', '#9a9a9a', '#ffb0b0', '#fff0a0'];
export const PET_COATS = [{ key: 'fox', label: 'Ember fox', color: 0xe07a3a }, { key: 'arctic', label: 'Snow fox', color: 0xe8eef2 }, { key: 'shadow', label: 'Shadow fox', color: 0x3a3a46 }, { key: 'gold', label: 'Sun fox', color: 0xe8c040 }, { key: 'ash', label: 'Ash fox', color: 0x8a8278 }];

function enemies() { return G.level.entities.filter((e) => e.type === 'enemy' && !e.dead); }
function weaponHit(e, mult, kind = 'phys') {
  let d = rollDamage() * mult;
  const crit = Math.random() < critChance();
  if (crit) d *= critMult();
  e.takeDamage(d, crit, kind);
  return d;
}

export function canCast(id) {
  const s = SKILLS[id];
  if (!s || rank(id) < 1) return 'Not learned (press K)';
  if ((G.cds[id] || 0) > 0) return 'Not ready';
  if (G.mp < s.cost()) return 'Not enough mana';
  return null;
}

// persistent ground effects (Blizzard, Rain of Blades)
const zones = [];
export function clearZones() { zones.length = 0; }
export function updateZones(dt) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t += dt; z.acc += dt;
    z.vis?.(dt);
    while (z.acc >= z.every) { z.acc -= z.every; if (G.level) z.tick(); }
    if (z.t >= z.dur) zones.splice(i, 1);
  }
}

export function cast(id, at, targetEnt) {
  const s = SKILLS[id];
  const err = canCast(id);
  if (err) { G.main.flash(err); return false; }
  const P = G.player;
  if (id === 'blink' && (!G.level.walkable(at) || flatDist(at, P.pos) > 12)) { G.main.flash("Can't step there"); return false; }
  G.mp -= s.cost();
  G.cds[id] = s.cdv();
  P.face(at);
  P.path = [];
  P.target = null;
  P.castLock = 0.35;
  P.model.once(s.anim, { timeScale: id === 'whirlwind' ? 1.3 : 1.4 });
  const fx = G.main.fx;
  const pos = P.pos.clone();
  const dir = new THREE.Vector3(at.x - pos.x, 0, at.z - pos.z);
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();
  switch (id) {
    case 'firebolt': {
      const p = new Projectile(dir, s.dmg(), 'enemy', 0xff7a1a, { trail: 0xff8833, kind: 'fire', explode: rank('firebolt') >= 5 });
      p.root.position.copy(pos).addScaledVector(dir, 0.7);
      G.level.add(p);
      sfx('fire');
      break;
    }
    case 'lightning': {
      const list = enemies();
      let cur = targetEnt && targetEnt.type === 'enemy' && !targetEnt.dead ? targetEnt : null;
      if (!cur) { let bd = 9; for (const e of list) { const d = flatDist(e.pos, at); if (d < bd && flatDist(e.pos, pos) < 14) { bd = d; cur = e; } } }
      let from = pos.clone().setY(1.2);
      const hit = new Set();
      if (!cur) { fx.beam(from, at.clone().setY(0.5).sub(pos).clampLength(0, 8).add(pos).setY(0.5), 0x99ccff); sfx('zap'); break; }
      for (let j = 0; j <= s.jumps() && cur; j++) {
        const to = cur.pos.clone().setY(1.0);
        fx.beam(from, to, 0x9fd0ff);
        cur.takeDamage(s.dmg() * (1 - j * 0.08), false, 'storm');
        hit.add(cur);
        from = to;
        let nb = null, bd = 7;
        for (const e of list) if (!hit.has(e) && !e.dead) { const d = flatDist(e.pos, cur.pos); if (d < bd) { bd = d; nb = e; } }
        cur = nb;
      }
      fx.flash(pos, 0x88bbff, 25, 0.3);
      sfx('zap');
      break;
    }
    case 'nova': {
      for (const e of enemies()) if (flatDist(e.pos, pos) < 5.5) { e.takeDamage(s.dmg(), false, 'frost'); e.slowT = chill(4); }
      fx.ring(pos, 0x99ddff, 5.5, 0.5);
      fx.emit(pos.clone().setY(0.5), { count: 80, color: 0xbfe8ff, speed: 9, life: 0.6, size: 0.6, flat: true });
      fx.flash(pos, 0x99ddff, 30, 0.5);
      sfx('nova');
      break;
    }
    case 'meteor': {
      const target = at.clone();
      fx.ring(target, 0xff6622, 2.5, 0.9);
      const rock = new Projectile(new THREE.Vector3(0, -1, 0), 0, 'none', 0xff5511, { trail: 0xff7733, size: 0.6, life: 2 });
      rock.root.position.set(target.x - 4, 12, target.z - 3);
      rock.vel = new THREE.Vector3(4, -12, 3).multiplyScalar(1 / 0.9);
      rock.onLand = () => {
        fx.explosion(target, 0xff6622, 3);
        for (const e of enemies()) if (flatDist(e.pos, target) < 3.5) e.takeDamage(s.dmg(), false, 'fire');
        G.main.shake(0.4);
        sfx('boom');
      };
      rock.landAt = 0.9;
      G.level.add(rock);
      sfx('fire');
      break;
    }
    case 'heal': {
      const a = s.amount();
      G.hp = Math.min(maxHp(), G.hp + a);
      if (G.pet && !G.pet.dead) G.pet.hp = Math.min(G.pet.maxHp, G.pet.hp + a);
      G.main.floatText(pos, '+' + Math.round(a), '#66ff88', 22, 2.2);
      fx.emit(pos.clone().setY(0.2), { count: 40, color: 0x77ff99, speed: 1.2, life: 1.2, size: 0.5, rise: 2.5, spread: 1.2 });
      fx.ring(pos, 0x66ff88, 1.5);
      sfx('heal');
      break;
    }
    case 'bones': {
      for (let i = 0; i < s.count(); i++) {
        const a = new Ally();
        const off = new THREE.Vector3(Math.cos(i * 2.4) * 1.5, 0, Math.sin(i * 2.4) * 1.5);
        const p = pos.clone().add(off);
        a.root.position.copy(G.level.walkable(p) ? p : pos);
        G.level.add(a);
        fx.emit(a.root.position.clone().setY(0.3), { count: 30, color: 0x66ff99, speed: 2, life: 1, size: 0.5, rise: 1.5 });
      }
      sfx('buff');
      break;
    }
    case 'whirlwind': {
      const m = s.mult();
      P.spinT = 0.9;
      let ticks = 0;
      const tick = () => {
        if (!G.player || G.player.dead) return;
        for (const e of enemies()) if (flatDist(e.pos, G.player.pos) < 3.2) weaponHit(e, m);
        fx.ring(G.player.pos, 0xffddaa, 3, 0.25);
        fx.emit(G.player.pos.clone().setY(0.8), { count: 16, color: 0xddddcc, speed: 6, life: 0.3, size: 0.35, flat: true });
        sfx('swing');
        if (++ticks < 3) setTimeout(tick, 280);
      };
      tick();
      break;
    }
    case 'slam': {
      const c = pos.clone().addScaledVector(dir, 1.8);
      setTimeout(() => {
        for (const e of enemies()) if (flatDist(e.pos, c) < 2.8) { weaponHit(e, s.mult()); e.stunT = 1.5; }
        fx.ring(c, 0xffcc88, 2.8, 0.35);
        fx.emit(c.clone().setY(0.2), { count: 40, color: 0xb08a5a, speed: 5, life: 0.7, size: 0.7, gravity: 6, up: 1.5 });
        G.main.shake(0.25);
        sfx('boom');
      }, 280);
      break;
    }
    case 'knives': {
      const n = s.count();
      const spread = 0.9;
      for (let i = 0; i < n; i++) {
        const a = -spread / 2 + (spread * i) / Math.max(1, n - 1);
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const dmg = rollDamage() * s.mult();
        const p = new Projectile(d, dmg, 'enemy', 0xcfd8e0, { trail: 0xaabbcc, size: 0.14, kind: 'phys', speed: 20, blade: true });
        p.root.position.copy(pos).addScaledVector(d, 0.6);
        G.level.add(p);
      }
      sfx('swing');
      break;
    }
    case 'blink': {
      fx.emit(pos.clone().setY(1), { count: 40, color: 0x8844ff, speed: 3, life: 0.6, size: 0.6 });
      P.root.position.set(at.x, 0, at.z);
      fx.emit(at.clone().setY(1), { count: 40, color: 0xaa66ff, speed: 3, life: 0.6, size: 0.6 });
      fx.flash(at, 0x9966ff, 20, 0.3);
      G.main.snapCameraSoft();
      sfx('blink');
      break;
    }
    case 'warcry': {
      G.buffs.warcry = s.dur();
      fx.ring(pos, 0xff4433, 6, 0.6);
      fx.emit(pos.clone().setY(1), { count: 50, color: 0xff6644, speed: 6, life: 0.6, size: 0.6, flat: true });
      for (const e of enemies()) if (flatDist(e.pos, pos) < 6) e.slowT = Math.max(e.slowT, 1.5);
      sfx('buff');
      break;
    }
    case 'earthquake': {
      const m = s.mult();
      G.main.shake(0.3);
      [0, 0.3, 0.6].forEach((delay, wave) => setTimeout(() => {
        if (!G.player || G.player.dead || !G.level) return;
        const c = G.player.pos.clone();
        const rad = 3 + wave * 2;
        for (const e of enemies()) { const d = flatDist(e.pos, c); if (d < rad && d >= rad - 2.6) { weaponHit(e, m); e.stunT = Math.max(e.stunT || 0, 1); } }
        fx.ring(c, 0xd8a060, rad, 0.4);
        for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; fx.emit(c.clone().add(new THREE.Vector3(Math.cos(a) * rad, 0.2, Math.sin(a) * rad)), { count: 4, color: 0x9a7a50, speed: 3, up: 2, life: 0.7, size: 0.6, gravity: 8 }); }
        G.main.shake(0.22);
        sfx('boom');
      }, delay * 1000));
      break;
    }
    case 'blizzard': {
      const c = at.clone();
      const dmg = s.dmg();
      fx.ring(c, 0x9fe8ff, 4, 0.6);
      zones.push({ t: 0, acc: 0, every: 0.5, dur: s.dur(),
        tick: () => { for (const e of enemies()) if (flatDist(e.pos, c) < 4) { e.takeDamage(dmg, false, 'frost'); e.slowT = Math.max(e.slowT || 0, chill(1.5)); } fx.ring(c, 0x9fe8ff, 4, 0.5); fx.emit(c.clone().setY(0.2), { count: 24, color: 0xdff8ff, speed: 4, life: 0.5, size: 0.5, flat: true }); sfx('nova'); },
        vis: () => { for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 4; fx.emit(new THREE.Vector3(c.x + Math.cos(a) * r, 7, c.z + Math.sin(a) * r), { count: 1, color: 0xcff4ff, speed: 0.2, up: 0, rise: -14, life: 0.5, size: 0.9, drag: 0 }); } } });
      sfx('nova');
      break;
    }
    case 'smoke': {
      const dur = s.dur();
      for (const e of enemies()) if (flatDist(e.pos, pos) < 4.5) { e.stunT = Math.max(e.stunT || 0, dur); }
      G.buffs.smoke = 5;
      fx.emit(pos.clone().setY(0.4), { count: 90, color: 0x6a6a7a, speed: 3, up: 0.6, life: 2.2, size: 1.4, spread: 1.5, drag: 2.5 });
      fx.ring(pos, 0x8a8a9a, 4.5, 0.5);
      sfx('blink');
      break;
    }
    case 'ice_lance': {
      const p = new Projectile(dir, s.dmg(), 'enemy', 0x9fe0ff, { trail: 0xcff4ff, kind: 'frost', pierce: true, size: 0.2, speed: 22, life: 0.9, onHit: (n) => { n.takeDamage(s.dmg(), false, 'frost'); n.slowT = Math.max(n.slowT || 0, chill(2)); } });
      p.root.position.copy(pos).addScaledVector(dir, 0.7);
      G.level.add(p);
      sfx('nova');
      break;
    }
    case 'venom': {
      const p = new Projectile(dir, 0, 'enemy', 0x77ee33, { trail: 0x55cc22, kind: 'poison', size: 0.2, speed: 15, onHit: (n) => { n.takeDamage(s.dmg() * 0.3, false, 'poison'); n.applyDot(s.dmg(), 5, 'poison' + (Math.random() < 0.5 ? '' : '2')); } });
      p.root.position.copy(pos).addScaledVector(dir, 0.7);
      G.level.add(p);
      sfx('fire');
      break;
    }
    case 'fire_wall': {
      const c = at.clone();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const a = c.clone().addScaledVector(side, -3), b = c.clone().addScaledVector(side, 3);
      const dmg = s.dmg();
      const near = (e) => { const t = Math.max(0, Math.min(1, e.pos.clone().sub(a).dot(side) / 6)); return flatDist(e.pos, a.clone().addScaledVector(side, t * 6)) < 1.0 + e.pickR * 0.4; };
      zones.push({ t: 0, acc: 0, every: 0.4, dur: s.dur(),
        tick: () => { for (const e of enemies()) if (near(e)) e.takeDamage(dmg, false, 'fire'); },
        vis: () => { for (let k = 0; k < 7; k++) { const p = a.clone().lerp(b, Math.random()); fx.emit(p.setY(0.1), { count: 1, color: Math.random() < 0.5 ? 0xff6a1a : 0xffb030, speed: 0.4, up: 0.3, rise: 3 + Math.random() * 2, life: 0.6, size: 0.9 }); } } });
      fx.flash(c, 0xff7a22, 20, 0.5);
      sfx('fire');
      break;
    }
    case 'toxic_cloud': {
      const c = at.clone();
      const dmg = s.dmg();
      zones.push({ t: 0, acc: 0, every: 0.5, dur: s.dur(),
        tick: () => { for (const e of enemies()) if (flatDist(e.pos, c) < 3.5) { e.applyDot(dmg, 2, 'poison3'); e.slowT = Math.max(e.slowT || 0, 0.8); } },
        vis: () => { for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 3.3; fx.emit(new THREE.Vector3(c.x + Math.cos(a) * r, 0.3, c.z + Math.sin(a) * r), { count: 1, color: Math.random() < 0.5 ? 0x5fbf2a : 0x8ae05a, speed: 0.3, up: 0.2, rise: 0.6, life: 1.6, size: 1.6, drag: 2 }); } } });
      fx.ring(c, 0x77dd33, 3.5, 0.6);
      sfx('blink');
      break;
    }
    case 'glacial': {
      const c = at.clone();
      fx.ring(c, 0x9fe8ff, 2.6, 0.5);
      setTimeout(() => {
        if (!G.level) return;
        for (const e of enemies()) if (flatDist(e.pos, c) < 2.8) { e.takeDamage(s.dmg(), false, 'frost'); e.stunT = Math.max(e.stunT || 0, s.freeze()); e.slowT = Math.max(e.slowT || 0, chill(3)); }
        fx.spike(c, 0xbfeeff);
        fx.emit(c.clone().setY(0.4), { count: 50, color: 0xdff8ff, speed: 6, life: 0.6, size: 0.6, gravity: 6, up: 2 });
        fx.flash(c, 0x9fe8ff, 30, 0.4);
        G.main.shake(0.25);
        sfx('boom');
      }, 450);
      sfx('nova');
      break;
    }
    case 'ball_lightning': {
      const c = pos.clone().addScaledVector(dir, 1).setY(0);
      const dmg = s.dmg();
      zones.push({ t: 0, acc: 0, every: 0.25, dur: 3,
        tick: () => {
          const list = enemies().filter((e) => flatDist(e.pos, c) < 4).sort((x, y) => flatDist(x.pos, c) - flatDist(y.pos, c)).slice(0, 2);
          for (const e of list) { fx.beam(c.clone().setY(1.1), e.pos.clone().setY(1), 0xb8c8ff, 0.12); e.takeDamage(dmg, false, 'storm'); }
          if (list.length) sfx('zap');
        },
        vis: (dt) => {
          const nx = c.clone().addScaledVector(dir, 4 * dt);
          if (G.level.walkable(nx)) c.copy(nx);
          fx.emit(c.clone().setY(1.1), { count: 4, color: Math.random() < 0.5 ? 0xd8e0ff : 0x8aa0ff, speed: 1.2, life: 0.25, size: 0.6 });
        } });
      fx.flash(pos, 0x99aaff, 20, 0.3);
      sfx('zap');
      break;
    }
    case 'inferno': {
      const dmg = s.dmg();
      for (const e of enemies()) {
        const v = e.pos.clone().sub(pos).setY(0);
        const d = v.length();
        if (d < 7 && d > 0.01 && v.normalize().dot(dir) > 0.8) { e.takeDamage(dmg, false, 'fire'); e.applyDot(dmg * 0.2, 3, 'fire'); }
      }
      for (let k = 0; k < 70; k++) {
        const a = (Math.random() - 0.5) * 1.1, r = 0.8 + Math.random() * 6.2;
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        fx.emit(pos.clone().addScaledVector(d, r).setY(0.9), { count: 1, color: Math.random() < 0.4 ? 0xffd04a : 0xff5a1a, speed: 1, rise: 1.5, life: 0.5 + Math.random() * 0.3, size: 0.9 });
      }
      fx.flash(pos.clone().addScaledVector(dir, 3), 0xff6a1a, 35, 0.4);
      sfx('fire');
      break;
    }
    case 'cataclysm': {
      const dmg = s.dmg();
      zones.push({ t: 0, acc: 0, every: 0.35, dur: s.dur(),
        tick: () => {
          if (!G.player) return;
          const c = G.player.pos;
          const list = enemies().filter((e) => flatDist(e.pos, c) < 10);
          const tgt = list.length ? pick(list) : null;
          const a = Math.random() * 6.28, r = 2 + Math.random() * 7;
          const p = tgt ? tgt.pos.clone() : new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
          const kind = pick(['fire', 'storm', 'frost']);
          if (kind === 'fire') fx.explosion(p, 0xff6622, 1.6);
          else if (kind === 'storm') { fx.beam(p.clone().setY(9), p.clone().setY(0.2), 0xc8d0ff, 0.2); fx.flash(p, 0x99aaff, 20, 0.2); }
          else { fx.spike(p, 0xbfeeff, 0.7); }
          for (const e of enemies()) if (flatDist(e.pos, p) < 2.2) { e.takeDamage(dmg, false, kind); if (kind === 'frost') e.slowT = Math.max(e.slowT || 0, chill(2)); }
          sfx(kind === 'storm' ? 'zap' : kind === 'fire' ? 'boom' : 'nova');
        },
        vis: () => { if (G.player && Math.random() < 0.5) fx.emit(G.player.pos.clone().setY(2.5), { count: 2, color: pick([0xff6a1a, 0x99ccff, 0xb8c8ff]), speed: 3, life: 0.6, size: 0.5 }); } });
      G.main.shake(0.3);
      fx.ring(pos, 0xffffff, 9, 0.8);
      sfx('buff');
      break;
    }
    case 'blades': {
      const c = at.clone();
      const m = s.mult();
      fx.ring(c, 0xcfd8e0, 3.5, 0.5);
      zones.push({ t: 0, acc: 0, every: 0.3, dur: 3,
        tick: () => {
          const list = enemies().filter((e) => flatDist(e.pos, c) < 3.5);
          const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 3.2;
          const tgt = list.length ? pick(list) : null;
          const p = tgt ? tgt.pos.clone() : new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
          fx.beam(p.clone().setY(6), p.clone().setY(0.2), 0xdfe8f0, 0.15);
          fx.emit(p.clone().setY(0.3), { count: 8, color: 0xe8f0ff, speed: 3, life: 0.3, size: 0.3 });
          if (tgt) weaponHit(tgt, m);
          sfx('swing');
        } });
      break;
    }
  }
  return true;
}
