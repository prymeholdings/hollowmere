const { app, BrowserWindow, Menu, protocol, net, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Serve the game from app:// so GLB models can be fetched like on the web.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const ROOT = path.join(__dirname, '..', 'app');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640,
    title: 'Hollowmere: The Sunken Wells',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  Menu.setApplicationMenu(null);
  win.loadURL('app://game/index.html');
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
// Save file: written atomically, previous save kept as a backup
const saveDir = () => app.getPath('userData');
const saveFile = () => path.join(saveDir(), 'savegame.json');
ipcMain.on('hm-save', (e, json) => {
  try {
    fs.mkdirSync(saveDir(), { recursive: true });
    const f = saveFile(), tmp = f + '.tmp';
    fs.writeFileSync(tmp, json);
    if (fs.existsSync(f)) fs.copyFileSync(f, f.replace('.json', '.bak.json'));
    fs.renameSync(tmp, f);
    e.returnValue = true;
  } catch (err) { e.returnValue = false; }
});
ipcMain.on('hm-load', (e) => {
  for (const f of [saveFile(), saveFile().replace('.json', '.bak.json')]) {
    try { const t = fs.readFileSync(f, 'utf8'); JSON.parse(t); e.returnValue = t; return; } catch (err) { /* try next */ }
  }
  e.returnValue = null;
});
ipcMain.on('hm-quit', () => app.quit());

app.whenReady().then(() => {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.pack': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
  protocol.handle('app', async (req) => {
    try {
      const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
      const file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 });
      const buf = await fs.promises.readFile(file);
      const headers = { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes' };
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
      if (m) {
        const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
        return new Response(buf.subarray(a, b + 1), { status: 206, headers: { ...headers, 'content-range': `bytes ${a}-${b}/${buf.length}` } });
      }
      return new Response(buf, { headers });
    } catch (err) { return new Response('Not found', { status: 404 }); }
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
