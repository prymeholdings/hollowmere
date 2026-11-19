// Companions: a lantern fox, a small dragon and an imp. Each grows through three stages as it levels
// and has its own skill tree. All models are built here from simple shapes (original art).
import * as THREE from 'three';
import { G, msg } from './state.js';
import { sfx } from './util.js';

export const PET_MAX_LEVEL = 100;
export const STAGE_LEVELS = [1, 15, 40];
export const PET_SPECIES = {
  fox: {
    name: 'Lantern Fox', stages: ['Lantern Kit', 'Lantern Fox', 'Spirit Fox'], desc: 'Quick and loyal. Finds treasure and lights the dark.',
    coats: [{ key: 'fox', label: 'Ember', color: 0xe07a3a }, { key: 'arctic', label: 'Snow', color: 0xe8eef2 }, { key: 'shadow', label: 'Shadow', color: 0x3a3a46 }, { key: 'gold', label: 'Sun', color: 0xe8c040 }, { key: 'ash', label: 'Ash', color: 0x8a8278 }],
    hp: 1, dmg: 1, speed: 7.5, range: 1.2,
  },
  dragon: {
    name: 'Dragon', stages: ['Whelp', 'Drake', 'Elder Dragon'], desc: 'Tough and fierce. Breathes fire and roars foes into submission.',
    coats: [{ key: 'crimson', label: 'Crimson', color: 0xc8321e }, { key: 'emerald', label: 'Emerald', color: 0x2f9a4a }, { key: 'azure', label: 'Azure', color: 0x2a6ad0 }, { key: 'obsidian', label: 'Obsidian', color: 0x2a2630 }, { key: 'gilded', label: 'Gilded', color: 0xd8a830 }],
    hp: 1.35, dmg: 1.25, speed: 7, range: 1.4,
  },
  imp: {
    name: 'Imp', stages: ['Sprite', 'Imp', 'Archfiend'], desc: 'A mischievous caster. Hurls hexes from afar and empowers your spells.',
    coats: [{ key: 'scarlet', label: 'Scarlet', color: 0xd03a3a }, { key: 'violet', label: 'Violet', color: 0x7a3ad0 }, { key: 'bog', label: 'Bog', color: 0x4a8a3a }, { key: 'ash', label: 'Ash', color: 0x6a6a72 }, { key: 'frost', label: 'Frost', color: 0x6ab8e0 }],
    hp: 0.8, dmg: 1.1, speed: 7.5, range: 7, ranged: true,
  },
};

