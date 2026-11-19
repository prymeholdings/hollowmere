#!/bin/bash
# Builds the mobile/web copy into ../hollowmere-web: models gzipped+base64 as .txt, no CSP meta.
set -e
cd "$(dirname "$0")/.."
npm run dev >/dev/null
OUT=../hollowmere-web
rm -rf "$OUT"; mkdir -p "$OUT/assets"
cp app/style.css app/game.js "$OUT/"
cp app/assets/*.txt "$OUT/assets/"
sed -e '/Content-Security-Policy/d' -e 's/, viewport-fit=cover//' \
    -e 's#<title>.*</title>#<title>Hollowmere: The Sunken Wells (Mobile)</title>#' \
    -e 's#<script src="game.js">#<script>window.HM_PACKED = true;</script>\n<script src="game.js">#' app/index.html > "$OUT/index.html"
for f in app/assets/*/*.glb; do
  rel=${f#app/}; d="$OUT/$(dirname "$rel")"; mkdir -p "$d"
  gzip -9c "$f" | base64 -w0 > "$d/$(basename "${f%.glb}").txt"
done
du -sh "$OUT"; find "$OUT" -type f | wc -l
