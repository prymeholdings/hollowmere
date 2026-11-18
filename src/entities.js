import * as THREE from 'three';
import { G, msg, maxHp, maxMp, armor, rollDamage, attackSpeed, critChance, stat, itemBonus, petDamage, petMaxHp, addXp, onKill, pickupItem, fireboltDamage, fireboltCost, healAmount, novaDamage } from './state.js';
import { box, sphere, capsule, cyl, cone, humanoid, ring, rand, flatDist, sfx, hex } from './util.js';
import { itemColor } from './items.js';

const tmp = new THREE.Vector3();

class Entity {
  constructor(type) {
    this.type = type;
    this.root = new THREE.Group();
    this.root.userData.entity = this;
    this.dead = false;
    this.pickR = 0.8;
    this.pickH = 0.8;
    this.label = null; // {text, color, y, always}
  }
  get pos() { return this.root.position; }
  face(p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    if (dx * dx + dz * dz > 0.0001) this.root.rotation.y = Math.atan2(dx, dz);
  }
  followPath(path, speed, dt) {
    if (!path.length) return false;
    const p = path[0];
    tmp.set(p.x - this.pos.x, 0, p.z - this.pos.z);
    const step = speed * dt;
    const len = tmp.length();
    if (len <= step) { this.pos.x = p.x; this.pos.z = p.z; path.shift(); }
    else { tmp.multiplyScalar(step / len); this.pos.add(tmp); this.face(p); }
    return true;
  }
}

