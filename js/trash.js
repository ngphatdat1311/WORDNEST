// ════════════════════════════════════════════════════════
// TRASH UI — thùng rác chứa từ/thư mục đã xóa, khôi phục được
// (dữ liệu trash[]/loadTrash()/saveTrash() ở storage.js)
// ════════════════════════════════════════════════════════
function genTrashId() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ════════════════════════════════════════════════════════
// TỰ DỌN THÙNG RÁC — entry quá hạn (mặc định 30 ngày, giống TTL của
// lookup-cache.js) coi như user đã chắc chắn không cần khôi phục nữa, xóa
// vĩnh viễn để tránh file dữ liệu phình to vô thời hạn với user dùng lâu năm.
// ════════════════════════════════════════════════════════
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Hàm thuần (không đụng biến toàn cục/DOM) để unit test độc lập việc phán đoán
// hạn — entry thiếu/hỏng deletedAt bị coi như đã rất cũ (expired), nhất quán với
// trashEntryHtml() vốn đã coi entry hỏng dạng đó là chỉ có thể xóa, không khôi phục được.
function isTrashEntryExpired(entry, now, ttlMs = TRASH_TTL_MS) {
  return (entry.deletedAt || 0) < now - ttlMs;
}

// Gọi 1 lần khi mở app (xem app.js) — không cần chạy lại trong phiên vì deletedAt
// không đổi giữa các lần render.
function purgeExpiredTrash() {
  const now = Date.now();
  const kept = trash.filter(t => !isTrashEntryExpired(t, now));
  if (kept.length === trash.length) return;
  const purgedCount = trash.length - kept.length;
  trash = kept;
  if (saveTrash()) showToast(`🗑️ Đã tự dọn ${purgedCount} mục cũ (quá 30 ngày) trong Thùng rác`);
}

function renderTrash() {
  const el = document.getElementById('wl-trash-list');
  const emptyBtn = document.getElementById('wl-trash-empty-btn');
  if (!el) return;
  if (emptyBtn) emptyBtn.style.display = trash.length ? '' : 'none';
  if (!trash.length) {
    el.innerHTML = '<div class="empty-state">🗑️ Thùng rác trống</div>';
    return;
  }
  const sorted = trash.slice().sort((a, b) => b.deletedAt - a.deletedAt);
  el.innerHTML = sorted.map(t => trashEntryHtml(t)).join('');
  el.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', () => {
    const entry = trash.find(x => x.id === btn.dataset.restore);
    if (!entry) return;
    if (entry.type === 'word') restoreTrashWord(entry.id);
    else restoreTrashFolder(entry.id);
  }));
  el.querySelectorAll('[data-purge]').forEach(btn => btn.addEventListener('click', () => deleteTrashEntryConfirm(btn.dataset.purge)));
}

