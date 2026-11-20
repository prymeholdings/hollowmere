// A small 3D view of the hero, wearing what is equipped, shown in the inventory. Drag to turn it.
// Uses its own little renderer on a canvas that is moved into the inventory panel each time it redraws.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { G } from './state.js';
import { CharModel } from './assets.js';
import { CLASSES } from './skills.js';
import { realFor, fullLook } from './realchar.js';
import { lookOf } from './items.js';
import { Settings } from './settings.js';

export class HeroView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'heroview';
    this.wrap = document.createElement('div');
    this.wrap.className = 'heroview-wrap';
    this.wrap.appendChild(this.canvas);
    const hint = document.createElement('div'); hint.className = 'hv-hint'; hint.textContent = 'drag to turn';
    this.wrap.appendChild(hint);
    this.yaw = 0.5; this.spin = 0; this.sig = ''; this.renderer = null;
    let lastX = null;
    const down = (x) => { lastX = x; this.spin = 0; this.held = true; };
    const move = (x) => { if (lastX === null) return; const d = (x - lastX) * 0.012; this.yaw += d; this.spin = d * 30; lastX = x; };
    const up = () => { lastX = null; this.held = false; };
    this.canvas.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.canvas.setPointerCapture?.(e.pointerId); down(e.clientX); });
    this.canvas.addEventListener('pointermove', (e) => move(e.clientX));
    this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }
  init() {
    if (this.renderer) return true;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (e) { this.failed = true; return false; }
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.scene.add(new THREE.HemisphereLight(0xfff0dd, 0x302018, 1.6));
    const key = new THREE.DirectionalLight(0xffe2b8, 2.6); key.position.set(2, 4, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-3, 2, -3); this.scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 0.8, metalness: 0.2 }));
    disc.position.y = -0.04; this.scene.add(disc);
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.5;
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
    return true;
  }
  // put the view into a panel element
  mount(parent) { parent.appendChild(this.wrap); }
  signature() {
    const e = G.equipment || {};
    return [G.cls, JSON.stringify(G.look || {}), Settings.realistic, ...['weapon', 'offhand', 'helm', 'armor', 'ring', 'amulet', 'shoulders', 'gloves', 'shirt', 'belt', 'pants', 'boots'].map((k) => (e[k] ? (e[k].name || '') + (e[k].mat || '') + (e[k].dye || '') + (e[k].rarity || 0) : '-'))].join('|');
  }
  rebuild() {
    const cls = CLASSES[G.cls] || CLASSES.Knight;
    if (this.model) this.pivot.remove(this.model.root);
    this.model = new CharModel(cls.model, { scale: 0.72 * (G.look?.height || 1) });
    this.model.applyLook(cls, G.look || {});
    this.model.dress(G.equipment, G.look || {}, cls);
    this.pivot.add(this.model.root);
    if (Settings.realistic !== false) {
      const sig = this.sig, stand = this.model;
      stand.root.visible = false;
      realFor(fullLook(G.look, G.cls), G.cls, G.equipment, lookOf, { priority: 8 }).then((rc) => {
        if (!rc) { stand.root.visible = true; return; }
        if (this.sig !== sig) return;
        this.pivot.remove(this.model.root);
        rc.dress(G.equipment, G.look || {}, cls);
        this.model = rc; this.pivot.add(rc.root);
        rc.play('Idle', 0);
      });
    }
    const box = new THREE.Box3().setFromObject(this.model.root);
    const h = Math.max(1, box.max.y - box.min.y);
    this.camera.position.set(0, h * 0.55, h * 3.0);
    this.camera.lookAt(0, h * 0.48, 0);
  }
  update(dt, visible) {
    if (!visible || !this.wrap.isConnected || this.failed) return;
    if (!this.init()) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    const sig = this.signature();
    if (sig !== this.sig) { this.sig = sig; this.rebuild(); }
    if (!this.held) { this.yaw += this.spin * dt; this.spin *= Math.pow(0.04, dt); if (Math.abs(this.spin) < 0.05) this.yaw += dt * 0.35; }
    this.pivot.rotation.y = this.yaw;
    this.model?.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
