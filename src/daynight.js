// Day and night cycle for Hollowmere (town only). One full day lasts DAY_SECONDS.
import * as THREE from 'three';
import { G } from './state.js';

export const DAY_SECONDS = 600;
const C = (h) => new THREE.Color(h);
const SKY = [
  // [time, sky/fog, hemisphere sky, hemisphere ground, sun colour]
  [0.0, C(0x070b1c), C(0x2a3a6a), C(0x10141c), C(0x7a90d0)],
  [0.2, C(0x0e1430), C(0x34447a), C(0x141820), C(0x7a90d0)],
  [0.26, C(0xe08a5a), C(0xffb08a), C(0x4a3a30), C(0xffa060)],
  [0.32, C(0xa8c0e0), C(0xd8e4ff), C(0x5a6a40), C(0xffe2b8)],
  [0.68, C(0x9fb8d8), C(0xd8e4ff), C(0x5a6a40), C(0xffe2b8)],
  [0.74, C(0xe07a4a), C(0xffa070), C(0x4a3424), C(0xff8a4a)],
  [0.8, C(0x161a3a), C(0x3a4880), C(0x141820), C(0x7a90d0)],
  [1.0, C(0x070b1c), C(0x2a3a6a), C(0x10141c), C(0x7a90d0)],
];
const tmp = [C(0), C(0), C(0), C(0)];
function sample(t) {
  let i = 0;
  while (i < SKY.length - 2 && t > SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1];
  const k = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
  for (let j = 0; j < 4; j++) tmp[j].copy(a[j + 1]).lerp(b[j + 1], k);
  return tmp;
}
// 0 at night, 1 at full day
export function daylight(t = G.timeOfDay ?? 0.4) {
  const e = Math.sin((t - 0.25) * Math.PI * 2);
  return Math.min(1, Math.max(0, (e + 0.12) / 0.4));
}
export function clockText(t = G.timeOfDay ?? 0.4) {
  const m = Math.floor(t * 24 * 60);
  const hh = Math.floor(m / 60), mm = m % 60;
  const night = daylight(t) < 0.3;
  return `${night ? '☾' : '☀'} ${String(hh).padStart(2, '0')}:${String(mm - (mm % 5)).padStart(2, '0')} · ${t < 0.22 || t > 0.82 ? 'Night' : t < 0.32 ? 'Dawn' : t < 0.7 ? 'Day' : 'Dusk'}`;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    // stars
    const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.9;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      const r = 260;
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * r; pos[i * 3 + 1] = Math.cos(ph) * r; pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
      const w = 0.6 + Math.random() * 0.4, tint = Math.random();
      col[i * 3] = w * (tint < 0.15 ? 0.8 : 1); col[i * 3 + 1] = w * 0.95; col[i * 3 + 2] = w * (tint > 0.85 ? 0.8 : 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    // moon
    const mc = document.createElement('canvas'); mc.width = mc.height = 128;
    const x = mc.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.32, '#f4eed8'); gr.addColorStop(0.36, 'rgba(200,210,255,0.35)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(180,170,150,0.35)'; for (const [a, b, r] of [[54, 56, 7], [72, 70, 5], [62, 76, 4], [70, 52, 3]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    this.moon.scale.setScalar(46);
    this.group = new THREE.Group();
    this.group.add(this.stars, this.moon);
    scene.add(this.group);
    this.firefly = 0;
  }
  dispose() { this.scene.remove(this.group); this.stars.geometry.dispose(); }
  // apply lighting for the current time; focus = where the camera looks
  update(dt, L, focus, fx, playing) {
    if (playing) G.timeOfDay = ((G.timeOfDay ?? 0.4) + dt / DAY_SECONDS) % 1;
    const t = G.timeOfDay ?? 0.4;
    const d = daylight(t);
    const [sky, hs, hg, sc] = sample(t);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    L.ambient.color.copy(hs); L.ambient.groundColor.copy(hg);
    L.ambient.intensity = 0.55 + 0.85 * d;
    // sun by day, moon by night (same shadow-casting light)
    const ang = (t - 0.25) * Math.PI * 2;
    const sunUp = Math.sin(ang) > -0.05;
    const dir = sunUp ? new THREE.Vector3(Math.cos(ang) * 22, Math.max(8, Math.sin(ang) * 30), 10) : new THREE.Vector3(-Math.cos(ang) * 18, Math.max(10, -Math.sin(ang) * 26), 12);
    L.sun.color.copy(sc);
    L.sun.intensity = sunUp ? 0.5 + 2.1 * d : 0.55;
    L.sun.position.copy(focus).add(dir);
    L.sun.target.position.copy(focus);
    this.scene.environmentIntensity = 0.1 + 0.2 * d;
    // stars + moon follow the camera so they always surround the view
    this.group.position.set(focus.x, 0, focus.z);
    this.stars.material.opacity = Math.max(0, 1 - d * 1.6);
    this.stars.rotation.y = t * Math.PI * 2 * 0.25;
    this.moon.material.opacity = Math.max(0, 1 - d * 1.4);
    this.moon.position.set(-Math.cos(ang) * 150, 60 + Math.max(0, -Math.sin(ang)) * 110, -120);
    // lamps glow at night
    const night = 1 - d;
    if (L.lamps) L.lamps.forEach((l, i) => { l.intensity = (1.5 + night * 9) + Math.sin(performance.now() / 200 + i) * 0.5 * night; });
    if (L.lampBulbs) for (const b of L.lampBulbs) b.material.emissiveIntensity = 0.4 + night * 3;
    if (L.windowGlow) L.windowGlow.material.opacity = night * 0.9;
    // fireflies drift over the grass at night
    if (night > 0.5 && fx) {
      this.firefly += dt * 18 * night;
      while (this.firefly > 1) {
        this.firefly--;
        const p = focus.clone().add(new THREE.Vector3((Math.random() - 0.5) * 34, 0.4 + Math.random() * 1.6, (Math.random() - 0.5) * 26));
        fx.emit(p, { count: 1, color: Math.random() < 0.7 ? 0xd8ff6a : 0xffe08a, speed: 0.25, up: 0.2, life: 2.2, size: 0.28, drag: 0.5 });
      }
    }
    return d;
  }
}
