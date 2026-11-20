// Bridges the game to a save file on disk (in the user's app data folder).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hm', {
  saveFile: (json) => ipcRenderer.sendSync('hm-save', json),
  loadFile: () => ipcRenderer.sendSync('hm-load'),
  slotSave: (id, json) => ipcRenderer.sendSync('hm-slot-save', id, json),
  slotLoad: (id) => ipcRenderer.sendSync('hm-slot-load', id),
  slotList: () => ipcRenderer.sendSync('hm-slot-list'),
  slotDel: (id) => ipcRenderer.sendSync('hm-slot-del', id),
  quit: () => ipcRenderer.send('hm-quit'),
});