// ---------------------------------------------------------------- Player
export class Player extends Entity {
  constructor() {
    super('player');
    this.model = humanoid(0x3359b3, 0xf2cca6);
    this.root.add(this.model);
    this.hand = this.model.userData.hand;
    const hair = sphere(0.23, 0x4d2e1a); hair.scale.set(1, 0.6, 1); hair.position.set(0, 1.62, -0.03); this.model.add(hair);
    this.cape = box(0.6, 0.9, 0.06, 0x8c1f1f); this.cape.position.set(0, 1.0, -0.34); this.model.add(this.cape);
    this.light = new THREE.PointLight(0xffd9a6, 22, 16, 1.3);
    this.light.position.set(0, 3.2, 0);
    this.root.add(this.light);
    this.path = [];
    this.target = null;
    this.attackCd = 0;
    this.repath = 0;
    this.walkT = 0;
    this.swingT = 0;
    this.hover = null;
    this.lastHit = null;
    this.refreshVisuals();
  }
  refreshVisuals() {
    if (this.weapon) this.hand.remove(this.weapon);
    if (this.shield) this.model.remove(this.shield);
    if (this.helm) this.model.remove(this.helm);
    this.weapon = this.shield = this.helm = null;
    const w = G.equipment.weapon;
    if (w) {
      const g = new THREE.Group();
      const c = w.rarity ? itemColor(w) : 0xcfcfcf;
      if (w.base.includes('Staff')) { const s = cyl(0.04, 0.05, 1.6, 0x6b4a2a); s.position.y = 0.3; g.add(s); const o = sphere(0.1, c, 2); o.position.y = 1.1; g.add(o); }
      else if (w.base.includes('Axe') || w.base.includes('Warpick')) { const s = cyl(0.04, 0.04, 1.0, 0x6b4a2a); s.position.y = 0.3; g.add(s); const hd = box(0.35, 0.25, 0.06, c); hd.position.set(0.12, 0.7, 0); g.add(hd); }
      else { const blade = box(0.07, 1.0, 0.04, c, w.rarity >= 2 ? 0.6 : 0); blade.position.y = 0.6; g.add(blade); const guard = box(0.3, 0.05, 0.08, 0x8c7333); guard.position.y = 0.1; g.add(guard); }
      g.rotation.x = Math.PI / 2.2;
      this.weapon = g; this.hand.add(g);
    }
    if (G.equipment.offhand) {
      this.shield = cyl(0.35, 0.35, 0.06, itemColor(G.equipment.offhand) === 0xebebeb ? 0x8c6633 : itemColor(G.equipment.offhand));
      this.shield.rotation.z = Math.PI / 2; this.shield.position.set(-0.42, 1.0, 0.1); this.model.add(this.shield);
    }
    if (G.equipment.helm) {
      this.helm = cyl(0.2, 0.26, 0.22, 0x8c8c99); this.helm.position.set(0, 1.68, 0); this.model.add(this.helm);
    }
    const a = G.equipment.armor;
    this.model.children[1].material.color.set(a ? (a.rarity ? itemColor(a) : 0x6b5a45) : 0x3359b3).lerp(new THREE.Color(0x3359b3), 0.45);
  }
  setTarget(t) { this.target = t; this.repath = 0; }
  moveTo(p) { this.target = null; this.path = G.level.findPath(this.pos, p); }
  takeDamage(d, crit = false) {
    if (this.dead) return;
    d = d * 100 / (100 + armor());
    G.hp -= d;
    G.main.floatText(this.pos, Math.round(d), '#ff5555');
    sfx('hurt');
    if (G.hp <= 0) { G.hp = 0; this.dead = true; this.model.rotation.x = -Math.PI / 2; this.model.position.y = 0.3; G.main.onPlayerDeath(); }
  }
  attack(e) {
    this.attackCd = 1 / attackSpeed();
    this.swingT = 0.25;
    let d = rollDamage();
    const crit = Math.random() < critChance();
    if (crit) d *= 2;
    e.takeDamage(d, crit);
    this.lastHit = e;
    const leech = itemBonus('leech');
    if (leech > 0) G.hp = Math.min(maxHp(), G.hp + d * leech / 100);
  }
  castFirebolt(at) {
    if (G.skills.firebolt < 1) return;
    const cost = fireboltCost();
    if (G.mp < cost) { G.main.flash('Not enough mana'); return; }
    G.mp -= cost;
    this.face(at);
    const dir = new THREE.Vector3(at.x - this.pos.x, 0, at.z - this.pos.z).normalize();
    const p = new Projectile(dir, fireboltDamage(), 'enemy', 0xff7a1a);
    p.root.position.copy(this.pos).addScaledVector(dir, 0.6);
    G.level.add(p);
    this.swingT = 0.2;
    sfx('fire');
  }
  castHeal() {
    if (G.skills.heal < 1) { G.main.flash('Learn Mend Wounds first (C)'); return; }
    if (G.mp < 12) { G.main.flash('Not enough mana'); return; }
    G.mp -= 12;
    const a = healAmount();
    G.hp = Math.min(maxHp(), G.hp + a);
    G.main.floatText(this.pos, '+' + Math.round(a), '#66ff66');
    G.main.burst(this.pos, 0x66ff88, 1.5);
    sfx('heal');
  }
  castNova() {
    if (G.skills.nova < 1) { G.main.flash('Learn Frost Nova first (C)'); return; }
    if (G.mp < 18) { G.main.flash('Not enough mana'); return; }
    G.mp -= 18;
    const dmg = novaDamage();
    for (const e of G.level.entities) {
      if (e.type === 'enemy' && !e.dead && flatDist(e.pos, this.pos) < 5.5) { e.takeDamage(dmg, false); e.slowT = 4; }
    }
    G.main.burst(this.pos, 0x99ddff, 5.5);
    sfx('nova');
  }
  update(dt, t) {
    if (this.dead) return;
    this.attackCd -= dt;
    G.hp = Math.min(maxHp(), G.hp + dt * (0.3 + stat('vit') * 0.03));
    G.mp = Math.min(maxMp(), G.mp + dt * (0.8 + stat('mag') * 0.05));
    const tg = this.target;
    if (tg) {
      if (tg.dead || !tg.root.parent) this.target = null;
      else {
        const isEnemy = tg.type === 'enemy';
        const reach = isEnemy ? 1.5 + tg.pickR * 0.5 : tg.pickR + 1.0;
        if (flatDist(tg.pos, this.pos) <= reach) {
          this.path = [];
          this.face(tg.pos);
          if (isEnemy) { if (this.attackCd <= 0) this.attack(tg); }
          else { this.target = null; G.main.interact(tg); }
        } else {
          this.repath -= dt;
          if (this.repath <= 0 || !this.path.length) { this.repath = 0.25; this.path = G.level.findPath(this.pos, tg.pos); }
        }
      }
    }
    const moving = this.followPath(this.path, 6.5 * (G.buffs.speed > 0 ? 1.25 : 1), dt);
    if (moving) { this.walkT += dt * 11; this.model.position.y = Math.abs(Math.sin(this.walkT)) * 0.1; }
    else this.model.position.y *= 0.8;
    if (this.swingT > 0) { this.swingT -= dt; this.hand.rotation.x = -Math.sin((1 - this.swingT / 0.25) * Math.PI) * 1.6; }
    else this.hand.rotation.x = moving ? Math.sin(this.walkT) * 0.4 : 0;
    this.cape.rotation.x = moving ? 0.25 + Math.sin(this.walkT * 0.5) * 0.08 : 0.05;
  }
}

