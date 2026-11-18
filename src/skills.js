import * as THREE from 'three';
import { G, stat, rollDamage, maxHp, critChance } from './state.js';
import { Projectile, Ally } from './entities.js';
import { flatDist, sfx } from './util.js';

const mag = () => stat('mag');
const rank = (id) => G.skills[id] || 0;
const R = (id, base, per) => base * (1 + per * (rank(id) - 1));
const spellPower = () => (G.buffs.power > 0 ? 1.5 : 1) * (G.buffs.warcry > 0 ? 1.15 : 1);

export const SKILLS = {
  firebolt: { name: 'Firebolt', icon: 'fire', school: 'Fire', cost: () => 4 + rank('firebolt') * 1.5, cd: 0, anim: 'Spellcast_Shoot',
    dmg: () => R('firebolt', 6 + mag() * 1.1 + G.lvl * 1.5, 0.3) * spellPower(),
    desc: (s) => `Hurls a bolt of fire for ${Math.round(s.dmg())} damage.` },
  lightning: { name: 'Chain Lightning', icon: 'bolt', school: 'Storm', cost: () => 10 + rank('lightning') * 2, cd: 0.8, anim: 'Spellcast_Shoot',
    dmg: () => R('lightning', 5 + mag() * 0.9 + G.lvl * 1.3, 0.25) * spellPower(), jumps: () => 2 + rank('lightning'),
    desc: (s) => `Lightning arcs between ${s.jumps() + 1} foes for ${Math.round(s.dmg())} damage each.` },
  nova: { name: 'Frost Nova', icon: 'frost', school: 'Frost', cost: () => 16 + rank('nova') * 2, cd: 4, anim: 'Spellcast_Raise',
    dmg: () => R('nova', 8 + mag() * 0.9 + G.lvl * 1.2, 0.3) * spellPower(),
    desc: (s) => `Freezing blast around you: ${Math.round(s.dmg())} damage, slows enemies for 4s.` },
  meteor: { name: 'Meteor', icon: 'meteor', school: 'Fire', cost: () => 28 + rank('meteor') * 3, cd: 6, anim: 'Spellcast_Long',
    dmg: () => R('meteor', 20 + mag() * 2.2 + G.lvl * 3, 0.3) * spellPower(),
    desc: (s) => `Calls a meteor down at the cursor for ${Math.round(s.dmg())} damage in a wide area.` },
  heal: { name: 'Mend Wounds', icon: 'heal', school: 'Light', cost: () => 12 + rank('heal'), cd: 3, anim: 'Spellcast_Raise',
    amount: () => R('heal', 18 + mag() * 1.6 + G.lvl * 2, 0.35),
    desc: (s) => `Restores ${Math.round(s.amount())} life to you and heals your pet.` },
  bones: { name: 'Raise Bones', icon: 'skull', school: 'Death', cost: () => 30 + rank('bones') * 2, cd: 20, anim: 'Spellcast_Raise',
    count: () => 1 + Math.ceil(rank('bones') / 2),
    desc: (s) => `Raises ${s.count()} skeleton warrior${s.count() > 1 ? 's' : ''} to fight for you for 30 seconds.` },
  whirlwind: { name: 'Whirlwind', icon: 'whirl', school: 'Might', cost: () => 12 + rank('whirlwind') * 1.5, cd: 2.5, anim: '2H_Melee_Attack_Spin',
    mult: () => R('whirlwind', 1.1, 0.2),
    desc: (s) => `Spin with your weapon, hitting everything around you 3 times for ${Math.round(s.mult() * 100)}% weapon damage.` },
  slam: { name: 'Ground Slam', icon: 'slam', school: 'Might', cost: () => 9 + rank('slam'), cd: 2, anim: '2H_Melee_Attack_Chop',
    mult: () => R('slam', 1.8, 0.25),
    desc: (s) => `Smash the ground ahead for ${Math.round(s.mult() * 100)}% weapon damage and stun foes for 1.5s.` },
  knives: { name: 'Fan of Knives', icon: 'knives', school: 'Cunning', cost: () => 8 + rank('knives'), cd: 0.6, anim: 'Throw',
    mult: () => R('knives', 0.7, 0.2), count: () => 4 + rank('knives'),
    desc: (s) => `Throws ${s.count()} knives in a fan, each dealing ${Math.round(s.mult() * 100)}% weapon damage.` },
  blink: { name: 'Shadow Step', icon: 'blink', school: 'Cunning', cost: () => 10, cd: () => Math.max(1.5, 5 - rank('blink') * 0.5), anim: 'Dodge_Forward',
    desc: (s) => `Vanish and reappear at the cursor. ${s.cdv().toFixed(1)}s cooldown.` },
  warcry: { name: 'Battle Cry', icon: 'cry', school: 'Might', cost: () => 15, cd: 18, anim: 'Cheer',
    dur: () => 10 + rank('warcry') * 2,
    desc: (s) => `+30% damage and +40 armor for you and your allies for ${s.dur()}s.` },
};
for (const k in SKILLS) {
  const s = SKILLS[k];
  s.id = k;
  s.cdv = () => (typeof s.cd === 'function' ? s.cd() : s.cd);
}

