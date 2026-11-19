// Animated water: layered travelling ripples bend the surface normal (so sky and torch reflections wobble),
// with drifting caustic glints. A standard material patched in the shader, so it keeps fog and lighting.
import * as THREE from 'three';

const TIME = { value: 0 };
export function makeWater(deep) {
  const m = new THREE.MeshStandardMaterial({
    color: deep ? 0x143a62 : 0x23587f, roughness: 0.1, metalness: 0.55, transparent: true, opacity: 0.93,
    emissive: deep ? 0x061c36 : 0x08243a, emissiveIntensity: deep ? 0.7 : 0.45,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWT = TIME;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uWT; varying vec3 vWp;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        { vec2 w = vWp.xz; float t = uWT;
          vec2 g = vec2(cos(w.x*1.7 + t*1.3)*0.5 + cos(w.x*3.1 - w.y*2.3 + t*1.9)*0.35 + cos((w.x+w.y)*5.3 + t*2.7)*0.2,
                        cos(w.y*1.9 + t*1.1)*0.5 + cos(w.y*3.4 + w.x*1.7 - t*2.1)*0.35 + cos((w.x-w.y)*4.7 - t*2.4)*0.2);
          normal = normalize(normal + (viewMatrix * vec4(g.x*0.16, 0.0, g.y*0.16, 0.0)).xyz); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec2 w = vWp.xz; float t = uWT;
          float c1 = sin(w.x*5.0 + t*0.9 + sin(w.y*2.0 + t*0.5)*1.5) * sin(w.y*5.5 - t*1.1 + sin(w.x*2.3 - t*0.4)*1.5);
          totalEmissiveRadiance += vec3(0.05, 0.1, 0.13) * pow(max(c1, 0.0), 3.0); }`);
  };
  m.customProgramCacheKey = () => 'hmwater';
  return m;
}
export function tickWater(mesh) { mesh.onBeforeRender = () => { TIME.value = performance.now() / 1000; }; }
