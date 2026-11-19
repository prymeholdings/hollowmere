// 3D health / mana globes: a glass sphere with swirling, sloshing liquid, rising bubbles and a meniscus.
// Rendered with a small raw WebGL fragment shader per globe (ray-traced sphere, no geometry).
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
varying vec2 uv;
uniform float t, level, slosh, pulse, hurt;
uniform vec3 cA, cB, cC;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 3.1; a *= 0.5; } return s; }
void main(){
  vec2 q = uv * 1.04;
  float r2 = dot(q, q);
  if (r2 > 1.0) { gl_FragColor = vec4(0.0); return; }
  float z = sqrt(1.0 - r2);
  vec3 N = vec3(q, z);
  // liquid surface height with sloshing waves
  float surf = (level * 2.0 - 1.0) + sin(q.x * 3.2 + t * 2.1) * 0.035 * (0.4 + slosh) + sin(q.x * 7.0 - t * 3.3) * 0.015 + q.x * slosh * 0.12;
  vec3 col;
  float inside = step(q.y, surf);
  // refracted coordinates for the swirl inside the glass
  vec2 rq = q * (1.0 - 0.25 * z);
  float sw = fbm(rq * 2.6 + vec2(t * 0.15, -t * 0.35)) + 0.5 * fbm(rq * 5.0 - vec2(t * 0.4, t * 0.2));
  vec3 liquid = mix(cB, cA, smoothstep(0.35, 1.2, sw + z * 0.35));
  liquid = mix(liquid, cC, smoothstep(0.9, 1.6, sw * 1.3) * 0.6);
  // depth darkening towards the bottom and the rim
  liquid *= 0.45 + 0.75 * z;
  liquid *= 0.75 + 0.25 * smoothstep(-1.0, surf, q.y);
  // bubbles
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float bx = (h(vec2(fi, 1.3)) - 0.5) * 1.5;
    float sp = 0.15 + h(vec2(fi, 4.1)) * 0.25;
    float by = -1.0 + mod(t * sp + h(vec2(fi, 7.7)) * 3.0, 2.2);
    float br = 0.018 + h(vec2(fi, 9.2)) * 0.03;
    float d = length(q - vec2(bx + sin(t * 2.0 + fi) * 0.03, by));
    if (by < surf) liquid += vec3(0.9, 0.9, 1.0) * (smoothstep(br, br * 0.6, d) - smoothstep(br * 0.6, br * 0.2, d) * 0.6) * 0.5;
  }
  // meniscus glow line
  float men = smoothstep(0.035, 0.0, abs(q.y - surf));
  vec3 empty = vec3(0.03, 0.025, 0.035) + cB * 0.08 * (1.0 - z);
  col = mix(empty, liquid, inside) + cA * men * 0.9 * step(0.001, level);
  // low-life pulse and hurt flash
  col += cA * pulse * 0.25 * inside + vec3(1.0, 0.2, 0.15) * hurt * 0.35;
  // glass: fresnel rim, two specular highlights, environment band
  vec3 L1 = normalize(vec3(-0.5, 0.65, 0.6)), L2 = normalize(vec3(0.6, -0.4, 0.7));
  float fres = pow(1.0 - z, 3.0);
  col += vec3(0.55, 0.6, 0.7) * fres * 0.55;
  col += vec3(1.0) * pow(max(dot(reflect(-L1, N), vec3(0, 0, 1)), 0.0), 60.0) * 1.2;
  col += vec3(1.0) * pow(max(dot(reflect(-L2, N), vec3(0, 0, 1)), 0.0), 24.0) * 0.25;
  float band = smoothstep(0.06, 0.0, abs(length(q - vec2(-0.15, 0.2)) - 0.62)) * step(q.y, 0.5) * step(-0.2, q.y) * step(q.x, 0.0);
  col += vec3(0.8, 0.85, 1.0) * band * 0.18;
  // inner shadow at the very edge
  col *= smoothstep(1.0, 0.9, sqrt(r2)) * 0.35 + 0.65;
  float a = smoothstep(1.0, 0.985, sqrt(r2));
  gl_FragColor = vec4(col, a);
}`;

export class Orb3D {
  constructor(canvas, colors) {
    this.c = canvas;
    this.colors = colors.map((h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]);
    this.level = 1; this.shown = 1; this.vel = 0; this.slosh = 0; this.hurt = 0; this.pulse = 0;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: true });
    this.gl = gl;
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(pr)); this.gl = null; return; }
    gl.useProgram(pr);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const k of ['t', 'level', 'slosh', 'pulse', 'hurt', 'cA', 'cB', 'cC']) this.u[k] = gl.getUniformLocation(pr, k);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  set(f) {
    f = Math.max(0, Math.min(1, f));
    if (f < this.level - 0.02) this.hurt = Math.min(1, this.hurt + (this.level - f) * 4);
    if (Math.abs(f - this.level) > 0.004) this.slosh = Math.min(1.2, this.slosh + Math.abs(f - this.level) * 6);
    this.level = f;
  }
  draw(dt, now) {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.c.clientWidth * dpr), h = Math.round(this.c.clientHeight * dpr);
    if (!w || !h) return;
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; gl.viewport(0, 0, w, h); }
    // spring the shown level towards the real one so the liquid sloshes
    this.vel += (this.level - this.shown) * 60 * dt; this.vel *= Math.exp(-9 * dt); this.shown += this.vel * dt;
    this.slosh *= Math.exp(-1.6 * dt); this.hurt *= Math.exp(-5 * dt);
    this.pulse = this.level < 0.3 ? 0.5 + 0.5 * Math.sin(now * 0.008) : 0;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.u.t, now / 1000); gl.uniform1f(this.u.level, Math.max(0, Math.min(1, this.shown)));
    gl.uniform1f(this.u.slosh, this.slosh); gl.uniform1f(this.u.pulse, this.pulse); gl.uniform1f(this.u.hurt, this.hurt);
    gl.uniform3fv(this.u.cA, this.colors[0]); gl.uniform3fv(this.u.cB, this.colors[1]); gl.uniform3fv(this.u.cC, this.colors[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
