// Visuals for the extra equipment slots (gloves, belt, pants, boots, shoulders, undershirt).
// `wearGear` fits pieces to the realistic hero's skeleton and registers small animations (cloth sway, glow pulses,
// footstep dust); `gearIcon` builds a simple model of the same piece for the inventory icon.
import * as THREE from 'three';

export const GEAR_SLOTS = ['shirt', 'pants', 'boots', 'gloves', 'belt', 'shoulders'];

const mats = new Map();
const mat = (color, metal = 0.1, rough = 0.8, em = 0, emi = 0, unique = false) => {
  const k = [color, metal, rough, em, emi].join('|');
  if (unique) return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: em, emissiveIntensity: emi });
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: em, emissiveIntensity: emi }));
  return mats.get(k);
};
const tinted = (base, tint) => new THREE.Color(base).multiply(new THREE.Color(tint));
const RARITY_ACCENT = [0x8a6a30, 0x6a9ae0, 0xffd84d, 0xff9a2a, 0xe04040];

// look per piece: base colour of the material kind, metal or cloth, and style flags
const STYLE = {
  // shirts
  undershirt: { cloth: 0xe8dcc0, sleeves: 0.45 }, jerkin: { cloth: 0x8a5a34, sleeves: 0, leather: true, lace: true }, longshirt: { cloth: 0x9a8a70, sleeves: 1 },
  // pants
  leggings: { cloth: 0x6a4a30, leather: true }, greaves: { cloth: 0xaab0b8, metal: true }, kilt: { cloth: 0x7a2a2a, skirt: true },
  // boots
  shoes: { cloth: 0x5a4028, leather: true, h: 0.12 }, boots: { cloth: 0x4a3220, leather: true, h: 0.5 }, sabatons: { cloth: 0xaab0b8, metal: true, h: 0.55 },
  // gloves
  gloves: { cloth: 0x6a4a30, leather: true, cuff: 0.25 }, gauntlets: { cloth: 0xaab0b8, metal: true, cuff: 0.55 }, wraps: { cloth: 0xd8d0b8, wrap: true, cuff: 0.5 },
  // belts
  belt: { cloth: 0x4a3220, leather: true, pouch: true }, girdle: { cloth: 0x8a8e96, metal: true, plates: true }, sash: { cloth: 0x9a2a3a, sash: true },
  // shoulders
  mantle: { cloth: 0x5a3a8a, mantle: true }, spaulders: { cloth: 0x7a5232, leather: true, spikes: true }, pauldrons: { cloth: 0xaab0b8, metal: true, big: true },
};

function colorsFor(l) {
  const s = STYLE[l.vis] || STYLE.belt;
  const col = tinted(s.cloth, l.tint ?? 0xffffff);
  const glow = new THREE.Color(l.glow || 0);
  const accentC = RARITY_ACCENT[Math.min(l.rarity || 0, 4)];
  const body = s.metal ? mat(col.getHex(), 0.7, 0.36, glow.getHex(), glow.getHex() ? 0.8 : 0) : s.leather ? mat(col.getHex(), 0.05, 0.75, glow.getHex(), glow.getHex() ? 0.5 : 0) : mat(col.getHex(), 0.0, 0.92, glow.getHex(), glow.getHex() ? 0.5 : 0);
  const dark = mat(col.clone().multiplyScalar(0.55).getHex(), s.metal ? 0.5 : 0.05, 0.7);
  const accent = mat(accentC, 0.9, 0.3, (l.rarity || 0) >= 2 ? accentC : 0, (l.rarity || 0) >= 2 ? 0.5 : 0, true);
  return { s, col, body, dark, accent, accentC, glowing: (l.rarity || 0) >= 2 || !!l.glow };
}

