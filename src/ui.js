import * as THREE from 'three';
import { G, BACKPACK_MAX, maxHp, maxMp, xpToNext, stat, armor, weaponDamage, attackSpeed, critChance, fameTitle, equipFromPack, unequip, feedPet, petSellCommons, ensureQuestOffer, acceptQuest, turnInQuest, saveGame, hasSave, petDamage, petMaxHp, msg } from './state.js';
import { describe, itemColor, sellPrice, buyPrice, SLOT_NAMES, makeFish, generate } from './items.js';
import { FAME_STEPS, QUEST_GIVER } from './data.js';
import { hex, sfx, clamp } from './util.js';
import { itemIcon, skillIcon } from './icons.js';
import { SKILLS, PASSIVES, CLASSES, CAPE_COLORS, ARMOR_TINTS, PET_COATS, TREES, NODE, TIER_LEVEL, canCast, learnBlock, maxRank, isActive, skillName, skillIconKey, treePoints, synergyText } from './skills.js';
import { Settings, saveSettings } from './settings.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const SLOTKEYS = ['rmb', 'q', 'w', 'e', 'r'];
const KEYLABEL = { rmb: 'RMB', q: 'Q', w: 'W', e: 'E', r: 'R' };

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
        <div id="hud-target" class="hidden"><div id="hud-target-name"></div><div class="bar"><div></div><span></span></div></div>
        <div id="hud-right">
          <div id="mmwrap"><canvas id="minimap" width="208" height="208"></canvas></div>
          <div id="hud-loc"></div><div id="hud-gold"></div><div id="hud-fame" style="color:#c99bff"></div><div id="hud-quest"></div>
        </div>
        <div id="log"></div>
        <div id="hud-bottom">
          <div class="orb hp"><div class="fill"></div><div class="shine"></div><div class="txt"></div></div>
          <div id="barmid"><div id="xpbar"><div></div></div><div id="slots"></div></div>
          <div class="orb mp"><div class="fill"></div><div class="shine"></div><div class="txt"></div></div>
        </div>
        <div id="help">I Inventory · C Character · K Skills · J Quest · Tab Map · Alt Show items · Esc Menu</div>
      </div>
      <div id="flash"></div>
      <div id="banner"></div>
      <div id="panels"></div>
      <div id="tooltip" class="hidden"></div>
      <div id="menu" class="hidden"></div>
      <div id="create" class="hidden"></div>
      <div id="loading"><div class="title" style="font-size:64px">HOLLOWMERE</div><div class="muted" id="load-txt">Loading the Sunken Wells...</div><div class="lb"><div></div></div></div>`;
    this.hud = $('#hud');
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
    $('.orb.hp .txt').textContent = `${Math.ceil(G.hp)} / ${Math.round(maxHp())}`;
    $('.orb.mp .txt').textContent = `${Math.floor(G.mp)} / ${Math.round(maxMp())}`;
    $('#lowhp').style.opacity = hpF < 0.3 ? (0.3 - hpF) * 2.5 * (0.7 + Math.sin(performance.now() / 200) * 0.3) : 0;
    $('#xpbar div').style.width = (G.xp / xpToNext()) * 100 + '%';
    const pet = G.pet;
    const pb = $('#pet-wrap .bar');
    const formName = { golem: 'Stone Golem', wyrm: 'Ember Wyrm', stag: 'Spirit Stag' }[G.petForm];
    if (pet && !pet.dead && G.petAwayTime <= 0) { pb.firstElementChild.style.width = clamp(pet.hp / pet.maxHp, 0, 1) * 100 + '%'; pb.lastElementChild.textContent = `${G.petName}${formName ? ` · ${formName} ${Math.ceil(G.petFormTime)}s` : ''}`; }
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
    $('#hud-gold').textContent = `${G.gold.toLocaleString()} gold`;
    $('#hud-fame').textContent = `Fame: ${fameTitle()}`;
    const q = G.quest;
    $('#hud-quest').textContent = q ? `◆ ${q.title}: ${q.done ? 'Complete! Return to town' : q.type === 'slay' ? `${q.progress}/${q.count}` : `floor ${q.floor}`}` : '';
    const tg = (pl.hover && pl.hover.type === 'enemy' && !pl.hover.dead) ? pl.hover : (pl.lastHit && !pl.lastHit.dead && pl.lastHit.root.parent ? pl.lastHit : null);
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
      s.classList.toggle('off', !!err && err !== 'Not ready');
      const cdMax = SKILLS[id].cdv() || 1;
      s.querySelector('.cd').style.height = Math.max(0, (G.cds[id] || 0) / cdMax) * 100 + '%';
    }
    this.slotEls.hp.querySelector('.cnt').textContent = G.hpPotions;
    this.slotEls.mp.querySelector('.cnt').textContent = G.mpPotions;
    this.slotEls.scroll.querySelector('.cnt').textContent = G.scrolls;
    $('#help').classList.toggle('hidden', !Settings.showHelp);
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
    const fn = { inv: this.renderInv, char: this.renderChar, skills: this.renderSkills, shop: this.renderShop, quest: this.renderQuest, pause: this.renderPause, settings: this.renderSettings, forge: this.renderForge }[name];
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
    const petInfo = el('div', '', `<div style="font-size:12px;text-align:center;padding-top:14px;color:#ffb066">${G.petName}<br><span class="muted">${{ golem: 'Golem', wyrm: 'Wyrm', stag: 'Stag' }[G.petForm] || 'Fox'}</span></div>`);
    petInfo.style.gridColumn = 2; petInfo.style.gridRow = 3;
    eq.appendChild(petInfo);
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
    btn(selIt?.slot === 'fish' ? 'Feed Pet' : 'Equip', () => this.quickUse(this.sel.key, true), !selIt);
    if (this.open.shop) btn('Sell', () => this.sell(this.sel.key), !selIt);
    btn('Drop', () => { const it = G.backpack.splice(this.sel.key, 1)[0]; this.main.dropItem(it); this.sel = null; }, !selIt);
    btn(`Send ${G.petName} to sell commons`, () => petSellCommons(), G.level.kind === 'town' && !this.open.shop);
    body.appendChild(bar);
  }
  quickUse(i, viaButton = false) {
    const it = G.backpack[i];
    if (!it) return;
    if (this.open.shop && !viaButton) return this.sell(i);
    if (it.slot === 'fish') feedPet(i); else equipFromPack(i);
    this.sel = null; this.hideTooltip(); this.refresh();
  }
  sell(i) {
    const it = G.backpack[i];
    if (!it) return;
    G.backpack.splice(i, 1);
    const p = sellPrice(it);
    G.gold += p;
    msg(`Sold ${it.name} for ${p} gold`, '#ffd84d');
    sfx('gold');
    this.sel = null; this.hideTooltip(); this.refresh();
  }

  renderChar() {
    const body = this.body('char', 'Character', { left: '18px', top: '90px', width: '400px', maxHeight: '80vh', overflowY: 'auto' });
    const d = weaponDamage();
    const cls = CLASSES[G.cls];
    const labels = { str: ['Strength', 'Melee damage'], dex: ['Dexterity', 'Attack speed, crit, dodge'], vit: ['Vitality', 'Life'], mag: ['Magic', 'Spell power, mana'] };
    let html = `<div style="text-align:center;margin-bottom:8px"><div style="font-size:19px;color:#fff">${G.heroName}</div><div class="muted">Level ${G.lvl} ${cls.title} · ${G.xp} / ${xpToNext()} xp</div><div style="color:#c99bff;font-size:13px">${fameTitle()} (${G.fame}${G.fameRank < FAME_STEPS.length - 1 ? ' / ' + FAME_STEPS[G.fameRank + 1] : ''} fame)</div></div>
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
    const body = this.body('skills', 'Skill Trees', { left: '50%', top: '56px', width: '1010px', transform: 'translateX(-50%)', maxHeight: '88vh', overflowY: 'auto' });
    if (!this.skSel) this.skSel = G.hotbar.rmb || 'firebolt';
    const NW = 64, CW = 96, RH = 92, PADX = 26, PADY = 14;
    let html = `<div class="sk-top"><span>Skill points: <b style="color:#ffd84d">${G.skillPoints}</b></span><span class="muted">Click a skill to learn a rank. Rows unlock at levels ${TIER_LEVEL.join(', ')}. Any class can learn any tree.</span></div><div class="sk-trees">`;
    for (const t of TREES) {
      const W = PADX * 2 + CW * 2 + NW, H = PADY * 2 + RH * 3 + NW;
      const xy = (n) => [PADX + n.col * CW + NW / 2, PADY + n.tier * RH + NW / 2];
      let lines = '';
      for (const n of t.nodes) for (const r of n.req || []) {
        const a = xy(NODE[r]), b = xy(n);
        const on = (G.skills[r] || 0) > 0;
        lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${on ? t.color : '#3a3022'}" stroke-width="${on ? 4 : 3}" ${on ? '' : 'stroke-dasharray="6 5"'}/>`;
      }
      let rows = '';
      for (let i = 0; i < 4; i++) rows += `<div class="sk-tier" style="top:${PADY + i * RH + NW / 2 - 8}px">Lv ${TIER_LEVEL[i]}</div>`;
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
    const body = this.body('forge', "Hobb's Forge", { left: '18px', top: '90px', width: '470px', maxHeight: '78vh', overflowY: 'auto' });
    const list = [];
    for (const k in G.equipment) { const it = G.equipment[k]; if (it && it.rarity >= 1) list.push({ it, where: 'eq', key: k }); }
    G.backpack.forEach((it, i) => { if (it.rarity >= 1 && it.slot in G.equipment) list.push({ it, where: 'bp', key: i }); });
    let h = '<div class="muted" style="text-align:center;margin-bottom:8px">"Bring me anything with a spark of magic and I will hammer it into something new." Reforging rerolls an item of the same kind and rarity.</div>';
    if (!list.length) h += '<p style="text-align:center">You have no magic, rare or legendary gear to reforge.</p>';
    body.innerHTML = h;
    for (const e of list) {
      const cost = Math.max(60, Math.round(sellPrice(e.it) * 4));
      const row = el('div', 'skrow');
      row.innerHTML = `<div class="ic">${itemIcon(e.it, hex(itemColor(e.it)))}</div><div class="bd"><b style="color:${hex(itemColor(e.it))}">${e.it.name}</b><small>${e.where === 'eq' ? 'Equipped' : 'In backpack'} · item level ${e.it.ilvl}</small></div>`;
      const b = el('button', '', `Reforge · ${cost}g`);
      b.disabled = G.gold < cost;
      b.onclick = () => {
        if (G.gold < cost) return;
        let n = null;
        for (let i = 0; i < 120 && !n; i++) { const c = generate(e.it.ilvl, 0, e.it.rarity); if (c.slot === e.it.slot && c.rarity === e.it.rarity) n = c; }
        if (!n) { this.flash('The metal resists. Try again.'); return; }
        G.gold -= cost;
        if (e.where === 'eq') G.equipment[e.key] = n; else G.backpack[e.key] = n;
        msg(`Hobb reforges your ${e.it.name} into ${n.name}!`, hex(itemColor(n)));
        sfx('legend');
        G.player?.refreshVisuals();
        this.refresh();
      };
      row.appendChild(b);
      row.querySelector('.ic').onmouseenter = () => this.showTooltip(e.it);
      row.querySelector('.ic').onmouseleave = () => this.hideTooltip();
      body.appendChild(row);
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
    b('Save Game', () => { if (saveGame()) this.flash('Game saved'); });
    b('Save & Quit to Title', () => { saveGame(); this.close('pause'); this.main.toMenu(); });
    b('Quit to Desktop', () => { saveGame(); window.close(); });
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
      <h3><span>Controls</span></h3><div class="muted" style="line-height:1.6">Left-click: move, attack, pick up, talk · Right-click / Q W E R: skills · 1 / 2: potions · T: town portal · I: inventory · C: character · K: skills · J: quest · Tab: big map · Alt: show item names · Mouse wheel: zoom · F5: save · Esc: menu</div>
      <div style="text-align:center;margin-top:12px"><button class="primary" id="set-done">Done</button></div>`;
    $('#set-q', body).value = Settings.quality;
    body.querySelectorAll('[data-k]').forEach((r) => (r.oninput = () => { Settings[r.dataset.k] = r.value / 100; $('#sv-' + r.dataset.k).textContent = r.value + '%'; saveSettings(); }));
    body.querySelectorAll('[data-c]').forEach((c) => (c.onchange = () => { Settings[c.dataset.c] = c.checked; saveSettings(); }));
    $('#set-q', body).onchange = (e) => { Settings.quality = e.target.value; saveSettings(); this.main.applyQuality(); };
    $('#set-rs', body).onchange = (e) => { Settings.renderScale = e.target.value / 100; $('#sv-rs').textContent = e.target.value + '%'; saveSettings(); this.main.applyQuality(); };
    $('#set-sh', body).oninput = (e) => { Settings.sharpen = e.target.value / 100; $('#sv-sh').textContent = e.target.value + '%'; saveSettings(); this.main.resize(); };
    $('#set-fs', body).onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
    $('#set-done', body).onclick = () => { this.close('settings'); if (fromMenu) this.showMenu(); };
  }

  choice(title, text, options) {
    this.close('choice');
    const body = this.panel('choice', title, { left: '50%', top: '26%', width: '440px', transform: 'translateX(-50%)', textAlign: 'center' });
    body.appendChild(el('p', '', text));
    for (const [label, fn] of options) {
      const b = el('button', '', label);
      b.onclick = () => { this.close('choice'); fn?.(); };
      body.appendChild(b);
    }
  }

  death(lost) {
    const body = this.panel('death', 'You have fallen', { left: '50%', top: '28%', width: '420px', transform: 'translateX(-50%)', textAlign: 'center' }, false);
    body.innerHTML = `<p>The Wells claim another... almost. Brother Fennick drags you back to Hollowmere.</p><p class="muted">You dropped ${lost} gold in the dark.</p>`;
    const b = el('button', 'primary big', 'Return to Hollowmere');
    b.onclick = () => { this.close('death'); this.main.respawn(); };
    body.appendChild(b);
  }

  // ---------------- fishing ----------------
  openFishing() {
    this.close('fish');
    const body = this.panel('fish', 'Fishing', { left: '50%', top: '22%', width: '440px', transform: 'translateX(-50%)' });
    body.innerHTML = `<p id="fish-status" style="text-align:center">Cast your line and wait for a bite.</p>
      <div class="fishbar"><div class="zone"></div><div class="bob"></div></div>
      <p class="muted">When a fish bites, press <b>Space</b> (or Reel) while the gold marker is inside the green zone.</p>
      <div style="text-align:center"><button id="fish-cast" class="primary">Cast</button><button id="fish-reel" disabled>Reel (Space)</button></div>`;
    this.fish = { state: 'idle', t: 0, pos: 0, dir: 1, zone: [0.4, 0.6] };
    $('#fish-cast', body).onclick = () => this.castLine();
    $('#fish-reel', body).onclick = () => this.reel();
    $('.zone', body).style.display = 'none';
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
      if (Math.random() < 0.04) { const it = this.main.randomTreasure(); this.fishResult(true, `You hooked something heavy... a ${it.name}!`, it); }
      else { const fish = makeFish(); this.fishResult(true, `You caught a ${fish.name}!`, fish); }
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
      <div class="foot">An original action RPG · v0.3 · 3D models by Kay Lousberg (KayKit, CC0) · Music and sound made in code</div>`;
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
          <div class="setrow"><span>Height</span><span><input type="range" id="cr-height" min="88" max="112" value="${Math.round(state.height * 100)}"> ${Math.round(state.height * 100)}%</span></div>`;
      } else {
        inner = `<h3><span>Companion</span></h3><div class="muted" style="margin-bottom:8px">Your lantern-tailed fox fights beside you and can sell loot in town.</div>
          <div class="chips">${PET_COATS.map((p) => `<button class="chip ${state.pet === p.key ? 'on' : ''}" data-pet="${p.key}"><i class="dot" style="background:#${p.color.toString(16).padStart(6, '0')}"></i>${p.label}</button>`).join('')}</div>
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
      c.querySelectorAll('[data-cls]').forEach((d) => (d.onclick = () => { state.cls = d.dataset.cls; state.cape = CLASSES[state.cls].cape; state.hooded = false; state.gear = 0; upd(); }));
      c.querySelectorAll('[data-cape]').forEach((d) => (d.onclick = () => { state.cape = d.dataset.cape; upd(); }));
      c.querySelectorAll('[data-tint]').forEach((d) => (d.onclick = () => { state.tint = d.dataset.tint; upd(); }));
      c.querySelectorAll('[data-gear]').forEach((d) => (d.onclick = () => { state.gear = +d.dataset.gear; upd(); }));
      c.querySelectorAll('[data-pet]').forEach((d) => (d.onclick = () => { state.pet = d.dataset.pet; upd(); }));
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
        Object.assign(state, { cape: pk(CAPE_COLORS), tint: pk(ARMOR_TINTS), gear: Math.floor(Math.random() * cl.gear.length), helm: Math.random() < 0.7, hooded: !!cl.alt && Math.random() < 0.5, capeOn: Math.random() < 0.85, height: 0.9 + Math.random() * 0.2, pet: pk(PET_COATS).key });
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
