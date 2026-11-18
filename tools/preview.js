import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(900, 500); document.body.appendChild(r.domElement);
const s = new THREE.Scene(); s.background = new THREE.Color(0x445566);
s.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); s.add(d);
const cam = new THREE.PerspectiveCamera(35, 900 / 500, 0.1, 100); cam.position.set(0, 3, 12); cam.lookAt(0, 1, 0);
const names = (new URLSearchParams(location.search).get('m') || 'Knight').split(',');
const out = [];
let x = -(names.length - 1) * 1.3;
Promise.all(names.map((n) => new GLTFLoader().loadAsync(`assets/chars/${n}.glb`))).then((gs) => {
  gs.forEach((g, i) => {
    g.scene.position.x = x + i * 2.6; s.add(g.scene);
    const info = [];
    g.scene.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) info.push(`${o.name}${o.isSkinnedMesh ? '[S]' : ''}<${o.parent.name}>`); });
    out.push(names[i] + ': ' + info.join(', '));
  });
  r.render(s, cam);
  window.__info = out.join('\n');
});
