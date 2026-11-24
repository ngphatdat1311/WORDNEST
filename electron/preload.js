const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wordnestDesktop', {
  isDesktop: true,
  platform: process.platform,
  storage: {
    getItemSync: (key) => ipcRenderer.sendSync('wordnest:storage-get-sync', key),
    setItem: (key, value) => ipcRenderer.invoke('wordnest:storage-set', key, value),
    removeItem: (key) => ipcRenderer.invoke('wordnest:storage-remove', key),
  },
  extension: {
    drainPending: () => ipcRenderer.invoke('wordnest:extension-drain'),
    onCapture: (callback) => {
      const handler = (_event, item) => callback(item);
      ipcRenderer.on('wordnest:extension-capture', handler);
      return () => ipcRenderer.removeListener('wordnest:extension-capture', handler);
    },
  },
});