// Pet skill trees: 3 rows (pet level 1 / 10 / 25), max rank 10. Actives are used by the pet on its own.
export const PET_TIER_LEVEL = [1, 10, 25];
export const PET_MAX_RANK = 10;
export const PET_SKILLS = {
  // fox
  fx_bite: { name: 'Sharp Teeth', icon: 'pet_bond', desc: (r) => `+${r * 8}% pet damage.` },
  fx_lantern: { name: 'Lantern Glow', icon: 'fortune', desc: (r) => `+${r * 6}% magic find for you.` },
  fx_swift: { name: 'Fleet Paws', icon: 'feet', desc: (r) => `+${r * 6}% pet attack speed and +${r * 2}% movement speed for you.` },
  fx_fire: { name: 'Foxfire', icon: 'fire', active: true, cd: 4, desc: (r) => `Every 4s, spits a foxfire bolt for ${100 + r * 20}% pet damage.` },
  fx_scavenge: { name: 'Scavenger', icon: 'fortune', desc: (r) => `Fetches gold and potions near you. +${r * 6}% gold find.` },
  fx_howl: { name: 'Pack Howl', icon: 'cry', active: true, cd: 20, desc: (r) => `Every 20s in battle, howls: you deal +${r * 4}% damage for 8s.` },
  fx_spirits: { name: 'Spirit Pack', icon: 'blink', active: true, cd: 35, desc: (r) => `Every 35s, calls ${1 + Math.ceil(r / 4)} spirit foxes that fight for 12s.` },
  // dragon
  dr_claws: { name: 'Raking Claws', icon: 'brutal', desc: (r) => `+${r * 9}% pet damage.` },
  dr_scales: { name: 'Iron Scales', icon: 'toughness', desc: (r) => `+${r * 10}% pet life and +${r * 6} armor for you.` },
  dr_breath: { name: 'Fire Breath', icon: 'inferno', active: true, cd: 5, desc: (r) => `Every 5s, breathes fire in a cone for ${120 + r * 25}% pet damage, burning foes.` },
  dr_wings: { name: 'Mighty Wings', icon: 'wind', desc: (r) => `+${r * 5}% pet speed and the pet takes ${r * 3}% less damage.` },
  dr_aura: { name: 'Smoulder', icon: 'pyro', desc: (r) => `Foes near the dragon burn for ${r * 12}% pet damage per second.` },
  dr_roar: { name: 'Terrible Roar', icon: 'cry', active: true, cd: 16, desc: (r) => `Every 16s, roars: nearby foes are stunned for ${(1 + r * 0.1).toFixed(1)}s.` },
  dr_dive: { name: 'Meteor Dive', icon: 'meteor', active: true, cd: 12, desc: (r) => `Every 12s, crashes down on a foe for ${300 + r * 50}% pet damage in an area.` },
  // imp
  im_hex: { name: 'Hex Bolt', icon: 'arcane', desc: (r) => `The imp's bolts deal +${r * 9}% damage.` },
  im_pact: { name: 'Dark Pact', icon: 'elemental', desc: (r) => `+${r * 3}% spell damage and +${r * 6}% mana regeneration for you.` },
  im_mischief: { name: 'Mischief', icon: 'fortune', desc: (r) => `Imp hits have a ${r * 3}% chance to steal a little gold.` },
  im_curse: { name: 'Curse of Frailty', icon: 'skull', active: true, cd: 10, desc: (r) => `Every 10s, curses a foe: it takes +${10 + r * 3}% damage for 6s.` },
  im_drain: { name: 'Soul Drain', icon: 'blood', active: true, cd: 8, desc: (r) => `Every 8s, drains a foe for ${100 + r * 20}% pet damage and heals you for twice that.` },
  im_blink: { name: 'Flicker', icon: 'blink', desc: (r) => `The imp dodges ${r * 4}% of attacks and you gain +${r * 2}% dodge chance.` },
  im_hellfire: { name: 'Hellfire Rain', icon: 'firewall', active: true, cd: 18, desc: (r) => `Every 18s, rains hellfire on a group of foes for ${80 + r * 15}% pet damage, 6 times.` },
};
for (const k in PET_SKILLS) PET_SKILLS[k].id = k;
export const PET_TREES = {
  fox: [{ id: 'fx_bite', tier: 0, col: 0 }, { id: 'fx_lantern', tier: 0, col: 1 }, { id: 'fx_swift', tier: 0, col: 2 }, { id: 'fx_fire', tier: 1, col: 0, req: ['fx_bite'] }, { id: 'fx_scavenge', tier: 1, col: 1, req: ['fx_lantern'] }, { id: 'fx_howl', tier: 1, col: 2, req: ['fx_swift'] }, { id: 'fx_spirits', tier: 2, col: 1, req: ['fx_fire', 'fx_howl'] }],
  dragon: [{ id: 'dr_claws', tier: 0, col: 0 }, { id: 'dr_scales', tier: 0, col: 1 }, { id: 'dr_wings', tier: 0, col: 2 }, { id: 'dr_breath', tier: 1, col: 0, req: ['dr_claws'] }, { id: 'dr_aura', tier: 1, col: 1, req: ['dr_scales'] }, { id: 'dr_roar', tier: 1, col: 2, req: ['dr_wings'] }, { id: 'dr_dive', tier: 2, col: 1, req: ['dr_breath', 'dr_roar'] }],
  imp: [{ id: 'im_hex', tier: 0, col: 0 }, { id: 'im_pact', tier: 0, col: 1 }, { id: 'im_mischief', tier: 0, col: 2 }, { id: 'im_curse', tier: 1, col: 0, req: ['im_hex'] }, { id: 'im_drain', tier: 1, col: 1, req: ['im_pact'] }, { id: 'im_blink', tier: 1, col: 2, req: ['im_mischief'] }, { id: 'im_hellfire', tier: 2, col: 1, req: ['im_curse', 'im_drain'] }],
};

