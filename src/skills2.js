// v0.6 skills: 27 spells and 27 combat skills in four new trees (Arcana, Dark Arts, Warfare, Shadow), plus 21 perks
// (see perks.js). Every skill is a small data record handled by one of a few generic effects (bolt, nova, strike,
// zone, cone, chain, buff, summon, dash, melee, ...), so each one has real, distinct behaviour without a case each.
import * as THREE from 'three';
import { G, stat, rollDamage, maxHp, maxMp, critChance, critMult, itemBonus } from './state.js';
import { Projectile, Ally } from './entities.js';
import { flatDist, sfx, pick } from './util.js';
import { petBonus } from './pets.js';
import { zones } from './skills.js';
import { PERKS } from './perks.js';
import { EXTRA } from './icons.js';

const rank = (id) => (G.skills && G.skills[id]) || 0;
const mag = () => stat('mag');
const spellPower = () => (G.buffs.power > 0 ? 1.5 : 1) * (G.buffs.warcry > 0 ? 1.15 : 1) * (1 + 0.08 * rank('elemental')) * (1 + (itemBonus('spell') + petBonus('spell')) / 100);
const enemies = () => G.level.entities.filter((e) => e.type === 'enemy' && !e.dead);
const Y = new THREE.Vector3(0, 1, 0);

// colour (hex number) -> css
const css = (c) => '#' + c.toString(16).padStart(6, '0');

export const SKILLS2 = {};
export const PASSIVES2 = {};
export const TREES2 = [];
const ICONS = {};
export const EXTRA_ICONS = ICONS;

// spell / combat record. o: c [mana base, per rank], cd, anim, d [base, magMul, lvlMul, perRank] (spells) or m [mult, perRank] (weapon skills)
function def(id, name, glyph, color, tree, tier, col, req, kind, o) {
  const w = !!o.m;
  SKILLS2[id] = {
    id, name, icon: id, school: o.school || (w ? 'Combat' : 'Spell'), kind, w, o, tree,
    cost: () => o.c[0] + rank(id) * o.c[1],
    cd: o.cd ?? 0, anim: o.anim || (w ? '1H_Melee_Attack_Slice_Horizontal' : 'Spellcast_Shoot'),
    amt: () => amount(SKILLS2[id]),
    desc: (s) => describe(s),
  };
  ICONS[id] = [glyph, color];
  TREES2.find((t) => t.id === tree).nodes.push({ id, tier, col, ...(req ? { req: Array.isArray(req) ? req : [req] } : {}) });
}
function perk(id, tree, tier, col, req) {
  PASSIVES2[id] = { ...PERKS[id], desc: (r) => Object.entries(PERKS[id].eff).map(([k, v]) => `+${+(v * r).toFixed(1)} ${LBL[k] || k}`).join(', ') + '.' };
  ICONS[PERKS[id].icon] = [PGLYPH[tree], TCOLOR[tree]];
  TREES2.find((t) => t.id === tree).nodes.push({ id, tier, col, ...(req ? { req: Array.isArray(req) ? req : [req] } : {}) });
}
const PGLYPH = { arcana: 'star', dark: 'skull', warfare: 'shield', shadow: 'leaf' };
const TCOLOR = { arcana: '#9db4ff', dark: '#c080f0', warfare: '#f0a070', shadow: '#78e0c0' };
const LBL = { dmg_pct: '% damage', aspd: '% attack speed', dr: '% damage reduction', life_pct: '% life', armor_pct: '% armor', crit_dmg: '% crit damage', crit: '% crit', thorns: '% thorns', dodge: '% dodge', poison: 'poison', move_pct: '% move speed', mana_pct: '% mana', mana_kill: 'mana on kill', spell: '% spell damage', xp_pct: '% experience', mag: 'Magic', regen: 'life/s', light: 'light dmg', leech: '% life steal', pet_pct: '% companion', armor: 'armor', life_kill: 'life on kill', gold_find: '% gold' };

function amount(s) {
  const r = Math.max(1, rank(s.id));
  const o = s.o;
  if (s.w) return o.m[0] * (1 + (o.m[1] ?? 0.2) * (r - 1));
  const [b, mm, lm, p] = o.d;
  return (b + mag() * mm + G.lvl * lm) * (1 + (p ?? 0.28) * (r - 1)) * spellPower();
}
function describe(s) {
  const o = s.o, a = s.amt(), pct = Math.round(a * 100);
  const dmg = s.w ? `${pct}% weapon damage` : `${Math.round(a)} damage`;
  const n = s.kind === 'summon' ? o.count + Math.floor(rank(s.id) / 4) : Math.round(a);
  return o.text.replace(/\{d\}/g, dmg).replace(/\{n\}/g, n).replace(/\{dur\}/g, (o.dur ?? 0) + (o.durPer ? o.durPer * rank(s.id) : 0));
}

function deal(e, s, k = 1, kindOverride) {
  const kind = kindOverride || s.o.kind || 'phys';
  const a = amount(s) * k;
  if (s.w) {
    let d = rollDamage() * a;
    const crit = Math.random() < critChance() + (s.o.crit || 0);
    if (crit) d *= critMult();
    e.takeDamage(d, crit, kind);
    return d;
  }
  e.takeDamage(a, false, kind);
  return a;
}
function healSelf(x) {
  if (x <= 0 || !G.player) return;
  G.hp = Math.min(maxHp(), G.hp + x);
  G.main.floatText(G.player.pos, '+' + Math.round(x), '#66ff88', 18, 2.2);
}
function afflict(e, o, s) {
  if (!e || e.dead) return;
  if (o.slow) e.slowT = Math.max(e.slowT || 0, o.slow);
  if (o.stun) e.stunT = Math.max(e.stunT || 0, o.stun);
  if (o.dot) e.applyDot(amount(s) * o.dot[0], o.dot[1], o.dotKey || 'dot_' + s.id);
  if (o.knock) { const v = e.pos.clone().sub(G.player.pos).setY(0); if (v.lengthSq() > 0.01) { v.normalize(); const np = e.pos.clone().addScaledVector(v, o.knock); if (G.level.walkable(np)) e.root.position.set(np.x, e.root.position.y, np.z); } }
}
const col = (s) => s.o.color;
function burst(fx, p, s, n = 30, size = 0.7) { fx.emit(p.clone().setY(0.5), { count: n, color: col(s), speed: 5, life: 0.6, size, gravity: 3, up: 1.5 }); }

