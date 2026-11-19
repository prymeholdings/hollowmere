import * as THREE from 'three';
import { G, BACKPACK_MAX, maxHp, maxMp, xpToNext, stat, armor, weaponDamage, attackSpeed, critChance, fameTitle, equipFromPack, unequip, feedPet, petSellCommons, ensureQuestOffer, acceptQuest, turnInQuest, saveGame, hasSave, lastSaved, petDamage, petMaxHp, msg, MAX_LEVEL, socketGem, socketTargets, invalidateBonus } from './state.js';
import { describe, itemColor, sellPrice, buyPrice, SLOT_NAMES, makeFish, generate, displayName, GEMS, makeGem, GEM_TIERS, maxSockets, upgradeItem, TYPES, typeOf, MATS, classItem } from './items.js';
import { FAME_STEPS, QUEST_GIVER } from './data.js';
import { hex, sfx, clamp, flatDist } from './util.js';
import { itemIcon, skillIcon } from './icons.js';
import { SKILLS, PASSIVES, CLASSES, CAPE_COLORS, ARMOR_TINTS, PET_COATS, TREES, NODE, TIER_LEVEL, canCast, learnBlock, maxRank, isActive, skillName, skillIconKey, treePoints, synergyText } from './skills.js';
import { Settings, saveSettings } from './settings.js';
import { Orb3D } from './orbs.js';
import { SKIN_TONES, DETAIL_OPTIONS, SCARF_COLORS, CLASS_DETAILS } from './details.js';
import { clockText } from './daynight.js';
import { PET_SPECIES, PET_SKILLS, PET_TREES, PET_TIER_LEVEL, PET_MAX_RANK, PET_MAX_LEVEL, STAGE_LEVELS, petStage, petXpToNext, learnPetSkill, ensurePets } from './pets.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const SLOTKEYS = ['rmb', 'q', 'w', 'e', 'r'];
const KEYLABEL = { rmb: 'RMB', q: 'Q', w: 'W', e: 'E', r: 'R' };


