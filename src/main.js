import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Barks } from './barks.js';
import { setRealItemLook, defaultLook, realFor, fullLook, buildReal, NPC_SPECS } from './realchar.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Final pass: contrast-adaptive sharpening, color grading and vignette (original shader)
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, sharpen: { value: 0.35 }, vignette: { value: 0.5 }, saturation: { value: 0.82 }, contrast: { value: 1.14 }, grain: { value: 0.045 }, time: { value: 0 }, lift: { value: new THREE.Vector3(0.012, 0.008, 0.0) }, gain: { value: new THREE.Vector3(1.04, 0.99, 0.92) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float sharpen, vignette, saturation, contrast, grain, time; uniform vec3 lift, gain; varying vec2 vUv;
    void main(){
      vec2 px = 1.0 / resolution;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, -px.y)).rgb, s = texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb, w = texture2D(tDiffuse, vUv + vec2(-px.x, 0.0)).rgb;
      vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
      vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0);
      vec3 wgt = -sqrt(amp) * mix(0.0, 0.2, sharpen);
      c = clamp((c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0);
      c = c * gain + lift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      float gn = fract(sin(dot(vUv * resolution + fract(time) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c += (gn - 0.5) * grain * (1.0 - l * 0.6);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};
export { G } from './state.js';
import { setItemLook } from './assets.js';
import { Vortex } from './vortex.js';
import { Pad } from './gamepad.js';
import { Touch } from './touch.js';
import { applyUI } from './uiprefs.js';
import { CLASS_DETAILS } from './details.js';
import { Sky, clockText, daylight } from './daynight.js';
import { petBonus, ensurePets, buildPetModel, PET_SPECIES, newPetRecord, petCoatColor } from './pets.js';
import { lookOf, starterItem, makeGem } from './items.js';
setItemLook(lookOf);
setRealItemLook(lookOf);
import { G, reset, msg, saveGame, loadGame, savedLoc, maxHp, maxMp, itemBonus, tick, addFame, restockShop, MAX_FLOOR, MAX_LEVEL, weaponDamage, socketGem } from './state.js';
import { Level } from './level.js';
import { Player, Pet, Loot } from './entities.js';
import { UI } from './ui.js';
import { generate } from './items.js';
import { flatDist, rand } from './util.js';
import { QUEST_GIVER } from './data.js';
import { loadAll, CharModel } from './assets.js';
import { FX } from './fx.js';
import { Gore } from './gore.js';
import { sfx, playMusic, unlockAudio } from './audio.js';
import { Settings, loadSettings, saveSettings } from './settings.js';
import { CLASSES, SKILLS, PET_COATS, cast, canCast, updateZones, clearZones } from './skills.js';
import { box, sphere, cone } from './util.js';

// The starting outfit matches what was picked at character creation.
const OUTFIT = { Knight: 'plate', Barbarian: 'furs', Mage: 'robe', Rogue: 'leathers' };
const HELM_VIS = { Knight_Helmet: 'Knight_Helmet', Barbarian_Hat: 'Barbarian_Hat', Mage_Hat: 'Mage_Hat' };
export function starterKit(s) {
  const cls = CLASSES[s.cls];
  const gear = cls.gear[s.gear || 0] || cls.gear[0];
  const eq = { weapon: starterItem(gear.weapon[0]), offhand: gear.offhand[0] ? starterItem(gear.offhand[0]) : null, helm: null, armor: null, ring: null, amulet: null };
  const helmVis = s.hooded ? 'Rogue_Head_Hooded' : HELM_VIS[cls.headgear];
  if (helmVis && (s.helm !== false || s.hooded)) eq.helm = starterHelm(helmVis);
  eq.armor = starterOutfit(OUTFIT[s.cls]);
  return eq;
}
function starterHelm(vis) {
  const t = { Knight_Helmet: ['helm', 'Rusted Helm', 4], Barbarian_Hat: ['horned', 'Rusted Horned Helm', 3], Mage_Hat: ['hat', 'Rusted Hat', 1], Rogue_Head_Hooded: ['hood', 'Rusted Hood', 2] }[vis];
  return { base: t[1], name: t[1], type: t[0], mat: 'rusted', slot: 'helm', rarity: 0, ilvl: 1, req: 1, armor: t[2], affixes: {}, sockets: 0, gems: [], value: 6 };
}
function starterOutfit(type) {
  const t = { plate: ['Rusted Plate', 7, {}], furs: ['Rusted Furs', 5, { life: 6 }], robe: ['Rusted Robes', 2, { mana: 6 }], leathers: ['Rusted Leathers', 4, { dex: 1 }] }[type];
  return { base: t[0], name: t[0], type, mat: 'rusted', slot: 'armor', rarity: 0, ilvl: 1, req: 1, armor: t[1], affixes: { ...t[2] }, sockets: 0, gems: [], value: 6 };
}


window.__G = G;
window.__gen = (lvl, type) => generate(lvl, 0, 0, type);
window.__CLASSES = CLASSES;
window.__gem = (g, t) => makeGem(g, t);
window.__Loot = Loot;
window.__dmg = () => weaponDamage();
window.__cast = (id, at, t) => cast(id, at, t);
window.__socket = (i, it) => socketGem(i, it);
const HOTKEYS = { q: 'q', w: 'w', e: 'e', r: 'r' };

// music for each depth band of the Wells
const dungeonTrack = (f) => (f >= 80 ? 'void' : f >= 50 ? 'ember' : f >= 25 ? 'abyss' : f >= 10 ? 'crypt' : 'dungeon');

class Main {
  constructor() {
    G.main = this; this.G = G;
    loadSettings();
    applyUI();
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
    this.gore = new Gore(this.scene);
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
    this.pad = new Pad(this);
    this.touch = new Touch(this);
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
    // autosave every minute while playing, and whenever the window closes or is hidden
    const auto = () => { if (!this.menuMode && !this.creating && G.player && G.hp > 0) saveGame(); };
    setInterval(auto, 60000);
    window.addEventListener('beforeunload', auto);
    document.addEventListener('visibilitychange', () => { if (document.hidden) auto(); });
    this.ui.showMenu();
    this.menuScene();
    playMusic('menu');
  }

  applyQuality() {
    const q = Settings.quality;
    const rs = Settings.renderScale || 1;
    const prMax = q === 'ultra' ? 2 : q === 'high' ? 1.5 : q === 'medium' ? 1.25 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, prMax) * rs);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = q === 'low' || q === 'medium' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    if (!this.envTex) {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    this.scene.environment = q === 'low' ? null : this.envTex;
    this.applyShadowRes();
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
    if (this.composer) { this.composer.dispose(); this.composer = null; this.gtao = null; }
    if (q !== 'low') {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q === 'medium' ? 0 : 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      if (q === 'high' || q === 'ultra') {
        this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
        this.gtao.blendIntensity = q === 'ultra' ? 1.0 : 0.85;
        this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.5, scale: 1.0, samples: q === 'ultra' ? 16 : 10 });
        this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: q === 'ultra' ? 16 : 8 });
        const gt = this.gtao, orig = gt.render.bind(gt);
        gt.render = (...a) => {
          const hide = [...(G.level?.noAO || []), this.fx.points].filter((o) => o && o.visible);
          hide.forEach((o) => (o.visible = false));
          orig(...a);
          hide.forEach((o) => (o.visible = true));
        };
        this.composer.addPass(this.gtao);
      }
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), q === 'medium' ? 0.4 : 0.5, 0.5, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      if (q === 'medium') this.composer.addPass(new SMAAPass(size.x, size.y));
      this.grade = new ShaderPass(GradeShader);
      this.composer.addPass(this.grade);
      this.applyGrit();
    }
    this.resize();
  }
  // 'gritty' (default) is the dark, desaturated, grainy late-90s dungeon look; 'classic' is the brighter storybook grade
  applyGrit() {
    if (!this.grade) return;
    const g = Settings.grit !== 'classic';
    const u = this.grade.uniforms;
    u.saturation.value = g ? 0.82 : 1.08; u.contrast.value = g ? 1.14 : 1.06; u.vignette.value = g ? 0.5 : 0.32; u.grain.value = g ? 0.045 : 0.0;
  }
  applyShadowRes() {
    const L = G.level;
    if (!L || !L.sun) return;
    const q = Settings.quality;
    const n = q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024;
    if (L.sun.shadow.mapSize.x !== n) { L.sun.shadow.mapSize.set(n, n); L.sun.shadow.map?.dispose(); L.sun.shadow.map = null; }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h);
      const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      if (this.grade) { this.grade.uniforms.resolution.value.copy(sz); this.grade.uniforms.sharpen.value = (Settings.sharpen ?? 0.35) + (1 - (Settings.renderScale || 1)) * 0.8; }
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale?.(h * this.renderer.getPixelRatio());
  }

  menuScene() {
    this.clearLevel();
    G.level = new Level(this.scene, 'town', 0);
    this.sky = new Sky(this.scene);
    this.applyShadowRes();
    this.menuMode = true;
  }

  // ---------------- character creation ----------------
  openCreation() {
    this.ui.closeAll();
    if (!G.level || G.level.kind !== 'town') this.menuScene();
    this.menuMode = true;
    this.creating = true;
    this.creation = { cls: 'Knight', cape: CLASSES.Knight.cape, hooded: false, name: '', helm: true, gear: 0, tint: '#ffffff', height: 1, capeOn: true, pet: 'fox', petSpecies: 'fox', petName: 'Pip', tab: 'class', skin: '#ffffff', ...CLASS_DETAILS.Knight, ...defaultLook('Knight', 'm') };
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
    this.preview = new CharModel(cls.model, { scale: s.height });
    this.preview.applyLook(cls, s);
    this.preview.dress(starterKit(s), s, cls);
    if (this.previewPet) this.podium.remove(this.previewPet);
    const psp = PET_SPECIES[s.petSpecies] ? s.petSpecies : 'fox';
    this.previewRig = buildPetModel(psp, 0, petCoatColor(psp, s.pet));
    this.previewPet = new THREE.Group(); this.previewPet.add(this.previewRig.root);
    this.previewPet.position.set(1.15, 0.25, 0.75);
    this.previewPet.rotation.y = -0.5;
    this.podium.add(this.previewPet);
    this.preview.root.position.y = 0.25;
    this.preview.root.rotation.y = 0.35;
    this.podium.add(this.preview.root);
    this.preview.once('Cheer', { timeScale: 1.2 });
    sfx('buff');
    if (Settings.realistic !== false) {
      const kit = starterKit(s), stamp = (this.previewStamp = (this.previewStamp || 0) + 1);
      clearTimeout(this.previewTimer);
      this.previewTimer = setTimeout(() => realFor(fullLook(s, s.cls), s.cls, kit, lookOf, { scale: s.height }).then((rc) => {
        if (!rc || stamp !== this.previewStamp || !this.podium) return;
        this.podium.remove(this.preview.root);
        rc.dress(kit, s, cls);
        rc.root.position.y = 0.25; rc.root.rotation.y = 0.35;
        this.podium.add(rc.root); this.preview = rc;
        rc.once('Cheer', { timeScale: 1 });
      }), 450);
    }
  }
  closeCreation() {
    this.creating = false;
    if (this.podium) { this.scene.remove(this.podium); this.podium = null; this.preview = null; this.previewPet = null; }
    this.ui.hideCreation();
    this.ui.showMenu();
  }

  // ---------------- game flow ----------------
  newGame(s) {
    const cls = CLASSES[s.cls];
    reset();
    G.heroName = (s.name || '').trim().slice(0, 18) || 'Wanderer';
    G.cls = s.cls;
    G.look = { cape: s.cape, hooded: !!s.hooded, helm: s.helm, gear: s.gear, tint: s.tint, height: s.height, capeOn: s.capeOn, pet: s.pet, skin: s.skin, shoulders: s.shoulders, belt: s.belt, back: s.back, metal: s.metal, scarf: s.scarf, ...(s.sex ? { sex: s.sex, weight: s.weight, muscle: s.muscle, hairStyle: s.hairStyle, hairColor: s.hairColor, hairHi: s.hairHi, beard: s.beard, eyes: s.eyes, skinTone: s.skinTone } : {}) };
    G.petName = (s.petName || '').trim().slice(0, 14) || 'Pip';
    G.petSpecies = PET_SPECIES[s.petSpecies] ? s.petSpecies : 'fox';
    G.pets = null; ensurePets();
    if (PET_SPECIES[G.petSpecies].coats.some((c) => c.key === s.pet)) G.pets[G.petSpecies].coat = s.pet;
    G.base = { ...cls.base };
    for (const k in G.skills) G.skills[k] = 0;
    Object.assign(G.skills, cls.skills);
    G.hotbar = { ...cls.hotbar };
    G.equipment = starterKit(s);
    G.hp = maxHp(); G.mp = maxMp();
    restockShop();
    if (this.podium) { this.scene.remove(this.podium); this.podium = null; this.preview = null; this.previewPet = null; }
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
    const loc = savedLoc();
    if (!loadGame()) { this.ui.toast('No save found', true); return; }
    if (G.look && G.look.shoulders === undefined) Object.assign(G.look, CLASS_DETAILS[G.cls] || {}, { skin: G.look.skin || '#ffffff' });
    this.ui.hideMenu();
    this.menuMode = false;
    if (loc && loc.kind === 'dungeon' && loc.floor > 0) this.loadLevel('dungeon', loc.floor, 'resume', loc);
    else if (loc && loc.kind === 'town') { restockShop(); this.loadLevel('town', 0, 'resume', loc); }
    else this.enterTown();
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
    this.gore?.clear();
    clearZones();
    if (G.level) G.level.dispose();
    if (this.sky) { this.sky.dispose(); this.sky = null; }
    G.level = null; G.player = null; G.pet = null;
  }

  loadLevel(kind, floor, arrive = 'down', loc = null) {
    this.ui.closeAll();
    this.clearLevel();
    G.currentFloor = floor;
    const L = new Level(this.scene, kind, floor);
    G.level = L;
    if (kind === 'town') this.sky = new Sky(this.scene);
    this.applyShadowRes();
    const p = new Player();
    let pos = L.startPos.clone();
    if (kind === 'dungeon' && arrive === 'up') pos = L.downPos.clone().add(new THREE.Vector3(1.5, 0, 1.5));
    if (kind === 'town' && arrive === 'portal') { pos = L.portalPos.clone().add(new THREE.Vector3(0, 0, 2)); this.emerge = 0.7; }
    if (arrive === 'resume' && loc && kind === 'town') pos = new THREE.Vector3(loc.x, 0, loc.z); // dungeon floors regenerate, so resume at their entrance
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
      if (floor > G.deepest) {
        G.deepest = floor;
        if (floor > 1 && floor % 5 === 1) addFame(5 * floor);
        if (floor % 10 === 0) msg(`Checkpoint reached! You can now start from Floor ${floor} at the Old Well, even after falling.`, '#ffd84d');
      }
      this.ui.banner(`Floor ${floor}`, floor % 5 === 0 ? 'A guardian stirs in the deep' : 'The Sunken Wells');
      playMusic(dungeonTrack(floor));
      Barks.reset();
      setTimeout(() => Barks.hero(floor % 5 === 0 ? 'boss' : 'down', 0.8, 0), 1500);
    } else { this.ui.banner('Hollowmere', 'A lantern-lit town above the Wells'); playMusic('town'); Barks.reset(); setTimeout(() => Barks.hero('town', 0.5, 0), 1500); }
    sfx('door');
    saveGame();
  }

  enterTown(arrive = 'start') {
    G.hp = Math.max(G.hp, 1);
    restockShop();
    this.loadLevel('town', 0, arrive);
  }

  barkLoot() { Barks.hero('loot', 0.7); }
  onLevelUp() {
    this.ui.banner(`Level ${G.lvl}!`, '+5 attribute points · +1 skill point');
    if (G.player) {
      this.fx.ring(G.player.pos, 0xffd84d, 3, 0.8);
      this.fx.emit(G.player.pos.clone().setY(0.2), { count: 60, color: 0xffd84d, speed: 2, up: 6, life: 1.2, size: 0.35, spread: 0.8 });
      this.fx.flash(G.player.pos.clone().setY(2), 0xffd84d, 30, 0.8);
      G.player.model.once('Cheer', { timeScale: 1.4 });
    }
    sfx('level');
    setTimeout(() => Barks.hero('level', 1, 0), 400);
    this.ui.refresh();
  }
  addFameFromBoss(f) {
    if (f >= MAX_FLOOR) {
      addFame(2500); G.wellsCleared = (G.wellsCleared || 0) + 1;
      this.ui.banner('The Hollow King falls!', 'The Sunken Wells are free. You are a Wellbreaker.');
      msg('The heart of the Wells stops beating. Hollowmere will sing of this for a hundred years.', '#ffd84d');
      sfx('legend');
      return;
    }
    addFame(25 + f * 4); this.ui.banner('Guardian slain!', 'Your fame grows'); sfx('legend');
  }
  magicFind() { return Math.round(itemBonus('magic_find') + (G.buffs.wealth > 0 ? 50 : 0) + (G.skills.fortune || 0) * 8 + petBonus('magic_find')); }
  goldFind() { return Math.round(itemBonus('gold_find') + (G.buffs.wealth > 0 ? 100 : 0) + (G.skills.fortune || 0) * 8 + petBonus('gold_find')); }
  randomTreasure() { return generate(Math.max(G.lvl, G.currentFloor) + 1, 80, 1); }
  flash(t) { this.ui.flash(t); }
  floatText(pos, text, color, size = 20, yOff = 2) {
    if (!Settings.damageNumbers && /^\d+!?$/.test(String(text))) return;
    this.ui.floatText(pos, text, color, size, yOff);
  }
  shake(a) { if (Settings.screenShake) this.shakeAmt = Math.min(0.6, this.shakeAmt + a); }
  sfxGore() { sfx('gib'); }
  onPlayerHurt(d) { if (Settings.gore !== 'off') this.ui.screenBlood(d / maxHp()); }
  hurtFlash(f) { this.ui.hurt(f); if (f > 0.08) this.shake(f * 1.5); if (this.pad?.active) this.pad.rumble(Math.min(1, 0.25 + f * 2), 90 + f * 300); }
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
    Barks.hero('death', 1, 0);
    setTimeout(() => { this.ui.closeAll(); this.ui.death(lost); }, 1400);
  }
  respawn() {
    G.hp = maxHp(); G.mp = maxMp();
    G.portalFloor = 0;
    this.enterTown();
  }

  interact(e) {
    if (e.type === 'loot') { e.pickup(); this.ui.refresh(); return; }
    if (e.type === 'interact' && e.kind !== 'villager') Barks.npc(e);
    switch (e.kind) {
      case 'merchant': this.ui.show('shop'); this.ui.show('inv'); sfx('ui'); break;
      case 'quest': this.ui.show('quest'); sfx('ui'); break;
      case 'blacksmith': this.ui.show('forge'); this.ui.show('inv'); sfx('ui'); break;
      case 'villager': e.talk(); break;
      case 'healer': {
        G.hp = maxHp(); G.mp = maxMp();
        if (G.pet) { G.pet.dead = false; G.pet.hp = G.pet.maxHp; if (G.petAwayTime <= 0) G.pet.root.visible = true; }
        this.fx.ring(G.player.pos, 0x66ff88, 2.2, 0.6);
        this.fx.emit(G.player.pos.clone().setY(0.3), { count: 40, color: 0x88ffaa, speed: 1, up: 4, life: 1, size: 0.3, spread: 0.7 });
        sfx('heal');
        msg('"Go with the light, child." You and your pet are fully healed.', '#b3e6ff');
        const spent = Object.values(G.skills).reduce((a, b) => a + b, 0);
        if (spent > 0 && G.lvl >= 3) {
          const cost = 60 * G.lvl;
          this.ui.choice('Brother Fennick', `"I can also help you forget what you have learned, so you may walk a different path." Unlearn all ${spent} skill points for ${cost} gold?`, [
            [`Unlearn skills (${cost} gold)`, () => {
              if (G.gold < cost) { this.flash('Not enough gold'); return; }
              G.gold -= cost; G.skillPoints += spent;
              for (const k in G.skills) G.skills[k] = 0;
              G.pet?.applyForm(true);
              this.ui.refreshSlotIcons(); this.ui.refresh();
              msg(`Your skills are forgotten. ${spent} skill points returned. Press K to choose again.`, '#ffd84d');
              sfx('level');
            }],
            ['No, thank you', null],
          ]);
        }
        break;
      }
      case 'beastmaster': this.ui.petView = G.petSpecies; this.ui.show('pet'); msg('"Every beast has a heart worth earning. Pick the one that suits you." Companions keep their levels when swapped.', '#ffb066'); break;
      case 'pond': case 'fish_hole': case 'millpond': this.ui.openFishing(e.kind); break;
      case 'well': {
        // Floor 1, plus every checkpoint (10, 20, ...) the hero has reached. Checkpoints are kept forever, even after death.
        const opts = [['Floor 1', () => this.loadLevel('dungeon', 1)]];
        for (let c = 10; c <= Math.min(G.deepest, MAX_FLOOR); c += 10) opts.push([`Checkpoint: Floor ${c}`, () => this.loadLevel('dungeon', c)]);
        opts.push(['Stay in town', null]);
        const next = Math.min(MAX_FLOOR, (Math.floor(G.deepest / 10) + 1) * 10);
        const txt = G.deepest >= 10 ? `Cold air rises from the dark. Deepest floor reached: ${G.deepest} of ${MAX_FLOOR}. Every tenth floor is a checkpoint you can always return to.`
          : `Cold air rises from the dark. Reach Floor ${next} to unlock your first checkpoint.`;
        this.ui.choice('The Old Well', txt, opts, true);
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
    if (this.portalSeq) return;
    G.scrolls--;
    G.portalFloor = G.level.floor;
    sfx('blink');
    // tear open a black-hole vortex in front of the hero and get pulled through it
    const pl = G.player, fwd = new THREE.Vector3(Math.sin(pl.root.rotation.y), 0, Math.cos(pl.root.rotation.y));
    let at = pl.pos.clone().addScaledVector(fwd, 1.8);
    if (!G.level.walkable(at)) at = pl.pos.clone();
    const v = new Vortex({ radius: 1.5 });
    v.root.position.copy(at).setY(1.9);
    G.level.root.add(v.root);
    this.portalSeq = { t: 0, v, from: pl.pos.clone(), at };
    pl.model.once('Spellcast_Summon', { timeScale: 1.2 });
    this.fx.flash?.(at.clone().setY(1.4), 0xb088ff, 25, 0.6);
  }
  // Auto-attack: when idle, fight the nearest foe in range with the basic attack or a chosen skill.
  autoAttack(dt) {
    if (!Settings.autoAttack || !this.canPlay() || this.holding) return;
    const p = G.player, L = G.level;
    if (p.path.length && !p.target) return; // the player is walking somewhere
    this.autoT = (this.autoT || 0) - dt;
    if (this.autoT > 0) return;
    this.autoT = 0.2;
    let best = null, bd = Settings.autoRange || 8;
    for (const e of L.entities) {
      if (e.type !== 'enemy' || e.dead || e.dormant) continue;
      const d = flatDist(e.pos, p.pos);
      if (d < bd && L.lineClear(p.pos, e.pos, 0.2)) { bd = d; best = e; }
    }
    if (!best) return;
    const slot = Settings.autoMode;
    const id = slot && slot !== 'basic' ? G.hotbar[slot] : null;
    if (id && !canCast(id) && p.castLock <= 0) {
      p.face?.(best.pos, 1);
      if (cast(id, best.pos.clone(), best)) { this.ui.pressSlot(slot); this.ui.refresh?.(); return; }
    }
    if (p.target !== best && !(p.target && p.target.type === 'enemy' && !p.target.dead)) p.setTarget(best);
  }
  updatePortalSeq(dt) {
    const s = this.portalSeq, pl = G.player;
    if (!s) return;
    s.t += dt;
    s.v.update(dt, this.camera);
    if (!pl || pl.dead || !G.level) { s.v.dispose(); this.portalSeq = null; return; }
    if (Math.random() < dt * 40) {
      const a = Math.random() * 6.28, r = 2.5 + Math.random();
      const p = s.at.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.3 + Math.random() * 2.2, Math.sin(a) * r));
      const vel = s.at.clone().setY(1.9).sub(p).multiplyScalar(2.2);
      this.fx.emit(p, { count: 1, color: Math.random() < 0.5 ? 0xb088ff : 0xf2e6ff, speed: 0.1, vel, life: 0.5, size: 0.22, gravity: 0, drag: 0 });
    }
    if (s.t > 0.6) {
      const k = Math.min(1, (s.t - 0.6) / 0.9), e = k * k;
      pl.root.position.set(s.from.x + (s.at.x - s.from.x) * e, 1.5 * e, s.from.z + (s.at.z - s.from.z) * e);
      pl.root.scale.setScalar(Math.max(0.05, 1 - 0.95 * e));
      pl.root.rotation.y += dt * (4 + 20 * k);
      if (G.pet && !G.pet.dead) { G.pet.root.position.lerp(s.at, Math.min(1, dt * 3 * k)); G.pet.root.scale.setScalar(Math.max(0.05, 1 - e)); }
    }
    if (s.t >= 1.55) {
      this.portalSeq = null;
      this.enterTown('portal');
      msg(`A portal back to floor ${G.portalFloor} swirls beside the well.`, '#c8a8ff');
    }
  }
  drinkPotion(kind) {
    this.ui.pressSlot(kind);
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
    Barks.hero(kind === 'hp' ? 'potion' : 'mana', 0.35);
  }
  castSlot(slot) {
    const id = G.hotbar[slot];
    if (!id) { this.flash('No skill on this key (press K)'); return; }
    const hv = G.player.hover && G.player.hover.type === 'enemy' ? G.player.hover : null;
    const at = hv ? hv.pos.clone() : this.groundPoint();
    this.castWith(slot, at, hv);
  }
  castWith(slot, at, target) {
    const id = G.hotbar[slot];
    this.ui.pressSlot(slot);
    if (cast(id, at, target && target.type === 'enemy' ? target : null)) this.ui.refresh?.();
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
      else if (k === 'z') this.ui.toggle('zodiac');
      else if (k === 'p') this.ui.toggle('pet');
      else if (k === 'v') { Settings.autoAttack = !Settings.autoAttack; saveSettings(); this.flash(`Auto-attack ${Settings.autoAttack ? 'on' : 'off'}`); }
      else if (e.key === 'Tab') this.bigMap = !this.bigMap;
      else if (e.key === 'F5') { e.preventDefault(); this.ui.saveNow(); }
      if (!this.canPlay() || e.repeat) return;
      if (HOTKEYS[k]) this.castSlot(HOTKEYS[k]);
      else if (k === '1') this.drinkPotion('hp');
      else if (k === '2') this.drinkPotion('mp');
      else if (k === 't') this.usePortal();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; if (e.key === 'Tab') this.bigMap = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.holding = false; });
  }
  canPlay() { return !this.menuMode && G.player && !G.player.dead && !this.ui.anyModal() && !this.portalSeq; }

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
  render() { if (this.grade) this.grade.uniforms.time.value = performance.now() / 1000; if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }

  ambientFx(dt, t) {
    const L = G.level;
    if (!L) return;
    if (L.timeU) L.timeU.value = t;
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
    if (L.lamps && !this.sky) L.lamps.forEach((l, i) => { l.intensity = 7 + Math.sin(t * 5 + i) * 0.5; });
    if (L.waters) L.waters.forEach((w, i) => { w.material.emissiveIntensity = (i ? 0.8 : 0.5) + Math.sin(t * 1.4 + i) * 0.15; });
  }

  frame() {
    const dt = Math.min(this.maxDt || 0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const L = G.level;
    if (!this.ready) { this.renderer.setClearColor(0x000000); this.renderer.render(this.scene, this.camera); return; }
    this.pad.update(dt);
    this.touch.update(dt);
    if (this.menuMode) {
      if (this.creating && this.podium) {
        const p = this.podium.position;
        this.camera.position.set(p.x, 2.6, p.z + 7.4);
        this.camera.lookAt(p.x, 1.05, p.z);
        if (this.preview) { this.preview.update(dt); this.preview.root.rotation.y += dt * 0.25; }
        if (this.previewRig) this.previewRig.anim(performance.now() / 1000, false, dt, 0);
      } else {
        const a = t * 0.05;
        this.camera.position.set(44 + Math.cos(a) * 34, 22, 44 + Math.sin(a) * 34);
        this.camera.lookAt(44, 0, 44);
      }
      if (L) { L.sun.position.set(64, 40, 54); L.sun.target.position.set(44, 0, 44); }
      if (L && this.sky) {
        // the title screen shows a slowly turning evening sky; the creation podium is lit like late afternoon
        const keep = G.timeOfDay;
        this.menuT = ((this.menuT ?? 0.66) + dt / 240) % 1;
        G.timeOfDay = this.creating ? 0.62 : 0.69 + 0.065 * Math.sin(this.menuT * Math.PI * 2);
        this.sky.update(dt, L, this.creating && this.podium ? this.podium.position : new THREE.Vector3(44, 0, 44), this.creating ? null : this.fx, false);
        G.timeOfDay = keep;
      }
      this.ambientFx(dt, t);
      this.fx.update(dt);
      this.gore.update(dt);
      this.render();
      return;
    }
    if (L && G.player) {
      const paused = !!(this.ui.open.pause || this.ui.open.death || this.ui.open.settings);
      if (!paused) {
        tick(dt);
        if (this.holding && this.canPlay()) { this.holdT -= dt; if (this.holdT <= 0) { this.holdT = 0.12; this.click(false); } }
        for (const e of L.entities.slice()) e.update(dt, t);
        this.updatePortalSeq(dt);
        this.autoAttack(dt);
        if (this.emerge > 0) {
          this.emerge -= dt;
          const k = 1 - Math.max(0, this.emerge) / 0.7;
          G.player.root.scale.setScalar(0.1 + 0.9 * (1 - (1 - k) * (1 - k)));
          if (G.pet) G.pet.root.scale.setScalar(0.1 + 0.9 * k);
        }
        updateZones(dt);
        if (!G.player.dead) G.player.hover = this.canPlay() ? this.pick() : null;
        this.fx.update(dt);
        this.gore.update(dt);
        // boss music when a living guardian is close
        if (L.kind === 'dungeon') {
          const boss = L.entities.find((e) => e.type === 'enemy' && e.boss && !e.dead && flatDist(e.pos, G.player.pos) < 16);
          if (!!boss !== this.bossMusic) this.bossMusic = !!boss;
          playMusic(boss ? (boss.data.final ? 'final' : L.floor >= 50 ? 'boss_deep' : 'boss') : dungeonTrack(L.floor));
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
      if (this.sky) this.sky.update(dt, L, this.camFocus, this.fx, !(this.ui.open.pause || this.ui.open.death || this.ui.open.settings));
      if (L.kind === 'town' && !this.menuMode) playMusic(daylight() < 0.25 ? 'town_night' : 'town');
      this.ui.update(dt);
      Barks.update(dt);
      document.body.style.cursor = G.player.hover ? (G.player.hover.type === 'enemy' ? 'crosshair' : 'pointer') : 'default';
    }
    this.render();
  }
}

window.__THREE = THREE; window.__real = { buildReal, NPC_SPECS, fullLook };
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => { window.game = new Main(); });
else window.game = new Main();