// ---------------------------------------------------------------- state helpers
export function newPetRecord(coat, lvl = 1) { return { lvl, xp: 0, points: lvl - 1, skills: {}, coat }; }
export function ensurePets() {
  if (!G.pets) G.pets = {};
  if (!G.petSpecies || !PET_SPECIES[G.petSpecies]) G.petSpecies = 'fox';
  for (const s in PET_SPECIES) if (!G.pets[s]) G.pets[s] = newPetRecord(PET_SPECIES[s].coats[0].key);
  return G.pets[G.petSpecies];
}
export const petRec = () => ensurePets();
export const petRank = (id) => (petRec().skills[id] || 0);
export const petStage = (rec = petRec()) => (rec.lvl >= STAGE_LEVELS[2] ? 2 : rec.lvl >= STAGE_LEVELS[1] ? 1 : 0);
export const petTitle = () => PET_SPECIES[G.petSpecies].stages[petStage()];
export const petXpToNext = (lvl = petRec().lvl) => Math.floor(40 * Math.pow(lvl, 1.5));
export function petCoatColor(species = G.petSpecies, key = G.pets?.[species]?.coat) {
  const sp = PET_SPECIES[species];
  return (sp.coats.find((c) => c.key === key) || sp.coats[0]).color;
}
// bonuses the active pet grants to the hero
export function petBonus(stat) {
  if (!G.pets || G.petAwayTime > 0 || (G.pet && G.pet.dead)) return 0;
  const r = petRank;
  switch (G.petSpecies) {
    case 'fox': return { magic_find: r('fx_lantern') * 6, gold_find: r('fx_scavenge') * 6, move: r('fx_swift') * 0.02, dmg_pct: G.buffs.howl > 0 ? r('fx_howl') * 4 : 0 }[stat] || 0;
    case 'dragon': return { armor: r('dr_scales') * 6 }[stat] || 0;
    case 'imp': return { spell: r('im_pact') * 3, mana_regen: r('im_pact') * 0.06, dodge: r('im_blink') * 0.02 }[stat] || 0;
  }
  return 0;
}
export function addPetXp(n) {
  const rec = petRec();
  if (rec.lvl >= PET_MAX_LEVEL) return;
  const stage0 = petStage(rec);
  rec.xp += n;
  while (rec.lvl < PET_MAX_LEVEL && rec.xp >= petXpToNext(rec.lvl)) {
    rec.xp -= petXpToNext(rec.lvl);
    rec.lvl++; rec.points++;
    msg(`${G.petName} reached pet level ${rec.lvl}! (+1 pet skill point, press P)`, '#ffb066');
  }
  if (petStage(rec) !== stage0) {
    msg(`${G.petName} evolves into a ${petTitle()}!`, '#ffd84d');
    sfx('legend');
    G.pet?.evolve();
  }
}
export function learnPetSkill(id) {
  const rec = petRec();
  const node = PET_TREES[G.petSpecies].find((n) => n.id === id);
  if (!node) return 'Not available';
  if ((rec.skills[id] || 0) >= PET_MAX_RANK) return 'Maximum rank';
  if (rec.lvl < PET_TIER_LEVEL[node.tier]) return `Requires pet level ${PET_TIER_LEVEL[node.tier]}`;
  const miss = (node.req || []).filter((q) => !(rec.skills[q] > 0));
  if (miss.length) return `Requires ${miss.map((q) => PET_SKILLS[q].name).join(' and ')}`;
  if (rec.points <= 0) return 'No pet skill points';
  rec.skills[id] = (rec.skills[id] || 0) + 1; rec.points--;
  return null;
}

