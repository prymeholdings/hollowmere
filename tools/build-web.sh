#!/bin/bash
# Builds the phone/web copy into ../hollowmere-web (or $1): an installable web app (manifest, offline
# service worker, icons). Models ship gzipped + base64 as .txt (some hosts only serve text files).
set -e
cd "$(dirname "$0")/.."
npm run dev >/dev/null
OUT=${1:-../hollowmere-web}
rm -rf "$OUT"; mkdir -p "$OUT/assets"
cp app/style.css app/game.js "$OUT/"
cp app/assets/*.txt "$OUT/assets/"
cp web/manifest.webmanifest web/icon-192.png web/icon-512.png web/vercel.json "$OUT/"
python3 - app/index.html "$OUT/index.html" <<'PY'
import sys, re
s = open(sys.argv[1]).read()
s = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n?', '', s).replace(', viewport-fit=cover', '')
s = re.sub(r'<title>.*?</title>', '<title>Hollowmere: The Sunken Wells</title>\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#120e0b">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-192.png">', s)
s = s.replace('<script src="game.js">', '<script>window.HM_PACKED = true; if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {})); if ("serviceWorker" in navigator) { let r = false; const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener("controllerchange", () => { if (!r && had && (!window.game || window.game.menuMode)) { r = true; location.reload(); } }); }</script>\n<script src="game.js">')
open(sys.argv[2], 'w').write(s)
PY
for f in app/assets/*/*.glb; do
  rel=${f#app/}; d="$OUT/$(dirname "$rel")"; mkdir -p "$d"
  gzip -9nc "$f" | base64 -w0 > "$d/$(basename "${f%.glb}").txt"
done
mkdir -p "$OUT/assets/ara" "$OUT/assets/music"
cp -r app/assets/ara/. "$OUT/assets/ara/"
cp -r app/assets/music/. "$OUT/assets/music/"
cp app/assets/CREDITS.txt "$OUT/assets/" 2>/dev/null || true
VER=$(cat "$OUT/game.js" "$OUT/style.css" "$OUT/index.html" | sha1sum | cut -c1-10)
FILES=$(cd "$OUT" && { echo ./; find . -type f ! -name vercel.json ! -name sw.js ! -path './assets/ara/*' ! -path './assets/music/*' | sed 's#^\./##' | sort; } | python3 -c "import sys,json;print(json.dumps([l.strip() for l in sys.stdin]))")
sed -e "s|__VERSION__|$VER|" -e "s|__FILES__|$FILES|" web/sw.template.js > "$OUT/sw.js"
du -sh "$OUT"; find "$OUT" -type f | wc -l
