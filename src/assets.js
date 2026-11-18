import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// All third-party models are CC0 (KayKit by Kay Lousberg). See assets/LICENSE-*.txt
const CHARS = ['Knight', 'Mage', 'Rogue', 'Rogue_Hooded', 'Barbarian', 'Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue'];
const PROPS_CHAR = ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff', 'Skeleton_Crossbow', 'Skeleton_Shield_Small_A', 'Skeleton_Shield_Large_A'];
const DUNGEON = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small_broken_A', 'floor_tile_small_weeds_A', 'floor_dirt_large', 'wall', 'wall_cracked', 'wall_broken', 'wall_half', 'pillar', 'pillar_decorated', 'torch_mounted', 'torch_lit', 'barrel_large', 'barrel_small', 'box_stacked', 'crates_stacked', 'chest', 'chest_gold', 'rubble_large', 'rubble_half', 'banner_patternA_red', 'banner_thin_blue', 'column', 'stairs', 'coin_stack_medium', 'candle_triple', 'table_long_broken', 'keg', 'bottle_A_brown', 'sword_shield_broken', 'trunk_large_A', 'shelf_small_candles'];
const TOWN = ['building_tavern_blue', 'building_market_red', 'building_church_blue', 'building_blacksmith_green', 'building_home_A_yellow', 'building_home_B_red', 'building_home_A_blue', 'building_well_blue', 'building_windmill_yellow', 'building_tower_A_blue', 'tree_single_A', 'tree_single_B', 'trees_A_medium', 'trees_B_medium', 'rock_single_A', 'rock_single_C', 'fence_wood_straight', 'wall_straight', 'tent', 'barrel', 'crate_A_big', 'sack', 'weaponrack', 'wheelbarrow', 'flag_red', 'bucket_water', 'hills_A_trees', 'mountain_A_grass_trees', 'waterlily_A', 'waterplant_A', 'resource_lumber'];

export const Assets = { models: {}, anims: {}, ready: false };

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
      const g = await loader.loadAsync(url);
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

// An animated, skinned character instance.
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
    const acc = CLASS_ACCESSORIES[this.name];
    if (!acc) return;
    for (const n of ALL_ACCESSORIES) if (this.parts[n]) this.parts[n].visible = false;
    if (weapon) for (const n of acc.weapon) if (this.parts[n]) this.parts[n].visible = true;
    if (offhand) for (const n of acc.offhand) if (this.parts[n]) this.parts[n].visible = true;
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
  update(dt) { this.mixer.update(dt); }
}