// ------------------------------------------------------------------------------------------------ worn pieces
export function wearGear(rc, slot, l) {
  const sc = rc.scene; sc.updateMatrixWorld(true);
  const wp = (n) => (rc.bones[n] ? rc.bones[n].getWorldPosition(new THREE.Vector3()) : new THREE.Vector3());
  const rel = (n) => sc.worldToLocal(wp(n));
  const hips = rel('Hips'), neck = rel('Neck'), lsh = rel('LeftArm'), rsh = rel('RightArm');
  const sw = Math.abs(lsh.x - rsh.x), torsoH = neck.y - hips.y;
  const toLocal = (bone, v) => rc.bones[bone].worldToLocal(sc.localToWorld(v.clone()));
  const C = colorsFor(l);
  const { s } = C;
  const attach = (obj, bone) => { rc.bones[bone].add(obj); rc.worn.push(obj); obj.castShadow = true; return obj; };
  const place = (obj, bone, v) => { obj.position.copy(toLocal(bone, v)); return obj; };
  // a tapered tube along a bone toward its child (in the bone's local frame)
  const seg = (boneName, childName, r0, r1, from, to, material, open = false) => {
    const a = rel(boneName), b = rel(childName);
    const v = b.clone().sub(a); const len = v.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len * (to - from), 16, 1, open), material);
    const mid = a.clone().addScaledVector(v, (from + to) / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
    const bone = rc.bones[boneName];
    const wq = bone.getWorldQuaternion(new THREE.Quaternion()), scq = sc.getWorldQuaternion(new THREE.Quaternion());
    mesh.position.copy(toLocal(boneName, mid));
    mesh.quaternion.copy(wq.invert().multiply(scq).multiply(q));
    mesh.material.side = THREE.DoubleSide;
    attach(mesh, boneName);
    return mesh;
  };
  const pulse = (material, base, amp = 0.35, speed = 2.2) => rc.anims.push((t) => { material.emissiveIntensity = base + amp * (0.5 + 0.5 * Math.sin(t * speed)); });
  const speedOf = () => rc.speed || 0;
  const sides = ['Left', 'Right'];

  switch (slot) {
    case 'shirt': {
      const cx = (lsh.x + rsh.x) / 2;
      const y0 = hips.y + torsoH * 0.04, y1 = neck.y - torsoH * 0.06;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(sw * 0.205, sw * 0.185, y1 - y0, 24, 1, true), C.body);
      body.scale.z = 0.78; body.material.side = THREE.DoubleSide;
      body.position.copy(toLocal('Spine1', new THREE.Vector3(cx, (y0 + y1) / 2, 0.0)));
      attach(body, 'Spine1');
      // collar / lace
      const collar = new THREE.Mesh(new THREE.TorusGeometry(sw * 0.1, sw * 0.022, 8, 20), s.lace ? C.dark : C.body);
      collar.rotation.x = Math.PI / 2; collar.position.copy(toLocal('Spine2', new THREE.Vector3(cx, y1, 0.012))); attach(collar, 'Spine2');
      if (s.lace) for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.1, 0.006, 0.004), C.accent); k.position.copy(toLocal('Spine1', new THREE.Vector3(cx, y1 - 0.05 - i * 0.05, sw * 0.16))); attach(k, 'Spine1'); }
      // sleeves
      if (s.sleeves) for (const side of sides) {
        const up = seg(`${side}Arm`, `${side}ForeArm`, sw * 0.082, sw * 0.07, 0.02, s.sleeves >= 1 ? 1.0 : 0.62, C.body, true);
        if (s.sleeves >= 1) seg(`${side}ForeArm`, `${side}Hand`, sw * 0.068, sw * 0.056, 0.0, 0.92, C.body, true);
      }
      // the hem and chest breathe a little
      rc.anims.push((t) => { const b = 1 + Math.sin(t * 1.9) * 0.012; body.scale.set(b, 1, 0.78 * b); });
      break;
    }
    case 'pants': {
      for (const side of sides) {
        seg(`${side}UpLeg`, `${side}Leg`, sw * 0.14, sw * 0.108, 0.04, 1.0, C.body);
        seg(`${side}Leg`, `${side}Foot`, sw * 0.106, sw * (s.metal ? 0.082 : 0.074), 0.0, s.metal ? 0.88 : 0.78, C.body);
        if (s.metal) { const k = new THREE.Mesh(new THREE.SphereGeometry(sw * 0.075, 14, 10), C.accent); const p = rel(`${side}Leg`); p.z += sw * 0.06; place(k, `${side}Leg`, p); attach(k, `${side}Leg`); }
      }
      // hip band
      const band = new THREE.Mesh(new THREE.CylinderGeometry(sw * 0.235, sw * 0.225, torsoH * 0.12, 24, 1, true), C.dark);
      band.scale.z = 0.8; band.material.side = THREE.DoubleSide; place(band, 'Hips', new THREE.Vector3((lsh.x + rsh.x) / 2, hips.y + torsoH * 0.03, 0)); attach(band, 'Hips');
      if (s.skirt) {
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(sw * 0.24, sw * 0.4, torsoH * 0.62, 28, 1, true), C.body);
        skirt.material.side = THREE.DoubleSide; skirt.scale.z = 0.9;
        place(skirt, 'Hips', new THREE.Vector3((lsh.x + rsh.x) / 2, hips.y - torsoH * 0.26, 0)); attach(skirt, 'Hips');
        const hem = new THREE.Mesh(new THREE.TorusGeometry(sw * 0.4, 0.012, 6, 32), C.accent); hem.rotation.x = Math.PI / 2; hem.scale.y = 0.9;
        place(hem, 'Hips', new THREE.Vector3((lsh.x + rsh.x) / 2, hips.y - torsoH * 0.57, 0)); attach(hem, 'Hips');
        rc.anims.push((t) => { const k = 1 + Math.min(speedOf(), 5) * 0.035 + Math.sin(t * 7) * 0.012 * Math.min(speedOf(), 3); skirt.scale.x = k; hem.scale.x = k; });
      } else {
        rc.anims.push((t) => { for (const side of sides) { const g = rc.bones[`${side}UpLeg`]; if (g) g.children.forEach((c) => { if (c.userData.flap) c.rotation.x = Math.sin(t * 6) * 0.03; }); } });
      }
      break;
    }
    case 'boots': {
      const tall = s.h || 0.3;
      const feet = [];
      for (const side of sides) {
        const ft = rel(`${side}Foot`), toe = rel(`${side}ToeBase`), te = rel(`${side}Toe_End`);
        // shaft up the shin
        const shaft = seg(`${side}Leg`, `${side}Foot`, sw * (s.metal ? 0.09 : 0.1), sw * 0.072, 1 - tall, 1.02, C.body);
        // cuff
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(sw * 0.095, 0.011, 6, 20), C.dark);
        const a = rel(`${side}Leg`), b = ft; const top = a.clone().lerp(b, 1 - tall);
        cuff.rotation.x = Math.PI / 2; place(cuff, `${side}Leg`, top); attach(cuff, `${side}Leg`);
        // foot: a rounded box from ankle to toe tip
        const len = Math.max(0.12, Math.abs(te.z - ft.z) + 0.07), foot = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.17, 0.085, len), C.body);
        foot.geometry.translate(0, 0, len / 2 - 0.045);
        place(foot, `${side}Foot`, new THREE.Vector3(ft.x, ft.y - 0.035, ft.z - 0.002)); attach(foot, `${side}Foot`);
        const toeCap = new THREE.Mesh(new THREE.SphereGeometry(sw * 0.088, 12, 8), s.metal ? C.accent : C.dark); toeCap.scale.set(1, 0.55, 1);
        place(toeCap, `${side}Foot`, new THREE.Vector3(te.x, te.y + 0.01, te.z + 0.025)); attach(toeCap, `${side}Foot`);
        const sole = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.175, 0.016, len + 0.01), C.dark); sole.geometry.translate(0, 0, len / 2 - 0.045);
        place(sole, `${side}Foot`, new THREE.Vector3(ft.x, ft.y - 0.078, ft.z - 0.002)); attach(sole, `${side}Foot`);
        feet.push({ bone: rc.bones[`${side}Foot`], up: false });
      }
      // little puffs of dust as each foot lands while moving
      const v = new THREE.Vector3();
      rc.anims.push((t, dt) => {
        if (speedOf() < 1.2) return;
        for (const f of feet) {
          f.bone.getWorldPosition(v);
          const gy = rc.root.getWorldPosition(new THREE.Vector3()).y;
          const h = v.y - gy;
          if (h > 0.14) f.up = true;
          else if (f.up && h < 0.1) { f.up = false; globalThis.game?.fx?.emit?.(new THREE.Vector3(v.x, gy + 0.05, v.z), { count: 2, color: 0xb8a888, speed: 0.4, life: 0.5, size: 0.18, rise: 0.25, gravity: 0 }); }
        }
      });
      break;
    }
    case 'gloves': {
      for (const side of sides) {
        const h = rel(`${side}Hand`), fa = rel(`${side}ForeArm`);
        // cuff up the forearm
        const cuff = seg(`${side}ForeArm`, `${side}Hand`, sw * 0.074, sw * 0.062, 1 - (s.cuff || 0.3), 1.0, C.body);
        // the hand: palm block and a knuckle bar
        const palm = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.1, 0.034, 0.1), C.body); palm.geometry.translate(0, 0, 0.0);
        const dir = new THREE.Vector3(0, -1, 0); // hands hang down the rest pose
        place(palm, `${side}Hand`, new THREE.Vector3(h.x, h.y - 0.075, h.z)); attach(palm, `${side}Hand`);
        palm.rotation.x = 0; palm.scale.set(1, 3.0, 1.0);
        palm.geometry = new THREE.BoxGeometry(sw * 0.1, 0.1, 0.045);
        for (let i = 0; i < 4; i++) {
          const fx = (i - 1.5) * sw * 0.026;
          const f = new THREE.Mesh(new THREE.CapsuleGeometry(sw * 0.011, 0.045, 3, 8), s.metal ? C.dark : C.body);
          place(f, `${side}Hand`, new THREE.Vector3(h.x + fx * (side === 'Left' ? -1 : 1), h.y - 0.155, h.z)); attach(f, `${side}Hand`);
        }
        if (s.metal) { const k = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.105, 0.016, 0.05), C.accent); place(k, `${side}Hand`, new THREE.Vector3(h.x, h.y - 0.1, h.z + 0.025)); attach(k, `${side}Hand`); }
        if (s.wrap) for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(sw * 0.068, 0.006, 6, 14), C.dark); w.rotation.x = Math.PI / 2; const p = fa.clone().lerp(h, 0.5 + i * 0.1); place(w, `${side}ForeArm`, p); attach(w, `${side}ForeArm`); }
        if (C.glowing) {
          const rune = new THREE.Mesh(new THREE.TorusGeometry(sw * 0.07, 0.006, 6, 18), mat(C.accentC, 0.2, 0.3, C.accentC, 1, true)); rune.rotation.x = Math.PI / 2;
          place(rune, `${side}ForeArm`, fa.clone().lerp(h, 0.82)); attach(rune, `${side}ForeArm`); pulse(rune.material, 0.6, 1.0, 2.8);
        }
      }
      break;
    }
    case 'belt': {
      const cx = (lsh.x + rsh.x) / 2, y = hips.y + torsoH * 0.07;
      const h = s.sash ? torsoH * 0.13 : s.plates ? torsoH * 0.1 : torsoH * 0.055;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(sw * 0.232, sw * 0.226, h, 28, 1, true), C.body);
      ring.scale.z = 0.8; ring.material.side = THREE.DoubleSide; place(ring, 'Hips', new THREE.Vector3(cx, y, 0)); attach(ring, 'Hips');
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(sw * (s.plates ? 0.16 : 0.09), h * 1.3, 0.016), C.accent);
      place(buckle, 'Hips', new THREE.Vector3(cx, y, sw * 0.232 * 0.8 + 0.004)); attach(buckle, 'Hips');
      if (s.plates) for (const dx of [-0.17, -0.1, 0.1, 0.17]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.06, h * 1.1, 0.012), C.dark); place(pl, 'Hips', new THREE.Vector3(cx + sw * dx * 1.2, y, sw * 0.232 * 0.8 * Math.cos(dx * 3) + 0.003)); attach(pl, 'Hips'); }
      if (s.pouch) {
        const pivot = new THREE.Group();
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.085, 0.04), C.dark); pouch.position.y = -0.045; pivot.add(pouch);
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.03, 0.045), C.body); flap.position.y = -0.01; pivot.add(flap);
        pivot.position.copy(toLocal('Hips', new THREE.Vector3(cx + sw * 0.19, y - 0.01, sw * 0.12))); pivot.rotation.y = -0.5; attach(pivot, 'Hips');
        rc.anims.push((t) => { const sp = Math.min(speedOf(), 6); pivot.rotation.z = Math.sin(t * (5 + sp)) * (0.05 + sp * 0.06); pivot.rotation.x = Math.cos(t * (4 + sp)) * sp * 0.03; });
      }
      if (s.sash) {
        const tails = [];
        for (const dx of [0.12, 0.2]) {
          const pivot = new THREE.Group();
          const tail = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.07, torsoH * 0.55, 0.008), C.body); tail.position.y = -torsoH * 0.27; pivot.add(tail);
          pivot.position.copy(toLocal('Hips', new THREE.Vector3(cx + sw * dx, y - 0.01, sw * 0.17))); attach(pivot, 'Hips'); tails.push(pivot);
        }
        rc.anims.push((t) => { const sp = Math.min(speedOf(), 6); tails.forEach((p, i) => { p.rotation.x = Math.sin(t * (4 + sp) + i) * (0.06 + sp * 0.05) + sp * 0.07; p.rotation.z = Math.sin(t * 3 + i * 2) * 0.05; }); });
      }
      if (C.glowing && !s.sash) pulse(C.accent, 0.3, 0.6, 2.4);
      break;
    }
    case 'shoulders': {
      const R0 = sw * (s.big ? 0.3 : s.mantle ? 0.27 : 0.25);
      const gems = [];
      for (const side of sides) {
        const sh = side === 'Left' ? lsh : rsh, sgn = side === 'Left' ? 1 : -1;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, Math.PI * (s.mantle ? 0.7 : 0.58)), C.body);
        dome.material.side = THREE.DoubleSide;
        dome.scale.set(R0, R0 * (s.big ? 1.0 : 0.82), R0 * 1.12);
        place(dome, `${side}Arm`, new THREE.Vector3(sh.x + sgn * 0.01, sh.y - 0.012, sh.z)); dome.rotation.z = -sgn * 0.3; attach(dome, `${side}Arm`);
        // rim, trim and an ornament
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 26), C.dark); rim.rotation.x = Math.PI / 2; rim.scale.set(R0 * 0.99, R0 * 1.1, 1);
        rim.position.copy(dome.position).add(new THREE.Vector3(0, -0.01, 0)); rim.rotation.z = dome.rotation.z; attach(rim, `${side}Arm`);
        rim.position.y -= R0 * (s.mantle ? 0.35 : 0.2);
        if (s.spikes) for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.075, 8), C.accent); sp.position.copy(dome.position).add(new THREE.Vector3(sgn * (0.0 - i * 0.012), R0 * 0.62 + 0.02, (i - 1) * 0.045)); sp.rotation.z = -sgn * (0.35 + i * 0.12); attach(sp, `${side}Arm`); }
        if (s.big) for (let i = 0; i < 3; i++) { const lam = new THREE.Mesh(new THREE.CylinderGeometry(R0 * (0.9 - i * 0.07), R0 * (0.82 - i * 0.07), 0.035, 18, 1, true), C.body); lam.material.side = THREE.DoubleSide; lam.position.copy(dome.position).add(new THREE.Vector3(sgn * 0.01 * i, -R0 * 0.28 - i * 0.04, 0)); lam.rotation.z = dome.rotation.z; attach(lam, `${side}Arm`); }
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), mat(C.accentC, 0.2, 0.2, C.accentC, 1.2, true)); gem.position.copy(dome.position).add(new THREE.Vector3(sgn * 0.006, R0 * 0.7, 0.04)); attach(gem, `${side}Arm`); gems.push(gem);
        if (s.mantle) { // a hanging cape-like flap that sways
          const pivot = new THREE.Group(); pivot.position.copy(dome.position).add(new THREE.Vector3(sgn * 0.01, -R0 * 0.05, 0));
          const flap = new THREE.Mesh(new THREE.BoxGeometry(R0 * 1.5, 0.2, 0.012), C.body); flap.position.y = -0.1; flap.position.z = -0.02; pivot.add(flap); attach(pivot, `${side}Arm`); rc.anims.push((t) => { pivot.rotation.x = Math.sin(t * 2.2 + sgn) * 0.05 + Math.min(speedOf(), 5) * 0.05; });
        }
      }
      rc.anims.push((t) => { gems.forEach((g, i) => { g.rotation.y = t * 1.5; g.material.emissiveIntensity = 0.7 + 0.6 * Math.sin(t * 2.6 + i); }); });
      break;
    }
  }
}

