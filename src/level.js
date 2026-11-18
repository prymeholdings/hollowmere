import * as THREE from 'three';
import { G } from './state.js';
import { ENEMIES, BOSSES, QUEST_GIVER } from './data.js';
import { rand, randi, pick, box, cyl, cone, sphere } from './util.js';
import { generate } from './items.js';
import { Enemy, Interact, Loot } from './entities.js';

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
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } });
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
    this.blocked = [
      { x: 5, y: 5, w: 6, h: 5, type: 'house', color: 0x8c6140, roof: 0x80261f },
      { x: 23, y: 5, w: 6, h: 5, type: 'house', color: 0x807a6b, roof: 0x263f73 },
      { x: 4, y: 23, w: 7, h: 5, type: 'pond' },
      { x: 24, y: 24, w: 5, h: 4, type: 'house', color: 0x73594d, roof: 0x406633 },
      { x: 16, y: 16, w: 2, h: 2, type: 'well' },
    ];
    for (const b of this.blocked) this.carve(b.x, b.y, b.w, b.h, 0);
    this.trees = [[3, 16], [30, 16], [13, 29], [21, 29], [30, 20], [3, 12]];
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
    sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.root.add(this.sun, this.sun.target);
    if (this.kind === 'town') {
      this.scene.background = new THREE.Color(0x7d93b3);
      this.scene.fog = new THREE.Fog(0x7d93b3, 45, 95);
      this.ambient = new THREE.HemisphereLight(0xc8d8ff, 0x4a5a3a, 1.2);
      this.sun.color.set(0xffe6c0); this.sun.intensity = 2.2;
    } else {
      const tint = [0x5a6a90, 0x8a5a4a, 0x4a7a5a, 0x7a4a8a][theme];
      this.scene.background = new THREE.Color(0x050507);
      this.scene.fog = new THREE.Fog(0x050507, 22, 46);
      this.ambient = new THREE.HemisphereLight(tint, 0x202028, 1.6);
      this.sun.color.set(tint); this.sun.intensity = 0.6;
    }
    this.root.add(this.ambient);
  }

  buildDungeonVisuals() {
    const theme = Math.floor((this.floor - 1) / 3) % 4;
    const fc = new THREE.Color([0x5c5752, 0x664d3d, 0x475747, 0x52475c][theme]);
    const wc = new THREE.Color([0x4d4d57, 0x614233, 0x384d3d, 0x473852][theme]);
    const floors = [], walls = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.isFloor(x, y)) {
        floors.push({ p: new THREE.Vector3(x * CELL, -0.1, y * CELL), c: fc.clone().multiplyScalar(rand(0.8, 1.05)) });
      } else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (this.isFloor(x + dx, y + dy)) { near = true; break; }
        if (near) {
          const hgt = rand(0.85, 1.15);
          walls.push({ p: new THREE.Vector3(x * CELL, 0.75 * hgt, y * CELL), s: new THREE.Vector3(1, hgt, 1), c: wc.clone().multiplyScalar(rand(0.7, 1.0)) });
        }
      }
    }
    this.instanced(new THREE.BoxGeometry(CELL * 0.97, 0.2, CELL * 0.97), floors);
    const wm = this.instanced(new THREE.BoxGeometry(CELL, 1.5, CELL), walls);
    wm.castShadow = true;
    // torches
    for (const r of this.rooms) {
      if (Math.random() > 0.65) continue;
      const p = this.toWorld(r.x, r.y).add(new THREE.Vector3(-0.5, 0, -0.5));
      const pole = cyl(0.08, 0.08, 1.8, 0x4d3319); pole.position.copy(p).setY(0.9); this.root.add(pole);
      const fl = sphere(0.2, 0xff9933, 3); fl.position.copy(p).setY(1.9); fl.castShadow = false; this.root.add(fl);
      const l = new THREE.PointLight(0xffa04d, 18, 12, 1.4); l.position.copy(p).setY(2.2); this.root.add(l);
      this.torches = this.torches || []; this.torches.push(l);
    }
    // rubble decoration
    for (let i = 0; i < 30; i++) {
      const r = pick(this.rooms);
      const p = this.randomFloorIn(r);
      const b = box(rand(0.2, 0.5), rand(0.1, 0.3), rand(0.2, 0.5), wc.getHex()); b.position.copy(p).setY(0.1); b.rotation.y = rand(0, 3); this.root.add(b);
    }
  }

  buildTownVisuals() {
    const tiles = [];
    for (let y = -8; y < this.h + 8; y++) for (let x = -8; x < this.w + 8; x++) {
      const onPath = (Math.abs(x - 17) <= 1 && y > 9 && y < 31) || (Math.abs(y - 13) <= 1 && x > 4 && x < 30) || (Math.abs(y - 20) <= 1 && x > 13 && x < 22);
      const c = new THREE.Color(onPath ? 0x7a6a4d : 0x4d7a3d).multiplyScalar(rand(0.82, 1.0));
      tiles.push({ p: new THREE.Vector3(x * CELL, -0.1, y * CELL), c });
    }
    this.instanced(new THREE.BoxGeometry(CELL, 0.2, CELL), tiles);
    const walls = [];
    for (let i = 0; i < this.w; i++) for (const s of [0, this.h - 1]) walls.push({ p: new THREE.Vector3(i * CELL, 0.6, s * CELL), c: new THREE.Color(0x736b66).multiplyScalar(rand(0.75, 1)) });
    for (let i = 1; i < this.h - 1; i++) for (const s of [0, this.w - 1]) walls.push({ p: new THREE.Vector3(s * CELL, 0.6, i * CELL), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), c: new THREE.Color(0x736b66).multiplyScalar(rand(0.75, 1)) });
    this.instanced(new THREE.BoxGeometry(CELL, 1.2, CELL * 0.6), walls).castShadow = true;
    for (const b of this.blocked) {
      const cx = (b.x + (b.w - 1) / 2) * CELL, cz = (b.y + (b.h - 1) / 2) * CELL;
      const sx = b.w * CELL, sz = b.h * CELL;
      if (b.type === 'house') {
        const body = box(sx - 0.4, 3.2, sz - 0.4, b.color); body.position.set(cx, 1.6, cz); this.root.add(body);
        const roof = cone(Math.max(sx, sz) * 0.75, 2.6, b.roof, 0, 4); roof.rotation.y = Math.PI / 4; roof.scale.set(sx / Math.max(sx, sz), 1, sz / Math.max(sx, sz)); roof.position.set(cx, 4.5, cz); this.root.add(roof);
        const door = box(1.2, 2, 0.1, 0x40260f); door.position.set(cx, 1, cz + sz / 2 - 0.15); this.root.add(door);
        for (const s of [-1, 1]) { const win = box(0.9, 0.8, 0.1, 0xffd980, 1.2); win.position.set(cx + s * sx * 0.28, 2, cz + sz / 2 - 0.15); this.root.add(win); }
      } else if (b.type === 'pond') {
        const rim = box(sx, 0.15, sz, 0x6b6355); rim.position.set(cx, -0.02, cz); this.root.add(rim);
        const water = new THREE.Mesh(new THREE.BoxGeometry(sx - 0.5, 0.1, sz - 0.5), new THREE.MeshStandardMaterial({ color: 0x2a5f8f, roughness: 0.15, metalness: 0.3, emissive: 0x0a2040 }));
        water.position.set(cx, 0.04, cz); this.root.add(water);
      } else if (b.type === 'well') {
        const ringm = cyl(1.5, 1.6, 1, 0x73706b); ringm.position.set(cx, 0.5, cz); this.root.add(ringm);
        const hole = cyl(1.2, 1.2, 0.05, 0x000003); hole.position.set(cx, 1.01, cz); this.root.add(hole);
        for (const s of [-1, 1]) { const post = box(0.2, 2.6, 0.2, 0x59381a); post.position.set(cx + s * 1.4, 1.3, cz); this.root.add(post); }
        const roof = cone(2.2, 1.2, 0x66331f, 0, 4); roof.rotation.y = Math.PI / 4; roof.position.set(cx, 3.1, cz); this.root.add(roof);
        const glow = new THREE.PointLight(0x66aaff, 6, 6, 1.5); glow.position.set(cx, 0.6, cz); this.root.add(glow);
      }
    }
    for (const [x, y] of this.trees) this.tree(this.toWorld(x, y));
    for (let i = 0; i < 60; i++) {
      const p = new THREE.Vector3(rand(-14, this.w * CELL + 14), 0, rand(-14, this.h * CELL + 14));
      if (p.x > -1 && p.z > -1 && p.x < this.w * CELL - 1 && p.z < this.h * CELL - 1) continue;
      this.tree(p);
    }
    for (const [x, y] of [[15, 13], [19, 13], [15, 22], [19, 22]]) {
      const p = this.toWorld(x, y);
      const post = cyl(0.07, 0.09, 2.6, 0x262626); post.position.copy(p).setY(1.3); this.root.add(post);
      const bulb = sphere(0.2, 0xffcc73, 2.5); bulb.position.copy(p).setY(2.7); bulb.castShadow = false; this.root.add(bulb);
      const l = new THREE.PointLight(0xffcc73, 8, 9, 1.5); l.position.copy(p).setY(2.6); this.root.add(l);
    }
  }
  tree(p) {
    const s = rand(0.8, 1.4);
    const trunk = cyl(0.15 * s, 0.22 * s, 1.4 * s, 0x59381f); trunk.position.copy(p).setY(0.7 * s); this.root.add(trunk);
    const top = cone(1.1 * s, 2.6 * s, new THREE.Color(0x265930).multiplyScalar(rand(0.7, 1.1)).getHex()); top.position.copy(p).setY(2.6 * s); this.root.add(top);
  }

  // ---------- population ----------
  interact(kind, p, data = {}) { const e = new Interact(kind, data); e.root.position.copy(p); return this.add(e); }

  populateTown() {
    this.interact('merchant', this.toWorld(8, 11), { name: 'Odessa Thrush, Merchant' });
    this.interact('quest', this.toWorld(26, 11), { name: QUEST_GIVER });
    this.interact('healer', this.toWorld(26, 29.3), { name: 'Brother Fennick, Healer' });
    this.interact('pond', this.toWorld(7, 22).add(new THREE.Vector3(0, 0, 0.2)), { name: 'Fishing Pond' });
    this.interact('well', this.toWorld(16.5, 16.5), { name: 'The Old Well - Enter the Sunken Wells' });
    if (G.portalFloor > 0) this.interact('portal', this.portalPos, { name: `Portal to Floor ${G.portalFloor}` });
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
