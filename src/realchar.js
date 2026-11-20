// Realistic humans. The hero and the townsfolk are built from CC0 MakeHuman body data with the MIT-licensed
// ara3d library (src/vendor/ara3d.js), animated with motion-capture clips. Characters are built once in a
// background worker (a few seconds) and cached, so the game shows the stylised model first and swaps in.
// Gear is shown on the body: weapons and shields are the game's own meshes in the hands, helms sit on the
// head, and armour plates (breastplate, pauldrons, vambraces, tassets, greaves) are built from shapes and
// follow the animation. Hair has a main colour and a highlight colour.
import * as THREE from 'three';
import { createCharacter } from './vendor/ara3d.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { findSource, tintMaterial, modelFlash, modelFlashTick } from './assets.js';

export const REAL_OK = typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && !new URLSearchParams(location.search).has('stylised');
const ASSET_URL = new URL('assets/ara/', document.baseURI).href;

// KayKit clip name -> motion-capture clip id
const CLIP_MAP = {
  Idle: 'idle', Running_A: 'run', Running_B: 'run', Walking_A: 'walk', Walking_B: 'walk',
  '1H_Melee_Attack_Chop': 'sword_slash', '1H_Melee_Attack_Slice_Diagonal': 'sword_combo', '1H_Melee_Attack_Slice_Horizontal': 'sword_slash', '1H_Melee_Attack_Stab': 'sword_thrust',
  '2H_Melee_Attack_Chop': 'sword_combo', '2H_Melee_Attack_Slice': 'sword_combo', '2H_Melee_Attack_Stab': 'sword_thrust', '2H_Melee_Attack_Spin': 'sword_combo', '2H_Melee_Attack_Spinning': 'sword_combo',
  Dualwield_Melee_Attack_Stab: 'sword_thrust', Dualwield_Melee_Attack_Slice: 'sword_slash', Dualwield_Melee_Attack_Chop: 'sword_slash',
  Unarmed_Melee_Attack_Punch_A: 'punch', Unarmed_Melee_Attack_Punch_B: 'punch_combo', Unarmed_Melee_Attack_Kick: 'kick_front',
  Spellcast_Shoot: 'throw_grenade', Spellcast_Raise: 'cheer', Spellcast_Long: 'throw_grenade', Spellcasting: 'talk', '1H_Ranged_Shoot': 'throw_grenade', '2H_Ranged_Shoot': 'throw_grenade',
  '1H_Ranged_Aiming': 'point', '2H_Ranged_Aiming': 'point',
  Hit_A: 'hit_front', Hit_B: 'hit_back', Death_A: 'death_forward', Death_B: 'death_backward', Cheer: 'cheer', Interact: 'use_press', Throw: 'throw_grenade',
  Sit_Floor_Idle: 'sit_idle', Sit_Chair_Idle: 'sit_idle', '2H_Melee_Idle': 'sword_idle', '1H_Melee_Idle': 'sword_idle',
  Block: 'sword_block', Blocking: 'sword_block', Jump_Full_Short: 'jump', Dodge_Forward: 'roll_forward', Dodge_Left: 'dodge_left', Dodge_Right: 'dodge_right',
  PickUp: 'pick_up', Lie_Idle: 'sleep', Wave: 'wave', Talk: 'talk_gestures', Laugh: 'laugh',
};
const CLIPS = [...new Set(Object.values(CLIP_MAP))];
const FALLBACK = (name) => (/Death/.test(name) ? 'death_forward' : /Hit/.test(name) ? 'hit_front' : /Run/.test(name) ? 'run' : /Walk/.test(name) ? 'walk' : /Attack/.test(name) ? 'sword_slash' : /Spell|Cast|Shoot|Throw/.test(name) ? 'throw_grenade' : 'idle');

