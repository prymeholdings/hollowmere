// Extra detail pieces worn by heroes: shoulder guards, belts with pouches or potions, back items and scarves.
// Built from simple shapes and attached to the rig, so they follow the animation. Chosen in character
// creation (Appearance) and changeable any time from the Wardrobe.
import * as THREE from 'three';
import { CharModel } from './assets.js';

export const SKIN_TONES = ['#ffffff', '#ffe6d2', '#f0c8a8', '#d8a078', '#a87050', '#7a4c34', '#5a382a', '#c8e0b0', '#b8cce8', '#d8c0e8'];
export const DETAIL_OPTIONS = {
  shoulders: [['none', 'None'], ['leather', 'Leather'], ['steel', 'Steel'], ['spiked', 'Spiked'], ['fur', 'Fur mantle'], ['gilded', 'Gilded']],
  belt: [['none', 'None'], ['plain', 'Plain belt'], ['pouches', 'Pouches'], ['potions', 'Potion belt']],
  back: [['none', 'None'], ['quiver', 'Quiver'], ['satchel', 'Satchel'], ['scabbard', 'Scabbard'], ['bedroll', 'Bedroll'], ['lantern', 'Lantern']],
  metal: [['iron', 'Iron'], ['gold', 'Gold'], ['dark', 'Blackened'], ['copper', 'Copper'], ['silver', 'Silver']],
};
export const SCARF_COLORS = ['', '#8c1f1f', '#1f3f8c', '#2f6a3a', '#d8b040', '#5a2a7a', '#e8e0d0', '#202020'];
// sensible defaults per class (used for new heroes and old saves)
export const CLASS_DETAILS = {
  Knight: { shoulders: 'steel', belt: 'plain', back: 'none', metal: 'iron', scarf: '' },
  Barbarian: { shoulders: 'fur', belt: 'pouches', back: 'none', metal: 'dark', scarf: '' },
  Mage: { shoulders: 'none', belt: 'potions', back: 'satchel', metal: 'gold', scarf: '#5a2a7a' },
  Rogue: { shoulders: 'leather', belt: 'pouches', back: 'quiver', metal: 'dark', scarf: '#202020' },
};
const METALS = { iron: [0x9aa0a8, 0.85, 0.35], gold: [0xd8a840, 0.9, 0.3], dark: [0x3a3a42, 0.8, 0.45], copper: [0xc07040, 0.85, 0.35], silver: [0xe0e6f0, 0.95, 0.2] };