// -------------------------------------------------------------------- effects
export function castNew(id, ctx) {
  const s = SKILLS2[id];
  if (!s) return false;
  const { P, fx, pos, dir, at } = ctx;
  const o = s.o;
  const kind = o.kind || 'phys';
  switch (s.kind) {
    case 'bolt': {
      const n = o.n || 1, spread = o.spread || 0.5;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
        const d = dir.clone().applyAxisAngle(Y, a);
        const dm = s.w ? rollDamage() * amount(s) : amount(s);
        const p = new Projectile(d, dm, 'enemy', o.color, {
          trail: o.color, kind, size: o.size || 0.22, speed: o.speed || 17, pierce: !!o.pierce, life: o.life || 1.2, blade: !!o.blade,
          onHit: (e) => {
            e.takeDamage(dm, false, kind);
            afflict(e, o, s);
            if (o.heal) healSelf(dm * o.heal);
            if (o.splash) for (const q of enemies()) if (q !== e && flatDist(q.pos, e.pos) < o.splash) q.takeDamage(dm * 0.6, false, kind);
            if (o.splash) { fx.explosion(e.pos, o.color, 1.4); }
          },
        });
        p.root.position.copy(pos).addScaledVector(d, 0.7);
        G.level.add(p);
      }
      sfx(o.sfx || 'fire');
      break;
    }
    case 'nova': {
      const r = o.r;
      let hits = 0;
      for (const e of enemies()) if (flatDist(e.pos, pos) < r) { deal(e, s); afflict(e, o, s); hits++; }
      if (o.heal) healSelf(amount(s) * o.heal * Math.min(hits, 5));
      if (o.selfPct) { G.hp = Math.max(1, G.hp - maxHp() * o.selfPct); G.main.hurtFlash?.(0.1); }
      if (G.pet && o.petHeal) G.pet.hp = Math.min(G.pet.maxHp, G.pet.hp + amount(s) * 0.6);
      fx.ring(pos, o.color, r, 0.5);
      fx.emit(pos.clone().setY(0.5), { count: 70, color: o.color, speed: r * 1.5, life: 0.6, size: 0.6, flat: true });
      fx.flash(pos, o.color, 30, 0.45);
      G.main.shake(o.shake || 0.2);
      sfx(o.sfx || 'nova');
      break;
    }
    case 'strike': { // delayed hit(s) at the cursor
      const n = o.n || 1;
      for (let k = 0; k < n; k++) {
        const c = n === 1 ? at.clone() : at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * o.r, 0, (Math.random() - 0.5) * 2 * o.r));
        fx.ring(c, o.color, o.r, 0.4 + k * 0.08);
        setTimeout(() => {
          if (!G.level) return;
          let hits = 0;
          for (const e of enemies()) if (flatDist(e.pos, c) < o.r) { deal(e, s); afflict(e, o, s); hits++; }
          if (o.heal && hits) healSelf(amount(s) * o.heal * Math.min(hits, 4));
          fx.explosion(c, o.color, o.r * 0.6);
          if (o.beam) fx.beam(c.clone().setY(10), c.clone().setY(0.2), o.color, 0.25);
          fx.flash(c, o.color, 25, 0.3);
          G.main.shake(0.15 + (o.shake || 0));
          sfx(o.sfx || 'boom');
        }, (o.delay ?? 0.4) * 1000 + k * 140);
      }
      sfx('nova');
      break;
    }
    case 'zone': { // lingering ground effect at the cursor
      const c = at.clone();
      const dur = o.dur + (o.durPer || 0) * rank(id);
      fx.ring(c, o.color, o.r, 0.6);
      zones.push({ t: 0, acc: 0, every: o.every || 0.5, dur,
        tick: () => {
          let inside = false;
          for (const e of enemies()) if (flatDist(e.pos, c) < o.r) { if (o.dmg !== 0) deal(e, s, o.tickMul || 1); afflict(e, o, s); }
          if (G.player && flatDist(G.player.pos, c) < o.r) { inside = true; if (o.heal) healSelf(maxHp() * o.heal); }
          fx.ring(c, o.color, o.r, 0.5);
        },
        vis: () => { for (let k = 0; k < (o.vis || 3); k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * o.r; fx.emit(new THREE.Vector3(c.x + Math.cos(a) * r, o.rain ? 7 : 0.3, c.z + Math.sin(a) * r), { count: 1, color: o.color, speed: o.rain ? 0 : 0.5, rise: o.rain ? -10 : 1.2, life: o.rain ? 0.6 : 0.8, size: 0.7 }); } },
      });
      fx.flash(c, o.color, 22, 0.4);
      sfx(o.sfx || 'blink');
      break;
    }
    case 'rainzone': { // random strikes in an area for a while (Starfall, Hellfire)
      const c = at.clone();
      const dur = o.dur + (o.durPer || 0) * rank(id);
      fx.ring(c, o.color, o.r, 0.7);
      zones.push({ t: 0, acc: 0, every: o.every || 0.3, dur,
        tick: () => {
          const list = enemies().filter((e) => flatDist(e.pos, c) < o.r);
          const tgt = list.length && Math.random() < 0.7 ? pick(list) : null;
          const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * o.r;
          const p = tgt ? tgt.pos.clone() : new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
          fx.beam(p.clone().setY(9), p.clone().setY(0.2), o.color, 0.18);
          fx.explosion(p, o.color, 1.2);
          for (const e of enemies()) if (flatDist(e.pos, p) < (o.hitR || 2)) { deal(e, s); afflict(e, o, s); }
          sfx(o.sfx || 'boom');
        } });
      G.main.shake(0.2);
      sfx('buff');
      break;
    }
    case 'cone': {
      const range = o.range, cosA = Math.cos((o.arc || 1.2) / 2);
      for (const e of enemies()) {
        const v = e.pos.clone().sub(pos).setY(0), d = v.length();
        if (d < range && d > 0.01 && v.normalize().dot(dir) > cosA) { deal(e, s); afflict(e, o, s); }
      }
      for (let k = 0; k < 60; k++) {
        const a = (Math.random() - 0.5) * (o.arc || 1.2), r = 0.8 + Math.random() * (range - 0.8);
        fx.emit(pos.clone().addScaledVector(dir.clone().applyAxisAngle(Y, a), r).setY(0.9), { count: 1, color: o.color, speed: 1, rise: 1, life: 0.5, size: 0.8 });
      }
      fx.flash(pos.clone().addScaledVector(dir, range * 0.5), o.color, 28, 0.35);
      if (o.beamFx) fx.beam(pos.clone().setY(1.2), pos.clone().addScaledVector(dir, range).setY(0.8), o.color, 0.3);
      G.main.shake(0.15);
      sfx(o.sfx || 'fire');
      break;
    }
    case 'chain': {
      const list = enemies();
      let cur = ctx.targetEnt && ctx.targetEnt.type === 'enemy' && !ctx.targetEnt.dead ? ctx.targetEnt : null;
      if (!cur) { let bd = 9; for (const e of list) { const d = flatDist(e.pos, at); if (d < bd && flatDist(e.pos, pos) < 14) { bd = d; cur = e; } } }
      let from = pos.clone().setY(1.2);
      const hit = new Set();
      for (let j = 0; j <= o.jumps + Math.floor(rank(id) / 3) && cur; j++) {
        const to = cur.pos.clone().setY(1);
        fx.beam(from, to, o.color);
        const dd = deal(cur, s, 1 - j * 0.07); afflict(cur, o, s);
        if (o.heal) healSelf(dd * o.heal);
        hit.add(cur); from = to;
        let nb = null, bd = 7;
        for (const e of list) if (!hit.has(e) && !e.dead) { const d = flatDist(e.pos, cur.pos); if (d < bd) { bd = d; nb = e; } }
        cur = nb;
      }
      fx.flash(pos, o.color, 22, 0.3);
      sfx('zap');
      break;
    }
    case 'buff': {
      G.buffs[o.buff] = (o.dur || 10) + (o.durPer || 0) * rank(id);
      if (o.instantHeal) healSelf(maxHp() * o.instantHeal);
      fx.ring(pos, o.color, 3, 0.6);
      fx.emit(pos.clone().setY(1), { count: 50, color: o.color, speed: 3, life: 0.9, size: 0.6, rise: 2, spread: 1 });
      fx.flash(pos, o.color, 25, 0.5);
      if (o.slowNear) for (const e of enemies()) if (flatDist(e.pos, pos) < o.slowNear) e.slowT = Math.max(e.slowT || 0, 2);
      G.main.invalidateStats?.();
      sfx('buff');
      break;
    }
    case 'summon': {
      const n = o.count + Math.floor(rank(id) / 4);
      for (let i = 0; i < n; i++) {
        const a = new Ally();
        a.life = o.life || 25;
        a.maxHp = a.maxHp * (o.hpMul || 1); a.hp = a.maxHp;
        const p = pos.clone().add(new THREE.Vector3(Math.cos(i * 2.4) * 1.6, 0, Math.sin(i * 2.4) * 1.6));
        a.root.position.copy(G.level.walkable(p) ? p : pos);
        G.level.add(a);
        fx.emit(a.root.position.clone().setY(0.3), { count: 30, color: o.color, speed: 2, life: 1, size: 0.5, rise: 1.5 });
      }
      sfx('buff');
      break;
    }
    case 'dash': { // charge through foes, or leap and slam
      const dist = Math.min(o.dist, Math.max(2, flatDist(at, pos)));
      const to = pos.clone().addScaledVector(dir, dist);
      const end = G.level.walkable(to) ? to : pos.clone().addScaledVector(dir, dist * 0.5);
      if (o.path) for (const e of enemies()) {
        const v = e.pos.clone().sub(pos).setY(0), along = v.dot(dir);
        if (along > -0.5 && along < dist + 0.5 && v.sub(dir.clone().multiplyScalar(along)).length() < (o.width || 1.6)) { deal(e, s); afflict(e, o, s); }
      }
      fx.emit(pos.clone().setY(1), { count: 40, color: o.color, speed: 3, life: 0.5, size: 0.6 });
      P.root.position.set(end.x, 0, end.z);
      G.main.snapCameraSoft();
      if (o.land) {
        for (const e of enemies()) if (flatDist(e.pos, end) < o.r) { deal(e, s); afflict(e, o, s); }
        fx.ring(end, o.color, o.r, 0.4); burst(fx, end, s, 36); G.main.shake(0.3);
      }
      if (o.buff) G.buffs[o.buff] = o.buffDur || 3;
      fx.flash(end, o.color, 24, 0.3);
      sfx(o.land ? 'boom' : 'blink');
      break;
    }
    case 'melee': { // a heavy hit on the best foe near the cursor
      let tgt = ctx.targetEnt && ctx.targetEnt.type === 'enemy' && !ctx.targetEnt.dead ? ctx.targetEnt : null;
      if (!tgt) { let bd = 5; for (const e of enemies()) { const d = flatDist(e.pos, at); if (d < bd && flatDist(e.pos, pos) < 12) { bd = d; tgt = e; } } }
      if (!tgt) { fx.ring(pos.clone().addScaledVector(dir, 1.5), o.color, 1.5, 0.3); sfx('swing'); break; }
      if (o.tp) { const back = tgt.pos.clone().addScaledVector(dir, 1.3); if (G.level.walkable(back)) { fx.emit(pos.clone().setY(1), { count: 30, color: o.color, speed: 3, life: 0.5, size: 0.6 }); P.root.position.set(back.x, 0, back.z); P.face(tgt.pos); G.main.snapCameraSoft(); } }
      const hits = o.hits || 1;
      for (let h = 0; h < hits; h++) setTimeout(() => {
        if (!tgt || tgt.dead || !G.level) return;
        let k = 1;
        if (o.lowHp && tgt.hp / tgt.maxHp < o.lowHp) k = o.lowMul;
        if (o.bossCap && tgt.boss) k = Math.min(k, 1.5);
        deal(tgt, s, k / hits ** 0.5); afflict(tgt, o, s);
        fx.emit(tgt.pos.clone().setY(1), { count: 14, color: o.color, speed: 4, life: 0.4, size: 0.5 });
        sfx('swing');
        if (h === hits - 1) { fx.flash(tgt.pos, o.color, 20, 0.25); G.main.shake(0.15); }
      }, h * (o.gap || 120));
      if (o.splash) for (const e of enemies()) if (e !== tgt && flatDist(e.pos, tgt.pos) < o.splash) { deal(e, s, 0.5); afflict(e, o, s); }
      break;
    }
    case 'spin': { // whirling blades that hit around you repeatedly
      const ticks = o.ticks, every = o.every;
      P.spinT = ticks * every;
      let n = 0;
      const tick = () => {
        if (!G.player || G.player.dead || !G.level) return;
        for (const e of enemies()) if (flatDist(e.pos, G.player.pos) < o.r) { deal(e, s); afflict(e, o, s); }
        fx.ring(G.player.pos, o.color, o.r, 0.2); fx.emit(G.player.pos.clone().setY(0.9), { count: 14, color: o.color, speed: 6, life: 0.3, size: 0.4, flat: true });
        sfx('swing');
        if (++n < ticks) setTimeout(tick, every * 1000);
      };
      tick();
      break;
    }
    case 'line': { // shockwave rolling forward
      for (let w = 0; w < 4; w++) setTimeout(() => {
        if (!G.level) return;
        const c = pos.clone().addScaledVector(dir, 2 + w * 2.2);
        for (const e of enemies()) if (flatDist(e.pos, c) < o.r) { deal(e, s); afflict(e, o, s); }
        fx.ring(c, o.color, o.r, 0.35); burst(fx, c, s, 16, 0.6); G.main.shake(0.15); sfx('boom');
      }, w * 110);
      break;
    }
    case 'trap': { // a hidden trap that goes off when a foe steps near, or after a few seconds
      const c = at.clone();
      fx.ring(c, o.color, 0.9, 0.5);
      zones.push({ t: 0, acc: 0, every: 0.15, dur: 8,
        tick: function () {
          if (this.fired) return;
          if (enemies().some((e) => flatDist(e.pos, c) < 1.6)) {
            this.fired = true; this.t = 99;
            for (const e of enemies()) if (flatDist(e.pos, c) < o.r) { deal(e, s); afflict(e, o, s); }
            fx.explosion(c, o.color, o.r * 0.7); fx.ring(c, o.color, o.r, 0.4); G.main.shake(0.25); sfx('boom');
          }
        },
        vis: () => { fx.emit(c.clone().setY(0.1), { count: 1, color: o.color, speed: 0.2, life: 0.5, size: 0.4 }); } });
      sfx('blink');
      break;
    }
    case 'barrage': { // many quick strikes on nearby foes
      const near = enemies().filter((e) => flatDist(e.pos, pos) < (o.r || 5)).sort((a, b) => flatDist(a.pos, pos) - flatDist(b.pos, pos));
      const n = o.hits;
      for (let h = 0; h < n; h++) setTimeout(() => {
        const t = near.length ? near[h % Math.min(near.length, 3)] : null;
        if (!t || t.dead || !G.level) return;
        deal(t, s); afflict(t, o, s);
        fx.emit(t.pos.clone().setY(1), { count: 8, color: o.color, speed: 4, life: 0.3, size: 0.4 });
        sfx('swing');
      }, h * 90);
      if (!near.length) { fx.ring(pos, o.color, 1.5, 0.3); }
      break;
    }
    default: return false;
  }
  return true;
}