export const PASSIVES = {
  mastery: { name: 'Weapon Mastery', desc: () => '+10% weapon damage and +3% attack speed per rank.' },
  pet_bond: { name: 'Pet Bond', desc: () => `+15% pet damage and life per rank.` },
  toughness: { name: 'Toughness', desc: () => '+8% maximum life and +5 armor per rank.' },
};

export const CLASSES = {
  Knight: { title: 'Knight', model: 'Knight', desc: 'A sworn shield of Hollowmere. Tough, steady, and hard to kill.', base: { str: 14, dex: 9, vit: 15, mag: 6 }, skills: { slam: 1, warcry: 1 }, hotbar: { rmb: 'slam', q: 'warcry', w: 'heal', e: 'nova', r: 'firebolt' }, weapon: 'Iron Sword', cape: '#8c1f1f' },
  Barbarian: { title: 'Berserker', model: 'Barbarian', desc: 'A wild axe-swinger from the northern fells. Fast, brutal, reckless.', base: { str: 16, dex: 12, vit: 12, mag: 4 }, skills: { whirlwind: 1, mastery: 1 }, hotbar: { rmb: 'whirlwind', q: 'warcry', w: 'slam', e: 'heal', r: 'firebolt' }, weapon: 'Hand Axe', cape: '#3a5a2a' },
  Mage: { title: 'Mage', model: 'Mage', desc: 'A scholar of the burning arts. Fragile, but devastating from afar.', base: { str: 6, dex: 9, vit: 9, mag: 20 }, skills: { firebolt: 1, nova: 1 }, hotbar: { rmb: 'firebolt', q: 'heal', w: 'nova', e: 'lightning', r: 'meteor' }, weapon: 'Ashwood Staff', cape: '#4a2a7a' },
  Rogue: { title: 'Rogue', model: 'Rogue', alt: 'Rogue_Hooded', desc: 'A quick blade from the alleys of the old city. Strikes first, never stays.', base: { str: 10, dex: 17, vit: 10, mag: 7 }, skills: { knives: 1, blink: 1 }, hotbar: { rmb: 'knives', q: 'blink', w: 'heal', e: 'nova', r: 'firebolt' }, weapon: 'Curved Dagger', cape: '#1f5a3a' },
};
export const CAPE_COLORS = ['#8c1f1f', '#1f3f8c', '#2f6a2a', '#4a2a7a', '#8a6a1a', '#1a1a1a', '#e0e0e0', '#1f5a5a'];

function enemies() { return G.level.entities.filter((e) => e.type === 'enemy' && !e.dead); }
function weaponHit(e, mult, kind = 'phys') {
  let d = rollDamage() * mult;
  const crit = Math.random() < critChance();
  if (crit) d *= 2;
  e.takeDamage(d, crit, kind);
  return d;
}

