// 3D skill and spell emblems. Each icon is an extruded, bevelled relief (silhouettes from game-icons.net,
// CC BY 3.0, see CREDITS.txt) set into a dark bronze medallion, lit and rendered once to a small image.
// Rendering is spread over idle time so it never costs a frame; until an emblem is ready the flat icon shows.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sharedIconRenderer } from './iconrender.js';

const SIZE = 128;
let data = null, loading = null, scene = null, cam = null, medal = null, glowTex = null;
const urls = new Map(), queue = [], queued = new Set();
const dbg = { urls, queue, get data() { return data; }, all: () => loadSkillIcons().then(() => Object.keys(data.icons).forEach((k) => requestSkill3d(k))) };
if (typeof window !== 'undefined') window.__sk3d = dbg;

export function loadSkillIcons() {
  if (!loading) loading = fetch('assets/icons/skill-icons.json').then((r) => r.json()).then((j) => { data = j; pump(); }).catch(() => { data = { icons: {} }; });
  return loading;
}
export const skill3dURL = (key) => urls.get(key) || null;
export function hasSkill3d(key) { return !data || !!data.icons[key]; }
export function requestSkill3d(key) {
  if (urls.has(key) || queued.has(key)) return;
  queued.add(key); queue.push(key);
  loadSkillIcons();
  if (data) pump();
}

let pumping = false;
function pump() {
  if (pumping || !queue.length || !data) return;
  pumping = true;
  // idle time when there is some; otherwise one emblem every ~150 ms so a busy frame loop never starves it
  const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 150 }) : (f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16);
  const step = (dl) => {
    let n = 0;
    while (queue.length && (n === 0 || dl.timeRemaining() > 6)) {
      const key = queue.shift();
      try { render(key); } catch (e) { dbg.err = String(e && e.stack || e); } // keep the flat icon
      n++;
    }
    if (queue.length) idle(step); else pumping = false;
  };
  idle(step);
}

function setup() {
  const R = sharedIconRenderer();
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environmentIntensity = 0.7;
  const key = new THREE.DirectionalLight(0xfff0dd, 3.2); key.position.set(-2.5, 3, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(3, -1, -2);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));
  scene.userData.rim = rim;
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50); cam.position.set(0, 0, 6.2);
  // medallion: dark iron plate in a bronze bevelled rim
  medal = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.36, 0.16, 64), new THREE.MeshPhysicalMaterial({ color: 0x17130f, metalness: 0.75, roughness: 0.55, clearcoat: 0.3 }));
  plate.rotation.x = Math.PI / 2; medal.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.085, 20, 72), new THREE.MeshPhysicalMaterial({ color: 0xb48a4a, metalness: 1, roughness: 0.3, clearcoat: 0.6 }));
  ring.position.z = 0.08; medal.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 12, 72), new THREE.MeshPhysicalMaterial({ color: 0x6a5030, metalness: 1, roughness: 0.4 }));
  ring2.position.z = 0.085; medal.add(ring2);
  // soft coloured glow behind the relief
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  glow.position.z = 0.09; medal.add(glow); medal.userData.glow = glow;
  scene.add(medal);
}

const loader = new SVGLoader();
function relief(body, size) {
  const svg = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${body.replace(/currentColor/g, '#fff')}</svg>`);
  const shapes = [];
  for (const p of svg.paths) for (const s of SVGLoader.createShapes(p)) shapes.push(s);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: size * 0.07, bevelEnabled: true, bevelThickness: size * 0.025, bevelSize: size * 0.012, bevelSegments: 3, curveSegments: 8 });
  geo.scale(1, -1, 1); // SVG y runs down
  geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -bb.min.z);
  const k = 1.62 / Math.max(s.x, s.y);
  geo.scale(k, k, k * 0.9);
  geo.computeVertexNormals();
  return geo;
}

function render(key) {
  const ic = data.icons[key];
  if (!ic) return;
  if (!scene) setup();
  const R = sharedIconRenderer();
  const col = new THREE.Color(ic.c);
  const face = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.35, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, emissive: col, emissiveIntensity: 0.55 });
  const side = new THREE.MeshPhysicalMaterial({ color: col.clone().multiplyScalar(0.35), metalness: 0.8, roughness: 0.35, emissive: col, emissiveIntensity: 0.12 });
  const geo = relief(ic.b, data.size || 512);
  const m = new THREE.Mesh(geo, [face, side]);
  m.position.z = 0.1;
  medal.add(m);
  medal.userData.glow.material.color.copy(col);
  scene.userData.rim.color.copy(col).lerp(new THREE.Color(0xffffff), 0.4);
  medal.rotation.set(-0.16, 0.24, 0);
  const prevT = R.getRenderTarget(), prevC = new THREE.Color(), prevA = R.getClearAlpha();
  R.getClearColor(prevC);
  R.setRenderTarget(null); R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  R.setRenderTarget(prevT); R.setClearColor(prevC, prevA);
  medal.remove(m); geo.dispose(); face.dispose(); side.dispose();
  urls.set(key, url);
  // swap any flat icon already on screen for the finished emblem
  document.querySelectorAll(`svg[data-sk="${key}"]`).forEach((el) => { el.innerHTML = `<image href="${url}" width="64" height="64"/>`; el.classList.add('sk3d'); });
}
export const skill3dSVG = (key, url) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="sk3d" data-sk="${key}"><image href="${url}" width="64" height="64"/></svg>`;
