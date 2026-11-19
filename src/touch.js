// Phone and tablet support: a virtual joystick, attack / skill / potion buttons, menu shortcuts and a
// UI that scales to small screens. Turned on automatically on touch devices.
import * as THREE from 'three';
import { G } from './state.js';
import { Settings, saveSettings } from './settings.js';
import { skillIcon } from './icons.js';
import { skillIconKey } from './skills.js';

export const isTouch = () => (typeof window !== 'undefined') && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;

// full screen plus a landscape lock where the browser allows it (Android Chrome does after a tap)
export function toggleFullscreen(force) {
  const d = document, el = d.documentElement;
  const on = !!(d.fullscreenElement || d.webkitFullscreenElement);
  if (on && force !== true) { (d.exitFullscreen || d.webkitExitFullscreen)?.call(d); return; }
  if (on) return;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch (e) { /* not allowed here */ }
}
export const isStandalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;

export class Touch {
  constructor(main) {
    this.main = main;
    this.on = isTouch() || /[?&]touch=1/.test(location.search);
    if (!this.on) return;
    document.body.classList.add('touch');
    this.stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this.attackHeld = false; this.holdT = 0;
    this.build();
    this.scale();
    window.addEventListener('resize', () => this.scale());
    // stop the page from scrolling or zooming while playing
    document.addEventListener('touchmove', (e) => { if (!e.target.closest('.panel, #create, #menu')) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    const first = () => { if (!isStandalone()) toggleFullscreen(true); };
    document.addEventListener('click', first, { once: true, capture: true });
  }
  build() {
    const el = (tag, cls, html = '') => { const d = document.createElement(tag); d.className = cls; d.innerHTML = html; return d; };
    const root = el('div', '', ''); root.id = 'touch';
    root.innerHTML = `<div id="t-stick"><div class="knob"></div></div>
      <div id="t-btns">
        <button class="tb big" data-act="attack">⚔</button>
        <button class="tb sk" data-slot="rmb"></button><button class="tb sk" data-slot="q"></button><button class="tb sk" data-slot="w"></button>
        <button class="tb sk" data-slot="e"></button><button class="tb sk" data-slot="r"></button>
        <button class="tb pot hp" data-act="hp">♥</button><button class="tb pot mp" data-act="mp">✦</button><button class="tb pot" data-act="portal">◎</button>
      </div>
      <div id="t-top">
        <button data-p="inv">Bag</button><button data-p="skills">Skills</button><button data-p="zodiac">Stars</button><button data-p="char">Hero</button><button data-p="pet">Pet</button><button data-p="quest">Quest</button><button data-p="map">Map</button><button data-p="auto">Auto</button><button data-p="fs" class="fsbtn">⛶</button><button data-p="pause">☰</button>
      </div>
      <div id="t-rotate">Turn your phone sideways for the best view</div>`;
    document.body.appendChild(root);
    this.root = root;
    const stick = root.querySelector('#t-stick'), knob = stick.querySelector('.knob');
    const S = this.stick;
    const setKnob = () => { knob.style.transform = `translate(${S.x * 42}px, ${S.y * 42}px)`; };
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; S.id = t.identifier;
      const r = stick.getBoundingClientRect(); S.ox = r.left + r.width / 2; S.oy = r.top + r.height / 2;
      this.moveStick(t); setKnob();
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === S.id) this.moveStick(t); setKnob(); }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === S.id) { S.id = null; S.x = S.y = 0; setKnob(); } };
    stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
    for (const b of root.querySelectorAll('.tb')) {
      b.addEventListener('touchstart', (e) => { e.preventDefault(); b.classList.add('down'); this.press(b, true); }, { passive: false });
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); this.press(b, false); };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    }
    for (const b of root.querySelectorAll('#t-top button')) b.addEventListener('click', () => this.panel(b.dataset.p));
  }
  moveStick(t) {
    const S = this.stick;
    let dx = (t.clientX - S.ox) / 55, dy = (t.clientY - S.oy) / 55;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    S.x = dx; S.y = dy;
  }
  press(b, down) {
    const m = this.main;
    if (b.dataset.act === 'attack') { this.attackHeld = down; this.holdT = 0; return; }
    if (!down || !m.canPlay()) return;
    if (b.dataset.slot) m.pad.castSlot(b.dataset.slot);
    else if (b.dataset.act === 'hp') m.drinkPotion('hp');
    else if (b.dataset.act === 'mp') m.drinkPotion('mp');
    else if (b.dataset.act === 'portal') m.usePortal();
  }
  panel(p) {
    const m = this.main, ui = m.ui;
    if (m.menuMode && p !== 'pause') return;
    if (p === 'fs') { toggleFullscreen(); return; }
    if (p === 'map') { m.bigMap = !m.bigMap; return; }
    if (p === 'auto') { Settings.autoAttack = !Settings.autoAttack; saveSettings(); m.flash(`Auto-attack ${Settings.autoAttack ? 'on' : 'off'}`); return; }
    if (p === 'pause') { if (ui.anyPanel()) ui.closeAll(); else if (!m.menuMode) ui.show('pause'); return; }
    ui.toggle(p);
  }
  // shrink the interface to fit small screens (labels over the world stay full size)
  scale() {
    const w = window.innerWidth, h = window.innerHeight;
    const z = Math.max(0.6, Math.min(1, w / 1000, h / 560));
    document.documentElement.style.setProperty('--uiz', z.toFixed(3));
    document.body.classList.toggle('portrait', h > w);
  }
  update(dt) {
    if (!this.on) return;
    const m = this.main, p = G.player;
    this.root.classList.toggle('hidden', !!(m.menuMode || !p));
    document.body.classList.toggle('panel-open', m.ui.anyPanel());
    // skill icons follow the hotbar
    for (const b of this.root.querySelectorAll('.sk')) {
      const id = G.hotbar?.[b.dataset.slot];
      const key = id && (G.skills[id] || 0) > 0 ? id : '';
      if (b.dataset.id !== key) { b.dataset.id = key; b.innerHTML = key ? skillIcon(skillIconKey(key)) : ''; b.classList.toggle('empty', !key); }
      const cd = key ? (G.cds[key] || 0) : 0;
      b.classList.toggle('cd', cd > 0);
    }
    if (!p || !m.canPlay()) return;
    const S = this.stick;
    if (S.x || S.y) {
      const d = new THREE.Vector3(S.x, 0, S.y);
      const len = Math.min(1, d.length()); d.normalize();
      const to = p.pos.clone().addScaledVector(d, 0.6 + 0.9 * len);
      if (G.level.walkable(to)) { p.target = null; p.path = [to]; }
      else for (const alt of [new THREE.Vector3(d.x, 0, 0), new THREE.Vector3(0, 0, d.z)]) {
        if (alt.lengthSq() < 0.01) continue;
        const t2 = p.pos.clone().addScaledVector(alt.normalize(), 0.7);
        if (G.level.walkable(t2)) { p.target = null; p.path = [t2]; break; }
      }
      this.moving = true;
    } else if (this.moving) { this.moving = false; if (!p.target) p.path = []; }
    if (this.attackHeld) {
      this.holdT -= dt;
      if (this.holdT <= 0) { this.holdT = 0.25; const t = m.pad.pickNear(true); if (t) p.setTarget(t); }
    }
  }
}