// -------------------------------------------------------------------- the four trees
TREES2.push(
  { id: 'arcana', name: 'Arcana', color: '#7aa8ff', nodes: [] },
  { id: 'dark', name: 'Dark Arts', color: '#b060e0', nodes: [] },
  { id: 'warfare', name: 'Warfare', color: '#e8825a', nodes: [] },
  { id: 'shadow', name: 'Shadow', color: '#58c8a0', nodes: [] },
);
const A = 0x9db4ff, HOLY = 0xffe9a0, DK = 0xb060e0, BLD = 0xd02a3a, STEEL = 0xdfe6ee;

// ---- Arcana: 14 spells
def('arcane_missile', 'Arcane Missile', 'orb', css(A), 'arcana', 0, 0, null, 'bolt', { c: [3, 0.6], cd: 0, d: [5, 0.9, 1.3], kind: 'arcane', color: A, speed: 24, size: 0.16, text: 'A fast missile of raw arcane power for {d}. Cheap and rapid.' });
perk('mana_font', 'arcana', 0, 1);
perk('spell_weaving', 'arcana', 0, 2);
def('holy_bolt', 'Holy Bolt', 'cross', css(HOLY), 'arcana', 0, 3, null, 'bolt', { c: [8, 1], cd: 0.4, d: [8, 1.0, 1.4], kind: 'light', color: HOLY, heal: 0.35, text: 'A bolt of light for {d} that heals you for 35% of the damage it deals.' });
def('magic_barrage', 'Magic Barrage', 'burst', css(A), 'arcana', 1, 0, 'arcane_missile', 'bolt', { c: [14, 1.5], cd: 1.2, d: [4, 0.6, 0.9], kind: 'arcane', color: A, n: 5, spread: 0.9, speed: 20, size: 0.15, text: 'Five missiles fan out, each for {d}.' });
def('mana_shield', 'Mana Shield', 'shield', css(0x6ac8ff), 'arcana', 1, 1, 'mana_font', 'buff', { c: [18, 0], cd: 22, d: [0, 0, 0], kind: 'arcane', color: 0x6ac8ff, buff: 'mana_shield', dur: 10, durPer: 0.6, anim: 'Spellcast_Raise', text: 'Take 35% less damage for {dur} seconds.' });
perk('arcane_precision', 'arcana', 1, 2, 'spell_weaving');
def('smite', 'Smite', 'cross', css(HOLY), 'arcana', 1, 3, 'holy_bolt', 'strike', { c: [14, 1.5], cd: 2.5, d: [14, 1.4, 2.0], kind: 'light', color: HOLY, r: 2.4, delay: 0.35, stun: 1.2, beam: true, anim: 'Spellcast_Long', text: 'A pillar of light falls at the cursor for {d} and stuns foes for 1.2s.' });
def('arcane_orb', 'Arcane Orb', 'orb', css(A), 'arcana', 2, 0, 'magic_barrage', 'zone', { c: [22, 2], cd: 3, d: [6, 0.7, 1.1], kind: 'arcane', color: A, r: 3.2, dur: 4, durPer: 0.2, every: 0.3, vis: 5, anim: 'Spellcast_Long', text: 'An orb of arcane energy hovers at the cursor for {dur}s, searing foes in it for {d} every 0.3s.' });
def('time_warp', 'Time Warp', 'vortex', css(0x8ad0ff), 'arcana', 2, 1, 'mana_shield', 'zone', { c: [24, 1], cd: 16, d: [3, 0.3, 0.5], kind: 'arcane', color: 0x8ad0ff, r: 5, dur: 5, durPer: 0.3, every: 0.4, slow: 2.2, anim: 'Spellcast_Raise', text: 'A bubble of slowed time at the cursor for {dur}s: foes inside crawl and take {d} per pulse.' });
def('force_wave', 'Force Wave', 'wave', css(A), 'arcana', 2, 2, 'arcane_precision', 'cone', { c: [14, 1], cd: 3, d: [12, 1.3, 1.8], kind: 'arcane', color: A, range: 8, arc: 1.7, knock: 3.5, stun: 0.6, anim: 'Spellcast_Raise', text: 'A wide wave of force hurls foes back and deals {d}.' });
def('consecrate', 'Consecrate', 'cross', css(HOLY), 'arcana', 2, 3, 'smite', 'zone', { c: [26, 2], cd: 14, d: [5, 0.7, 1.0], kind: 'light', color: HOLY, r: 4, dur: 7, durPer: 0.3, every: 0.5, heal: 0.015, anim: 'Spellcast_Long', text: 'Holy ground at the cursor for {dur}s burns foes for {d} twice a second and heals you while you stand in it.' });
def('starfall', 'Starfall', 'star', css(0xc8d4ff), 'arcana', 3, 0, 'arcane_orb', 'rainzone', { c: [42, 3], cd: 14, d: [14, 1.3, 2.0], kind: 'arcane', color: 0xc8d4ff, r: 6, dur: 4, durPer: 0.25, every: 0.28, hitR: 2.2, anim: 'Spellcast_Long', text: 'Stars rain down on the area around the cursor for {dur}s, each exploding for {d}.' });
perk('sages_insight', 'arcana', 3, 1, 'time_warp');
def('radiant_nova', 'Radiant Nova', 'ring', css(HOLY), 'arcana', 3, 2, 'force_wave', 'nova', { c: [26, 2], cd: 6, d: [12, 1.2, 1.7], kind: 'light', color: HOLY, r: 6, heal: 0.12, petHeal: true, anim: 'Spellcast_Raise', text: 'A burst of light for {d} that heals you for each foe hit and mends your companion.' });
perk('radiant_soul', 'arcana', 3, 3, 'consecrate');
def('mirror_guards', 'Mirror Guards', 'wings', css(0xbfd4ff), 'arcana', 4, 0, 'starfall', 'summon', { c: [40, 2], cd: 30, d: [0, 0, 0], kind: 'arcane', color: 0xbfd4ff, count: 2, life: 28, hpMul: 1.3, anim: 'Spellcast_Raise', text: 'Summons {n} spectral guardians to fight at your side for about 30 seconds.' });
def('sunbeam', 'Sunbeam', 'sun', css(HOLY), 'arcana', 4, 2, 'radiant_nova', 'cone', { c: [38, 3], cd: 7, d: [24, 2.2, 3.2], kind: 'light', color: HOLY, range: 11, arc: 0.45, beamFx: true, anim: 'Spellcast_Long', text: 'A searing beam of sunlight cuts a long line for {d}.' });
def('divine_shield', 'Divine Shield', 'shield', css(HOLY), 'arcana', 4, 3, 'radiant_soul', 'buff', { c: [50, 0], cd: 60, d: [0, 0, 0], kind: 'light', color: HOLY, buff: 'divine', dur: 4, durPer: 0.25, instantHeal: 0.25, anim: 'Cheer', text: 'Become nearly untouchable for {dur} seconds (75% less damage) and restore 25% life.' });

