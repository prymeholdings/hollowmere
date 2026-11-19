import * as THREE from 'three';
import { G, msg, maxHp, maxMp, armor, rollDamage, attackSpeed, critChance, critMult, stat, itemBonus, elementalDamage, petDamage, petMaxHp, addXp, onKill, pickupItem } from './state.js';
import { box, sphere, capsule, cyl, cone, humanoid, ring, rand, pick, flatDist, sfx, hex } from './util.js';
import { itemColor, typeOf, lookOf, displayName } from './items.js';
import { CharModel, prop } from './assets.js';
import { CLASSES, PET_COATS } from './skills.js';
import { Settings } from './settings.js';

const tmp = new THREE.Vector3();
const DMG_COLORS = { phys: '#ffffff', fire: '#ffa040', frost: '#9fdcff', storm: '#c6b8ff', poison: '#9dff7a' };

class Entity {
  constructor(type) {
    this.type = type;
    this.root = new THREE.Group();
    this.root.userData.entity = this;
    this.dead = false;
    this.pickR = 0.8;
    this.pickH = 0.8;
    this.label = null;
  }
  get pos() { return this.root.position; }
  face(p, dt = 0) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    if (dx * dx + dz * dz < 0.0001) return;
    const target = Math.atan2(dx, dz);
    if (!dt) { this.root.rotation.y = target; return; }
    let d = target - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, dt * 14);
  }
  followPath(path, speed, dt) {
    if (!path.length) return false;
    const p = path[0];
    tmp.set(p.x - this.pos.x, 0, p.z - this.pos.z);
    const step = speed * dt;
    const len = tmp.length();
    if (len <= step) { this.pos.x = p.x; this.pos.z = p.z; path.shift(); }
    else { tmp.multiplyScalar(step / len); this.pos.add(tmp); this.face(p, dt); }
    return true;
  }
  dispose() {}
}