// rows of the hero look editor shared by character creation and the in-game Wardrobe
function detailRows(state) {
  const chips = (key, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${state[key] === v ? 'on' : ''}" data-det="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<h3><span>Skin tone</span></h3><div class="swatches">${SKIN_TONES.map((c) => `<div class="sw ${c === (state.skin || '#ffffff') ? 'on' : ''}" style="background:${c === '#ffffff' ? 'linear-gradient(135deg,#f2c8a8,#fff)' : c}" data-det="skin" data-v="${c}" title="${c === '#ffffff' ? 'Natural' : ''}"></div>`).join('')}</div>
    <h3><span>Shoulders</span></h3>${chips('shoulders', DETAIL_OPTIONS.shoulders)}
    <h3><span>Belt</span></h3>${chips('belt', DETAIL_OPTIONS.belt)}
    <h3><span>On your back</span></h3>${chips('back', DETAIL_OPTIONS.back)}
    <h3><span>Metal finish</span></h3>${chips('metal', DETAIL_OPTIONS.metal)}
    <h3><span>Scarf</span></h3><div class="swatches">${SCARF_COLORS.map((c) => `<div class="sw ${c === (state.scarf || '') ? 'on' : ''}" style="background:${c || 'repeating-linear-gradient(45deg,#2a2218,#2a2218 4px,#4a3a26 4px,#4a3a26 8px)'}" data-det="scarf" data-v="${c}" title="${c ? '' : 'No scarf'}"></div>`).join('')}</div>`;
}
function bindDetails(root, state, onChange) {
  root.querySelectorAll('[data-det]').forEach((d) => (d.onclick = () => { state[d.dataset.det] = d.dataset.v; onChange(); }));
}

// Fishing spots: chance of a class-fitted legendary and of other treasure per catch.
export const FISH_SPOTS = {
  pond: { title: 'Fishing Pond', desc: 'A quiet pond by the farm. Mostly perch, the odd surprise.', legend: 0.01, legendMax: 0.01, treasure: 0.05 },
  millpond: { title: 'Deepwater Millpond', desc: 'The old mill race runs deep and cold. Lost relics of the drowned city wash down here, and they always seem to suit whoever casts the line.', legend: 0.03, luck: 0.004, legendMax: 0.15, treasure: 0.14, classTreasure: true },
  fish_hole: { title: 'Fishing Hole', desc: 'Dark water in the depths. Things sink down here.', legend: 0.015, legendMax: 0.015, treasure: 0.07, classTreasure: true },
};

export class UI {
  constructor(main) {
    this.main = main;
    this.root = $('#ui');
    this.labels = new Map();
    this.floats = [];
    this.open = {};
    this.sel = null;
    this.fish = null;
    this.mmTimer = 0;
    this.build();
    G.onMessage = (t, c) => this.log(t, c);
  }

  build() {
    this.root.innerHTML = `
      <div id="world-labels"></div>
      <div id="lowhp"></div><div id="vignette"></div>
      <div id="hud" class="hidden">
        <div id="hud-top-left">
          <div id="hud-name"></div><div id="hud-sub"></div>
          <div id="pet-wrap"><div class="bar pet"><div></div><span></span></div></div>
          <div id="hud-points" class="hidden">✦ Points to spend: C attributes · K skills</div>
          <div id="hud-buffs"></div>
        </div>
        <div id="boss-bar" class="hidden"><div class="bn"></div><div class="bb"><div class="bf"></div><div class="bt"></div><i style="left:33%"></i><i style="left:66%"></i></div></div>
        <div id="hud-target" class="hidden"><div id="hud-target-name"></div><div class="bar"><div></div><span></span></div></div>
        <div id="hud-right">
          <div id="mmwrap"><canvas id="minimap" width="208" height="208"></canvas></div>
          <div id="hud-loc"></div><div id="hud-clock"></div><div id="hud-gold"></div><div id="hud-fame" style="color:#c99bff"></div><div id="hud-quest"></div>
        </div>
        <div id="log"></div>
        <div id="hud-bottom">
          <div class="orb hp"><div class="fill"></div><canvas class="orbgl"></canvas><div class="orbframe"></div><div class="txt"></div></div>
          <div id="barmid"><div id="hud-auto" title="Auto-attack (V to toggle, click to change)"></div><div id="xpbar"><div></div></div><div id="slots"></div></div>
          <div class="orb mp"><div class="fill"></div><canvas class="orbgl"></canvas><div class="orbframe"></div><div class="txt"></div></div>
        </div>
        <div id="help">I Inventory · C Character · K Skills · P Pet · J Quest · V Auto-attack · Tab Map · Alt Show items · Esc Menu</div>
      </div>
      <div id="flash"></div>
      <div id="banner"></div>
      <div id="panels"></div>
      <div id="tooltip" class="hidden"></div>
      <div id="toast"></div>
      <div id="menu" class="hidden"></div>
      <div id="create" class="hidden"></div>
      <div id="loading"><div class="title" style="font-size:64px">HOLLOWMERE</div><div class="muted" id="load-txt">Loading the Sunken Wells...</div><div class="lb"><div></div></div></div>`;
    this.hud = $('#hud');
    this.orbHp = new Orb3D($('.orb.hp .orbgl'), [0xff5a40, 0x8a0a06, 0xffb08a]);
    this.orbMp = new Orb3D($('.orb.mp .orbgl'), [0x5a9aff, 0x0a1a8a, 0xb8e0ff]);
    if (this.orbHp.gl) $('.orb.hp').classList.add('gl');
    if (this.orbMp.gl) $('.orb.mp').classList.add('gl');
    this.labelLayer = $('#world-labels');
    this.panels = $('#panels');
    this.tooltip = $('#tooltip');
    $('#hud-points').onclick = () => this.toggle(G.statPoints ? 'char' : 'skills');
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; if (!this.tooltip.classList.contains('hidden')) this.placeTooltip(); });
    this.buildSlots();
  }
  setLoading(f) { $('#loading .lb div').style.width = Math.round(f * 100) + '%'; }
  hideLoading() { $('#loading').classList.add('hidden'); }

  buildSlots() {
    const box = $('#slots');
    box.innerHTML = '';
    this.slotEls = {};
    const mk = (key, label, sep) => {
      const s = el('div', 'slot' + (sep ? ' sep' : ''), `<span class="key">${label}</span><div class="ico"></div><div class="cd"></div><span class="cnt"></span>`);
      box.appendChild(s);
      this.slotEls[key] = s;
      return s;
    };
    const lmb = mk('lmb', 'LMB'); lmb.querySelector('.ico').innerHTML = skillIcon('attack');
    lmb.onmouseenter = () => this.showText('<b>Attack / Move</b><br><span class="tt-dim">Left-click enemies to attack, the ground to move, and objects to use them.</span>');
    lmb.onmouseleave = () => this.hideTooltip();
    for (const k of SLOTKEYS) {
      const s = mk(k, KEYLABEL[k]);
      s.onclick = () => this.show('skills');
      s.onmouseenter = () => { const id = G.hotbar[k]; if (id) this.showSkillTip(id); };
      s.onmouseleave = () => this.hideTooltip();
    }
    const hp = mk('hp', '1', true); hp.querySelector('.ico').innerHTML = skillIcon('potion_hp'); hp.onclick = () => this.main.drinkPotion('hp');
    const mp = mk('mp', '2'); mp.querySelector('.ico').innerHTML = skillIcon('potion_mp'); mp.onclick = () => this.main.drinkPotion('mp');
    const sc = mk('scroll', 'T'); sc.querySelector('.ico').innerHTML = skillIcon('portal'); sc.onclick = () => this.main.usePortal();
    this.refreshSlotIcons();
  }
  pressSlot(k) { const s = this.slotEls?.[k]; if (!s) return; s.classList.add('press'); clearTimeout(s._pt); s._pt = setTimeout(() => s.classList.remove('press'), 120); }
  refreshSlotIcons() {
    if (!this.slotEls || !G.hotbar) return;
    for (const k of SLOTKEYS) {
      const id = G.hotbar[k];
      const s = this.slotEls[k];
      s.querySelector('.ico').innerHTML = id ? skillIcon(SKILLS[id].icon) : '';
      s.classList.toggle('empty', !id);
    }
  }

  // ---------------- messages ----------------
  log(t, c = '#e6e6e6') {
    const lg = $('#log');
    const d = el('div', '', t);
    d.style.color = c;
    lg.appendChild(d);
    while (lg.children.length > 7) lg.removeChild(lg.firstChild);
    setTimeout(() => { d.style.opacity = 0; }, 7000);
    setTimeout(() => d.remove(), 8200);
  }
  toast(t, bad = false) {
    const f = $('#toast'); f.textContent = t; f.className = 'on' + (bad ? ' bad' : '');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => (f.className = ''), 1800);
  }
  saveNow() {
    const ok = saveGame();
    this.toast(ok ? 'Game saved' : 'Save failed!', !ok);
    if (ok) sfx('ui');
    const ls = $('#last-saved'); if (ls) ls.textContent = this.savedText();
    return ok;
  }
  savedText() {
    if (!lastSaved) return 'Not saved yet this session';
    return 'Last saved ' + new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  flash(t) { const f = $('#flash'); f.textContent = t; clearTimeout(this.flashT); this.flashT = setTimeout(() => (f.textContent = ''), 1200); }
  banner(t, sub = '') {
    const b = $('#banner'); b.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); b.classList.add('on');
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => b.classList.remove('on'), 2600);
  }
  hurt(f) { const v = $('#vignette'); v.style.transition = 'none'; v.style.opacity = Math.min(0.7, 0.2 + f * 3); requestAnimationFrame(() => { v.style.transition = 'opacity 0.5s'; v.style.opacity = 0; }); }
  floatText(pos, text, color, size, yOff) {
    const d = el('div', 'ft', String(text));
    d.style.color = color; d.style.fontSize = size + 'px';
    this.labelLayer.appendChild(d);
    this.floats.push({ el: d, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, yOff, 0)), t: 0, vx: (Math.random() - 0.5) * 1.2 });
  }

  // ---------------- per frame ----------------
  project(v) {
    const p = v.clone().project(this.main.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, ok: p.z < 1 };
  }
  update(dt) {
    if (!G.level || !G.player) return;
    const seen = new Set();
    const pl = G.player;
    const showAll = this.main.keys.Alt;
    for (const e of G.level.entities) {
      if (!e.label) continue;
      const hovered = pl.hover === e;
      const near = e.root.position.distanceTo(pl.root.position) < 24;
      if (!(near && (e.label.always || e.label.clickable || hovered || showAll))) continue;
      seen.add(e);
      let d = this.labels.get(e);
      if (!d) {
        d = el('div', 'lbl' + (e.label.clickable ? ' click' : ''), e.label.text);
        d.style.color = e.label.color;
        if (e.label.clickable) d.onmousedown = (ev) => { if (ev.button === 0) { ev.stopPropagation(); pl.setTarget(e); } };
        this.labelLayer.appendChild(d);
        this.labels.set(e, d);
      }
      const p = this.project(e.root.position.clone().setY(e.root.position.y + e.label.y));
      d.style.display = p.ok ? '' : 'none';
      d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    }
    for (const [e, d] of this.labels) if (!seen.has(e)) { d.remove(); this.labels.delete(e); }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt; f.pos.y += dt * (2.2 - f.t * 2); f.pos.x += f.vx * dt;
      const p = this.project(f.pos);
      f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px';
      f.el.style.opacity = clamp(1.4 - f.t * 1.4, 0, 1);
      f.el.style.transform = `translate(-50%,-50%) scale(${f.t < 0.12 ? 1.4 - f.t * 3 : 1})`;
      if (f.t > 1.0) { f.el.remove(); this.floats.splice(i, 1); }
    }
    const cls = CLASSES[G.cls];
    $('#hud-name').textContent = G.heroName;
    $('#hud-sub').textContent = `Level ${G.lvl} ${cls ? cls.title : ''} · ${fameTitle()}`;
    const hpF = G.hp / maxHp(), mpF = G.mp / maxMp();
    $('.orb.hp .fill').style.height = clamp(hpF, 0, 1) * 100 + '%';
    $('.orb.mp .fill').style.height = clamp(mpF, 0, 1) * 100 + '%';
    const now = performance.now();
    this.orbHp.set(hpF); this.orbMp.set(mpF);
    this.orbHp.draw(dt, now); this.orbMp.draw(dt, now);
    $('.orb.hp .txt').textContent = `${Math.ceil(G.hp)} / ${Math.round(maxHp())}`;
    $('.orb.mp .txt').textContent = `${Math.floor(G.mp)} / ${Math.round(maxMp())}`;
    $('#lowhp').style.opacity = hpF < 0.3 ? (0.3 - hpF) * 2.5 * (0.7 + Math.sin(performance.now() / 200) * 0.3) : 0;
    $('#xpbar div').style.width = (G.lvl >= MAX_LEVEL ? 100 : (G.xp / xpToNext()) * 100) + '%';
    const pet = G.pet;
    const pb = $('#pet-wrap .bar');
    const formName = { golem: 'Stone Golem', wyrm: 'Ember Wyrm', stag: 'Spirit Stag' }[G.petForm];
    const petLbl = `${G.petName} · Lv ${G.pets?.[G.petSpecies]?.lvl || 1} ${PET_SPECIES[G.petSpecies]?.stages[petStage()] || ''}`;
    if (pet && !pet.dead && G.petAwayTime <= 0) { pb.firstElementChild.style.width = clamp(pet.hp / pet.maxHp, 0, 1) * 100 + '%'; pb.lastElementChild.textContent = formName ? `${G.petName} · ${formName} ${Math.ceil(G.petFormTime)}s` : petLbl; }
    else { pb.firstElementChild.style.width = '0%'; pb.lastElementChild.textContent = G.petAwayTime > 0 ? `${G.petName} is selling in town (${Math.ceil(G.petAwayTime)}s)` : `${G.petName} is resting in town`; }
    $('#hud-points').classList.toggle('hidden', !(G.statPoints || G.skillPoints));
    const buffs = [];
    if (G.buffs.power > 0) buffs.push(['fire', G.buffs.power, 'Shrine of Power']);
    if (G.buffs.speed > 0) buffs.push(['blink', G.buffs.speed, 'Shrine of Swiftness']);
    if (G.buffs.wealth > 0) buffs.push(['skull', G.buffs.wealth, 'Shrine of Wealth']);
    if (G.buffs.warcry > 0) buffs.push(['cry', G.buffs.warcry, 'Battle Cry']);
    if (G.buffs.smoke > 0) buffs.push(['smoke', G.buffs.smoke, 'Smoke Bomb: +30% dodge']);
    const bk = buffs.map((b) => b[0] + Math.ceil(b[1])).join();
    if (bk !== this._bk) { this._bk = bk; $('#hud-buffs').innerHTML = buffs.map(([ic, t, n]) => `<div class="buff" title="${n}">${skillIcon(ic)}<span>${Math.ceil(t)}</span></div>`).join(''); }
    $('#hud-loc').textContent = G.level.kind === 'town' ? 'Hollowmere' : `Sunken Wells · Floor ${G.level.floor}`;
    $('#hud-clock').textContent = G.level.kind === 'town' ? clockText() : '';
    this.updateAutoChip();
    const boss = G.level.kind === 'dungeon' && G.level.entities.find((e) => e.type === 'enemy' && e.boss && !e.dead && e.aggro && flatDist(e.pos, G.player.pos) < 24);
    const bb = $('#boss-bar');
    bb.classList.toggle('hidden', !boss);
    if (boss) {
      const ph = boss.bb?.phase || 1;
      bb.querySelector('.bn').innerHTML = `${boss.data.name}${boss.bb?.enraged ? ' <span style="color:#ff4433">· ENRAGED</span>' : ''} <small>Phase ${ph} / 3</small>`;
      bb.querySelector('.bf').style.width = clamp(boss.hp / boss.maxHp, 0, 1) * 100 + '%';
      bb.querySelector('.bt').textContent = `${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`;
    }
    $('#hud-gold').textContent = `${G.gold.toLocaleString()} gold`;
    $('#hud-fame').textContent = `Fame: ${fameTitle()}`;
    const q = G.quest;
    $('#hud-quest').textContent = q ? `◆ ${q.title}: ${q.done ? 'Complete! Return to town' : q.type === 'slay' ? `${q.progress}/${q.count}` : `floor ${q.floor}`}` : '';
    let tg = (pl.hover && pl.hover.type === 'enemy' && !pl.hover.dead) ? pl.hover : (pl.lastHit && !pl.lastHit.dead && pl.lastHit.root.parent ? pl.lastHit : null);
    if (tg && tg === boss) tg = null; // the boss has its own big bar
    $('#hud-target').classList.toggle('hidden', !tg);
    if (tg) {
      const n = $('#hud-target-name'); n.textContent = tg.displayName(); n.style.color = tg.boss ? '#ff6644' : tg.elite ? '#ffcc33' : '#e8dcc0';
      const b = $('#hud-target .bar'); b.firstElementChild.style.width = clamp(tg.hp / tg.maxHp, 0, 1) * 100 + '%'; b.lastElementChild.textContent = `${Math.ceil(tg.hp)} / ${Math.round(tg.maxHp)}`;
    }
    for (const k of SLOTKEYS) {
      const id = G.hotbar[k];
      const s = this.slotEls[k];
      if (!id) continue;
      const err = canCast(id);
      s.classList.toggle('off', !!err && err !== 'Not ready' && err !== 'Not enough mana');
      s.classList.toggle('nomana', err === 'Not enough mana');
      const cdMax = SKILLS[id].cdv() || 1;
      const left = Math.max(0, G.cds[id] || 0);
      const f = Math.min(1, left / cdMax);
      // radial cooldown sweep + seconds left; flash when it comes off cooldown
      const cd = s.querySelector('.cd');
      cd.style.background = f > 0 ? `conic-gradient(transparent ${(1 - f) * 360}deg, #000c ${(1 - f) * 360}deg)` : 'none';
      let t = s.querySelector('.cdt');
      if (!t) { t = el('span', 'cdt'); s.appendChild(t); }
      t.textContent = left > 0.05 && cdMax >= 1.5 ? (left >= 10 ? Math.ceil(left) : left.toFixed(1)) : '';
      if (s._wasCd && left <= 0) { s.classList.remove('ready'); void s.offsetWidth; s.classList.add('ready'); }
      s._wasCd = left > 0;
    }
    this.slotEls.hp.querySelector('.cnt').textContent = G.hpPotions;
    this.slotEls.mp.querySelector('.cnt').textContent = G.mpPotions;
    this.slotEls.scroll.querySelector('.cnt').textContent = G.scrolls;
    $('#help').classList.toggle('hidden', !Settings.showHelp);
    const padOn = !!this.main.pad?.active;
    if (padOn !== this.helpPad) {
      this.helpPad = padOn;
      const g = (k) => this.main.pad.glyph(k);
      $('#help').textContent = padOn ? `${g('A')} Attack/Talk · ${g('X')} ${g('Y')} ${g('B')} ${g('LB')} ${g('RB')} Skills · ${g('LT')}/${g('RT')} Potions · ${g('VIEW')} Inventory · D-pad: ◀ Skills ▶ Character ▲ Portal ▼ Auto · L3 Pet · R3 Map · ${g('START')} Menu`
        : 'I Inventory · C Character · K Skills · P Pet · J Quest · V Auto-attack · Tab Map · Alt Show items · Esc Menu';
    }
    this.mmTimer -= dt;
    if (this.mmTimer <= 0) { this.mmTimer = 0.12; this.drawMinimap(); }
    if (this.fish) this.updateFishing(dt);
  }

  drawMinimap() {
    const cv = $('#minimap');
    const big = this.main.bigMap;
    $('#mmwrap').classList.toggle('big', big);
    const size = big ? 560 : 208;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const ctx = cv.getContext('2d');
    const L = G.level;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    const town = L.kind === 'town';
    const s = big ? Math.floor(size / Math.max(L.w, L.h)) : 6;
    const [pcx, pcy] = L.cellOf(G.player.pos);
    const ox = big ? 0 : size / 2 - pcx * s - s / 2, oy = big ? 0 : size / 2 - pcy * s - s / 2;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!town && !L.explored[L.idx(x, y)]) continue;
      const v = L.cells[L.idx(x, y)];
      if (v === 0) { if (town) { ctx.fillStyle = '#3a3026'; } else continue; }
      else ctx.fillStyle = town ? '#4f6e3a' : '#6e6252';
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
    if (!town) {
      ctx.strokeStyle = '#b8a888'; ctx.lineWidth = 1;
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        if (!L.explored[L.idx(x, y)] || L.cells[L.idx(x, y)] === 0) continue;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (L.cells[L.idx(x + dx, y + dy)] === 0) {
          ctx.beginPath();
          const X = ox + x * s, Y = oy + y * s;
          if (dy === -1) { ctx.moveTo(X, Y); ctx.lineTo(X + s, Y); } else if (dy === 1) { ctx.moveTo(X, Y + s); ctx.lineTo(X + s, Y + s); } else if (dx === -1) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + s); } else { ctx.moveTo(X + s, Y); ctx.lineTo(X + s, Y + s); }
          ctx.stroke();
        }
      }
    }
    const dot = (p, c, r) => { const [x, y] = L.cellOf(p); if (!town && !L.explored[L.idx(x, y)]) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ox + x * s + s / 2, oy + y * s + s / 2, r, 0, 7); ctx.fill(); };
    for (const e of L.entities) {
      if (e.type === 'enemy' && !e.dead) dot(e.pos, e.boss ? '#ff3322' : e.elite ? '#ffcc33' : '#d84040', e.boss ? 5 : 2.5);
      else if (e.type === 'interact' && !e.dead) dot(e.pos, e.kind.startsWith('stairs') ? '#ffd480' : e.kind === 'portal' ? '#88aaff' : '#80e0ff', 4);
      else if (e.type === 'loot' && e.item && e.item.rarity >= 1) dot(e.pos, hex(itemColor(e.item)), 2);
      else if (e.type === 'ally') dot(e.pos, '#66ff99', 2.5);
    }
    if (G.pet && G.pet.root.visible && !G.pet.dead) dot(G.pet.pos, '#ffaa55', 3);
    ctx.fillStyle = '#fff';
    const [x, y] = L.cellOf(G.player.pos);
    ctx.save(); ctx.translate(ox + x * s + s / 2, oy + y * s + s / 2); ctx.rotate(-G.player.root.rotation.y + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ---------------- tooltip ----------------
  showText(html) { this.tooltip.innerHTML = html; this.tooltip.classList.remove('hidden'); this.placeTooltip(); }
  showTooltip(it, extra = '') {
    if (!it) return this.hideTooltip();
    let html = describe(it, G.lvl) + extra;
    const eq = it.slot && G.equipment[it.slot];
    if (eq && eq !== it) html += `<div class="tt-cmp">Currently equipped:<br>${describe(eq, G.lvl)}</div>`;
    this.showText(html);
  }
  showSkillTip(id) {
    const r = G.skills[id] || 0;
    const block = learnBlock(id);
    const foot = block && block !== 'No skill points' ? `<div class="tt-bad">${block}</div>` : '';
    if (PASSIVES[id]) {
      const p = PASSIVES[id];
      this.showText(`<div class="tt-name" style="color:#e8c170">${p.name}</div><div class="tt-sub">Passive · Rank ${r} / ${maxRank(id)}</div><div>${r ? p.desc(r) : 'Not learned yet.'}</div><div class="tt-dim" style="margin-top:4px">Next rank: ${p.desc(r + 1)}</div>${foot}`);
      return;
    }
    const s = SKILLS[id];
    const st = synergyText(id);
    this.showText(`<div class="tt-name" style="color:#e8c170">${s.name}</div><div class="tt-sub">${s.school} · Rank ${r} / ${maxRank(id)}</div><div>${s.desc(s)}</div><div class="tt-dim" style="margin-top:4px">Mana: ${Math.round(s.cost())}${s.cdv() ? ` · Cooldown: ${s.cdv().toFixed(1)}s` : ''}</div>${st ? `<div style="color:#9fd8a0;margin-top:4px">Synergies:<br>${st}</div>` : ''}${r ? '' : '<div class="tt-bad">Not learned yet</div>'}${foot}`);
  }
  placeTooltip() {
    const t = this.tooltip;
    let x = this.mouseX + 18, y = this.mouseY + 12;
    if (x + t.offsetWidth > window.innerWidth) x = this.mouseX - t.offsetWidth - 12;
    if (y + t.offsetHeight > window.innerHeight) y = Math.max(4, this.mouseY - t.offsetHeight - 10);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  hideTooltip() { this.tooltip.classList.add('hidden'); }

  // ---------------- panels ----------------
  anyModal() { return !!(this.open.fish || this.open.choice || this.open.pause || this.open.death || this.open.settings || this.open.menu || this.open.create); }
  anyPanel() { return Object.keys(this.open).some((k) => k !== 'menu' && k !== 'create' && this.open[k]); }
  closeAll() { for (const k of Object.keys(this.open)) if (!['death', 'menu', 'create'].includes(k)) this.close(k); this.hideTooltip(); }
  close(name) {
    const p = this.open[name];
    if (p) { if (p.remove) p.remove(); delete this.open[name]; }
    if (name === 'fish') this.fish = null;
    if (name === 'shop' && this.sel?.src === 'shop') this.sel = null;
    this.hideTooltip();
  }
  toggle(name) { if (this.open[name]) this.close(name); else this.show(name); }
  show(name, ...args) {
    sfx('ui');
    this.close(name);
    const fn = { inv: this.renderInv, char: this.renderChar, skills: this.renderSkills, shop: this.renderShop, quest: this.renderQuest, pause: this.renderPause, settings: this.renderSettings, forge: this.renderForge, pet: this.renderPet, wardrobe: this.renderWardrobe }[name];
    if (fn) fn.call(this, ...args);
  }
  panel(name, title, style, closable = true) {
    const p = el('div', 'panel');
    Object.assign(p.style, style);
    p.innerHTML = `<h2>${title}</h2>${closable ? '<span class="x">✕</span>' : ''}<div class="body"></div>`;
    if (closable) p.querySelector('.x').onclick = () => this.close(name);
    p.addEventListener('mousedown', (e) => e.stopPropagation());
    p.addEventListener('contextmenu', (e) => e.preventDefault());
    this.panels.appendChild(p);
    this.open[name] = p;
    return p.querySelector('.body');
  }
  body(name, title, style) { const p = this.open[name]; return p ? p.querySelector('.body') : this.panel(name, title, style); }
  refresh() {
    if (this.open.inv) this.renderInv();
    if (this.open.char) this.renderChar();
    if (this.open.skills) this.renderSkills();
    if (this.open.shop) this.renderShop();
    if (this.open.quest) this.renderQuest();
    if (this.open.forge) this.renderForge();
    if (this.open.pet) this.renderPet();
    if (this.open.wardrobe) this.renderWardrobe();
  }

  itemCell(it, onClick, onRight, selected, cls = 'cell') {
    const c = el('div', cls + (selected ? ' sel' : ''));
    if (it) {
      const col = hex(itemColor(it));
      c.innerHTML = itemIcon(it, col);
      c.style.borderColor = it.rarity ? col : '#3a3022';
      if (it.rarity >= 2) c.style.boxShadow = `inset 0 0 12px ${col}55`;
      if (it.req > G.lvl) c.appendChild(el('div', 'req'));
      c.onmouseenter = () => this.showTooltip(it);
      c.onmouseleave = () => this.hideTooltip();
      c.onclick = onClick;
      c.oncontextmenu = (e) => { e.preventDefault(); onRight?.(); };
    }
    return c;
  }

  renderInv() {
    const body = this.body('inv', 'Inventory', { right: '18px', top: '90px', width: '470px' });
    body.innerHTML = '';
    const eq = el('div', 'eqgrid');
    const layout = { helm: [2, 1], amulet: [3, 1], weapon: [1, 2], armor: [2, 2], offhand: [3, 2], ring: [3, 3] };
    for (const slot in layout) {
      const it = G.equipment[slot];
      const s = this.itemCell(it, () => { unequip(slot); this.refresh(); }, () => { unequip(slot); this.refresh(); }, false, 'eqs');
      if (!it) s.innerHTML = '';
      s.appendChild(el('div', 'sl', SLOT_NAMES[slot]));
      s.style.gridColumn = layout[slot][0]; s.style.gridRow = layout[slot][1];
      eq.appendChild(s);
    }
    const stats = el('div', 'muted', `<div style="grid-column:1;grid-row:1/2;font-size:12px;line-height:1.5">Damage<br><b style="color:#fff">${weaponDamage().map(Math.round).join('-')}</b><br>Armor<br><b style="color:#fff">${Math.round(armor())}</b></div>`);
    stats.style.gridColumn = 1; stats.style.gridRow = 1; stats.style.textAlign = 'center';
    eq.appendChild(stats);
    const gold = el('div', '', `<div style="font-size:13px;color:#ffd84d;text-align:center;padding-top:20px">${G.gold.toLocaleString()}<br>gold</div>`);
    gold.style.gridColumn = 1; gold.style.gridRow = 3;
    eq.appendChild(gold);
    const petInfo = el('div', '', `<div style="font-size:12px;text-align:center;padding-top:14px;color:#ffb066">${G.petName}<br><span class="muted">${{ golem: 'Golem', wyrm: 'Wyrm', stag: 'Stag' }[G.petForm] || PET_SPECIES[G.petSpecies].stages[petStage()]}</span><br><button class="mini" id="inv-pet">Pet (P)</button></div>`);
    petInfo.style.gridColumn = 2; petInfo.style.gridRow = 3;
    eq.appendChild(petInfo);
    const ipb = petInfo.querySelector('#inv-pet'); if (ipb) ipb.onclick = () => this.show('pet');
    body.appendChild(eq);
    body.appendChild(el('div', 'muted', `Backpack ${G.backpack.length}/${BACKPACK_MAX} · Right-click to ${this.open.shop ? 'sell' : 'equip or feed your pet'}`));
    const grid = el('div', 'grid');
    grid.style.margin = '6px 0 10px';
    for (let i = 0; i < BACKPACK_MAX; i++) {
      const it = G.backpack[i];
      grid.appendChild(this.itemCell(it, () => { this.sel = { src: 'pack', key: i }; this.renderInv(); }, () => this.quickUse(i), this.sel?.src === 'pack' && this.sel.key === i));
    }
    body.appendChild(grid);
    const bar = el('div');
    const selIt = this.sel?.src === 'pack' ? G.backpack[this.sel.key] : null;
    const btn = (t, fn, dis) => { const b = el('button', 'small', t); b.disabled = !!dis; b.onclick = () => { fn(); this.hideTooltip(); this.refresh(); }; bar.appendChild(b); };
    btn(selIt?.slot === 'fish' ? 'Feed Pet' : selIt?.slot === 'gem' ? 'Socket' : 'Equip', () => this.quickUse(this.sel.key, true), !selIt);
    if (this.open.shop) btn('Sell', () => this.sell(this.sel.key), !selIt);
    btn('Drop', () => { const it = G.backpack.splice(this.sel.key, 1)[0]; this.main.dropItem(it); this.sel = null; }, !selIt);
    btn('Wardrobe', () => this.show('wardrobe'), false);
    btn(`Send ${G.petName} to sell commons`, () => petSellCommons(), G.level.kind === 'town' && !this.open.shop);
    body.appendChild(bar);
  }
  quickUse(i, viaButton = false) {
    const it = G.backpack[i];
    if (!it) return;
    if (this.open.shop && !viaButton) return this.sell(i);
    if (it.slot === 'gem') { this.hideTooltip(); this.socketPicker(i); return; }
    if (it.slot === 'fish') feedPet(i); else equipFromPack(i);
    this.sel = null; this.hideTooltip(); this.refresh();
  }
  socketPicker(gemIdx) {
    const gem = G.backpack[gemIdx];
    const targets = socketTargets();
    if (!targets.length) { this.toast('No item with an empty socket. The blacksmith can add sockets.', true); return; }
    this.choice(`Socket ${gem.name}`, 'Choose an item with an empty socket:', [
      ...targets.slice(0, 10).map((t) => [`${displayName(t.it)}${t.where === 'eq' ? ' (equipped)' : ''}`, () => { socketGem(G.backpack.indexOf(gem), t.it); this.sel = null; this.refresh(); }]),
      ['Cancel', null],
    ], targets.length > 3);
  }
  sell(i) {
    const it = G.backpack[i];
    if (!it) return;
    G.backpack.splice(i, 1);
    const p = sellPrice(it);
    G.gold += p;
    msg(`Sold ${displayName(it)} for ${p} gold`, '#ffd84d');
    sfx('gold');
    this.sel = null; this.hideTooltip(); this.refresh();
  }

  renderChar() {
    const body = this.body('char', 'Character', { left: '18px', top: '90px', width: '400px', maxHeight: '80vh', overflowY: 'auto' });
    const d = weaponDamage();
    const cls = CLASSES[G.cls];
    const labels = { str: ['Strength', 'Melee damage'], dex: ['Dexterity', 'Attack speed, crit, dodge'], vit: ['Vitality', 'Life'], mag: ['Magic', 'Spell power, mana'] };
    let html = `<div style="text-align:center;margin-bottom:8px"><div style="font-size:19px;color:#fff">${G.heroName}</div><div class="muted">Level ${G.lvl} ${cls.title} · ${G.lvl >= MAX_LEVEL ? "max level" : G.xp + " / " + xpToNext() + " xp"}</div><div style="color:#c99bff;font-size:13px">${fameTitle()} (${G.fame}${G.fameRank < FAME_STEPS.length - 1 ? ' / ' + FAME_STEPS[G.fameRank + 1] : ''} fame)</div></div>
      <h3><span>Attributes</span><span style="color:#ffd84d">${G.statPoints} points</span></h3>`;
    for (const k of ['str', 'dex', 'vit', 'mag']) html += `<div class="row"><span>${labels[k][0]} <small class="muted">${labels[k][1]}</small></span><span><span class="v">${stat(k)}</span> <button class="small" data-stat="${k}" ${G.statPoints ? '' : 'disabled'}>+</button></span></div>`;
    html += `<h3><span>Combat</span></h3>
      <div class="row"><span>Life / Mana</span><span class="v">${Math.round(maxHp())} / ${Math.round(maxMp())}</span></div>
      <div class="row"><span>Weapon damage</span><span class="v">${Math.round(d[0])} - ${Math.round(d[1])}</span></div>
      <div class="row"><span>Attacks per second</span><span class="v">${attackSpeed().toFixed(2)}</span></div>
      <div class="row"><span>Critical chance</span><span class="v">${Math.round(critChance() * 100)}%</span></div>
      <div class="row"><span>Dodge chance</span><span class="v">${Math.round(Math.min(0.25, stat('dex') * 0.004) * 100)}%</span></div>
      <div class="row"><span>Armor</span><span class="v">${Math.round(armor())} (${Math.round(100 - 10000 / (100 + armor()))}% less damage)</span></div>
      <div class="row"><span>Gold / Magic find</span><span class="v">${this.main.goldFind()}% / ${this.main.magicFind()}%</span></div>
      <div class="row"><span>${G.petName}</span><span class="v">${Math.round(petDamage())} dmg · ${Math.round(petMaxHp())} life</span></div>
      <div class="row"><span>Slain · Fish caught · Deepest</span><span class="v">${G.kills} · ${G.fishCaught} · ${G.deepest}</span></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-stat]').forEach((b) => (b.onclick = () => { if (G.statPoints > 0) { const f = G.hp / maxHp(); G.base[b.dataset.stat]++; G.statPoints--; G.hp = maxHp() * f; sfx('ui'); this.refresh(); } }));
  }

  renderSkills() {
    const body = this.body('skills', 'Skill Trees', { left: '50%', top: '40px', width: '1180px', transform: 'translateX(-50%)', maxHeight: '92vh', overflowY: 'auto' });
    if (!this.skSel) this.skSel = G.hotbar.rmb || 'firebolt';
    const NW = 56, CW = 80, RH = 74, PADX = 30, PADY = 10;
    let html = `<div class="sk-top"><span>Skill points: <b style="color:#ffd84d">${G.skillPoints}</b></span><span class="muted">Click a skill to learn a rank. Rows unlock at levels ${TIER_LEVEL.join(', ')}. Any class can learn any tree.</span></div><div class="sk-trees">`;
    for (const t of TREES) {
      const W = PADX * 2 + CW * 2 + NW, H = PADY * 2 + RH * (TIER_LEVEL.length - 1) + NW;
      const xy = (n) => [PADX + n.col * CW + NW / 2, PADY + n.tier * RH + NW / 2];
      let lines = '';
      for (const n of t.nodes) for (const r of n.req || []) {
        const a = xy(NODE[r]), b = xy(n);
        const on = (G.skills[r] || 0) > 0;
        lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${on ? t.color : '#3a3022'}" stroke-width="${on ? 4 : 3}" ${on ? '' : 'stroke-dasharray="6 5"'}/>`;
      }
      let rows = '';
      for (let i = 0; i < TIER_LEVEL.length; i++) rows += `<div class="sk-tier" style="top:${PADY + i * RH + NW / 2 - 8}px">Lv ${TIER_LEVEL[i]}</div>`;
      let nodes = '';
      for (const n of t.nodes) {
        const r = G.skills[n.id] || 0, mx = maxRank(n.id);
        const block = learnBlock(n.id);
        const cls = ['sk-node', r ? 'learned' : '', !block ? 'avail' : '', isActive(n.id) ? 'active' : 'passive', this.skSel === n.id ? 'sel' : '', (block && !r && block.startsWith('Req')) ? 'locked' : ''].join(' ');
        const [x, y] = xy(n);
        nodes += `<div class="${cls}" data-node="${n.id}" style="left:${x - NW / 2}px;top:${y - NW / 2}px;--tc:${t.color}">${skillIcon(skillIconKey(n.id))}<span class="rk">${r}/${mx}</span></div>`;
      }
      html += `<div class="sk-tree"><div class="sk-head" style="color:${t.color}">${t.name}<small>${treePoints(t.id)} points</small></div><div class="sk-canvas" style="width:${W}px;height:${H}px">${rows}<svg width="${W}" height="${H}">${lines}</svg>${nodes}</div></div>`;
    }
    html += '</div><div id="sk-detail"></div>';
    if (G.lvl >= 2) html += '';
    body.innerHTML = html;
    body.querySelectorAll('[data-node]').forEach((d) => {
      const id = d.dataset.node;
      d.onclick = () => {
        this.skSel = id;
        const block = learnBlock(id);
        if (!block) {
          G.skills[id] = (G.skills[id] || 0) + 1; G.skillPoints--;
          if (G.skills[id] === 1 && SKILLS[id] && !Object.values(G.hotbar).includes(id)) { const free = SLOTKEYS.find((k) => !G.hotbar[k] || !(G.skills[G.hotbar[k]] > 0)); if (free) G.hotbar[free] = id; }
          if (id === 'pet_bond' && G.pet) G.pet.applyForm(true);
          sfx('level'); this.refreshSlotIcons(); this.refresh();
        } else { sfx('ui'); this.renderSkills(); }
      };
      d.onmouseenter = () => this.showSkillTip(id);
      d.onmouseleave = () => this.hideTooltip();
    });
    this.renderSkillDetail();
  }
  renderSkillDetail() {
    const box = $('#sk-detail');
    if (!box) return;
    const id = this.skSel;
    const r = G.skills[id] || 0;
    const block = learnBlock(id);
    let h = `<div class="ic">${skillIcon(skillIconKey(id))}</div><div class="bd"><b>${skillName(id)}</b> <span class="muted">· Rank ${r} / ${maxRank(id)}</span>`;
    if (SKILLS[id]) {
      const s = SKILLS[id];
      h += `<small>${s.desc(s)} Mana ${Math.round(s.cost())}${s.cdv() ? `, cooldown ${s.cdv().toFixed(1)}s` : ''}.</small>`;
      const st = synergyText(id); if (st) h += `<small style="color:#9fd8a0">Synergies: ${st.replace(/<br>/g, ' · ')}</small>`;
      h += `<div class="asg">Place on: ${SLOTKEYS.map((k) => `<button class="${G.hotbar[k] === id ? 'on' : ''}" data-asg="${k}" ${r ? '' : 'disabled'}>${KEYLABEL[k]}</button>`).join('')}</div>`;
    } else {
      const p = PASSIVES[id];
      h += `<small>${r ? 'Now: ' + p.desc(r) : 'Passive.'} Each rank: ${p.per}.</small>`;
    }
    h += `<small class="${block ? 'tt-bad' : ''}" style="${block ? '' : 'color:#ffd84d'}">${block ? (block === 'Maximum rank' ? 'Fully mastered.' : block) : 'Click the skill again to add a rank.'}</small></div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-asg]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.asg;
      for (const kk of SLOTKEYS) if (G.hotbar[kk] === id) G.hotbar[kk] = null;
      G.hotbar[k] = id; sfx('ui'); this.refreshSlotIcons(); this.renderSkills();
    }));
  }

  renderForge() {
    const body = this.body('forge', "Hobb's Forge", { left: '18px', top: '90px', width: '490px', maxHeight: '80vh', overflowY: 'auto' });
    const tab = this.forgeTab || 'reforge';
    body.innerHTML = '';
    const tabs = el('div', 'ftabs');
    for (const [k, t] of [['reforge', 'Reforge'], ['gems', 'Sockets & Gems'], ['artisan', 'Artisan']]) {
      const b = el('button', 'small' + (k === tab ? ' on' : ''), t);
      b.dataset.ftab = k;
      b.onclick = () => { this.forgeTab = k; sfx('ui'); this.renderForge(); };
      tabs.appendChild(b);
    }
    body.appendChild(tabs);
    const gear = [];
    for (const k in G.equipment) { const it = G.equipment[k]; if (it) gear.push({ it, where: 'eq', key: k }); }
    G.backpack.forEach((it, i) => { if (it.slot in G.equipment) gear.push({ it, where: 'bp', key: i }); });
    const row = (e, sub, buttons) => {
      const r = el('div', 'skrow');
      r.innerHTML = `<div class="ic">${itemIcon(e.it, hex(itemColor(e.it)))}</div><div class="bd"><b style="color:${hex(itemColor(e.it))}">${displayName(e.it)}</b><small>${sub}</small></div>`;
      const bx = el('div', 'fbtns');
      for (const [label, cost, fn, dis] of buttons) {
        const b = el('button', 'small', cost ? `${label} · ${cost.toLocaleString()}g` : label);
        b.disabled = !!dis || (cost && G.gold < cost);
        b.onclick = () => { if (cost && G.gold < cost) return; if (fn() !== false) { if (cost) G.gold -= cost; invalidateBonus(); G.player?.refreshVisuals(); this.hideTooltip(); this.refresh(); } };
        bx.appendChild(b);
      }
      r.appendChild(bx);
      r.querySelector('.ic').onmouseenter = () => this.showTooltip(e.it);
      r.querySelector('.ic').onmouseleave = () => this.hideTooltip();
      body.appendChild(r);
      return r;
    };
    const where = (e) => (e.where === 'eq' ? 'Equipped' : 'In backpack');
    if (tab === 'reforge') {
      body.appendChild(el('div', 'muted fnote', '"Bring me anything with a spark of magic and I will hammer it into something new." Reforging rerolls the magic of an item but keeps its kind, rarity, sockets, gems, dye and name.'));
      const list = gear.filter((e) => e.it.rarity >= 1);
      if (!list.length) body.appendChild(el('p', '', 'You have no magic, rare or legendary gear to reforge.'));
      for (const e of list) {
        const cost = Math.max(60, Math.round(sellPrice(e.it) * 4));
        row(e, `${where(e)} · item level ${e.it.ilvl}`, [['Reforge', cost, () => {
          let n = null;
          for (let i = 0; i < 200 && !n; i++) { const c = generate(e.it.ilvl, 0, e.it.rarity, e.it.type); if (c.rarity === e.it.rarity) n = c; }
          if (!n) { this.toast('The metal resists. Try again.', true); return false; }
          for (const k of ['sockets', 'gems', 'dye', 'look', 'customName']) if (e.it[k] !== undefined) n[k] = e.it[k];
          if (e.where === 'eq') G.equipment[e.key] = n; else G.backpack[e.key] = n;
          msg(`Hobb reforges your ${displayName(e.it)} into ${n.name}!`, hex(itemColor(n)));
          sfx('legend');
        }]]);
      }
    } else if (tab === 'gems') {
      body.appendChild(el('div', 'muted fnote', 'Gems add power that depends on where they sit: elemental damage in weapons, life and attributes in armor and helms, utility in off-hands. Right-click a gem in your backpack to socket it.'));
      body.appendChild(el('h3', '', '<span>Combine gems</span>'));
      const groups = {};
      G.backpack.forEach((it) => { if (it.slot === 'gem' && it.tier < 4) { const k = it.gem + ':' + it.tier; (groups[k] ||= []).push(it); } });
      const keys = Object.keys(groups).filter((k) => groups[k].length >= 3);
      if (!keys.length) body.appendChild(el('p', 'muted', 'Bring three gems of the same kind and quality to combine them into a finer one.'));
      for (const k of keys) {
        const g = groups[k][0];
        const next = makeGem(g.gem, g.tier + 1);
        row({ it: next }, `3 × ${g.name} → ${next.name} (you have ${groups[k].length})`, [['Combine', 80 * (g.tier + 1) * (g.tier + 1), () => {
          for (const x of groups[k].slice(0, 3)) G.backpack.splice(G.backpack.indexOf(x), 1);
          G.backpack.push(next); sfx('legend'); msg(`Hobb fuses three gems into a ${next.name}.`, '#99ddff');
        }]]);
      }
      body.appendChild(el('h3', '', '<span>Sockets</span>'));
      const sock = gear.filter((e) => maxSockets(upgradeItem(e.it)) > 0);
      for (const e of sock) {
        const it = e.it, ms = maxSockets(it), used = (it.gems || []).filter(Boolean).length;
        const add = Math.round(120 * Math.pow(it.sockets + 1, 2) * (1 + it.ilvl / 12));
        const rem = Math.round(40 + it.ilvl * 6);
        row(e, `${where(e)} · sockets ${it.sockets}/${ms}${used ? ` · ${used} gem${used > 1 ? 's' : ''}` : ''}`, [
          ['Add socket', it.sockets < ms ? add : 0, () => { it.sockets++; sfx('gold'); msg(`Hobb punches a new socket into ${displayName(it)}.`, '#99ddff'); }, it.sockets >= ms],
          ['Remove gems', used ? rem : 0, () => {
            if (G.backpack.length + used > BACKPACK_MAX) { this.toast('Not enough room in your backpack', true); return false; }
            for (const g of it.gems) if (g) G.backpack.push(makeGem(g.gem, g.tier));
            it.gems = []; sfx('pick'); msg('Hobb pries the gems loose. They are safe in your backpack.', '#99ddff');
          }, !used],
        ]);
      }
    } else {
      body.appendChild(el('div', 'muted fnote', '"A hero should look the part." Dye your gear, give it a name of your own, or reshape it to look like another item of the same kind. Stats never change.'));
      if (!this.artSel || !gear.some((e) => e.it === this.artSel)) this.artSel = gear[0]?.it || null;
      const pick = el('div', 'grid artpick');
      for (const e of gear) {
        const c = this.itemCell(e.it, () => { this.artSel = e.it; sfx('ui'); this.renderForge(); }, null, e.it === this.artSel);
        pick.appendChild(c);
      }
      body.appendChild(pick);
      const it = this.artSel;
      if (!it) return;
      upgradeItem(it);
      body.appendChild(el('h3', '', `<span>${displayName(it)}</span>`));
      // dye
      const dyes = ['#ffffff', '#e8e8e8', '#6a6a72', '#2a2a30', '#c03030', '#e07030', '#e8c040', '#80c040', '#30a060', '#30a0c0', '#3060d0', '#6040c0', '#a040b0', '#e070a0', '#8a5a30', '#d8b880', '#a8dcff', '#ffd86a'];
      const dr = el('div', 'dyes');
      dr.appendChild(el('span', 'muted', 'Dye (40g): '));
      for (const d of dyes) {
        const sw = el('div', 'dye' + (it.dye === d ? ' on' : ''));
        sw.style.background = d; sw.title = d;
        sw.onclick = () => { if (G.gold < 40) { this.toast('Not enough gold', true); return; } G.gold -= 40; it.dye = d === '#ffffff' ? undefined : d; sfx('ui'); G.player?.refreshVisuals(); this.refresh(); };
        dr.appendChild(sw);
      }
      body.appendChild(dr);
      // rename
      const rn = el('div', 'setrow', `<span>Name</span><span><input id="art-name" maxlength="28" value="${(it.customName || '').replace(/"/g, '&quot;')}" placeholder="${it.name.replace(/"/g, '&quot;')}"> <button class="small" id="art-ren">Rename · 25g</button></span>`);
      body.appendChild(rn);
      $('#art-ren', rn).onclick = () => {
        const v = $('#art-name', rn).value.replace(/[<>]/g, '').trim().slice(0, 28);
        if (G.gold < 25) { this.toast('Not enough gold', true); return; }
        G.gold -= 25; it.customName = v || undefined; sfx('ui'); this.toast(v ? `Renamed to ${v}` : 'Name restored'); this.refresh();
      };
      $('#art-name', rn).addEventListener('keydown', (e) => e.stopPropagation());
      // appearance
      const ap = el('div', 'looks');
      ap.appendChild(el('div', 'muted', 'Appearance (75g):'));
      const own = it.type;
      for (const [k, t] of Object.entries(TYPES)) {
        if (t.slot !== it.slot) continue;
        if (it.slot === 'weapon' && !!t.two !== !!TYPES[own].two) continue; // keep one- and two-handed looks apart
        const cur = (it.look || own) === k;
        const b = el('button', 'small' + (cur ? ' on' : ''), t.name + (k === own ? ' (original)' : ''));
        b.onclick = () => { if (cur) return; if (G.gold < 75) { this.toast('Not enough gold', true); return; } G.gold -= 75; it.look = k === own ? undefined : k; sfx('ui'); G.player?.refreshVisuals(); this.refresh(); };
        ap.appendChild(b);
      }
      body.appendChild(ap);
    }
  }

  renderShop() {
    const body = this.body('shop', "Odessa's Wares", { left: '18px', top: '90px', width: '470px' });
    body.innerHTML = '<div class="muted" style="margin-bottom:8px;text-align:center">"Coin first, questions never." Right-click to buy. Right-click your own items to sell.</div>';
    const grid = el('div', 'grid');
    G.shopStock.forEach((it, i) => {
      const c = this.itemCell(it, () => { this.sel = { src: 'shop', key: i }; this.renderShop(); }, () => this.buy(i), this.sel?.src === 'shop' && this.sel.key === i);
      c.onmouseenter = () => this.showTooltip(it, `<div style="color:#ffd84d;text-align:center;margin-top:4px">Price: ${buyPrice(it)} gold</div>`);
      grid.appendChild(c);
    });
    body.appendChild(grid);
    const bar = el('div'); bar.style.marginTop = '10px';
    const selIt = this.sel?.src === 'shop' ? G.shopStock[this.sel.key] : null;
    const btn = (t, fn, dis) => { const b = el('button', 'small', t); b.disabled = !!dis; b.onclick = () => { fn(); this.refresh(); }; bar.appendChild(b); };
    btn(selIt ? `Buy (${buyPrice(selIt)}g)` : 'Buy', () => this.buy(this.sel.key), !selIt);
    btn('Health Potion 20g', () => this.buyThing('hpPotions', 20, 'Health Potion'));
    btn('Mana Potion 20g', () => this.buyThing('mpPotions', 20, 'Mana Potion'));
    btn('Portal Scroll 35g', () => this.buyThing('scrolls', 35, 'Town Portal Scroll'));
    btn('Sell all Commons', () => { let t = 0, n = 0; for (let i = G.backpack.length - 1; i >= 0; i--) if (G.backpack[i].rarity === 0) { t += sellPrice(G.backpack[i]); n++; G.backpack.splice(i, 1); } G.gold += t; msg(n ? `Sold ${n} items for ${t} gold` : 'Nothing common to sell.', '#ffd84d'); if (n) sfx('gold'); });
    body.appendChild(bar);
  }
  buy(i) {
    const it = G.shopStock[i];
    if (!it) return;
    const p = buyPrice(it);
    if (G.gold < p) { this.flash('Not enough gold'); return; }
    if (G.backpack.length >= BACKPACK_MAX) { this.flash('Backpack full'); return; }
    G.gold -= p; G.backpack.push(it); G.shopStock.splice(i, 1);
    msg(`Bought ${it.name}`, hex(itemColor(it))); sfx('gold');
    this.sel = null; this.hideTooltip(); this.refresh();
  }
  buyThing(key, price, name) {
    if (G.gold < price) { this.flash('Not enough gold'); return; }
    G.gold -= price; G[key]++; msg(`Bought a ${name}`); sfx('gold');
  }

  renderQuest() {
    const body = this.body('quest', QUEST_GIVER, { left: '50%', top: '16%', width: '500px', transform: 'translateX(-50%)' });
    const inTown = G.level.kind === 'town';
    const q = G.quest;
    let html = '';
    if (q) {
      html += `<div style="font-size:18px;color:#e8c170;text-align:center">${q.title}</div><p>${q.text}</p>`;
      html += `<div class="row"><span>Progress</span><span class="v">${q.done ? '<span style="color:#7f7">Complete</span>' : q.type === 'slay' ? `${q.progress} / ${q.count}` : 'Not yet'}</span></div>`;
      html += `<div class="row"><span>Reward</span><span class="v">${q.gold} gold · ${q.xp} xp · ${q.fame} fame · magic item</span></div><div style="text-align:center;margin-top:10px">`;
      if (inTown && q.done) html += '<button id="q-turn" class="primary">Claim Reward</button>';
      html += '<button id="q-ab">Abandon</button></div>';
    } else if (inTown) {
      ensureQuestOffer();
      const o = G.questOffer;
      html += `<p class="muted" style="font-style:italic">"The Wells give up nothing for free, ${G.heroName}. Here is work, if you want it."</p>`;
      html += `<div style="font-size:18px;color:#e8c170;text-align:center">${o.title}</div><p>${o.text}</p>`;
      html += `<div class="row"><span>Reward</span><span class="v">${o.gold} gold · ${o.xp} xp · ${o.fame} fame · magic item</span></div>`;
      html += '<div style="text-align:center;margin-top:10px"><button id="q-acc" class="primary">Accept</button><button id="q-new">Other work (10g)</button></div>';
    } else html = '<p class="muted">No active quest. Visit Warden Corvane in Hollowmere.</p>';
    body.innerHTML = html;
    const on = (id, fn) => { const b = $(id, body); if (b) b.onclick = () => { fn(); sfx('ui'); this.refresh(); }; };
    on('#q-turn', () => turnInQuest());
    on('#q-ab', () => { G.quest = null; msg('Quest abandoned.'); });
    on('#q-acc', () => acceptQuest());
    on('#q-new', () => { if (G.gold >= 10) { G.gold -= 10; G.questOffer = null; } else this.flash('Not enough gold'); });
  }

  renderPause() {
    const body = this.panel('pause', 'Paused', { left: '50%', top: '26%', width: '320px', transform: 'translateX(-50%)', textAlign: 'center' });
    const b = (t, fn) => { const x = el('button', '', t); x.style.width = '100%'; x.style.margin = '5px 0'; x.onclick = fn; body.appendChild(x); };
    b('Resume', () => this.close('pause'));
    b('Settings', () => { this.close('pause'); this.show('settings'); });
    b('Save Game', () => this.saveNow());
    b('Save & Quit to Title', () => { if (!this.saveNow()) return; this.close('pause'); this.main.toMenu(); });
    b('Quit to Desktop', () => { if (!this.saveNow()) return; setTimeout(() => { if (window.hm && window.hm.quit) window.hm.quit(); else window.close(); }, 250); });
    const ls = el('div', 'muted', this.savedText()); ls.id = 'last-saved'; ls.style.marginTop = '8px'; ls.style.fontSize = '13px'; body.appendChild(ls);
  }

  renderSettings(fromMenu = false) {
    const body = this.panel('settings', 'Settings', { left: '50%', top: '14%', width: '480px', transform: 'translateX(-50%)', zIndex: 20 });
    const slider = (key, label) => `<div class="setrow"><span>${label}</span><span><input type="range" min="0" max="100" value="${Math.round(Settings[key] * 100)}" data-k="${key}"> <span id="sv-${key}">${Math.round(Settings[key] * 100)}%</span></span></div>`;
    const check = (key, label) => `<div class="setrow"><span>${label}</span><input type="checkbox" data-c="${key}" ${Settings[key] ? 'checked' : ''}></div>`;
    body.innerHTML = `<h3><span>Audio</span></h3>${slider('master', 'Master volume')}${slider('music', 'Music')}${slider('sfx', 'Sound effects')}
      <h3><span>Graphics</span></h3>
      <div class="setrow"><span>Quality</span><select id="set-q"><option value="low">Low (fastest)</option><option value="medium">Medium (glow, SMAA)</option><option value="high">High (ambient occlusion, MSAA, soft shadows)</option><option value="ultra">Ultra (sharper shadows, full resolution)</option></select></div>
      <div class="setrow"><span>Render scale <small class="muted">(lower is faster)</small></span><span><input type="range" min="50" max="100" step="5" value="${Math.round((Settings.renderScale || 1) * 100)}" id="set-rs"> <span id="sv-rs">${Math.round((Settings.renderScale || 1) * 100)}%</span></span></div>
      <div class="setrow"><span>Sharpening</span><span><input type="range" min="0" max="100" value="${Math.round((Settings.sharpen ?? 0.35) * 100)}" id="set-sh"> <span id="sv-sh">${Math.round((Settings.sharpen ?? 0.35) * 100)}%</span></span></div>
      <div class="setrow"><span>Fullscreen</span><button class="small" id="set-fs">Toggle (F11)</button></div>
      <h3><span>Gameplay</span></h3>${check('damageNumbers', 'Show damage numbers')}${check('screenShake', 'Screen shake')}${check('autoLoot', 'Auto-pick up potions')}${check('showHelp', 'Show key hints')}
      <h3><span>Auto-attack</span></h3>${check('autoAttack', 'Attack nearby foes automatically (V)')}
      <div class="setrow"><span>Auto-attack with</span><select id="set-am"><option value="basic">Basic attack</option>${['rmb', 'q', 'w', 'e', 'r'].map((k) => `<option value="${k}">${k.toUpperCase()} slot${G.hotbar?.[k] ? ': ' + skillName(G.hotbar[k]) : ''}</option>`).join('')}</select></div>
      <div class="setrow"><span>Auto-attack range</span><span><input type="range" min="3" max="14" value="${Settings.autoRange}" id="set-ar"> <span id="sv-ar">${Settings.autoRange}m</span></span></div>
      <div class="muted" style="font-size:12px">With a skill chosen, it is cast whenever it is ready and you have the mana; otherwise you use your basic attack. Moving by clicking always wins.</div>
      <h3><span>Controls</span></h3><div class="muted" style="line-height:1.6">Xbox and PlayStation controllers work everywhere: left stick moves, A/✕ attacks and talks, X/□ Y/△ B/○ LB/L1 RB/R1 cast your skills, LT/RT (L2/R2) drink potions, and in menus the d-pad moves the highlight, A/✕ selects, B/○ goes back, LB/RB switch tabs.<br>Left-click: move, attack, pick up, talk · Right-click / Q W E R: skills · 1 / 2: potions · T: town portal · V: auto-attack on/off · P: companion · I: inventory · C: character · K: skills · J: quest · Tab: big map · Alt: show item names · Mouse wheel: zoom · F5: save · Esc: menu</div>
      <div style="text-align:center;margin-top:12px"><button class="primary" id="set-done">Done</button></div>`;
    $('#set-q', body).value = Settings.quality;
    $('#set-am', body).value = Settings.autoMode;
    $('#set-am', body).onchange = (e) => { Settings.autoMode = e.target.value; saveSettings(); };
    $('#set-ar', body).oninput = (e) => { Settings.autoRange = +e.target.value; $('#sv-ar').textContent = e.target.value + 'm'; saveSettings(); };
    body.querySelectorAll('[data-k]').forEach((r) => (r.oninput = () => { Settings[r.dataset.k] = r.value / 100; $('#sv-' + r.dataset.k).textContent = r.value + '%'; saveSettings(); }));
    body.querySelectorAll('[data-c]').forEach((c) => (c.onchange = () => { Settings[c.dataset.c] = c.checked; saveSettings(); }));
    $('#set-q', body).onchange = (e) => { Settings.quality = e.target.value; saveSettings(); this.main.applyQuality(); };
    $('#set-rs', body).onchange = (e) => { Settings.renderScale = e.target.value / 100; $('#sv-rs').textContent = e.target.value + '%'; saveSettings(); this.main.applyQuality(); };
    $('#set-sh', body).oninput = (e) => { Settings.sharpen = e.target.value / 100; $('#sv-sh').textContent = e.target.value + '%'; saveSettings(); this.main.resize(); };
    $('#set-fs', body).onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
    $('#set-done', body).onclick = () => { this.close('settings'); if (fromMenu) this.showMenu(); };
  }

  choice(title, text, options, grid = false) {
    this.close('choice');
    const body = this.panel('choice', title, { left: '50%', top: grid ? '16%' : '26%', width: grid ? '560px' : '440px', transform: 'translateX(-50%)', textAlign: 'center' });
    body.appendChild(el('p', '', text));
    const wrap = grid ? el('div', 'choice-grid') : body;
    if (grid) body.appendChild(wrap);
    for (const [label, fn] of options) {
      const b = el('button', '', label);
      wrap.appendChild(b);
      b.onclick = () => { this.close('choice'); fn?.(); };
    }
  }

  death(lost) {
    const body = this.panel('death', 'You have fallen', { left: '50%', top: '28%', width: '420px', transform: 'translateX(-50%)', textAlign: 'center' }, false);
    body.innerHTML = `<p>The Wells claim another... almost. Brother Fennick drags you back to Hollowmere.</p><p class="muted">You dropped ${lost} gold in the dark.</p>`;
    const b = el('button', 'primary big', 'Return to Hollowmere');
    b.onclick = () => { this.close('death'); this.main.respawn(); };
    body.appendChild(b);
  }

  updateAutoChip() {
    const c = $('#hud-auto'); if (!c) return;
    const id = Settings.autoMode !== 'basic' ? G.hotbar[Settings.autoMode] : null;
    const txt = `AUTO ${Settings.autoAttack ? 'ON' : 'OFF'} · ${id ? skillName(id) : 'Basic attack'}`;
    if (c.textContent !== txt) { c.textContent = txt; c.classList.toggle('on', !!Settings.autoAttack); }
    if (!c.onclick) {
      c.onclick = (e) => {
        e.stopPropagation();
        // cycle: off -> basic -> each filled skill slot -> off
        const modes = ['basic', ...['rmb', 'q', 'w', 'e', 'r'].filter((k) => G.hotbar[k] && (G.skills[G.hotbar[k]] || 0) > 0)];
        if (!Settings.autoAttack) { Settings.autoAttack = true; Settings.autoMode = 'basic'; }
        else { const i = modes.indexOf(Settings.autoMode); if (i < 0 || i === modes.length - 1) Settings.autoAttack = false; else Settings.autoMode = modes[i + 1]; }
        saveSettings(); sfx('ui'); this.updateAutoChip();
      };
      c.onmousedown = (e) => e.stopPropagation();
    }
  }
  // ---------------- wardrobe: change the hero's look at any time ----------------
  renderWardrobe() {
    const body = this.body('wardrobe', 'Wardrobe', { left: '24px', top: '60px', width: '440px', maxHeight: '86vh', overflowY: 'auto' });
    const L = G.look, cls = CLASSES[G.cls];
    const sw = (key, list) => `<div class="swatches">${list.map((c) => `<div class="sw ${c === L[key] ? 'on' : ''}" style="background:${c}" data-wl="${key}" data-v="${c}"></div>`).join('')}</div>`;
    body.innerHTML = `<div class="muted" style="margin-bottom:6px">Change how your hero looks. Free, any time. Armor and weapons change your look when equipped, and the forge can dye and restyle them.</div>
      <h3><span>Clothing tint</span></h3>${sw('tint', ARMOR_TINTS)}
      <h3><span>Cape</span></h3>${sw('cape', CAPE_COLORS)}
      <div class="setrow"><span>Wear a cape</span><input type="checkbox" id="wd-cape" ${L.capeOn !== false ? 'checked' : ''}></div>
      <div class="setrow"><span>Show helm</span><input type="checkbox" id="wd-helm" ${L.helm !== false ? 'checked' : ''}></div>
      ${detailRows(L)}`;
    const apply = () => { sfx('ui'); G.player?.refreshVisuals(); this.renderWardrobe(); };
    bindDetails(body, L, apply);
    body.querySelectorAll('[data-wl]').forEach((d) => (d.onclick = () => { L[d.dataset.wl] = d.dataset.v; apply(); }));
    $('#wd-cape', body).onchange = (e) => { L.capeOn = e.target.checked; apply(); };
    $('#wd-helm', body).onchange = (e) => { L.helm = e.target.checked; apply(); };
  }
  // ---------------- companion (pet) panel ----------------
  renderPet() {
    ensurePets();
    const body = this.body('pet', 'Companion', { left: '50%', top: '50px', width: '760px', transform: 'translateX(-50%)', maxHeight: '90vh', overflowY: 'auto' });
    const view = this.petView && PET_SPECIES[this.petView] ? this.petView : G.petSpecies;
    const sp = PET_SPECIES[view], rec = G.pets[view], active = view === G.petSpecies;
    const stg = petStage(rec), inTown = G.level?.kind === 'town';
    const next = STAGE_LEVELS.find((l) => l > rec.lvl);
    const xpF = rec.lvl >= PET_MAX_LEVEL ? 1 : rec.xp / petXpToNext(rec.lvl);
    const c6 = (c) => '#' + c.toString(16).padStart(6, '0');
    let h = `<div class="pet-tabs">${Object.entries(PET_SPECIES).map(([k, v]) => `<button class="pt ${k === view ? 'on' : ''}" data-sp="${k}">${v.name}<small>Lv ${G.pets[k].lvl} · ${v.stages[petStage(G.pets[k])]}${k === G.petSpecies ? ' · active' : ''}</small></button>`).join('')}</div>
      <div class="pet-head"><div><b style="font-size:18px;color:#ffb066">${active ? G.petName : sp.name}</b> <span class="muted">the ${sp.stages[stg]}</span><div class="muted">${sp.desc}</div></div>
      <div style="text-align:right">${active ? '<span style="color:#7dff9a">Your active companion</span>' : `<button id="pet-swap" ${inTown ? '' : 'disabled'} class="primary">Take ${sp.name} as companion</button>${inTown ? '' : '<div class="muted" style="font-size:11px">Companions can only be swapped in town.</div>'}`}</div></div>
      <div class="pet-xp"><div style="width:${(xpF * 100).toFixed(1)}%"></div><span>Pet level ${rec.lvl} / ${PET_MAX_LEVEL}${rec.lvl < PET_MAX_LEVEL ? ` · ${Math.floor(rec.xp)} / ${petXpToNext(rec.lvl)} XP` : ''}</span></div>
      <div class="pet-stages">${sp.stages.map((n, i) => `<span class="${i <= stg ? 'on' : ''}">${n}<small>Lv ${STAGE_LEVELS[i]}</small></span>`).join('<i>➜</i>')}</div>
      <div class="muted" style="text-align:center;margin:4px 0 8px">${next ? `Evolves at pet level ${next}.` : 'Fully evolved.'} Pets earn XP from every foe you slay. Each pet level grants 1 pet skill point.</div>
      <h3><span>Coat</span></h3><div class="chips">${sp.coats.map((c) => `<button class="chip ${rec.coat === c.key ? 'on' : ''}" data-coat="${c.key}"><i class="dot" style="background:${c6(c.color)}"></i>${c.label}</button>`).join('')}</div>
      <h3><span>${sp.name} skills · <b style="color:#ffd84d">${rec.points}</b> points</span></h3>`;
    const NW = 56, CW = 150, RH = 92, W = CW * 2 + NW + 60, H = RH * 2 + NW + 20;
    const xy = (n) => [30 + n.col * CW + NW / 2, 10 + n.tier * RH + NW / 2];
    const tree = PET_TREES[view];
    let lines = '', nodes = '', rows = '';
    for (const n of tree) for (const r of n.req || []) {
      const a = xy(tree.find((m) => m.id === r)), b = xy(n), on = (rec.skills[r] || 0) > 0;
      lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${on ? '#ffb066' : '#3a3022'}" stroke-width="${on ? 4 : 3}" ${on ? '' : 'stroke-dasharray="6 5"'}/>`;
    }
    for (let i = 0; i < PET_TIER_LEVEL.length; i++) rows += `<div class="sk-tier" style="top:${10 + i * RH + NW / 2 - 8}px">Lv ${PET_TIER_LEVEL[i]}</div>`;
    for (const n of tree) {
      const S = PET_SKILLS[n.id], r = rec.skills[n.id] || 0;
      const lockedTier = rec.lvl < PET_TIER_LEVEL[n.tier], missReq = (n.req || []).some((q) => !(rec.skills[q] > 0));
      const can = active && !lockedTier && !missReq && rec.points > 0 && r < PET_MAX_RANK;
      const [x, y] = xy(n);
      nodes += `<div class="sk-node ${r ? 'learned' : ''} ${can ? 'avail' : ''} ${S.active ? 'active' : 'passive'} ${(lockedTier || missReq) && !r ? 'locked' : ''}" data-ps="${n.id}" style="left:${x - NW / 2}px;top:${y - NW / 2}px;--tc:#ffb066">${skillIcon(S.icon)}<span class="rk">${r}/${PET_MAX_RANK}</span></div>
        <div class="pet-lbl" style="left:${x - 70}px;top:${y + NW / 2 + 2}px">${S.name}${S.active ? ' <i>(active)</i>' : ''}</div>`;
    }
    h += `<div class="pet-tree"><div class="sk-canvas" style="width:${W}px;height:${H + 18}px;margin:0 auto">${rows}<svg width="${W}" height="${H}">${lines}</svg>${nodes}</div></div>
      <div id="pet-detail" class="muted" style="min-height:40px;text-align:center;padding:6px">${active ? 'Hover a skill to read it. Click to learn a rank.' : 'Make this pet your companion to spend its skill points. Each pet keeps its own level and skills.'}</div>`;
    body.innerHTML = h;
    body.querySelectorAll('[data-sp]').forEach((d) => (d.onclick = () => { this.petView = d.dataset.sp; sfx('ui'); this.renderPet(); }));
    body.querySelectorAll('[data-coat]').forEach((d) => (d.onclick = () => { rec.coat = d.dataset.coat; sfx('ui'); if (active && G.pet) G.pet.applyForm(true); this.renderPet(); }));
    const sw = $('#pet-swap', body);
    if (sw) sw.onclick = () => this.swapPet(view);
    body.querySelectorAll('[data-ps]').forEach((d) => {
      const id = d.dataset.ps, S = PET_SKILLS[id];
      const r = rec.skills[id] || 0;
      d.onmouseenter = () => { const det = $('#pet-detail'); if (det) det.innerHTML = `<b style="color:#ffb066">${S.name}</b> · Rank ${r}/${PET_MAX_RANK}${S.active ? ' · <i>used automatically</i>' : ''}<br>${S.desc(Math.max(1, r))}${r < PET_MAX_RANK ? `<br><span style="color:#9a8a70">Next rank: ${S.desc(r + 1)}</span>` : ''}`; };
      d.onclick = () => {
        if (!active) { this.flash('Make this pet your companion first'); return; }
        const err = learnPetSkill(id);
        if (err) { this.flash(err); sfx('ui'); return; }
        sfx('level'); G.pet?.applyForm(true); this.renderPet();
      };
    });
  }
  swapPet(sp) {
    if (G.level?.kind !== 'town') { this.flash('Companions can only be swapped in town'); return; }
    G.petSpecies = sp; G.petForm = ''; G.petFormTime = 0;
    ensurePets();
    if (G.pet) { G.pet.dead = false; G.pet.applyForm(true); G.pet.hp = G.pet.maxHp; G.pet.evolve(); }
    msg(`${G.petName} is now a ${PET_SPECIES[sp].stages[petStage()]}.`, '#ffb066');
    sfx('buff');
    this.petView = sp;
    this.refresh();
  }

  // ---------------- fishing ----------------
  openFishing(spot = 'pond') {
    this.close('fish');
    const S = FISH_SPOTS[spot] || FISH_SPOTS.pond;
    const body = this.panel('fish', S.title, { left: '50%', top: '22%', width: '460px', transform: 'translateX(-50%)' });
    body.innerHTML = `<p class="muted" style="text-align:center;margin:0 0 6px">${S.desc}</p>
      <div class="fish-odds" id="fish-odds"></div>
      <p id="fish-status" style="text-align:center">Cast your line and wait for a bite.</p>
      <div class="fishbar"><div class="zone"></div><div class="bob"></div></div>
      <p class="muted">When a fish bites, press <b>Space</b> (or Reel) while the gold marker is inside the green zone.</p>
      <div style="text-align:center"><button id="fish-cast" class="primary">Cast</button><button id="fish-reel" disabled>Reel (Space)</button></div>`;
    this.fish = { state: 'idle', t: 0, pos: 0, dir: 1, zone: [0.4, 0.6], spot };
    $('#fish-cast', body).onclick = () => this.castLine();
    $('#fish-reel', body).onclick = () => this.reel();
    $('.zone', body).style.display = 'none';
    this.fishOdds();
  }
  // chance of hooking a class-fitted legendary at a spot (the millpond builds up luck with every catch)
  legendChance(spot) {
    const S = FISH_SPOTS[spot] || FISH_SPOTS.pond;
    return Math.min(S.legendMax, S.legend + (S.luck ? (G.fishLuck || 0) * S.luck : 0));
  }
  fishOdds() {
    const e = $('#fish-odds'); if (!e || !this.fish) return;
    const S = FISH_SPOTS[this.fish.spot] || FISH_SPOTS.pond;
    const cls = CLASSES[G.cls]?.title || G.cls;
    e.innerHTML = `<span style="color:#ff8c1f">Legendary ${cls} gear: ${(this.legendChance(this.fish.spot) * 100).toFixed(1)}%</span> · <span style="color:#ffe14d">Treasure: ${Math.round(S.treasure * 100)}%</span>${S.luck ? `<br><span class="muted">Angler's luck: +${((G.fishLuck || 0) * S.luck * 100).toFixed(1)}% (grows with every catch here, resets on a legendary)</span>` : ''}`;
  }
  castLine() {
    const f = this.fish; if (!f) return;
    f.state = 'wait'; f.t = 1.5 + Math.random() * 3.5;
    $('#fish-status').textContent = 'Line cast... waiting for a bite.';
    $('#fish-cast').disabled = true; $('#fish-reel').disabled = true;
    $('.fishbar .zone').style.display = 'none';
    G.player?.model.once('Throw', { timeScale: 1.3 });
    sfx('splash');
  }
  updateFishing(dt) {
    const f = this.fish;
    if (f.state === 'wait') {
      f.t -= dt;
      if (f.t <= 0) {
        f.state = 'bite';
        const w = 0.14 + Math.random() * 0.1;
        const s = 0.1 + Math.random() * (0.8 - w);
        f.zone = [s, s + w]; f.pos = 0; f.dir = 1; f.speed = 0.9 + Math.random() * 0.7; f.t = 4;
        const z = $('.fishbar .zone'); z.style.display = ''; z.style.left = s * 100 + '%'; z.style.width = w * 100 + '%';
        $('#fish-status').innerHTML = '<b style="color:#ffdd55">A bite! Reel it in!</b>';
        $('#fish-reel').disabled = false;
        sfx('splash');
      }
    } else if (f.state === 'bite') {
      f.pos += f.dir * f.speed * dt;
      if (f.pos > 1) { f.pos = 1; f.dir = -1; } if (f.pos < 0) { f.pos = 0; f.dir = 1; }
      f.t -= dt;
      $('.fishbar .bob').style.left = `calc(${f.pos * 100}% - 3px)`;
      if (f.t <= 0) this.fishResult(false, 'It got away...');
    }
  }
  reel() {
    const f = this.fish;
    if (!f || f.state !== 'bite') return;
    if (f.pos >= f.zone[0] && f.pos <= f.zone[1]) {
      const S = FISH_SPOTS[f.spot] || FISH_SPOTS.pond;
      const ilvl = Math.max(G.lvl, G.deepest || 0, G.currentFloor || 0) + 2;
      const r = Math.random(), lc = this.legendChance(f.spot);
      if (r < lc) {
        const it = classItem(G.cls, ilvl, 3);
        G.fishLuck = 0;
        this.fishResult(true, `<b>LEGENDARY!</b> Something ancient glints on your hook... the ${displayName(it)}!`, it);
        sfx('legend');
        this.main.fx?.emit(G.player.pos.clone().setY(1.2), { count: 60, color: 0xff8c1f, speed: 4, up: 4, life: 1.2, size: 0.3 });
        msg(`You fished up a legendary ${typeOf(it).name}: ${displayName(it)}!`, '#ff8c1f');
      } else if (r < lc + S.treasure) {
        const it = S.classTreasure ? classItem(G.cls, ilvl, 1 + (Math.random() < 0.35 ? 1 : 0)) : this.main.randomTreasure();
        if (S.luck) G.fishLuck = (G.fishLuck || 0) + 1;
        this.fishResult(true, `You hooked something heavy... a ${displayName(it)}!`, it);
      } else {
        const fish = makeFish(); if (S.luck) G.fishLuck = (G.fishLuck || 0) + 1;
        this.fishResult(true, `You caught a ${fish.name}!`, fish);
      }
      this.fishOdds();
    } else this.fishResult(false, 'The line snaps. It got away.');
  }
  fishResult(ok, text, item) {
    const f = this.fish;
    f.state = 'idle';
    $('#fish-status').innerHTML = ok ? `<span style="color:${hex(itemColor(item))}">${text}</span>` : text;
    $('#fish-cast').disabled = false; $('#fish-reel').disabled = true;
    if (ok) {
      G.fishCaught++;
      G.player?.model.once('Cheer', { timeScale: 1.5 });
      if (G.backpack.length < BACKPACK_MAX) { G.backpack.push(item); sfx('pick'); }
      else { this.main.dropItem(item); msg('Backpack full, the catch flops onto the ground.'); }
      if (item.form) msg(`Feed the ${item.name} to ${G.petName} from your inventory to transform it.`, '#99e6ff');
      this.refresh();
    }
  }

  // ---------------- title menu ----------------
  showMenu() {
    this.hud.classList.add('hidden');
    $('#create').classList.add('hidden'); delete this.open.create;
    const m = $('#menu');
    m.classList.remove('hidden');
    this.open.menu = true;
    m.innerHTML = `<div class="title">HOLLOWMERE</div><div class="subtitle">THE SUNKEN WELLS</div>
      <button id="m-cont" class="primary" ${hasSave() ? '' : 'disabled'}>Continue</button>
      <button id="m-new">New Hero</button>
      <button id="m-set">Settings</button>
      <button id="m-quit">Quit</button>
      <div class="foot">An original action RPG · v0.4 · 3D models by Kay Lousberg (KayKit, CC0) · Music and sound made in code</div>`;
    $('#m-new').onclick = () => { sfx('ui'); if (hasSave()) this.confirmNew(); else this.main.openCreation(); };
    $('#m-cont').onclick = () => { sfx('ui'); this.main.continueGame(); };
    $('#m-set').onclick = () => { sfx('ui'); m.classList.add('hidden'); this.renderSettings(true); };
    $('#m-quit').onclick = () => window.close();
  }
  confirmNew() {
    $('#menu').classList.add('hidden');
    this.choice('Start a new hero?', 'Your current saved hero will be replaced.', [['Create new hero', () => this.main.openCreation()], ['Cancel', () => this.showMenu()]]);
  }
  hideMenu() { $('#menu').classList.add('hidden'); delete this.open.menu; }
  showHud() { this.hud.classList.remove('hidden'); this.refreshSlotIcons(); }

  // ---------------- character creation ----------------
  showCreation(state, onChange, onBegin, onBack) {
    this.hideMenu();
    const c = $('#create');
    c.classList.remove('hidden');
    this.open.create = true;
    state.tab = state.tab || 'class';
    const statName = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', mag: 'Magic' };
    const render = () => {
      const cls = CLASSES[state.cls];
      const tab = (k, t) => `<button class="crtab ${state.tab === k ? 'on' : ''}" data-tab="${k}">${t}</button>`;
      let inner = '';
      if (state.tab === 'class') {
        inner = `<div class="muted" style="text-align:center;margin-bottom:10px">${cls.desc}</div>
          ${['str', 'dex', 'vit', 'mag'].map((k) => `<div class="statbar"><span>${statName[k]}</span><div><i style="width:${(cls.base[k] / 20) * 100}%"></i></div><b>${cls.base[k]}</b></div>`).join('')}
          <h3><span>Starting skills</span></h3><div class="muted">${Object.keys(cls.skills).map(skillName).join(', ')}. You can learn every skill tree later.</div>`;
      } else if (state.tab === 'look') {
        inner = `<h3><span>Weapons</span></h3><div class="chips">${cls.gear.map((g, i) => `<button class="chip ${state.gear === i ? 'on' : ''}" data-gear="${i}">${g.label}</button>`).join('')}</div>
          <h3><span>Armor tint</span></h3><div class="swatches">${ARMOR_TINTS.map((col) => `<div class="sw ${col === state.tint ? 'on' : ''}" style="background:${col}" data-tint="${col}"></div>`).join('')}</div>
          <h3><span>Cape</span></h3><div class="swatches">${CAPE_COLORS.map((col) => `<div class="sw ${col === state.cape ? 'on' : ''}" style="background:${col}" data-cape="${col}"></div>`).join('')}</div>
          <div class="setrow"><span>Wear a cape</span><input type="checkbox" id="cr-capeon" ${state.capeOn ? 'checked' : ''}></div>
          ${cls.alt ? `<div class="setrow"><span>Wear a hood</span><input type="checkbox" id="cr-hood" ${state.hooded ? 'checked' : ''}></div>` : ''}
          ${cls.headgear ? `<div class="setrow"><span>Wear ${state.cls === 'Mage' ? 'hat' : 'helmet'}</span><input type="checkbox" id="cr-helm" ${state.helm ? 'checked' : ''}></div>` : ''}
          <div class="setrow"><span>Height</span><span><input type="range" id="cr-height" min="88" max="112" value="${Math.round(state.height * 100)}"> ${Math.round(state.height * 100)}%</span></div>
          ${detailRows(state)}`;
      } else {
        const PS = PET_SPECIES[state.petSpecies] || PET_SPECIES.fox;
        inner = `<h3><span>Companion</span></h3><div class="chips">${Object.entries(PET_SPECIES).map(([k, v]) => `<button class="chip ${state.petSpecies === k ? 'on' : ''}" data-psp="${k}">${v.name}</button>`).join('')}</div>
          <div class="muted" style="margin:6px 0 8px">${PS.desc} Grows from ${PS.stages.join(' to ')} and has its own skill tree. You can meet the other companions at the Beastmaster in town.</div>
          <h3><span>Coat</span></h3><div class="chips">${PS.coats.map((p) => `<button class="chip ${state.pet === p.key ? 'on' : ''}" data-pet="${p.key}"><i class="dot" style="background:#${p.color.toString(16).padStart(6, '0')}"></i>${p.label}</button>`).join('')}</div>
          <h3><span>Companion name</span></h3><input type="text" id="cr-petname" maxlength="14" value="${state.petName}" style="width:100%">`;
      }
      c.innerHTML = `<div class="panel cls"><h2>Choose your class</h2>${Object.entries(CLASSES).map(([k, v]) => `<div class="clscard ${k === state.cls ? 'on' : ''}" data-cls="${k}"><div class="ic">${skillIcon(skillIconKey(Object.keys(v.skills)[0]))}</div><div><b>${v.title}</b><small>${v.desc}</small></div></div>`).join('')}</div>
        <div class="panel info"><h2>${cls.title}</h2>
          <div class="crtabs">${tab('class', 'Class')}${tab('look', 'Appearance')}${tab('pet', 'Companion')}</div>
          <div class="crbody">${inner}</div>
          <h3><span>Hero name</span></h3><input type="text" id="cr-name" maxlength="18" placeholder="Name your hero" value="${state.name}" style="width:100%">
          <div style="text-align:center;margin-top:14px"><button id="cr-rand">Randomize</button><button id="cr-back">Back</button><button id="cr-go" class="primary big">Begin</button></div>
        </div>`;
      const upd = () => { sfx('ui'); onChange(); render(); };
      c.querySelectorAll('[data-tab]').forEach((d) => (d.onclick = () => { state.tab = d.dataset.tab; sfx('ui'); render(); }));
      c.querySelectorAll('[data-cls]').forEach((d) => (d.onclick = () => { state.cls = d.dataset.cls; state.cape = CLASSES[state.cls].cape; state.hooded = false; state.gear = 0; Object.assign(state, CLASS_DETAILS[state.cls]); upd(); }));
      bindDetails(c, state, upd);
      c.querySelectorAll('[data-cape]').forEach((d) => (d.onclick = () => { state.cape = d.dataset.cape; upd(); }));
      c.querySelectorAll('[data-tint]').forEach((d) => (d.onclick = () => { state.tint = d.dataset.tint; upd(); }));
      c.querySelectorAll('[data-gear]').forEach((d) => (d.onclick = () => { state.gear = +d.dataset.gear; upd(); }));
      c.querySelectorAll('[data-pet]').forEach((d) => (d.onclick = () => { state.pet = d.dataset.pet; upd(); }));
      c.querySelectorAll('[data-psp]').forEach((d) => (d.onclick = () => { state.petSpecies = d.dataset.psp; state.pet = PET_SPECIES[state.petSpecies].coats[0].key; upd(); }));
      const chk = (id, key) => { const e = $(id, c); if (e) e.onchange = () => { state[key] = e.checked; upd(); }; };
      chk('#cr-hood', 'hooded'); chk('#cr-helm', 'helm'); chk('#cr-capeon', 'capeOn');
      const ht = $('#cr-height', c); if (ht) ht.onchange = () => { state.height = ht.value / 100; upd(); };
      const pn = $('#cr-petname', c); if (pn) pn.oninput = () => { state.petName = pn.value; };
      const nm = $('#cr-name', c);
      nm.oninput = () => { state.name = nm.value; };
      nm.onkeydown = (e) => { if (e.key === 'Enter') onBegin(); };
      $('#cr-rand', c).onclick = () => {
        const pk = (a) => a[Math.floor(Math.random() * a.length)];
        const cl = CLASSES[state.cls];
        Object.assign(state, { cape: pk(CAPE_COLORS), tint: pk(ARMOR_TINTS), gear: Math.floor(Math.random() * cl.gear.length), helm: Math.random() < 0.7, hooded: !!cl.alt && Math.random() < 0.5, capeOn: Math.random() < 0.85, height: 0.9 + Math.random() * 0.2 });
        { const sk = pk(Object.keys(PET_SPECIES)); state.petSpecies = sk; state.pet = pk(PET_SPECIES[sk].coats).key; }
        Object.assign(state, { skin: pk(SKIN_TONES), shoulders: pk(DETAIL_OPTIONS.shoulders)[0], belt: pk(DETAIL_OPTIONS.belt)[0], back: pk(DETAIL_OPTIONS.back)[0], metal: pk(DETAIL_OPTIONS.metal)[0], scarf: pk(SCARF_COLORS) });
        if (!state.name) state.name = pk(['Aldric', 'Wren', 'Corvin', 'Isolde', 'Bram', 'Mira', 'Talon', 'Sable', 'Rook', 'Elowen', 'Garrick', 'Nyx']);
        upd();
      };
      $('#cr-go', c).onclick = () => onBegin();
      $('#cr-back', c).onclick = () => onBack();
      c.querySelectorAll('.panel').forEach((p) => p.addEventListener('mousedown', (e) => e.stopPropagation()));
    };
    render();
  }
  hideCreation() { $('#create').classList.add('hidden'); delete this.open.create; }

  clearWorld() {
    for (const d of this.labels.values()) d.remove();
    this.labels.clear();
    for (const f of this.floats) f.el.remove();
    this.floats = [];
  }
}