export function canCast(id) {
  const s = SKILLS[id];
  if (!s || rank(id) < 1) return 'Not learned (press K)';
  if ((G.cds[id] || 0) > 0) return 'Not ready';
  if (G.mp < s.cost()) return 'Not enough mana';
  return null;
}

export function cast(id, at, targetEnt) {
  const s = SKILLS[id];
  const err = canCast(id);
  if (err) { G.main.flash(err); return false; }
  const P = G.player;
  if (id === 'blink' && (!G.level.walkable(at) || flatDist(at, P.pos) > 12)) { G.main.flash("Can't step there"); return false; }
  G.mp -= s.cost();
  G.cds[id] = s.cdv();
  P.face(at);
  P.path = [];
  P.target = null;
  P.castLock = 0.35;
  P.model.once(s.anim, { timeScale: id === 'whirlwind' ? 1.3 : 1.4 });
  const fx = G.main.fx;
  const pos = P.pos.clone();
  const dir = new THREE.Vector3(at.x - pos.x, 0, at.z - pos.z);
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();
  switch (id) {
    case 'firebolt': {
      const p = new Projectile(dir, s.dmg(), 'enemy', 0xff7a1a, { trail: 0xff8833, kind: 'fire', explode: rank('firebolt') >= 5 });
      p.root.position.copy(pos).addScaledVector(dir, 0.7);
      G.level.add(p);
      sfx('fire');
      break;
    }
    case 'lightning': {
      const list = enemies();
      let cur = targetEnt && targetEnt.type === 'enemy' && !targetEnt.dead ? targetEnt : null;
      if (!cur) { let bd = 9; for (const e of list) { const d = flatDist(e.pos, at); if (d < bd && flatDist(e.pos, pos) < 14) { bd = d; cur = e; } } }
      let from = pos.clone().setY(1.2);
      const hit = new Set();
      if (!cur) { fx.beam(from, at.clone().setY(0.5).sub(pos).clampLength(0, 8).add(pos).setY(0.5), 0x99ccff); sfx('zap'); break; }
      for (let j = 0; j <= s.jumps() && cur; j++) {
        const to = cur.pos.clone().setY(1.0);
        fx.beam(from, to, 0x9fd0ff);
        cur.takeDamage(s.dmg() * (1 - j * 0.08), false, 'storm');
        hit.add(cur);
        from = to;
        let nb = null, bd = 7;
        for (const e of list) if (!hit.has(e) && !e.dead) { const d = flatDist(e.pos, cur.pos); if (d < bd) { bd = d; nb = e; } }
        cur = nb;
      }
      fx.flash(pos, 0x88bbff, 25, 0.3);
      sfx('zap');
      break;
    }
    case 'nova': {
      for (const e of enemies()) if (flatDist(e.pos, pos) < 5.5) { e.takeDamage(s.dmg(), false, 'frost'); e.slowT = 4; }
      fx.ring(pos, 0x99ddff, 5.5, 0.5);
      fx.emit(pos.clone().setY(0.5), { count: 80, color: 0xbfe8ff, speed: 9, life: 0.6, size: 0.6, flat: true });
      fx.flash(pos, 0x99ddff, 30, 0.5);
      sfx('nova');
      break;
    }
    case 'meteor': {
      const target = at.clone();
      fx.ring(target, 0xff6622, 2.5, 0.9);
      const rock = new Projectile(new THREE.Vector3(0, -1, 0), 0, 'none', 0xff5511, { trail: 0xff7733, size: 0.6, life: 2 });
      rock.root.position.set(target.x - 4, 12, target.z - 3);
      rock.vel = new THREE.Vector3(4, -12, 3).multiplyScalar(1 / 0.9);
      rock.onLand = () => {
        fx.explosion(target, 0xff6622, 3);
        for (const e of enemies()) if (flatDist(e.pos, target) < 3.5) e.takeDamage(s.dmg(), false, 'fire');
        G.main.shake(0.4);
        sfx('boom');
      };
      rock.landAt = 0.9;
      G.level.add(rock);
      sfx('fire');
      break;
    }
    case 'heal': {
      const a = s.amount();
      G.hp = Math.min(maxHp(), G.hp + a);
      if (G.pet && !G.pet.dead) G.pet.hp = Math.min(G.pet.maxHp, G.pet.hp + a);
      G.main.floatText(pos, '+' + Math.round(a), '#66ff88', 22, 2.2);
      fx.emit(pos.clone().setY(0.2), { count: 40, color: 0x77ff99, speed: 1.2, life: 1.2, size: 0.5, rise: 2.5, spread: 1.2 });
      fx.ring(pos, 0x66ff88, 1.5);
      sfx('heal');
      break;
    }
    case 'bones': {
      for (let i = 0; i < s.count(); i++) {
        const a = new Ally();
        const off = new THREE.Vector3(Math.cos(i * 2.4) * 1.5, 0, Math.sin(i * 2.4) * 1.5);
        const p = pos.clone().add(off);
        a.root.position.copy(G.level.walkable(p) ? p : pos);
        G.level.add(a);
        fx.emit(a.root.position.clone().setY(0.3), { count: 30, color: 0x66ff99, speed: 2, life: 1, size: 0.5, rise: 1.5 });
      }
      sfx('buff');
      break;
    }
    case 'whirlwind': {
      const m = s.mult();
      P.spinT = 0.9;
      let ticks = 0;
      const tick = () => {
        if (!G.player || G.player.dead) return;
        for (const e of enemies()) if (flatDist(e.pos, G.player.pos) < 3.2) weaponHit(e, m);
        fx.ring(G.player.pos, 0xffddaa, 3, 0.25);
        fx.emit(G.player.pos.clone().setY(0.8), { count: 16, color: 0xddddcc, speed: 6, life: 0.3, size: 0.35, flat: true });
        sfx('swing');
        if (++ticks < 3) setTimeout(tick, 280);
      };
      tick();
      break;
    }
    case 'slam': {
      const c = pos.clone().addScaledVector(dir, 1.8);
      setTimeout(() => {
        for (const e of enemies()) if (flatDist(e.pos, c) < 2.8) { weaponHit(e, s.mult()); e.stunT = 1.5; }
        fx.ring(c, 0xffcc88, 2.8, 0.35);
        fx.emit(c.clone().setY(0.2), { count: 40, color: 0xb08a5a, speed: 5, life: 0.7, size: 0.7, gravity: 6, up: 1.5 });
        G.main.shake(0.25);
        sfx('boom');
      }, 280);
      break;
    }
    case 'knives': {
      const n = s.count();
      const spread = 0.9;
      for (let i = 0; i < n; i++) {
        const a = -spread / 2 + (spread * i) / Math.max(1, n - 1);
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const dmg = rollDamage() * s.mult();
        const p = new Projectile(d, dmg, 'enemy', 0xcfd8e0, { trail: 0xaabbcc, size: 0.14, kind: 'phys', speed: 20, blade: true });
        p.root.position.copy(pos).addScaledVector(d, 0.6);
        G.level.add(p);
      }
      sfx('swing');
      break;
    }
    case 'blink': {
      fx.emit(pos.clone().setY(1), { count: 40, color: 0x8844ff, speed: 3, life: 0.6, size: 0.6 });
      P.root.position.set(at.x, 0, at.z);
      fx.emit(at.clone().setY(1), { count: 40, color: 0xaa66ff, speed: 3, life: 0.6, size: 0.6 });
      fx.flash(at, 0x9966ff, 20, 0.3);
      G.main.snapCameraSoft();
      sfx('blink');
      break;
    }
    case 'warcry': {
      G.buffs.warcry = s.dur();
      fx.ring(pos, 0xff4433, 6, 0.6);
      fx.emit(pos.clone().setY(1), { count: 50, color: 0xff6644, speed: 6, life: 0.6, size: 0.6, flat: true });
      for (const e of enemies()) if (flatDist(e.pos, pos) < 6) e.slowT = Math.max(e.slowT, 1.5);
      sfx('buff');
      break;
    }
  }
  return true;
}
