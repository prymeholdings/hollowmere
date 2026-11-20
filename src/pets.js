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


// Long eastern-style dragon: a floating serpent body that undulates along its length, four small clawed
// legs that paddle the air, antlers, whiskers, a flowing mane and a glowing pearl. Original design.
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), FWD = new THREE.Vector3(0, 0, 1);
function curveTube(points, r, m, parent) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 16, r, 5, false);
  const o = new THREE.Mesh(g, m); o.castShadow = false; parent.add(o); return o;
}
function buildLongDragon(stage, coat) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = { long: true };
  const sc = [0.75, 1.0, 1.3][stage];
  const gilded = new THREE.Color(coat).getHSL({}).s > 0.5 && Math.abs(new THREE.Color(coat).getHSL({}).h - 0.12) < 0.04;
  const accent = gilded ? 0xc8321e : 0xe8b840;
  const belly = lighter(coat, 0.5), dark = darker(coat, 0.5);
  const mC = mat(coat, { r: 0.35, m: 0.25 }), mB = mat(belly, { r: 0.5, m: 0.1 }), mD = mat(dark, { r: 0.45 });
  const mA = mat(accent, { r: 0.4, m: 0.35, e: accent, ei: 0.18 }), mHorn = mat(0xe8dcb8, { r: 0.35 }), mEye = mat(0xffe060, { e: 0xffb020, ei: 1.8 });
  const mWhisk = mat(lighter(accent, 0.3), { r: 0.5 });
  // ---- spine segments
  const N = 16 + stage * 4, spacing = 0.13;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const r = 0.13 * (1 - 0.78 * Math.pow(u, 1.3)) * (1 + 0.18 * Math.exp(-Math.pow((u - 0.18) / 0.12, 2)));
    const g = new THREE.Group(); body.add(g);
    M(geo.sph, mC, r, r * 0.92, spacing * 1.3, 0, 0, 0, g);
    M(geo.sph, mB, r * 0.82, r * 0.6, spacing * 0.85, 0, -r * 0.42, 0, g);
    if (i > 0 && i < N - 1) { const fin = M(geo.cone, i % 2 ? mA : mD, r * 0.32, r * 1.1, spacing * 0.35, 0, r * 1.15, 0, g); fin.rotation.x = -0.45; fin.castShadow = false; }
    segs.push({ g, r, u });
  }
  // ---- tail tuft (a fan of flame-like plumes)
  const tuft = new THREE.Group(); segs[N - 1].g.add(tuft);
  for (let k = 0; k < 5; k++) { const c = M(geo.cone, mA, 0.05, 0.32, 0.02, 0, 0, -0.16, tuft); c.rotation.set(-Math.PI / 2, 0, (k - 2) * 0.32); c.position.x = (k - 2) * 0.025; c.castShadow = false; }
  // ---- legs: pairs near the front and the back
  parts.legs = [];
  for (const [si, front] of [[Math.round(N * 0.16), true], [Math.round(N * 0.52), false]]) {
    const sg = segs[si];
    for (const x of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(x * sg.r * 0.85, -sg.r * 0.2, 0); sg.g.add(hip);
      M(geo.cap, mC, 0.035, 0.1, 0.035, 0, -0.07, 0.02, hip).rotation.x = 0.6;
      const foot = new THREE.Group(); foot.position.set(0, -0.14, 0.08); hip.add(foot);
      M(geo.sph, mD, 0.045, 0.03, 0.05, 0, 0, 0, foot);
      for (let c = -1; c <= 1; c++) { const cl = M(geo.cone, mHorn, 0.012, 0.06, 0.012, c * 0.025, -0.01, 0.05, foot); cl.rotation.x = Math.PI / 2 + 0.5; cl.castShadow = false; }
      hip.rotation.z = x * 0.5;
      parts.legs.push({ hip, x, front });
    }
  }
  // ---- head
  const head = new THREE.Group(); body.add(head);
  const sk = new THREE.Group(); head.add(sk); // skull, so the jaw can open beneath it
  M(geo.sph, mC, 0.13, 0.11, 0.15, 0, 0.02, 0, sk);
  M(geo.sph, mC, 0.085, 0.065, 0.16, 0, 0.0, 0.15, sk);           // long snout
  M(geo.sph, mA, 0.05, 0.03, 0.06, 0, 0.055, 0.2, sk);            // ridge on the nose
  for (const x of [-1, 1]) {
    M(geo.sph, mEye, 0.03, 0.026, 0.03, x * 0.085, 0.06, 0.07, sk);
    M(geo.sph, mat(0x000000), 0.01, 0.022, 0.008, x * 0.1, 0.062, 0.088, sk);
    M(geo.sph, mD, 0.045, 0.018, 0.05, x * 0.08, 0.095, 0.07, sk).rotation.z = x * 0.3;   // brow
    M(geo.sph, mat(0x220800), 0.012, 0.012, 0.012, x * 0.035, 0.03, 0.29, sk);            // nostril
    // antlers: a main beam with two tines, longer as the dragon grows
    const ant = new THREE.Group(); ant.position.set(x * 0.06, 0.1, -0.06); ant.rotation.set(-0.85, 0, x * -0.35); sk.add(ant);
    const L = 0.2 + stage * 0.07;
    M(geo.cone, mHorn, 0.022, L, 0.022, 0, L / 2, 0, ant);
    const t1 = M(geo.cone, mHorn, 0.014, L * 0.45, 0.014, x * 0.03, L * 0.45, 0, ant); t1.rotation.z = x * -0.9;
    const t2 = M(geo.cone, mHorn, 0.012, L * 0.35, 0.012, x * 0.02, L * 0.72, 0, ant); t2.rotation.z = x * -0.7;
    // long whiskers from the snout, drawn as soft curves
    const w = curveTube([[x * 0.06, 0.0, 0.25], [x * 0.18, -0.02, 0.22], [x * 0.3, -0.08, 0.1], [x * 0.38, -0.18, -0.05]], 0.006, mWhisk, sk);
    (parts.whiskers ||= []).push(w);
    // mane tufts behind the cheeks
    for (let k = 0; k < 3; k++) { const m = M(geo.cone, mA, 0.035, 0.16, 0.02, x * (0.1 + k * 0.015), 0.04 - k * 0.04, -0.1, sk); m.rotation.set(-1.9 + k * 0.2, 0, x * (0.9 + k * 0.2)); m.castShadow = false; }
  }
  // mane down the back of the head
  for (let k = 0; k < 4; k++) { const m = M(geo.cone, mA, 0.04, 0.18, 0.02, 0, 0.12 - k * 0.02, -0.08 - k * 0.04, sk); m.rotation.x = -2.2 + k * 0.1; m.castShadow = false; }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.04, 0.03); head.add(jaw);
  M(geo.sph, mB, 0.07, 0.03, 0.15, 0, -0.02, 0.12, jaw);
  for (const x of [-1, 1]) { const f = M(geo.cone, mHorn, 0.008, 0.03, 0.008, x * 0.04, 0.0, 0.22, jaw); f.rotation.x = Math.PI; f.castShadow = false; }
  const beard = M(geo.cone, mA, 0.035, 0.14, 0.02, 0, -0.08, 0.06, jaw); beard.rotation.x = Math.PI - 0.3; beard.castShadow = false;
  // the flaming pearl it chases
  const pearl = M(geo.sph, mat(0xfff4e0, { e: 0xffc070, ei: 1.4, r: 0.15 }), 0.06, 0.06, 0.06, 0, 0, 0, body); pearl.castShadow = false;
  parts.head = head; parts.jaw = jaw; parts.pearl = pearl; parts.hover = true;
  body.scale.setScalar(sc);
  // ---- motion
  let atk = 0, phase = 0, amp = 0.5;
  const pos = segs.map(() => new THREE.Vector3());
  const anim = (t, moving, dt, attack) => {
    if (attack) atk = 1;
    atk = Math.max(0, atk - (dt || 0.016) * 3);
    const speed = moving ? 5.5 : 2.2;
    phase += (dt || 0.016) * speed;
    amp += ((moving ? 1 : 0.65) - amp) * Math.min(1, (dt || 0.016) * 3);
    const baseY = 0.95 + Math.sin(t * 1.3) * 0.08;
    const headZ = 0.55 + atk * 0.3;
    // the body is laid out behind the head along a travelling S-wave (side to side and up and down)
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), d = i * spacing;
      const k = Math.min(1, 0.25 + u * 2);
      pos[i].set(Math.sin(phase - d * 4.2) * 0.22 * amp * k, baseY + Math.sin(phase * 0.8 - d * 3.1) * 0.13 * amp * k - u * 0.08, headZ - 0.16 - d);
    }
    for (let i = 0; i < N; i++) {
      const g = segs[i].g;
      g.position.copy(pos[i]);
      const a = i === 0 ? tmpV.set(pos[0].x * 0.6, pos[0].y, headZ) : pos[i - 1];
      tmpV2.subVectors(a, pos[i]).normalize();
      g.quaternion.setFromUnitVectors(FWD, tmpV2);
    }
    // head rides the front of the body, looks slightly ahead and dips when it strikes
    head.position.set(pos[0].x * 0.6, pos[0].y + 0.02, headZ);
    tmpV2.subVectors(head.position, pos[0]).normalize();
    head.quaternion.setFromUnitVectors(FWD, tmpV2);
    head.rotateX(0.12 - atk * 0.3 + Math.sin(t * 1.7) * 0.05);
    jaw.rotation.x = 0.08 + atk * 0.55 + Math.max(0, Math.sin(t * 0.9)) * 0.06;
    for (const w of parts.whiskers) w.rotation.y = Math.sin(t * 2.2) * 0.12;
    tuft.rotation.y = Math.sin(phase * 1.3) * 0.4;
    // legs paddle the air in a slow alternating stroke
    for (const l of parts.legs) l.hip.rotation.x = Math.sin(phase * 1.6 + (l.front ? 0 : Math.PI) + (l.x > 0 ? Math.PI : 0)) * 0.55;
    // the pearl circles just ahead of the snout
    pearl.position.set(Math.sin(t * 2.1) * 0.12, baseY + 0.12 + Math.sin(t * 3.3) * 0.06, headZ + 0.42 + Math.cos(t * 2.1) * 0.06);
    pearl.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.3 + atk;
  };
  anim(0, false, 0.016, 0);
  return { root, anim, parts };
}

// returns { root, anim(t, moving, dt, attack) }
export function buildPetModel(species, stage, coat) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = {};
  const sc = [0.8, 1.05, 1.35][stage];
  if (species === 'dragon') return buildLongDragon(stage, coat);
  if (species === 'imp') {
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
    // life: breathing, looking around when idle, a gallop pitch for the fox, a lazy sway for the imp
    const bs = body.userData.bs || (body.userData.bs = body.scale.x);
    body.scale.set(bs, bs * (1 + Math.sin(t * 2.3) * 0.018), bs);
    if (parts.head) parts.head.rotation.y = Math.sin(t * 0.55) * (moving ? 0.08 : 0.45) + Math.sin(t * 1.9) * 0.05;
    if (parts.legs) body.rotation.x = moving ? Math.sin(t * 16) * 0.07 : 0;
    if (parts.hover) { body.rotation.z = Math.sin(t * 1.4) * 0.09; body.rotation.x = moving ? 0.25 : 0.05; body.rotation.y = atk * Math.PI * 0.5; }
  };
  return { root, anim, parts };
}