// ------------------------------------------------------------------------------------------------ icons
export function gearIcon(l, slot) {
  const C = colorsFor(l), { s } = C;
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const side = (m) => { m.material = m.material.clone(); m.material.side = THREE.DoubleSide; return m; };
  switch (slot) {
    case 'shirt': {
      side(add(new THREE.CylinderGeometry(0.42, 0.36, 0.9, 20, 1, true), C.body)).scale.z = 0.6;
      side(add(new THREE.CylinderGeometry(0.17, 0.15, s.sleeves >= 1 ? 0.8 : 0.4, 12, 1, true), C.body, -0.58, 0.2 - (s.sleeves >= 1 ? 0.12 : 0), 0)).rotation.z = 0.5;
      side(add(new THREE.CylinderGeometry(0.17, 0.15, s.sleeves >= 1 ? 0.8 : 0.4, 12, 1, true), C.body, 0.58, 0.2 - (s.sleeves >= 1 ? 0.12 : 0), 0)).rotation.z = -0.5;
      add(new THREE.TorusGeometry(0.17, 0.035, 8, 18), C.dark, 0, 0.45, 0).rotation.x = Math.PI / 2;
      break;
    }
    case 'pants': {
      add(new THREE.CylinderGeometry(0.5, 0.46, 0.2, 22, 1, true), C.dark, 0, 0.5, 0).material.side = THREE.DoubleSide;
      if (s.skirt) { add(new THREE.CylinderGeometry(0.46, 0.8, 0.9, 24, 1, true), C.body, 0, 0.0, 0).material.side = THREE.DoubleSide; break; }
      add(new THREE.CylinderGeometry(0.24, 0.17, 1.0, 14), C.body, -0.25, -0.1, 0); add(new THREE.CylinderGeometry(0.24, 0.17, 1.0, 14), C.body, 0.25, -0.1, 0);
      if (s.metal) { add(new THREE.SphereGeometry(0.14, 10, 8), C.accent, -0.25, -0.1, 0.1); add(new THREE.SphereGeometry(0.14, 10, 8), C.accent, 0.25, -0.1, 0.1); }
      break;
    }
    case 'boots': {
      const hgt = 0.4 + (s.h || 0.3) * 1.2;
      add(new THREE.CylinderGeometry(0.27, 0.21, hgt, 16), C.body, 0, hgt / 2 - 0.1, 0);
      add(new THREE.TorusGeometry(0.265, 0.035, 8, 20), C.dark, 0, hgt - 0.1, 0).rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.46, 0.22, 0.85), C.body, 0, -0.08, 0.2);
      add(new THREE.SphereGeometry(0.24, 12, 8), s.metal ? C.accent : C.dark, 0, -0.04, 0.58).scale.set(1, 0.6, 1);
      add(new THREE.BoxGeometry(0.47, 0.06, 0.9), C.dark, 0, -0.2, 0.2);
      g.rotation.y = -0.5;
      break;
    }
    case 'gloves': {
      add(new THREE.BoxGeometry(0.62, 0.7, 0.28), C.body, 0, 0, 0);
      for (let i = 0; i < 4; i++) add(new THREE.CapsuleGeometry(0.075, 0.38 - (i === 0 || i === 3 ? 0.08 : 0), 3, 8), s.metal ? C.dark : C.body, -0.23 + i * 0.155, 0.55, 0);
      add(new THREE.CapsuleGeometry(0.085, 0.3, 3, 8), s.metal ? C.dark : C.body, -0.42, 0.05, 0.05).rotation.z = 0.8;
      side(add(new THREE.CylinderGeometry(0.34, 0.3, 0.45, 16, 1, true), C.body, 0, -0.55, 0));
      if (s.metal) add(new THREE.BoxGeometry(0.64, 0.1, 0.3), C.accent, 0, 0.2, 0.02);
      g.rotation.set(0.1, 0.5, 0.2);
      break;
    }
    case 'belt': {
      const r = side(add(new THREE.CylinderGeometry(0.8, 0.8, s.sash ? 0.34 : s.plates ? 0.28 : 0.16, 28, 1, true), C.body)); r.scale.z = 0.7;
      add(new THREE.BoxGeometry(s.plates ? 0.38 : 0.24, s.sash ? 0.3 : 0.26, 0.05), C.accent, 0, 0, 0.58);
      if (s.pouch) add(new THREE.BoxGeometry(0.2, 0.26, 0.12), C.dark, 0.5, -0.2, 0.45);
      if (s.sash) add(new THREE.BoxGeometry(0.16, 0.8, 0.03), C.body, 0.18, -0.55, 0.6);
      g.rotation.x = 0.7;
      break;
    }
    case 'shoulders': {
      for (const sg of [-1, 1]) {
        const d = add(new THREE.SphereGeometry(0.46, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), C.body, sg * 0.5, 0, 0); d.material = d.material.clone(); d.material.side = THREE.DoubleSide; d.rotation.z = -sg * 0.3;
        add(new THREE.TorusGeometry(0.44, 0.04, 8, 22), C.dark, sg * 0.5, -0.12, 0).rotation.x = Math.PI / 2;
        if (s.spikes) for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.05, 0.28, 8), C.accent, sg * (0.5 - i * 0.04), 0.4, (i - 1) * 0.16).rotation.z = -sg * (0.3 + i * 0.12);
        add(new THREE.OctahedronGeometry(0.07), C.accent, sg * 0.5, 0.3, 0.2);
      }
      g.rotation.x = 0.35;
      break;
    }
  }
  return g;
}
