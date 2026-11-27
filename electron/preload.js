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
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('wordnest:check-updates'),
    getVersion: () => ipcRenderer.invoke('wordnest:get-version'),
  },
  vault: {
    getStatus: () => ipcRenderer.invoke('wordnest:vault-status'),
    pickDir: () => ipcRenderer.invoke('wordnest:vault-pick-dir'),
    setup: (opts) => ipcRenderer.invoke('wordnest:vault-setup', opts),
    backupNow: (rawJson) => ipcRenderer.invoke('wordnest:vault-backup-now', rawJson),
    unlock: (password, action) => ipcRenderer.invoke('wordnest:vault-unlock', password, action),
    relock: () => ipcRenderer.invoke('wordnest:vault-relock'),
    restore: (password, useLatest) => ipcRenderer.invoke('wordnest:vault-restore', password, useLatest),
    openFolder: () => ipcRenderer.invoke('wordnest:vault-open-folder'),
  },
});
