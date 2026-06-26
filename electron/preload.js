const { contextBridge, ipcRenderer } = require('electron');

// Lộ ra đúng 1 việc cho renderer: nhận sự kiện "có từ mới được tiện ích Chrome
// gửi tới". contextIsolation đang bật nên renderer không có quyền Node trực
// tiếp — đây là cách an toàn duy nhất để main process nói chuyện với trang.
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  onCaptureWord: (callback) => {
    ipcRenderer.on('capture-word', (_event, data) => callback(data));
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
