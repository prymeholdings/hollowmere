import * as THREE from 'three';
export { G } from './state.js';
import { G, reset, msg, saveGame, loadGame, maxHp, maxMp, itemBonus, tick, addFame, restockShop } from './state.js';
import { Level } from './level.js';
import { Player, Pet, Loot } from './entities.js';
import { UI } from './ui.js';
import { generate } from './items.js';
import { sfx, randi, flatDist } from './util.js';
import { QUEST_GIVER } from './data.js';

window.__G = G;
class Main {
  constructor() {
    G.main = this;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.getElementById('view').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200);
    this.zoom = 1;
    this.keys = {};
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.holding = false;
    this.holdT = 0;
    this.bigMap = false;
    this.effects = [];
    this.ui = new UI(this);
    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    reset();
    this.ui.showMenu();
    this.menuScene();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  menuScene() {
    this.clearLevel();
    G.level = new Level(this.scene, 'town', 0);
    this.menuMode = true;
  }

  // ---------------- game flow ----------------
  newGame(name) {
    reset();
    G.heroName = name.slice(0, 18);
    restockShop();
    this.ui.hideMenu();
    this.menuMode = false;
    this.enterTown();
    msg(`Welcome to Hollowmere, ${G.heroName}. Speak to ${QUEST_GIVER} for work, then descend the Old Well.`, '#f0c674');
    msg('Left-click to move and attack. Right-click to cast Firebolt.', '#b8a888');
    saveGame();
  }
  continueGame() {
    if (!loadGame()) { this.ui.flash('No save found'); return; }
    this.ui.hideMenu();
    this.menuMode = false;
    this.enterTown();
    msg(`Welcome back, ${G.heroName}.`, '#f0c674');
  }
  toMenu() {
    this.ui.closeAll();
    this.ui.showMenu();
    this.menuScene();
  }

  clearLevel() {
    this.ui.clearWorld();
    for (const fx of this.effects) this.scene.remove(fx.mesh);
    this.effects = [];
    if (G.level) G.level.dispose();
    G.level = null; G.player = null; G.pet = null;
  }

  loadLevel(kind, floor, arrive = 'down') {
    this.ui.closeAll();
    this.clearLevel();
    G.currentFloor = floor;
    const L = new Level(this.scene, kind, floor);
    G.level = L;
    const p = new Player();
    let pos = L.startPos.clone();
    if (kind === 'dungeon' && arrive === 'up') pos = L.downPos.clone().add(new THREE.Vector3(1.5, 0, 1.5));
    if (kind === 'town' && arrive === 'portal') pos = L.portalPos.clone().add(new THREE.Vector3(0, 0, 2));
    const fixed = L.nearestFloor(...L.cellOf(pos));
    if (!L.walkable(pos)) pos = L.toWorld(...fixed);
    p.root.position.copy(pos);
    L.add(p);
    G.player = p;
    const pet = new Pet();
    pet.root.position.copy(pos).add(new THREE.Vector3(1.2, 0, 1.2));
    if (!L.walkable(pet.root.position)) pet.root.position.copy(pos);
    L.add(pet);
    G.pet = pet;
    if (G.petAwayTime > 0) pet.goAway();
    this.snapCamera();
    if (kind === 'dungeon') {
      if (floor > G.deepest) { G.deepest = floor; if (floor > 1 && floor % 5 === 1) addFame(5 * floor); }
      this.ui.banner(`Floor ${floor}${floor % 5 === 0 ? ' · A guardian stirs' : ''}`);
    } else this.ui.banner('Hollowmere');
    saveGame();
  }

  enterTown(arrive = 'start') {
    G.hp = Math.max(G.hp, 1);
    restockShop();
    this.loadLevel('town', 0, arrive);
  }

  onLevelUp() { this.ui.banner(`Level ${G.lvl}!`); G.player && this.burst(G.player.pos, 0xffd84d, 2.5); this.ui.refresh(); }
  addFameFromBoss(f) { addFame(25 + f * 4); this.ui.banner('Guardian slain!'); }
  magicFind() { return Math.round(itemBonus('magic_find') + (G.buffs.wealth > 0 ? 50 : 0)); }
  goldFind() { return Math.round(itemBonus('gold_find') + (G.buffs.wealth > 0 ? 100 : 0)); }
  randomTreasure() { return generate(Math.max(G.lvl, G.currentFloor) + 1, 80, 1); }
  flash(t) { this.ui.flash(t); }
  floatText(pos, text, color, size = 20, yOff = 2) { this.ui.floatText(pos, text, color, size, yOff); }

  dropItem(it) {
    if (!G.level || !G.player) return;
    const l = new Loot({ item: it });
    l.root.position.copy(G.player.pos).add(new THREE.Vector3(0.8, 0, 0.8));
    if (!G.level.walkable(l.root.position)) l.root.position.copy(G.player.pos);
    G.level.add(l);
  }

