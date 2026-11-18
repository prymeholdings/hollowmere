import * as THREE from 'three';
import { G, BACKPACK_MAX, maxHp, maxMp, xpToNext, stat, armor, weaponDamage, attackSpeed, critChance, fameTitle, equipFromPack, unequip, feedPet, petSellCommons, ensureQuestOffer, acceptQuest, turnInQuest, saveGame, hasSave, fireboltDamage, fireboltCost, healAmount, novaDamage, petDamage, petMaxHp, itemBonus, msg } from './state.js';
import { describe, itemColor, sellPrice, buyPrice, SLOT_ICONS, SLOT_NAMES, makeFish } from './items.js';
import { FAME_STEPS, QUEST_GIVER } from './data.js';
import { hex, sfx, clamp } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class UI {
  constructor(main) {
    this.main = main;
    this.root = $('#ui');
    this.labels = new Map();
    this.floats = [];
    this.open = {};
    this.sel = null; // {src:'pack'|'equip'|'shop', key}
    this.fish = null;
    this.mmTimer = 0;
    this.build();
    G.onMessage = (t, c) => this.log(t, c);
  }

  build() {
    this.root.innerHTML = `
      <div id="world-labels"></div>
      <div id="hud" class="hidden">
        <div id="hud-left">
          <div id="hud-name"></div>
          <div class="bar hp"><div></div><span></span></div>
          <div class="bar mp"><div></div><span></span></div>
          <div class="bar xp"><div></div></div>
          <div id="pet-wrap"><div class="bar pet"><div></div><span></span></div></div>
          <div id="hud-points" class="pe hidden">Points to spend! Press C</div>
          <div id="hud-buffs" style="font-size:13px;color:#9fe0ff;text-shadow:1px 1px 2px #000"></div>
        </div>
        <div id="hud-target" class="hidden"><div id="hud-target-name"></div><div class="bar"><div></div><span></span></div></div>
        <div id="hud-right">
          <canvas id="minimap" width="200" height="200"></canvas>
          <div id="hud-loc" style="font-size:17px;color:#f0c674"></div>
          <div id="hud-gold"></div>
          <div id="hud-fame" style="color:#c99bff"></div>
          <div id="hud-quest" style="color:#a6ffa6;font-size:13px;max-width:260px;margin-left:auto"></div>
        </div>
        <div id="hotbar"></div>
        <div id="log"></div>
        <div id="help">LMB move / attack / use · RMB Firebolt · Q Heal · E Frost Nova<br>1 / 2 potions · T Town Portal · I Inventory · C Character · J Quest · Tab map · Esc menu</div>
      </div>
      <div id="flash"></div>
      <div id="banner"></div>
      <div id="panels"></div>
      <div id="tooltip" class="hidden"></div>
      <div id="menu" class="hidden"></div>`;
    this.hud = $('#hud');
    this.labelLayer = $('#world-labels');
    this.panels = $('#panels');
    this.tooltip = $('#tooltip');
    $('#hud-points').onclick = () => this.toggle('char');
    const hb = $('#hotbar');
    const slots = [['LMB', '⚔', 'Attack'], ['RMB', '🔥', 'Firebolt', 'firebolt'], ['Q', '✚', 'Heal', 'heal'], ['E', '❄', 'Nova', 'nova'], ['1', '❤', 'Potion', 'hp'], ['2', '💧', 'Potion', 'mp'], ['T', '🌀', 'Portal', 'scroll']];
    this.slotEls = {};
    for (const [k, ic, name, id] of slots) {
      const s = el('div', 'slot', `<span class="key">${k}</span><div class="ic">${ic}</div>${name}<span class="cnt"></span>`);
      hb.appendChild(s);
      if (id) this.slotEls[id] = s;
    }
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; if (!this.tooltip.classList.contains('hidden')) this.placeTooltip(); });
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
  flash(t) {
    const f = $('#flash'); f.textContent = t;
    clearTimeout(this.flashT); this.flashT = setTimeout(() => (f.textContent = ''), 1200);
  }
  banner(t) {
    const b = $('#banner'); b.textContent = t; b.style.opacity = 1;
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => (b.style.opacity = 0), 2200);
  }
  floatText(pos, text, color, size, yOff) {
    const d = el('div', 'ft', String(text));
    d.style.color = color; d.style.fontSize = size + 'px';
    this.labelLayer.appendChild(d);
    this.floats.push({ el: d, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, yOff, 0)), t: 0 });
  }

  // ---------------- per-frame ----------------
  project(v) {
    const p = v.clone().project(this.main.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, ok: p.z < 1 };
  }
  update(dt) {
    if (!G.level || !G.player) return;
    // world labels
    const seen = new Set();
    const pl = G.player;
    const showAll = this.main.keys.Alt;
    for (const e of G.level.entities) {
      if (!e.label) continue;
      const hovered = pl.hover === e;
      const near = e.root.position.distanceTo(pl.root.position) < 26;
      const show = near && (e.label.always || e.label.clickable || hovered || showAll);
      if (!show) continue;
      seen.add(e);
      let d = this.labels.get(e);
      if (!d) {
        d = el('div', 'lbl' + (e.label.clickable ? ' click' : ''), e.label.text);
        d.style.color = e.label.color;
        if (e.label.clickable) d.onmousedown = (ev) => { if (ev.button === 0) { ev.stopPropagation(); pl.setTarget(e); } };
        this.labelLayer.appendChild(d);
        this.labels.set(e, d);
      }
      const p = this.project(e.root.position.clone().setY(e.label.y));
      d.style.display = p.ok ? '' : 'none';
      d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    }
    for (const [e, d] of this.labels) if (!seen.has(e)) { d.remove(); this.labels.delete(e); }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      f.pos.y += dt * 1.6;
      const p = this.project(f.pos);
      f.el.style.left = p.x + 'px'; f.el.style.top = p.y + 'px';
      f.el.style.opacity = clamp(1.3 - f.t * 1.3, 0, 1);
      if (f.t > 1.0) { f.el.remove(); this.floats.splice(i, 1); }
    }
    // bars
    const set = (sel, frac, text) => { const b = $(sel); b.firstElementChild.style.width = clamp(frac, 0, 1) * 100 + '%'; if (text !== undefined) b.lastElementChild.textContent = text; };
    $('#hud-name').textContent = `${G.heroName} · Level ${G.lvl}`;
    set('#hud-left .hp', G.hp / maxHp(), `${Math.ceil(G.hp)} / ${Math.round(maxHp())}`);
    set('#hud-left .mp', G.mp / maxMp(), `${Math.floor(G.mp)} / ${Math.round(maxMp())}`);
    set('#hud-left .xp', G.xp / xpToNext());
    const pet = G.pet;
    const petBar = $('#pet-wrap .bar');
    if (pet && !pet.dead && G.petAwayTime <= 0) set('#pet-wrap .bar', pet.hp / pet.maxHp, `${G.petName}${G.petForm ? ' (' + { golem: 'Stone Golem', wyrm: 'Ember Wyrm', stag: 'Spirit Stag' }[G.petForm] + ' ' + Math.ceil(G.petFormTime) + 's)' : ''}`);
    else set('#pet-wrap .bar', 0, G.petAwayTime > 0 ? `${G.petName} is selling in town (${Math.ceil(G.petAwayTime)}s)` : `${G.petName} is resting in town`);
    $('#hud-points').classList.toggle('hidden', !(G.statPoints || G.skillPoints));
    const buffs = [];
    if (G.buffs.power > 0) buffs.push(`Shrine of Power ${Math.ceil(G.buffs.power)}s`);
    if (G.buffs.speed > 0) buffs.push(`Shrine of Swiftness ${Math.ceil(G.buffs.speed)}s`);
    if (G.buffs.wealth > 0) buffs.push(`Shrine of Wealth ${Math.ceil(G.buffs.wealth)}s`);
    $('#hud-buffs').textContent = buffs.join(' · ');
    $('#hud-loc').textContent = G.level.kind === 'town' ? 'Hollowmere' : `Sunken Wells · Floor ${G.level.floor}`;
    $('#hud-gold').textContent = `${G.gold} gold`;
    $('#hud-fame').textContent = `Fame: ${fameTitle()}`;
    const q = G.quest;
    $('#hud-quest').textContent = q ? `${q.title}: ${q.done ? 'Complete! Return to town' : q.type === 'slay' ? `${q.progress}/${q.count}` : `floor ${q.floor}`}` : '';
    // target frame
    const tg = (pl.hover && pl.hover.type === 'enemy' && !pl.hover.dead) ? pl.hover : (pl.lastHit && !pl.lastHit.dead && pl.lastHit.root.parent ? pl.lastHit : null);
    const tf = $('#hud-target');
    tf.classList.toggle('hidden', !tg);
    if (tg) {
      const n = $('#hud-target-name'); n.textContent = tg.displayName(); n.style.color = tg.boss ? '#ff6644' : tg.elite ? '#ffcc33' : '#e8dcc0';
      set('#hud-target .bar', tg.hp / tg.maxHp, `${Math.ceil(tg.hp)} / ${Math.round(tg.maxHp)}`);
    }
    // hotbar
    const sk = G.skills;
    this.slotEls.firebolt.classList.toggle('off', sk.firebolt < 1 || G.mp < fireboltCost());
    this.slotEls.heal.classList.toggle('off', sk.heal < 1 || G.mp < 12);
    this.slotEls.nova.classList.toggle('off', sk.nova < 1 || G.mp < 18);
    this.slotEls.hp.querySelector('.cnt').textContent = G.hpPotions;
    this.slotEls.mp.querySelector('.cnt').textContent = G.mpPotions;
    this.slotEls.scroll.querySelector('.cnt').textContent = G.scrolls;
    this.mmTimer -= dt;
    if (this.mmTimer <= 0) { this.mmTimer = 0.15; this.drawMinimap(); }
    if (this.fish) this.updateFishing(dt);
  }

  drawMinimap() {
    const cv = $('#minimap');
    const big = this.main.bigMap;
    const size = big ? 520 : 200;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const ctx = cv.getContext('2d');
    const L = G.level;
    ctx.clearRect(0, 0, size, size);
    const s = Math.floor(size / Math.max(L.w, L.h));
    const town = L.kind === 'town';
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!town && !L.explored[L.idx(x, y)]) continue;
      ctx.fillStyle = L.isFloor(x, y) ? (town ? '#4a6a3a' : '#6a6050') : '#2a2420';
      ctx.fillRect(x * s, y * s, s, s);
    }
    const dot = (p, c, r) => { const [x, y] = L.cellOf(p); if (!town && !L.explored[L.idx(x, y)]) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * s + s / 2, y * s + s / 2, r, 0, 7); ctx.fill(); };
    for (const e of L.entities) {
      if (e.type === 'enemy' && !e.dead) dot(e.pos, e.boss ? '#ff3322' : e.elite ? '#ffcc33' : '#d04040', big ? 4 : 2);
      else if (e.type === 'interact' && !e.dead) dot(e.pos, e.kind.startsWith('stairs') ? '#ffd480' : '#80c0ff', big ? 5 : 3);
      else if (e.type === 'loot' && e.item && e.item.rarity >= 1) dot(e.pos, hex(itemColor(e.item)), big ? 3 : 1.5);
    }
    if (G.pet && G.pet.root.visible && !G.pet.dead) dot(G.pet.pos, '#ffaa55', big ? 4 : 2);
    dot(G.player.pos, '#ffffff', big ? 5 : 3);
  }

  // ---------------- tooltip ----------------
  showTooltip(it, extra = '') {
    if (!it) return this.hideTooltip();
    let html = describe(it, G.lvl) + extra;
    const eq = it.slot && G.equipment[it.slot];
    if (eq && eq !== it) html += `<div class="tt-cmp">Currently equipped:<br>${describe(eq, G.lvl)}</div>`;
    this.tooltip.innerHTML = html;
    this.tooltip.classList.remove('hidden');
    this.placeTooltip();
  }
  placeTooltip() {
    const t = this.tooltip;
    let x = this.mouseX + 18, y = this.mouseY + 12;
    if (x + t.offsetWidth > window.innerWidth) x = this.mouseX - t.offsetWidth - 12;
    if (y + t.offsetHeight > window.innerHeight) y = window.innerHeight - t.offsetHeight - 6;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  hideTooltip() { this.tooltip.classList.add('hidden'); }

  // ---------------- panels ----------------
  anyModal() { return !!(this.open.fish || this.open.choice || this.open.pause || this.open.death || this.open.menu); }
  anyPanel() { return Object.values(this.open).some(Boolean); }
  closeAll() { for (const k of Object.keys(this.open)) if (k !== 'death' && k !== 'menu') this.close(k); this.hideTooltip(); }
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
    const fn = { inv: this.renderInv, char: this.renderChar, shop: this.renderShop, quest: this.renderQuest, pause: this.renderPause }[name];
    if (fn) fn.call(this, ...args);
  }
  panel(name, title, style, closable = true) {
    const p = el('div', 'panel');
    Object.assign(p.style, style);
    p.innerHTML = `<h2><span>${title}</span>${closable ? '<span class="x">✕</span>' : ''}</h2><div class="body"></div>`;
    if (closable) p.querySelector('.x').onclick = () => this.close(name);
    p.addEventListener('mousedown', (e) => e.stopPropagation());
    p.addEventListener('contextmenu', (e) => e.preventDefault());
    this.panels.appendChild(p);
    this.open[name] = p;
    return p.querySelector('.body');
  }
  refresh() {
    if (this.open.inv) this.renderInv();
    if (this.open.char) this.renderChar();
    if (this.open.shop) this.renderShop();
    if (this.open.quest) this.renderQuest();
  }

  itemCell(it, onClick, onRight, selected) {
    const c = el('div', 'cell' + (selected ? ' sel' : ''), it ? SLOT_ICONS[it.slot] || '?' : '');
    if (it) {
      c.style.borderColor = hex(itemColor(it));
      if (it.req > G.lvl) c.appendChild(el('div', 'req'));
      c.onmouseenter = () => this.showTooltip(it);
      c.onmouseleave = () => this.hideTooltip();
      c.onclick = onClick;
      c.oncontextmenu = (e) => { e.preventDefault(); onRight?.(); };
    }
    return c;
  }

  renderInv() {
    const prev = this.open.inv;
    const body = prev ? prev.querySelector('.body') : this.panel('inv', 'Inventory', { right: '16px', top: '300px', width: '440px' });
    body.innerHTML = '';
    const eqWrap = el('div', 'eq');
    for (const slot of ['helm', 'amulet', 'weapon', 'armor', 'offhand', 'ring']) {
      const it = G.equipment[slot];
      const s = el('div', 'eqs', `<div class="sl">${SLOT_NAMES[slot]}</div>${it ? `<span style="color:${hex(itemColor(it))}">${SLOT_ICONS[slot]} ${it.name}</span>` : '<span class="muted">empty</span>'}`);
      if (it) {
        s.style.borderColor = hex(itemColor(it));
        s.onmouseenter = () => this.showTooltip(it, '<div class="tt-dim">Right-click to unequip</div>');
        s.onmouseleave = () => this.hideTooltip();
        s.oncontextmenu = (e) => { e.preventDefault(); unequip(slot); this.hideTooltip(); this.refresh(); };
        s.onclick = s.oncontextmenu;
      }
      eqWrap.appendChild(s);
    }
    body.appendChild(eqWrap);
    body.appendChild(el('div', 'muted', `Backpack (${G.backpack.length}/${BACKPACK_MAX}) · Right-click: ${this.open.shop ? 'sell' : 'equip / feed pet'}`));
    const grid = el('div', 'grid');
    grid.style.margin = '6px 0 10px';
    for (let i = 0; i < BACKPACK_MAX; i++) {
      const it = G.backpack[i];
      const isSel = this.sel && this.sel.src === 'pack' && this.sel.key === i;
      grid.appendChild(this.itemCell(it, () => { this.sel = { src: 'pack', key: i }; this.renderInv(); }, () => this.quickUse(i), isSel));
    }
    body.appendChild(grid);
    const bar = el('div');
    const selIt = this.sel && this.sel.src === 'pack' ? G.backpack[this.sel.key] : null;
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
    this.sel = null;
    this.hideTooltip();
    this.refresh();
  }
  sell(i) {
    const it = G.backpack[i];
    if (!it) return;
    G.backpack.splice(i, 1);
    const p = sellPrice(it);
    G.gold += p;
    msg(`Sold ${it.name} for ${p} gold`, '#ffd84d');
    sfx('gold');
    this.sel = null;
    this.hideTooltip();
    this.refresh();
  }

  renderChar() {
    const prev = this.open.char;
    const body = prev ? prev.querySelector('.body') : this.panel('char', 'Character', { left: '16px', top: '170px', width: '400px', maxHeight: '75vh', overflowY: 'auto' });
    const d = weaponDamage();
    const labels = { str: ['Strength', 'More melee damage'], dex: ['Dexterity', 'Attack speed, crits, armor'], vit: ['Vitality', 'More life'], mag: ['Magic', 'Spell power and mana'] };
    let html = `<div class="row"><span>${G.heroName}, level ${G.lvl}</span><span class="v">${G.xp} / ${xpToNext()} xp</span></div>
      <div class="row"><span>Fame</span><span class="v" style="color:#c99bff">${fameTitle()} (${G.fame}${G.fameRank < FAME_STEPS.length - 1 ? ' / ' + FAME_STEPS[G.fameRank + 1] : ''})</span></div>
      <h2 style="font-size:16px;margin-top:10px"><span>Attributes</span><span style="font-size:13px;color:#ffd84d">${G.statPoints} points</span></h2>`;
    for (const k of ['str', 'dex', 'vit', 'mag']) html += `<div class="row"><span>${labels[k][0]} <small class="muted">${labels[k][1]}</small></span><span><span class="v">${stat(k)}</span> <button class="small" data-stat="${k}" ${G.statPoints ? '' : 'disabled'}>+</button></span></div>`;
    html += `<div class="row"><span>Life / Mana</span><span class="v">${Math.round(maxHp())} / ${Math.round(maxMp())}</span></div>
      <div class="row"><span>Damage</span><span class="v">${Math.round(d[0])} - ${Math.round(d[1])}</span></div>
      <div class="row"><span>Attacks per second</span><span class="v">${attackSpeed().toFixed(2)}</span></div>
      <div class="row"><span>Critical chance</span><span class="v">${Math.round(critChance() * 100)}%</span></div>
      <div class="row"><span>Armor</span><span class="v">${Math.round(armor())} (${Math.round(100 - 10000 / (100 + armor()))}% less damage)</span></div>
      <div class="row"><span>Gold / Magic find</span><span class="v">${this.main.goldFind()}% / ${this.main.magicFind()}%</span></div>
      <div class="row"><span>Monsters slain · Fish caught</span><span class="v">${G.kills} · ${G.fishCaught}</span></div>
      <h2 style="font-size:16px;margin-top:10px"><span>Skills</span><span style="font-size:13px;color:#ffd84d">${G.skillPoints} points</span></h2>`;
    const sk = [
      ['firebolt', 'Firebolt (Right mouse)', `Hurls fire for ${Math.round(fireboltDamage())} damage. ${fireboltCost().toFixed(0)} mana.`],
      ['heal', 'Mend Wounds (Q)', G.skills.heal ? `Heals ${Math.round(healAmount())} life. 12 mana.` : 'Heal yourself with magic. 12 mana.'],
      ['nova', 'Frost Nova (E)', G.skills.nova ? `Blasts nearby foes for ${Math.round(novaDamage())} damage and slows them. 18 mana.` : 'Freezing burst around you. 18 mana.'],
      ['mastery', 'Weapon Mastery', `+10% damage and +3% attack speed per rank.`],
      ['pet_bond', 'Pet Bond', `${G.petName} deals ${Math.round(petDamage())} damage and has ${Math.round(petMaxHp())} life. +15% per rank.`],
    ];
    for (const [k, n, desc] of sk) html += `<div class="skill"><div class="row"><b>${n}</b><span>Rank ${G.skills[k]} <button class="small" data-skill="${k}" ${G.skillPoints ? '' : 'disabled'}>+</button></span></div><small>${desc}</small></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-stat]').forEach((b) => (b.onclick = () => { if (G.statPoints > 0) { const hpF = G.hp / maxHp(); G.base[b.dataset.stat]++; G.statPoints--; G.hp = maxHp() * hpF; sfx('ui'); this.refresh(); } }));
    body.querySelectorAll('[data-skill]').forEach((b) => (b.onclick = () => { if (G.skillPoints > 0) { G.skills[b.dataset.skill]++; G.skillPoints--; if (b.dataset.skill === 'pet_bond' && G.pet) G.pet.applyForm(true); sfx('ui'); this.refresh(); } }));
  }

  renderShop() {
    const prev = this.open.shop;
    const body = prev ? prev.querySelector('.body') : this.panel('shop', "Odessa's Wares", { left: '16px', top: '170px', width: '440px' });
    body.innerHTML = '<div class="muted" style="margin-bottom:8px">"Coin first, questions never." Right-click an item to buy it. Right-click items in your backpack to sell.</div>';
    const grid = el('div', 'grid');
    G.shopStock.forEach((it, i) => grid.appendChild(this.itemCell(it, () => { this.sel = { src: 'shop', key: i }; this.renderShop(); }, () => this.buy(i), this.sel?.src === 'shop' && this.sel.key === i)));
    grid.querySelectorAll('.cell').forEach((c, i) => { c.onmouseenter = () => this.showTooltip(G.shopStock[i], `<div style="color:#ffd84d">Price: ${buyPrice(G.shopStock[i])} gold</div>`); });
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
    const prev = this.open.quest;
    const body = prev ? prev.querySelector('.body') : this.panel('quest', QUEST_GIVER, { left: '50%', top: '18%', width: '480px', transform: 'translateX(-50%)' });
    const inTown = G.level.kind === 'town';
    const q = G.quest;
    let html = '';
    if (q) {
      html += `<div style="font-size:17px;color:#f0c674">${q.title}</div><p>${q.text}</p>`;
      html += `<div class="row"><span>Progress</span><span class="v">${q.done ? '<span style="color:#7f7">Complete</span>' : q.type === 'slay' ? `${q.progress} / ${q.count}` : 'Not yet'}</span></div>`;
      html += `<div class="row"><span>Reward</span><span class="v">${q.gold} gold · ${q.xp} xp · ${q.fame} fame · a magic item</span></div>`;
      if (inTown && q.done) html += '<button id="q-turn">Claim Reward</button>';
      html += '<button id="q-ab">Abandon</button>';
    } else if (inTown) {
      ensureQuestOffer();
      const o = G.questOffer;
      html += `<p class="muted">"The Wells give up nothing for free, ${G.heroName}. Here is work, if you want it."</p>`;
      html += `<div style="font-size:17px;color:#f0c674">${o.title}</div><p>${o.text}</p>`;
      html += `<div class="row"><span>Reward</span><span class="v">${o.gold} gold · ${o.xp} xp · ${o.fame} fame · a magic item</span></div>`;
      html += '<button id="q-acc">Accept</button><button id="q-new">Ask for different work (10g)</button>';
    } else html = '<p class="muted">No active quest. Visit Warden Corvane in Hollowmere.</p>';
    body.innerHTML = html;
    const on = (id, fn) => { const b = $(id, body); if (b) b.onclick = () => { fn(); sfx('ui'); this.refresh(); }; };
    on('#q-turn', () => turnInQuest());
    on('#q-ab', () => { G.quest = null; msg('Quest abandoned.'); });
    on('#q-acc', () => acceptQuest());
    on('#q-new', () => { if (G.gold >= 10) { G.gold -= 10; G.questOffer = null; } else this.flash('Not enough gold'); });
  }

  renderPause() {
    const body = this.panel('pause', 'Paused', { left: '50%', top: '30%', width: '300px', transform: 'translateX(-50%)', textAlign: 'center' });
    const b = (t, fn) => { const x = el('button', '', t); x.style.width = '100%'; x.onclick = fn; body.appendChild(x); };
    b('Resume', () => this.close('pause'));
    b('Save Game', () => { if (saveGame()) this.flash('Game saved'); });
    b('Save & Quit to Title', () => { saveGame(); this.close('pause'); this.main.toMenu(); });
    b('Quit to Desktop', () => { saveGame(); window.close(); });
  }

  choice(title, text, options) {
    this.close('choice');
    const body = this.panel('choice', title, { left: '50%', top: '28%', width: '420px', transform: 'translateX(-50%)' });
    body.appendChild(el('p', '', text));
    for (const [label, fn] of options) {
      const b = el('button', '', label);
      b.onclick = () => { this.close('choice'); fn?.(); };
      body.appendChild(b);
    }
  }

  death(lost) {
    const body = this.panel('death', 'You have fallen', { left: '50%', top: '30%', width: '400px', transform: 'translateX(-50%)', textAlign: 'center' }, false);
    body.innerHTML = `<p>The Wells claim another... almost. Brother Fennick drags you back to Hollowmere.</p><p class="muted">You dropped ${lost} gold in the dark.</p>`;
    const b = el('button', '', 'Return to Hollowmere');
    b.onclick = () => { this.close('death'); this.main.respawn(); };
    body.appendChild(b);
  }

  // ---------------- fishing ----------------
  openFishing() {
    this.close('fish');
    const body = this.panel('fish', 'Fishing', { left: '50%', top: '25%', width: '420px', transform: 'translateX(-50%)' });
    body.innerHTML = `<p id="fish-status">Click <b>Cast</b> and wait for a bite.</p>
      <div class="fishbar"><div class="zone"></div><div class="bob"></div></div>
      <p class="muted">When the fish bites, press <b>Space</b> (or click Reel) while the yellow marker is inside the green zone.</p>
      <button id="fish-cast">Cast</button><button id="fish-reel" disabled>Reel (Space)</button>`;
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
      if (Math.random() < 0.04) {
        const it = this.main.randomTreasure();
        this.fishResult(true, `You hooked something heavy... a ${it.name}!`, it);
      } else {
        const fish = makeFish();
        this.fishResult(true, `You caught a ${fish.name}!`, fish);
      }
    } else this.fishResult(false, 'The line snaps. It got away.');
  }
  fishResult(ok, text, item) {
    const f = this.fish;
    f.state = 'idle';
    $('#fish-status').innerHTML = ok ? `<span style="color:${hex(itemColor(item))}">${text}</span>` : text;
    $('#fish-cast').disabled = false; $('#fish-reel').disabled = true;
    if (ok) {
      G.fishCaught++;
      if (G.backpack.length < BACKPACK_MAX) { G.backpack.push(item); sfx('pick'); }
      else { this.main.dropItem(item); msg('Backpack full, the catch flops onto the ground.'); }
      if (item.form) msg(`Feed the ${item.name} to ${G.petName} from your inventory to transform it.`, '#99e6ff');
      this.refresh();
    }
  }

  // ---------------- menu ----------------
  showMenu() {
    this.hud.classList.add('hidden');
    const m = $('#menu');
    m.classList.remove('hidden');
    this.open.menu = true;
    m.innerHTML = `<h1>HOLLOWMERE</h1><h3>THE SUNKEN WELLS</h3>
      <input id="m-name" maxlength="18" placeholder="Name your hero" value="${G.heroName && G.heroName !== 'Wanderer' ? G.heroName : ''}">
      <button id="m-new">${hasSave() ? 'New Game (replaces save)' : 'New Game'}</button>
      <button id="m-cont" ${hasSave() ? '' : 'disabled'}>Continue</button>
      <button id="m-quit">Quit</button>
      <div class="foot">An original action RPG · v0.1 · F11 fullscreen</div>`;
    $('#m-new').onclick = () => this.main.newGame($('#m-name').value.trim() || 'Wanderer');
    $('#m-cont').onclick = () => this.main.continueGame();
    $('#m-quit').onclick = () => window.close();
  }
  hideMenu() {
    $('#menu').classList.add('hidden');
    delete this.open.menu;
    this.hud.classList.remove('hidden');
  }
  clearWorld() {
    for (const d of this.labels.values()) d.remove();
    this.labels.clear();
    for (const f of this.floats) f.el.remove();
    this.floats = [];
  }
}
