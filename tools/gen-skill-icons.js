// Builds app/assets/icons/skill-icons.json: the SVG bodies (game-icons.net, CC BY 3.0) for every skill icon key.
// Usage: node tools/gen-skill-icons.js <path to @iconify-json/game-icons icons.json>
const fs = require('fs'), path = require('path');
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'skill-icon-map.json'), 'utf8'));
const out = { size: src.width || 512, icons: {} };
for (const [k, [name, color]] of Object.entries(map)) {
  const ic = src.icons[name];
  if (!ic) throw new Error('missing icon ' + name);
  out.icons[k] = { n: name, c: color, b: ic.body };
}
fs.mkdirSync(path.join(__dirname, '../app/assets/icons'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../app/assets/icons/skill-icons.json'), JSON.stringify(out));
console.log(Object.keys(out.icons).length, 'icons', out.size);