// ---------------------------------------------------------------- Player
const WEAPON_ATTACKS = {
  '1h': ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'],
  '2h': ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab'],
  dual: ['Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'],
  cast: ['Spellcast_Shoot'],
  shoot1: ['1H_Ranged_Shoot'],
  shoot2: ['2H_Ranged_Shoot'],
};
const ATTACKS = {
  Knight: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'],
  Barbarian: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal'],
  Mage: ['2H_Melee_Attack_Stab', '2H_Melee_Attack_Slice'],
  Rogue: ['Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice', '1H_Melee_Attack_Stab'],
};
export class Player extends Entity {
  constructor() {
    super('player');
    const cls = CLASSES[G.cls] || CLASSES.Knight;
    this.model = new CharModel(cls.model, { scale: 0.72 * (G.look?.height || 1) });
    this.model.applyLook(cls, G.look || {});
    this.root.add(this.model.root);
    this.attacks = ATTACKS[G.cls] || ATTACKS.Knight;
    this.ranged = null;
    this.light = new THREE.PointLight(0xffd9a6, 14, 13, 1.4);
    this.light.position.set(0, 3.2, 0);
    this.root.add(this.light);
    const sel = ring(this.root, 0.7, 0xffffff);
    sel.material.opacity = 0.15;
    this.path = [];
    this.target = null;
    this.attackCd = 0;
    this.repath = 0;
    this.castLock = 0;
    this.hover = null;
    this.lastHit = null;
    this.hitAnimCd = 0;
    this.refreshVisuals();
  }
  refreshVisuals() {
    this.model.dress(G.equipment, G.look || {}, CLASSES[G.cls] || CLASSES.Knight);
    // attack style follows the weapon type
    const w = G.equipment.weapon;
    const t = w ? typeOf(w) : null;
    this.ranged = t?.ranged || null;
    this.attacks = t ? (WEAPON_ATTACKS[t.anim] || ATTACKS[G.cls]) : ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B', 'Unarmed_Melee_Attack_Kick'];
    if (t && t.anim === '1h' && G.equipment.offhand && /Offhand/.test(typeOf(G.equipment.offhand).vis)) this.attacks = WEAPON_ATTACKS.dual;
  }
  setTarget(t) { this.target = t; this.repath = 0; }
  moveTo(p) { this.target = null; this.path = G.level.findPath(this.pos, p); }
  takeDamage(d) {
    if (this.dead) return;
    d = d * 100 / (100 + armor());
    if (Math.random() < Math.min(0.25, stat('dex') * 0.004) + (G.buffs.smoke > 0 ? 0.3 : 0)) { G.main.floatText(this.pos, 'Dodge', '#cccccc', 16, 2.2); return; }
    G.hp -= d;
    G.main.floatText(this.pos, Math.round(d), '#ff5555', 20, 2.2);
    G.main.hurtFlash(d / maxHp());
    sfx('hurt');
    if (G.hp <= 0) {
      G.hp = 0; this.dead = true; this.path = []; this.target = null;
      this.model.once('Death_A', { hold: true, timeScale: 0.9 });
      G.main.onPlayerDeath();
      return;
    }
    if (this.hitAnimCd <= 0 && !this.model.oneShot && d > maxHp() * 0.06) { this.model.once('Hit_A', { timeScale: 1.6 }); this.hitAnimCd = 1.2; }
  }
  attack(e) {
    const aspd = attackSpeed();
    this.attackCd = 1 / aspd;
    const anim = pick(this.attacks);
    const clipDur = this.model.clips[anim]?.duration || 1;
    const ts = Math.max(1, clipDur * aspd * 1.15);
    this.model.once(anim, { timeScale: ts });
    sfx('swing');
    const hitDelay = (clipDur * (this.ranged ? 0.3 : 0.4)) / ts;
    this.pendingHit = { e, t: hitDelay };
  }
  // ranged basic attack: a bolt or magic missile that applies the normal weapon hit on impact
  shoot(e) {
    const from = this.pos.clone();
    const dir = e.pos.clone().sub(from).setY(0).normalize();
    from.addScaledVector(dir, 0.6);
    const magic = this.ranged === 'magic';
    const el = elementalDamage();
    const col = magic ? (el.fire ? 0xff7a1a : el.cold ? 0x9fdcff : el.light ? 0xc6b8ff : el.poison ? 0x77ee33 : 0xb48cff) : 0xd8d8d0;
    const p = new Projectile(dir, 0, 'enemy', col, { trail: magic ? col : null, kind: 'phys', blade: !magic, size: 0.16, speed: magic ? 18 : 24, life: 0.8, onHit: (n) => this.doHit(n) });
    p.root.position.copy(from);
    G.level.add(p);
  }
  doHit(e) {
    if (!e || e.dead) return;
    let d = rollDamage();
    const crit = Math.random() < critChance();
    if (crit) d *= critMult();
    const el = elementalDamage();
    d += el.fire + el.light;
    e.takeDamage(d, crit, el.fire > el.light ? (el.fire > 0 ? 'fire' : 'phys') : el.light > 0 ? 'storm' : 'phys');
    if (el.cold > 0 && !e.dead) { e.slowT = Math.max(e.slowT || 0, 1.5); e.takeDamage(el.cold, false, 'frost'); }
    if (el.poison > 0 && !e.dead) e.applyDot(el.poison * 1.2, 3, 'poison');
    if (el.fire > 0) G.main.fx.emit(e.pos.clone().setY(1), { count: 5, color: 0xff7a22, speed: 2, life: 0.4, size: 0.35, rise: 1 });
    this.lastHit = e;
    G.main.fx.emit(e.pos.clone().setY(1), { count: crit ? 14 : 6, color: crit ? 0xffdd55 : 0xffffff, speed: 4, life: 0.25, size: 0.3 });
    if (crit) G.main.shake(0.12);
    const leech = itemBonus('leech') + (G.skills.bloodthirst || 0) * 0.5;
    if (leech > 0) G.hp = Math.min(maxHp(), G.hp + d * leech / 100);
  }
  update(dt) {
    this.model.update(dt);
    if (this.dead) return;
    this.attackCd -= dt; this.castLock -= dt; this.hitAnimCd -= dt;
    if (this.pendingHit) { this.pendingHit.t -= dt; if (this.pendingHit.t <= 0) { const e = this.pendingHit.e; this.pendingHit = null; if (this.ranged) { if (!e.dead) this.shoot(e); } else this.doHit(e); } }
    G.hp = Math.min(maxHp(), G.hp + dt * (0.3 + stat('vit') * 0.03 + (G.skills.second_wind || 0) * 0.6 + itemBonus('regen')));
    G.mp = Math.min(maxMp(), G.mp + dt * (0.8 + stat('mag') * 0.06) * (1 + (G.skills.arcane_flow || 0) * 0.12));
    if (this.spinT > 0) { this.spinT -= dt; }
    const tg = this.target;
    if (tg && this.castLock <= 0) {
      if (tg.dead || !tg.root.parent) this.target = null;
      else {
        const isEnemy = tg.type === 'enemy';
        const reach = isEnemy ? (this.ranged ? 9 : 1.4 + tg.pickR * 0.5) : tg.pickR + 1.0;
        if (flatDist(tg.pos, this.pos) <= reach) {
          this.path = [];
          this.face(tg.pos, dt);
          if (isEnemy) { if (this.attackCd <= 0) this.attack(tg); }
          else { this.target = null; if (tg.type === 'interact' && !['merchant', 'quest', 'healer', 'blacksmith', 'villager'].includes(tg.kind)) this.model.once('Interact', { timeScale: 2 }); G.main.interact(tg); }
        } else {
          this.repath -= dt;
          if (this.repath <= 0 || !this.path.length) { this.repath = 0.25; this.path = G.level.findPath(this.pos, tg.pos); }
        }
      }
    }
    const speed = 6.2 * (G.buffs.speed > 0 ? 1.25 : 1) * (1 + (G.skills.swift_feet || 0) * 0.04);
    const moving = this.castLock <= 0 && this.followPath(this.path, speed, dt);
    if (moving && this.model.oneShot && !this.dead) { /* let attacks finish while moving */ }
    this.model.play(moving ? 'Running_A' : 'Idle', 0.15, moving ? 1.1 : 1);
  }
}

// ---------------------------------------------------------------- monsters
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
    case 'brute_old':
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