// ---- Dark Arts: 13 spells
def('shadow_bolt', 'Shadow Bolt', 'orb', css(DK), 'dark', 0, 0, null, 'bolt', { c: [5, 1], cd: 0, d: [7, 1.0, 1.4], kind: 'dark', color: DK, heal: 0.15, speed: 18, text: 'A bolt of shadow for {d}. You recover 15% of the damage as life.' });
perk('deathly_pact', 'dark', 0, 1);
perk('curse_mastery', 'dark', 0, 2);
def('bone_spear', 'Bone Spear', 'spear', css(0xe8e0c8), 'dark', 0, 3, null, 'bolt', { c: [10, 1], cd: 1.2, d: [14, 1.5, 2.1], kind: 'phys', color: 0xe8e0c8, pierce: true, speed: 24, size: 0.2, text: 'A spear of bone pierces every foe in a line for {d}.' });
def('drain_life', 'Drain Life', 'drop', css(BLD), 'dark', 1, 0, 'shadow_bolt', 'strike', { c: [16, 1.5], cd: 4, d: [12, 1.2, 1.7], kind: 'dark', color: BLD, r: 3, delay: 0.25, heal: 0.18, anim: 'Spellcast_Raise', text: 'Tear the life out of foes at the cursor for {d} and heal for 18% of it per foe (up to four).' });
perk('soul_harvest', 'dark', 1, 1, 'deathly_pact');
def('wither', 'Wither', 'skull', css(0x7a9a4a), 'dark', 1, 2, 'curse_mastery', 'zone', { c: [20, 1.5], cd: 8, d: [4, 0.5, 0.8], kind: 'dark', color: 0x7a9a4a, r: 4, dur: 6, durPer: 0.3, every: 0.5, slow: 1.2, dot: [0.4, 2], anim: 'Spellcast_Long', text: 'A rotting curse over the area at the cursor for {dur}s: foes decay for {d} per pulse and are slowed.' });
def('plague_wave', 'Plague Wave', 'wave', css(0x9ad040), 'dark', 1, 3, 'bone_spear', 'nova', { c: [22, 2], cd: 5, d: [8, 0.9, 1.3], kind: 'poison', color: 0x9ad040, r: 6, dot: [0.5, 4], anim: 'Spellcast_Raise', text: 'A wave of pestilence for {d} that poisons all foes in range for four seconds.' });
def('soul_siphon', 'Soul Siphon', 'wisp', css(0x9a6ae0), 'dark', 2, 0, 'drain_life', 'chain', { c: [22, 2], cd: 1.6, d: [9, 1.0, 1.5], kind: 'dark', color: 0x9a6ae0, jumps: 2, heal: 0.25, text: 'Siphon souls between several foes for {d} each, healing for 25% of the damage.' });
perk('bone_armor', 'dark', 2, 1, 'soul_harvest');
def('fear', 'Fear', 'eye', css(0xd0b0f0), 'dark', 2, 2, 'wither', 'nova', { c: [20, 1], cd: 12, d: [3, 0.4, 0.6], kind: 'dark', color: 0xd0b0f0, r: 6.5, stun: 2.2, slow: 3, anim: 'Spellcast_Raise', text: 'A terrifying shriek: foes in range freeze in terror for 2s and take {d}.' });
def('blood_boil', 'Blood Boil', 'drop', css(BLD), 'dark', 2, 3, 'plague_wave', 'nova', { c: [10, 0.5], cd: 7, d: [26, 2.4, 3.4], kind: 'dark', color: BLD, r: 5.5, selfPct: 0.08, shake: 0.3, anim: 'Spellcast_Raise', text: 'Boil your own blood, losing 8% life, to erupt for {d} around you.' });
def('corpse_burst', 'Corpse Burst', 'skull', css(0xe8c8a0), 'dark', 3, 0, 'soul_siphon', 'strike', { c: [32, 2], cd: 8, d: [30, 2.6, 3.6], kind: 'dark', color: 0xe8c8a0, r: 4.2, delay: 0.5, stun: 0.8, shake: 0.3, anim: 'Spellcast_Long', text: 'Detonate a burst of bone and gore at the cursor for {d}.' });
perk('dread_presence', 'dark', 3, 1, 'bone_armor');
def('void_rift', 'Void Rift', 'vortex', css(0x5a2a9a), 'dark', 3, 2, 'fear', 'zone', { c: [34, 2], cd: 12, d: [10, 1.1, 1.6], kind: 'dark', color: 0x5a2a9a, r: 4.5, dur: 5, durPer: 0.3, every: 0.4, slow: 2.5, anim: 'Spellcast_Long', text: 'Tear open a rift at the cursor for {dur}s: foes inside are crushed for {d} per pulse and nearly stopped.' });
def('hellfire', 'Hellfire', 'flame', css(0xff4a1a), 'dark', 3, 3, 'blood_boil', 'rainzone', { c: [44, 3], cd: 15, d: [16, 1.4, 2.1], kind: 'fire', color: 0xff4a1a, r: 6, dur: 4, durPer: 0.25, every: 0.3, hitR: 2.2, dot: [0.3, 3], anim: 'Spellcast_Long', text: 'Fire from below the world rains over the area for {dur}s, each strike for {d} and setting foes ablaze.' });
def('raise_horror', 'Raise Horror', 'skull', css(0x9aff9a), 'dark', 4, 1, 'dread_presence', 'summon', { c: [40, 2], cd: 24, d: [0, 0, 0], kind: 'dark', color: 0x9aff9a, count: 2, life: 34, hpMul: 1.8, anim: 'Spellcast_Raise', text: 'Raises {n} hulking undead horrors to fight for you for about 34 seconds.' });
def('unholy_frenzy', 'Unholy Frenzy', 'flame', css(0xc040ff), 'dark', 4, 2, 'void_rift', 'buff', { c: [30, 0], cd: 40, d: [0, 0, 0], kind: 'dark', color: 0xc040ff, buff: 'frenzy', dur: 12, durPer: 0.8, anim: 'Cheer', text: '+25% attack speed, +20% damage and 5% life steal for {dur} seconds.' });

