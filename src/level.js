import * as THREE from 'three';
import { G } from './state.js';
import { ENEMIES, BOSSES, QUEST_GIVER } from './data.js';
import { rand, randi, pick, box, cyl, cone, sphere } from './util.js';
import { generate } from './items.js';
import { Enemy, Interact, Loot, Villager } from './entities.js';
import { prop, propMesh } from './assets.js';
import { groundDetail, addDetail, grassField, flowers, grimeTexture } from './textures.js';

export const CELL = 2;

// Ambient townsfolk (original characters and lines)
const VILLAGERS = [
  { name: 'Marta the Baker', model: 'Mage', tint: 0xffe0c0, at: [22, 16], lines: ['Fresh bread at dawn, if the Wells stay quiet.', 'My oven has been warmer since you came to town.', 'Bring me wheat from the farm and I will bake you something grand. Someday.'] },
  { name: 'Old Tobin', model: 'Knight', tint: 0xb0b0b0, scale: 0.95, at: [12, 18], lines: ['I went down the Well once. Once.', 'Back in my day the skeletons had manners.', 'Mind the third floor. It hums.'] },
  { name: 'Lettie', model: 'Rogue', tint: 0xffd0e0, scale: 0.62, speed: 2.6, roam: 12, at: [18, 24], lines: ['Are you a real hero?', 'I found a shiny rock. It is mine now.', 'Mama says not to go near the Well.'] },
  { name: 'Pell', model: 'Barbarian', tint: 0xd0ffd0, scale: 0.6, speed: 2.6, roam: 12, at: [16, 24], lines: ['Race you to the pond!', 'When I grow up I will fight the Drowned Warden.', 'Your fox is the best fox.'] },
  { name: 'Hanne the Farmer', model: 'Barbarian', tint: 0xffe8a0, at: [8, 39.5], roam: 4, lines: ['Good soil this year. Strange glowing worms, though.', 'The crows will not go near the Well field.', 'Nothing beats an honest harvest.'] },
  { name: 'Gaffer Rusk', model: 'Knight', tint: 0xc8a080, mode: 'fish', at: [10.5, 25.5], ry: -Math.PI / 2, lines: ['Shh. You will scare the perch.', 'Feed a glowfin to your fox. Trust me.', 'Biggest catch I ever saw was an old boot. Still proud of it.'] },
  { name: 'Wren the Bard', model: 'Rogue_Hooded', tint: 0xd8c0ff, mode: 'perform', cape: '#7a2a8a', at: [28, 41.2], lines: ['A song for the brave, a coin for the bard!', 'I am writing a ballad about you. It needs more dragons.', 'Every hero needs a theme tune.'] },
  { name: 'Captain Arlo', model: 'Knight', mode: 'guard', helm: true, headgear: 'Knight_Helmet', gear: { weapon: ['2H_Sword'], offhand: [] }, cape: '#1f3f8c', at: [17, 31.5], lines: ['The south road is safe. For now.', 'Report anything strange that crawls out of the Well.', 'Stand tall, adventurer.'] },
  { name: 'Guard Bexley', model: 'Knight', mode: 'guard', helm: true, headgear: 'Knight_Helmet', gear: { weapon: ['2H_Sword'], offhand: [] }, cape: '#1f3f8c', at: [33, 11.5], ry: -Math.PI / 2, lines: ['Move along.', 'Quiet shift. I like quiet shifts.', 'Heard the lumbermill is hiring.'] },
  { name: 'Sister Ama', model: 'Mage', tint: 0xffffff, cape: '#e8e8e8', at: [26, 21], roam: 5, lines: ['Brother Fennick never sleeps. I worry.', 'May the light keep your lantern lit.', 'Rest is a weapon too.'] },
  { name: 'Joss the Woodcutter', model: 'Barbarian', tint: 0xc0a080, at: [40, 16], roam: 6, lines: ['Timber for the walls, timber for the bridges.', 'Hear that creak? That is the mill singing.', 'Never trust a tree that moves.'] },
  { name: 'Archer Tamsin', model: 'Rogue', tint: 0xc0ffc0, mode: 'guard', at: [39, 35.5], ry: Math.PI / 2, lines: ['Bullseye, three times running.', 'Want lessons? Bring arrows.', 'The skeleton archers below cheat. I am sure of it.'] },
  { name: 'Merchant Faye', model: 'Rogue_Hooded', tint: 0xfff0b0, cape: '#c08020', at: [35.5, 41.5], roam: 3, lines: ['Silks from the coast! Well, from the cart.', 'Odessa undercuts me. Do not tell her I said that.', 'Everything is for sale, eventually.'] },
  { name: 'Brin', model: 'Mage', tint: 0xb0d0ff, mode: 'sit', at: [23, 30], ry: Math.PI, lines: ['Lovely day for doing nothing.', 'I counted the clouds. Nineteen.', 'Shh, I am thinking.'] },
  { name: 'Dorran', model: 'Knight', tint: 0xffc0a0, at: [36, 26], roam: 8, lines: ['My roof leaks. Again.', 'You look like someone who fights things.', 'Have you seen my goat?'] },
  { name: 'Ivy', model: 'Rogue', tint: 0xffe0a0, scale: 0.62, speed: 2.4, roam: 10, at: [40, 9], lines: ['Tag, you are it!', 'I can climb the windmill. Almost.', 'Is your sword heavy?'] },
];

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
    this.timeU = { value: 0 };
    this.noAO = [];
    this.buildEnv();
    if (kind === 'town') { this.buildTownVisuals(); this.populateTown(); }
    else { this.buildDungeonVisuals(); this.addDungeonDetail(); this.populateDungeon(); }
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
    this.alloc(48, 48);
    this.carve(1, 1, 46, 46);
    this.buildings = [
      { name: 'building_market_red', c: [8, 6.5], s: 6, ry: 0, npc: 'merchant' },
      { name: 'building_tavern_blue', c: [26, 6.5], s: 6.5, ry: 0 },
      { name: 'building_church_blue', c: [27, 25], s: 6, ry: 0 },
      { name: 'building_blacksmith_green', c: [6, 15.5], s: 5.5, ry: Math.PI / 2 },
      { name: 'building_home_A_yellow', c: [15, 5], s: 6, ry: 0 },
      { name: 'building_home_B_red', c: [19.5, 26.5], s: 5.5, ry: Math.PI },
      { name: 'building_home_A_blue', c: [28.5, 15.5], s: 6, ry: -Math.PI / 2 },
      { name: 'building_tower_A_blue', c: [13, 27], s: 4.5, ry: 0 },
      // east lane
      { name: 'building_home_B_blue', c: [37.5, 5], s: 5.5, ry: 0 },
      { name: 'building_home_A_red', c: [44, 5], s: 5.5, ry: 0 },
      { name: 'building_lumbermill_yellow', c: [43.5, 15], s: 5.5, ry: -Math.PI / 2 },
      { name: 'building_home_A_green', c: [37, 22], s: 5.5, ry: Math.PI / 2 },
      { name: 'building_home_B_green', c: [44, 26], s: 5.5, ry: -Math.PI / 2 },
      { name: 'building_archeryrange_green', c: [43.5, 35.5], s: 5, ry: -Math.PI / 2 },
      // south lane
      { name: 'building_grain', c: [4.5, 43], s: 5.5, ry: 0 },
      { name: 'building_home_B_yellow', c: [12, 44], s: 5.5, ry: 0 },
      { name: 'building_home_A_blue', c: [19, 44], s: 5.5, ry: 0 },
      { name: 'building_stage_A', c: [28, 43.5], s: 5, ry: 0 },
      { name: 'building_market_yellow', c: [35.5, 44], s: 5.5, ry: 0 },
      { name: 'building_tower_B_red', c: [44, 44.5], s: 4.5, ry: 0 },
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
    this.trees = [[3, 9], [30, 10], [11, 31], [22, 31], [31, 21], [3, 31], [20, 11], [13, 11], [31, 30], [9, 20], [34, 12], [46, 20], [34, 30], [24, 36], [8, 36], [46, 40], [31, 46], [39, 33], [2, 37], [15, 38]];
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
      this.scene.environmentIntensity = 0.3;
    } else {
      const tint = [0x5a6a90, 0x8a5a4a, 0x4a7a5a, 0x7a4a8a][theme];
      this.scene.background = new THREE.Color(0x030305);
      this.scene.fog = new THREE.Fog(0x030305, 30, 58);
      this.ambient = new THREE.HemisphereLight(tint, 0x2a2a34, 1.9);
      this.sun.color.set(tint); this.sun.intensity = 1.3;
      this.scene.environmentIntensity = 0.12;
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

  addDungeonDetail() {
    const theme = Math.floor((this.floor - 1) / 3) % 4;
    const cellPx = 20;
    const moss = ['rgba(70,110,60,0.35)', 'rgba(120,60,30,0.35)', 'rgba(60,120,70,0.4)', 'rgba(90,60,120,0.35)'][theme];
    const isF = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && this.cells[this.idx(x, y)] > 0;
    const t = grimeTexture(this.w * cellPx, cellPx, isF, this.w, this.h, moss);
    const W = this.w * CELL;
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, W), m);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(W / 2 - CELL / 2, 0.025, W / 2 - CELL / 2);
    plane.renderOrder = 1;
    this.root.add(plane);
    this.noAO.push(plane);
    // reflective puddles
    const pm = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (let i = 0; i < 14; i++) {
      const r = this.rooms[randi(0, this.rooms.length - 1)];
      const p = this.randomFloorIn(r);
      const pd = new THREE.Mesh(new THREE.CircleGeometry(1, 20), pm);
      pd.rotation.x = -Math.PI / 2; pd.scale.set(rand(0.4, 1.1), rand(0.3, 0.8), 1); pd.rotation.z = rand(0, 3);
      pd.position.set(p.x, 0.03, p.z); pd.renderOrder = 2;
      this.root.add(pd);
      this.noAO.push(pd);
    }
  }

  groundTexture() {
    const S = 2048, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const span = (this.w + 16) * CELL;
    const toPx = (wx) => ((wx + 16) / span) * S;
    g.fillStyle = '#4f7a36'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 16000; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = (Math.random() * 6 + 1) * S / 1024;
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
    path([[26, 10.5], [33, 11], [40, 11.5], [40, 20], [40, 30], [40, 38]], pw);
    path([[17, 33], [17, 38.5], [30, 39], [40, 38.5]], pw);
    path([[17, 38.5], [8, 39], [4, 39.5]], pw * 0.8);
    path([[40, 20], [33, 20.5], [28.5, 20]], pw * 0.7);
    // farm field
    g.fillStyle = '#6a4e2e'; g.fillRect(toPx(2 * CELL), toPx(33.5 * CELL), toPx(10 * CELL) - toPx(2 * CELL), toPx(37.5 * CELL) - toPx(33.5 * CELL));
    for (let r = 0; r < 9; r++) { g.fillStyle = r % 2 ? '#5a4024' : '#7a9a3a'; g.fillRect(toPx(2.2 * CELL), toPx((33.8 + r * 0.42) * CELL), toPx(9.8 * CELL) - toPx(2.2 * CELL), 5); }
    // cobbled plaza
    const cx = toPx(17 * CELL), cz = toPx(17 * CELL), pr = (7.5 / span) * S * CELL;
    g.fillStyle = '#5e574e'; g.beginPath(); g.arc(cx, cz, pr, 0, 7); g.fill();
    // concentric rings of cobbles, one muted stone tone each
    const stone = 9 * S / 1024;
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
        g.strokeStyle = 'rgba(40,34,28,0.6)'; g.lineWidth = 1.5; g.stroke();
        g.restore();
      }
    }
    g.strokeStyle = 'rgba(60,55,50,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cz, pr, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    this.groundPx = { data: g.getImageData(0, 0, S, S).data, S, span };
    return { tex: t, span };
  }

  buildTownVisuals() {
    const { tex, span } = this.groundTexture();
    const det = groundDetail();
    const rep = span / 3.2;
    const nrm = det.normal.clone(); nrm.repeat.set(rep, rep); nrm.needsUpdate = true;
    const gmat = addDetail(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9) }), det.albedo, rep, 0.5);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span, span), gmat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(span / 2 - 16, 0, span / 2 - 16);
    ground.receiveShadow = true;
    this.root.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), addDetail(new THREE.MeshStandardMaterial({ color: 0x4a7232, roughness: 1 }), det.albedo, 120, 0.45));
    outer.rotation.x = -Math.PI / 2; outer.position.set(47, -0.05, 47); outer.receiveShadow = true;
    this.root.add(outer);
    for (const o of this.buildingObjs) this.root.add(o);
    // 3D grass and flowers on green areas only
    const gp = this.groundPx;
    const isGrass = (x, z) => {
      const px = Math.floor(((x + 16) / gp.span) * gp.S), pz = Math.floor(((z + 16) / gp.span) * gp.S);
      if (px < 0 || pz < 0 || px >= gp.S || pz >= gp.S) return false;
      const i = (pz * gp.S + px) * 4, r = gp.data[i], gg = gp.data[i + 1], b = gp.data[i + 2];
      if (!(gg > r * 1.2 && gg > b * 1.3)) return false;
      const [cx, cy] = this.cellOf(new THREE.Vector3(x, 0, z));
      return !(cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) || this.cells[this.idx(cx, cy)] !== 0;
    };
    const area = { x0: -12, z0: -12, x1: (this.w + 5) * CELL, z1: (this.h + 5) * CELL };
    const gf = grassField(9000, area, isGrass, this.timeU), fl = flowers(500, area, isGrass);
    this.root.add(gf, fl);
    this.noAO.push(gf, fl);
    // town wall
    const W = (this.w - 1) * CELL;
    for (let i = 0; i < Math.ceil(W / 4); i++) {
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
    this.noAO.push(water);
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
      const C = (this.w - 1) * CELL / 2; const p = new THREE.Vector3(C + Math.cos(a) * (r + 14), 0, C + Math.sin(a) * (r + 14));
      this.placeProp(pick(['trees_A_medium', 'trees_B_medium', 'tree_single_A', 'tree_single_B', 'hills_A_trees']), p, rand(6, 9), rand(0, 6));
    }
    for (let i = 0; i < 10; i++) { const a = rand(0, Math.PI * 2); const C = (this.w - 1) * CELL / 2; this.placeProp(pick(['mountain_A_grass_trees', 'hills_B_trees']), new THREE.Vector3(C + Math.cos(a) * 105, 0, C + Math.sin(a) * 105), rand(18, 26), rand(0, 6)); }
    this.placeProp('building_windmill_yellow', new THREE.Vector3(-14, 3, 40), 7, 1);
    // market dressing
    const deco = [['tent', [12, 10], 5], ['crate_A_big', [11, 9], 6], ['sack', [10.5, 10.2], 8], ['barrel', [4, 10], 6], ['wheelbarrow', [3.5, 12], 6], ['resource_lumber', [9, 18.5], 5], ['barrel', [22, 10], 6], ['flag_red', [21, 9.5], 7], ['bucket_water', [14.5, 17], 7], ['crate_A_big', [30, 11], 6], ['sack', [24, 28.5], 8],
      ['resource_lumber', [42, 19.5], 5], ['pallet', [45, 19], 6], ['ladder', [41.5, 13], 5], ['target', [41, 33], 6], ['target', [41, 37], 6], ['bucket_arrows', [42, 35], 7],
      ['crate_open', [33, 41.5], 6], ['crate_long_A', [38, 41.5], 6], ['flag_blue', [26, 41], 7], ['flag_yellow', [30.5, 41], 7], ['sack', [7, 41], 8], ['wheelbarrow', [9.5, 41], 6],
      ['resource_stone', [35, 25], 6], ['barrel', [38.5, 8.5], 6], ['bucket_water', [43, 8.5], 7], ['crate_A_big', [46, 30], 6]];
    for (const [n, [x, y], sc] of deco) { this.placeProp(n, this.toWorld(x, y), sc, rand(0, 6)); this.cells[this.idx(Math.round(x), Math.round(y))] = 2; }
    // farm fence
    for (let x = 2.5; x < 10; x += 1.5) { this.placeProp('fence_wood_straight', this.toWorld(x, 33.2), 3.2, 0); this.placeProp('fence_wood_straight', this.toWorld(x, 37.8), 3.2, 0); }
    for (let x = 2.4; x < 10; x += 0.9) for (let z = 34; z < 37.6; z += 0.85) { const c = this.placeProp('tree_single_A', this.toWorld(x + rand(-0.1, 0.1), z), rand(0.9, 1.3), rand(0, 6)); c.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setHex(0xd8c050); } }); }
    for (let y = 33; y <= 38; y++) for (let x = 2; x <= 10; x++) if (this.cells[this.idx(x, y)] === 1) this.cells[this.idx(x, y)] = 2;
    // lamps
    this.lamps = [];
    for (const [x, y] of [[15, 13], [19, 13], [15, 21.5], [19, 21.5], [9, 21], [25, 21], [33, 10], [39, 18], [39, 29], [16, 36.5], [26, 37.5], [36, 37.5], [8, 37.5]]) {
      const p = this.toWorld(x, y);
      const post = cyl(0.07, 0.09, 2.6, 0x262626); post.position.copy(p).setY(1.3); this.root.add(post);
      const cap = cone(0.3, 0.25, 0x262626, 0, 4); cap.position.copy(p).setY(2.95); this.root.add(cap);
      const bulb = sphere(0.18, 0xffcc73, 2.5); bulb.position.copy(p).setY(2.7); bulb.castShadow = false; this.root.add(bulb);
      if (this.lamps.length < 6) { const l = new THREE.PointLight(0xffcc73, 7, 9, 1.5); l.position.copy(p).setY(2.6); this.root.add(l); this.lamps.push(l); }
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
    this.interact('blacksmith', this.toWorld(9.6, 15.5), { name: 'Hobb Ironhand, Blacksmith' }).root.rotation.y = Math.PI / 2;
    for (const v of VILLAGERS) {
      const e = new Villager(v);
      e.root.position.copy(this.toWorld(...v.at));
      if (v.ry !== undefined) e.root.rotation.y = v.ry;
      this.add(e);
    }
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
