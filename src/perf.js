// Frame-budget helpers. The realistic characters are by far the most expensive thing on screen
// (each is ~14 skinned meshes and ~25k triangles), so before every frame:
//  - characters outside the camera view are skipped (their meshes cannot be frustum-culled on their own),
//  - only the nearest N are drawn at all (fewer on phones),
//  - far ones drop their tiny parts (eyes, teeth, lashes),
//  - only nearby ones cast shadows.
// Dead bodies are baked into static meshes once their fall has finished, and severed parts are merged
// into one mesh per material when they come to rest, so a floor full of gore costs little.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { Settings } from './settings.js';

const phone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sphere = new THREE.Sphere(), v = new THREE.Vector3();
const hidden = [], tinyOff = [];

function tinyParts(rc) {
  if (rc._tiny) return rc._tiny;
  rc._tiny = [];
  for (const k in rc.parts) { const m = rc.parts[k]; const g = m.geometry; const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3; if (tris < 450) rc._tiny.push(m); }
  return rc._tiny;
}
// beyond 18 m the small extras (buckles, pouches, hair ties, small trims) can go too
function smallParts(rc) {
  if (rc._small) return rc._small;
  rc._small = [];
  for (const k in rc.parts) { const m = rc.parts[k]; const g = m.geometry; const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3; if (tris >= 450 && tris < 1000) rc._small.push(m); }
  return rc._small;
}
function setShadow(rc, on) {
  if (rc._shadow === on) return;
  rc._shadow = on;
  rc.root.traverse((o) => { if (o.isMesh) o.castShadow = on; });
}

export function beforeRender(camera) {
  const L = G.level;
  if (!L) return;
  camera.updateMatrixWorld();
  pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(pm);
  const focus = G.player ? G.player.pos : camera.position;
  const max = phone ? 10 : Settings.quality === 'low' ? 16 : 24;
  const shadows = Settings.quality !== 'low';
  const list = [];
  for (const e of L.entities) {
    const rc = e.char && e.char.isReal ? e.char : e.model && e.model.isReal ? e.model : null;
    if (!rc || !e.root.visible || e === G.player) continue;
    const s = rc.root.scale.x || 1;
    sphere.center.copy(e.root.position); sphere.center.y += 0.9 * s; sphere.radius = 1.4 * s;
    if (!frustum.intersectsSphere(sphere)) { e.root.visible = false; hidden.push(e.root); rc.lod = 2; continue; }
    list.push([e, rc, (e.root.position.x - focus.x) ** 2 + (e.root.position.z - focus.z) ** 2]);
  }
  if (list.length > max) {
    list.sort((a, b) => a[2] - b[2]);
    for (let i = max; i < list.length; i++) { list[i][0].root.visible = false; hidden.push(list[i][0].root); list[i][1].lod = 2; }
    list.length = max;
  }
  for (const [, rc, d2] of list) {
    rc.lod = d2 > 196 ? 1 : 0;
    if (d2 > 121) for (const m of tinyParts(rc)) if (m.visible) { m.visible = false; tinyOff.push(m); }
    if (d2 > 324) for (const m of smallParts(rc)) if (m.visible) { m.visible = false; tinyOff.push(m); }
    if (shadows) setShadow(rc, d2 < 100);
  }
  if (G.player && G.player.model && G.player.model.isReal && shadows) setShadow(G.player.model, true);
}
export function afterRender() {
  for (const r of hidden) r.visible = true;
  for (const m of tinyOff) m.visible = true;
  hidden.length = 0; tinyOff.length = 0;
}

// ---------------------------------------------------------------- bake a frozen body into static meshes
export function bakeStatic(rc) {
  if (!rc || rc.baked) return;
  rc.baked = true;
  rc.root.updateMatrixWorld(true);
  const swaps = [];
  rc.root.traverse((o) => { if (o.isSkinnedMesh && o.visible) swaps.push(o); });
  for (const sm of swaps) {
    sm.skeleton.update();
    const src = sm.geometry, n = src.attributes.position.count;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { sm.getVertexPosition(i, v); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv);
    if (src.attributes.color) g.setAttribute('color', src.attributes.color);
    if (src.index) g.setIndex(src.index);
    for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    g.computeVertexNormals(); g.computeBoundingSphere();
    // collapsed (severed) bones squash their vertices to a point; those triangles simply vanish
    const m = new THREE.Mesh(g, sm.material);
    m.position.copy(sm.position); m.quaternion.copy(sm.quaternion); m.scale.copy(sm.scale);
    m.castShadow = false; m.receiveShadow = false;
    m.matrixAutoUpdate = false; m.updateMatrix();
    sm.parent.add(m); sm.parent.remove(sm);
  }
  rc.mixer?.stopAllAction?.();
  rc.root.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
}

// ---------------------------------------------------------------- merge a resting gore part
export function flattenGroup(obj) {
  if (!obj.isGroup && !obj.children.length) return obj;
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const byMat = new Map();
  obj.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    if (!g.index) { const idx = new Uint32Array(g.attributes.position.count); for (let i = 0; i < idx.length; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
    g.clearGroups();
    (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(g);
  });
  if (!byMat.size) return obj;
  const out = new THREE.Group();
  out.position.copy(obj.position); out.quaternion.copy(obj.quaternion); out.scale.copy(obj.scale);
  for (const [mat, gs] of byMat) {
    let g = null; try { g = mergeGeometries(gs, false); } catch (e) { g = null; }
    if (!g) return obj; // leave it as it was
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.matrixAutoUpdate = false; m.updateMatrix();
    out.add(m);
  }
  out.matrixAutoUpdate = false; out.updateMatrix();
  obj.parent?.add(out); obj.parent?.remove(obj);
  return out;
}
