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
  // Tatoeba có hàng chục câu ví dụ thật cho mỗi từ (so với 1-3 câu cố định của
  // dictionaryapi.dev) — dùng để "Đổi ví dụ khác" có nhiều lựa chọn, không lặp lại.
  fetchTatoebaExamples: (word) => ipcRenderer.invoke('fetch-tatoeba-examples', word),
  fetchPhoneticFallback: (word) => ipcRenderer.invoke('fetch-phonetic-fallback', word),
  // File-based store (thay localStorage)
  storeRead:  (key)       => ipcRenderer.sendSync('store-read', key),
  storeWrite: (key, val)  => ipcRenderer.sendSync('store-write', key, val),
  // Sync folder
  pickSyncFolder: ()                  => ipcRenderer.invoke('pick-sync-folder'),
  syncWrite:      (folder, data)      => ipcRenderer.sendSync('sync-write', folder, data),
  syncCheck:      (folder)            => ipcRenderer.sendSync('sync-check', folder),
});
