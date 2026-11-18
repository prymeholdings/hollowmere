import * as THREE from 'three';

const MAX = 4000;

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.p = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.size = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softTexture() }, scale: { value: 400 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor;
        uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb * 1.6, vColor.a * t.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.rings = [];
    this.beams = [];
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.5);
      scene.add(l);
      this.lights.push({ l, t: 0, dur: 1, peak: 0 });
    }
    this.tmpC = new THREE.Color();
  }
  setScale(h) { this.points.material.uniforms.scale.value = h * 0.5; }

  emit(pos, o = {}) {
    const n = o.count ?? 12;
    const c = this.tmpC.set(o.color ?? 0xffaa44);
    for (let i = 0; i < n && this.p.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.3 + Math.random() * 0.7);
      const up = o.up ?? 1;
      const spread = o.spread ?? 0.2;
      this.p.push({
        x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread, z: pos.z + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * sp * (o.flat ? 1 : 0.7), vy: (o.flat ? 0.2 : Math.random()) * sp * up + (o.rise ?? 0), vz: Math.sin(a) * sp * (o.flat ? 1 : 0.7),
        life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), t: 0,
        size: (o.size ?? 0.5) * (0.6 + Math.random() * 0.8),
        r: c.r, g: c.g, b: c.b, grav: o.gravity ?? 0, drag: o.drag ?? 1.5,
      });
    }
  }
  ring(pos, color, radius, dur = 0.45) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.12, pos.z);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur, radius });
  }
  beam(a, b, color, dur = 0.25) {
    const pts = [];
    const seg = 10;
    for (let i = 0; i <= seg; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, i / seg);
      if (i > 0 && i < seg) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6));
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(line);
    this.beams.push({ line, t: 0, dur });
    for (const p of pts) this.emit(p, { count: 2, color, speed: 1, life: 0.3, size: 0.4 });
  }
  flash(pos, color, peak = 20, dur = 0.4) {
    let best = this.lights[0];
    for (const L of this.lights) if (L.t >= L.dur) { best = L; break; }
    best.l.position.set(pos.x, 1.5, pos.z);
    best.l.color.set(color);
    best.t = 0; best.dur = dur; best.peak = peak;
  }
  explosion(pos, color, radius = 2) {
    this.emit(pos.clone().setY(0.6), { count: 40, color, speed: radius * 3, life: 0.6, size: 0.9, up: 0.8 });
    this.emit(pos.clone().setY(0.3), { count: 20, color: 0x333333, speed: radius * 1.5, life: 1.0, size: 1.2, up: 0.5, rise: 1 });
    this.ring(pos, color, radius);
    this.flash(pos, color, 40, 0.5);
  }
  clear() {
    this.p.length = 0;
    for (const r of this.rings) this.scene.remove(r.mesh);
    for (const b of this.beams) this.scene.remove(b.line);
    this.rings = []; this.beams = [];
  }
  update(dt) {
    let n = 0;
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.t += dt;
      if (q.t >= q.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const d = Math.max(0, 1 - q.drag * dt);
      q.vx *= d; q.vz *= d; q.vy = q.vy * d - q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    for (const q of P) {
      const k = q.t / q.life;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      this.col[n * 4] = q.r; this.col[n * 4 + 1] = q.g; this.col[n * 4 + 2] = q.b; this.col[n * 4 + 3] = (1 - k) * Math.min(1, q.t * 10);
      this.size[n] = q.size * (1 - k * 0.5);
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.dur;
      r.mesh.scale.setScalar(1 + k * r.radius * 2.2);
      r.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      b.line.material.opacity = 1 - b.t / b.dur;
      if (b.t >= b.dur) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); this.beams.splice(i, 1); }
    }
    for (const L of this.lights) {
      L.t += dt;
      L.l.intensity = L.t < L.dur ? L.peak * (1 - L.t / L.dur) : 0;
    }
  }
}