function trashEntryHtml(t) {
  const when = formatAddedAt(t.deletedAt);
  if (t.type === 'word' && t.word && typeof t.word.word === 'string') {
    const w = t.word;
    return `<div class="trash-item">
      <div class="trash-icon">🔤</div>
      <div class="trash-info">
        <div class="trash-name">${escHtml(w.word)}</div>
        <div class="trash-sub">${escHtml(w.meaning || '')} • Đã xóa ${escHtml(when)}</div>
      </div>
      <div class="trash-actions">
        <button class="btn btn-outline" data-restore="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;">↩️ Khôi phục</button>
        <button class="btn btn-outline" data-purge="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;color:var(--red);border-color:var(--red);">🗑️ Xóa vĩnh viễn</button>
      </div>
    </div>`;
  }
  if (t.type === 'folder' && t.folder && typeof t.folder.name === 'string') {
    const wordCount = Array.isArray(t.words) ? t.words.length : 0;
    return `<div class="trash-item">
      <div class="trash-icon">📁</div>
      <div class="trash-info">
        <div class="trash-name">${escHtml(t.folder.name)}</div>
        <div class="trash-sub">${wordCount} từ bên trong • Đã xóa ${escHtml(when)}</div>
      </div>
      <div class="trash-actions">
        <button class="btn btn-outline" data-restore="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;">↩️ Khôi phục</button>
        <button class="btn btn-outline" data-purge="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;color:var(--red);border-color:var(--red);">🗑️ Xóa vĩnh viễn</button>
      </div>
    </div>`;
  }
  // Entry hỏng (vd từ file import không hợp lệ) — vẫn cho xóa vĩnh viễn để dọn
  // đi, không cho "Khôi phục" vì không đủ dữ liệu để khôi phục đúng.
  return `<div class="trash-item">
    <div class="trash-icon">⚠️</div>
    <div class="trash-info">
      <div class="trash-name">Mục dữ liệu bị lỗi</div>
      <div class="trash-sub">Không đọc được nội dung • Đã xóa ${escHtml(when)}</div>
    </div>
    <div class="trash-actions">
      <button class="btn btn-outline" data-purge="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;color:var(--red);border-color:var(--red);">🗑️ Xóa vĩnh viễn</button>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════
// KHÔI PHỤC
// ════════════════════════════════════════════════════════
function restoreTrashWord(trashId) {
  const idx = trash.findIndex(t => t.id === trashId);
  if (idx === -1) return;
  const w = trash[idx].word;
  if (words.find(x => x.word.toLowerCase() === w.word.toLowerCase())) {
    showToast(`⚠️ Đã có từ "${w.word}" trong từ điển — không thể khôi phục trùng!`, 'error');
    return;
  }
  // Thư mục nào trong số đó không còn tồn tại nữa (đã bị xóa/đổ rác riêng từ lúc
  // từ này còn nằm trong Thùng rác) -> tự lọc bỏ, chỉ giữ thư mục còn tồn tại.
  // Snapshot CŨ (bị xóa từ trước khi app hỗ trợ nhiều thư mục) vẫn có thể chỉ
  // mang field folderId đơn thay vì folderIds — tự quy đổi sang mảng ở đây.
  const snapshotFolderIds = Array.isArray(w.folderIds) ? w.folderIds : (w.folderId ? [w.folderId] : []);
  const validFolderIds = snapshotFolderIds.filter(fid => folders.some(f => f.id === fid));
  const restored = { ...w, folderIds: validFolderIds };
  delete restored.folderId;
  const backupWords = words, backupTrash = trash;
  words = [...words, restored];
  trash = trash.filter(t => t.id !== trashId);
  if (!saveWords() || !saveTrash()) { words = backupWords; trash = backupTrash; showToast('⚠️ Không khôi phục được!', 'error'); return; }
  showToast(`✅ Đã khôi phục "${w.word}"${validFolderIds.length ? ' vào thư mục cũ' : ''}!`, 'success');
  refreshWlView();
  renderHome();
}

function restoreTrashFolder(trashId) {
  const idx = trash.findIndex(t => t.id === trashId);
  if (idx === -1) return;
  const entry = trash[idx];
  const f = entry.folder;
  const backupWords = words, backupFolders = folders, backupTrash = trash;
  // Nếu đã có thư mục trùng tên (vd user tạo lại tay trong lúc cái cũ còn trong thùng rác)
  // -> dùng lại thư mục đó, không tạo trùng tên.
  let targetFolder = folders.find(x => x.name.toLowerCase() === f.name.toLowerCase());
  if (!targetFolder) { targetFolder = { ...f }; folders = [...folders, targetFolder]; }
  const toRestore = entry.words.filter(w => !words.find(x => x.word.toLowerCase() === w.word.toLowerCase()));
  const skipped = entry.words.length - toRestore.length;
  // Các từ gộp theo thư mục lúc xóa (bundledWords/soleWords trong deleteFolder)
  // luôn CHỈ thuộc đúng 1 thư mục này tại thời điểm đó — khôi phục lại đúng 1
  // phần tử đó là đủ, không cần đọc lại field cũ của snapshot.
  words = [...words, ...toRestore.map(w => { const r = { ...w, folderIds: [targetFolder.id] }; delete r.folderId; return r; })];
  trash = trash.filter(t => t.id !== trashId);
  if (!saveWords() || !saveFolders() || !saveTrash()) { words = backupWords; folders = backupFolders; trash = backupTrash; showToast('⚠️ Không khôi phục được!', 'error'); return; }
  showToast(`✅ Đã khôi phục thư mục "${f.name}"${toRestore.length ? ' cùng ' + toRestore.length + ' từ' : ''}${skipped ? ', bỏ qua ' + skipped + ' từ trùng' : ''}!`, 'success');
  refreshWlView();
  renderHome();
}

// ════════════════════════════════════════════════════════
// XÓA VĨNH VIỄN
// ════════════════════════════════════════════════════════
function deleteTrashEntryConfirm(trashId) {
  const entry = trash.find(t => t.id === trashId);
  if (!entry) return;
  const name = entry.type === 'word' && entry.word ? entry.word.word
    : entry.type === 'folder' && entry.folder ? entry.folder.name
    : 'mục dữ liệu bị lỗi';
  showConfirmDialog({
    icon: '🗑️',
    title: 'Xóa vĩnh viễn?',
    wordHtml: `${entry.type === 'folder' ? '📁 ' : ''}${escHtml(name)}`,
    subHtml: 'Mục này sẽ biến mất hoàn toàn, không thể khôi phục lại.',
    confirmLabel: 'Xóa vĩnh viễn',
    onConfirm: () => deleteTrashEntry(trashId),
  });
}
function deleteTrashEntry(trashId) {
  const backupTrash = trash;
  trash = trash.filter(t => t.id !== trashId);
  closeConfirm();
  if (!saveTrash()) { trash = backupTrash; showToast('⚠️ Không xóa được!', 'error'); return; }
  showToast('🗑️ Đã xóa vĩnh viễn');
  refreshWlView();
}

function confirmEmptyTrash() {
  if (!trash.length) { showToast('Thùng rác đang trống!'); return; }
  showConfirmDialog({
    icon: '⚠️',
    title: 'Đổ hết thùng rác?',
    wordHtml: `${trash.length} mục`,
    subHtml: 'Toàn bộ từ/thư mục trong thùng rác sẽ biến mất vĩnh viễn, không thể khôi phục.',
    confirmLabel: 'Đổ rác',
    onConfirm: emptyTrash,
  });
}
function emptyTrash() {
  const backupTrash = trash;
  trash = [];
  closeConfirm();
  if (!saveTrash()) { trash = backupTrash; showToast('⚠️ Không đổ rác được!', 'error'); return; }
  showToast('🗑️ Đã đổ hết thùng rác');
  refreshWlView();
}
