const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tilebrow', {
  onShortcut: (cb) => ipcRenderer.on('shortcut', (_event, action) => cb(action)),
});
