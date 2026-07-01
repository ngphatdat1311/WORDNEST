// ════════════════════════════════════════════════════════
// SYNC FOLDER — tự động lưu snapshot vào thư mục do user chọn
// (OneDrive, Google Drive, Dropbox...) sau mỗi lần save
// ════════════════════════════════════════════════════════
const SYNC_FOLDER_KEY  = 'wordnest_sync_folder';
const SYNC_LAST_TS_KEY = 'wordnest_sync_last_ts';

function getSyncFolder()  { return storeGet(SYNC_FOLDER_KEY) || ''; }
function setSyncFolder(p) { storeSet(SYNC_FOLDER_KEY, p || ''); }

// Ghi snapshot toàn bộ data ra file trong thư mục đồng bộ
function autoSyncWrite() {
  if (!window.electronAPI?.syncWrite) return;
  const folder = getSyncFolder();
  if (!folder) return;
  const payload = JSON.stringify({
    version: 1,
    syncedAt: Date.now(),
    words, folders, trash
  });
  const ok = window.electronAPI.syncWrite(folder, payload);
  if (ok) storeSet(SYNC_LAST_TS_KEY, String(Date.now()));
}

// Kiểm tra khi khởi động: nếu file đồng bộ mới hơn data cục bộ → hiện banner
function checkSyncOnStartup() {
  if (!window.electronAPI?.syncCheck) return;
  const folder = getSyncFolder();
  if (!folder) return;
  const raw = window.electronAPI.syncCheck(folder);
  if (!raw) return;
  let syncData;
  try { syncData = JSON.parse(raw); } catch { return; }
  if (!syncData?.syncedAt) return;
  const localTs = parseInt(storeGet(SYNC_LAST_TS_KEY) || '0', 10);
  // Chỉ hiện nếu file đồng bộ mới hơn lần lưu cục bộ cuối
  if (syncData.syncedAt <= localTs) return;
  showSyncRestoreBanner(syncData);
}

function showSyncRestoreBanner(syncData) {
  const banner = document.getElementById('sync-restore-banner');
  if (!banner) return;
  const d = new Date(syncData.syncedAt);
  const label = `${d.toLocaleDateString('vi-VN')} lúc ${d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}`;
  const el = document.getElementById('sync-restore-time');
  if (el) el.textContent = label;
  banner.classList.add('show');
  // Gán handler nút Nhập
  const btn = document.getElementById('sync-restore-btn');
  if (btn) btn.onclick = () => doRestoreFromSync(syncData);
}

function hideSyncRestoreBanner() {
  const banner = document.getElementById('sync-restore-banner');
  if (banner) banner.classList.remove('show');
  storeSet(SYNC_LAST_TS_KEY, String(Date.now())); // đánh dấu đã xử lý
}

function doRestoreFromSync(syncData) {
  if (!syncData?.words) return;
  const imported = Array.isArray(syncData.words) ? syncData.words : [];
  if (!imported.length) { showToast('File đồng bộ không có từ nào!', 'error'); hideSyncRestoreBanner(); return; }
  words   = imported;
  folders = Array.isArray(syncData.folders) ? syncData.folders : folders;
  trash   = Array.isArray(syncData.trash)   ? syncData.trash   : trash;
  if (!saveWords() || !saveFolders() || !saveTrash()) {
    showToast('⚠️ Không khôi phục được — lỗi lưu file!', 'error'); return;
  }
  hideSyncRestoreBanner(); // sets SYNC_LAST_TS_KEY = Date.now()
  refreshWlView(); renderHome();
  showToast('✅ Đã khôi phục ' + words.length + ' từ từ thư mục đồng bộ!', 'success');
}

// Mở dialog chọn thư mục đồng bộ
async function pickSyncFolder() {
  if (!window.electronAPI?.pickSyncFolder) {
    showToast('Tính năng này chỉ khả dụng trong ứng dụng desktop!', 'error'); return;
  }
  const folder = await window.electronAPI.pickSyncFolder();
  if (!folder) return;
  setSyncFolder(folder);
  showToast('✅ Đã chọn thư mục đồng bộ!', 'success');
  autoSyncWrite(); // ghi ngay lần đầu
  renderSyncStatus();
}

function disableSync() {
  setSyncFolder('');
  showToast('Đã tắt đồng bộ tự động.', '');
  renderSyncStatus();
}

function renderSyncStatus() {
  const el = document.getElementById('sync-folder-path');
  if (!el) return;
  const folder = getSyncFolder();
  el.textContent = folder || 'Chưa chọn thư mục';
  const disableBtn = document.getElementById('sync-disable-btn');
  if (disableBtn) disableBtn.style.display = folder ? 'inline-flex' : 'none';
}

function initSync() {
  migrateKeyIfNeeded(SYNC_FOLDER_KEY);
  migrateKeyIfNeeded(SYNC_LAST_TS_KEY);
  renderSyncStatus();
  checkSyncOnStartup();
}