// ---------------------------------------------------------------- models
const matCache = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0.05, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat }));
  return matCache.get(key);
}
const geo = {
  sph: new THREE.SphereGeometry(1, 20, 14), cone: new THREE.ConeGeometry(1, 1, 12), cap: new THREE.CapsuleGeometry(1, 1, 6, 14), cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
};
function M(g, m, sx, sy, sz, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m);
  o.scale.set(sx, sy ?? sx, sz ?? sx);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent?.add(o);
  return o;
}
function wingGeo(span, depth) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(span * 0.4, depth * 0.9, span, depth * 0.55);
  s.quadraticCurveTo(span * 0.82, depth * 0.2, span * 0.85, -depth * 0.1);
  s.quadraticCurveTo(span * 0.64, 0.05 * depth, span * 0.6, -depth * 0.32);
  s.quadraticCurveTo(span * 0.44, -0.02 * depth, span * 0.36, -depth * 0.4);
  s.quadraticCurveTo(span * 0.2, -0.1 * depth, 0, -depth * 0.2);
  s.lineTo(0, 0);
  return new THREE.ShapeGeometry(s, 10);
}
const darker = (c, k = 0.6) => new THREE.Color(c).multiplyScalar(k).getHex();
const lighter = (c, k = 0.45) => new THREE.Color(c).lerp(new THREE.Color(0xfff2d8), k).getHex();

