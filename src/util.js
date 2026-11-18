import * as THREE from 'three';

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
export const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const hex = (c) => '#' + new THREE.Color(c).getHexString();

export function mat(color, emit = 0, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0.05,
    emissive: emit ? color : 0x000000, emissiveIntensity: emit, ...opts,
  });
}
function m(geo, color, emit) {
  const mesh = new THREE.Mesh(geo, mat(color, emit));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export const box = (w, h, d, c, e = 0) => m(new THREE.BoxGeometry(w, h, d), c, e);
export const sphere = (r, c, e = 0) => m(new THREE.SphereGeometry(r, 16, 12), c, e);
export const capsule = (r, h, c, e = 0) => m(new THREE.CapsuleGeometry(r, h, 4, 12), c, e);
export const cyl = (rt, rb, h, c, e = 0, seg = 16) => m(new THREE.CylinderGeometry(rt, rb, h, seg), c, e);
export const cone = (r, h, c, e = 0, seg = 12) => m(new THREE.ConeGeometry(r, h, seg), c, e);

export function ring(parent, r, c) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  parent.add(mesh);
  return mesh;
}

export function humanoid(body, head, s = 1) {
  const g = new THREE.Group();
  const legs = capsule(0.24 * s, 0.4 * s, new THREE.Color(body).multiplyScalar(0.55));
  legs.position.y = 0.42 * s; g.add(legs);
  const torso = capsule(0.32 * s, 0.45 * s, body);
  torso.position.y = 0.98 * s; g.add(torso);
  const hd = sphere(0.22 * s, head);
  hd.position.y = 1.55 * s; g.add(hd);
  const hand = new THREE.Group();
  hand.name = 'hand';
  hand.position.set(0.42 * s, 0.98 * s, 0);
  g.add(hand);
  g.userData.hand = hand;
  return g;
}

export { sfx } from './audio.js';
