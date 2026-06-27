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
  // Luồng cập nhật: 'update-available' (có bản mới, chưa tải gì) -> người dùng
  // bấm nút trong app gọi downloadUpdate() -> 'update-downloaded' nghĩa là main
  // process đã tự khởi động lại để cài, không cần renderer làm gì thêm.
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', () => callback());
  },
  downloadUpdate: () => ipcRenderer.send('download-update'),
});
