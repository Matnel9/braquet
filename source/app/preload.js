const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('braquetAPI', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: data => ipcRenderer.invoke('store:save', data),
  list: pid => ipcRenderer.invoke('lib:list', pid),
  read: (pid, name) => ipcRenderer.invoke('lib:read', pid, name),
  add: (pid, name, bytes) => ipcRenderer.invoke('lib:add', pid, name, bytes),
  remove: (pid, name) => ipcRenderer.invoke('lib:remove', pid, name),
  pick: pid => ipcRenderer.invoke('lib:pick', pid),
  removeProfile: pid => ipcRenderer.invoke('profile:remove', pid),
  startDevice: () => ipcRenderer.invoke('device:start'),
  importDevice: pid => ipcRenderer.invoke('device:import', pid),
  onDevice: cb => { ipcRenderer.on('device', (e, d) => cb(d)); },
  wx: q => ipcRenderer.invoke('wx', q),
  geo: (lat, lon) => ipcRenderer.invoke('geo', lat, lon),
  zoom: f => ipcRenderer.invoke('zoom', f),
  openData: () => ipcRenderer.invoke('openData'),
  version: () => ipcRenderer.invoke('version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: cb => { ipcRenderer.on('update', (e, d) => cb(d)); },
  onUpdateProgress: cb => { ipcRenderer.on('update-progress', (e, k) => cb(k)); }
});