const cache = new Map();
function mat(color, metal = 0, rough = 0.8, emissive = 0) {
  const k = `${color}|${metal}|${rough}|${emissive}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: emissive || 0x000000, emissiveIntensity: emissive ? 1.2 : 0 }));
  return cache.get(k);
}
const G = {
  dome: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  sph: new THREE.SphereGeometry(1, 12, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 28),
};
function M(geo, m, sx, sy, sz, x, y, z, parent) {
  const o = new THREE.Mesh(geo, m);
  o.scale.set(sx, sy ?? sx, sz ?? sx); o.position.set(x || 0, y || 0, z || 0);
  o.castShadow = true;
  parent.add(o);
  return o;
}
const leather = () => mat(0x5a3a22, 0, 0.9);
const darkLeather = () => mat(0x3a2616, 0, 0.9);

function shoulderPad(kind, metal, s) {
  const p = new THREE.Group();
  const [mc, mm, mr] = METALS[metal] || METALS.iron;
  if (kind === 'leather') { M(G.dome, leather(), 0.24, 0.12, 0.26, 0, 0, 0, p); M(G.dome, darkLeather(), 0.2, 0.1, 0.22, 0, -0.06, 0, p); }
  else if (kind === 'fur') { const f = mat(0x8a7058, 0, 1); M(G.sph, f, 0.26, 0.16, 0.28, 0, 0.02, 0, p); M(G.sph, mat(0xa88a6a, 0, 1), 0.18, 0.12, 0.22, -s * 0.08, 0.08, 0, p); }
  else {
    const m = kind === 'gilded' ? mat(0xd8a840, 0.95, 0.25) : mat(mc, mm, mr);
    M(G.dome, m, 0.26, 0.15, 0.28, 0, 0, 0, p);
    M(G.dome, m, 0.22, 0.12, 0.24, 0, -0.08, 0, p);
    M(G.torus, m, 0.21, 0.21, 0.4, 0, 0.0, 0, p).rotation.x = Math.PI / 2;
    if (kind === 'spiked') for (const z of [-0.1, 0.08]) M(G.cone, mat(mc, mm, mr), 0.05, 0.22, 0.05, 0, 0.17, z, p);
    if (kind === 'gilded') M(G.sph, mat(0x4ab8ff, 0.2, 0.1, 0x2a78d0), 0.04, 0.04, 0.04, 0, 0.12, 0.2, p);
  }
  return p;
}
function belt(kind, metal) {
  const g = new THREE.Group();
  const [mc, mm, mr] = METALS[metal] || METALS.iron;
  M(G.cyl, darkLeather(), 0.43, 0.08, 0.39, 0, 0, 0, g);
  M(G.box, mat(mc, mm, mr), 0.12, 0.1, 0.03, 0, 0, 0.395, g);
  if (kind === 'pouches') { M(G.box, leather(), 0.12, 0.14, 0.09, 0.3, -0.06, 0.27, g); M(G.box, leather(), 0.11, 0.12, 0.08, -0.33, -0.05, 0.22, g); M(G.box, leather(), 0.14, 0.14, 0.09, 0.24, -0.06, -0.31, g); }
  if (kind === 'potions') {
    const cols = [0xff3a4a, 0x3a7aff, 0xff3a4a, 0x7aff5a];
    cols.forEach((c, i) => {
      const a = -0.9 + i * 0.6, x = Math.sin(a) * 0.43, z = Math.cos(a) * 0.4;
      M(G.cyl, mat(c, 0.1, 0.15, c), 0.035, 0.11, 0.035, x, -0.06, z, g);
      M(G.cyl, mat(0x8a6a4a, 0, 0.9), 0.02, 0.03, 0.02, x, 0.01, z, g);
    });
  }
  return g;
}
function back(kind, metal) {
  const g = new THREE.Group();
  const [mc, mm, mr] = METALS[metal] || METALS.iron;
  g.position.set(0, 0.12, -0.4);
  if (kind === 'quiver') {
    const q = new THREE.Group(); q.rotation.z = 0.5; g.add(q);
    M(G.cyl, leather(), 0.09, 0.55, 0.09, 0, 0, 0, q);
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.03; M(G.cyl, mat(0xc8b090, 0, 0.8), 0.008, 0.2, 0.008, x, 0.36, (i % 2) * 0.03, q); M(G.cone, mat(0xe8e0d0, 0, 0.9), 0.025, 0.06, 0.006, x, 0.48, (i % 2) * 0.03, q); }
  } else if (kind === 'satchel') { M(G.box, leather(), 0.38, 0.32, 0.16, 0, 0, -0.02, g); M(G.box, darkLeather(), 0.39, 0.12, 0.17, 0, 0.12, -0.02, g); M(G.box, mat(mc, mm, mr), 0.05, 0.05, 0.02, 0, 0.06, -0.11, g); }
  else if (kind === 'scabbard') { const s = new THREE.Group(); s.rotation.z = -0.6; g.add(s); M(G.box, darkLeather(), 0.08, 0.7, 0.05, 0, 0, 0, s); M(G.box, mat(mc, mm, mr), 0.2, 0.03, 0.06, 0, 0.36, 0, s); M(G.cyl, darkLeather(), 0.02, 0.18, 0.02, 0, 0.47, 0, s); }
  else if (kind === 'bedroll') { const r = M(G.cyl, mat(0x6a5a3a, 0, 1), 0.11, 0.5, 0.11, 0, 0.3, 0, g); r.rotation.z = Math.PI / 2; M(G.torus, darkLeather(), 0.115, 0.115, 0.5, 0.14, 0.3, 0, g).rotation.y = Math.PI / 2; M(G.torus, darkLeather(), 0.115, 0.115, 0.5, -0.14, 0.3, 0, g).rotation.y = Math.PI / 2; }
  else if (kind === 'lantern') {
    M(G.box, leather(), 0.3, 0.26, 0.12, 0, 0, 0, g);
    const l = new THREE.Group(); l.position.set(0.22, -0.18, -0.05); g.add(l);
    M(G.cyl, mat(mc, mm, mr), 0.06, 0.02, 0.06, 0, 0.08, 0, l);
    M(G.cyl, mat(0xffd070, 0, 0.2, 0xffa030), 0.05, 0.12, 0.05, 0, 0, 0, l);
    M(G.cyl, mat(mc, mm, mr), 0.06, 0.02, 0.06, 0, -0.07, 0, l);
  }
  return g;
}
function scarf(color) {
  const g = new THREE.Group();
  const m = mat(new THREE.Color(color).getHex(), 0, 0.95);
  M(G.torus, m, 0.3, 0.3, 1.8, 0, 0, 0, g).rotation.x = Math.PI / 2;
  const tail = M(G.box, m, 0.1, 0.3, 0.04, 0.12, -0.17, 0.3, g); tail.rotation.z = 0.25;
  return g;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
CharModel.detailHook = (model, outfit, look) => {
  const b = model.bones || {};
  const chest = b.chest, hips = b.hips;
  const add = (o, bone) => { if (!bone || !o) return; bone.add(o); model.worn.push(o); };
  const metal = look.metal || 'iron';
  if (look.shoulders && look.shoulders !== 'none' && chest) {
    // pads ride on the upper arms so they follow every swing; sized and tilted from the current pose
    model.root.updateMatrixWorld(true);
    const cs = chest.getWorldScale(new THREE.Vector3()).x;
    const cpos = chest.getWorldPosition(new THREE.Vector3());
    for (const [s, names] of [[-1, ['upperarm.r', 'upperarmr']], [1, ['upperarm.l', 'upperarml']]]) {
      const bone = b[names[0]] || b[names[1]];
      if (!bone) continue;
      // the pad sits on the chest bone, right above the shoulder joint, tilted outwards
      const jw = bone.getWorldPosition(new THREE.Vector3());
      const outW = jw.clone().sub(cpos).setY(0).normalize();
      const lp = chest.worldToLocal(jw.clone().addScaledVector(outW, 0.02 * cs).add(new THREE.Vector3(0, 0.07 * cs, 0)));
      chest.getWorldQuaternion(_q).invert();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(_q), out = outW.clone().applyQuaternion(_q);
      const axis = up.multiplyScalar(0.8).add(out.multiplyScalar(0.55)).normalize();
      const pad = shoulderPad(look.shoulders, metal, s);
      pad.scale.setScalar(1.15);
      pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
      pad.position.copy(lp);
      add(pad, chest);
    }
  }
  if (look.belt && look.belt !== 'none') { const o = belt(look.belt, metal); o.position.y = 0.12; add(o, hips); }
  if (look.back && look.back !== 'none') add(back(look.back, metal), chest);
  if (look.scarf) { const o = scarf(look.scarf); o.position.y = 0.46; add(o, chest); }
};
