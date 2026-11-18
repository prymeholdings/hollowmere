import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
export { G } from './state.js';
import { G, reset, msg, saveGame, loadGame, maxHp, maxMp, itemBonus, tick, addFame, restockShop } from './state.js';
import { Level } from './level.js';
import { Player, Pet, Loot } from './entities.js';
import { UI } from './ui.js';
import { generate } from './items.js';
import { flatDist, rand } from './util.js';
import { QUEST_GIVER } from './data.js';
import { loadAll, CharModel } from './assets.js';
import { FX } from './fx.js';
import { sfx, playMusic, unlockAudio } from './audio.js';
import { Settings, loadSettings } from './settings.js';
import { CLASSES, SKILLS, cast } from './skills.js';

window.__G = G;
const HOTKEYS = { q: 'q', w: 'w', e: 'e', r: 'r' };

class Main {
  constructor() {
    G.main = this;
    loadSettings();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('view').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 260);
    this.fx = new FX(this.scene);
    this.zoom = 0.82;
    this.keys = {};
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.holding = false;
    this.holdT = 0;
    this.bigMap = false;
    this.shakeAmt = 0;
    this.flameT = 0;
    this.camFocus = new THREE.Vector3(34, 0, 34);
    this.ui = new UI(this);
    this.clock = new THREE.Clock();
    this.applyQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    reset();
    this.renderer.setAnimationLoop(() => this.frame());
    this.boot();
  }

  async boot() {
    await loadAll('assets/', (f) => this.ui.setLoading(f));
    this.ui.setLoading(1);
    this.ui.hideLoading();
    this.ready = true;
    this.ui.showMenu();
    this.menuScene();
    playMusic('menu');
  }

  applyQuality() {
    const q = Settings.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.25 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
    if (q === 'high') {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
      }
    } else if (this.composer) { this.composer.dispose(); this.composer = null; }
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale?.(h * this.renderer.getPixelRatio());
  }

  menuScene() {
    this.clearLevel();
    G.level = new Level(this.scene, 'town', 0);
    this.menuMode = true;
  }

  // ---------------- character creation ----------------
  openCreation() {
    this.ui.closeAll();
    if (!G.level || G.level.kind !== 'town') this.menuScene();
    this.menuMode = true;
    this.creating = true;
    this.creation = { cls: 'Knight', cape: CLASSES.Knight.cape, hooded: false, name: '' };
    const L = G.level;
    const spot = L.startPos.clone();
    this.podium = new THREE.Group();
    this.podium.position.copy(spot);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.25, 40), new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.8, metalness: 0.2 }));
    disc.position.y = 0.12; disc.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 8, 48), new THREE.MeshStandardMaterial({ color: 0xd8b25a, emissive: 0x8a6a20, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.25;
    const key = new THREE.SpotLight(0xffe6c0, 22, 14, 0.6, 0.6, 1.2);
    key.position.set(2.5, 6, 5); key.target.position.set(0, 1, 0);
    this.podium.add(disc, rim, key, key.target);
    this.scene.add(this.podium);
    this.updatePreview();
    this.ui.showCreation(this.creation, () => this.updatePreview(), () => this.newGame(this.creation), () => this.closeCreation());
  }
  updatePreview() {
    const s = this.creation;
    const cls = CLASSES[s.cls];
    if (this.preview) this.podium.remove(this.preview.root);
    const name = s.hooded && cls.alt ? cls.alt : cls.model;
    this.preview = new CharModel(name, { scale: 1 });
    this.preview.setGear(true, true);
    this.preview.setCapeColor(s.cape);
    this.preview.root.position.y = 0.25;
    this.preview.root.rotation.y = 0.35;
    this.podium.add(this.preview.root);
    this.preview.once('Cheer', { timeScale: 1.2 });
    sfx('buff');
  }
  closeCreation() {
    this.creating = false;
    if (this.podium) { this.scene.remove(this.podium); this.podium = null; this.preview = null; }
    this.ui.hideCreation();
    this.ui.showMenu();
  }

  // ---------------- game flow ----------------
  newGame(s) {
    const cls = CLASSES[s.cls];
    reset();
    G.heroName = (s.name || '').trim().slice(0, 18) || 'Wanderer';
    G.cls = s.cls;
    G.look = { cape: s.cape, hooded: !!s.hooded };
    G.base = { ...cls.base };
    for (const k in G.skills) G.skills[k] = 0;
    Object.assign(G.skills, cls.skills);
    G.hotbar = { ...cls.hotbar };
    if (G.equipment.weapon) G.equipment.weapon.name = G.equipment.weapon.base = cls.weapon;
    G.hp = maxHp(); G.mp = maxMp();
    restockShop();
    if (this.podium) { this.scene.remove(this.podium); this.podium = null; this.preview = null; }
    this.creating = false;
    this.ui.hideCreation();
    this.ui.hideMenu();
    this.menuMode = false;
    this.enterTown();
    const first = SKILLS[cls.hotbar.rmb];
    msg(`Welcome to Hollowmere, ${G.heroName} the ${cls.title}. Speak to ${QUEST_GIVER} for work, then descend the Old Well.`, '#f0c674');
    msg(`Left-click to move and attack. Right-click for ${first.name}. Press K to learn new skills.`, '#b8a888');
    saveGame();
  }
  continueGame() {
    if (!loadGame()) { this.flash('No save found'); return; }
    this.ui.hideMenu();
    this.menuMode = false;
    this.enterTown();
    msg(`Welcome back, ${G.heroName}.`, '#f0c674');
  }
  toMenu() {
    this.ui.closeAll();
    this.ui.showMenu();
    this.menuScene();
    playMusic('menu');
  }

  clearLevel() {
    this.ui.clearWorld();
    this.fx.clear();
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
    if (!L.walkable(pos)) pos = L.toWorld(...L.nearestFloor(...L.cellOf(pos)));
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
    this.ui.showHud();
    this.bossMusic = false;
    if (kind === 'dungeon') {
      if (floor > G.deepest) { G.deepest = floor; if (floor > 1 && floor % 5 === 1) addFame(5 * floor); }
      this.ui.banner(`Floor ${floor}`, floor % 5 === 0 ? 'A guardian stirs in the deep' : 'The Sunken Wells');
      playMusic('dungeon');
    } else { this.ui.banner('Hollowmere', 'A lantern-lit town above the Wells'); playMusic('town'); }
    sfx('door');
    saveGame();
  }

  enterTown(arrive = 'start') {
    G.hp = Math.max(G.hp, 1);
    restockShop();
    this.loadLevel('town', 0, arrive);
  }

  onLevelUp() {
    this.ui.banner(`Level ${G.lvl}!`, '+5 attribute points · +1 skill point');
    if (G.player) {
      this.fx.ring(G.player.pos, 0xffd84d, 3, 0.8);
      this.fx.emit(G.player.pos.clone().setY(0.2), { count: 60, color: 0xffd84d, speed: 2, up: 6, life: 1.2, size: 0.35, spread: 0.8 });
      this.fx.flash(G.player.pos.clone().setY(2), 0xffd84d, 30, 0.8);
      G.player.model.once('Cheer', { timeScale: 1.4 });
    }
    sfx('level');
    this.ui.refresh();
  }
  addFameFromBoss(f) { addFame(25 + f * 4); this.ui.banner('Guardian slain!', 'Your fame grows'); sfx('legend'); }
  magicFind() { return Math.round(itemBonus('magic_find') + (G.buffs.wealth > 0 ? 50 : 0)); }
  goldFind() { return Math.round(itemBonus('gold_find') + (G.buffs.wealth > 0 ? 100 : 0)); }
  randomTreasure() { return generate(Math.max(G.lvl, G.currentFloor) + 1, 80, 1); }
  flash(t) { this.ui.flash(t); }
  floatText(pos, text, color, size = 20, yOff = 2) {
    if (!Settings.damageNumbers && /^\d+!?$/.test(String(text))) return;
    this.ui.floatText(pos, text, color, size, yOff);
  }
  shake(a) { if (Settings.screenShake) this.shakeAmt = Math.min(0.6, this.shakeAmt + a); }
  hurtFlash(f) { this.ui.hurt(f); if (f > 0.08) this.shake(f * 1.5); }
  snapCameraSoft() { /* camera lerps on its own; a quick catch-up after a blink */ this.camCatch = 0.25; }

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
    sfx('die');
    setTimeout(() => { this.ui.closeAll(); this.ui.death(lost); }, 1400);
  }
  respawn() {
    G.hp = maxHp(); G.mp = maxMp();
    G.portalFloor = 0;
    this.enterTown();
  }

  interact(e) {
    if (e.type === 'loot') { e.pickup(); this.ui.refresh(); return; }
    switch (e.kind) {
      case 'merchant': this.ui.show('shop'); this.ui.show('inv'); sfx('ui'); break;
      case 'quest': this.ui.show('quest'); sfx('ui'); break;
      case 'healer': {
        G.hp = maxHp(); G.mp = maxMp();
        if (G.pet) { G.pet.dead = false; G.pet.hp = G.pet.maxHp; if (G.petAwayTime <= 0) G.pet.root.visible = true; }
        this.fx.ring(G.player.pos, 0x66ff88, 2.2, 0.6);
        this.fx.emit(G.player.pos.clone().setY(0.3), { count: 40, color: 0x88ffaa, speed: 1, up: 4, life: 1, size: 0.3, spread: 0.7 });
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
        this.fx.emit(e.pos.clone().setY(0.8), { count: 30, color: 0xffd84d, speed: 3, up: 3, life: 0.8, size: 0.25 });
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
        this.fx.ring(G.player.pos, e.shrineColor, 3, 0.7);
        this.fx.emit(G.player.pos.clone().setY(0.3), { count: 50, color: e.shrineColor, speed: 1.5, up: 5, life: 1.1, size: 0.35, spread: 0.8 });
        this.fx.flash(G.player.pos.clone().setY(2), e.shrineColor, 25, 0.6);
        sfx('buff');
        msg({ power: 'Shrine of Power: +50% damage for 60 seconds.', speed: 'Shrine of Swiftness: faster movement and attacks for 60 seconds.', wealth: 'Shrine of Wealth: more gold and magic items for 60 seconds.' }[k], '#ffd84d');
        break;
      }
    }
  }

  usePortal() {
    if (!G.level || G.level.kind === 'town') { this.flash('You are already in town'); return; }
    if (G.scrolls <= 0) { this.flash('No Town Portal scrolls (buy them from the merchant)'); return; }
    G.scrolls--;
    G.portalFloor = G.level.floor;
    sfx('blink');
    this.enterTown('portal');
    msg(`A portal back to floor ${G.portalFloor} waits beside the well.`, '#99bbff');
  }
  drinkPotion(kind) {
    if (!G.player || G.player.dead) return;
    if (kind === 'hp') {
      if (G.hpPotions <= 0) return this.flash('No health potions');
      if (G.hp >= maxHp()) return;
      G.hpPotions--; G.hp = Math.min(maxHp(), G.hp + maxHp() * 0.5);
      this.fx.emit(G.player.pos.clone().setY(0.5), { count: 24, color: 0xff4455, speed: 0.8, up: 3, life: 0.8, size: 0.25, spread: 0.5 });
    } else {
      if (G.mpPotions <= 0) return this.flash('No mana potions');
      G.mpPotions--; G.mp = Math.min(maxMp(), G.mp + maxMp() * 0.6);
      this.fx.emit(G.player.pos.clone().setY(0.5), { count: 24, color: 0x4488ff, speed: 0.8, up: 3, life: 0.8, size: 0.25, spread: 0.5 });
    }
    sfx('heal');
  }
  castSlot(slot) {
    const id = G.hotbar[slot];
    if (!id) { this.flash('No skill on this key (press K)'); return; }
    const hv = G.player.hover && G.player.hover.type === 'enemy' ? G.player.hover : null;
    const at = hv ? hv.pos.clone() : this.groundPoint();
    if (cast(id, at, hv)) this.ui.refresh?.();
  }

  // ---------------- input ----------------
  bindInput() {
    const cv = this.renderer.domElement;
    const gesture = () => { unlockAudio(); };
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('keydown', gesture);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousemove', (e) => { this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); });
    cv.addEventListener('mousedown', (e) => {
      if (!this.canPlay()) return;
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      if (e.button === 0) { this.holding = true; this.holdT = 0.15; this.click(true); }
      else if (e.button === 2) { G.player.hover = this.pick(); this.castSlot('rmb'); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.holding = false; });
    cv.addEventListener('wheel', (e) => { this.zoom = Math.min(1.5, Math.max(0.55, this.zoom + Math.sign(e.deltaY) * 0.08)); });
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (e.key === 'Alt' || e.key === 'Tab') e.preventDefault();
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (this.ui.open.menu || this.ui.open.create) { if (e.key === 'Escape' && this.ui.open.create) this.closeCreation(); return; }
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (this.ui.open.death) return;
        if (this.ui.open.settings && this.menuMode) { this.ui.close('settings'); this.ui.showMenu(); return; }
        if (this.ui.anyPanel()) this.ui.closeAll(); else if (!this.menuMode) this.ui.show('pause');
        return;
      }
      if (this.menuMode) return;
      if (this.ui.open.fish && e.code === 'Space') { e.preventDefault(); this.ui.reel(); return; }
      if (this.ui.open.death || this.ui.open.pause || this.ui.open.settings) return;
      if (k === 'i' || k === 'b') this.ui.toggle('inv');
      else if (k === 'c') this.ui.toggle('char');
      else if (k === 'k') this.ui.toggle('skills');
      else if (k === 'j') this.ui.toggle('quest');
      else if (e.key === 'Tab') this.bigMap = !this.bigMap;
      else if (e.key === 'F5') { e.preventDefault(); if (saveGame()) this.flash('Game saved'); }
      if (!this.canPlay() || e.repeat) return;
      if (HOTKEYS[k]) this.castSlot(HOTKEYS[k]);
      else if (k === '1') this.drinkPotion('hp');
      else if (k === '2') this.drinkPotion('mp');
      else if (k === 't') this.usePortal();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; if (e.key === 'Tab') this.bigMap = false; });
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
  render() { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }

  ambientFx(dt, t) {
    const L = G.level;
    if (!L) return;
    this.flameT -= dt;
    const emitFlames = this.flameT <= 0;
    if (emitFlames) this.flameT = 0.08;
    if (L.torches) L.torches.forEach((tl, i) => { tl.intensity = 15 + Math.sin(t * 11 + i * 3.1) * 2 + Math.sin(t * 23 + i) * 1.4; });
    if (emitFlames && L.flames) {
      for (const f of L.flames) {
        if (G.player && flatDist(f, G.player.pos) > 30) continue;
        this.fx.emit(f, { count: 1, color: 0xff8a2a, speed: 0.15, up: 1.2, life: 0.5, size: 0.28, spread: 0.06, gravity: 0 });
      }
    }
    if (L.lamps) L.lamps.forEach((l, i) => { l.intensity = 7 + Math.sin(t * 5 + i) * 0.5; });
    if (L.water) { L.water.material.emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.15; }
  }

  frame() {
    const dt = Math.min(this.maxDt || 0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const L = G.level;
    if (!this.ready) { this.renderer.setClearColor(0x000000); this.renderer.render(this.scene, this.camera); return; }
    if (this.menuMode) {
      if (this.creating && this.podium) {
        const p = this.podium.position;
        this.camera.position.set(p.x, 2.6, p.z + 7.4);
        this.camera.lookAt(p.x, 1.05, p.z);
        if (this.preview) { this.preview.update(dt); this.preview.root.rotation.y += dt * 0.25; }
      } else {
        const a = t * 0.05;
        this.camera.position.set(34 + Math.cos(a) * 30, 20, 34 + Math.sin(a) * 30);
        this.camera.lookAt(34, 0, 34);
      }
      if (L) { L.sun.position.set(54, 40, 44); L.sun.target.position.set(34, 0, 34); }
      this.ambientFx(dt, t);
      this.fx.update(dt);
      this.render();
      return;
    }
    if (L && G.player) {
      const paused = !!(this.ui.open.pause || this.ui.open.death || this.ui.open.settings);
      if (!paused) {
        tick(dt);
        if (this.holding && this.canPlay()) { this.holdT -= dt; if (this.holdT <= 0) { this.holdT = 0.12; this.click(false); } }
        for (const e of L.entities.slice()) e.update(dt, t);
        if (!G.player.dead) G.player.hover = this.canPlay() ? this.pick() : null;
        this.fx.update(dt);
        // boss music when a living guardian is close
        if (L.kind === 'dungeon') {
          const boss = L.entities.find((e) => e.type === 'enemy' && e.boss && !e.dead && flatDist(e.pos, G.player.pos) < 16);
          if (!!boss !== this.bossMusic) { this.bossMusic = !!boss; playMusic(boss ? 'boss' : 'dungeon'); }
        }
      }
      L.explore(G.player.pos);
      this.ambientFx(dt, t);
      // camera follow
      const k = this.camCatch > 0 ? 1 : Math.min(1, dt * 7);
      this.camCatch = (this.camCatch || 0) - dt;
      this.camFocus.lerp(G.player.pos, k);
      const off = new THREE.Vector3(0, 21, 14).multiplyScalar(this.zoom);
      this.camera.position.copy(this.camFocus).add(off);
      if (this.shakeAmt > 0) {
        this.camera.position.x += rand(-1, 1) * this.shakeAmt;
        this.camera.position.y += rand(-1, 1) * this.shakeAmt * 0.5;
        this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8);
      }
      this.camera.lookAt(this.camFocus.clone().add(new THREE.Vector3(0, 0.8, 0)));
      L.sun.position.copy(this.camFocus).add(new THREE.Vector3(14, 26, 10));
      L.sun.target.position.copy(this.camFocus);
      this.ui.update(dt);
      document.body.style.cursor = G.player.hover ? (G.player.hover.type === 'enemy' ? 'crosshair' : 'pointer') : 'default';
    }
    this.render();
  }
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => { window.game = new Main(); });
else window.game = new Main();
