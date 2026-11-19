const { app, BrowserWindow, Menu, protocol, net, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Serve the game from app:// so GLB models can be fetched like on the web.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
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
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