const SKEL = {
  skel_minion: { model: 'Skeleton_Minion', weapon: 'Skeleton_Blade' },
  skel_warrior: { model: 'Skeleton_Warrior', weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A' },
  skel_mage: { model: 'Skeleton_Mage', weapon: 'Skeleton_Staff' },
  skel_rogue: { model: 'Skeleton_Rogue', weapon: 'Skeleton_Crossbow' },
  brute: { model: 'Barbarian', hero: true },
};

export class Enemy extends Entity {
  constructor(d, floor, elite, boss) {
    super('enemy');
    this.data = d;
    this.name = d.name;
    this.elite = elite;
    this.boss = boss;
    this.floor = floor;
    const f1 = floor - 1;
    const hpMul = 1 + 0.42 * f1 + 0.004 * f1 * f1, dmgMul = 1 + 0.26 * f1 + 0.0015 * f1 * f1;
    this.maxHp = d.hp * hpMul * (elite ? 2.6 : 1);
    this.hp = this.maxHp;
    this.dmg = d.dmg * dmgMul * (elite ? 1.4 : 1);
    this.speed = d.speed;
    this.xp = Math.floor(d.xp * (1 + 0.35 * f1 + 0.012 * f1 * f1) * (elite ? 3 : 1));
    this.ranged = !!d.ranged;
    const s = boss ? 1.9 : elite ? 1.2 : 1;
    const sk = SKEL[d.shape];
    if (sk) {
      this.char = new CharModel(sk.model, { scale: 0.72 * s * (d.shape === 'brute' ? 1.25 : 1), tint: d.tint, emissive: boss || elite ? (boss ? 0x551100 : 0x332200) : d.emissive, emissiveIntensity: 0.5 });
      if (sk.hero) this.char.setGear(true, true);
      if (sk.weapon) this.char.attach(sk.weapon);
      if (sk.shield) this.char.attach(sk.shield, true);
      this.model = this.char.root;
      this.isSkel = !sk.hero;
    } else {
      this.model = buildEnemyModel(d.shape, d.color, s);
    }
    this.root.add(this.model);
    this.pickR = (d.shape === 'brute' ? 0.85 : sk ? 0.6 : 0.65) * s;
    this.pickH = (d.shape === 'beast' || d.shape === 'blob' ? 0.5 : 1.0) * s;
    if (elite || boss) {
      ring(this.root, 0.9 * s, boss ? 0xff3322 : 0xffcc33);
      this.label = { text: boss ? d.name : `Champion ${d.name}`, color: boss ? '#ff6644' : '#ffcc33', y: 2.4 * s, always: true };
    }
    this.aggro = false;
    this.atkCd = rand(0.5, 1.5);
    this.repath = 0;
    this.path = [];
    this.slowT = 0;
    this.stunT = 0;
    this.t = rand(0, 10);
    this.hitT = 0;
    this.swingT = 0;
    this.dormant = false;
    if (this.isSkel && d.shape === 'skel_minion' && !elite && !boss && Math.random() < 0.45) {
      this.dormant = true;
      this.char.once('Skeletons_Inactive_Floor_Pose', { hold: true });
    }
  }
  displayName() { return this.boss ? this.data.name : this.elite ? `Champion ${this.data.name}` : this.data.name; }
  wake() {
    if (!this.dormant) return;
    this.dormant = false;
    this.stunT = 1.4;
    this.char.oneShot = null;
    this.char.once('Skeletons_Awaken_Floor', { timeScale: 1.6 });
    G.main.fx.emit(this.pos.clone().setY(0.2), { count: 20, color: 0x9a8a70, speed: 2, life: 0.8, size: 0.6, rise: 1 });
  }
  // damage over time (poison, burning). Stacks by kind: a new application refreshes and keeps the stronger one.
  applyDot(dps, dur, kind = 'poison') {
    if (this.dead) return;
    this.dots = this.dots || {};
    const o = this.dots[kind];
    if (!o || o.dps <= dps) this.dots[kind] = { dps, t: dur, tick: 0 };
    else o.t = Math.max(o.t, dur);
  }
  tickDots(dt) {
    if (!this.dots) return;
    for (const k in this.dots) {
      const o = this.dots[k];
      o.t -= dt; o.tick -= dt;
      if (o.tick <= 0) {
        o.tick = 0.5;
        const dmg = o.dps * 0.5;
        this.hp -= dmg;
        if (Settings.damageNumbers) G.main.floatText(this.pos, Math.round(dmg), DMG_COLORS[k] || '#9dff7a', 15, this.pickH * 2);
        G.main.fx.emit(this.pos.clone().setY(this.pickH), { count: 3, color: k === 'poison' ? 0x77ee33 : k === 'fire' ? 0xff6a1a : 0x9fdcff, speed: 0.8, life: 0.6, size: 0.35, rise: 1.2 });
        if (this.hp <= 0) { this.die(); return; }
      }
      if (o.t <= 0) delete this.dots[k];
    }
  }
  takeDamage(d, crit = false, kind = 'phys') {
    if (this.dead) return;
    this.wake();
    this.hp -= d;
    this.aggro = true;
    this.hitT = 0.15;
    if (Settings.damageNumbers) G.main.floatText(this.pos, Math.round(d) + (crit ? '!' : ''), crit ? '#ffdd33' : DMG_COLORS[kind] || '#fff', crit ? 30 : 22, this.pickH * 2.2);
    sfx(crit ? 'crit' : 'hit');
    if (G.player) G.player.lastHit = this;
    if (this.hp <= 0) this.die();
    else {
      if (this.char && !this.char.oneShot && Math.random() < 0.5) this.char.once('Hit_A', { timeScale: 1.8 });
      for (const o of G.level.entities) if (o.type === 'enemy' && !o.aggro && flatDist(o.pos, this.pos) < 7) { o.aggro = true; o.wake(); }
    }
  }
  die() {
    this.dead = true;
    sfx('die');
    addXp(this.xp);
    G.main.floatText(this.pos, `+${this.xp} xp`, '#c9a3ff', 16, 1.0);
    onKill(this.data.name, this.boss);
    if (this.boss) G.main.addFameFromBoss(this.floor);
    G.level.dropLoot(this.pos.clone(), this.floor, this.elite, this.boss);
    G.main.fx.emit(this.pos.clone().setY(0.8), { count: this.boss ? 60 : 16, color: this.isSkel ? 0xd8d0b8 : this.data.color, speed: 4, life: 0.7, size: 0.5, gravity: 5 });
    if (this.boss) { G.main.shake(0.6); G.main.fx.explosion(this.pos, 0xff5522, 4); }
    this.deathT = this.char ? 2.6 : 0.6;
    if (this.char) this.char.once(this.isSkel ? 'Death_C_Skeletons' : 'Death_A', { hold: true, timeScale: 1.2 });
  }
  pickTarget() {
    const pl = G.player;
    let best = pl && !pl.dead ? pl : null;
    let bd = best ? flatDist(best.pos, this.pos) : 1e9;
    for (const o of G.level.entities) {
      if ((o.type === 'pet' || o.type === 'ally') && !o.dead && o.root.visible) {
        const d = flatDist(o.pos, this.pos) + 1.5;
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }
  update(dt) {
    this.t += dt;
    this.char?.update(dt);
    if (this.dead) {
      this.deathT -= dt;
      if (this.char) { if (this.deathT < 0.8) this.model.position.y -= dt * 1.2; }
      else { this.model.scale.multiplyScalar(0.9); this.model.rotation.z += dt * 4; }
      if (this.deathT <= 0) G.level.remove(this);
      return;
    }
    if (this.hitT > 0) { this.hitT -= dt; if (!this.char) this.model.position.x = Math.sin(this.t * 80) * 0.05; } else if (!this.char) this.model.position.x = 0;
    if (this.model.userData.float) this.model.position.y = Math.sin(this.t * 2.5) * 0.15;
    if (this.data.shape === 'blob') this.model.scale.y = this.model.scale.x * (1 + Math.sin(this.t * 6) * 0.08);
    this.atkCd -= dt; this.slowT -= dt; this.stunT -= dt;
    this.tickDots(dt);
    if (this.dead) return;
    const pl = G.player;
    if (!pl) return;
    if (this.dormant) { if (flatDist(pl.pos, this.pos) < 6) this.wake(); return; }
    if (this.stunT > 0) { this.char?.play('Idle'); return; }
    const tg = this.pickTarget();
    if (!tg) { this.char?.play('Idle'); return; }
    const dist = flatDist(tg.pos, this.pos);
    if (!this.aggro && flatDist(pl.pos, this.pos) < 9) this.aggro = true;
    if (!this.aggro) { this.char?.play('Idle'); if (!this.char) this.model.rotation.y = Math.sin(this.t * 0.5) * 0.5; return; }
    if (dist > 30) { this.aggro = false; return; }
    const range = this.ranged ? 7 : 1.1 + this.pickR * 0.7 + (tg.pickR || 0.5) * 0.4;
    let moving = false;
    if (dist <= range && (!this.ranged || G.level.lineClear(this.pos, tg.pos, 0.1))) {
      this.path = [];
      this.face(tg.pos, dt);
      if (this.atkCd <= 0) {
        this.atkCd = (this.ranged ? 1.9 : 1.4) * (this.slowT > 0 ? 1.6 : 1) * (this.boss ? 0.8 : 1);
        this.swingT = 0.3;
        if (this.char) this.char.once(this.ranged ? (this.data.shape === 'skel_rogue' ? '1H_Ranged_Shoot' : 'Spellcast_Shoot') : (this.boss ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop'), { timeScale: 1.5 });
        const target = tg;
        const delay = this.char ? 350 : 0;
        setTimeout(() => {
          if (this.dead || !G.level || !target.root.parent) return;
          if (this.ranged) {
            const dir = new THREE.Vector3(target.pos.x - this.pos.x, 0, target.pos.z - this.pos.z).normalize();
            const col = this.data.boltColor || this.data.color;
            const p = new Projectile(dir, this.dmg, 'ally', col, { trail: col, speed: 11, kind: 'fire', size: this.data.shape === 'skel_rogue' ? 0.12 : 0.25, blade: this.data.shape === 'skel_rogue' });
            p.root.position.copy(this.pos).addScaledVector(dir, 0.7);
            G.level.add(p);
          } else if (flatDist(target.pos, this.pos) < range + 1) target.takeDamage(this.dmg * rand(0.8, 1.2));
        }, delay);
      }
    } else {
      this.repath -= dt;
      if (this.repath <= 0) { this.repath = 0.4 + Math.random() * 0.3; this.path = G.level.findPath(this.pos, tg.pos); }
      moving = this.followPath(this.path, this.speed * (this.slowT > 0 ? 0.5 : 1), dt);
    }
    if (this.char) this.char.play(moving ? (this.isSkel ? 'Running_C' : 'Running_A') : 'Idle', 0.2, moving ? this.speed / 4.5 : 1);
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
    if (!this.char) {
      const hand = this.model.userData.hand;
      if (hand) hand.rotation.x = this.swingT > 0 ? -Math.sin((1 - this.swingT / 0.3) * Math.PI) * 1.5 : 0;
      if (this.swingT > 0) this.swingT -= dt;
    }
  }
}

// ---------------------------------------------------------------- summoned ally
export class Ally extends Entity {
  constructor() {
    super('ally');
    this.char = new CharModel('Skeleton_Minion', { tint: 0x99ffbb, emissive: 0x115522, emissiveIntensity: 0.7 });
    this.char.attach('Skeleton_Blade');
    this.root.add(this.char.root);
    this.maxHp = 40 + G.lvl * 12; this.hp = this.maxHp;
    this.pickR = 0.6; this.life = 30; this.atkCd = 0; this.path = []; this.repath = 0; this.target = null;
    this.char.once('Spawn_Ground_Skeletons', { timeScale: 1.5 });
    this.spawnT = 0.8;
  }
  takeDamage(d) {
    if (this.dead) return;
    this.hp -= d;
    if (this.hp <= 0) this.crumble();
  }
  crumble() {
    this.dead = true;
    this.char.once('Death_C_Skeletons', { hold: true, timeScale: 1.5 });
    this.deathT = 1.5;
  }
  update(dt) {
    this.char.update(dt);
    if (this.dead) { this.deathT -= dt; if (this.deathT < 0.5) this.root.position.y -= dt * 2; if (this.deathT <= 0) G.level.remove(this); return; }
    this.spawnT -= dt; this.life -= dt; this.atkCd -= dt;
    if (this.life <= 0) return this.crumble();
    if (this.spawnT > 0) return;
    const pl = G.player;
    if (!pl) return;
    if (this.target && (this.target.dead || !this.target.root.parent)) this.target = null;
    if (!this.target) { let bd = 10; for (const e of G.level.entities) if (e.type === 'enemy' && !e.dead && !e.dormant) { const d = flatDist(e.pos, this.pos); if (d < bd) { bd = d; this.target = e; } } }
    let moving = false;
    const tg = this.target;
    if (tg) {
      if (flatDist(tg.pos, this.pos) < 1.3 + tg.pickR * 0.6) {
        this.path = []; this.face(tg.pos, dt);
        if (this.atkCd <= 0) {
          this.atkCd = 1.1;
          this.char.once('1H_Melee_Attack_Chop', { timeScale: 1.6 });
          setTimeout(() => { if (!this.dead && !tg.dead) tg.takeDamage((4 + G.lvl * 2) * (1 + 0.2 * (G.skills.bones - 1)) * (G.buffs.warcry > 0 ? 1.3 : 1), false, 'phys'); }, 300);
        }
      } else {
        this.repath -= dt;
        if (this.repath <= 0 || !this.path.length) { this.repath = 0.35; this.path = G.level.findPath(this.pos, tg.pos); }
        moving = this.followPath(this.path, 5.5, dt);
      }
    } else if (flatDist(pl.pos, this.pos) > 3) {
      this.repath -= dt;
      if (this.repath <= 0 || !this.path.length) { this.repath = 0.5; this.path = G.level.findPath(this.pos, pl.pos); }
      moving = this.followPath(this.path, 6, dt);
    }
    this.char.play(moving ? 'Running_C' : 'Idle', 0.2);
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
    this.tail = this.tip = null;
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
      const coat = (PET_COATS.find((c) => c.key === G.look?.pet) || PET_COATS[0]).color;
      const b = box(0.38, 0.32, 0.7, coat); b.position.y = 0.38; g.add(b);
      const hd = sphere(0.2, coat); hd.position.set(0, 0.6, 0.38); g.add(hd);
      const snout = box(0.1, 0.1, 0.18, 0xf2e6d9); snout.position.set(0, 0.55, 0.58); g.add(snout);
      for (const x of [-0.1, 0.1]) { const ear = cone(0.07, 0.18, coat); ear.position.set(x, 0.82, 0.35); g.add(ear); }
      for (const [x, z] of [[-0.12, -0.25], [0.12, -0.25], [-0.12, 0.25], [0.12, 0.25]]) { const l = box(0.08, 0.25, 0.08, 0x592e14); l.position.set(x, 0.12, z); g.add(l); }
      const tail = box(0.12, 0.12, 0.45, coat); tail.position.set(0, 0.55, -0.5); tail.rotation.x = 0.6; g.add(tail); this.tail = tail;
      const tip = sphere(0.09, 0xffdd88, 3); tip.position.set(0, 0.72, -0.7); tip.castShadow = false; g.add(tip); this.tip = tip;
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
    if (!initial) { G.main.fx.emit(this.pos.clone().setY(0.8), { count: 50, color: 0x99e6ff, speed: 3, life: 0.8, size: 0.6 }); G.main.fx.ring(this.pos, 0x99e6ff, 1.5); }
  }
  goAway() { this.root.visible = false; this.target = null; }
  comeBack() { this.root.visible = true; if (G.player) this.pos.copy(G.player.pos).add(new THREE.Vector3(1, 0, 1)); }
  takeDamage(d) {
    if (this.dead || !this.root.visible) return;
    d = d * (G.petForm === 'golem' ? 0.6 : 1);
    this.hp -= d;
    if (Settings.damageNumbers) G.main.floatText(this.pos, Math.round(d), '#ffaa66', 16, 1.0);
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
        this.path = []; this.face(tg.pos, dt);
        if (this.atkCd <= 0) {
          this.atkCd = 0.9;
          tg.takeDamage(petDamage() * this.dmgMul * rand(0.8, 1.2) * (G.buffs.warcry > 0 ? 1.3 : 1), false, G.petForm === 'wyrm' ? 'fire' : 'phys');
          this.model.position.z = 0.3;
          if (G.petForm === 'wyrm') G.main.fx.emit(tg.pos.clone().setY(0.8), { count: 10, color: 0xff7733, speed: 2, life: 0.4, size: 0.5 });
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
    this.model.position.y = moving ? Math.abs(Math.sin(this.t * 14)) * 0.12 : Math.sin(this.t * 2) * 0.01;
    if (this.tail) this.tail.rotation.y = Math.sin(this.t * (moving ? 14 : 5)) * 0.5;
    if (this.tip && G.level.kind === 'dungeon' && Math.random() < dt * 6) G.main.fx.emit(this.tip.getWorldPosition(tmp), { count: 1, color: 0xffcc66, speed: 0.3, life: 0.6, size: 0.25, rise: 0.4 });
  }
}

// ---------------------------------------------------------------- Projectile
export class Projectile extends Entity {
  constructor(dir, dmg, targetType, color, o = {}) {
    super('proj');
    this.dir = dir; this.dmg = dmg; this.targetType = targetType;
    this.speed = o.speed ?? 16; this.life = o.life ?? 1.4;
    this.color = color; this.trail = o.trail; this.kind = o.kind || 'fire'; this.explode = o.explode; this.onHit = o.onHit;
    if (o.blade) {
      const b = box(0.08, 0.04, 0.45, 0xdde4ee, 0.4);
      b.lookAt(dir);
      this.root.add(b);
      this.spinMesh = b;
    } else {
      const s = sphere(o.size ?? 0.22, color, 4); s.castShadow = false; this.root.add(s);
    }
    this.root.children.forEach((c) => (c.position.y = 1.0));
  }
  update(dt) {
    const fx = G.main.fx;
    if (this.vel) {
      this.pos.addScaledVector(this.vel, dt);
      this.landAt -= dt;
      if (this.trail) fx.emit(this.pos.clone().setY(this.pos.y + 1), { count: 3, color: this.trail, speed: 0.6, life: 0.5, size: 0.8 });
      if (this.landAt <= 0) { this.onLand?.(); G.level.remove(this); }
      return;
    }
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.life -= dt;
    if (this.trail && Math.random() < 0.9) fx.emit(this.pos.clone().setY(1), { count: 1, color: this.trail, speed: 0.4, life: 0.35, size: this.spinMesh ? 0.15 : 0.45 });
    if (this.life <= 0 || !G.level.walkable(this.pos)) { this.impact(); return; }
    const targets = this.targetType === 'enemy'
      ? G.level.entities.filter((e) => e.type === 'enemy')
      : G.level.entities.filter((e) => e.type === 'player' || e.type === 'pet' || e.type === 'ally');
    for (const n of targets) {
      if (!n || n.dead || !n.root.visible) continue;
      if (flatDist(n.pos, this.pos) < 0.45 + n.pickR * 0.6) {
        if (this.onHit) this.onHit(n); else n.takeDamage(this.dmg, false, this.kind);
        if (this.explode) for (const e of targets) if (e !== n && !e.dead && flatDist(e.pos, this.pos) < 2.5) e.takeDamage(this.dmg * 0.5, false, 'fire');
        this.impact();
        return;
      }
    }
  }
  impact() {
    const fx = G.main.fx;
    fx.emit(this.pos.clone().setY(1), { count: this.explode ? 30 : 10, color: this.color, speed: this.explode ? 5 : 3, life: 0.35, size: 0.5 });
    if (!this.spinMesh) fx.flash(this.pos, this.color, this.explode ? 25 : 10, 0.25);
    G.level.remove(this);
  }
}

// ---------------------------------------------------------------- Loot
export class Loot extends Entity {
  constructor(d) {
    super('loot');
    this.gold = d.gold || 0; this.item = d.item || null; this.potion = d.potion || '';
    let c, text;
    if (this.gold) {
      c = 0xffd940; text = `${this.gold} gold`;
      this.gem = prop('coin_stack_medium'); this.gem.scale.setScalar(this.gold > 60 ? 0.7 : 0.45);
    } else if (this.potion) {
      c = this.potion === 'hp' ? 0xe62626 : 0x3366ff; text = this.potion === 'hp' ? 'Health Potion' : 'Mana Potion';
      this.gem = prop('bottle_A_brown'); this.gem.scale.setScalar(0.6);
      this.gem.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(c); o.material.emissive = new THREE.Color(c); o.material.emissiveIntensity = 0.5; } });
    } else {
      c = itemColor(this.item); text = this.item.name;
      this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 + this.item.rarity * 0.5, metalness: 0.6, roughness: 0.3 }));
      this.gem.castShadow = true;
      if (this.item.rarity >= 2) {
        ring(this.root, 0.6, c);
        const beam = cyl(0.06, 0.06, 5, c, 2); beam.material.transparent = true; beam.material.opacity = 0.3; beam.material.depthWrite = false; beam.position.y = 2.5; beam.castShadow = false; this.root.add(beam);
      }
    }
    this.gem.position.y = 0.3;
    this.root.add(this.gem);
    this.pickR = 0.7; this.pickH = 0.3;
    this.label = { text, color: hex(c), y: 0.9, clickable: true };
    this.t = Math.random() * 5;
    this.pop = 0;
    if (this.item && this.item.rarity >= 3) setTimeout(() => sfx('legend'), 200);
  }
  update(dt) {
    this.t += dt;
    if (this.pop < 1) { this.pop = Math.min(1, this.pop + dt * 2.5); this.root.position.y = Math.sin(this.pop * Math.PI) * 1.2; }
    this.gem.rotation.y += dt * 1.5;
    if (!this.gold) this.gem.position.y = 0.35 + Math.sin(this.t * 3) * 0.06;
    if (this.item && this.item.rarity >= 1 && Math.random() < dt * 4) G.main.fx.emit(this.pos.clone().setY(0.4), { count: 1, color: itemColor(this.item), speed: 0.3, life: 0.8, size: 0.25, rise: 0.8 });
    if ((this.gold || (Settings.autoLoot && this.potion)) && this.pop >= 1 && G.player && !G.player.dead && flatDist(this.pos, G.player.pos) < 1.4) this.pickup();
  }
  pickup() {
    if (this.dead) return;
    if (this.gold) { G.gold += this.gold; G.main.floatText(this.pos, `+${this.gold}g`, '#ffd940', 16, 0.8); sfx('gold'); }
    else if (this.potion) { if (this.potion === 'hp') G.hpPotions++; else G.mpPotions++; msg(`Picked up a ${this.label.text}`); sfx('pick'); }
    else if (!pickupItem(this.item)) return;
    this.dead = true;
    G.level.remove(this);
  }
}