// ---- Warfare: 14 combat skills
def('cleave', 'Cleave', 'blade', css(STEEL), 'warfare', 0, 0, null, 'cone', { c: [6, 0.5], cd: 0.9, m: [1.15, 0.2], kind: 'phys', color: STEEL, range: 3.6, arc: 2.0, anim: '1H_Melee_Attack_Slice_Horizontal', text: 'A wide sweep hits every foe in front of you for {d}.' });
perk('berserker_rage', 'warfare', 0, 1);
perk('unyielding', 'warfare', 0, 2);
def('shield_bash', 'Shield Bash', 'shield', css(STEEL), 'warfare', 0, 3, null, 'melee', { c: [8, 0.5], cd: 4, m: [1.0, 0.18], kind: 'phys', color: STEEL, stun: 2.2, knock: 1.5, anim: '1H_Melee_Attack_Chop', text: 'Slam the foe at the cursor for {d}, stunning for 2.2s and shoving it back.' });
def('leap_strike', 'Leap Strike', 'wings', css(0xe8c070), 'warfare', 1, 0, 'cleave', 'dash', { c: [12, 1], cd: 7, m: [1.4, 0.22], kind: 'phys', color: 0xe8c070, dist: 9, land: true, r: 3.4, stun: 1.0, anim: '2H_Melee_Attack_Chop', text: 'Leap to the cursor and crash down for {d} to everything around the landing, stunning for 1s.' });
perk('battle_hardened', 'warfare', 1, 1, 'berserker_rage');
def('bulwark', 'Bulwark', 'shield', css(0x9ab0c8), 'warfare', 1, 2, 'unyielding', 'buff', { c: [14, 0], cd: 24, m: [0, 0], color: 0x9ab0c8, buff: 'bulwark', dur: 8, durPer: 0.6, slowNear: 5, anim: 'Cheer', text: '+60% armor and 25% less damage for {dur} seconds. Nearby foes are slowed.' });
def('rend', 'Rend', 'claw', css(BLD), 'warfare', 1, 3, 'shield_bash', 'melee', { c: [8, 0.7], cd: 3, m: [0.9, 0.18], kind: 'phys', color: BLD, dot: [0.5, 6], anim: '1H_Melee_Attack_Stab', text: 'A savage cut for {d} that bleeds the foe for heavy damage over 6s.' });
def('charge', 'Charge', 'wings', css(0xe8a050), 'warfare', 2, 0, 'leap_strike', 'dash', { c: [14, 1], cd: 8, m: [1.2, 0.2], kind: 'phys', color: 0xe8a050, dist: 10, path: true, width: 1.8, stun: 1.2, knock: 1.5, anim: '2H_Melee_Attack_Chop', text: 'Barrel forward, striking everything in your path for {d} and stunning for 1.2s.' });
def('rampage', 'Rampage', 'flame', css(0xff6a30), 'warfare', 2, 1, 'battle_hardened', 'buff', { c: [18, 0], cd: 40, m: [0, 0], color: 0xff6a30, buff: 'rampage', dur: 10, durPer: 0.6, anim: 'Cheer', text: '+30% attack speed, +25% damage and +15% move speed for {dur} seconds.' });
perk('executioner', 'warfare', 2, 2, 'bulwark');
def('skullsplitter', 'Skullsplitter', 'skull', css(STEEL), 'warfare', 2, 3, 'rend', 'melee', { c: [12, 1], cd: 6, m: [2.2, 0.28], kind: 'phys', color: STEEL, stun: 1.5, crit: 0.25, anim: '2H_Melee_Attack_Chop', text: 'A crushing overhead blow for {d} with a heavy chance to crit. Stuns for 1.5s.' });
def('ground_pound', 'Ground Pound', 'fist', css(0xc8a070), 'warfare', 3, 0, 'charge', 'nova', { c: [18, 1.5], cd: 6, m: [1.6, 0.22], kind: 'phys', color: 0xc8a070, r: 4.6, stun: 1.5, shake: 0.35, anim: '2H_Melee_Attack_Chop', text: 'Pound the ground for {d} to all foes around you and stun them for 1.5s.' });
def('bloodlust', 'Bloodlust', 'drop', css(BLD), 'warfare', 3, 1, 'rampage', 'buff', { c: [16, 0], cd: 30, m: [0, 0], color: BLD, buff: 'bloodlust', dur: 12, durPer: 0.8, anim: 'Cheer', text: 'Heal for 9% of damage dealt and deal 15% more damage for {dur} seconds.' });
perk('thorned_hide', 'warfare', 3, 2, 'executioner');
def('execute', 'Execute', 'axe', css(0xff3a3a), 'warfare', 3, 3, 'skullsplitter', 'melee', { c: [14, 1], cd: 7, m: [1.6, 0.25], kind: 'phys', color: 0xff3a3a, lowHp: 0.35, lowMul: 3, bossCap: true, anim: '2H_Melee_Attack_Chop', text: 'A finishing blow for {d}, tripled against foes below 35% life.' });
def('seismic_strike', 'Seismic Strike', 'quake', css(0xd09050), 'warfare', 4, 0, 'ground_pound', 'line', { c: [24, 2], cd: 7, m: [1.5, 0.22], kind: 'phys', color: 0xd09050, r: 2.2, stun: 0.8, anim: '2H_Melee_Attack_Chop', text: 'Drive your weapon into the earth and send a shockwave rolling forward, hitting for {d}.' });
def('blade_storm', 'Blade Storm', 'whirl', css(STEEL), 'warfare', 4, 1, 'bloodlust', 'spin', { c: [32, 2], cd: 14, m: [0.8, 0.18], kind: 'phys', color: STEEL, r: 3.4, ticks: 7, every: 0.24, anim: '2H_Melee_Attack_Spin', text: 'Become a whirl of steel for 1.7s, hitting everything near you seven times for {d} each.' });
def('last_stand', 'Last Stand', 'shield', css(0xffd070), 'warfare', 4, 2, 'thorned_hide', 'buff', { c: [20, 0], cd: 90, m: [0, 0], color: 0xffd070, buff: 'laststand', dur: 8, durPer: 0.5, instantHeal: 0.3, anim: 'Cheer', text: 'Recover 30% life now, then regenerate 22 life per second and take 30% less damage for {dur} seconds.' });