// ---------------------------------------------------------------- Enemy
function buildEnemyModel(shape, color, s) {
  let g;
  switch (shape) {
    case 'blob': {
      g = new THREE.Group();
      const b = sphere(0.55, color); b.scale.set(1, 0.7, 1); b.position.y = 0.4; g.add(b);
      for (const x of [-0.18, 0.18]) { const e = sphere(0.07, 0xffff66, 3); e.position.set(x, 0.6, 0.45); g.add(e); }
      break;
    }
    case 'beast': {
      g = new THREE.Group();
      const b = box(0.55, 0.45, 1.0, color); b.position.y = 0.45; g.add(b);
      const hd = sphere(0.26, color); hd.position.set(0, 0.6, 0.6); g.add(hd);
      for (const x of [-0.1, 0.1]) { const e = sphere(0.05, 0xff3322, 3); e.position.set(x, 0.68, 0.82); g.add(e); }
      for (const [x, z] of [[-0.2, -0.35], [0.2, -0.35], [-0.2, 0.35], [0.2, 0.35]]) { const l = box(0.12, 0.3, 0.12, new THREE.Color(color).multiplyScalar(0.6)); l.position.set(x, 0.15, z); g.add(l); }
      const tail = box(0.06, 0.06, 0.6, color); tail.position.set(0, 0.55, -0.75); tail.rotation.x = 0.4; g.add(tail);
      break;
    }
    case 'wisp': {
      g = new THREE.Group();
      const core = sphere(0.35, color, 2.5); core.position.y = 1.1; core.castShadow = false; g.add(core);
      const halo = sphere(0.55, color, 0.6); halo.material.transparent = true; halo.material.opacity = 0.3; halo.position.y = 1.1; halo.castShadow = false; g.add(halo);
      const tail = cone(0.3, 0.8, color, 1.5); tail.rotation.x = Math.PI; tail.position.y = 0.55; g.add(tail);
      g.userData.float = true;
      break;
    }
    case 'skeleton': {
      g = humanoid(color, new THREE.Color(color).multiplyScalar(1.1).getHex(), 0.95);
      g.children[1].scale.set(0.7, 1, 0.7);
      for (const x of [-0.08, 0.08]) { const e = sphere(0.04, 0xff4422, 4); e.position.set(x, 1.5, 0.19); g.add(e); }
      const sw = box(0.06, 0.8, 0.04, 0x8a8a80); sw.position.y = 0.4; const sg = new THREE.Group(); sg.add(sw); sg.rotation.x = Math.PI / 2.2; g.userData.hand.add(sg);
      break;
    }
    case 'brute':
    default: {
      g = humanoid(color, new THREE.Color(color).multiplyScalar(0.8).getHex(), 1.5);
      g.children[1].scale.set(1.35, 1, 1.2);
      for (const x of [-0.25, 0.25]) { const sp = cone(0.08, 0.35, 0xd9d2b8); sp.position.set(x, 1.95, -0.1); g.add(sp); }
      const club = cyl(0.1, 0.18, 1.2, 0x4d331a); club.position.y = 0.5; const cg = new THREE.Group(); cg.add(club); cg.rotation.x = Math.PI / 2.2; g.userData.hand.add(cg);
      break;
    }
  }
  g.scale.setScalar(s);
  return g;
}

