// Item icons rendered from the same 3D models the hero wears, so an icon always matches the item on the character.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Assets, findSource, tintMaterial, skinSafeTint, jewelMesh } from './assets.js';
import { lookOf, GEMS, RARITY_COLORS, EXTRA_SLOTS } from './items.js';
import { gearIcon } from './gearvis.js';

const SIZE = 128;
let R = null, scene, cam, cache = new Map();

function init() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  R = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setSize(SIZE, SIZE, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0x99bbff, 2.2); rim.position.set(-3, 1, -2);
  const fill = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(key, rim, fill);
  cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  cam.position.set(0, 0, 5);
}

// the skill emblems (skillicon3d.js) share this renderer rather than opening another graphics context
export function sharedIconRenderer() { if (!R) init(); return R; }
// fit an object into the view: centre it and scale it to a unit box
function frame(obj, fill = 1.55) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const s = fill / Math.max(size.x, size.y, size.z * 0.8, 0.001);
  const g = new THREE.Group();
  obj.position.sub(c);
  g.add(obj);
  g.scale.setScalar(s);
  return g;
}
// rotate a rigid item so its longest axis runs diagonally (like a classic item icon)
function orient(obj, mode) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const s = box.getSize(new THREE.Vector3());
  const piv = new THREE.Group();
  piv.add(obj);
  if (mode === 'weapon') {
    if (s.x >= s.y && s.x >= s.z) obj.rotation.z = Math.PI / 2;
    else if (s.z >= s.y) obj.rotation.x = Math.PI / 2;
    piv.rotation.set(0.35, 0.5, -Math.PI / 4);
  } else if (mode === 'shield') {
    // thinnest axis faces the camera
    if (s.x <= s.y && s.x <= s.z) obj.rotation.y = Math.PI / 2;
    else if (s.y <= s.z) obj.rotation.x = Math.PI / 2;
    piv.rotation.set(0.1, -0.45, 0.08);
  } else if (mode === 'helm') piv.rotation.set(0.25, -0.6, 0);
  else if (mode === 'armor') piv.rotation.set(0.12, -0.35, 0);
  else if (mode === 'jewel') piv.rotation.set(0.4, 0.5, 0.2);
  return piv;
}

function gemMesh(color, tier) {
  const geo = [new THREE.DodecahedronGeometry(0.5, 0), new THREE.OctahedronGeometry(0.55, 0), new THREE.IcosahedronGeometry(0.55, 0), new THREE.OctahedronGeometry(0.6, 1), new THREE.IcosahedronGeometry(0.62, 1)][tier] || new THREE.OctahedronGeometry(0.55, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.25 + tier * 0.12, metalness: 0.1, roughness: 0.08, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.94 }));
  m.scale.set(1, 1.15, 0.8);
  const g = new THREE.Group(); g.add(m);
  g.rotation.set(0.3, 0.6, 0.15);
  return g;
}

function build(it) {
  if (it.slot === 'gem') return gemMesh(GEMS[it.gem].color, it.tier);
  const l = lookOf(it);
  if (l.slot === 'ring' || l.slot === 'amulet') return orient(jewelMesh(l, l.slot), 'jewel');
  if (EXTRA_SLOTS.includes(l.slot)) return orient(gearIcon(l, l.slot), 'armor');
  if (l.slot === 'armor') {
    const src = Assets.models[l.vis];
    if (!src) return null;
    const m = SkeletonUtils.clone(src);
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const keep = /_Body$/.test(o.name);
      o.visible = keep;
      if (keep) { o.material = o.material.clone(); tintMaterial(o.material, l, true); }
    });
    return orient(m, 'armor');
  }
  if (l.vis === 'Rogue_Head_Hooded') {
    const m = SkeletonUtils.clone(Assets.models.Rogue_Hooded);
    m.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.visible = o.name === 'Rogue_Head_Hooded'; if (o.visible) { o.material = o.material.clone(); tintMaterial(o.material, { ...l, tint: 0xffffff }); } } });
    return orient(m, 'helm');
  }
  const src = findSource(l.vis);
  if (!src) return null;
  const m = src.node.clone(true);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  m.traverse((o) => { if (o.isMesh) { o.visible = true; o.material = o.material.clone(); tintMaterial(o.material, l); } });
  return orient(m, l.slot === 'helm' ? 'helm' : l.slot === 'offhand' && /Shield/.test(l.vis) ? 'shield' : 'weapon');
}

const out = document.createElement('canvas');
out.width = out.height = SIZE;
const ctx = out.getContext('2d');

// Returns a data URL for the item's icon, or null if 3D rendering is unavailable.
export function itemIconURL(it) {
  if (!Assets.ready || it.slot === 'fish') return null;
  const l = it.slot === 'gem' ? null : lookOf(it);
  const key = it.slot === 'gem' ? `gem:${it.gem}:${it.tier}` : `${l.slot}:${l.vis}:${l.tint}:${l.glow}:${l.rarity}:${l.stone}:${l.gems.join(',')}:${it.sockets || 0}`;
  if (cache.has(key)) return cache.get(key);
  try {
    if (!R) init();
    const obj = build(it);
    if (!obj) { cache.set(key, null); return null; }
    const f = frame(obj, it.slot === 'armor' ? 1.7 : 1.6);
    scene.add(f);
    R.setClearColor(0x000000, 0);
    R.render(scene, cam);
    scene.remove(f);
    // background glow by rarity, then the render, then socket dots
    ctx.clearRect(0, 0, SIZE, SIZE);
    const rc = '#' + RARITY_COLORS[it.rarity || 0].toString(16).padStart(6, '0');
    const gr = ctx.createRadialGradient(SIZE / 2, SIZE * 0.45, 4, SIZE / 2, SIZE / 2, SIZE * 0.62);
    gr.addColorStop(0, rc + '55'); gr.addColorStop(0.55, rc + '18'); gr.addColorStop(1, '#00000000');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(R.domElement, 0, 0);
    const n = it.sockets || 0;
    for (let i = 0; i < n; i++) {
      const x = SIZE - 16 - i * 20, y = SIZE - 16;
      const g = it.gems && it.gems[i];
      ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = g ? '#' + GEMS[g.gem].color.toString(16).padStart(6, '0') : '#0b0b0f';
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#c9a85a'; ctx.stroke();
      if (g) { ctx.beginPath(); ctx.arc(x - 2, y - 2, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#ffffffaa'; ctx.fill(); }
    }
    const url = out.toDataURL('image/png');
    cache.set(key, url);
    obj.traverse((o) => { if (o.isMesh && o.material) o.material.dispose?.(); });
    return url;
  } catch (e) {
    console.error('icon render failed', e);
    cache.set(key, null);
    return null;
  }
}