// ---- Shadow: 13 combat skills (+ perks)
def('backstab', 'Backstab', 'blade', css(0xcfd8e0), 'shadow', 0, 0, null, 'melee', { c: [8, 0.6], cd: 4, m: [1.7, 0.25], kind: 'phys', color: 0xcfd8e0, tp: true, crit: 0.3, anim: '1H_Melee_Attack_Stab', text: 'Slip behind the foe at the cursor and stab for {d}, with a high chance to crit.' });
perk('nimble', 'shadow', 0, 1);
perk('poisoners_craft', 'shadow', 0, 2);
def('poison_dart', 'Poison Dart', 'leaf', css(0x8ae040), 'shadow', 0, 3, null, 'bolt', { c: [4, 0.5], cd: 0.2, m: [0.55, 0.15], kind: 'poison', color: 0x8ae040, speed: 26, size: 0.12, dot: [0.35, 4], anim: 'Throw', sfx: 'swing', text: 'A swift dart for {d} that also poisons for four seconds.' });
def('shadow_strike', 'Shadow Strike', 'wings', css(0x58c8a0), 'shadow', 1, 0, 'backstab', 'dash', { c: [12, 1], cd: 6, m: [1.3, 0.22], kind: 'phys', color: 0x58c8a0, dist: 8, path: true, width: 1.4, anim: 'Dodge_Forward', text: 'Dash through foes in a line, slashing each for {d}.' });
perk('shadow_veil', 'shadow', 1, 1, 'nimble');
def('caltrops', 'Caltrops', 'spike', css(0xb0b8c0), 'shadow', 1, 2, 'poisoners_craft', 'zone', { c: [12, 1], cd: 8, m: [0.35, 0.1], kind: 'phys', color: 0xb0b8c0, r: 3.6, dur: 6, durPer: 0.3, every: 0.5, slow: 1.4, anim: 'Throw', text: 'Scatter spikes at the cursor for {dur}s: foes in the area are slowed and cut for {d} per pulse.' });
def('throwing_axes', 'Throwing Axes', 'axe', css(STEEL), 'shadow', 1, 3, 'poison_dart', 'bolt', { c: [12, 1], cd: 1.1, m: [0.8, 0.18], kind: 'phys', color: STEEL, n: 3, spread: 0.5, pierce: true, speed: 17, blade: true, anim: 'Throw', sfx: 'swing', text: 'Hurl three heavy axes that pass through foes, each for {d}.' });
def('eviscerate', 'Eviscerate', 'claw', css(BLD), 'shadow', 2, 0, 'shadow_strike', 'melee', { c: [14, 1], cd: 6, m: [2.0, 0.28], kind: 'phys', color: BLD, hits: 3, gap: 130, dot: [0.4, 5], crit: 0.2, anim: '1H_Melee_Attack_Stab', text: 'Three vicious slashes for {d} in all, leaving the foe bleeding.' });
def('evasion', 'Evasion', 'wings', css(0x78e0c0), 'shadow', 2, 1, 'shadow_veil', 'buff', { c: [12, 0], cd: 24, m: [0, 0], color: 0x78e0c0, buff: 'evasion', dur: 8, durPer: 0.5, anim: 'Cheer', text: '+40% dodge and +20% move speed for {dur} seconds.' });
def('hamstring', 'Hamstring', 'claw', css(0xc08060), 'shadow', 2, 2, 'caltrops', 'melee', { c: [8, 0.7], cd: 5, m: [0.8, 0.16], kind: 'phys', color: 0xc08060, slow: 4, dot: [0.3, 4], splash: 2, anim: '1H_Melee_Attack_Slice_Horizontal', text: 'Cripple the foe at the cursor for {d}, slowing it for 4s and bleeding it.' });
def('spike_trap', 'Spike Trap', 'spike', css(0xe8d070), 'shadow', 2, 3, 'throwing_axes', 'trap', { c: [14, 1], cd: 6, m: [2.0, 0.28], kind: 'phys', color: 0xe8d070, r: 3, stun: 1.2, anim: 'Throw', text: 'Set a hidden trap at the cursor that springs when a foe steps near, hitting for {d} and stunning.' });
def('dagger_flurry', 'Dagger Flurry', 'knives', css(0xcfd8e0), 'shadow', 3, 0, 'eviscerate', 'barrage', { c: [18, 1.5], cd: 5, m: [0.5, 0.12], kind: 'phys', color: 0xcfd8e0, hits: 10, r: 5, anim: 'Dualwield_Melee_Attack_Slice', text: 'A blur of ten fast cuts on nearby foes, each for {d}.' });
perk('cutthroat', 'shadow', 3, 1, 'evasion');
def('shadow_clone', 'Shadow Clone', 'wisp', css(0x40a080), 'shadow', 3, 2, 'hamstring', 'summon', { c: [26, 1.5], cd: 24, m: [0, 0], color: 0x40a080, count: 1, life: 20, hpMul: 1.5, anim: 'Spellcast_Raise', text: 'Summon {n} shadow clone to fight for you for 20 seconds.' });
def('pounce', 'Pounce', 'wings', css(0x58c8a0), 'shadow', 3, 3, 'spike_trap', 'dash', { c: [14, 1], cd: 6, m: [1.7, 0.24], kind: 'phys', color: 0x58c8a0, dist: 10, land: true, r: 2.8, stun: 0.8, crit: 0.2, anim: '1H_Melee_Attack_Stab', text: 'Spring to the cursor and strike everything there for {d}.' });
def('vanish', 'Vanish', 'smoke', css(0x606878), 'shadow', 4, 1, 'cutthroat', 'buff', { c: [24, 0], cd: 30, m: [0, 0], color: 0x606878, buff: 'vanish', dur: 5, durPer: 0.4, slowNear: 4, anim: 'Cheer', text: '+60% dodge, +30% move speed and +20% crit for {dur} seconds. Nearby foes are slowed.' });
perk('quick_hands', 'shadow', 4, 2, 'shadow_clone');
perk('scavenger', 'shadow', 4, 3, 'pounce');