export class Enemy extends Entity {
  constructor(d, floor, elite, boss) {
    super('enemy');
    this.data = d;
    this.name = d.name;
    this.elite = elite;
    this.boss = boss;
    this.floor = floor;
    const hpMul = 1 + 0.42 * (floor - 1), dmgMul = 1 + 0.26 * (floor - 1);
    this.maxHp = d.hp * hpMul * (elite ? 2.6 : 1);
    this.hp = this.maxHp;
    this.dmg = d.dmg * dmgMul * (elite ? 1.4 : 1);
    this.speed = d.speed;
    this.xp = Math.floor(d.xp * (1 + 0.3 * (floor - 1)) * (elite ? 3 : 1));
    this.ranged = !!d.ranged;
    const s = boss ? 2.0 : elite ? 1.25 : 1;
    this.model = buildEnemyModel(d.shape, d.color, s);
    this.root.add(this.model);
    this.pickR = (d.shape === 'brute' ? 0.9 : 0.65) * s;
    this.pickH = (d.shape === 'beast' || d.shape === 'blob' ? 0.5 : 1.0) * s;
    if (elite || boss) {
      ring(this.root, 0.9 * s, boss ? 0xff3322 : 0xffcc33);
      this.label = { text: boss ? d.name : `Champion ${d.name}`, color: boss ? '#ff6644' : '#ffcc33', y: 2.3 * s, always: true };
      if (elite) this.name = d.name;
    }
    this.aggro = false;
    this.atkCd = rand(0.5, 1.5);
    this.repath = 0;
    this.path = [];
    this.slowT = 0;
    this.t = rand(0, 10);
    this.hitT = 0;
    this.swingT = 0;
  }
  displayName() { return this.boss ? this.data.name : this.elite ? `Champion ${this.data.name}` : this.data.name; }
  takeDamage(d, crit = false) {
    if (this.dead) return;
    this.hp -= d;
    this.aggro = true;
    this.hitT = 0.15;
    G.main.floatText(this.pos, Math.round(d) + (crit ? '!' : ''), crit ? '#ffdd33' : '#ffffff', crit ? 30 : 22, this.pickH * 2);
    sfx('hit');
    if (G.player) G.player.lastHit = this;
    if (this.hp <= 0) this.die();
    else for (const o of G.level.entities) if (o.type === 'enemy' && !o.aggro && flatDist(o.pos, this.pos) < 7) o.aggro = true;
  }
  die() {
    this.dead = true;
    sfx('die');
    addXp(this.xp);
    G.main.floatText(this.pos, `+${this.xp} xp`, '#c9a3ff', 18, 1.0);
    onKill(this.data.name, this.boss);
    if (this.boss) { G.main.addFameFromBoss(this.floor); }
    G.level.dropLoot(this.pos.clone(), this.floor, this.elite, this.boss);
    this.deathT = 0.6;
  }
  pickTarget() {
    const pl = G.player;
    const pet = G.pet;
    let tg = pl && !pl.dead ? pl : null;
    if (pet && !pet.dead && pet.root.visible && (!tg || flatDist(pet.pos, this.pos) + 1.5 < flatDist(tg.pos, this.pos))) tg = pet;
    return tg;
  }
  update(dt) {
    this.t += dt;
    if (this.dead) {
      this.deathT -= dt;
      this.model.scale.multiplyScalar(0.9);
      this.model.rotation.z += dt * 4;
      if (this.deathT <= 0) G.level.remove(this);
      return;
    }
    if (this.hitT > 0) { this.hitT -= dt; this.model.position.x = Math.sin(this.t * 80) * 0.05; } else this.model.position.x = 0;
    if (this.model.userData.float) this.model.position.y = Math.sin(this.t * 2.5) * 0.15;
    this.atkCd -= dt; this.slowT -= dt;
    const tg = this.pickTarget();
    if (!tg) return;
    const dist = flatDist(tg.pos, this.pos);
    if (!this.aggro && flatDist(G.player.pos, this.pos) < 9) this.aggro = true;
    if (!this.aggro) { this.model.rotation.y = Math.sin(this.t * 0.5) * 0.5; return; }
    if (dist > 30) { this.aggro = false; return; }
    const range = this.ranged ? 7 : 1.1 + this.pickR * 0.7 + (tg.pickR || 0.5) * 0.4;
    if (dist <= range && (!this.ranged || G.level.lineClear(this.pos, tg.pos, 0.1))) {
      this.path = [];
      this.face(tg.pos);
      if (this.atkCd <= 0) {
        this.atkCd = (this.ranged ? 1.8 : 1.3) * (this.slowT > 0 ? 1.6 : 1) * (this.boss ? 0.8 : 1);
        this.swingT = 0.3;
        if (this.ranged) {
          const dir = new THREE.Vector3(tg.pos.x - this.pos.x, 0, tg.pos.z - this.pos.z).normalize();
          const p = new Projectile(dir, this.dmg, 'ally', this.data.color);
          p.speed = 10;
          p.root.position.copy(this.pos).addScaledVector(dir, 0.6);
          G.level.add(p);
        } else tg.takeDamage(this.dmg * rand(0.8, 1.2));
      }
    } else {
      this.repath -= dt;
      if (this.repath <= 0) { this.repath = 0.4 + Math.random() * 0.3; this.path = G.level.findPath(this.pos, tg.pos); }
      this.followPath(this.path, this.speed * (this.slowT > 0 ? 0.5 : 1), dt);
    }
    // separation
    for (const o of G.level.entities) {
      if (o === this || o.type !== 'enemy' || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz, min = (this.pickR + o.pickR) * 0.9;
      if (d2 > 0.0001 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        const nx = this.pos.x + (dx / d) * push, nz = this.pos.z + (dz / d) * push;
        if (G.level.walkable(tmp.set(nx, 0, nz))) { this.pos.x = nx; this.pos.z = nz; }
      }
    }
    const hand = this.model.userData.hand;
    if (hand) hand.rotation.x = this.swingT > 0 ? -Math.sin((1 - this.swingT / 0.3) * Math.PI) * 1.5 : 0;
    if (this.swingT > 0) this.swingT -= dt;
  }
}

// ---------------------------------------------------------------- Pet
export class Pet extends Entity {
  constructor() {
    super('pet');
    this.path = [];
    this.repath = 0;
    this.atkCd = 0;
    this.target = null;
    this.t = 0;
    this.applyForm(true);
    this.hp = this.maxHp;
    this.root.visible = G.petAwayTime <= 0;
  }
  buildModel() {
    if (this.model) this.root.remove(this.model);
    const g = new THREE.Group();
    const f = G.petForm;
    if (f === 'golem') {
      const b = box(0.9, 1.0, 0.7, 0x80807a); b.position.y = 0.9; g.add(b);
      const hd = box(0.45, 0.4, 0.4, 0x8c8c85); hd.position.set(0, 1.6, 0.1); g.add(hd);
      for (const x of [-0.6, 0.6]) { const a = box(0.3, 0.9, 0.3, 0x737069); a.position.set(x, 0.8, 0); g.add(a); }
      for (const x of [-0.25, 0.25]) { const l = box(0.3, 0.5, 0.3, 0x66635c); l.position.set(x, 0.25, 0); g.add(l); }
      const e = sphere(0.06, 0x66ccff, 4); e.position.set(0, 1.65, 0.31); g.add(e);
    } else if (f === 'wyrm') {
      const b = capsule(0.3, 0.8, 0xcc3319); b.rotation.x = Math.PI / 2; b.position.y = 0.7; g.add(b);
      const hd = sphere(0.28, 0xd9401f); hd.position.set(0, 1.0, 0.65); g.add(hd);
      for (const x of [-1, 1]) { const w = box(0.9, 0.05, 0.5, 0x991a0d); w.position.set(x * 0.55, 0.95, 0); w.rotation.z = x * 0.4; g.add(w); }
      const fire = sphere(0.1, 0xffcc33, 4); fire.position.set(0, 1.0, 0.92); g.add(fire);
    } else if (f === 'stag') {
      const b = box(0.45, 0.5, 1.0, 0xe6f2ff, 0.4); b.position.y = 0.95; g.add(b);
      const hd = box(0.25, 0.3, 0.4, 0xe6f2ff, 0.4); hd.position.set(0, 1.4, 0.55); g.add(hd);
      for (const x of [-0.12, 0.12]) { const an = cone(0.05, 0.6, 0x99ddff, 1.5); an.position.set(x, 1.8, 0.5); an.rotation.z = x * 2; g.add(an); }
      for (const [x, z] of [[-0.15, -0.35], [0.15, -0.35], [-0.15, 0.35], [0.15, 0.35]]) { const l = box(0.1, 0.7, 0.1, 0xccddee); l.position.set(x, 0.35, z); g.add(l); }
    } else {
      // Pip, a small lantern-tailed fox
      const b = box(0.38, 0.32, 0.7, 0xd97326); b.position.y = 0.38; g.add(b);
      const hd = sphere(0.2, 0xe08033); hd.position.set(0, 0.6, 0.38); g.add(hd);
      const snout = box(0.1, 0.1, 0.18, 0xf2e6d9); snout.position.set(0, 0.55, 0.58); g.add(snout);
      for (const x of [-0.1, 0.1]) { const ear = cone(0.07, 0.18, 0xd97326); ear.position.set(x, 0.82, 0.35); g.add(ear); }
      for (const [x, z] of [[-0.12, -0.25], [0.12, -0.25], [-0.12, 0.25], [0.12, 0.25]]) { const l = box(0.08, 0.25, 0.08, 0x592e14); l.position.set(x, 0.12, z); g.add(l); }
      const tail = box(0.12, 0.12, 0.45, 0xd97326); tail.position.set(0, 0.55, -0.5); tail.rotation.x = 0.6; g.add(tail);
      const tip = sphere(0.09, 0xffdd88, 3); tip.position.set(0, 0.72, -0.7); tip.castShadow = false; g.add(tip);
    }
    this.model = g;
    this.root.add(g);
  }
  applyForm(initial = false) {
    const f = G.petForm;
    const prevFrac = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = petMaxHp() * (f === 'golem' ? 2.5 : 1);
    this.hp = this.maxHp * prevFrac;
    this.dmgMul = f === 'golem' ? 1.3 : f === 'wyrm' ? 2.0 : 1;
    this.speed = f === 'stag' ? 9 : 7;
    this.pickR = f === 'golem' ? 0.7 : 0.5;
    this.buildModel();
    if (!initial) G.main.burst(this.pos, 0x99e6ff, 1.5);
  }
  goAway() { this.root.visible = false; this.target = null; }
  comeBack() { this.root.visible = true; if (G.player) this.pos.copy(G.player.pos).add(new THREE.Vector3(1, 0, 1)); }
  takeDamage(d) {
    if (this.dead || !this.root.visible) return;
    d = d * (G.petForm === 'golem' ? 0.6 : 1);
    this.hp -= d;
    G.main.floatText(this.pos, Math.round(d), '#ffaa66', 18, 1.0);
    if (this.hp <= 0) {
      this.dead = true; this.root.visible = false;
      msg(`${G.petName} is badly hurt and flees back to town! (returns when you visit town)`, '#ff9966');
    }
  }
  update(dt) {
    if (this.dead || !this.root.visible || !G.player) return;
    this.t += dt;
    this.atkCd -= dt;
    this.hp = Math.min(this.maxHp, this.hp + dt * this.maxHp * 0.01);
    const pl = G.player;
    if (G.petForm === 'stag' && !pl.dead) G.hp = Math.min(maxHp(), G.hp + dt * maxHp() * 0.012);
    if (flatDist(pl.pos, this.pos) > 20) { this.pos.copy(pl.pos).add(new THREE.Vector3(1, 0, 1)); this.path = []; }
    if (this.target && (this.target.dead || !this.target.root.parent || flatDist(this.target.pos, pl.pos) > 12)) this.target = null;
    if (!this.target) {
      let best = null, bd = 8;
      for (const e of G.level.entities) if (e.type === 'enemy' && !e.dead && e.aggro) { const d = flatDist(e.pos, pl.pos); if (d < bd) { bd = d; best = e; } }
      this.target = best;
    }
    let moving = false;
    if (this.target) {
      const tg = this.target;
      if (flatDist(tg.pos, this.pos) <= 1.2 + tg.pickR * 0.6) {
        this.path = []; this.face(tg.pos);
        if (this.atkCd <= 0) {
          this.atkCd = 0.9;
          tg.takeDamage(petDamage() * this.dmgMul * rand(0.8, 1.2));
          this.model.position.z = 0.25;
        }
      } else {
        this.repath -= dt;
        if (this.repath <= 0 || !this.path.length) { this.repath = 0.3; this.path = G.level.findPath(this.pos, tg.pos); }
        moving = this.followPath(this.path, this.speed, dt);
      }
    } else if (flatDist(pl.pos, this.pos) > 2.8) {
      this.repath -= dt;
      if (this.repath <= 0 || !this.path.length) { this.repath = 0.4; this.path = G.level.findPath(this.pos, pl.pos.clone().add(new THREE.Vector3(1.2, 0, 1.2))); }
      moving = this.followPath(this.path, this.speed, dt);
    } else this.path = [];
    this.model.position.z *= 0.85;
    this.model.position.y = moving ? Math.abs(Math.sin(this.t * 14)) * 0.1 : 0;
  }
}

// ---------------------------------------------------------------- Projectile
export class Projectile extends Entity {
  constructor(dir, dmg, targetType, color) {
    super('proj');
    this.dir = dir; this.dmg = dmg; this.targetType = targetType;
    this.speed = 16; this.life = 1.4;
    const s = sphere(0.22, color, 4); s.castShadow = false; this.root.add(s);
    const l = new THREE.PointLight(color, 6, 5, 1.5); this.root.add(l);
    this.root.children.forEach((c) => (c.position.y = 1.0));
  }
  update(dt) {
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.life -= dt;
    if (this.life <= 0 || !G.level.walkable(this.pos)) { G.level.remove(this); return; }
    const targets = this.targetType === 'enemy' ? G.level.entities.filter((e) => e.type === 'enemy') : [G.player, G.pet];
    for (const n of targets) {
      if (!n || n.dead || !n.root.visible) continue;
      if (flatDist(n.pos, this.pos) < 0.45 + n.pickR * 0.6) { n.takeDamage(this.dmg, false); G.level.remove(this); G.main.burst(this.pos, 0xff9944, 0.8); return; }
    }
  }
}

// ---------------------------------------------------------------- Loot
export class Loot extends Entity {
  constructor(d) {
    super('loot');
    this.gold = d.gold || 0; this.item = d.item || null; this.potion = d.potion || '';
    let c, text;
    if (this.gold) { c = 0xffd940; text = `${this.gold} gold`; this.gem = cyl(0.25, 0.3, 0.15, c, 0.8); }
    else if (this.potion) { c = this.potion === 'hp' ? 0xe62626 : 0x3366ff; text = this.potion === 'hp' ? 'Health Potion' : 'Mana Potion'; this.gem = sphere(0.2, c, 1.2); }
    else {
      c = itemColor(this.item); text = this.item.name;
      this.gem = box(0.35, 0.35, 0.35, c, 0.6 + this.item.rarity * 0.6);
      if (this.item.rarity >= 2) { ring(this.root, 0.6, c); const beam = cyl(0.05, 0.05, 4, c, 2); beam.material.transparent = true; beam.material.opacity = 0.35; beam.position.y = 2; beam.castShadow = false; this.root.add(beam); }
    }
    this.gem.position.y = 0.3;
    this.root.add(this.gem);
    this.pickR = 0.7; this.pickH = 0.3;
    this.label = { text, color: hex(c), y: 0.9, clickable: true };
    this.t = Math.random() * 5;
  }
  update(dt) {
    this.t += dt;
    this.gem.rotation.y += dt * 1.5;
    this.gem.position.y = 0.3 + Math.sin(this.t * 3) * 0.06;
    if (this.gold && G.player && !G.player.dead && flatDist(this.pos, G.player.pos) < 1.4) this.pickup();
  }
  pickup() {
    if (this.dead) return;
    if (this.gold) { G.gold += this.gold; G.main.floatText(this.pos, `+${this.gold}g`, '#ffd940', 18, 0.8); sfx('gold'); }
    else if (this.potion) { if (this.potion === 'hp') G.hpPotions++; else G.mpPotions++; msg(`Picked up a ${this.label.text}`); sfx('pick'); }
    else if (!pickupItem(this.item)) return;
    this.dead = true;
    G.level.remove(this);
  }
}

// ---------------------------------------------------------------- Interact
export class Interact extends Entity {
  constructor(kind, data) {
    super('interact');
    this.kind = kind; this.data = data; this.t = 0; this.bob = null;
    this.pickR = 1.0; this.pickH = 0.9;
    let lc = '#fff6d9', ly = 1.5;
    const add = (o) => { this.root.add(o); return o; };
    switch (kind) {
      case 'merchant': {
        add(humanoid(0x8c3373, 0xf2c79e));
        const stall = add(box(2.6, 0.9, 0.8, 0x664019)); stall.position.set(0, 0.45, 1.0);
        const awning = add(box(2.8, 0.08, 1.4, 0xcc4433)); awning.position.set(0, 2.4, 0.9); awning.rotation.x = 0.2;
        for (const x of [-1.25, 1.25]) { const p = add(cyl(0.05, 0.05, 2.4, 0x4d3319)); p.position.set(x, 1.2, 1.5); }
        for (let i = 0; i < 4; i++) { const g = add(sphere(0.12, [0xff4444, 0x4466ff, 0xffcc33, 0x66dd66][i], 0.5)); g.position.set(-0.8 + i * 0.5, 1.0, 1.0); }
        lc = '#ffd966'; ly = 2.6; break;
      }
      case 'quest': {
        add(humanoid(0x405a4d, 0xd9a680));
        const spear = add(cyl(0.04, 0.04, 2.6, 0x664d33)); spear.position.set(0.45, 1.3, 0.1);
        const tip = add(cone(0.08, 0.3, 0xcccccc)); tip.position.set(0.45, 2.7, 0.1);
        this.bob = add(box(0.12, 0.45, 0.12, 0xffcc22, 2)); this.bob.position.y = 2.6;
        const dot = add(box(0.12, 0.12, 0.12, 0xffcc22, 2)); dot.position.y = 2.2; this.bobDot = dot;
        lc = '#a6ffa6'; ly = 3.1; break;
      }
      case 'healer': {
        add(humanoid(0xe6e6d9, 0xe6b899));
        const cross = add(box(0.1, 0.4, 0.05, 0xff4444, 1)); cross.position.set(0, 1.1, 0.33);
        const cross2 = add(box(0.3, 0.1, 0.05, 0xff4444, 1)); cross2.position.set(0, 1.15, 0.33);
        lc = '#b3e6ff'; ly = 2.4; break;
      }
      case 'pond': case 'fish_hole': {
        this.pickH = 0.1; this.pickR = 1.3;
        if (kind === 'fish_hole') { const pool = add(cyl(1.0, 1.0, 0.06, 0x1f4d80, 0.6)); pool.position.y = 0.03; pool.castShadow = false; }
        const post = add(box(0.1, 1.0, 0.1, 0x59381a)); post.position.set(1.0, 0.5, 0);
        const sign = add(box(0.6, 0.35, 0.05, 0x8c6633)); sign.position.set(1.0, 1.0, 0.05);
        const fish = add(box(0.3, 0.12, 0.06, 0x66b3ff, 1)); fish.position.set(1.0, 1.0, 0.09);
        lc = '#99d9ff'; ly = 1.6; break;
      }
      case 'well': this.pickR = 1.8; this.pickH = 1.0; lc = '#ffb366'; ly = 4.2; break;
      case 'stairs_down': case 'stairs_up': {
        const down = kind === 'stairs_down';
        if (down) { const hole = add(box(2.2, 0.05, 2.2, 0x000000)); hole.position.y = 0.01; }
        for (let i = 0; i < 4; i++) { const s = add(box(1.8, 0.2, 0.5, new THREE.Color(0x807366).multiplyScalar(1 - i * 0.15).getHex())); s.position.set(0, down ? 0.02 : 0.1 + i * 0.2, -0.7 + i * 0.45); }
        ring(this.root, 1.3, down ? 0xffcc4d : 0x80ccff);
        lc = down ? '#ffd480' : '#99d6ff'; break;
      }
      case 'portal': {
        this.bob = add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 12, 32), new THREE.MeshStandardMaterial({ color: 0x6699ff, emissive: 0x6699ff, emissiveIntensity: 2.5 })));
        this.bob.position.y = 1.3;
        const disc = add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({ color: 0x99bbff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
        disc.position.y = 1.3;
        this.disc = disc;
        add(new THREE.PointLight(0x6699ff, 12, 8, 1.5)).position.y = 1.4;
        lc = '#99bbff'; ly = 2.6; break;
      }
      case 'chest': {
        this.pickH = 0.4; this.pickR = 0.8;
        const c = add(box(1.0, 0.6, 0.7, 0x734719)); c.position.y = 0.3;
        this.lid = add(box(1.05, 0.15, 0.75, 0x998033)); this.lid.position.y = 0.65;
        const lock = add(box(0.15, 0.2, 0.05, 0xffd940, 0.5)); lock.position.set(0, 0.5, 0.37);
        this.lockMesh = lock;
        break;
      }
      case 'relic': {
        this.pickH = 0.5;
        this.bob = add(cyl(0.2, 0.25, 0.5, 0xd9a640, 1.5)); this.bob.position.y = 0.5;
        ring(this.root, 0.8, 0xffcc33);
        add(new THREE.PointLight(0xffcc55, 8, 6, 1.5)).position.y = 1;
        lc = '#ffcc4d'; break;
      }
      case 'shrine_power': case 'shrine_speed': case 'shrine_wealth': {
        const col = { shrine_power: 0xff4d33, shrine_speed: 0x4dff80, shrine_wealth: 0xffd933 }[kind];
        const b = add(cyl(0.6, 0.8, 0.5, 0x66666b)); b.position.y = 0.25;
        this.bob = add(sphere(0.35, col, 2.5)); this.bob.position.y = 1.2; this.bob.castShadow = false;
        add(new THREE.PointLight(col, 8, 6, 1.5)).position.y = 1.3;
        this.shrineColor = col;
        lc = hex(col); break;
      }
    }
    this.label = { text: data.name || kind, color: lc, y: ly, always: ['merchant', 'quest', 'healer', 'well', 'portal', 'stairs_down', 'stairs_up'].includes(kind) };
  }
  update(dt) {
    this.t += dt;
    if (this.bob) {
      if (this.kind === 'portal') { this.bob.rotation.z += dt; this.disc.material.opacity = 0.4 + Math.sin(this.t * 3) * 0.15; if (G.main.camera) { this.bob.lookAt(G.main.camera.position); this.disc.lookAt(G.main.camera.position); } }
      else { this.bob.rotation.y += dt; this.bob.position.y += Math.sin(this.t * 3) * 0.004; }
    }
    if (this.bobDot) this.bobDot.visible = this.bob.visible = true;
  }
  openChest() {
    this.dead = true;
    this.label = null;
    this.lockMesh.visible = false;
    this.lid.rotation.x = -1.2; this.lid.position.set(0, 0.85, -0.3);
  }
  consume() {
    this.dead = true;
    this.label = null;
    if (this.bob) this.bob.visible = false;
    if (this.kind === 'relic') G.level.remove(this);
  }
}
