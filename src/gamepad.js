// Xbox / PlayStation controller support (standard Gamepad API mapping).
// In play: left stick moves, A/Cross attacks or talks, face and shoulder buttons cast, triggers drink potions.
// In menus and panels: the d-pad or left stick moves a highlight between buttons, A/Cross clicks,
// X/Square acts as a right-click, B/Circle goes back.
import * as THREE from 'three';
import { G } from './state.js';
import { Settings, saveSettings } from './settings.js';
import { flatDist } from './util.js';

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.22;
const GLYPHS = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'View', START: 'Menu' },
  ps: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'Create', START: 'Options' },
};

export class Pad {
  constructor(main) {
    this.main = main;
    this.prev = [];
    this.focus = null; this.lastCenter = null;
    this.repeatT = 0; this.navDir = null;
    this.active = false; this.kind = 'xbox';
    this.holdA = 0;
    window.addEventListener('gamepadconnected', (e) => {
      this.kind = /054c|dualsense|dualshock|playstation|wireless controller/i.test(e.gamepad.id) ? 'ps' : 'xbox';
      main.ui.toast(`${this.kind === 'ps' ? 'PlayStation' : 'Xbox'} controller connected`);
    });
    window.addEventListener('gamepaddisconnected', () => { this.active = false; this.clearFocus(); main.ui.toast('Controller disconnected', true); });
    // going back to the mouse hides the highlight
    window.addEventListener('mousemove', () => { if (this.active && this.focus) { this.active = false; this.clearFocus(); document.body.classList.remove('gp'); } });
  }
  glyph(k) { return GLYPHS[this.kind][k] || k; }
  pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of list) if (g && g.connected) return g;
    return null;
  }
  rumble(strong = 0.5, ms = 120) {
    const g = this.pad();
    try { g?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * 0.6 }); } catch (e) { /* not supported */ }
  }

  update(dt) {
    const g = this.pad();
    if (!g) return;
    const btn = g.buttons.map((b) => b.pressed || b.value > 0.5);
    const pressed = (i) => btn[i] && !this.prev[i];
    const ax = (i) => (Math.abs(g.axes[i] || 0) > DEAD ? g.axes[i] : 0);
    const lx = ax(0), ly = ax(1), ry = ax(3);
    if (btn.some((b) => b) || lx || ly) {
      if (!this.active) { this.active = true; document.body.classList.add('gp'); this.main.ui.refreshHelp?.(); }
    }
    if (!this.active) { this.prev = btn; return; }
    const ui = this.main.ui;
    const container = this.menuContainer();
    if (container) this.navigate(dt, container, btn, pressed, lx, ly);
    else { this.clearFocus(); this.container = null; this.play(dt, btn, pressed, lx, ly, ry); }
    this.prev = btn;
  }

  // ---------------------------------------------------------------- menus
  menuContainer() {
    const ui = this.main.ui;
    const vis = (el) => el && !el.classList.contains('hidden') && el.offsetParent !== null;
    const create = document.getElementById('create');
    if (vis(create)) return create;
    const menu = document.getElementById('menu');
    if (vis(menu)) return menu;
    for (const k of ['death', 'choice', 'settings', 'pause', 'fish']) if (ui.open[k] && ui.open[k] !== true) return ui.open[k];
    const panels = [...document.querySelectorAll('#panels > .panel')].filter((p) => p.offsetParent !== null);
    return panels.length ? panels[panels.length - 1] : null;
  }
  focusables(root) {
    const out = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    root.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName;
      const ok = (tag === 'BUTTON' && !el.disabled) || tag === 'SELECT' || (tag === 'INPUT' && (el.type === 'range' || el.type === 'checkbox' || el.type === 'text')) || el.onclick || el.oncontextmenu;
      if (!ok) return;
      if (el.closest('button') && el.closest('button') !== el) return;
      if (el.classList.contains('x')) return; // B closes panels
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
      if (getComputedStyle(el).visibility === 'hidden') return;
      out.push(el);
    });
    return out;
  }
  setFocus(el) {
    if (this.focus === el) return;
    if (this.focus) { this.focus.classList.remove('gp-focus'); this.focus.dispatchEvent(new MouseEvent('mouseleave')); }
    this.focus = el;
    if (!el) return;
    el.classList.add('gp-focus');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    this.lastCenter = [r.left + r.width / 2, r.top + r.height / 2];
    const ui = this.main.ui; ui.mouseX = r.right + 4; ui.mouseY = r.top;
    el.dispatchEvent(new MouseEvent('mouseenter'));
  }
  clearFocus() { if (this.focus) { this.focus.classList.remove('gp-focus'); this.focus.dispatchEvent(new MouseEvent('mouseleave')); } this.focus = null; }
  navigate(dt, root, btn, pressed, lx, ly) {
    if (root !== this.container) { this.container = root; this.lastCenter = null; this.clearFocus(); }
    let list = this.focusables(root);
    if (!list.length) return;
    if (!this.focus || !document.body.contains(this.focus) || !root.contains(this.focus)) {
      // the panel re-rendered: keep the highlight near where it was
      const c = this.lastCenter;
      let best = list.find((e) => e.classList.contains('primary')) || list[0];
      if (c) { let bd = Infinity; for (const e of list) { const r = e.getBoundingClientRect(); const d = Math.hypot(r.left + r.width / 2 - c[0], r.top + r.height / 2 - c[1]); if (d < bd) { bd = d; best = e; } } }
      this.focus = null; this.setFocus(best);
    }
    // direction from d-pad or stick, with key repeat
    let dir = null;
    if (btn[B.UP] || ly < -0.5) dir = 'up'; else if (btn[B.DOWN] || ly > 0.5) dir = 'down'; else if (btn[B.LEFT] || lx < -0.5) dir = 'left'; else if (btn[B.RIGHT] || lx > 0.5) dir = 'right';
    if (dir !== this.navDir) { this.navDir = dir; this.repeatT = 0; }
    if (dir) {
      this.repeatT -= dt;
      if (this.repeatT <= 0) { this.repeatT = this.repeatT === 0 ? 0.38 : 0.12; if (this.repeatT > 0.3 || true) this.move(dir, list); }
    }
    const f = this.focus;
    if (pressed(B.A) && f) {
      if (f.tagName === 'INPUT' && f.type === 'checkbox') { f.checked = !f.checked; f.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (f.tagName === 'INPUT' && f.type === 'text') f.focus();
      else if (f.tagName === 'SELECT') this.adjust(f, 1);
      else f.click();
      this.main.sfxUi?.();
    }
    if (pressed(B.X) && f) f.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    if (pressed(B.Y) && f && f.ondblclick) f.ondblclick(new MouseEvent('dblclick'));
    if (pressed(B.B) || pressed(B.START)) this.back(pressed(B.START));
    // shoulder buttons flip through the tabs of a panel (forge, companion, creation)
    if (pressed(B.LB) || pressed(B.RB)) {
      const tabs = [...root.querySelectorAll('[data-tab], [data-sp], .ftabs button, .pt')].filter((e) => e.offsetParent !== null);
      if (tabs.length) {
        const cur = tabs.findIndex((e) => e.classList.contains('on'));
        const n = tabs[(cur + (pressed(B.RB) ? 1 : -1) + tabs.length) % tabs.length];
        n.click();
      }
    }
  }
  adjust(el, d) {
    if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + d + el.options.length) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    if (el.tagName === 'INPUT' && el.type === 'range') {
      const step = +(el.step || 1) * Math.max(1, Math.round((+el.max - +el.min) / 20 / (+(el.step || 1))));
      el.value = Math.min(+el.max, Math.max(+el.min, +el.value + d * step));
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }
  move(dir, list) {
    const f = this.focus;
    if ((dir === 'left' || dir === 'right') && f && this.adjust(f, dir === 'right' ? 1 : -1)) return;
    const fr = f.getBoundingClientRect();
    const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
    let best = null, bs = Infinity;
    for (const e of list) {
      if (e === f) continue;
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      let main, side;
      if (dir === 'up') { main = -dy; side = Math.abs(dx); } else if (dir === 'down') { main = dy; side = Math.abs(dx); }
      else if (dir === 'left') { main = -dx; side = Math.abs(dy); } else { main = dx; side = Math.abs(dy); }
      if (main <= 2) continue;
      const score = main + side * 2.2;
      if (score < bs) { bs = score; best = e; }
    }
    if (best) this.setFocus(best);
  }
  back(isStart) {
    const ui = this.main.ui, main = this.main;
    if (ui.open.create) { main.closeCreation(); return; }
    if (ui.open.menu) return;
    if (ui.open.death) return;
    if (ui.open.settings && main.menuMode) { ui.close('settings'); ui.showMenu(); return; }
    if (isStart && ui.open.pause) { ui.close('pause'); return; }
    ui.closeAll();
  }

  // ---------------------------------------------------------------- play
  play(dt, btn, pressed, lx, ly, ry) {
    const main = this.main, ui = main.ui, p = G.player;
    if (pressed(B.START)) { if (!main.menuMode) ui.show('pause'); return; }
    if (!p || main.menuMode) return;
    if (pressed(B.VIEW)) ui.toggle('inv');
    if (pressed(B.LEFT)) ui.toggle('skills');
    if (pressed(B.RIGHT)) ui.toggle('char');
    if (pressed(B.LS)) ui.toggle('pet');
    if (pressed(B.RS)) main.bigMap = !main.bigMap;
    if (pressed(B.DOWN)) { Settings.autoAttack = !Settings.autoAttack; saveSettings(); main.flash(`Auto-attack ${Settings.autoAttack ? 'on' : 'off'}`); }
    if (ry) main.zoom = Math.min(1.5, Math.max(0.55, main.zoom + ry * dt * 1.2));
    if (!main.canPlay()) return;
    if (pressed(B.UP)) main.usePortal();
    if (pressed(B.LT)) main.drinkPotion('hp');
    if (pressed(B.RT)) main.drinkPotion('mp');
    // movement: the camera looks north (-z), so stick up = -z
    if (lx || ly) {
      const len = Math.min(1, Math.hypot(lx, ly));
      const d = new THREE.Vector3(lx, 0, ly).normalize();
      const to = p.pos.clone().addScaledVector(d, 0.6 + 0.9 * len);
      if (G.level.walkable(to)) { p.target = null; p.path = [to]; }
      else {
        // slide along walls
        for (const alt of [new THREE.Vector3(d.x, 0, 0), new THREE.Vector3(0, 0, d.z)]) {
          if (alt.lengthSq() < 0.01) continue;
          const t2 = p.pos.clone().addScaledVector(alt.normalize(), 0.7);
          if (G.level.walkable(t2)) { p.target = null; p.path = [t2]; break; }
        }
      }
      this.moving = true;
    } else if (this.moving) { this.moving = false; if (!p.target) p.path = []; }
    // A / Cross: talk, pick up or attack (hold to keep fighting)
    if (btn[B.A]) {
      this.holdA -= dt;
      if (pressed(B.A) || this.holdA <= 0) {
        this.holdA = 0.25;
        const t = this.pickNear(pressed(B.A));
        if (t) p.setTarget(t);
      }
    }
    // skills
    const slots = [[B.X, 'rmb'], [B.Y, 'q'], [B.B, 'w'], [B.LB, 'e'], [B.RB, 'r']];
    for (const [b, slot] of slots) if (pressed(b)) this.castSlot(slot);
  }
  facing() { const p = G.player; return new THREE.Vector3(Math.sin(p.root.rotation.y), 0, Math.cos(p.root.rotation.y)); }
  // nearest thing to act on: close loot / NPCs first, else the best enemy in front
  pickNear(allowInteract) {
    const p = G.player, fw = this.facing();
    let loot = null, ld = 2.4, foe = null, fs = Infinity, npc = null, nd = Infinity;
    for (const e of G.level.entities) {
      if (e.dead || !e.root.visible) continue;
      const d = flatDist(e.pos, p.pos);
      if (e.type === 'enemy') {
        if (d > 9 || (e.dormant && d > 3)) continue;
        const v = e.pos.clone().sub(p.pos).setY(0).normalize();
        const s = d * (1.6 - v.dot(fw) * 0.6);
        if (s < fs) { fs = s; foe = e; }
      } else if (allowInteract && e.type === 'loot') { if (d < ld) { ld = d; loot = e; } }
      else if (allowInteract && e.type === 'interact') { const r = 2.6 + (e.pickR || 0); if (d < r && d < nd) { nd = d; npc = e; } }
    }
    // loot at your feet first, then foes, then whoever you are standing next to
    return loot || foe || npc;
  }
  castSlot(slot) {
    const main = this.main, p = G.player;
    const id = G.hotbar[slot];
    if (!id) { main.flash('No skill on this button (open Skills with D-pad left)'); return; }
    const tg = this.pickNear(false);
    const at = tg && flatDist(tg.pos, p.pos) < 12 ? tg.pos.clone() : p.pos.clone().addScaledVector(this.facing(), 5);
    p.hover = tg;
    main.castWith(slot, at, tg);
  }
}
