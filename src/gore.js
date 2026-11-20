// Blood and gore: spurting droplets, ground splatters and growing pools, flying gibs and bone shards.
// Everything is instanced and capped so it stays cheap. Settings.gore: 'off' | 'low' | 'max'.
import * as THREE from 'three';
import { Settings } from './settings.js';
import { sfx } from './audio.js';
import { G } from './state.js';
import { flattenGroup } from './perf.js';

const CELL = 2; // matches level.js

const rnd = Math.random;
const R = (a, b) => a + rnd() * (b - a);
const COLORS = {
  red: [0x8a0d0d, 0x6e0909, 0x9c1414, 0x560606],
  dark: [0x2a0508, 0x3a0a0e, 0x1a0306],
  slime: [0x4aa030, 0x6fcf3a, 0x3a7a28],
  void: [0x3d1a66, 0x5a2a99, 0x2a1050],
  ichor: [0xb8c040, 0x9aa030, 0xd0d860],
  rot: [0x5a0a08, 0x6e140c, 0x480806, 0x7a1a10],
};
const FLESH = [0x7a1a1a, 0x8c2a22, 0x5a1010, 0x9a3a30];
const BONE = [0xe0d8c0, 0xcfc6a8, 0xf0e8d0, 0xb8b090];

function splatAtlas() {
  const S = 128, N = 4, c = document.createElement('canvas');
  c.width = c.height = S * N;
  const g = c.getContext('2d');
  for (let i = 0; i < N * N; i++) {
    const cx = (i % N) * S + S / 2, cy = Math.floor(i / N) * S + S / 2;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = '#fff';
    // central pool, lumpy
    const lumps = 5 + (i % 4);
    for (let k = 0; k < lumps; k++) {
      const a = rnd() * 6.28, d = rnd() * S * 0.12, r = S * R(0.1, 0.2);
      g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, r, r * R(0.6, 1), rnd() * 3, 0, 6.28); g.fill();
    }
    // radiating streaks and flung droplets
    const arms = 6 + Math.floor(rnd() * 8);
    for (let k = 0; k < arms; k++) {
      const a = rnd() * 6.28, len = S * R(0.2, 0.46), w = R(2, 7);
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(S * 0.06, -w); g.quadraticCurveTo(len * 0.6, -w * 0.5, len, 0); g.quadraticCurveTo(len * 0.6, w * 0.5, S * 0.06, w); g.fill();
      if (rnd() < 0.7) { g.beginPath(); g.arc(len + R(3, 10), R(-3, 3), R(1.5, 4), 0, 6.28); g.fill(); }
      g.restore();
    }
    for (let k = 0; k < 14; k++) { const a = rnd() * 6.28, d = S * R(0.15, 0.46); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, R(0.8, 3.2), 0, 6.28); g.fill(); }
    g.restore();
  }
  // blur edges slightly and put a wet highlight in the green channel
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

