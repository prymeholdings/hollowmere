// Town portal as a 3D black-hole vortex: an event horizon, a lensed photon ring, a tilted swirling
// accretion disk and sparks spiralling inward. All procedural (shaders + points), no textures.
import * as THREE from 'three';

const BILL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// camera-facing layer: black core, bright photon ring, spiral arms and a lensing halo
const BILL_FS = `precision highp float;
varying vec2 vUv;
uniform float t, open;
uniform vec3 cIn, cOut, cRing;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float core = 0.235;
  // logarithmic spiral swirl that turns faster near the horizon
  float sw = a * 3.0 + log(max(r, 0.05)) * 7.0 - t * 3.2;
  float arms = 0.5 + 0.5 * sin(sw);
  float grain = n(vec2(a * 4.0 + t * 0.8, r * 9.0 - t * 2.0));
  float arm2 = pow(arms, 2.2);
  float body = smoothstep(1.0, core + 0.1, r) * (0.12 + 1.1 * arm2 * (0.55 + 0.7 * grain));
  vec3 col = mix(cOut, cIn, smoothstep(0.95, core, r));
  float ring = exp(-pow((r - core - 0.035) / 0.022, 2.0));
  float halo = exp(-pow((r - core - 0.12) / 0.08, 2.0)) * 0.35;
  vec3 c = col * (body * 1.15 + halo) + cRing * ring * 1.6;
  float dark = smoothstep(1.0, 0.5, r) * 0.55; // a dim violet haze between the arms
  c += cOut * 0.25 * dark;
  float alpha = clamp(body + ring + halo + dark, 0.0, 1.0);
  float hole = smoothstep(core - 0.01, core + 0.015, r);
  c *= hole; alpha = mix(1.0, alpha, hole);
  gl_FragColor = vec4(c, alpha * open);
}`;
const DISK_VS = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// accretion disk: hot white near the horizon fading to the portal colour, streaked and spinning
const DISK_FS = `precision highp float;
varying vec3 vP;
uniform float t, open, rin, rout;
uniform vec3 cIn, cOut;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  float r = length(vP.xy);
  float k = (r - rin) / (rout - rin);
  if (k < 0.0 || k > 1.0) discard;
  float a = atan(vP.y, vP.x);
  float spin = a + t * (2.6 / (0.35 + k));
  float streak = n(vec2(spin * 5.0, k * 14.0)) * 0.7 + n(vec2(spin * 13.0, k * 30.0)) * 0.3;
  vec3 col = mix(vec3(0.95, 0.85, 1.0), cIn, smoothstep(0.0, 0.3, k));
  col = mix(col, cOut, smoothstep(0.35, 1.0, k));
  float alpha = smoothstep(0.0, 0.06, k) * smoothstep(1.0, 0.45, k) * (0.35 + 0.9 * streak);
  gl_FragColor = vec4(col * (0.95 - k * 0.45), alpha * open * 0.75);
}`;

export class Vortex {
  // radius: size of the swirl; colors: inner glow, outer glow, photon ring
  constructor({ radius = 1.1, cIn = 0x9a5cff, cOut = 0x24086a, cRing = 0xe8d8ff, sparks = 180 } = {}) {
    this.root = new THREE.Group();
    this.radius = radius;
    this.t = Math.random() * 10;
    this.open = 0; this.target = 1;
    const U = (v) => ({ value: v });
    const col = (c) => new THREE.Color(c);
    this.bill = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.6, radius * 2.6), new THREE.ShaderMaterial({
      uniforms: { t: U(0), open: U(0), cIn: U(col(cIn)), cOut: U(col(cOut)), cRing: U(col(cRing)) },
      vertexShader: BILL_VS, fragmentShader: BILL_FS, transparent: true, depthWrite: false, toneMapped: false,
    }));
    this.bill.renderOrder = 2;
    this.diskTilt = new THREE.Group();
    this.diskTilt.rotation.order = 'YXZ';
    this.diskTilt.rotation.x = -2.0;
    const rin = radius * 0.34, rout = radius * 1.35;
    this.disk = new THREE.Mesh(new THREE.RingGeometry(rin * 0.95, rout, 96, 1), new THREE.ShaderMaterial({
      uniforms: { t: U(0), open: U(0), rin: U(rin), rout: U(rout), cIn: U(col(cIn)), cOut: U(col(cOut)) },
      vertexShader: DISK_VS, fragmentShader: DISK_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    this.disk.renderOrder = 3;
    this.diskTilt.add(this.disk);
    // the event horizon: an opaque black sphere that hides the far half of the disk
    this.hole = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.31, 32, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    // sparks pulled into the hole
    this.n = sparks;
    this.sp = Array.from({ length: sparks }, () => this.spawn({}, true));
    this.pos = new Float32Array(sparks * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: cIn, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.points.frustumCulled = false;
    this.diskTilt.add(this.points);
    this.light = new THREE.PointLight(cIn, 0, 9, 1.4);
    this.root.add(this.bill, this.diskTilt, this.hole, this.light);
    this.root.scale.setScalar(0.001);
  }
  spawn(s, initial) {
    s.r = this.radius * (initial ? 0.4 + Math.random() * 1.3 : 1.4 + Math.random() * 0.5);
    s.a = Math.random() * Math.PI * 2;
    s.z = (Math.random() - 0.5) * 0.25;
    s.v = 0.6 + Math.random() * 0.8;
    return s;
  }
  // camera: billboard target; returns false once fully closed
  update(dt, camera) {
    this.t += dt;
    this.open += (this.target - this.open) * Math.min(1, dt * (this.target > this.open ? 3.2 : 5));
    if (Math.abs(this.target - this.open) < 0.002) this.open = this.target;
    const o = this.open;
    // overshoot a little as it tears open, then breathe
    const sc = Math.max(0.001, o * (1 + 0.04 * Math.sin(this.t * 2.2)));
    this.root.scale.setScalar(sc);
    this.bill.material.uniforms.t.value = this.t; this.bill.material.uniforms.open.value = o;
    this.disk.material.uniforms.t.value = this.t; this.disk.material.uniforms.open.value = o;
    this.points.material.opacity = o;
    this.light.intensity = 6 * o;
    if (camera) {
      const wp = this.root.getWorldPosition(new THREE.Vector3());
      this.bill.quaternion.copy(camera.quaternion);
      if (this.root.parent) { const pq = this.root.parent.getWorldQuaternion(new THREE.Quaternion()); this.bill.quaternion.premultiply(pq.invert()); }
      // keep the disk turned towards the viewer so it always reads as a tilted ring around the hole
      const dir = camera.position.clone().sub(wp); this.diskTilt.rotation.y = Math.atan2(dir.x, dir.z);
    }
    const rmin = this.radius * 0.32;
    for (let i = 0; i < this.n; i++) {
      const s = this.sp[i];
      s.a += dt * s.v * 2.4 * (this.radius / Math.max(s.r, rmin));
      s.r -= dt * s.v * (0.35 + 0.5 * this.radius / Math.max(s.r, rmin));
      if (s.r < rmin) this.spawn(s, false);
      this.pos[i * 3] = Math.cos(s.a) * s.r; this.pos[i * 3 + 1] = Math.sin(s.a) * s.r; this.pos[i * 3 + 2] = s.z * (s.r / this.radius);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    return !(this.target === 0 && this.open === 0);
  }
  close() { this.target = 0; }
  dispose() {
    this.root.parent?.remove(this.root);
    for (const m of [this.bill, this.disk, this.hole, this.points]) { m.geometry.dispose(); m.material.dispose(); }
  }
}