export const HAIR_STYLES = [
  ['short01', 'Cropped'], ['short02', 'Short'], ['short03', 'Swept'], ['short04', 'Parted'], ['bob01', 'Bob'], ['bob02', 'Long bob'], ['long01', 'Long'],
  ['ponytail01', 'Ponytail'], ['braid01', 'Braid'], ['afro01', 'Afro'], ['buzz', 'Buzz cut'], ['mohawk', 'Mohawk'], ['cornrows', 'Cornrows'], ['box_braids', 'Box braids'], ['none', 'Shaved'],
];
export const BEARDS = [['none', 'Clean-shaven'], ['stubble', 'Stubble'], ['mustache', 'Moustache'], ['goatee', 'Goatee'], ['short_beard', 'Short beard'], ['full_beard', 'Full beard']];
export const EYE_COLORS = [['brown', 'Brown'], ['darkbrown', 'Dark brown'], ['blue', 'Blue'], ['green', 'Green'], ['grey', 'Grey'], ['ice', 'Ice'], ['bluegreen', 'Teal']];
// skin tones: ethnic mix + a small tint, ordered fair to dark
export const SKIN_PRESETS = [
  { name: 'Pale', c: [0, 0, 1], tint: '#ffffff' }, { name: 'Fair', c: [0, 0.1, 0.9], tint: '#ffffff' }, { name: 'Olive', c: [0.1, 0.2, 0.7], tint: '#f4e6d0' },
  { name: 'Tan', c: [0.3, 0.1, 0.6], tint: '#e8cfae' }, { name: 'Brown', c: [0.75, 0, 0.25], tint: '#ffffff' }, { name: 'Dark', c: [1, 0, 0], tint: '#ffffff' },
];
export const HAIR_COLORS = ['#15110e', '#2a1c12', '#4a3020', '#7a5230', '#a87a3e', '#d8b866', '#8a2a1a', '#b84a20', '#8c8c90', '#e8e4dc', '#3a2a5a', '#1f4a6a', '#2a6a3a', '#7a1a2a'];
export const HIGHLIGHT_COLORS = ['', '#d8b866', '#e8e4dc', '#b84a20', '#8a2a1a', '#6a4aa8', '#3a8ac0', '#c04a7a', '#4aa86a', '#ffd84d'];

const STYLES = { m: ['short02', 'short03', 'short04', 'short01'], f: ['long01', 'ponytail01', 'bob01', 'braid01'] };
export const defaultLook = (cls, sex) => ({ sex, weight: 0.5, muscle: cls === 'Mage' ? 0.3 : cls === 'Rogue' ? 0.45 : 0.65, hairStyle: STYLES[sex][0], hairColor: '#2a1c12', hairHi: '', beard: sex === 'm' && cls !== 'Mage' ? 'stubble' : 'none', eyes: 'brown', skinTone: 1 });

// garments by armour kind (this is the body the plates go on)
const OUTFIT = {
  none: { top: 'tattered_shirt', bottom: 'tattered_pants', shoes: 'sandals', accessories: ['belt'] },
  robe: { top: 'long_tunic', bottom: 'trousers', shoes: 'loafers', accessories: ['belt', 'shoulder_drape', 'waist_sash'] },
  leathers: { top: 'tunic', bottom: 'trousers', shoes: 'combat_boots', accessories: ['leather_armor', 'arm_wraps', 'belt', 'gloves', 'crossed_straps'] },
  furs: { top: 'tattered_shirt', bottom: 'hide_aprons', shoes: 'combat_boots', accessories: ['fur_bands', 'arm_wraps', 'belt', 'gloves'] },
  plate: { top: 'tunic', bottom: 'trousers', shoes: 'combat_boots', accessories: ['belt', 'gloves'] },
  merchant: { top: 'tunic', bottom: 'trousers', shoes: 'loafers', accessories: ['waist_sash', 'shoulder_drape', 'gold_necklace'] },
  smith: { top: 'tattered_shirt', bottom: 'hide_aprons', shoes: 'combat_boots', accessories: ['arm_wraps', 'belt', 'gloves'] },
  healer: { top: 'long_tunic', bottom: 'trousers', shoes: 'sandals', accessories: ['shoulder_drape', 'waist_sash', 'silver_cross'] },
  peasant: { top: 'tunic', bottom: 'trousers', shoes: 'sandals', accessories: ['belt'] },
  farmer: { top: 'tattered_shirt', bottom: 'trousers', shoes: 'combat_boots', accessories: ['belt', 'arm_wraps'] },
  bard: { top: 'tunic', bottom: 'trousers', shoes: 'loafers', accessories: ['crossed_straps', 'waist_sash', 'beret'] },
  noble: { top: 'long_tunic', bottom: 'trousers', shoes: 'oxfords', accessories: ['gold_chains', 'waist_sash'] },
};
const ARMOR_KIND = (it, cls) => {
  if (!it) return cls === 'Mage' ? 'robe' : 'none';
  const v = it.vis || '';
  return v === 'Mage' ? 'robe' : v === 'Rogue' ? 'leathers' : v === 'Barbarian' ? 'furs' : v === 'Knight' ? 'plate' : 'leathers';
};
const CLOTH_COLORS = { Knight: '#3a3a44', Barbarian: '#4a3828', Mage: '#3a2a5a', Rogue: '#26303a' };

