// Atmosphere: drifting dust motes in the Wells, pollen by day and fireflies by night in town, and a slow
// layer of ground mist in the dungeon. Everything follows the camera focus, so it costs the same anywhere.
import * as THREE from 'three';
import { Settings } from './settings.js';

const N = 320, BOX = 26, HGT = 5;
function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mistTex() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, s, s);
  // soft blobs drawn with wrap-around so the texture tiles without seams
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = 18 + Math.random() * 60, a = 0.05 + Math.random() * 0.12;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Atmos {
  hide() { this.points.visible = false; this.mist.visible = false; }
  constructor(scene) {
    this.scene = scene;
    const pos = new Float32Array(N * 3);
    this.base = new Float32Array(N * 3);
    this.ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.base[i * 3] = (Math.random() - 0.5) * BOX; this.base[i * 3 + 1] = 0.2 + Math.random() * HGT; this.base[i * 3 + 2] = (Math.random() - 0.5) * BOX;
      this.ph[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({ map: dotTex(), size: 0.07, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, color: 0xcbb89a });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 8;
    scene.add(this.points);
    this.mistMat = new THREE.MeshBasicMaterial({ map: mistTex(), transparent: true, depthWrite: false, opacity: 0.22, color: 0x6a7488 });
    this.mist = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), this.mistMat);
    this.mist.rotation.x = -Math.PI / 2; this.mist.renderOrder = 7; this.mist.visible = false;
    scene.add(this.mist);
    this.kind = 'town'; this.t = 0; this.points.visible = false;
  }
  setLevel(kind) {
    this.kind = kind; this.points.visible = true;
    this.mist.visible = kind === 'dungeon' && Settings.quality !== 'low';
  }
  update(dt, focus, day = 1) {
    this.t += dt;
    const t = this.t, P = this.points.geometry.attributes.position.array, B = this.base;
    const town = this.kind === 'town', night = town && day < 0.3;
    // motes in the Wells, golden pollen by day, blinking green fireflies at night
    if (!town) { this.mat.color.setHex(0xcbb89a); this.mat.size = 0.06; this.mat.opacity = 0.42; }
    else if (night) { this.mat.color.setHex(0xd8ff70); this.mat.size = 0.13; this.mat.opacity = 0.55 + Math.sin(t * 2.3) * 0.3; }
    else { this.mat.color.setHex(0xfff0c0); this.mat.size = 0.05; this.mat.opacity = 0.3; }
    const sp = night ? 0.6 : 0.25, h = BOX / 2;
    for (let i = 0; i < N; i++) {
      const p = this.ph[i];
      let x = B[i * 3] + Math.sin(t * 0.13 * (1 + (i % 5) * 0.1) + p) * 2 * sp - focus.x;
      let z = B[i * 3 + 2] + Math.cos(t * 0.11 * (1 + (i % 7) * 0.08) + p) * 2 * sp - focus.z;
      x = ((x % BOX) + BOX * 1.5) % BOX - h; z = ((z % BOX) + BOX * 1.5) % BOX - h;   // wrap around the camera
      P[i * 3] = focus.x + x; P[i * 3 + 1] = (night ? 0.3 + (B[i * 3 + 1] % 2.2) : B[i * 3 + 1]) + Math.sin(t * 0.7 + p) * 0.25; P[i * 3 + 2] = focus.z + z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    if (this.mist.visible) {
      this.mist.position.set(Math.round(focus.x / 10) * 10, 0.18 + Math.sin(t * 0.3) * 0.03, Math.round(focus.z / 10) * 10);
      this.mistMat.map.offset.set(t * 0.006, t * 0.004);
    }
  }
}