  onPlayerDeath() {
    const lost = Math.floor(G.gold * 0.1);
    G.gold -= lost;
    this.holding = false;
    this.ui.closeAll();
    this.ui.death(lost);
  }
  respawn() {
    G.hp = maxHp(); G.mp = maxMp();
    G.portalFloor = 0;
    this.enterTown();
  }

  interact(e) {
    if (e.type === 'loot') { e.pickup(); this.ui.refresh(); return; }
    switch (e.kind) {
      case 'merchant': this.ui.show('shop'); this.ui.show('inv'); break;
      case 'quest': this.ui.show('quest'); break;
      case 'healer': {
        G.hp = maxHp(); G.mp = maxMp();
        if (G.pet) { G.pet.dead = false; G.pet.hp = G.pet.maxHp; if (G.petAwayTime <= 0) G.pet.root.visible = true; }
        this.burst(G.player.pos, 0x66ff88, 2);
        sfx('heal');
        msg('"Go with the light, child." You and your pet are fully healed.', '#b3e6ff');
        break;
      }
      case 'pond': case 'fish_hole': this.ui.openFishing(); break;
      case 'well': {
        const opts = [['Floor 1', () => this.loadLevel('dungeon', 1)]];
        if (G.deepest > 1) opts.push([`Floor ${G.deepest} (deepest reached)`, () => this.loadLevel('dungeon', G.deepest)]);
        opts.push(['Stay in town', null]);
        this.ui.choice('The Old Well', 'Cold air rises from the dark. Where will you descend?', opts);
        break;
      }
      case 'portal':
        if (G.level.kind === 'town') { const f = G.portalFloor; G.portalFloor = 0; this.loadLevel('dungeon', f); }
        break;
      case 'stairs_down': this.loadLevel('dungeon', G.level.floor + 1, 'down'); break;
      case 'stairs_up':
        if (G.level.floor <= 1) this.enterTown(); else this.loadLevel('dungeon', G.level.floor - 1, 'up');
        break;
      case 'chest': {
        e.openChest();
        sfx('gold');
        G.level.dropLoot(e.pos.clone(), G.level.floor + 1, Math.random() < 0.3, false);
        break;
      }
      case 'relic': {
        e.consume();
        if (G.quest && G.quest.type === 'relic') { G.quest.done = true; G.quest.progress = 1; msg(`You found the Brass Lantern! Return to ${QUEST_GIVER}.`, '#99ff99'); sfx('level'); }
        break;
      }
      case 'shrine_power': case 'shrine_speed': case 'shrine_wealth': {
        const k = e.kind.split('_')[1];
        G.buffs[k] = 60;
        e.consume();
        this.burst(G.player.pos, e.shrineColor, 3);
        sfx('heal');
        msg({ power: 'Shrine of Power: +50% damage for 60 seconds.', speed: 'Shrine of Swiftness: faster movement and attacks for 60 seconds.', wealth: 'Shrine of Wealth: more gold and magic items for 60 seconds.' }[k], '#ffd84d');
        break;
      }
    }
  }

  usePortal() {
    if (!G.level || G.level.kind === 'town') { this.flash('You are already in town'); return; }
    if (G.scrolls <= 0) { this.flash('No Town Portal scrolls (buy them from Odessa)'); return; }
    G.scrolls--;
    G.portalFloor = G.level.floor;
    sfx('nova');
    this.enterTown('portal');
    msg(`A portal back to floor ${G.portalFloor} waits beside the well.`, '#99bbff');
  }
  drinkPotion(kind) {
    if (kind === 'hp') {
      if (G.hpPotions <= 0) return this.flash('No health potions');
      if (G.hp >= maxHp()) return;
      G.hpPotions--; G.hp = Math.min(maxHp(), G.hp + maxHp() * 0.5); sfx('heal');
    } else {
      if (G.mpPotions <= 0) return this.flash('No mana potions');
      G.mpPotions--; G.mp = Math.min(maxMp(), G.mp + maxMp() * 0.6); sfx('heal');
    }
  }

