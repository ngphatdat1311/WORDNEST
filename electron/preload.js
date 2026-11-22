const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wordnestDesktop', {
  isDesktop: true,
  platform: process.platform,
});