function paramsFor(look, cls, kind, sub) {
  const sex = look.sex === 'f' ? 'f' : 'm';
  const sk = SKIN_PRESETS[look.skinTone ?? 1] || SKIN_PRESETS[1];
  const o = OUTFIT[kind];
  const cloth = CLOTH_COLORS[cls] || '#3a3a44';
  return {
    name: 'Hero', seed: 7, gender: sex === 'm' ? 1 : 0, age: 0.5, muscle: look.muscle ?? 0.6, weight: look.weight ?? 0.5, height: 0.5 + (look.height ? (look.height - 1) * 1.5 : 0), proportions: 0.5,
    african: sk.c[0], asian: sk.c[1], caucasian: sk.c[2], skinTint: sk.tint,
    breastSize: sex === 'f' ? 0.45 : 0.5, eyes: look.eyes || 'brown',
    hair: look.hairStyle || STYLES[sex][0], hairTint: look.hairColor || '#2a1c12', hairColor: look.hairColor || '#2a1c12',
    facialHair: sex === 'm' ? look.beard || 'none' : 'none', beardColor: look.hairColor || '#2a1c12',
    outfit: 'none', top: o.top, bottom: o.bottom, shoes: o.shoes, hat: 'none', accessories: o.accessories, underwear: true,
    garmentStyles: { [o.top]: { pattern: 'solid', color: cloth }, [o.bottom]: o.bottom === 'hide_aprons' ? { pattern: 'leather', color: '#4a3220' } : { pattern: 'solid', color: '#2c2824' }, ...(sub || {}) },
    expression: 'determined', faceShapes: true, speechShapes: false, tongue: false,
  };
}

// look recipes for townsfolk (a handful of bodies, shared between villagers)
const L = (sex, hairStyle, hairColor, skinTone, weight, muscle, extra = {}) => ({ ...defaultLook('Knight', sex), hairStyle, hairColor, skinTone, weight, muscle, beard: extra.beard || 'none', hairHi: extra.hi || '', eyes: extra.eyes || 'brown' });
export const NPC_SPECS = {
  merchant: { look: L('m', 'short03', '#4a3020', 2, 0.65, 0.35, { beard: 'goatee' }), kind: 'merchant', cloth: { tunic: { pattern: 'solid', color: '#6a3a1a' } } },
  quest: { look: L('f', 'braid01', '#7a5230', 1, 0.45, 0.55), kind: 'bard', cloth: { tunic: { pattern: 'solid', color: '#3a5a3a' } } },
  healer: { look: L('f', 'bob02', '#e8e4dc', 1, 0.4, 0.2, { eyes: 'bluegreen' }), kind: 'healer', cloth: { long_tunic: { pattern: 'solid', color: '#d8d4c8' } } },
  blacksmith: { look: L('m', 'buzz', '#2a1c12', 3, 0.8, 0.95, { beard: 'full_beard' }), kind: 'smith', cloth: {} },
  beastmaster: { look: L('f', 'ponytail01', '#b84a20', 2, 0.5, 0.5), kind: 'farmer', cloth: { tattered_shirt: { pattern: 'solid', color: '#5a4a2a' } } },
  v_m1: { look: L('m', 'short04', '#8c8c90', 1, 0.6, 0.3, { beard: 'full_beard' }), kind: 'peasant', cloth: { tunic: { pattern: 'solid', color: '#6a5a3a' } } },
  v_m2: { look: L('m', 'short01', '#4a3020', 3, 0.55, 0.6), kind: 'farmer', cloth: { tattered_shirt: { pattern: 'solid', color: '#7a6a4a' } } },
  v_m3: { look: L('m', 'short02', '#d8b866', 0, 0.7, 0.5, { beard: 'stubble' }), kind: 'smith', cloth: {} },
  v_m4: { look: L('m', 'afro01', '#15110e', 5, 0.5, 0.55), kind: 'peasant', cloth: { tunic: { pattern: 'solid', color: '#3a4a6a' } } },
  v_f1: { look: L('f', 'long01', '#2a1c12', 2, 0.5, 0.3), kind: 'peasant', cloth: { tunic: { pattern: 'solid', color: '#8a3a3a' } } },
  v_f2: { look: L('f', 'bob01', '#a87a3e', 1, 0.6, 0.25), kind: 'noble', cloth: { long_tunic: { pattern: 'solid', color: '#4a3a6a' } } },
  v_f3: { look: L('f', 'cornrows', '#15110e', 5, 0.45, 0.4), kind: 'healer', cloth: { long_tunic: { pattern: 'solid', color: '#3a6a5a' } } },
  guard: { look: L('m', 'short01', '#2a1c12', 2, 0.65, 0.8), kind: 'plate', cloth: {}, armor: true },
  guardf: { look: L('f', 'ponytail01', '#7a5230', 1, 0.5, 0.7), kind: 'plate', cloth: {}, armor: true },
};
export const fullLook = (look, cls) => ({ ...defaultLook(cls, (look && look.sex) || 'm'), ...(look || {}) });

