// Blood and gore: spurting droplets, ground splatters and growing pools, flying gibs and bone shards.
// Everything is instanced and capped so it stays cheap. Settings.gore: 'off' | 'low' | 'max'.
import * as THREE from 'three';
import { Settings } from './settings.js';
import { sfx } from './audio.js';

const rnd = Math.random;
const R = (a, b) => a + rnd() * (b - a);
const COLORS = {
  red: [0x8a0d0d, 0x6e0909, 0x9c1414, 0x560606],
  dark: [0x2a0508, 0x3a0a0e, 0x1a0306],
  slime: [0x4aa030, 0x6fcf3a, 0x3a7a28],
  void: [0x3d1a66, 0x5a2a99, 0x2a1050],
  ichor: [0xb8c040, 0x9aa030, 0xd0d860],
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
    const MAXD = this.mobile ? 220 : 520, MAXP = this.mobile ? 320 : 800, MAXG = this.mobile ? 70 : 150;
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
    this.fleshMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.55, flatShading: true }), MAXG);
    this.boneMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 1, 5), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), MAXG);
    for (const m of [this.fleshMesh, this.boneMesh]) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXG * 3), 3); m.frustumCulled = false; m.count = 0; m.castShadow = true; scene.add(m); }
    this.gibs = [];
    this.pools = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color();
  }
  get level() { return Settings.gore === 'off' ? 0 : Settings.gore === 'low' ? 0.4 : 1; }
  pick(kind) { const l = COLORS[kind] || COLORS.red; return l[(rnd() * l.length) | 0]; }

  // a splatter on the floor
  splat(x, z, size, kind = 'red', alpha = 0.9) {
    if (!this.level) return;
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
    if (this.gibs.length >= this.MAXG) this.gibs.shift();
    g.t = 0; g.life = R(14, 24); g.rot = new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6); g.ang = new THREE.Vector3(R(-12, 12), R(-12, 12), R(-12, 12)); g.bounces = 0; g.rest = false;
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
  clear() {
    this.drops.length = 0; this.gibs.length = 0; this.pools.length = 0; this.dinfo.length = 0; this.dnext = 0;
    this.decals.count = 0; this.dropMesh.count = 0; this.fleshMesh.count = 0; this.boneMesh.count = 0;
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
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
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
    // gibs
    let nf = 0, nb = 0;
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i];
      g.t += dt;
      if (!g.rest) {
        g.v.y -= 16 * dt;
        g.p.addScaledVector(g.v, dt);
        g.rot.addScaledVector(g.ang, dt);
        if (g.trail && rnd() < dt * 22) this.droplet(g.p, new THREE.Vector3(R(-0.5, 0.5), 0.5, R(-0.5, 0.5)), R(0.02, 0.045), g.blood);
        if (g.p.y <= g.s * 0.6) {
          g.p.y = g.s * 0.6;
          if (g.bounces < 3 && Math.abs(g.v.y) > 1.2) {
            g.v.y *= -0.38; g.v.x *= 0.6; g.v.z *= 0.6; g.ang.multiplyScalar(0.5); g.bounces++;
            if (!g.bone) this.splat(g.p.x, g.p.z, R(0.5, 1.1), g.blood || 'red', 0.85);
          } else { g.rest = true; g.rot.set(g.bone ? Math.PI / 2 : g.rot.x, g.rot.y, g.bone ? g.rot.z : g.rot.z); }
        }
      }
      if (g.t > g.life) { this.gibs.splice(i, 1); continue; }
    }
    for (const g of this.gibs) {
      const fade = g.t > g.life - 2 ? Math.max(0.01, (g.life - g.t) / 2) : 1;
      e.set(g.rot.x, g.rot.y, g.rot.z); q.setFromEuler(e);
      if (g.bone) s.set(g.s, g.s * (g.long || 3), g.s).multiplyScalar(fade);
      else s.set(g.s * 1.3, g.s * 0.8, g.s).multiplyScalar(fade);
      m.compose(g.p, q, s);
      c.setHex(g.col);
      if (g.bone) { this.boneMesh.setMatrixAt(nb, m); this.boneMesh.setColorAt(nb, c); nb++; } else { this.fleshMesh.setMatrixAt(nf, m); this.fleshMesh.setColorAt(nf, c); nf++; }
    }
    this.boneMesh.count = nb; this.fleshMesh.count = nf;
    for (const [mesh, k] of [[this.boneMesh, nb], [this.fleshMesh, nf]]) if (k) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
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
        if (di.t > 90) { const a = this.dalpha.getX(i); if (a > 0.35) { this.dalpha.setX(i, a - 0.03); this.dalpha.needsUpdate = true; } }
      }
    }
  }
}

// which kind of blood or gore each creature leaves
export function goreKind(data) {
  if (!data) return 'red';
  const sh = data.shape || '';
  if (sh.startsWith('skel')) return /Venom|Verd/.test(data.name || '') ? 'ichor' : 'bone';
  if (sh === 'wisp') return 'none';
  if (sh === 'blob') return /Horror|Void/.test(data.name || '') ? 'void' : 'slime';
  if (/Abyssal|Void|Hollow/.test(data.name || '')) return 'dark';
  return 'red';
}
