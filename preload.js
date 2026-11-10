const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  setSettings: patch => ipcRenderer.invoke('set-settings', patch),
  buy: (slot, id) => ipcRenderer.invoke('buy', { slot, id }),
  sell: uids => ipcRenderer.invoke('sell', uids),
  equip: (slot, id) => ipcRenderer.invoke('equip', { slot, id }),
  setLocation: id => ipcRenderer.invoke('set-location', id),
  cast: () => ipcRenderer.send('cast'),
  caught: fish => ipcRenderer.send('caught', fish),
  openPanel: () => ipcRenderer.send('open-panel'),
  quit: () => ipcRenderer.send('quit'),
  onRod: cb => ipcRenderer.on('rod', (_e, action) => cb(action)),
  onState: cb => ipcRenderer.on('state', (_e, data) => cb(data)),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateReady: cb => ipcRenderer.on('update-ready', (_e, version) => cb(version)),
  onKeyTest: cb => ipcRenderer.on('key-test', () => cb()),
});