const DECAL_VS = `attribute float aCell; attribute vec3 aColor; attribute float aA; varying vec2 vUv; varying vec3 vC; varying float vA;
void main(){ vC = aColor; vA = aA; vUv = (uv + vec2(mod(aCell, 4.0), floor(aCell / 4.0))) * 0.25;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const DECAL_FS = `uniform sampler2D map; varying vec2 vUv; varying vec3 vC; varying float vA;
void main(){ vec4 t = texture2D(map, vUv); float a = t.a * vA; if (a < 0.02) discard;
  float edge = smoothstep(0.0, 0.7, t.a);
  vec3 col = vC * (0.55 + 0.45 * edge) + vec3(0.10, 0.02, 0.02) * pow(t.a, 6.0);
  gl_FragColor = vec4(col, a * 0.92); }`;

export class Gore {
  constructor(scene) {
    this.scene = scene;
    this.mobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const MAXD = this.mobile ? 2000 : 6000, MAXP = this.mobile ? 320 : 800, MAXG = this.mobile ? 1200 : 4000;
    this.MAXD = MAXD; this.MAXP = MAXP; this.MAXG = MAXG;
    // ground decals
    const dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
    this.cell = new THREE.InstancedBufferAttribute(new Float32Array(MAXD), 1);
    this.dcol = new THREE.InstancedBufferAttribute(new Float32Array(MAXD * 3), 3);
    this.dalpha = new THREE.InstancedBufferAttribute(new Float32Array(MAXD), 1);
    dg.setAttribute('aCell', this.cell); dg.setAttribute('aColor', this.dcol); dg.setAttribute('aA', this.dalpha);
    this.dmat = new THREE.ShaderMaterial({ uniforms: { map: { value: splatAtlas() } }, vertexShader: DECAL_VS, fragmentShader: DECAL_FS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.decals = new THREE.InstancedMesh(dg, this.dmat, MAXD);
    this.decals.frustumCulled = false; this.decals.renderOrder = 1; this.decals.count = 0;
    scene.add(this.decals);
    this.dinfo = []; this.dnext = 0;
    // droplets
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.1 }), MAXP);
    this.dropMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.dropMesh.frustumCulled = false; this.dropMesh.count = 0;
    scene.add(this.dropMesh);
    this.drops = [];
    // gibs: flesh lumps and bone shards
    // lumpy, wet chunks of meat (smooth-shaded, displaced so no two faces look alike)
    const fg = new THREE.SphereGeometry(1, 16, 12);
    { const p = fg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + Math.sin(v.x * 5.1) * 0.12 + Math.sin(v.y * 6.3 + v.z * 4) * 0.1 + Math.sin(v.z * 7.7) * 0.06; p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k); } fg.computeVertexNormals(); }
    this.fleshMesh = new THREE.InstancedMesh(fg, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xff5050) }), MAXG);
    this.boneMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 1, 8), new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAXG);
    for (const m of [this.fleshMesh, this.boneMesh]) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXG * 3), 3); m.frustumCulled = false; m.count = 0; m.castShadow = true; scene.add(m); }
    this.gibs = [];
    this.pools = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color();
  }
  get level() { return Settings.gore === 'off' ? 0 : Settings.gore === 'low' ? 0.4 : 1; }
  pick(kind) { const l = COLORS[kind] || COLORS.red; return l[(rnd() * l.length) | 0]; }


  // ---------------------------------------------------------------- walls
  // Gore never passes through dungeon walls: it sticks to them or piles up against them.
  // level.wallMask is a snapshot of the floor cells taken when the walls were built.
  floorAt(x, z) {
    const L = G.level;
    if (!L || !L.wallMask) return true;
    const cx = Math.floor(x / CELL + 0.5), cy = Math.floor(z / CELL + 0.5);
    if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return false;
    return L.wallMask[cy * L.w + cx] === 1;
  }
  // moving from (ox,oz) to (x,z): which wall did it hit? { axis, b (wall plane), n (normal pointing back into the room), low }
  wallHit(ox, oz, x, z) {
    if (this.floorAt(x, z) || !this.floorAt(ox, oz)) return null;
    const cxo = Math.floor(ox / CELL + 0.5), czo = Math.floor(oz / CELL + 0.5);
    const cxn = Math.floor(x / CELL + 0.5), czn = Math.floor(z / CELL + 0.5);
    if (cxn !== cxo && !this.floorAt(x, oz)) { const s = Math.sign(cxn - cxo); return { axis: 'x', b: (cxo + s * 0.5) * CELL, n: -s, low: false }; }
    if (czn !== czo) { const s = Math.sign(czn - czo); return { axis: 'z', b: (czo + s * 0.5) * CELL, n: -s, low: s > 0 }; } // south walls are the low ones
    const s = Math.sign(cxn - cxo) || 1; return { axis: 'x', b: (cxo + s * 0.5) * CELL, n: -s, low: false };
  }
  // keep a point (and an optional radius) inside the room it is in or nearest to
  clampIn(x, z, r = 0) {
    const L = G.level;
    if (!L || !L.wallMask) return [x, z, r];
    let cx = Math.floor(x / CELL + 0.5), cy = Math.floor(z / CELL + 0.5);
    if (!this.floorAt(x, z)) {
      let best = null, bd = 1e9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.floorAt(nx * CELL, ny * CELL)) continue;
        const d = (nx * CELL - x) ** 2 + (ny * CELL - z) ** 2;
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (!best) return null;
      [cx, cy] = best;
      x = Math.min(cx * CELL + CELL / 2 - 0.05, Math.max(cx * CELL - CELL / 2 + 0.05, x));
      z = Math.min(cy * CELL + CELL / 2 - 0.05, Math.max(cy * CELL - CELL / 2 + 0.05, z));
    }
    if (r > 0) {
      // the wall covers about 0.45 m beyond its plane; a splat may reach under it but not past it
      const H = CELL / 2, reach = 0.45;
      let lim = r;
      if (!this.floorAt((cx + 1) * CELL, cy * CELL)) lim = Math.min(lim, cx * CELL + H - x + reach);
      if (!this.floorAt((cx - 1) * CELL, cy * CELL)) lim = Math.min(lim, x - (cx * CELL - H) + reach);
      if (!this.floorAt(cx * CELL, (cy + 1) * CELL)) lim = Math.min(lim, cy * CELL + H - z + reach);
      if (!this.floorAt(cx * CELL, (cy - 1) * CELL)) lim = Math.min(lim, z - (cy * CELL - H) + reach);
      // outside corners: a wall cell touching only diagonally
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        if (this.floorAt((cx + sx) * CELL, (cy + sy) * CELL)) continue;
        lim = Math.min(lim, Math.hypot(cx * CELL + sx * H - x, cy * CELL + sy * H - z) + reach);
      }
      r = Math.max(0.08, lim);
    }
    return [x, z, r];
  }
  // a splatter stuck to a wall, with blood running down from it
  wallSplat(hit, y, along, size, kind, alpha = 0.92) {
    if (!this.level) return;
    // dungeon walls are 2 m tall (the low south walls 0.72 m): nothing is drawn above them
    const top = hit.low ? 0.72 : 2.0;
    if (y > top) return false;
    size = Math.min(size, top * 0.9);
    y = Math.min(top - size * 0.5, Math.max(size * 0.3, y));
    // and nothing hangs past the end of a wall (doorways, corners)
    const H = CELL / 2, fc = Math.round((hit.b + hit.n * H) / CELL), wc = fc - hit.n;
    const ac = Math.round(along / CELL);
    const cont = (d) => hit.axis === 'x' ? this.floorAt(fc * CELL, (ac + d) * CELL) && !this.floorAt(wc * CELL, (ac + d) * CELL) : this.floorAt((ac + d) * CELL, fc * CELL) && !this.floorAt((ac + d) * CELL, wc * CELL);
    let lo = cont(-1) ? -1e9 : ac * CELL - H, hi = cont(1) ? 1e9 : ac * CELL + H;
    size = Math.min(size, (hi - lo) * 0.95);
    along = Math.min(hi - size / 2, Math.max(lo + size / 2, along));
    const put = (yy, sz, sy, a) => {
      const i = this.dnext; this.dnext = (this.dnext + 1) % this.MAXD;
      const col = this._c.setHex(typeof kind === 'number' ? kind : this.pick(kind));
      const face = new THREE.Quaternion();
      if (hit.axis === 'x') face.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -hit.n * Math.PI / 2);
      else face.setFromAxisAngle(new THREE.Vector3(1, 0, 0), hit.n * Math.PI / 2);
      const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sy !== 1 ? 0 : rnd() * 6.28);
      face.multiply(spin);
      const off = hit.n * 0.03;
      if (hit.axis === 'x') this._p.set(hit.b + off, yy, along); else this._p.set(along, yy, hit.b + off);
      // stretched drips: the plane's local Z runs up and down the wall for x walls, local X for z walls
      if (hit.axis === 'x') this._s.set(sy, 1, sz); else this._s.set(sz, 1, sy);
      this._m.compose(this._p, face, this._s);
      this.decals.setMatrixAt(i, this._m);
      this.cell.setX(i, (rnd() * 16) | 0);
      this.dcol.setXYZ(i, col.r, col.g, col.b);
      this.dalpha.setX(i, a);
      this.dinfo[i] = { t: 0 };
      this.decals.count = Math.min(this.MAXD, Math.max(this.decals.count, i + 1));
    };
    put(y, size, 1, alpha);
    // runs of blood down the wall to the floor
    if (rnd() < 0.7) { const len = Math.min(y, R(0.3, 1.2)); put(y - len / 2, size * 0.18, len, alpha * 0.85); }
    this.decals.instanceMatrix.needsUpdate = true;
    for (const a of [this.cell, this.dcol, this.dalpha]) a.needsUpdate = true;
    return true;
  }
  // what to do when gore reaches a wall: stick to it and collect at its foot
  hitWall(hit, x, y, z, size, kind) {
    const along = hit.axis === 'x' ? z : x;
    const stuck = this.wallSplat(hit, y, along, size, kind);
    const fx = hit.axis === 'x' ? hit.b + hit.n * R(0.1, 0.35) : x, fz = hit.axis === 'x' ? z : hit.b + hit.n * R(0.1, 0.35);
    if (!stuck || rnd() < 0.5) this.splat(fx, fz, size * R(0.6, 1.1), kind, 0.9);
  }
  // a chunk slams into a wall: it smears the wall, drops and slides down to rest against it
  bounceWall(hit, p, v, r, kind) {
    if (kind) this.wallSplat(hit, p.y, hit.axis === 'x' ? p.z : p.x, R(0.4, 0.8), kind);
    if (hit.axis === 'x') { p.x = hit.b + hit.n * (r + 0.03); v.x = -v.x * 0.15; }
    else { p.z = hit.b + hit.n * (r + 0.03); v.z = -v.z * 0.15; }
    v.y = Math.min(v.y, 0);
  }
  // a splatter on the floor
  splat(x, z, size, kind = 'red', alpha = 0.9) {
    if (!this.level) return;
    const cl = this.clampIn(x, z, size / 2);
    if (!cl) return;
    [x, z] = cl; size = Math.min(size, cl[2] * 2);
    const i = this.dnext; this.dnext = (this.dnext + 1) % this.MAXD;
    const col = this._c.setHex(typeof kind === 'number' ? kind : this.pick(kind));
    this._e.set(0, rnd() * 6.28, 0); this._q.setFromEuler(this._e);
    this._s.set(size, 1, size); this._p.set(x, 0.05, z);
    this._m.compose(this._p, this._q, this._s);
    this.decals.setMatrixAt(i, this._m);
    this.cell.setX(i, (rnd() * 16) | 0);
    this.dcol.setXYZ(i, col.r, col.g, col.b);
    this.dalpha.setX(i, alpha);
    this.dinfo[i] = { t: 0 };
    this.decals.count = Math.min(this.MAXD, Math.max(this.decals.count, i + 1));
    this.decals.instanceMatrix.needsUpdate = true;
    for (const a of [this.cell, this.dcol, this.dalpha]) a.needsUpdate = true;
    return i;
  }
  // a pool that spreads slowly under a corpse
  pool(x, z, size, kind = 'red') {
    if (this.level < 1 || !kind || kind === 'bone') return;
    const cl = this.clampIn(x, z, size / 2);
    if (!cl) return;
    [x, z] = cl; size = Math.min(size, cl[2] * 2);
    const i = this.splat(x, z, 0.1, kind, 0.95);
    if (i != null) this.pools.push({ i, x, z, t: 0, to: size, rot: rnd() * 6.28 });
  }
  droplet(p, v, size, color) {
    if (this.drops.length >= this.MAXP) this.drops.shift();
    this.drops.push({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, s: size, c: color, t: 0 });
  }
  // blood spurt when something is hit. amount 0..1 is how big the hit was, from is where it came from.
  hit(pos, kind, amount = 0.3, from = null) {
    const L = this.level;
    if (!L || !kind || kind === 'none') return;
    const n = Math.ceil((4 + amount * 22) * L);
    const dir = from ? new THREE.Vector3(pos.x - from.x, 0, pos.z - from.z).normalize() : null;
    const bone = kind === 'bone';
    if (rnd() < 0.5) sfx(bone ? 'bonecrack' : 'squelch');
    for (let i = 0; i < n; i++) {
      const a = dir ? Math.atan2(dir.z, dir.x) + R(-0.9, 0.9) : rnd() * 6.28;
      const sp = R(1.5, 3 + amount * 6);
      const v = new THREE.Vector3(Math.cos(a) * sp, R(1.5, 4 + amount * 4), Math.sin(a) * sp);
      if (bone) this.shard(pos.clone().setY(pos.y + 0.9), v, R(0.04, 0.1));
      else this.droplet(pos.clone().setY(pos.y + R(0.7, 1.4)), v, R(0.025, 0.07 + amount * 0.04), this.pick(kind));
    }
    if (!bone && rnd() < 0.5 + amount) {
      const a = dir ? Math.atan2(dir.z, dir.x) + R(-0.5, 0.5) : rnd() * 6.28, d = R(0.5, 1.6);
      this.splat(pos.x + Math.cos(a) * d, pos.z + Math.sin(a) * d, R(0.7, 1.3) * (0.7 + amount), kind, 0.85);
    }
  }
  shard(p, v, size) {
    this.addGib({ bone: true, p, v, s: size * R(1.5, 3), col: BONE[(rnd() * BONE.length) | 0], long: R(1.5, 4) });
  }
  addGib(g) {
    // every chunk keeps its own instance slot and stays on the floor for the rest of the level
    const mesh = g.bone ? this.boneMesh : this.fleshMesh;
    mesh.userData.next = mesh.userData.next || 0;
    g.slot = mesh.userData.next; mesh.userData.next = (mesh.userData.next + 1) % this.MAXG;
    mesh.count = Math.min(this.MAXG, Math.max(mesh.count, g.slot + 1));
    const old = this.gibs.findIndex((o) => o.bone === g.bone && o.slot === g.slot); if (old >= 0) this.gibs.splice(old, 1);
    g.t = 0; g.rot = new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6); g.ang = new THREE.Vector3(R(-12, 12), R(-12, 12), R(-12, 12)); g.bounces = 0; g.rest = false;
    this.gibs.push(g);
  }
  // a creature dies. size scales the spray, big = overkill: the body bursts into pieces.
  death(pos, kind, size = 1, big = false, from = null) {
    const L = this.level;
    if (!L || !kind || kind === 'none') return;
    const bone = kind === 'bone';
    const n = Math.ceil((14 + size * 14) * L * (big ? 2 : 1));
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, sp = R(2, 5 + size * 3 + (big ? 4 : 0));
      const v = new THREE.Vector3(Math.cos(a) * sp, R(2, 6 + size * 2 + (big ? 3 : 0)), Math.sin(a) * sp);
      if (bone) this.shard(pos.clone().setY(R(0.5, 1.4)), v, R(0.05, 0.12));
      else this.droplet(pos.clone().setY(R(0.5, 1.5)), v, R(0.03, 0.09), this.pick(kind));
    }
    for (let i = 0; i < Math.ceil((3 + size * 3) * L); i++) {
      const a = rnd() * 6.28, d = R(0.2, 1.8 + size);
      this.splat(pos.x + Math.cos(a) * d, pos.z + Math.sin(a) * d, R(0.9, 1.8) * size, kind, 0.9);
    }
    this.pool(pos.x, pos.z, R(1.6, 2.4) * size, kind);
    if (L >= 1) {
      // chunks: heads, limbs and gore
      const chunks = Math.ceil((big ? 11 : 4) + size * (big ? 6 : 2));
      for (let i = 0; i < chunks; i++) {
        const a = rnd() * 6.28, sp = R(2.5, 6 + (big ? 5 : 0));
        const v = new THREE.Vector3(Math.cos(a) * sp, R(3, 8 + (big ? 3 : 0)), Math.sin(a) * sp);
        if (from && rnd() < 0.5) { const d = new THREE.Vector3(pos.x - from.x, 0, pos.z - from.z).normalize(); v.x += d.x * 3; v.z += d.z * 3; }
        const p = pos.clone().setY(R(0.5, 1.6));
        if (bone) this.addGib({ bone: true, p, v, s: R(0.07, 0.14) * size, col: BONE[(rnd() * BONE.length) | 0], long: R(3, 7) });
        else this.addGib({ bone: false, p, v, s: R(0.1, 0.24) * size, col: FLESH[(rnd() * FLESH.length) | 0], blood: this.pick(kind), trail: true });
        if (!bone && rnd() < 0.35) this.addGib({ bone: true, p: p.clone(), v: v.clone().multiplyScalar(0.8), s: R(0.05, 0.09) * size, col: BONE[(rnd() * BONE.length) | 0], long: R(3, 6) });
      }
    }
  }

  // ---------------------------------------------------------------- dismemberment
  // Cut a limb or the head off a realistic character: the bone is collapsed so the body shows a stump,
  // a matching severed part flies off, the stump pumps arterial spray, and guts can spill out.
  mats() {
    if (this._mats) return this._mats;
    const P = (o) => new THREE.MeshPhysicalMaterial(o);
    this._mats = {
      meat: P({ color: 0x7a0c0c, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xff4040) }),
      fat: P({ color: 0xd8b48a, roughness: 0.4, clearcoat: 0.5 }),
      bone: new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.55 }),
      marrow: new THREE.MeshStandardMaterial({ color: 0x8a1a14, roughness: 0.4 }),
      gut: P({ color: 0xc46a6a, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: new THREE.Color(0xffa0a0) }),
      gutDark: P({ color: 0x7a2a3a, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2 }),
      liver: P({ color: 0x4a0e10, roughness: 0.2, clearcoat: 1 }),
      brain: P({ color: 0xd9a3a0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 0.7, sheenColor: new THREE.Color(0xffc0c0), vertexColors: true }),
      hair: new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.9 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.2 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x3e382e, roughness: 0.95 }),
    };
    return this._mats;
  }
  skinMat(hex) {
    this._skins = this._skins || {};
    return this._skins[hex] || (this._skins[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.62 }));
  }
  // a wet stump face: torn meat ring, fat layer and a bone with marrow
  stumpCap(r, M) {
    const g = new THREE.Group();
    const meat = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, r * 0.18, 12), M.meat); g.add(meat);
    const fat = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.09, 5, 14), M.fat); fat.rotation.x = Math.PI / 2; fat.position.y = r * 0.08; g.add(fat);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + rnd(); const shred = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * R(0.3, 0.7), 4), M.meat); shred.position.set(Math.cos(a) * r * 0.8, r * 0.18, Math.sin(a) * r * 0.8); shred.rotation.set(R(-0.6, 0.6), 0, R(-0.6, 0.6)); g.add(shred); }
    const bn = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.34, r * 0.7, 8), M.bone); bn.position.y = r * 0.3; g.add(bn);
    const mar = new THREE.Mesh(new THREE.CircleGeometry(r * 0.17, 8), M.marrow); mar.rotation.x = -Math.PI / 2; mar.position.y = r * 0.66; g.add(mar);
    return g;
  }
  // procedural skin: pores, fine creases, veins and bruising; used as both colour detail and bump
  skinTex() {
    if (this._skinTex) return this._skinTex;
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    const id = g.getImageData(0, 0, S, S), d = id.data;
    for (let i = 0; i < S * S; i++) { const n = 225 + (rnd() - 0.5) * 34; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = n; }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,60,60,${R(0.08, 0.25)})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, R(0.4, 1.3), 0, 6.28); g.fill(); }
    g.strokeStyle = 'rgba(70,80,140,0.22)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += R(-14, 14); y += R(6, 18); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 5; i++) { const x = rnd() * S, y = rnd() * S, r = R(12, 30), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(90,40,90,0.35)'); gr.addColorStop(1, 'rgba(90,40,90,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(60,40,40,0.18)'; g.lineWidth = 0.8;
    for (let i = 0; i < 60; i++) { const x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-8, 8), y + R(-2, 2)); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(2, 2);
    return (this._skinTex = tex);
  }
  partSkin(hex) {
    this._pskins = this._pskins || {};
    if (this._pskins[hex]) return this._pskins[hex];
    const tx = this.skinTex();
    return (this._pskins[hex] = new THREE.MeshPhysicalMaterial({ color: hex, map: tx, bumpMap: tx, bumpScale: 0.6, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0xff6a5a), sheenRoughness: 0.6, vertexColors: true, clearcoat: 0.15, clearcoatRoughness: 0.6 }));
  }
  // blood smear: vertex colours go from skin (white) to wet blood near the cut, with drip streaks running away from it
  bloodify(geo, cutY, dirSign, len, skin) {
    const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
    const sk = new THREE.Color(skin), bl = new THREE.Color(0x5a0606);
    const rr = Math.min(1, bl.r / Math.max(0.05, sk.r)), gg = Math.min(1, bl.g / Math.max(0.05, sk.g)), bb = Math.min(1, bl.b / Math.max(0.05, sk.b));
    const seed = rnd() * 100;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = Math.abs(y - cutY) / len, ang = Math.atan2(z, x);
      const streak = Math.max(0, Math.sin(ang * 5 + seed) * Math.sin(ang * 3.1 + seed * 2)) * 0.35;
      const f = Math.min(1, Math.max(0, 1 - (d - streak) / (0.12 + streak * 0.6)) + (rnd() < 0.04 ? 0.6 : 0));
      col[i * 3] = 1 + (rr - 1) * f; col[i * 3 + 1] = 1 + (gg - 1) * f; col[i * 3 + 2] = 1 + (bb - 1) * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  // anatomical limb: a lathe through a radius profile (shoulder, bicep, elbow, forearm, wrist...),
  // slightly flattened, with a ragged torn edge at the cut
  latheLimb(profile, len, flat = 0.86) {
    const pts = profile.map(([t, r]) => new THREE.Vector2(r, -t * len));
    const geo = new THREE.LatheGeometry(pts, 22);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
      let k = 1;
      if (y > -len * 0.035) k += (rnd() - 0.3) * 0.28; // torn skin at the cut
      p.setXYZ(i, x * k, y + (y > -len * 0.02 ? (rnd() - 0.5) * len * 0.03 : 0), z * k * flat);
    }
    geo.computeVertexNormals();
    return geo;
  }
  hand(S, r, g, y) {
    const palm = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 12, 10), S); palm.scale.set(1.05, 1.6, 0.5); palm.position.y = y - r * 1.4; g.add(palm);
    for (let i = 0; i < 4; i++) {
      const fx = (i - 1.5) * r * 0.5, base = y - r * 2.9, curl = R(0.4, 1.2);
      const f1 = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.19, r * 0.75, 3, 8), S); f1.position.set(fx, base, r * 0.1); f1.rotation.x = curl * 0.6; g.add(f1);
      const f2 = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.17, r * 0.6, 3, 8), S); f2.position.set(fx, base - r * 0.7, r * 0.1 + Math.sin(curl) * r * 0.55); f2.rotation.x = curl * 1.5; g.add(f2);
    }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.22, r * 0.8, 3, 8), S); th.position.set(r * 1.0, y - r * 1.9, r * 0.35); th.rotation.set(0.6, 0, 0.7); g.add(th);
  }
  severedPart(kind, s, skin, hair) {
    const M = this.mats(), S = this.partSkin(skin), g = new THREE.Group();
    const limb = (profile, len, r0, end) => {
      const geo = this.latheLimb(profile, len);
      this.bloodify(geo, 0, 1, len, skin);
      g.add(new THREE.Mesh(geo, S));
      g.add(this.stumpCap(r0 * 0.95, M));
      if (end === 'hand') this.hand(S, profile[profile.length - 1][1] * 1.05, g, -len);
      if (end === 'foot') {
        const r = profile[profile.length - 1][1];
        const boot = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.95, r * 2.6, 4, 10), M.cloth); boot.rotation.x = Math.PI / 2; boot.position.set(0, -len - r * 0.6, r * 1.2); g.add(boot);
        const sole = new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, r * 0.35, r * 4.4), M.hair); sole.position.set(0, -len - r * 1.45, r * 1.2); g.add(sole);
      }
      g.userData.len = len;
    };
    if (kind === 'head') {
      const r = 0.105;
      const hg = new THREE.SphereGeometry(r, 28, 22);
      { // skull shape: longer back, narrower jaw, cheekbones
        const p = hg.attributes.position;
        for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const low = Math.max(0, -y / r); x *= 0.88 - low * 0.18; z *= 1.05 + (z < 0 ? 0.06 : 0) - low * 0.1; y *= 1.12; if (z > r * 0.6 && Math.abs(y) < r * 0.2) z += r * 0.04; p.setXYZ(i, x, y, z); }
        hg.computeVertexNormals();
      }
      this.bloodify(hg, -r * 1.1, 1, r * 3, skin);
      const hd = new THREE.Mesh(hg, S); hd.position.y = r * 1.25; g.add(hd);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(r * 0.14, r * 0.4, 8), S); nose.rotation.x = Math.PI / 2 - 0.25; nose.position.set(0, r * 1.18, r * 1.0); g.add(nose);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.09, r * 0.8, 3, 8), S); brow.rotation.z = Math.PI / 2; brow.position.set(0, r * 1.5, r * 0.84); g.add(brow);
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 10, 8), S); ear.scale.set(0.35, 1, 0.7); ear.position.set(sx * r * 0.9, r * 1.25, 0); g.add(ear);
        const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), M.eye); e.position.set(sx * r * 0.36, r * 1.33, r * 0.82); g.add(e);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.065, 8, 6), M.hair); iris.position.set(sx * r * 0.36 + (rnd() - 0.5) * r * 0.05, r * 1.3, r * 0.93); g.add(iris);
        const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 0.145, 10, 6, 0, 6.28, 0, 1.3), S); lid.position.copy(e.position); lid.rotation.x = R(0.2, 0.9); g.add(lid);
      }
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 6), M.marrow); mouth.scale.set(1.3, R(0.25, 0.7), 0.4); mouth.position.set(0, r * 0.8, r * 0.88); g.add(mouth);
      if (hair) { const hr = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 18, 10, 0, 6.28, 0, 1.45), M.hair); hr.scale.set(0.9, 1.12, 1.1); hr.position.y = r * 1.3; hr.rotation.x = -0.3; g.add(hr); }
      const ng = this.latheLimb([[0, 0.5 * r], [0.5, 0.48 * r], [1, 0.55 * r]], r * 0.7);
      this.bloodify(ng, -r * 0.7, 1, r * 0.7, skin);
      const neck = new THREE.Mesh(ng, S); neck.rotation.x = Math.PI; neck.position.y = -r * 0.25; g.add(neck);
      const cap = this.stumpCap(r * 0.5, M); cap.rotation.x = Math.PI; cap.position.y = -r * 0.25; g.add(cap);
      const pipe = new THREE.Mesh(new THREE.TorusGeometry(r * 0.12, r * 0.045, 6, 12), M.gutDark); pipe.rotation.x = Math.PI / 2; pipe.position.set(0, -r * 0.33, r * 0.2); g.add(pipe);
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.11, r * 0.12, r * 0.35, 8), M.bone); spine.position.set(0, -r * 0.4, -r * 0.18); g.add(spine);
      if (rnd() < 0.5) { // cracked skull, brain bulging through
        const br = new THREE.Mesh(this.brainGeo(r * 0.55), M.brain); br.position.set(R(-0.3, 0.3) * r, r * 2.05, -r * 0.2); g.add(br);
        for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 6, 4, 0, 1.6, 0, 1), M.bone); f.material.side = THREE.DoubleSide; f.position.set(R(-0.6, 0.6) * r, r * 2.0, R(-0.5, 0.3) * r); f.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.add(f); }
      }
      g.userData.len = r * 2.4; g.userData.round = true;
    } else if (kind === 'arm') limb([[0, 0.058], [0.08, 0.06], [0.25, 0.054], [0.4, 0.047], [0.5, 0.041], [0.62, 0.045], [0.82, 0.036], [1, 0.029]], 0.56, 0.058, 'hand');
    else if (kind === 'forearm') limb([[0, 0.044], [0.25, 0.046], [0.6, 0.037], [1, 0.029]], 0.27, 0.044, 'hand');
    else if (kind === 'thigh') limb([[0, 0.088], [0.12, 0.09], [0.35, 0.078], [0.52, 0.058], [0.6, 0.055], [0.72, 0.06], [0.9, 0.043], [1, 0.038]], 0.84, 0.088, 'foot');
    else if (kind === 'shin') limb([[0, 0.058], [0.2, 0.062], [0.65, 0.045], [1, 0.038]], 0.44, 0.058, 'foot');
    g.scale.setScalar(s);
    // the skin material uses vertex colours (blood smears); parts without them would render black
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material.vertexColors && !o.geometry.attributes.color) o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3).fill(1), 3)); } });
    return g;
  }

  // brain tissue: folded (gyri and sulci) by displacing a sphere, with dark blood in the grooves
  brainGeo(r) {
    const g = new THREE.SphereGeometry(r, 26, 20), p = g.attributes.position, col = new Float32Array(p.count * 3);
    const s = rnd() * 10, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const f = Math.sin(v.x * 17 + s) * Math.sin(v.y * 19 + s * 1.3) + Math.sin(v.z * 21 + v.x * 9 + s * 0.7) * 0.8;
      const fold = Math.abs(f) < 0.35 ? -0.09 : 0.03 * f;
      const mid = Math.abs(v.x) < 0.06 ? -0.12 : 0; // the split between hemispheres
      const k = 1 + fold + mid;
      p.setXYZ(i, v.x * r * k * 0.86, v.y * r * k * 0.72, v.z * r * k * 1.05);
      const dark = fold < 0 || mid < 0 ? 0.55 : 1;
      col[i * 3] = dark; col[i * 3 + 1] = dark * (fold < 0 ? 0.6 : 1); col[i * 3 + 2] = dark * (fold < 0 ? 0.6 : 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  // a skull bursts: brain chunks, skull fragments and grey-pink spatter
  brains(pos, from, size = 1) {
    if (this.level < 1) return;
    const M = this.mats();
    const dir = from ? new THREE.Vector3(pos.x - from.x, 0, pos.z - from.z).normalize() : new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
    const n = this.mobile ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(this.brainGeo(R(0.03, 0.06) * size), M.brain); b.castShadow = true;
      const v = new THREE.Vector3(dir.x * R(1, 4) + R(-1.5, 1.5), R(2.5, 5.5), dir.z * R(1, 4) + R(-1.5, 1.5));
      this.addPart(b, pos.clone(), v, Infinity);
    }
    for (let i = 0; i < 6; i++) {
      const sk = new THREE.Mesh(new THREE.SphereGeometry(R(0.03, 0.05) * size, 6, 4, 0, R(1, 2.2), 0, R(0.8, 1.4)), M.bone);
      sk.material.side = THREE.DoubleSide;
      this.addPart(sk, pos.clone(), new THREE.Vector3(dir.x * R(1, 5) + R(-2, 2), R(2, 6), dir.z * R(1, 5) + R(-2, 2)), Infinity);
    }
    for (let i = 0; i < 4; i++) { const a = Math.atan2(dir.z, dir.x) + R(-0.7, 0.7), d = R(0.4, 1.8); this.splat(pos.x + Math.cos(a) * d, pos.z + Math.sin(a) * d, R(0.4, 0.9), 0x9a6a68, 0.85); }
    this.hit(pos.clone().setY(pos.y - 1), 'red', 1, from);
  }
  // flying parts are full meshes (few at a time), simulated like gibs
  addPart(obj, p, v, life = 30) {
    this.parts = this.parts || [];
    const MAX = this.mobile ? 260 : 900;
    if (this.parts.length >= MAX) { const o = this.parts.shift(); o.obj.parent?.remove(o.obj); }
    obj.position.copy(p);
    this.scene.add(obj);
    this.parts.push({ obj, v, ang: new THREE.Vector3(R(-9, 9), R(-6, 6), R(-9, 9)), t: 0, life, rest: false, bounces: 0, trail: true });
  }
  // pumping arterial spray from a point that follows a bone
  spurt(bone, dir, dur = 2.6, kind = 'red', strength = 1) {
    this.spurts = this.spurts || [];
    if (this.spurts.length > 10) this.spurts.shift();
    this.spurts.push({ bone, dir: dir.clone(), t: 0, dur, kind, strength });
  }
  // a tangle of intestines spilling out of a body onto the floor
  entrails(pos, dir, size = 1) {
    if (this.level < 1) return;
    const M = this.mats();
    const loops = this.mobile ? 2 : 3 + ((rnd() * 2) | 0);
    for (let k = 0; k < loops; k++) {
      const pts = []; let x = 0, z = 0; const a0 = Math.atan2(dir.z, dir.x) + R(-0.9, 0.9);
      const n = 9 + ((rnd() * 5) | 0);
      for (let i = 0; i < n; i++) { const a = a0 + Math.sin(i * 1.3 + k) * 1.4; x += Math.cos(a) * 0.17 * size; z += Math.sin(a) * 0.17 * size; pts.push(new THREE.Vector3(x, 0.05 + (i < 2 ? 0.35 - i * 0.15 : rnd() * 0.04) * size, z)); }
      // the guts slump against a wall rather than through it
      for (const q of pts) { const cl = this.clampIn(pos.x + q.x, pos.z + q.z, 0); if (cl) { q.x = cl[0] - pos.x; q.z = cl[1] - pos.z; } }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 6, R(0.035, 0.05) * size, 8, false);
      const m = new THREE.Mesh(geo, rnd() < 0.7 ? M.gut : M.gutDark); m.castShadow = true;
      m.position.set(pos.x, 0, pos.z);
      this.addStatic(m);
      this.splat(pos.x + x * 0.6, pos.z + z * 0.6, R(1, 1.6) * size, 'red', 0.92);
    }
    this.organs(pos, dir, size, 3);
  }
  track(obj) { (this.tracked = this.tracked || []).push(obj); }

  // anatomical organs, each its own wet model
  organGeo(kind, s) {
    const lumpy = (g, amt, sx = 1, sy = 1, sz = 1) => { const p = g.attributes.position, v = new THREE.Vector3(); const k0 = rnd() * 9; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + Math.sin(v.x * 23 + k0) * Math.sin(v.y * 19) * amt + Math.sin(v.z * 31 + k0) * amt * 0.5; p.setXYZ(i, v.x * k * sx, v.y * k * sy, v.z * k * sz); } g.computeVertexNormals(); return g; };
    if (kind === 'heart') { const g = lumpy(new THREE.SphereGeometry(s, 18, 14), 0.05, 0.85, 1.1, 0.8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) { const k = 1 + y / s * 0.55; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } g.computeVertexNormals(); return g; }
    if (kind === 'lung') return lumpy(new THREE.SphereGeometry(s, 18, 14), 0.08, 0.6, 1.25, 0.75);
    if (kind === 'kidney') { const g = new THREE.TorusGeometry(s * 0.7, s * 0.5, 10, 14, Math.PI * 1.3); return lumpy(g, 0.03); }
    if (kind === 'stomach') { const g = new THREE.TorusGeometry(s, s * 0.6, 12, 16, Math.PI * 1.1); return lumpy(g, 0.06, 1, 1, 0.8); }
    if (kind === 'liver') return lumpy(new THREE.SphereGeometry(s, 18, 12), 0.04, 1.5, 0.55, 1);
    return lumpy(new THREE.SphereGeometry(s, 12, 10), 0.12);
  }
  ribcage(size, M) {
    const g = new THREE.Group();
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * size, 0.03 * size, 0.42 * size, 8), M.bone); g.add(spine);
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
      if (rnd() < 0.25) continue; // some ribs snapped off
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.12 * size * (1 - i * 0.05), 0.009 * size, 5, 12, Math.PI * R(0.55, 0.95)), M.bone);
      rib.position.y = 0.16 * size - i * 0.06 * size; rib.rotation.set(Math.PI / 2 + 0.2, 0, sx > 0 ? -0.2 : Math.PI + 0.2); g.add(rib);
    }
    const meat = new THREE.Mesh(this.organGeo('chunk', 0.07 * size), M.meat); meat.position.set(0.04 * size, -0.05 * size, 0.05 * size); g.add(meat);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  organs(pos, dir, size = 1, n = 4) {
    if (this.level < 1) return;
    const M = this.mats();
    const list = [['heart', 0.06, M.meat], ['lung', 0.09, M.gut], ['lung', 0.09, M.gut], ['liver', 0.09, M.liver], ['kidney', 0.035, M.liver], ['kidney', 0.035, M.liver], ['stomach', 0.06, M.gutDark], ['chunk', 0.06, M.meat], ['chunk', 0.05, M.fat]];
    for (let i = 0; i < n; i++) {
      const [k, s, mat] = list[(rnd() * list.length) | 0];
      const o = new THREE.Mesh(this.organGeo(k, s * size), mat); o.castShadow = true;
      const a = Math.atan2(dir.z, dir.x) + R(-1.4, 1.4), sp = R(1.5, 5);
      this.addPart(o, new THREE.Vector3(pos.x, R(0.6, 1.2) * size, pos.z), new THREE.Vector3(Math.cos(a) * sp, R(2, 5), Math.sin(a) * sp), Infinity);
    }
  }
  // a full mess for an overkill: ribs, spine, organs, guts
  carnage(pos, dir, size = 1) {
    if (this.level < 1) return;
    const M = this.mats();
    const rc = this.ribcage(size, M);
    this.addPart(rc, new THREE.Vector3(pos.x, 1.0 * size, pos.z), new THREE.Vector3(dir.x * R(1, 3), R(3, 5), dir.z * R(1, 3)), Infinity);
    this.organs(pos, dir, size, this.mobile ? 4 : 7);
    this.entrails(pos, dir, size);
    for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = R(0.5, 2.5) * size; this.splat(pos.x + Math.cos(a) * d, pos.z + Math.sin(a) * d, R(1, 2.2) * size, 'red', 0.92); }
    this.pool(pos.x, pos.z, R(2.5, 3.5) * size, 'red');
  }
  addStatic(m) {
    this.statics = this.statics || [];
    
    this.scene.add(m); this.statics.push({ m, t: 0 });
  }
  // cut parts off a RealChar. `cuts` is how many; `from` is where the blow came from.
  dismember(rc, pos, kind, size = 1, cuts = 1, from = null, skin = 0xc89a7a, hair = true) {
    if (!this.level || !rc || !rc.bones || kind === 'none') return [];
    const PARTS = [
      ['Head', 'head', 'Neck'], ['LeftArm', 'arm'], ['RightArm', 'arm'], ['LeftForeArm', 'forearm'], ['RightForeArm', 'forearm'],
      ['LeftUpLeg', 'thigh'], ['RightUpLeg', 'thigh'], ['LeftLeg', 'shin'], ['RightLeg', 'shin'],
    ].filter(([b]) => rc.bones[b]);
    const done = [];
    const dir = from ? new THREE.Vector3(pos.x - from.x, 0, pos.z - from.z).normalize() : new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
    const blood = kind === 'bone' ? 'rot' : kind;
    rc.severed = rc.severed || new Set();
    rc.root.updateMatrixWorld(true);
    const wp = (n) => rc.bones[n].getWorldPosition(new THREE.Vector3());
    // real-world size of this body: an adult upper arm is about 0.28 m
    const unit = rc.bones.LeftArm && rc.bones.LeftForeArm ? Math.min(3, Math.max(0.5, wp('LeftArm').distanceTo(wp('LeftForeArm')) / 0.28)) : Math.max(0.6, rc.root.scale.x);
    for (let k = 0; k < cuts && PARTS.length; k++) {
      // the head comes off more often than anything else
      const idx = rnd() < 0.4 && PARTS[0][0] === 'Head' ? 0 : (rnd() * PARTS.length) | 0;
      const [bn, type] = PARTS.splice(idx, 1)[0];
      // never cut a forearm off an arm that is already gone (and vice versa)
      if ([...rc.severed].some((s) => s.replace('Fore', '').replace('Up', '') === bn.replace('Fore', '').replace('Up', ''))) continue;
      const bone = rc.bones[bn];
      rc.root.updateMatrixWorld(true);
      const p = bone.getWorldPosition(new THREE.Vector3());
      const q = bone.getWorldQuaternion(new THREE.Quaternion());
      rc.severed.add(bn);
      if (type === 'head' && this.level >= 1 && rnd() < 0.35) {
        // the head pops: brains everywhere
        rc.severed.add(bn);
        this.brains(p, from, unit);
        this.spurt(rc.bones.Neck || bone.parent, new THREE.Vector3(0, 1, 0), 3.4, blood, 1.5);
        done.push(bn);
        continue;
      }
      const part = this.severedPart(type, unit, skin, hair && type === 'head');
      part.quaternion.copy(q);
      if (type !== 'head') part.rotateX(Math.PI); // the limb hangs down from its cut
      const v = new THREE.Vector3(dir.x * R(2, 5) + R(-1.5, 1.5), R(3, 6.5), dir.z * R(2, 5) + R(-1.5, 1.5));
      this.addPart(part, p, v, Infinity);
      const stumpBone = type === 'head' ? rc.bones.Neck || rc.bones.Spine2 || bone.parent : bone.parent;
      this.spurt(stumpBone, type === 'head' ? new THREE.Vector3(0, 1, 0) : dir.clone().setY(0.6), type === 'head' ? 3.4 : 2.4, blood, type === 'head' || type === 'thigh' ? 1.4 : 1);
      this.hit(p, blood, 0.9, from);
      done.push(bn);
    }
    if (done.length) sfx('bonecrack');
    return done;
  }
  clear() {
    this.drops.length = 0; this.gibs.length = 0; this.pools.length = 0; this.dinfo.length = 0; this.dnext = 0;
    this.decals.count = 0; this.dropMesh.count = 0; this.fleshMesh.count = 0; this.boneMesh.count = 0;
    this.fleshMesh.userData.next = 0; this.boneMesh.userData.next = 0;
    for (const o of this.parts || []) o.obj.parent?.remove(o.obj);
    for (const o of this.statics || []) o.m.parent?.remove(o.m);
    for (const o of this.settled || []) o.parent?.remove(o);
    this.parts = []; this.statics = []; this.spurts = []; this.settled = []; this.tracked = [];
  }
  update(dt) {
    const m = this._m, q = this._q, e = this._e, s = this._s, p = this._p, c = this._c;
    // droplets
    const D = this.drops;
    let n = 0;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i];
      d.t += dt;
      d.vy -= 15 * dt;
      const ox = d.x, oz = d.z;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const wh = this.wallHit(ox, oz, d.x, d.z);
      if (wh) { this.hitWall(wh, d.x, d.y, d.z, d.s * R(9, 18), d.c); D[i] = D[D.length - 1]; D.pop(); continue; }
      if (d.y <= 0.05 || d.t > 3) {
        if (d.y <= 0.05 && rnd() < 0.55) this.splat(d.x, d.z, d.s * R(9, 20), d.c, 0.85);
        D[i] = D[D.length - 1]; D.pop();
      }
    }
    for (const d of D) {
      p.set(d.x, d.y, d.z);
      const stretch = 1 + Math.min(3, Math.hypot(d.vx, d.vy, d.vz) * 0.1);
      s.set(d.s, d.s * stretch, d.s);
      e.set(0, 0, 0); q.setFromEuler(e);
      m.compose(p, q, s);
      this.dropMesh.setMatrixAt(n, m);
      c.setHex(d.c); this.dropMesh.setColorAt(n, c);
      n++;
    }
    this.dropMesh.count = n;
    if (n) { this.dropMesh.instanceMatrix.needsUpdate = true; this.dropMesh.instanceColor.needsUpdate = true; }
    // gibs: only moving chunks are simulated; resting ones are written once and left alone
    let dirtyF = false, dirtyB = false;
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i];
      g.t += dt;
      g.v.y -= 16 * dt;
      const gox = g.p.x, goz = g.p.z;
      g.p.addScaledVector(g.v, dt);
      const gw = this.wallHit(gox, goz, g.p.x, g.p.z);
      if (gw) this.bounceWall(gw, g.p, g.v, g.s, g.bone ? null : g.blood || 'red');
      g.rot.addScaledVector(g.ang, dt);
      if (g.trail && rnd() < dt * 22) this.droplet(g.p, new THREE.Vector3(R(-0.5, 0.5), 0.5, R(-0.5, 0.5)), R(0.02, 0.045), g.blood);
      if (g.p.y <= g.s * 0.6) {
        g.p.y = g.s * 0.6;
        if (g.bounces < 3 && Math.abs(g.v.y) > 1.2) {
          g.v.y *= -0.38; g.v.x *= 0.6; g.v.z *= 0.6; g.ang.multiplyScalar(0.5); g.bounces++;
          if (!g.bone) this.splat(g.p.x, g.p.z, R(0.5, 1.1), g.blood || 'red', 0.85);
        } else { g.rest = true; if (g.bone) g.rot.x = Math.PI / 2; if (!g.bone) this.splat(g.p.x, g.p.z, R(0.3, 0.6), g.blood || 'red', 0.9); }
      }
      e.set(g.rot.x, g.rot.y, g.rot.z); q.setFromEuler(e);
      if (g.bone) s.set(g.s, g.s * (g.long || 3), g.s); else s.set(g.s * 1.3, g.s * 0.8, g.s);
      m.compose(g.p, q, s); c.setHex(g.col);
      const mesh = g.bone ? this.boneMesh : this.fleshMesh;
      mesh.setMatrixAt(g.slot, m); mesh.setColorAt(g.slot, c);
      if (g.bone) dirtyB = true; else dirtyF = true;
      if (g.rest) this.gibs.splice(i, 1); // settled for good
    }
    for (const [mesh, k] of [[this.boneMesh, dirtyB], [this.fleshMesh, dirtyF]]) if (k) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    // severed parts tumbling and coming to rest
    for (let i = (this.parts || []).length - 1; i >= 0; i--) {
      const P = this.parts[i], o = P.obj;
      P.t += dt;
      if (!P.rest) {
        P.v.y -= 16 * dt;
        const pox = o.position.x, poz = o.position.z;
        o.position.addScaledVector(P.v, dt);
        const pw = this.wallHit(pox, poz, o.position.x, o.position.z);
        if (pw) this.bounceWall(pw, o.position, P.v, 0.12 * o.scale.x, 'red');
        o.rotation.x += P.ang.x * dt; o.rotation.y += P.ang.y * dt; o.rotation.z += P.ang.z * dt;
        if (P.trail && rnd() < dt * 30) this.droplet(o.position, new THREE.Vector3(R(-0.6, 0.6), R(0.2, 1), R(-0.6, 0.6)), R(0.02, 0.05), this.pick('red'));
        const floor = 0.06 * o.scale.x;
        if (o.position.y <= floor) {
          o.position.y = floor;
          if (P.bounces < 2 && Math.abs(P.v.y) > 1.5) { P.v.y *= -0.3; P.v.x *= 0.5; P.v.z *= 0.5; P.ang.multiplyScalar(0.4); P.bounces++; this.splat(o.position.x, o.position.z, R(0.6, 1.1), 'red', 0.9); }
          else {
            P.rest = true;
            // lie down along the floor
            const yaw = rnd() * 6.28; o.rotation.set(Math.PI / 2, 0, yaw); o.position.y = 0.05 * o.scale.x;
            this.pool(o.position.x, o.position.z, R(0.7, 1.2), 'red');
          }
        }
      }
      if (P.rest) { o.updateMatrix(); const f = flattenGroup(o); f.matrixAutoUpdate = false; f.updateMatrix(); this.settled = this.settled || []; this.settled.push(f); this.parts.splice(i, 1); }
    }
    for (let i = (this.statics || []).length - 1; i >= 0; i--) { const S = this.statics[i]; S.t += dt;  }
    // arterial spray: pulses with the heartbeat, weakening as it bleeds out
    for (let i = (this.spurts || []).length - 1; i >= 0; i--) {
      const S = this.spurts[i];
      S.t += dt;
      if (S.t > S.dur || !S.bone || !S.bone.parent) { this.spurts.splice(i, 1); continue; }
      const beat = Math.max(0, Math.sin(S.t * 9)) * (1 - S.t / S.dur);
      if (beat < 0.2) continue;
      const at = S.bone.getWorldPosition(this._p.clone());
      const k = Math.ceil(3 * beat * S.strength * (this.mobile ? 0.5 : 1));
      for (let j = 0; j < k; j++) this.droplet(at, new THREE.Vector3(S.dir.x * R(1, 3) + R(-0.4, 0.4), R(1.5, 3.5) * beat * S.strength + S.dir.y, S.dir.z * R(1, 3) + R(-0.4, 0.4)), R(0.02, 0.05), this.pick(S.kind));
    }
    // nothing is ever removed, but far-away remains are hidden so a floor full of bodies stays smooth
    this._cullT = (this._cullT || 0) - dt;
    if (this._cullT <= 0 && this.focus) {
      this._cullT = 0.4;
      const f = this.focus, R2 = (this.mobile ? 24 : 34) ** 2;
      const vis = (o, x, z) => { const v = (x - f.x) ** 2 + (z - f.z) ** 2 < R2; if (o.visible !== v) o.visible = v; };
      for (const o of this.settled || []) vis(o, o.position.x, o.position.z);
      for (const S of this.statics || []) vis(S.m, S.m.position.x, S.m.position.z);
      for (const o of this.tracked || []) { if (!o.parent) continue; o.getWorldPosition(this._p); vis(o, this._p.x, this._p.z); }
    }
    // spreading pools
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const P = this.pools[i];
      P.t += dt;
      const k = Math.min(1, P.t / 4), sz = Math.max(0.1, P.to * (1 - Math.pow(1 - k, 2)));
      e.set(0, P.rot, 0); q.setFromEuler(e); s.set(sz, 1, sz); p.set(P.x, 0.052, P.z);
      m.compose(p, q, s);
      this.decals.setMatrixAt(P.i, m);
      this.decals.instanceMatrix.needsUpdate = true;
      if (k >= 1) this.pools.splice(i, 1);
    }
    // old decals slowly dry and fade
    this._fade = (this._fade || 0) + dt;
    if (this._fade > 2) {
      this._fade = 0;
      for (let i = 0; i < this.decals.count; i++) {
        const di = this.dinfo[i]; if (!di) continue;
        di.t += 2;
        if (di.t > 120) { const a = this.dalpha.getX(i); if (a > 0.7) { this.dalpha.setX(i, a - 0.01); this.dalpha.needsUpdate = true; } } // dries darker, never goes
      }
    }
  }
}

// which kind of blood or gore each creature leaves
export function goreKind(data) {
  if (!data) return 'red';
  const sh = data.shape || '';
  if (sh.startsWith('skel')) return /Venom|Verd/.test(data.name || '') ? 'ichor' : 'rot';
  if (sh === 'wisp') return 'none';
  if (sh === 'blob') return /Horror|Void/.test(data.name || '') ? 'void' : 'slime';
  if (/Abyssal|Void|Hollow/.test(data.name || '')) return 'dark';
  return 'red';
}
