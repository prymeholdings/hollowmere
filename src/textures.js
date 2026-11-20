import * as THREE from 'three';
// Procedural textures generated at runtime (original, no image files needed).

const cache = {};
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }

// Convert a grayscale height canvas into a tangent-space normal map
function heightToNormal(src, strength = 2) {
  const n = src.width;
  const sd = src.getContext('2d').getImageData(0, 0, n, n).data;
  const out = canvas(n);
  const g = out.getContext('2d');
  const img = g.createImageData(n, n);
  const h = (x, y) => sd[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
    const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * n + x) * 4;
    img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}

function tex(c, srgb, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

// Tiling grass/soil detail: grayscale albedo modulation + normal map
export function groundDetail() {
  if (cache.ground) return cache.ground;
  const N = 512;
  const hc = canvas(N), g = hc.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  const wrapDraw = (fn) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); };
  // soft lumps
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * N, y = Math.random() * N, r = 6 + Math.random() * 26, v = 100 + Math.random() * 60;
    wrapDraw((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); });
  }
  // blades
  g.lineCap = 'round';
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * N, y = Math.random() * N, len = 3 + Math.random() * 7, a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const v = 70 + Math.random() * 130;
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 0.8 + Math.random() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  // pebbles
  for (let i = 0; i < 500; i++) { const x = Math.random() * N, y = Math.random() * N, r = 0.8 + Math.random() * 2; const v = 150 + Math.random() * 80; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, r * 1.3, r, Math.random() * 3, 0, 7); g.fill(); }
  const normal = tex(heightToNormal(hc, 3.5), false);
  const albedo = tex(hc, false);
  cache.ground = { albedo, normal };
  return cache.ground;
}

// Patch a standard material so a tiling grayscale detail texture modulates its color
export function addDetail(mat, detailTex, repeat, strength = 0.55) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detailTex };
    sh.uniforms.detailRepeat = { value: repeat };
    sh.uniforms.detailStrength = { value: strength };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDetailUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvDetailUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D detailMap; uniform float detailRepeat; uniform float detailStrength; varying vec2 vDetailUv;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat dt = texture2D(detailMap, vDetailUv * detailRepeat).r;\ndiffuseColor.rgb *= mix(1.0, dt * 2.0, detailStrength);');
  };
  mat.customProgramCacheKey = () => 'detail' + repeat;
  return mat;
}

// Alpha-tested grass blade card texture
function grassCard() {
  if (cache.card) return cache.card;
  const c = canvas(128), g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 10 + Math.random() * 108, h = 50 + Math.random() * 75, bend = (Math.random() - 0.5) * 30;
    const gr = g.createLinearGradient(0, 128, 0, 128 - h);
    gr.addColorStop(0, '#4f7a2c'); gr.addColorStop(0.55, '#76a63a'); gr.addColorStop(1, '#b8d870');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - 3, 128); g.quadraticCurveTo(x + bend * 0.5, 128 - h * 0.6, x + bend, 128 - h); g.quadraticCurveTo(x + bend * 0.5 + 1, 128 - h * 0.6, x + 3, 128); g.fill();
  }
  cache.card = tex(c, true);
  cache.card.wrapS = cache.card.wrapT = THREE.ClampToEdgeWrapping;
  return cache.card;
}