// returns { root, anim(t, moving, dt, attack) }
export function buildPetModel(species, stage, coat) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = {};
  const sc = [0.8, 1.05, 1.35][stage];
  if (species === 'dragon') {
    const c = coat, belly = lighter(coat, 0.55), dark = darker(coat, 0.55);
    const mC = mat(c, { r: 0.45, m: 0.15 }), mB = mat(belly, { r: 0.6 }), mD = mat(dark, { r: 0.5 }), mH = mat(0xf0e6c8, { r: 0.4 }), mE = mat(0xffd040, { e: 0xffa020, ei: 1.6 });
    const torso = M(geo.sph, mC, 0.32, 0.3, 0.46, 0, 0.55, 0, body);
    M(geo.sph, mB, 0.26, 0.24, 0.38, 0, 0.47, 0.06, body);
    const neck = new THREE.Group(); neck.position.set(0, 0.68, 0.32); body.add(neck);
    M(geo.cap, mC, 0.12, 0.18, 0.12, 0, 0.12, 0.05, neck).rotation.x = 0.5;
    const head = new THREE.Group(); head.position.set(0, 0.28, 0.16); neck.add(head);
    M(geo.sph, mC, 0.17, 0.15, 0.2, 0, 0, 0, head);
    M(geo.sph, mC, 0.11, 0.09, 0.15, 0, -0.03, 0.17, head);
    const jaw = M(geo.sph, mB, 0.09, 0.05, 0.13, 0, -0.09, 0.13, head);
    for (const x of [-1, 1]) {
      M(geo.sph, mE, 0.035, 0.035, 0.03, x * 0.09, 0.04, 0.14, head);
      M(geo.sph, mat(0x000000), 0.012, 0.03, 0.01, x * 0.1, 0.04, 0.17, head);
      M(geo.sph, mat(0x220a00), 0.015, 0.015, 0.015, x * 0.04, 0.0, 0.31, head);
      const h1 = M(geo.cone, mH, 0.04, 0.2 + stage * 0.08, 0.04, x * 0.09, 0.14, -0.08, head); h1.rotation.set(-0.9, 0, x * 0.25);
      if (stage >= 1) { const h2 = M(geo.cone, mH, 0.025, 0.12, 0.025, x * 0.15, 0.07, -0.06, head); h2.rotation.set(-1.1, 0, x * 0.7); }
      if (stage >= 2) { const h3 = M(geo.cone, mH, 0.022, 0.1, 0.022, x * 0.12, -0.08, -0.04, head); h3.rotation.set(-1.6, 0, x * 0.9); }
    }
    // back spikes
    for (let i = 0; i < 4 + stage * 2; i++) { const s = M(geo.cone, mD, 0.035, 0.1 + (stage * 0.02), 0.035, 0, 0.84 - i * 0.03, 0.25 - i * 0.1, body); s.rotation.x = -0.35; }
    // legs
    for (const [x, z] of [[-0.18, 0.2], [0.18, 0.2], [-0.2, -0.18], [0.2, -0.18]]) {
      M(geo.cap, mC, 0.07, 0.14, 0.07, x, 0.24, z, body);
      M(geo.sph, mD, 0.08, 0.05, 0.1, x, 0.06, z + 0.04, body);
    }
    // tail
    const tail = new THREE.Group(); tail.position.set(0, 0.5, -0.4); body.add(tail);
    parts.tail = [];
    let prev = tail;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group(); seg.position.set(0, 0, i === 0 ? 0 : -0.13); prev.add(seg);
      M(geo.sph, mC, 0.1 - i * 0.012, 0.09 - i * 0.011, 0.11, 0, 0, -0.06, seg);
      if (i % 2 === 0) { const sp = M(geo.cone, mD, 0.025, 0.07, 0.025, 0, 0.08 - i * 0.008, -0.06, seg); sp.rotation.x = -0.4; }
      parts.tail.push(seg); prev = seg;
    }
    const spade = M(geo.cone, mD, 0.08, 0.16, 0.02, 0, 0, -0.16, prev); spade.rotation.x = -Math.PI / 2;
    // wings
    parts.wings = [];
    const wg = wingGeo(0.75 + stage * 0.2, 0.55 + stage * 0.12);
    const memb = mat(darker(coat, 0.8), { r: 0.7, side: THREE.DoubleSide });
    for (const x of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(x * 0.16, 0.78, 0.08); body.add(piv);
      const w = new THREE.Mesh(wg, memb); w.castShadow = true; w.scale.set(x, 1, 1); w.rotation.x = -Math.PI / 2 + 0.25; piv.add(w);
      const bone = M(geo.cap, mD, 0.02, 0.5 + stage * 0.15, 0.02, x * 0.3, 0.12, 0, piv); bone.rotation.z = x * -1.2;
      parts.wings.push(piv);
    }
    parts.head = head; parts.jaw = jaw; parts.neck = neck;
    if (stage >= 2) { const glow = M(geo.sph, mat(0xff7a20, { e: 0xff5a10, ei: 1.5 }), 0.07, 0.07, 0.05, 0, 0.6, 0.42, body); glow.castShadow = false; }
    body.scale.setScalar(sc * 1.15);
  } else if (species === 'imp') {
    const c = coat, dark = darker(coat, 0.5), light = lighter(coat, 0.3);
    const mC = mat(c, { r: 0.55 }), mD = mat(dark, { r: 0.5 }), mHo = mat(0x2a2028, { r: 0.4 }), mE = mat(0xfff060, { e: 0xffd020, ei: 2 });
    const torso = M(geo.sph, mC, 0.17, 0.22, 0.15, 0, 0.62, 0, body);
    M(geo.sph, mat(light), 0.12, 0.15, 0.08, 0, 0.6, 0.08, body);
    const head = new THREE.Group(); head.position.set(0, 0.93, 0.02); body.add(head);
    M(geo.sph, mC, 0.17, 0.15, 0.15, 0, 0, 0, head);
    M(geo.sph, mC, 0.06, 0.05, 0.06, 0, -0.04, 0.14, head);
    for (const x of [-1, 1]) {
      M(geo.sph, mE, 0.04, 0.045, 0.02, x * 0.07, 0.03, 0.13, head);
      const ear = M(geo.cone, mC, 0.045, 0.2, 0.02, x * 0.19, 0.02, 0, head); ear.rotation.z = x * -1.2;
      const horn = M(geo.cone, mHo, 0.035, 0.16 + stage * 0.08, 0.035, x * 0.08, 0.15, -0.02, head); horn.rotation.set(-0.3, 0, x * -0.35);
      if (stage >= 2) { const h2 = M(geo.cone, mHo, 0.025, 0.12, 0.025, x * 0.13, 0.11, -0.05, head); h2.rotation.set(-0.6, 0, x * -0.9); }
      const arm = new THREE.Group(); arm.position.set(x * 0.17, 0.72, 0); body.add(arm);
      M(geo.cap, mC, 0.04, 0.16, 0.04, 0, -0.1, 0, arm);
      M(geo.sph, mD, 0.05, 0.05, 0.05, 0, -0.22, 0.02, arm);
      arm.rotation.z = x * 0.35;
      (parts.arms ||= []).push(arm);
      M(geo.cap, mC, 0.05, 0.12, 0.05, x * 0.08, 0.38, 0, body);
      M(geo.sph, mD, 0.06, 0.04, 0.09, x * 0.08, 0.27, 0.03, body);
    }
    M(geo.sph, mat(0x1a0808), 0.05, 0.015, 0.02, 0, -0.07, 0.15, head);
    // tail with arrow tip
    const tail = new THREE.Group(); tail.position.set(0, 0.45, -0.12); body.add(tail);
    parts.tail = [];
    let prev = tail;
    for (let i = 0; i < 6; i++) { const seg = new THREE.Group(); seg.position.set(0, i ? -0.03 : 0, i ? -0.07 : 0); prev.add(seg); M(geo.sph, mD, 0.025, 0.025, 0.05, 0, 0, -0.03, seg); parts.tail.push(seg); prev = seg; }
    const tip = M(geo.cone, mD, 0.05, 0.1, 0.015, 0, 0, -0.08, prev); tip.rotation.x = -Math.PI / 2;
    // bat wings
    parts.wings = [];
    const wg = wingGeo(0.38 + stage * 0.14, 0.32 + stage * 0.08);
    for (const x of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(x * 0.08, 0.75, -0.1); body.add(piv);
      const w = new THREE.Mesh(wg, mat(dark, { r: 0.7, side: THREE.DoubleSide })); w.scale.set(x, 1, 1); w.rotation.set(0.3, x * 0.5, 0); w.castShadow = true; piv.add(w);
      parts.wings.push(piv);
    }
    parts.head = head;
    // a little hovering hex flame in the hand
    parts.orb = M(geo.sph, mat(0xc060ff, { e: 0xa040ff, ei: 2 }), 0.05, 0.05, 0.05, 0.2, 0.48, 0.12, body);
    parts.orb.castShadow = false;
    parts.hover = true;
    body.scale.setScalar(sc * 1.1);
  } else {
    // lantern fox: soft rounded body, fluffy tails (more tails as it evolves), glowing tail lantern
    const c = coat, cream = 0xf4ead8, dark = 0x3a2416;
    const mC = mat(c, { r: 0.75 }), mW = mat(cream, { r: 0.8 }), mDk = mat(dark, { r: 0.7 }), mE = mat(0x1a1008, { r: 0.2 });
    M(geo.cap, mC, 0.16, 0.34, 0.16, 0, 0.38, 0, body).rotation.x = Math.PI / 2;
    M(geo.sph, mW, 0.13, 0.12, 0.2, 0, 0.32, 0.08, body);
    const head = new THREE.Group(); head.position.set(0, 0.56, 0.3); body.add(head);
    M(geo.sph, mC, 0.16, 0.14, 0.15, 0, 0, 0, head);
    M(geo.sph, mW, 0.1, 0.08, 0.1, 0, -0.04, 0.08, head);
    const snout = M(geo.cone, mC, 0.07, 0.17, 0.06, 0, -0.03, 0.16, head); snout.rotation.x = Math.PI / 2;
    M(geo.sph, mE, 0.025, 0.02, 0.02, 0, -0.02, 0.25, head);
    for (const x of [-1, 1]) {
      M(geo.sph, mE, 0.028, 0.034, 0.02, x * 0.07, 0.03, 0.12, head);
      M(geo.sph, mat(0xffffff, { e: 0xffffff, ei: 0.5 }), 0.008, 0.008, 0.006, x * 0.075, 0.045, 0.137, head);
      const ear = M(geo.cone, mC, 0.06, 0.16, 0.035, x * 0.09, 0.15, -0.02, head); ear.rotation.z = x * -0.25;
      M(geo.cone, mDk, 0.035, 0.09, 0.02, x * 0.09, 0.15, 0.0, head).rotation.z = x * -0.25;
    }
    parts.legs = [];
    for (const [x, z] of [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.18], [0.09, -0.18]]) {
      const leg = new THREE.Group(); leg.position.set(x, 0.3, z); body.add(leg);
      M(geo.cap, mC, 0.045, 0.14, 0.045, 0, -0.12, 0, leg);
      M(geo.sph, mDk, 0.05, 0.035, 0.065, 0, -0.26, 0.015, leg);
      parts.legs.push(leg);
    }
    parts.tails = [];
    const nt = stage + 1;
    for (let k = 0; k < nt; k++) {
      const tg = new THREE.Group(); tg.position.set(0, 0.45, -0.3); body.add(tg);
      const spread = nt === 1 ? 0 : (k / (nt - 1) - 0.5) * 1.1;
      tg.rotation.set(-0.7, spread, 0);
      M(geo.sph, mC, 0.1, 0.1, 0.22, 0, 0.05, -0.14, tg);
      M(geo.sph, mC, 0.12, 0.12, 0.2, 0, 0.12, -0.3, tg);
      M(geo.sph, mW, 0.09, 0.09, 0.12, 0, 0.17, -0.45, tg);
      const lamp = M(geo.sph, mat(0xffdd88, { e: 0xffb040, ei: 2 }), 0.05, 0.05, 0.05, 0, 0.2, -0.53, tg); lamp.castShadow = false;
      parts.tails.push(tg); (parts.lamps ||= []).push(lamp);
    }
    parts.head = head;
    body.scale.setScalar(sc * 1.05);
  }
  let atk = 0;
  const anim = (t, moving, dt, attack) => {
    if (attack) atk = 1;
    atk = Math.max(0, atk - dt * 4);
    const flap = parts.wings ? (moving || parts.hover ? 9 : 2.2) : 0;
    if (parts.wings) parts.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (Math.sin(t * flap) * (moving || parts.hover ? 0.55 : 0.12) + 0.15); });
    if (parts.tail) parts.tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 3 - i * 0.6) * 0.18; s.rotation.x = Math.sin(t * 2 - i * 0.5) * 0.06; });
    if (parts.tails) parts.tails.forEach((s, i) => { s.rotation.y = (parts.tails.length === 1 ? 0 : (i / (parts.tails.length - 1) - 0.5) * 1.1) + Math.sin(t * (moving ? 12 : 4) + i) * 0.25; });
    if (parts.legs) parts.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 16 + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
    if (parts.arms) parts.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 3 + i) * 0.2 - atk * 1.4; });
    if (parts.head) parts.head.rotation.x = -atk * 0.4 + Math.sin(t * 1.7) * 0.05;
    if (parts.jaw) parts.jaw.rotation.x = atk * 0.5;
    if (parts.orb) { parts.orb.position.y = 0.48 + Math.sin(t * 4) * 0.03; parts.orb.scale.setScalar(0.05 * (1 + atk)); }
    if (parts.lamps) for (const l of parts.lamps) l.material.emissiveIntensity = 1.6 + Math.sin(t * 6) * 0.4;
    body.position.y = parts.hover ? 0.35 + Math.sin(t * 3) * 0.08 : (parts.wings && moving ? 0.25 + Math.sin(t * 4.5) * 0.06 : (moving ? Math.abs(Math.sin(t * 14)) * 0.06 : Math.sin(t * 2) * 0.008));
    body.position.z = atk * 0.25;
  };
  return { root, anim, parts };
}