const CLEAN = new Map();
const cache = new Map();
let queue = Promise.resolve();
export function buildReal(look, cls, kind, extra = {}) {
  const p = paramsFor(look, cls, kind, extra.garmentStyles);
  Object.assign(p, extra.params || {});
  const key = JSON.stringify([p.gender, p.muscle, p.weight, p.height, p.african, p.asian, p.caucasian, p.skinTint, p.eyes, p.hair, p.hairTint, p.facialHair, p.top, p.bottom, p.shoes, p.accessories, p.garmentStyles, p.seed, p.age, p.breastSize, extra.detail]);
  if (cache.has(key)) return cache.get(key);
  const pr = (queue = queue.then(() => createCharacter(p, { animations: CLIPS, detail: extra.detail || 'medium', assetsUrl: ASSET_URL }), () => createCharacter(p, { animations: CLIPS, detail: extra.detail || 'medium', assetsUrl: ASSET_URL })));
  const out = pr.then((res) => res).catch((e) => { cache.delete(key); console.warn('realistic character failed', e); return null; });
  cache.set(key, out);
  return out;
}
export function clearRealCache() { for (const p of cache.values()) p.then((r) => r && r.dispose && null); cache.clear(); }

// ----------------------------------------------------------------- the model wrapper (same API as CharModel)
const METAL = { rusted: 0x6a5648, iron: 0x8a8e96, steel: 0xb8c4d0, bronze: 0xa87040 };
const sharedMats = new Map();
const pm = (color, metal = 0.8, rough = 0.38, em = 0x000000, emi = 0) => {
  const k = [color, metal, rough, em, emi].join('|');
  if (!sharedMats.has(k)) sharedMats.set(k, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: em, emissiveIntensity: emi }));
  return sharedMats.get(k);
};