// Wind-swayed instanced grass tufts. isGrass(x,z) decides placement.
export function grassField(count, area, isGrass, timeRef) {
  const geo = new THREE.BufferGeometry();
  // two crossed quads
  const P = [], U = [], I = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = k * 4;
    P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    U.push(0, 0, 1, 0, 1, 1, 0, 1);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(I);
  const mat = new THREE.MeshStandardMaterial({ map: grassCard(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeRef;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.8 + wp.x * 0.35 + wp.z * 0.25) * 0.18 + sin(uTime * 3.1 + wp.x) * 0.05;
        transformed.x += sway * position.y;
        transformed.z += sway * 0.5 * position.y;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0;
  for (let tries = 0; tries < count * 4 && n < count; tries++) {
    const x = area.x0 + Math.random() * (area.x1 - area.x0), z = area.z0 + Math.random() * (area.z1 - area.z0);
    if (!isGrass(x, z)) continue;
    const sc = 0.32 + Math.random() * 0.4;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    m4.compose(p.set(x, 0, z), q, s.set(sc * 1.6, sc, sc * 1.6));
    im.setMatrixAt(n, m4);
    im.setColorAt(n, col.setHSL(0.2 + Math.random() * 0.08, 0.25, 0.78 + Math.random() * 0.2));
    n++;
  }
  im.count = n;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.receiveShadow = true;
  return im;
}

// Little wildflowers
export function flowers(count, area, isGrass) {
  const geo = new THREE.IcosahedronGeometry(0.09, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x111111 });
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4();
  const cols = [0xffffff, 0xffe14d, 0xff6fa8, 0x9a7cff, 0xff8a3a];
  let n = 0;
  for (let t = 0; t < count * 5 && n < count; t++) {
    const x = area.x0 + Math.random() * (area.x1 - area.x0), z = area.z0 + Math.random() * (area.z1 - area.z0);
    if (!isGrass(x, z)) continue;
    m4.makeTranslation(x, 0.12 + Math.random() * 0.1, z);
    im.setMatrixAt(n, m4);
    im.setColorAt(n, new THREE.Color(cols[(Math.random() * cols.length) | 0]));
    n++;
  }
  im.count = n;
  return im;
}

// Dungeon floor grime: dark blotches, moss and cracks, drawn over the whole map (multiply)
export function grimeTexture(wPx, cellPx, isFloor, w, h, mossTint) {
  const c = canvas(wPx), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, wPx, wPx);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * wPx, y = Math.random() * wPx;
    const cx = Math.floor(x / cellPx), cy = Math.floor(y / cellPx);
    if (!isFloor(cx, cy)) continue;
    const r = 4 + Math.random() * 22;
    const dark = Math.random() < 0.6;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c0 = dark ? `rgba(40,34,28,${0.15 + Math.random() * 0.2})` : mossTint;
    gr.addColorStop(0, c0); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // wall-edge darkening (ambient occlusion along walls)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!isFloor(x, y)) continue;
    const px = x * cellPx, py = y * cellPx, e = cellPx * 0.45;
    const edge = (dx, dy, gx0, gy0, gx1, gy1, rx, ry, rw, rh) => {
      if (isFloor(x + dx, y + dy)) return;
      const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
      gr.addColorStop(0, 'rgba(20,16,12,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    edge(-1, 0, px - cellPx / 2, 0, px - cellPx / 2 + e, 0, px - cellPx / 2, py - cellPx / 2, e, cellPx);
    edge(1, 0, px + cellPx / 2, 0, px + cellPx / 2 - e, 0, px + cellPx / 2 - e, py - cellPx / 2, e, cellPx);
    edge(0, -1, 0, py - cellPx / 2, 0, py - cellPx / 2 + e, px - cellPx / 2, py - cellPx / 2, cellPx, e);
    edge(0, 1, 0, py + cellPx / 2, 0, py + cellPx / 2 - e, px - cellPx / 2, py + cellPx / 2 - e, cellPx, e);
  }
  // cracks
  g.strokeStyle = 'rgba(30,26,22,0.45)'; g.lineWidth = 0.8;
  for (let i = 0; i < 220; i++) {
    let x = Math.random() * wPx, y = Math.random() * wPx;
    if (!isFloor(Math.floor(x / cellPx), Math.floor(y / cellPx))) continue;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 6; y += (Math.random() - 0.5) * 6; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// World-space weathering for buildings and props: layered stone/plaster noise, damp grime near the ground,
// streaks under the eaves. Palette-atlas models have flat UVs, so this works from world position instead.
const WEATHER = new WeakMap();
export function weatherMaterial(src, strength = 1) {
  let m = WEATHER.get(src);
  if (m) return m;
  m = src.clone();
  m.roughness = Math.min(1, (src.roughness ?? 0.8) * 0.2 + 0.82);
  m.metalness = 0;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.wStr = { value: strength };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wp4 = modelMatrix * vec4(position, 1.0); vWp = wp4.xyz; vWn = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float wStr; varying vec3 vWp; varying vec3 vWn;
float wh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wh(i), wh(i + vec3(1,0,0)), f.x), mix(wh(i + vec3(0,1,0)), wh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wh(i + vec3(0,0,1)), wh(i + vec3(1,0,1)), f.x), mix(wh(i + vec3(0,1,1)), wh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 q = vWp; float n1 = wn(q * 2.2), n2 = wn(q * 7.0), n3 = wn(q * 19.0);
  float stone = n1 * 0.5 + n2 * 0.33 + n3 * 0.17;
  float ground = 1.0 - smoothstep(0.0, 1.6, vWp.y);
  float side = 1.0 - abs(vWn.y);
  float streak = wn(vec3(q.x * 5.0 + q.z * 5.0, q.y * 0.6, 0.0)) * smoothstep(0.0, 3.0, vWp.y) * side;
  float tone = 0.72 + stone * 0.62;
  tone *= 1.0 - ground * side * 0.38 * (0.6 + n2);
  tone *= 1.0 - streak * 0.18;
  diffuseColor.rgb *= mix(1.0, tone, 0.9 * wStr);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.86, 0.7), ground * side * 0.35 * n1); }`);
  };
  m.customProgramCacheKey = () => 'weather';
  WEATHER.set(src, m);
  return m;
}
export function weatherize(root, strength = 1) {
  root.traverse((o) => { if (o.isMesh && o.material && !o.material.isShaderMaterial && !o.material.transparent) o.material = Array.isArray(o.material) ? o.material.map((x) => weatherMaterial(x, strength)) : weatherMaterial(o.material, strength); });
}
