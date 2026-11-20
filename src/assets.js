import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// All third-party models are CC0 (KayKit by Kay Lousberg). See assets/LICENSE-*.txt
const CHARS = ['Knight', 'Mage', 'Rogue', 'Rogue_Hooded', 'Barbarian', 'Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue'];
const PROPS_CHAR = ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff', 'Skeleton_Crossbow', 'Skeleton_Shield_Small_A', 'Skeleton_Shield_Large_A'];
const DUNGEON = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small_broken_A', 'floor_tile_small_weeds_A', 'floor_dirt_large', 'wall', 'wall_cracked', 'wall_broken', 'wall_half', 'pillar', 'pillar_decorated', 'torch_mounted', 'torch_lit', 'barrel_large', 'barrel_small', 'box_stacked', 'crates_stacked', 'chest', 'chest_gold', 'rubble_large', 'rubble_half', 'banner_patternA_red', 'banner_thin_blue', 'column', 'stairs', 'coin_stack_medium', 'candle_triple', 'table_long_broken', 'keg', 'bottle_A_brown', 'sword_shield_broken', 'trunk_large_A', 'shelf_small_candles'];
const TOWN = ['building_tavern_blue', 'building_market_red', 'building_church_blue', 'building_blacksmith_green', 'building_home_A_yellow', 'building_home_B_red', 'building_home_A_blue', 'building_well_blue', 'building_windmill_yellow', 'building_tower_A_blue', 'tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_medium', 'rock_single_A', 'rock_single_C', 'fence_wood_straight', 'wall_straight', 'tent', 'barrel', 'crate_A_big', 'sack', 'weaponrack', 'wheelbarrow', 'flag_red', 'bucket_water', 'hills_A_trees', 'mountain_A_grass_trees', 'waterlily_A', 'waterplant_A', 'resource_lumber',
  'building_home_A_green', 'building_home_B_blue', 'building_home_B_green', 'building_home_A_red', 'building_home_B_yellow', 'building_grain', 'building_lumbermill_yellow', 'building_stage_A', 'building_watermill_blue', 'building_tower_B_red', 'building_market_yellow', 'building_archeryrange_green', 'fence_wood_straight_gate', 'trees_A_small', 'tree_single_A_cut', 'rock_single_B', 'hills_B_trees', 'crate_open', 'pallet', 'target', 'bucket_arrows', 'flag_blue', 'flag_yellow', 'cloud_big', 'crate_long_A', 'ladder', 'resource_stone', 'hill_single_A',
  'building_barracks_red', 'building_tavern_red', 'building_mine_yellow', 'building_castle_blue', 'building_scaffolding', 'building_windmill_red', 'building_bridge_A', 'building_blacksmith_red', 'building_tower_A_yellow', 'trees_A_large', 'fence_stone_straight', 'crate_B_big', 'building_watermill_green', 'building_church_yellow', 'building_market_blue', 'building_tower_catapult_red'];

export const Assets = { models: {}, anims: {}, ready: false };

// The web build ships each model gzipped and base64-encoded as .txt (some hosts only serve text files).
async function fetchModel(loader, url) {
  if (!globalThis.HM_PACKED) return loader.loadAsync(url);
  const r = await fetch(url.replace(/\.glb$/, '.txt'));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const s = atob((await r.text()).trim());
  const bin = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return loader.parseAsync(ab, '');
}

export async function loadAll(base, onProgress) {
  const loader = new GLTFLoader();
  const jobs = [
    ...CHARS.map((n) => ['char', n, `${base}chars/${n}.glb`]),
    ...PROPS_CHAR.map((n) => ['prop', n, `${base}chars/${n}.glb`]),
    ...DUNGEON.map((n) => ['prop', n, `${base}dungeon/${n}.glb`]),
    ...TOWN.map((n) => ['prop', n, `${base}town/${n}.glb`]),
  ];
  let done = 0;
  await Promise.all(jobs.map(async ([kind, name, url]) => {
    try {
      const g = await fetchModel(loader, url);
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      Assets.models[name] = g.scene;
      if (kind === 'char') {
        const map = {};
        for (const clip of g.animations) map[clip.name] = clip;
        Assets.anims[name] = map;
      }
    } catch (e) { console.error('asset failed', url, e); }
    done++;
    onProgress?.(done / jobs.length);
  }));
  Assets.ready = true;
}

