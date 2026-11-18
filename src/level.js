import * as THREE from 'three';
import { G } from './state.js';
import { ENEMIES, BOSSES, QUEST_GIVER } from './data.js';
import { rand, randi, pick, box, cyl, cone, sphere } from './util.js';
import { generate } from './items.js';
import { Enemy, Interact, Loot } from './entities.js';
import { prop, propMesh } from './assets.js';

export const CELL = 2;

export class Level {
  constructor(scene, kind, floor) {
    this.scene = scene;
    this.kind = kind;
    this.floor = floor;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.rooms = [];
    this.entities = [];
    this.blocked = [];
    if (kind === 'town') this.genTown(); else this.genDungeon();
    this.explored = new Uint8Array(this.w * this.h);
    this.buildEnv();
    if (kind === 'town') { this.buildTownVisuals(); this.populateTown(); }
    else { this.buildDungeonVisuals(); this.populateDungeon(); }
  }

  dispose() {
    for (const e of this.entities) e.dispose?.();
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); });
  }

  add(e) { this.entities.push(e); this.root.add(e.root); return e; }
  remove(e) { const i = this.entities.indexOf(e); if (i >= 0) this.entities.splice(i, 1); this.root.remove(e.root); }

  idx(x, y) { return y * this.w + x; }
  isFloor(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.cells[y * this.w + x] === 1; }
  cellOf(p) { return [Math.floor(p.x / CELL + 0.5), Math.floor(p.z / CELL + 0.5)]; }
  toWorld(x, y) { return new THREE.Vector3(x * CELL, 0, y * CELL); }
  walkable(p) { const [x, y] = this.cellOf(p); return this.isFloor(x, y); }

  alloc(w, h) { this.w = w; this.h = h; this.cells = new Uint8Array(w * h); }
  carve(x0, y0, rw, rh, v = 1) {
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++)
      if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.cells[this.idx(x, y)] = v;
  }
  center(r) { return [r.x + (r.w >> 1), r.y + (r.h >> 1)]; }

  genDungeon() {
    this.alloc(58, 58);
    const target = randi(9, 13);
    let tries = 0;
    const rooms = [];
    while (rooms.length < target && tries++ < 500) {
      const rw = randi(5, 10), rh = randi(5, 10);
      const r = { x: randi(2, this.w - rw - 3), y: randi(2, this.h - rh - 3), w: rw, h: rh };
      if (rooms.every((o) => r.x - 2 >= o.x + o.w || o.x >= r.x + r.w + 2 || r.y - 2 >= o.y + o.h || o.y >= r.y + r.h + 2)) rooms.push(r);
    }
    const ordered = [rooms.shift()];
    while (rooms.length) {
      const last = this.center(ordered[ordered.length - 1]);
      let bi = 0, bd = 1e9;
      rooms.forEach((r, i) => { const c = this.center(r); const d = Math.hypot(c[0] - last[0], c[1] - last[1]); if (d < bd) { bd = d; bi = i; } });
      ordered.push(rooms.splice(bi, 1)[0]);
    }
    this.rooms = ordered;
    for (const r of this.rooms) this.carve(r.x, r.y, r.w, r.h);
    for (let i = 1; i < this.rooms.length; i++) this.corridor(this.center(this.rooms[i - 1]), this.center(this.rooms[i]));
    for (let i = 0; i < 2; i++) this.corridor(this.center(pick(this.rooms)), this.center(pick(this.rooms)));
    this.startPos = this.toWorld(...this.center(this.rooms[0]));
    this.downPos = this.toWorld(...this.center(this.rooms[this.rooms.length - 1]));
  }
  corridor(a, b) {
    let [x, y] = a;
    const hx = () => { while (x !== b[0]) { this.carve(x, y, 2, 2); x += Math.sign(b[0] - x); } };
    const vy = () => { while (y !== b[1]) { this.carve(x, y, 2, 2); y += Math.sign(b[1] - y); } };
    if (Math.random() < 0.5) { hx(); vy(); } else { vy(); hx(); }
    this.carve(x, y, 2, 2);
  }

  genTown() {
    this.alloc(34, 34);
    this.carve(1, 1, 32, 32);
    this.buildings = [
      { name: 'building_market_red', c: [8, 6.5], s: 6, ry: 0, npc: 'merchant' },
      { name: 'building_tavern_blue', c: [26, 6.5], s: 6.5, ry: 0 },
      { name: 'building_church_blue', c: [27, 25], s: 6, ry: 0 },
      { name: 'building_blacksmith_green', c: [6, 15.5], s: 5.5, ry: Math.PI / 2 },
      { name: 'building_home_A_yellow', c: [15, 5], s: 6, ry: 0 },
      { name: 'building_home_B_red', c: [19.5, 26.5], s: 5.5, ry: Math.PI },
      { name: 'building_home_A_blue', c: [28.5, 15.5], s: 6, ry: -Math.PI / 2 },
      { name: 'building_tower_A_blue', c: [13, 27], s: 4.5, ry: 0 },
    ];
    this.blocked = [{ x: 4, y: 23, w: 7, h: 5, type: 'pond' }, { x: 16, y: 16, w: 2, h: 2, type: 'well' }];
    this.buildingObjs = [];
    for (const b of this.buildings) {
      const o = prop(b.name);
      o.scale.setScalar(b.s);
      o.rotation.y = b.ry;
      o.position.set(b.c[0] * CELL, 0, b.c[1] * CELL);
      o.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(o);
      const x0 = Math.floor(bb.min.x / CELL + 0.5 + 0.25), x1 = Math.floor(bb.max.x / CELL + 0.5 - 0.25);
      const y0 = Math.floor(bb.min.z / CELL + 0.5 + 0.25), y1 = Math.floor(bb.max.z / CELL + 0.5 - 0.25);
      this.carve(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0);
      b.front = Math.round(bb.max.z / CELL) + 1;
      this.buildingObjs.push(o);
    }
    for (const b of this.blocked) this.carve(b.x, b.y, b.w, b.h, 0);
    this.trees = [[3, 9], [30, 10], [11, 31], [22, 31], [31, 21], [3, 31], [20, 11], [13, 11], [31, 30], [9, 20]];
    for (const [x, y] of this.trees) this.cells[this.idx(x, y)] = 0;
    this.startPos = this.toWorld(17, 21);
    this.portalPos = this.toWorld(20, 19);
  }

  nearestFloor(x, y) {
    if (this.isFloor(x, y)) return [x, y];
    for (let r = 1; r < 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (this.isFloor(x + dx, y + dy)) return [x + dx, y + dy];
        }
    return [x, y];
  }

  lineClear(a, b, radius = 0.45) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const steps = Math.ceil(len / 0.4);
    const sx = (-dz / len) * radius, sz = (dx / len) * radius;
    const p = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + dx * t, z = a.z + dz * t;
      if (!this.walkable(p.set(x, 0, z)) || !this.walkable(p.set(x + sx, 0, z + sz)) || !this.walkable(p.set(x - sx, 0, z - sz))) return false;
    }
    return true;
  }

  astar(a, b) {
    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const start = a[1] * W + a[0], goal = b[1] * W + b[0];
    const heap = [];
    const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const hfn = (i) => { const dx = Math.abs((i % W) - b[0]), dy = Math.abs(((i / W) | 0) - b[1]); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    g[start] = 0; push(start, hfn(start));
    let iter = 0;
    while (heap.length && iter++ < 6000) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.isFloor(nx, ny)) continue;
        if (dx && dy && (!this.isFloor(cx + dx, cy) || !this.isFloor(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ni, ng + hfn(ni)); }
      }
    }
    if (came[goal] === -1 && goal !== start) return [];
    const out = [];
    for (let c = goal; c !== start && c !== -1; c = came[c]) out.push([c % W, (c / W) | 0]);
    return out.reverse();
  }

  findPath(from, to) {
    const [tx, ty] = this.cellOf(to);
    const destOk = this.isFloor(tx, ty);
    const dest = new THREE.Vector3(to.x, 0, to.z);
    if (destOk && this.lineClear(from, to)) return [dest];
    const a = this.nearestFloor(...this.cellOf(from));
    const b = this.nearestFloor(tx, ty);
    if (a[0] === b[0] && a[1] === b[1]) return [destOk ? dest : this.toWorld(...b)];
    const ids = this.astar(a, b);
    if (!ids.length) return [];
    const pts = ids.map(([x, y]) => this.toWorld(x, y));
    if (destOk) pts[pts.length - 1] = dest;
    const out = [];
    let cur = from, i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 12);
      while (j > i && !this.lineClear(cur, pts[j])) j--;
      out.push(pts[j]); cur = pts[j]; i = j + 1;
    }
    return out;
  }

  randomFloorIn(r) {
    for (let t = 0; t < 20; t++) {
      const x = randi(r.x + 1, r.x + r.w - 2), y = randi(r.y + 1, r.y + r.h - 2);
      if (this.isFloor(x, y)) return this.toWorld(x, y).add(new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)));
    }
    return this.toWorld(...this.center(r));
  }

  explore(p, radius = 7) {
    const [cx, cy] = this.cellOf(p);
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++)
      if (x >= 0 && y >= 0 && x < this.w && y < this.h && (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) this.explored[this.idx(x, y)] = 1;
  }

  // ---------- visuals ----------
  instanced(geo, list) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const im = new THREE.InstancedMesh(geo, m, list.length);
    const mat4 = new THREE.Matrix4();
    list.forEach((it, i) => {
      mat4.compose(it.p, it.q || new THREE.Quaternion(), it.s || new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, mat4);
      im.setColorAt(i, new THREE.Color(it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = true;
    this.root.add(im);
    return im;
  }

  buildEnv() {
    const theme = Math.floor((this.floor - 1) / 3) % 4;
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.root.add(this.sun, this.sun.target);
    if (this.kind === 'town') {
      this.scene.background = new THREE.Color(0x9fb8d8);
      this.scene.fog = new THREE.Fog(0x9fb8d8, 55, 120);
      this.ambient = new THREE.HemisphereLight(0xd8e4ff, 0x5a6a40, 1.4);
      this.sun.color.set(0xffe2b8); this.sun.intensity = 2.6;
    } else {
      const tint = [0x5a6a90, 0x8a5a4a, 0x4a7a5a, 0x7a4a8a][theme];
      this.scene.background = new THREE.Color(0x030305);
      this.scene.fog = new THREE.Fog(0x030305, 30, 58);
      this.ambient = new THREE.HemisphereLight(tint, 0x2a2a34, 2.4);
      this.sun.color.set(tint); this.sun.intensity = 1.3;
    }
    this.root.add(this.ambient);
  }

  instancedProp(name, list, opts = {}) {
    const src = propMesh(name);
    if (!src || !list.length) return null;
    const im = new THREE.InstancedMesh(src.geometry, opts.material || src.material, list.length);
    const m4 = new THREE.Matrix4();
    const srcM = new THREE.Matrix4();
    src.updateWorldMatrix(true, false);
    srcM.copy(src.matrixWorld);
    list.forEach((it, i) => {
      m4.compose(it.p, it.q || new THREE.Quaternion(), it.s || new THREE.Vector3(1, 1, 1));
      m4.multiply(srcM);
      im.setMatrixAt(i, m4);
      if (it.c) im.setColorAt(i, new THREE.Color(it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = opts.cast ?? true;
    im.receiveShadow = true;
    this.root.add(im);
    return im;
  }

  placeProp(name, p, scale = 1, ry = 0) {
    const o = prop(name);
    o.position.copy(p);
    o.scale.setScalar(scale);
    o.rotation.y = ry;
    this.root.add(o);
    return o;
  }

  buildDungeonVisuals() {
    const theme = Math.floor((this.floor - 1) / 3) % 4;
    const tint = [0xffffff, 0xffd8c0, 0xd0ffd8, 0xe8d0ff][theme];
    const Y = new THREE.Vector3(0, 1, 0);
    const half = new THREE.Vector3(0.5, 0.5, 0.5);
    const floors = { floor_tile_large: [], floor_dirt_large: [], floor_tile_small_broken_A: [], floor_tile_small_weeds_A: [] };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!this.isFloor(x, y)) continue;
      const r = Math.random();
      const p = new THREE.Vector3(x * CELL, 0, y * CELL);
      const q = new THREE.Quaternion().setFromAxisAngle(Y, Math.floor(Math.random() * 4) * Math.PI / 2);
      if (r < 0.74) floors.floor_tile_large.push({ p, q, s: half, c: tint });
      else if (r < 0.84) floors.floor_dirt_large.push({ p, q, s: half, c: tint });
      else if (r < 0.95) floors.floor_tile_small_broken_A.push({ p, q, c: tint });
      else floors.floor_tile_small_weeds_A.push({ p, q, c: tint });
    }
    for (const k in floors) this.instancedProp(k, floors[k], { cast: false });
    // walls along floor/solid edges
    const walls = { wall: [], wall_cracked: [], wall_broken: [] };
    const low = [];
    const verts = new Map();
    this.northWalls = [];
    const dirs = [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!this.isFloor(x, y)) continue;
      for (const [dx, dy, ry] of dirs) {
        if (this.isFloor(x + dx, y + dy)) continue;
        const p = new THREE.Vector3(x * CELL + dx * (CELL / 2 + 0.25), 0, y * CELL + dy * (CELL / 2 + 0.25));
        const q = new THREE.Quaternion().setFromAxisAngle(Y, ry);
        const south = dy === 1;
        if (south) low.push({ p, q, s: new THREE.Vector3(0.5, 0.18, 0.5), c: tint });
        else {
          const r = Math.random();
          (r < 0.8 ? walls.wall : r < 0.93 ? walls.wall_cracked : walls.wall_broken).push({ p, q, s: half, c: tint });
          if (dy === -1) this.northWalls.push({ p: p.clone(), x, y });
        }
        // corner vertices
        const ends = dx === 0 ? [[x * CELL - 1, y * CELL + dy], [x * CELL + 1, y * CELL + dy]] : [[x * CELL + dx, y * CELL - 1], [x * CELL + dx, y * CELL + 1]];
        for (const [vx, vz] of ends) {
          const key = vx + ',' + vz;
          const prev = verts.get(key);
          verts.set(key, { x: vx + dx * 0.25, z: vz + dy * 0.25, low: (prev ? prev.low : true) && south });
        }
      }
    }
    for (const k in walls) this.instancedProp(k, walls[k]);
    this.instancedProp('wall', low);
    const pillars = [], lowP = [];
    for (const v of verts.values()) (v.low ? lowP : pillars).push({ p: new THREE.Vector3(v.x, 0, v.z), s: new THREE.Vector3(0.38, v.low ? 0.1 : 0.52, 0.38), c: tint });
    this.instancedProp('pillar', pillars);
    this.instancedProp('pillar', lowP);
    // torches on north walls
    this.torches = [];
    this.flames = [];
    const nw = this.northWalls.slice().sort(() => Math.random() - 0.5);
    const used = [];
    for (const w of nw) {
      if (this.torches.length >= 10) break;
      if (used.some((u) => Math.abs(u.x - w.x) + Math.abs(u.y - w.y) < 6)) continue;
      used.push(w);
      const p = w.p.clone().add(new THREE.Vector3(0, 1.3, 0.3));
      const t = this.placeProp('torch_mounted', p, 0.6);
      const l = new THREE.PointLight(0xff9a45, 16, 11, 1.3);
      l.position.copy(p).add(new THREE.Vector3(0, 0.5, 0.6));
      this.root.add(l);
      this.torches.push(l);
      this.flames.push(p.clone().add(new THREE.Vector3(0, 0.45, 0.3)));
    }
    // banners on some north walls
    for (const w of nw.slice(0, 40)) {
      if (Math.random() < 0.18 && !used.some((u) => u.x === w.x && u.y === w.y)) this.placeProp(Math.random() < 0.5 ? 'banner_patternA_red' : 'banner_thin_blue', w.p.clone().add(new THREE.Vector3(0, -0.2, -0.05)), 0.5);
    }
    // room props
    const propSet = [['barrel_large', 0.5], ['barrel_small', 0.7], ['crates_stacked', 0.5], ['box_stacked', 0.35], ['keg', 0.45], ['trunk_large_A', 0.7], ['rubble_half', 0.4], ['table_long_broken', 0.55], ['sword_shield_broken', 0.8], ['shelf_small_candles', 1]];
    for (let i = 1; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      const n = Math.floor(Math.random() * 4) + 1;
      for (let k = 0; k < n; k++) {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = r.x + 1 + Math.floor(Math.random() * (r.w - 2)); y = r.y; }
        else if (edge === 1) { x = r.x + 1 + Math.floor(Math.random() * (r.w - 2)); y = r.y + r.h - 1; }
        else if (edge === 2) { x = r.x; y = r.y + 1 + Math.floor(Math.random() * (r.h - 2)); }
        else { x = r.x + r.w - 1; y = r.y + 1 + Math.floor(Math.random() * (r.h - 2)); }
        if (!this.isFloor(x, y)) continue;
        let solid = 0, door = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          const inside = nx >= r.x && nx < r.x + r.w && ny >= r.y && ny < r.y + r.h;
          if (!this.isFloor(nx, ny)) solid++; else if (!inside) door = true;
        }
        if (solid !== 1 || door) continue;
        const [name, sc] = pick(propSet);
        this.placeProp(name, this.toWorld(x, y), sc, Math.random() * Math.PI * 2);
        this.cells[this.idx(x, y)] = 2;
      }
      if (r.w >= 8 && r.h >= 8 && Math.random() < 0.6) {
        for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) {
          if (!this.isFloor(px, py)) continue;
          this.placeProp('pillar_decorated', this.toWorld(px, py), 0.45);
          this.cells[this.idx(px, py)] = 2;
        }
      }
    }
    for (let i = 0; i < 25; i++) {
      const p = this.randomFloorIn(pick(this.rooms));
      this.placeProp(pick(['rubble_half', 'bottle_A_brown', 'coin_stack_medium', 'candle_triple']), p, 0.2 + Math.random() * 0.2, Math.random() * 6);
    }
  }

  groundTexture() {
    const S = 1024, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const span = (this.w + 16) * CELL;
    const toPx = (wx) => ((wx + 16) / span) * S;
    g.fillStyle = '#4f7a36'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = Math.random() * 6 + 1;
      g.fillStyle = `rgba(${40 + Math.random() * 50},${90 + Math.random() * 60},${30 + Math.random() * 30},${0.25 + Math.random() * 0.3})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const path = (pts, w) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [col, ww] of [['rgba(110,88,60,0.5)', w * 1.4], ['#8a7050', w], ['rgba(150,125,90,0.6)', w * 0.5]]) {
        g.strokeStyle = col; g.lineWidth = ww;
        g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(toPx(x * CELL), toPx(z * CELL)) : g.moveTo(toPx(x * CELL), toPx(z * CELL)))); g.stroke();
      }
    };
    const pw = (3.2 / span) * S * CELL / 2;
    path([[17, 33], [17, 22], [17, 12]], pw);
    path([[7, 10.5], [12, 12.5], [17, 13], [22, 12.5], [26, 10.5]], pw);
    path([[17, 21], [23, 23], [26.5, 28.5]], pw * 0.8);
    path([[17, 21], [11, 22.5], [8, 22]], pw * 0.8);
    // cobbled plaza
    const cx = toPx(17 * CELL), cz = toPx(17 * CELL), pr = (7.5 / span) * S * CELL;
    g.fillStyle = '#5e574e'; g.beginPath(); g.arc(cx, cz, pr, 0, 7); g.fill();
    // concentric rings of cobbles, one muted stone tone each
    const stone = 9;
    for (let rr = stone * 0.6; rr < pr - 2; rr += stone) {
      const n = Math.max(6, Math.floor((Math.PI * 2 * rr) / (stone * 1.15)));
      const off = Math.random() * 7;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        const l = 105 + Math.random() * 40;
        g.save(); g.translate(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr); g.rotate(a);
        g.fillStyle = `rgb(${l + 10},${l + 4},${l - 6})`;
        g.beginPath(); g.roundRect(-stone * 0.42, -stone * 0.5, stone * 0.84, stone * 0.95, 2.5); g.fill();
        g.fillStyle = 'rgba(255,245,225,0.12)'; g.fillRect(-stone * 0.3, -stone * 0.4, stone * 0.5, stone * 0.25);
        g.restore();
      }
    }
    g.strokeStyle = 'rgba(60,55,50,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cz, pr, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return { tex: t, span };
  }

  buildTownVisuals() {
    const { tex, span } = this.groundTexture();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(span / 2 - 16, 0, span / 2 - 16);
    ground.receiveShadow = true;
    this.root.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x4a7232, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(34, -0.05, 34); outer.receiveShadow = true;
    this.root.add(outer);
    for (const o of this.buildingObjs) this.root.add(o);
    // town wall
    const W = (this.w - 1) * CELL;
    for (let i = 0; i < 17; i++) {
      const a = i * 4 + 2;
      this.placeProp('wall_straight', new THREE.Vector3(a, 0, -0.6), 2, 0);
      this.placeProp('wall_straight', new THREE.Vector3(a, 0, W + 0.6), 2, 0);
      this.placeProp('wall_straight', new THREE.Vector3(-0.6, 0, a), 2, Math.PI / 2);
      this.placeProp('wall_straight', new THREE.Vector3(W + 0.6, 0, a), 2, Math.PI / 2);
    }
    // pond
    const pond = this.blocked.find((b) => b.type === 'pond');
    const pcx = (pond.x + (pond.w - 1) / 2) * CELL, pcz = (pond.y + (pond.h - 1) / 2) * CELL;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x2d6a9f, roughness: 0.08, metalness: 0.5, emissive: 0x0a2a4a, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2; water.scale.set(pond.w * CELL / 2, pond.h * CELL / 2, 1); water.position.set(pcx, 0.06, pcz);
    this.root.add(water);
    this.water = water;
    const bank = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x6b5d45, roughness: 1 }));
    bank.rotation.x = -Math.PI / 2; bank.scale.set(pond.w * CELL / 2 + 0.8, pond.h * CELL / 2 + 0.8, 1); bank.position.set(pcx, 0.03, pcz);
    this.root.add(bank);
    for (let i = 0; i < 7; i++) this.placeProp('waterlily_A', new THREE.Vector3(pcx + rand(-4, 4), 0.07, pcz + rand(-2.5, 2.5)), 6, rand(0, 6));
    for (let i = 0; i < 10; i++) { const a = rand(0, Math.PI * 2); this.placeProp(pick(['waterplant_A', 'rock_single_A', 'rock_single_C']), new THREE.Vector3(pcx + Math.cos(a) * (pond.w + 0.5), 0, pcz + Math.sin(a) * (pond.h + 0.5)), 6, rand(0, 6)); }
    // well
    this.placeProp('building_well_blue', this.toWorld(16.5, 16.5), 5, 0);
    const glow = new THREE.PointLight(0x66aaff, 6, 6, 1.5); glow.position.copy(this.toWorld(16.5, 16.5)).setY(0.8); this.root.add(glow);
    // trees inside
    for (const [x, y] of this.trees) this.placeProp(pick(['tree_single_A', 'tree_single_B']), this.toWorld(x, y), rand(4.5, 6), rand(0, 6));
    // countryside ring
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2), r = rand(42, 75);
      const p = new THREE.Vector3(33 + Math.cos(a) * r, 0, 33 + Math.sin(a) * r);
      this.placeProp(pick(['trees_A_medium', 'trees_B_medium', 'tree_single_A', 'tree_single_B', 'hills_A_trees']), p, rand(6, 9), rand(0, 6));
    }
    for (let i = 0; i < 10; i++) { const a = rand(0, Math.PI * 2); this.placeProp('mountain_A_grass_trees', new THREE.Vector3(33 + Math.cos(a) * 85, 0, 33 + Math.sin(a) * 85), rand(18, 26), rand(0, 6)); }
    this.placeProp('building_windmill_yellow', new THREE.Vector3(-14, 3, 40), 7, 1);
    // market dressing
    const deco = [['tent', [12, 10], 5], ['crate_A_big', [11, 9], 6], ['sack', [10.5, 10.2], 8], ['barrel', [4, 10], 6], ['wheelbarrow', [3.5, 12], 6], ['resource_lumber', [9, 18.5], 5], ['barrel', [22, 10], 6], ['flag_red', [21, 9.5], 7], ['bucket_water', [14.5, 17], 7], ['crate_A_big', [30, 11], 6], ['sack', [24, 28.5], 8]];
    for (const [n, [x, y], sc] of deco) { this.placeProp(n, this.toWorld(x, y), sc, rand(0, 6)); this.cells[this.idx(Math.round(x), Math.round(y))] = 2; }
    // lamps
    this.lamps = [];
    for (const [x, y] of [[15, 13], [19, 13], [15, 21.5], [19, 21.5], [9, 21], [25, 21]]) {
      const p = this.toWorld(x, y);
      const post = cyl(0.07, 0.09, 2.6, 0x262626); post.position.copy(p).setY(1.3); this.root.add(post);
      const cap = cone(0.3, 0.25, 0x262626, 0, 4); cap.position.copy(p).setY(2.95); this.root.add(cap);
      const bulb = sphere(0.18, 0xffcc73, 2.5); bulb.position.copy(p).setY(2.7); bulb.castShadow = false; this.root.add(bulb);
      if (this.lamps.length < 4) { const l = new THREE.PointLight(0xffcc73, 7, 9, 1.5); l.position.copy(p).setY(2.6); this.root.add(l); this.lamps.push(l); }
    }
  }

  // ---------- population ----------
  interact(kind, p, data = {}) { const e = new Interact(kind, data); e.root.position.copy(p); return this.add(e); }

  populateTown() {
    const bf = (n) => this.buildings.find((b) => b.name === n);
    const m = bf('building_market_red'), t = bf('building_tavern_blue'), c = bf('building_church_blue');
    this.interact('merchant', this.toWorld(m.c[0], m.front + 0.3), { name: 'Odessa Thrush, Merchant' });
    this.interact('quest', this.toWorld(t.c[0], t.front + 0.3), { name: QUEST_GIVER });
    this.interact('healer', this.toWorld(c.c[0] - 3, c.c[1] - 1), { name: 'Brother Fennick, Healer' });
    this.interact('pond', this.toWorld(7, 22).add(new THREE.Vector3(0, 0, -0.3)), { name: 'Fishing Pond' });
    this.interact('well', this.toWorld(16.5, 16.5), { name: 'The Old Well - Enter the Sunken Wells' });
    if (G.portalFloor > 0) this.interact('portal', this.portalPos, { name: `Portal to Floor ${G.portalFloor}` });
    for (const e of this.entities) if (e.kind && e.kind !== 'well' && e.kind !== 'portal') { const [x, y] = this.cellOf(e.pos); if (this.cells[this.idx(x, y)] !== 1) e.pos.copy(this.toWorld(...this.nearestFloor(x, y))); }
  }

  populateDungeon() {
    const f = this.floor;
    this.interact('stairs_up', this.startPos.clone().add(new THREE.Vector3(-1.5, 0, -1.5)), { name: f === 1 ? 'Stairs Up to Hollowmere' : `Stairs Up to Floor ${f - 1}` });
    this.interact('stairs_down', this.downPos, { name: `Stairs Down to Floor ${f + 1}` });
    const pool = ENEMIES.filter((e) => e.minFloor <= f);
    for (let i = 1; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      const packs = 1 + (Math.random() < 0.4 + f * 0.03 ? 1 : 0);
      for (let p = 0; p < packs; p++) {
        const t = pick(pool);
        const cnt = randi(2, 4) + Math.min(Math.floor(f / 3), 3);
        const elitePack = Math.random() < 0.12;
        for (let j = 0; j < cnt; j++) {
          const e = new Enemy(t, f, elitePack && j === 0, false);
          e.root.position.copy(this.randomFloorIn(r));
          this.add(e);
        }
      }
    }
    if (f % 5 === 0) {
      const b = { ...BOSSES[(f / 5 - 1) % BOSSES.length], hp: 260, dmg: 14, speed: 3.0, xp: 220 };
      const be = new Enemy(b, f, false, true);
      be.root.position.copy(this.downPos).add(new THREE.Vector3(2, 0, 2));
      this.add(be);
    }
    const otherRoom = () => this.rooms[randi(1, this.rooms.length - 1)];
    for (let i = randi(1, 3); i > 0; i--) this.interact('chest', this.randomFloorIn(otherRoom()), { name: 'Old Chest' });
    if (Math.random() < 0.45) this.interact('fish_hole', this.randomFloorIn(otherRoom()), { name: 'Fishing Hole' });
    if (Math.random() < 0.4) this.interact(pick(['shrine_power', 'shrine_speed', 'shrine_wealth']), this.randomFloorIn(otherRoom()), { name: 'Ancient Shrine' });
    const q = G.quest;
    if (q && q.type === 'relic' && !q.done && q.floor === f) {
      const r = this.rooms[randi(Math.floor(this.rooms.length / 2), this.rooms.length - 1)];
      this.interact('relic', this.randomFloorIn(r), { name: 'Brass Lantern' });
    }
  }

  dropLoot(p, f, elite, boss) {
    const mf = G.main.magicFind();
    const drops = [];
    if (Math.random() < 0.55 || elite || boss) {
      let g = Math.floor(randi(2, 7) * (1 + f * 0.6) * (1 + G.main.goldFind() / 100));
      if (boss) g *= 6;
      drops.push({ gold: g });
    }
    let n = Math.random() < 0.17 ? 1 : 0;
    if (elite) n = 2;
    if (boss) n = 4;
    for (let i = 0; i < n; i++) drops.push({ item: generate(f + randi(0, 1), mf + (boss ? 100 : 0), boss && i === 0 ? 2 : elite ? 1 : 0) });
    if (Math.random() < 0.09) drops.push({ potion: Math.random() < 0.65 ? 'hp' : 'mp' });
    for (const d of drops) {
      const l = new Loot(d);
      const tp = p.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(-1.2, 1.2)));
      l.root.position.copy(this.walkable(tp) ? tp : p).setY(0);
      this.add(l);
    }
  }
}