export class RealChar {
  // res: result of createCharacter. The scene is cloned per instance so one build can serve many.
  constructor(res, opts = {}) {
    this.res = res;
    this.isReal = true;
    this.root = new THREE.Group();
    this.holder = new THREE.Group();
    this.scene = SkeletonUtils.clone(res.scene);
    this.holder.add(this.scene);
    this.root.add(this.holder);
    this.scale = (opts.scale ?? 1);
    this.root.scale.setScalar(this.scale * (opts.fit ?? 1.0));
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.actions = {}; this.current = null; this.oneShot = null; this.parts = {};
    this.bones = {};
    this.scene.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material && o.material.map) o.material.map.anisotropy = 4; this.parts[o.name] = o; }
    });
    this.handR = this.bones.WeaponR || this.bones.RightHand; this.handL = this.bones.LeftHand;
    // clips keyed by the stylised names so game code can ask for them by those names
    this.clips = new Proxy({}, { get: (_, n) => { const c = this.clipFor(n); return c || undefined; } });
    this.worn = [];
    this.tuneMaterials();
    if (opts.look) this.setHair(opts.look.hairColor, opts.look.hairHi);
    this.mixer.addEventListener('finished', (e) => {
      if (this.oneShot && e.action === this.oneShot.action) {
        const cb = this.oneShot.onDone, hold = this.oneShot.hold;
        this.oneShot = null;
        if (!hold) this.play(this.baseName || 'Idle', 0.15);
        cb?.();
      }
    });
    this.play(opts.idle || 'Idle', 0);
  }
  tuneMaterials() {
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (!o.userData.own) { o.material = o.material.clone(); o.userData.own = true; }
      const m = o.material;
      if (m.name === 'Skin') { m.roughness = 0.62; m.color.multiplyScalar(0.9); }
      if (m.name && /Hair/i.test(m.name)) this.hair = o;
      if (m.name && /Tunic|Trousers|Leather|Shirt|Pants|Apron|Fur|Boot|Shoe|Glove|Belt|Wrap|Guard|Pauldron|Drape|Sash|Strap/i.test(m.name)) { m.color.multiplyScalar(0.85); m.roughness = Math.max(0.7, m.roughness || 0.8); }
    });
  }
  // two-tone hair: highlight streaks are mixed in over the main colour
  setHair(main, highlight) {
    const o = this.hair; if (!o) return;
    const m = o.material;
    if (!m.userData.hl) {
      m.userData.hl = { value: new THREE.Color(0xffffff), on: { value: 0 } };
      const u = m.userData.hl;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uHl = u; sh.uniforms.uHlOn = u.on;
        sh.vertexShader = 'varying vec2 vHu;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vHu = uv;');
        sh.fragmentShader = 'uniform vec3 uHl; uniform float uHlOn; varying vec2 vHu;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float st = sin(vHu.x * 61.0 + sin(vHu.y * 17.0) * 2.2) * 0.5 + 0.5;
          float st2 = sin(vHu.x * 23.0 - vHu.y * 11.0) * 0.5 + 0.5;
          float mk = smoothstep(0.72, 0.9, st * 0.65 + st2 * 0.45) * uHlOn;
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, uHl * (0.55 + lum * 1.1), mk);`);
      };
      m.customProgramCacheKey = () => 'hairhl';
      m.needsUpdate = true;
    }
    if (main) m.color.set(main);
    m.userData.hl.value.set(highlight || '#ffffff');
    m.userData.hl.on.value = highlight ? 1 : 0;
  }
  // ---------------------------------------------------------------- animation
  clipFor(name) {
    if (this.res.animations.length === 0) return null;
    const id = CLIP_MAP[name] || FALLBACK(name);
    return this.res.clip(id) || this.res.clip('idle');
  }
  action(name) {
    const id = CLIP_MAP[name] || FALLBACK(name);
    if (!this.actions[id]) {
      let clip = this.res.clip(id) || this.res.clip('idle');
      if (!clip) return null;
      if (!CLEAN.has(clip)) { const c2 = clip.clone(); c2.tracks = c2.tracks.filter((t) => !/araFace/.test(t.name)); CLEAN.set(clip, c2); }
      clip = CLEAN.get(clip);
      this.actions[id] = this.mixer.clipAction(clip);
    }
    return this.actions[id];
  }
  play(name, fade = 0.2, timeScale = 1) {
    this.baseName = name;
    if (this.oneShot) return;
    const a = this.action(name);
    if (!a || this.current === a) { if (a) a.timeScale = timeScale * this.speedFor(name); return; }
    a.reset().setLoop(THREE.LoopRepeat, Infinity);
    a.timeScale = timeScale * this.speedFor(name);
    a.enabled = true; a.play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }
  speedFor(name) { return /Running/.test(name) ? 1.15 : /Walking/.test(name) ? 1.2 : 1; }
  once(name, { fade = 0.12, timeScale = 1, hold = false, onDone } = {}) {
    const a = this.action(name);
    if (!a) { onDone?.(); return 0; }
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = timeScale;
    a.enabled = true; a.play();
    const prev = this.oneShot ? this.oneShot.action : this.current;
    if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
    this.oneShot = { action: a, onDone, hold };
    this.current = a;
    return a.getClip().duration / timeScale;
  }
  flash(s = 1) { modelFlash(this, s); }
  update(dt) { this.mixer.update(dt); modelFlashTick(this, dt); }
  applyLook() {}
  setGear() {}
  setCapeColor() {}
  attach(propName, left = false) { return null; }

  // ---------------------------------------------------------------- gear
  clearWorn() { for (const o of this.worn) { o.parent?.remove(o); } this.worn = []; }
  add(obj, bone) { (this.bones[bone] || this.scene).add(obj); this.worn.push(obj); return obj; }
  dress(equipment, look, cls, look2) {
    this.clearWorn();
    const W = this.itemLook;
    const eq = equipment || {};
    const wl = W(eq.weapon), ol = W(eq.offhand), hl = W(eq.helm), al = W(eq.armor);
    if (wl) this.holdItem(wl, 'right', eq.weapon);
    if (ol) this.holdItem(ol, 'left', eq.offhand);
    if (hl && look?.helm !== false) this.wearHelm(hl);
    if (al) this.wearPlates(al, ARMOR_KIND(al), cls);
    const am = W(eq.amulet), rg = W(eq.ring);
    if (am) this.wearJewel(am, 'amulet');
    if (rg) this.wearJewel(rg, 'ring');
  }
  holdItem(l, side, it) {
    const src = findSource(l.vis);
    if (!src) return;
    const m = src.node.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); tintMaterial(o.material, l); o.castShadow = true; o.frustumCulled = false; o.visible = true; } });
    m.visible = true;
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.quaternion.identity();
    const g = new THREE.Group();
    g.add(m);
    const shield = /Shield|Badge/.test(l.vis), book = /Spellbook/.test(l.vis);
    if (side === 'right') { g.rotation.set(Math.PI / 2, 0, 0); g.scale.setScalar(0.6); }
    else if (shield) { g.rotation.set(0, Math.PI / 2, Math.PI / 2); g.position.set(0.0, 0.1, 0.0); g.scale.setScalar(0.62); }
    else if (book) { g.rotation.set(0, 0, 0); g.position.set(0, 0.06, 0.03); g.scale.setScalar(0.6); }
    else { g.rotation.set(Math.PI / 2, 0, 0); g.scale.setScalar(0.6); }
    this.add(g, side === 'right' ? 'RightHand' : 'LeftHand');
  }
  wearHelm(l) {
    const src = findSource(l.vis);
    if (!src) return;
    const m = src.node.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); tintMaterial(o.material, l); o.castShadow = true; o.frustumCulled = false; o.visible = true; } });
    m.visible = true; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
    const g = new THREE.Group(); g.add(m);
    g.scale.setScalar(0.135); g.position.set(0, 0.035, 0.0);
    this.add(g, 'Head');
  }
  wearJewel(l, kind) {
    const mat = pm(0xe0b850, 0.9, 0.25, 0x6a4a10, 0.3);
    const gem = pm(new THREE.Color(l.tint || 0x66aaff), 0.2, 0.15, new THREE.Color(l.tint || 0x66aaff), 0.8);
    const g = new THREE.Group();
    if (kind === 'amulet') {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 6, 24), mat); chain.rotation.x = Math.PI / 2 - 0.35; g.add(chain);
      const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), gem); j.position.set(0, -0.06, 0.09); g.add(j);
      g.position.set(0, 0.1, 0.03); this.add(g, 'Spine2');
    } else {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 14), mat); r.rotation.y = Math.PI / 2; g.add(r);
      const j = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), gem); j.position.y = 0.014; g.add(j);
      g.position.set(0, 0.07, 0); this.add(g, 'LeftHandRing1');
    }
  }
  // armour plates sized from the rest-pose skeleton
  wearPlates(l, kind, cls) {
    if (kind === 'none' || kind === 'robe') return this.wearRobeTrim(l, kind);
    const sc = this.scene; sc.updateMatrixWorld(true);
    const wp = (n) => (this.bones[n] ? this.bones[n].getWorldPosition(new THREE.Vector3()) : new THREE.Vector3());
    const rel = (n) => sc.worldToLocal(wp(n));
    const hips = rel('Hips'), neck = rel('Neck'), lsh = rel('LeftArm'), rsh = rel('RightArm'), spine1 = rel('Spine1');
    const sw = Math.abs(lsh.x - rsh.x);
    const torsoH = neck.y - hips.y;
    const fur = kind === 'furs', leather = kind === 'leathers';
    const col = new THREE.Color(l.tint).multiply(new THREE.Color(fur ? 0x8a7050 : leather ? 0x6a4a30 : 0xaab0b8));
    const glow = new THREE.Color(l.glow || 0);
    const metalMat = fur ? pm(col.getHex(), 0, 0.95) : leather ? pm(col.getHex(), 0.05, 0.75) : pm(col.getHex(), 0.88, 0.34, glow.getHex(), glow.getHex() ? 1 : 0);
    const trim = pm(0x2a2218, 0.3, 0.7);
    const accent = pm(l.rarity >= 3 ? 0xff9a2a : l.rarity === 2 ? 0xffd84d : 0x8a6a30, 0.9, 0.3, l.rarity >= 2 ? 0x663300 : 0, l.rarity >= 2 ? 0.6 : 0);
    const bodyDepth = sw * 0.42;
    const group = (parent, fn) => { const g = new THREE.Group(); fn(g); this.add(g, parent); return g; };
    const toLocal = (bone, v) => this.bones[bone].worldToLocal(sc.localToWorld(v.clone()));
    const place = (obj, bone, v) => { obj.position.copy(toLocal(bone, v)); return obj; };
    // ---- chest: an ellipsoid shell with ridge and collar, parented to Spine2
    const chestC = new THREE.Vector3((lsh.x + rsh.x) / 2, hips.y + torsoH * 0.6, bodyDepth * 0.1);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), metalMat);
    chest.scale.set(sw * 0.58, torsoH * 0.36, sw * (kind === 'plate' ? 0.38 : 0.34));
    place(chest, 'Spine2', chestC); chest.castShadow = true; this.worn.push(chest); this.bones.Spine2.add(chest);
    if (kind === 'plate') {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.012, torsoH * 0.5, 0.02), accent);
      ridge.position.set(0, 0, bodyDepth * 1.0); chest.add(ridge); ridge.scale.set(1 / (sw * 0.43), 1 / (torsoH * 0.31), 1 / (bodyDepth));
      const collar = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 24), metalMat);
      collar.rotation.x = Math.PI / 2; collar.scale.set(sw * 0.2, sw * 0.2, sw * 0.14);
      place(collar, 'Spine2', new THREE.Vector3((lsh.x + rsh.x) / 2, neck.y - torsoH * 0.04, 0)); this.bones.Spine2.add(collar); this.worn.push(collar);
      // belly lames
      for (let i = 0; i < 3; i++) {
        const lame = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 8, 22), metalMat);
        lame.rotation.x = Math.PI / 2; lame.scale.set(sw * 0.3 - i * 0.004, bodyDepth * 0.86, sw * 0.26);
        place(lame, 'Spine', new THREE.Vector3((lsh.x + rsh.x) / 2, hips.y + torsoH * (0.24 + i * 0.1), bodyDepth * 0.04));
        this.bones.Spine.add(lame); this.worn.push(lame);
      }
    }
    // ---- pauldrons
    for (const side of ['Left', 'Right']) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), metalMat);
      const r = sw * (fur ? 0.36 : 0.31);
      dome.scale.set(r, r * 0.9, r * 1.1);
      const sh = side === 'Left' ? lsh : rsh;
      place(dome, `${side}Arm`, new THREE.Vector3(sh.x + (side === 'Left' ? 0.01 : -0.01), sh.y + 0.015, sh.z)); this.bones[`${side}Arm`].add(dome); this.worn.push(dome);
      dome.rotation.z = side === 'Left' ? -0.35 : 0.35;
      if (kind === 'plate') {
        const lam = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.82, 0.55, 16, 1, true), metalMat);
        lam.material = metalMat; lam.scale.set(r * 0.92, r * 0.9, r * 0.92);
        place(lam, `${side}Arm`, new THREE.Vector3(sh.x, sh.y - r * 0.5, sh.z)); this.bones[`${side}Arm`].add(lam); this.worn.push(lam);
      }
    }
    // ---- limb guards: segment along the bone toward its child
    const seg = (boneName, childName, r0, r1, from, to, mat) => {
      const a = rel(boneName), b = rel(childName);
      const v = b.clone().sub(a); const len = v.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len * (to - from), 14, 1, false), mat);
      const mid = a.clone().addScaledVector(v, (from + to) / 2);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      const bone = this.bones[boneName];
      const wq = bone.getWorldQuaternion(new THREE.Quaternion());
      const scq = sc.getWorldQuaternion(new THREE.Quaternion());
      mesh.position.copy(toLocal(boneName, mid));
      mesh.quaternion.copy(wq.invert().multiply(scq).multiply(q));
      mesh.castShadow = true; bone.add(mesh); this.worn.push(mesh);
      return mesh;
    };
    const arm = sw * 0.07;
    for (const side of ['Left', 'Right']) {
      seg(`${side}ForeArm`, `${side}Hand`, arm * 0.88, arm * 0.7, 0.12, 0.92, leather ? pm(0x4a3220, 0, 0.8) : metalMat);
      if (kind === 'plate') seg(`${side}Arm`, `${side}ForeArm`, arm * 1.05, arm * 0.95, 0.35, 0.95, metalMat);
      seg(`${side}Leg`, `${side}Foot`, sw * 0.095, sw * 0.07, 0.1, 0.9, kind === 'plate' ? metalMat : leather ? pm(0x4a3220, 0, 0.8) : pm(0x6a5238, 0, 0.95));
      if (kind === 'plate') seg(`${side}UpLeg`, `${side}Leg`, sw * 0.125, sw * 0.1, 0.35, 0.95, trim);
      // knee cop
      if (kind === 'plate') { const k = new THREE.Mesh(new THREE.SphereGeometry(sw * 0.06, 12, 8), accent); const p = rel(`${side}Leg`); p.z += sw * 0.07; place(k, `${side}Leg`, p); this.bones[`${side}Leg`].add(k); this.worn.push(k); }
    }
    // tassets
    if (kind === 'plate' || kind === 'furs') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(sw * 0.24, sw * 0.3, torsoH * 0.22, 18, 1, true), metalMat);
      t.material = metalMat.clone(); t.material.side = THREE.DoubleSide;
      place(t, 'Hips', new THREE.Vector3((lsh.x + rsh.x) / 2, hips.y - torsoH * 0.02, 0)); this.bones.Hips.add(t); this.worn.push(t);
    }
  }
  wearRobeTrim(l, kind) {
    if (kind === 'none') return;
    const sc = this.scene; sc.updateMatrixWorld(true);
    const lsh = sc.worldToLocal(this.bones.LeftArm.getWorldPosition(new THREE.Vector3())), rsh = sc.worldToLocal(this.bones.RightArm.getWorldPosition(new THREE.Vector3()));
    const sw = Math.abs(lsh.x - rsh.x);
    const col = new THREE.Color(l.tint).multiply(new THREE.Color(0x6a4aa0));
    const m = pm(col.getHex(), 0.1, 0.8, new THREE.Color(l.glow || 0).getHex(), 0.6);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(sw * 0.2, sw * 0.055, 10, 24), m);
    hood.rotation.x = Math.PI / 2 - 0.2;
    const neck = sc.worldToLocal(this.bones.Neck.getWorldPosition(new THREE.Vector3()));
    hood.position.copy(this.bones.Spine2.worldToLocal(sc.localToWorld(new THREE.Vector3(neck.x, neck.y - 0.03, neck.z))));
    this.bones.Spine2.add(hood); this.worn.push(hood);
  }
}
RealChar.prototype.itemLook = () => null;
export function setRealItemLook(fn) { RealChar.prototype.itemLook = (it) => (it ? fn(it) : null); }

export { ARMOR_KIND };

// Build the realistic model for a hero spec and hand it to `done(model)`; used by the inventory view and character creation.
export async function realFor(look, cls, equipment, lookOf, opts = {}) {
  if (!REAL_OK) return null;
  const al = equipment && equipment.armor ? lookOf(equipment.armor) : null;
  const kind = opts.kind || ARMOR_KIND(al, cls);
  const res = await buildReal(look || {}, cls, kind, { detail: opts.detail || 'medium', garmentStyles: opts.cloth });
  return res ? new RealChar(res, { scale: opts.scale ?? ((look && look.height) || 1), look }) : null;
}