export function prop(name) {
  const src = Assets.models[name];
  if (!src) return new THREE.Group();
  return src.clone(true);
}

// geometry + material of a single-mesh prop (for instancing)
export function propMesh(name) {
  const src = Assets.models[name];
  let mesh = null;
  src?.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  return mesh;
}

const CLASS_ACCESSORIES = {
  Knight: { weapon: ['1H_Sword'], offhand: ['Round_Shield'] },
  Mage: { weapon: ['2H_Staff'], offhand: ['Spellbook'] },
  Rogue: { weapon: ['Knife'], offhand: ['Knife_Offhand'] },
  Rogue_Hooded: { weapon: ['Knife'], offhand: ['Knife_Offhand'] },
  Barbarian: { weapon: ['1H_Axe'], offhand: ['Barbarian_Round_Shield'] },
};
const ALL_ACCESSORIES = ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', '1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'];

// Where a wearable mesh lives: a node inside one of the hero/skeleton models, or a standalone prop file.
const SOURCE_MODELS = ['Knight', 'Mage', 'Barbarian', 'Rogue', 'Rogue_Hooded', 'Skeleton_Warrior', 'Skeleton_Mage'];
const sourceCache = {};
export function findSource(vis) {
  if (vis in sourceCache) return sourceCache[vis];
  let found = null;
  if (PROPS_CHAR.includes(vis) && Assets.models[vis]) found = { node: Assets.models[vis], bone: /Shield/.test(vis) ? 'handslot.l' : 'handslot.r' };
  for (const n of SOURCE_MODELS) {
    if (found) break;
    const o = Assets.models[n]?.getObjectByName(vis);
    if (o && !o.isSkinnedMesh) found = { node: o, bone: o.parent?.name };
  }
  sourceCache[vis] = found;
  return found;
}
let itemLook = () => null;
export function setItemLook(fn) { itemLook = fn; }
// recolour a cloned material for an item's material tier / dye / rarity / gems
export function tintMaterial(mat, l, skinSafe = false) {
  if (!l) return;
  if (skinSafe) skinSafeTint(mat, l.tint); else mat.color.multiply(new THREE.Color(l.tint));
  const glow = new THREE.Color(l.glow || 0);
  for (const g of l.gems || []) glow.add(new THREE.Color(g).multiplyScalar(0.07));
  if (l.rarity >= 3) glow.add(new THREE.Color(0xff8c1f).multiplyScalar(0.1));
  if (glow.r + glow.g + glow.b > 0.001) { mat.emissive = glow; mat.emissiveIntensity = 1; }
  if (l.tint !== 0xffffff) { mat.metalness = Math.max(mat.metalness || 0, 0.25); mat.roughness = Math.min(mat.roughness ?? 1, 0.6); }
}
// Tint cloth/metal but keep skin tones (faces and hands share the texture atlas with clothes).
export function skinSafeTint(mat, color, skin = null) {
  const c = new THREE.Color(color);
  if (mat.userData.tintU) { mat.userData.tintU.value.copy(c); if (skin) mat.userData.skinU.value.set(skin); return; }
  const u = { value: c }, su = { value: new THREE.Color(skin || 0xffffff) };
  mat.userData.tintU = u; mat.userData.skinU = su;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = u; sh.uniforms.uSkin = su;
    sh.fragmentShader = 'uniform vec3 uTint;\nuniform vec3 uSkin;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 dc = diffuseColor.rgb;
      float sk = step(0.45, dc.r) * step(0.2, dc.g) * step(0.11, dc.b) * step(dc.g, dc.r) * step(dc.b, dc.g) * step(0.36, dc.g / max(dc.r, 0.001)) * step(dc.b / max(dc.r, 0.001), 0.75);
      diffuseColor.rgb *= mix(uTint, uSkin, sk);`);
  };
  mat.customProgramCacheKey = () => 'skintint2';
  mat.needsUpdate = true;
}
// procedural ring / amulet / gem meshes (also used for icons)
const jewelGeo = {};
export function jewelMesh(l, kind) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: l.tint, metalness: 0.9, roughness: 0.25 });
  const stone = new THREE.MeshStandardMaterial({ color: l.stone, emissive: l.stone, emissiveIntensity: 0.6 + l.rarity * 0.3, metalness: 0.2, roughness: 0.1 });
  jewelGeo.torus ||= new THREE.TorusGeometry(0.3, 0.07, 10, 28);
  jewelGeo.gem ||= new THREE.OctahedronGeometry(0.16, 0);
  jewelGeo.thin ||= new THREE.TorusGeometry(0.42, 0.025, 6, 32, Math.PI);
  if (kind === 'ring') {
    const t = new THREE.Mesh(jewelGeo.torus, metal); g.add(t);
    const s = new THREE.Mesh(jewelGeo.gem, stone); s.position.y = 0.36; s.scale.set(1, 0.8, 1); g.add(s);
  } else {
    const chain = new THREE.Mesh(jewelGeo.thin, metal); chain.rotation.z = Math.PI; chain.position.y = 0.42; g.add(chain);
    const frame = new THREE.Mesh(jewelGeo.torus, metal); frame.scale.setScalar(0.62); g.add(frame);
    const s = new THREE.Mesh(jewelGeo.gem, stone); s.scale.set(1, 1.3, 0.6); g.add(s);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// An animated, skinned character instance.

// white hit-flash plus a quick squash, shared by the stylised and the realistic character models
export function modelFlash(m, s = 1) {
  if (!m._fm) {
    m._fm = [];
    m.root.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      if (!o.userData.ownMat && !o.userData.own) { o.material = o.material.clone(); o.userData.ownMat = true; }
      const mat = o.material;
      if (mat.emissive) m._fm.push({ m: mat, e: mat.emissive.clone(), i: mat.emissiveIntensity });
    });
    m._fbase = m.root.scale.clone();
  }
  m._fd = 0.14; m._ft = m._fd; m._fs = Math.min(2, s);
}
const FLASH_WHITE = new THREE.Color(1, 0.94, 0.85);
export function modelFlashTick(m, dt) {
  if (!(m._ft > 0)) return;
  m._ft = Math.max(0, m._ft - dt);
  const k = m._ft / m._fd, ks = k * m._fs;
  for (const f of m._fm) { f.m.emissive.copy(f.e).lerp(FLASH_WHITE, Math.min(1, ks * 0.85)); f.m.emissiveIntensity = f.i + ks * 0.9; }
  const b = m._fbase;
  m.root.scale.set(b.x * (1 + 0.06 * ks), b.y * (1 - 0.1 * ks), b.z * (1 + 0.06 * ks));
}

export class CharModel {
  constructor(name, opts = {}) {
    this.name = name;
    const src = Assets.models[name];
    this.root = src ? SkeletonUtils.clone(src) : new THREE.Group();
    this.scale = opts.scale ?? 0.72;
    this.root.scale.setScalar(this.scale);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = Assets.anims[name] || {};
    this.actions = {};
    this.current = null;
    this.oneShot = null;
    this.parts = {};
    this.root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        this.parts[o.name] = o;
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (opts.tint || opts.emissive) {
          o.material = o.material.clone();
          if (opts.tint) o.material.color.multiply(new THREE.Color(opts.tint));
          if (opts.emissive) { o.material.emissive = new THREE.Color(opts.emissive); o.material.emissiveIntensity = opts.emissiveIntensity ?? 0.6; }
        }
      }
      if (o.isBone && /handslot\.?r/i.test(o.name)) this.handR = o;
      if (o.isBone && /handslot\.?l/i.test(o.name)) this.handL = o;
    });
    if (CLASS_ACCESSORIES[name]) this.setGear(true, false);
    this.mixer.addEventListener('finished', (e) => {
      if (this.oneShot && e.action === this.oneShot.action) {
        const cb = this.oneShot.onDone;
        const hold = this.oneShot.hold;
        this.oneShot = null;
        if (!hold) this.play(this.baseName || 'Idle', 0.15);
        cb?.();
      }
    });
    this.play(opts.idle || 'Idle', 0);
  }
  setGear(weapon, offhand) {
    const acc = this.gearDef || CLASS_ACCESSORIES[this.name];
    if (!acc) return;
    for (const n of ALL_ACCESSORIES) if (this.parts[n]) this.parts[n].visible = false;
    if (weapon) for (const n of acc.weapon) if (this.parts[n]) this.parts[n].visible = true;
    if (offhand) for (const n of acc.offhand) if (this.parts[n]) this.parts[n].visible = true;
  }
  applyLook(cls, look) {
    this.gearDef = cls.gear ? cls.gear[look.gear || 0] || cls.gear[0] : null;
    if (cls.headgear && this.parts[cls.headgear]) this.parts[cls.headgear].visible = look.helm !== false;
    for (const k in this.parts) {
      if (/Cape|Cloak/.test(k)) this.parts[k].visible = look.capeOn !== false;
    }
    this.setCapeColor(look.cape || cls.cape);
    this.setGear(true, true);
  }
  // ---------------------------------------------------------------- wardrobe
  // Show every equipped item on the 3D model: weapon, off-hand, helm, armor (body/arms/legs), jewellery.
  dress(equipment, look, cls) {
    this.gearDef = null;
    for (const n of ALL_ACCESSORIES) if (this.parts[n]) this.parts[n].visible = false;
    if (cls.headgear && this.parts[cls.headgear]) this.parts[cls.headgear].visible = false;
    for (const o of this.worn || []) o.parent?.remove(o);
    this.worn = [];
    if (!this.bones) { this.bones = {}; this.root.traverse((o) => { if (o.isBone) this.bones[o.name] = o; }); }
    const W = (it) => (it ? itemLook(it) : null);
    const wl = W(equipment.weapon), ol = W(equipment.offhand), hl = W(equipment.helm), al = W(equipment.armor);
    if (wl) this.wear(wl, 'handslot.r');
    if (ol) this.wear(ol, 'handslot.l');
    // helm (look.helm === false hides it)
    const own = this.name === 'Rogue_Hooded' ? 'Rogue' : this.name;
    const head = this.parts[`${own}_Head`] || this.parts.Rogue_Head_Hooded;
    if (head) head.visible = true;
    if (hl && look.helm !== false) {
      if (hl.vis === 'Rogue_Head_Hooded') { if (head) head.visible = false; this.wearSkinned('Rogue_Hooded', 'Rogue_Head_Hooded', hl); }
      else this.wear(hl, 'head');
    }
    // armor: swap body, arms and legs for the armor's outfit
    const parts = ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight'];
    const skin = look.tint && look.tint !== '#ffffff' ? new THREE.Color(look.tint) : null;
    if (al && al.vis !== own) {
      for (const p of parts) { if (this.parts[`${own}_${p}`]) this.parts[`${own}_${p}`].visible = false; this.wearSkinned(al.vis, `${al.vis}_${p}`, al, skin); }
    } else {
      for (const p of parts) {
        const m = this.parts[`${own}_${p}`];
        if (!m) continue;
        m.visible = true;
        if (!m.userData.baseMat) m.userData.baseMat = m.material;
        m.material = m.userData.baseMat.clone();
        if (al) tintMaterial(m.material, al, true);
        if (skin) skinSafeTint(m.material, skin);
      }
    }
    // jewellery: an amulet glints on the chest, a ring on the left hand
    const am = W(equipment.amulet), rg = W(equipment.ring);
    if (am && this.bones.chest) { const j = jewelMesh(am, 'amulet'); j.position.set(0, 0.32, 0.36); j.scale.setScalar(0.55); this.bones.chest.add(j); this.worn.push(j); }
    const handL = this.bones['hand.l'] || this.bones.handl;
    if (rg && handL) { const j = jewelMesh(rg, 'ring'); j.position.set(0, 0.12, 0); j.scale.setScalar(0.35); handL.add(j); this.worn.push(j); }
    // class detail pieces (pauldrons, belts, pouches...)
    this.addDetails(al ? al.vis : own, look, al);
    if (look.capeOn === false) for (const k in this.parts) if (/Cape|Cloak/.test(k)) this.parts[k].visible = false;
    // skin tone: recolour only the skin pixels of every body part, head and hood
    const tone = look.skin && look.skin !== '#ffffff' ? look.skin : null;
    this.root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const mm = o.material;
      const live = mm.userData.tintU && mm.userData.tintU.value && mm.userData.tintU.value.isColor;
      if (!tone && !live) return;
      const tint = live ? mm.userData.tintU.value.clone() : new THREE.Color(0xffffff);
      if (!o.userData.ownMat || !live) { o.material = mm.clone(); o.material.userData = {}; o.userData.ownMat = true; }
      skinSafeTint(o.material, tint, tone || 0xffffff);
    });
  }
  addDetails(outfit, look, al) { /* filled in by details.js */ if (CharModel.detailHook) CharModel.detailHook(this, outfit, look, al); }
  wear(l, boneName) {
    const src = findSource(l.vis);
    if (!src) return null;
    const bone = this.bones[src.bone] || this.bones[boneName];
    if (!bone) return null;
    const m = src.node.clone(true);
    m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); tintMaterial(o.material, l); o.castShadow = true; o.frustumCulled = false; o.visible = true; } });
    m.visible = true;
    bone.add(m);
    this.worn.push(m);
    return m;
  }
  wearSkinned(model, name, l, extraTint = null) {
    const srcRoot = Assets.models[model];
    const src = srcRoot && srcRoot.getObjectByName(name);
    if (!src || !src.isSkinnedMesh) return null;
    const bones = src.skeleton.bones.map((b) => this.bones[b.name]);
    if (bones.some((b) => !b)) return null;
    const m = new THREE.SkinnedMesh(src.geometry, src.material.clone());
    m.name = 'worn_' + name;
    m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
    m.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
    tintMaterial(m.material, l, true);
    if (extraTint) skinSafeTint(m.material, extraTint);
    m.castShadow = true; m.frustumCulled = false;
    const parent = this.root.getObjectByName('Rig') || this.root;
    parent.add(m);
    this.worn.push(m);
    return m;
  }
  setCapeColor(c) {
    for (const k in this.parts) {
      if (/Cape|Cloak/.test(k)) { const m = this.parts[k]; m.material = m.material.clone(); m.material.color.set(c).multiplyScalar(1.6); }
    }
  }
  attach(propName, left = false) {
    const p = prop(propName);
    const bone = left ? this.handL : this.handR;
    if (bone) bone.add(p);
    return p;
  }
  action(name) {
    if (!this.actions[name]) {
      const clip = this.clips[name];
      if (!clip) return null;
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }
  // looping base animation
  play(name, fade = 0.2, timeScale = 1) {
    this.baseName = name;
    if (this.oneShot) return;
    const a = this.action(name);
    if (!a || this.current === a) { if (a) a.timeScale = timeScale; return; }
    a.reset().setLoop(THREE.LoopRepeat, Infinity);
    a.timeScale = timeScale;
    a.enabled = true;
    a.play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }
  // play once, then return to base
  once(name, { fade = 0.1, timeScale = 1, hold = false, onDone } = {}) {
    const a = this.action(name);
    if (!a) { onDone?.(); return 0; }
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = timeScale;
    a.enabled = true;
    a.play();
    const prev = this.oneShot ? this.oneShot.action : this.current;
    if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
    this.oneShot = { action: a, onDone, hold };
    this.current = a;
    return a.getClip().duration / timeScale;
  }
  flash(s = 1) { modelFlash(this, s); }
  update(dt) { this.mixer.update(dt); modelFlashTick(this, dt); }
}