// ---------------------------------------------------------------- Interact
const NPC_LOOK = {
  merchant: { model: 'Rogue_Hooded', cape: '#a0602a', gear: false },
  quest: { model: 'Knight', cape: '#1f3f8c', gear: true },
  healer: { model: 'Mage', cape: '#e8e8e8', gear: false, tint: 0xffffff },
  blacksmith: { model: 'Barbarian', cape: '#5a3a1a', gear: true },
};
export class Interact extends Entity {
  constructor(kind, data) {
    super('interact');
    this.kind = kind; this.data = data; this.t = 0; this.bob = null;
    this.pickR = 1.0; this.pickH = 0.9;
    let lc = '#fff6d9', ly = 1.5;
    const add = (o) => { this.root.add(o); return o; };
    switch (kind) {
      case 'merchant': case 'quest': case 'healer': case 'blacksmith': {
        const L = NPC_LOOK[kind];
        this.char = new CharModel(L.model, { scale: 0.75 });
        this.char.setGear(L.gear, L.gear);
        this.char.setCapeColor(L.cape);
        add(this.char.root);
        if (kind === 'merchant') {
          const t = add(prop('crates_stacked')); t.scale.setScalar(0.4); t.position.set(1.5, 0, -0.6);
          const b = add(prop('barrel_small')); b.scale.setScalar(0.6); b.position.set(-1.4, 0, -0.5);
          const k = add(prop('keg')); k.scale.setScalar(0.35); k.position.set(-1.6, 0, 0.6);
          lc = '#ffd966';
        } else if (kind === 'quest') {
          this.bob = add(new THREE.Group());
          const ex = box(0.14, 0.5, 0.14, 0xffcc22, 2); ex.position.y = 0.3; this.bob.add(ex);
          const dot = box(0.14, 0.14, 0.14, 0xffcc22, 2); dot.position.y = -0.15; this.bob.add(dot);
          this.bob.position.y = 2.6;
          const rack = add(prop('weaponrack')); rack.scale.setScalar(5); rack.position.set(1.4, 0, -0.6);
          lc = '#a6ffa6';
        } else if (kind === 'blacksmith') {
          const r = add(prop('weaponrack')); r.scale.setScalar(5); r.position.set(-1.5, 0, -0.4);
          const a = add(prop('barrel')); a.scale.setScalar(5); a.position.set(1.4, 0, -0.3);
          lc = '#ffb380';
        } else {
          const c = add(prop('candle_triple')); c.position.set(0.9, 0, 0.4);
          lc = '#b3e6ff';
        }
        ly = 2.5;
        this.root.rotation.y = 0;
        break;
      }
      case 'pond': case 'fish_hole': {
        this.pickH = 0.1; this.pickR = 1.3;
        if (kind === 'fish_hole') {
          const pool = add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshStandardMaterial({ color: 0x1f5f9f, roughness: 0.1, metalness: 0.4, emissive: 0x0a2a55, emissiveIntensity: 0.8 })));
          pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06;
          for (let i = 0; i < 6; i++) { const r = add(prop('rock_single_C')); r.scale.setScalar(3); const a = (i / 6) * Math.PI * 2; r.position.set(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2); r.rotation.y = a; }
        }
        const post = add(box(0.1, 1.0, 0.1, 0x59381a)); post.position.set(1.2, 0.5, 0);
        const sign = add(box(0.6, 0.35, 0.05, 0x8c6633)); sign.position.set(1.2, 1.0, 0.05);
        const fish = add(box(0.3, 0.12, 0.06, 0x66b3ff, 1)); fish.position.set(1.2, 1.0, 0.09);
        lc = '#99d9ff'; ly = 1.6; break;
      }
      case 'well': this.pickR = 2.0; this.pickH = 1.0; lc = '#ffb366'; ly = 4.6; break;
      case 'stairs_down': case 'stairs_up': {
        const down = kind === 'stairs_down';
        if (down) {
          const hole = add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: 0x000000 }))); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06;
          for (let i = 0; i < 4; i++) { const s = add(box(1.8, 0.1, 0.42, new THREE.Color(0x6a6058).multiplyScalar(1 - i * 0.2).getHex())); s.position.set(0, 0.04 - i * 0.01, 0.8 - i * 0.45); s.receiveShadow = true; }
          const glow = add(new THREE.PointLight(0xffaa55, 6, 5, 1.5)); glow.position.y = 0.3;
        } else {
          const st = add(prop('stairs')); st.scale.setScalar(0.42); st.position.set(0, 0, -0.9);
        }
        ring(this.root, 1.4, down ? 0xffcc4d : 0x80ccff);
        lc = down ? '#ffd480' : '#99d6ff'; break;
      }
      case 'portal': {
        this.bob = add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 12, 32), new THREE.MeshStandardMaterial({ color: 0x6699ff, emissive: 0x6699ff, emissiveIntensity: 2.5 })));
        this.bob.position.y = 1.3;
        const disc = add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({ color: 0x99bbff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })));
        disc.position.y = 1.3;
        this.disc = disc;
        lc = '#99bbff'; ly = 2.6; break;
      }
      case 'chest': {
        this.pickH = 0.4; this.pickR = 0.8;
        const gold = Math.random() < 0.2;
        this.chest = add(prop(gold ? 'chest_gold' : 'chest'));
        this.chest.scale.setScalar(0.55);
        this.gold = gold;
        this.chest.traverse((o) => { if (o.isMesh && !this.lid) { /* first mesh = body */ } });
        const meshes = []; this.chest.traverse((o) => { if (o.isMesh) meshes.push(o); });
        this.lid = meshes.reduce((a, b) => ((b.geometry.boundingBox || b.geometry.computeBoundingBox() || b.geometry.boundingBox).max.y > (a.geometry.boundingBox || a.geometry.computeBoundingBox() || a.geometry.boundingBox).max.y ? b : a), meshes[0]);
        break;
      }
      case 'relic': {
        this.pickH = 0.5;
        this.bob = add(prop('candle_triple')); this.bob.scale.setScalar(1);
        const lan = add(cyl(0.2, 0.25, 0.5, 0xd9a640, 1.5)); lan.position.y = 0.5; this.lantern = lan;
        ring(this.root, 0.8, 0xffcc33);
        lc = '#ffcc4d'; break;
      }
      case 'shrine_power': case 'shrine_speed': case 'shrine_wealth': {
        const col = { shrine_power: 0xff4d33, shrine_speed: 0x4dff80, shrine_wealth: 0xffd933 }[kind];
        const b = add(prop('column')); b.scale.set(1.2, 0.7, 1.2);
        this.bob = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.5 })));
        this.bob.position.y = 1.6;
        this.shrineColor = col;
        lc = hex(col); break;
      }
    }
    this.label = { text: data.name || kind, color: lc, y: ly, always: ['merchant', 'quest', 'healer', 'blacksmith', 'well', 'portal', 'stairs_down', 'stairs_up'].includes(kind) };
  }
  update(dt) {
    this.t += dt;
    this.char?.update(dt);
    if (this.char && G.player && flatDist(G.player.pos, this.pos) < 7) this.face(G.player.pos, dt * 0.3);
    if (this.bob) {
      if (this.kind === 'portal') {
        this.disc.material.opacity = 0.4 + Math.sin(this.t * 3) * 0.15;
        if (G.main.camera) { this.bob.lookAt(G.main.camera.position); this.disc.lookAt(G.main.camera.position); }
        if (Math.random() < dt * 20) G.main.fx.emit(this.pos.clone().setY(1.3), { count: 1, color: 0x88aaff, speed: 1.5, life: 0.6, size: 0.3 });
      } else if (this.kind !== 'relic') { this.bob.rotation.y += dt; this.bob.position.y += Math.sin(this.t * 3) * 0.004; }
    }
    if (this.shrineColor && !this.dead && Math.random() < dt * 10) G.main.fx.emit(this.pos.clone().setY(1.6), { count: 1, color: this.shrineColor, speed: 0.5, life: 0.8, size: 0.3, rise: 0.6 });
    if (this.kind === 'relic' && Math.random() < dt * 8) G.main.fx.emit(this.pos.clone().setY(0.6), { count: 1, color: 0xffcc55, speed: 0.4, life: 0.8, size: 0.3, rise: 0.6 });
  }
  openChest() {
    this.dead = true;
    this.label = null;
    if (this.lid) { this.lid.rotation.x = -1.1; this.lid.position.z -= 0.3; this.lid.position.y += 0.2; }
    G.main.fx.emit(this.pos.clone().setY(0.6), { count: 30, color: 0xffdd66, speed: 3, life: 0.8, size: 0.4, rise: 2 });
  }
  consume() {
    this.dead = true;
    this.label = null;
    if (this.bob) this.bob.visible = false;
    if (this.kind === 'relic') G.level.remove(this);
  }
}