  // ---------------- effects ----------------
  burst(pos, color, radius) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.4, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos).setY(0.15);
    this.scene.add(mesh);
    this.effects.push({ mesh, t: 0, dur: 0.45, radius });
  }

  // ---------------- input ----------------
  bindInput() {
    const cv = this.renderer.domElement;
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousemove', (e) => { this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); });
    cv.addEventListener('mousedown', (e) => {
      if (!this.canPlay()) return;
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      if (e.button === 0) { this.holding = true; this.holdT = 0.15; this.click(true); }
      else if (e.button === 2) G.player.castFirebolt(this.groundPoint());
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.holding = false; });
    cv.addEventListener('wheel', (e) => { this.zoom = Math.min(1.5, Math.max(0.55, this.zoom + Math.sign(e.deltaY) * 0.08)); });
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (e.key === 'Alt' || e.key === 'Tab') e.preventDefault();
      if (e.target.tagName === 'INPUT') { if (e.key === 'Enter' && this.ui.open.menu) this.newGame(e.target.value.trim() || 'Wanderer'); return; }
      if (this.ui.open.menu) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (this.ui.open.death) return;
        if (this.ui.anyPanel()) this.ui.closeAll(); else this.ui.show('pause');
        return;
      }
      if (this.ui.open.fish && e.code === 'Space') { e.preventDefault(); this.ui.reel(); return; }
      if (this.ui.open.death || this.ui.open.pause) return;
      if (k === 'i' || k === 'b') this.ui.toggle('inv');
      else if (k === 'c' || k === 's') this.ui.toggle('char');
      else if (k === 'j') this.ui.toggle('quest');
      else if (e.key === 'Tab') this.bigMap = !this.bigMap;
      else if (e.key === 'F5') { e.preventDefault(); if (saveGame()) this.flash('Game saved'); }
      if (!this.canPlay()) return;
      if (k === 'q') G.player.castHeal();
      else if (k === 'e') G.player.castNova();
      else if (k === 'w') G.player.castFirebolt(this.groundPoint());
      else if (k === '1') this.drinkPotion('hp');
      else if (k === '2') this.drinkPotion('mp');
      else if (k === 't') this.usePortal();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.holding = false; });
  }
  canPlay() { return !this.menuMode && G.player && !G.player.dead && !this.ui.anyModal(); }

  groundPoint() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const r = this.raycaster.ray;
    if (Math.abs(r.direction.y) < 1e-4) return G.player.pos.clone();
    const t = -r.origin.y / r.direction.y;
    return r.origin.clone().addScaledVector(r.direction, t);
  }
  pick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ray = this.raycaster.ray;
    let best = null, bestT = Infinity;
    const c = new THREE.Vector3();
    for (const e of G.level.entities) {
      if (e.dead || !(e.type === 'enemy' || e.type === 'loot' || e.type === 'interact') || !e.root.visible) continue;
      c.copy(e.pos).setY(e.pickH);
      const v = c.clone().sub(ray.origin);
      const t = v.dot(ray.direction);
      const d = v.sub(ray.direction.clone().multiplyScalar(t)).length();
      const r = e.pickR * (e.type === 'enemy' ? 1.15 : 1);
      if (d < r && t < bestT) { best = e; bestT = t; }
    }
    return best;
  }
  click(fresh) {
    const p = G.player;
    const e = this.pick();
    if (e) { if (fresh || e.type === 'enemy') p.setTarget(e); return; }
    if (!fresh && p.target && p.target.type === 'enemy' && !p.target.dead) return;
    p.moveTo(this.groundPoint());
  }

  // ---------------- loop ----------------
  snapCamera() { this.camFocus = G.player ? G.player.pos.clone() : new THREE.Vector3(34, 0, 34); }
  frame() {
    const dt = Math.min(this.maxDt || 0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const L = G.level;
    if (this.menuMode) {
      const a = t * 0.08;
      this.camera.position.set(34 + Math.cos(a) * 34, 22, 34 + Math.sin(a) * 34);
      this.camera.lookAt(34, 0, 34);
      if (L) { L.sun.position.set(54, 40, 44); L.sun.target.position.set(34, 0, 34); }
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (L && G.player) {
      const paused = !!(this.ui.open.pause || this.ui.open.death);
      if (!paused) {
        tick(dt);
        if (this.holding && this.canPlay()) { this.holdT -= dt; if (this.holdT <= 0) { this.holdT = 0.12; this.click(false); } }
        for (const e of L.entities.slice()) e.update(dt, t);
        if (G.player.dead === false) G.player.hover = this.canPlay() ? this.pick() : null;
      }
      L.explore(G.player.pos);
      // camera follow
      this.camFocus.lerp(G.player.pos, Math.min(1, dt * 8));
      const off = new THREE.Vector3(0, 22, 15).multiplyScalar(this.zoom);
      this.camera.position.copy(this.camFocus).add(off);
      this.camera.lookAt(this.camFocus.clone().add(new THREE.Vector3(0, 0.8, 0)));
      L.sun.position.copy(this.camFocus).add(new THREE.Vector3(14, 26, 10));
      L.sun.target.position.copy(this.camFocus);
      if (L.torches) for (const tl of L.torches) tl.intensity = 16 + Math.sin(t * 13 + tl.position.x) * 2.5;
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const fx = this.effects[i];
        fx.t += dt;
        const k = fx.t / fx.dur;
        fx.mesh.scale.setScalar(1 + k * fx.radius * 2.5);
        fx.mesh.material.opacity = 0.9 * (1 - k);
        if (k >= 1) { this.scene.remove(fx.mesh); fx.mesh.geometry.dispose(); fx.mesh.material.dispose(); this.effects.splice(i, 1); }
      }
      this.ui.update(dt);
      document.body.style.cursor = G.player.hover ? (G.player.hover.type === 'enemy' ? 'crosshair' : 'pointer') : 'default';
    }
    this.renderer.render(this.scene, this.camera);
  }
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => { window.game = new Main(); });
else window.game = new Main();