export const NEW_SKILL_IDS = [...Object.keys(SKILLS2), ...Object.keys(PASSIVES2)];
export const NEW_COUNTS = { spells: Object.values(SKILLS2).filter((s) => !s.w).length, combat: Object.values(SKILLS2).filter((s) => s.w).length, perks: Object.keys(PASSIVES2).length };

// ---- icons: a small set of glyphs drawn in the skill's colour
const GLYPHS = {
  orb: (c) => `<circle cx="32" cy="32" r="16" fill="${c}"/><circle cx="27" cy="26" r="5" fill="#fff" opacity="0.7"/><circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="3" opacity="0.5"/>`,
  cross: (c) => `<path d="M27 8 H37 V27 H56 V37 H37 V56 H27 V37 H8 V27 H27 Z" fill="${c}" stroke="#fff" stroke-width="1.5" opacity="0.95"/>`,
  burst: (c) => `<path d="M32 4 L38 24 L58 20 L42 34 L56 50 L36 44 L30 60 L26 42 L8 52 L20 34 L6 20 L26 24 Z" fill="${c}"/>`,
  shield: (c) => `<path d="M32 6 L54 14 C54 36 46 50 32 58 C18 50 10 36 10 14 Z" fill="${c}" stroke="#fff" stroke-width="2"/><path d="M32 14 V50" stroke="#fff" stroke-width="2" opacity="0.6"/>`,
  vortex: (c) => `<g fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"><path d="M32 32 m-4 0 a4 4 0 1 1 4 4"/><path d="M32 32 m-12 0 a12 12 0 1 1 12 12"/><path d="M32 32 m-20 0 a20 20 0 1 1 20 20"/></g>`,
  wave: (c) => `<path d="M6 40 C16 20 26 20 32 32 C38 44 48 44 58 24" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M6 52 C16 34 26 34 32 44 C38 54 48 54 58 38" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`,
  star: (c) => `<path d="M32 4 L40 24 L60 26 L44 40 L50 60 L32 48 L14 60 L20 40 L4 26 L24 24 Z" fill="${c}" stroke="#fff" stroke-width="1.5"/>`,
  wings: (c) => `<path d="M32 40 C20 38 10 28 6 14 C18 16 26 22 32 32 C38 22 46 16 58 14 C54 28 44 38 32 40 Z" fill="${c}"/><path d="M32 44 L32 58" stroke="${c}" stroke-width="5"/>`,
  sun: (c) => `<circle cx="32" cy="32" r="12" fill="${c}"/><g stroke="${c}" stroke-width="5" stroke-linecap="round"><path d="M32 4 V14 M32 50 V60 M4 32 H14 M50 32 H60 M12 12 L19 19 M45 45 L52 52 M52 12 L45 19 M19 45 L12 52"/></g>`,
  spear: (c) => `<path d="M8 56 L44 20" stroke="#8a6a40" stroke-width="5" stroke-linecap="round"/><path d="M40 8 L56 8 L56 24 L44 20 Z" fill="${c}" stroke="#333" stroke-width="1.5"/>`,
  drop: (c) => `<path d="M32 6 C44 24 52 32 52 42 C52 52 44 58 32 58 C20 58 12 52 12 42 C12 32 20 24 32 6 Z" fill="${c}"/><path d="M24 44 C24 50 28 52 30 52" stroke="#fff" stroke-width="3" fill="none" opacity="0.6"/>`,
  skull: (c) => `<path d="M14 30 C14 14 50 14 50 30 C50 38 46 40 44 44 L44 52 L20 52 L20 44 C18 40 14 38 14 30 Z" fill="${c}" stroke="#222" stroke-width="2"/><circle cx="24" cy="31" r="5" fill="#1a1020"/><circle cx="40" cy="31" r="5" fill="#1a1020"/>`,
  eye: (c) => `<path d="M4 32 C16 12 48 12 60 32 C48 52 16 52 4 32 Z" fill="${c}" stroke="#222" stroke-width="2"/><circle cx="32" cy="32" r="9" fill="#1a1020"/><circle cx="29" cy="29" r="3" fill="#fff"/>`,
  wisp: (c) => `<path d="M32 6 C44 18 48 30 42 42 C38 50 30 54 22 58 C26 48 18 44 18 34 C18 22 26 18 32 6 Z" fill="${c}" opacity="0.9"/><circle cx="30" cy="32" r="4" fill="#fff"/>`,
  flame: (c) => `<path d="M32 4 C42 18 52 26 48 42 C46 54 38 60 32 60 C22 60 14 52 16 40 C18 30 26 28 26 18 C30 22 30 26 32 30 C34 22 30 12 32 4 Z" fill="${c}"/><path d="M32 32 C36 40 40 44 38 52 C34 56 28 56 26 50 C26 44 30 42 32 32 Z" fill="#ffe08a"/>`,
  blade: (c) => `<path d="M10 56 L46 12 L56 8 L52 18 L16 54 Z" fill="${c}" stroke="#333" stroke-width="1.5"/><path d="M8 50 L20 58" stroke="#8a6a40" stroke-width="5"/><path d="M14 46 L24 56" stroke="#e8c35a" stroke-width="3"/>`,
  claw: (c) => `<g fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"><path d="M14 8 C22 26 20 42 12 56"/><path d="M30 6 C38 24 36 42 28 58"/><path d="M46 8 C54 26 52 42 44 56"/></g>`,
  fist: (c) => `<path d="M16 28 C16 14 40 12 46 22 C54 22 56 34 50 40 L48 54 L22 54 L20 44 C14 40 14 34 16 28 Z" fill="${c}" stroke="#333" stroke-width="2"/><path d="M26 22 V34 M34 20 V34 M42 24 V36" stroke="#333" stroke-width="2"/>`,
  spike: (c) => `<g fill="${c}" stroke="#333" stroke-width="1.5"><path d="M10 54 L16 24 L22 54 Z"/><path d="M26 54 L32 14 L38 54 Z"/><path d="M42 54 L48 26 L54 54 Z"/></g><path d="M4 56 H60" stroke="#6a5a40" stroke-width="4"/>`,
  smoke: (c) => `<g fill="${c}"><circle cx="22" cy="38" r="14"/><circle cx="38" cy="32" r="16"/><circle cx="46" cy="44" r="11"/><circle cx="28" cy="48" r="10"/></g>`,
  leaf: (c) => `<path d="M10 54 C10 22 34 8 56 8 C56 32 42 54 10 54 Z" fill="${c}"/><path d="M10 54 L44 20" stroke="#1a3a10" stroke-width="3"/>`,
  axe: (c) => `<path d="M18 56 L44 14" stroke="#8a6a40" stroke-width="5" stroke-linecap="round"/><path d="M34 8 C52 6 60 22 52 34 L40 24 Z" fill="${c}" stroke="#333" stroke-width="1.5"/>`,
  quake: (c) => `<path d="M4 44 L60 44 L60 60 L4 60 Z" fill="#6a5034"/><path d="M32 44 L27 52 L35 56 L29 60" stroke="${c}" stroke-width="3" fill="none"/><g fill="${c}" opacity="0.8"><rect x="10" y="22" width="10" height="16"/><rect x="26" y="14" width="10" height="24"/><rect x="42" y="24" width="10" height="14"/></g>`,
  whirl: (c) => `<g fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"><path d="M32 32 m-20 0 a20 20 0 1 1 20 20"/><path d="M32 32 m-11 0 a11 11 0 1 1 11 11"/></g><path d="M44 10 L56 10 L56 22 Z" fill="${c}"/>`,
  ring: (c) => `<circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="${c}" opacity="0.6"/>`,
};
export function iconSvg(key) {
  const g = ICONS[key];
  if (!g) return null;
  const [glyph, color] = g;
  const fn = GLYPHS[glyph] || GLYPHS.star;
  const c = typeof color === 'number' ? css(color) : color;
  return { inner: fn(c), glow: c };
}

for (const k of Object.keys(ICONS)) { const v = iconSvg(k); if (v) EXTRA[k] = v; }
