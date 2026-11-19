// Bridges the game to a save file on disk (in the user's app data folder).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hm', {
  saveFile: (json) => ipcRenderer.sendSync('hm-save', json),
  loadFile: () => ipcRenderer.sendSync('hm-load'),
  quit: () => ipcRenderer.send('hm-quit'),
});
