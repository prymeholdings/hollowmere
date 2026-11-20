// Pack a .gltf with external .bin/.png into one self-contained .glb (no dependencies).
// usage: node tools/pack-gltf.js in.gltf out.glb
const fs = require('fs'), path = require('path');
const [inp, out] = process.argv.slice(2);
const dir = path.dirname(inp);
const j = JSON.parse(fs.readFileSync(inp, 'utf8'));
const chunks = []; let off = 0;
const push = (buf) => { const start = off; chunks.push(buf); off += buf.length; const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } return start; };
// one buffer: existing buffer(s) first, then images as bufferViews
const bufStarts = j.buffers.map((b) => push(fs.readFileSync(path.join(dir, decodeURIComponent(b.uri)))));
for (const bv of j.bufferViews) { bv.byteOffset = (bv.byteOffset || 0) + bufStarts[bv.buffer]; bv.buffer = 0; }
for (const im of j.images || []) {
  if (!im.uri) continue;
  const data = fs.readFileSync(path.join(dir, decodeURIComponent(im.uri)));
  const s = push(data);
  j.bufferViews.push({ buffer: 0, byteOffset: s, byteLength: data.length });
  im.bufferView = j.bufferViews.length - 1; im.mimeType = im.mimeType || 'image/png'; delete im.uri;
}
const bin = Buffer.concat(chunks);
j.buffers = [{ byteLength: bin.length }];
let js = Buffer.from(JSON.stringify(j)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.writeFileSync(out, Buffer.concat([hdr, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]));
