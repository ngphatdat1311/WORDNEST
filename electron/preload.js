const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wordnestDesktop', {
  isDesktop: true,
  platform: process.platform,
  storage: {
    getItemSync: (key) => ipcRenderer.sendSync('wordnest:storage-get-sync', key),
    setItem: (key, value) => ipcRenderer.invoke('wordnest:storage-set', key, value),
    removeItem: (key) => ipcRenderer.invoke('wordnest:storage-remove', key),
  },
});