// ---------------------------------------------------------------- Villager (ambient townsfolk)
export class Villager extends Entity {
  constructor(d) {
    super('interact');
    this.kind = 'villager';
    this.data = d;
    this.mode = d.mode || 'wander';
    this.home = null;
    this.path = [];
    this.wait = rand(0.5, 3);
    this.pickR = 0.7; this.pickH = 0.9;
    this.char = new CharModel(d.model, { scale: 0.72 * (d.scale || 1), tint: d.tint });
    this.char.applyLook({ gear: d.gear ? [d.gear] : [{ weapon: [], offhand: [] }], headgear: d.headgear, cape: d.cape || '#6a4a2a' }, { helm: !!d.helm, capeOn: d.capeOn !== false, cape: d.cape, gear: 0 });
    this.root.add(this.char.root);
    this.label = { text: d.name, color: '#e8dcc0', y: 2.2 * (d.scale || 1), always: false };
    this.idleAnim = { sit: 'Sit_Floor_Idle', fish: 'Sit_Floor_Idle', chair: 'Sit_Chair_Idle', guard: '2H_Melee_Idle', perform: 'Spellcasting' }[this.mode] || 'Idle';
    this.char.play(this.idleAnim, 0);
    this.talkCd = 0;
  }
  talk() {
    if (this.talkCd > 0) return;
    this.talkCd = 3;
    const line = pick(this.data.lines);
    G.main.floatText(this.pos, `"${line}"`, '#f3e6c4', 15, 2.4 * (this.data.scale || 1));
    msg(`${this.data.name}: "${line}"`, '#e8dcc0');
    if (this.mode === 'wander') { this.path = []; this.wait = 3; }
    this.char.once(Math.random() < 0.5 ? 'Interact' : 'Cheer', { timeScale: 1.2 });
    sfx('ui');
  }
  update(dt) {
    this.char.update(dt);
    this.talkCd -= dt;
    if (!this.home) this.home = this.pos.clone();
    const pl = G.player;
    const near = pl && flatDist(pl.pos, this.pos) < 3;
    if (this.mode !== 'wander') {
      if (this.mode === 'perform' && Math.random() < dt * 0.15) this.char.once('Cheer', { timeScale: 1 });
      if (this.mode === 'guard' && near) this.face(pl.pos, dt * 0.3);
      return;
    }
    if (near) { this.path = []; this.face(pl.pos, dt * 0.5); this.char.play('Idle', 0.25); return; }
    if (this.path.length) {
      this.followPath(this.path, this.data.speed || 1.9, dt);
      this.char.play('Walking_A', 0.25, 1);
      return;
    }
    this.char.play('Idle', 0.3);
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = rand(2.5, 7);
      if (Math.random() < 0.2) { this.char.once(pick(['Interact', 'Cheer', 'PickUp']), { timeScale: 0.9 }); return; }
      const r = this.data.roam || 9;
      for (let i = 0; i < 6; i++) {
        const t = this.home.clone().add(new THREE.Vector3(rand(-r, r), 0, rand(-r, r)));
        if (G.level.walkable(t)) { this.path = G.level.findPath(this.pos, t); break; }
      }
    }
  }
}
