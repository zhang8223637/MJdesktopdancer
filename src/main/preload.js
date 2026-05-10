const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mjAPI', {
  quit: () => ipcRenderer.send('app:quit'),

  getConfig: (keys) => ipcRenderer.invoke('config:get', { keys }),
  setConfig: (patch) => ipcRenderer.invoke('config:set', { patch }),
  getDefaults: () => ipcRenderer.invoke('config:defaults'),

  listAvatars: () => ipcRenderer.invoke('avatar:list'),

  resetPosition: () => ipcRenderer.send('window:resetPosition'),

  openSettings: () => ipcRenderer.send('settings:open'),

  onConfigChanged: (handler) => {
    ipcRenderer.removeAllListeners('config:changed');
    ipcRenderer.on('config:changed', (_evt, payload) => handler(payload));
  }
});

