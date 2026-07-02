// ════════════════════════════════════════════════════════
// SYNC FOLDER — tự động lưu snapshot vào thư mục do user chọn
// (OneDrive, Google Drive, Dropbox...) sau mỗi lần save
// ════════════════════════════════════════════════════════
const SYNC_FOLDER_KEY  = 'wordnest_sync_folder';
const SYNC_LAST_TS_KEY = 'wordnest_sync_last_ts';
const PRE_SYNC_BACKUP_KEY = 'wordnest_pre_sync_backup';

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

// So sánh thời điểm sync trên file với lần lưu cục bộ cuối — tách riêng khỏi
// checkSyncOnStartup (vốn đụng DOM/IPC) để có thể unit test độc lập.
// Coi localTs hỏng (NaN) như 0, tránh so sánh với NaN (luôn trả về false).
function shouldShowSyncBanner(localTs, syncedAt) {
  const ts = isNaN(localTs) ? 0 : localTs;
  return syncedAt > ts;
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
  if (!shouldShowSyncBanner(localTs, syncData.syncedAt)) return;
  showSyncRestoreBanner(syncData);
}

function showSyncRestoreBanner(syncData) {
  const banner = document.getElementById('sync-restore-banner');
  if (!banner) return;
  const d = new Date(syncData.syncedAt);
  const label = `${d.toLocaleDateString('vi-VN')} lúc ${d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}`;
  const msgEl = document.getElementById('sync-restore-msg');
  if (msgEl) msgEl.innerHTML = `File đồng bộ tại <strong id="sync-restore-time">${escHtml(label)}</strong> có vẻ mới hơn dữ liệu hiện tại. Bạn có muốn khôi phục không?`;
  banner.classList.add('show');
  // Gán handler nút Nhập
  const btn = document.getElementById('sync-restore-btn');
  if (btn) btn.onclick = () => doRestoreFromSync(syncData);
}

// Đóng banner (bấm ✕ hoặc bỏ qua lời mời khôi phục) — luôn đưa banner về
// trạng thái mặc định (nút "Khôi phục" hiện, nút "Hoàn tác" ẩn) để lần hiện
// tiếp theo (dù là lời mời khôi phục mới hay banner "Hoàn tác") không bị lẫn.
function hideSyncRestoreBanner() {
  const banner = document.getElementById('sync-restore-banner');
  if (banner) banner.classList.remove('show');
  const restoreBtn = document.getElementById('sync-restore-btn');
  if (restoreBtn) restoreBtn.style.display = '';
  const undoBtn = document.getElementById('sync-undo-btn');
  if (undoBtn) undoBtn.style.display = 'none';
  storeSet(SYNC_LAST_TS_KEY, String(Date.now())); // đánh dấu đã xử lý
}

// Sau khi khôi phục xong, đổi banner sang "Hoàn tác" trong vài giây — phòng
// trường hợp user bấm nhầm hoặc file đồng bộ hoá ra không đúng như mong đợi.
function showSyncUndoBanner() {
  const banner = document.getElementById('sync-restore-banner');
  if (!banner) return;
  const msgEl = document.getElementById('sync-restore-msg');
  if (msgEl) msgEl.textContent = '✅ Đã khôi phục dữ liệu từ file đồng bộ.';
  const restoreBtn = document.getElementById('sync-restore-btn');
  if (restoreBtn) restoreBtn.style.display = 'none';
  const undoBtn = document.getElementById('sync-undo-btn');
  if (undoBtn) { undoBtn.style.display = ''; undoBtn.onclick = undoSyncRestore; }
  banner.classList.add('show');
}

// Lưu snapshot dữ liệu cục bộ NGAY TRƯỚC KHI bị ghi đè bởi file đồng bộ — nếu
// việc khôi phục hoá ra sai (vd chọn nhầm thư mục đồng bộ của máy khác), user
// vẫn có đường lùi qua nút "Hoàn tác" thay vì mất sạch dữ liệu cục bộ.
function savePreSyncSnapshot() {
  storeSet(PRE_SYNC_BACKUP_KEY, JSON.stringify({ savedAt: Date.now(), words, folders, trash }));
}

function undoSyncRestore() {
  let snap;
  try { snap = JSON.parse(storeGet(PRE_SYNC_BACKUP_KEY) || 'null'); }
  catch { snap = null; }
  if (!snap) { showToast('Không có bản sao lưu để hoàn tác.', 'error'); return; }
  words   = Array.isArray(snap.words) ? snap.words : words;
  folders = Array.isArray(snap.folders) ? snap.folders : folders;
  trash   = Array.isArray(snap.trash) ? snap.trash : trash;
  if (!saveWords() || !saveFolders() || !saveTrash()) {
    showToast('⚠️ Không hoàn tác được — lỗi lưu file!', 'error'); return;
  }
  storeSet(PRE_SYNC_BACKUP_KEY, ''); // dùng 1 lần rồi xoá, tránh hoàn tác nhầm ở lần sau
  hideSyncRestoreBanner();
  refreshWlView(); renderHome();
  showToast('✅ Đã hoàn tác về dữ liệu trước khi đồng bộ.', 'success');
}

function doRestoreFromSync(syncData) {
  if (!syncData?.words) return;
  const imported = Array.isArray(syncData.words) ? syncData.words : [];
  if (!imported.length) { showToast('File đồng bộ không có từ nào!', 'error'); hideSyncRestoreBanner(); return; }
  savePreSyncSnapshot();
  words   = imported;
  folders = Array.isArray(syncData.folders) ? syncData.folders : folders;
  trash   = Array.isArray(syncData.trash)   ? syncData.trash   : trash;
  if (!saveWords() || !saveFolders() || !saveTrash()) {
    showToast('⚠️ Không khôi phục được — lỗi lưu file!', 'error'); return;
  }
  storeSet(SYNC_LAST_TS_KEY, String(Date.now())); // đánh dấu đã xử lý (không gọi hideSyncRestoreBanner để giữ banner cho bước "Hoàn tác")
  refreshWlView(); renderHome();
  showToast('✅ Đã khôi phục ' + words.length + ' từ từ thư mục đồng bộ!', 'success');
  showSyncUndoBanner();
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
