// ════════════════════════════════════════════════════════
// TRASH UI — thùng rác chứa từ/thư mục đã xóa, khôi phục được
// (dữ liệu trash[]/loadTrash()/saveTrash() ở storage.js)
// ════════════════════════════════════════════════════════
function genTrashId() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
  if (t.type === 'word') {
    const w = t.word;
    return `<div class="trash-item">
      <div class="trash-icon">🔤</div>
      <div class="trash-info">
        <div class="trash-name">${escHtml(w.word)}</div>
        <div class="trash-sub">${escHtml(w.meaning)} • Đã xóa ${escHtml(when)}</div>
      </div>
      <div class="trash-actions">
        <button class="btn btn-outline" data-restore="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;">↩️ Khôi phục</button>
        <button class="btn btn-outline" data-purge="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;color:var(--red);border-color:var(--red);">🗑️ Xóa vĩnh viễn</button>
      </div>
    </div>`;
  }
  return `<div class="trash-item">
    <div class="trash-icon">📁</div>
    <div class="trash-info">
      <div class="trash-name">${escHtml(t.folder.name)}</div>
      <div class="trash-sub">${t.words.length} từ bên trong • Đã xóa ${escHtml(when)}</div>
    </div>
    <div class="trash-actions">
      <button class="btn btn-outline" data-restore="${escAttr(t.id)}" style="padding:6px 12px;font-size:0.8rem;">↩️ Khôi phục</button>
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
  // Nếu thư mục gốc của từ không còn tồn tại (đã bị xóa/đổ rác riêng) -> khôi phục về "Chưa phân loại"
  const folderStillExists = w.folderId && folders.some(f => f.id === w.folderId);
  const restored = { ...w, folderId: folderStillExists ? w.folderId : null };
  const backupWords = words, backupTrash = trash;
  words = [...words, restored];
  trash = trash.filter(t => t.id !== trashId);
  if (!saveWords() || !saveTrash()) { words = backupWords; trash = backupTrash; showToast('⚠️ Không khôi phục được!', 'error'); return; }
  showToast(`✅ Đã khôi phục "${w.word}"${folderStillExists ? ' vào thư mục cũ' : ''}!`, 'success');
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
  words = [...words, ...toRestore.map(w => ({ ...w, folderId: targetFolder.id }))];
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
  const name = entry.type === 'word' ? entry.word.word : entry.folder.name;
  const old = document.getElementById('delete-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'delete-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cb-dialog-title');
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="cb-icon">🗑️</div>
      <div class="cb-title" id="cb-dialog-title">Xóa vĩnh viễn?</div>
      <div class="cb-word">${entry.type === 'folder' ? '📁 ' : ''}${escHtml(name)}</div>
      <div class="cb-sub">Mục này sẽ biến mất hoàn toàn, không thể khôi phục lại.</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Xóa vĩnh viễn</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-btn').addEventListener('click', () => deleteTrashEntry(trashId));
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
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
  const old = document.getElementById('delete-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'delete-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cb-dialog-title');
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="cb-icon">⚠️</div>
      <div class="cb-title" id="cb-dialog-title">Đổ hết thùng rác?</div>
      <div class="cb-word">${trash.length} mục</div>
      <div class="cb-sub">Toàn bộ từ/thư mục trong thùng rác sẽ biến mất vĩnh viễn, không thể khôi phục.</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-all-btn">Đổ rác</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-all-btn').addEventListener('click', emptyTrash);
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}
function emptyTrash() {
  const backupTrash = trash;
  trash = [];
  closeConfirm();
  if (!saveTrash()) { trash = backupTrash; showToast('⚠️ Không đổ rác được!', 'error'); return; }
  showToast('🗑️ Đã đổ hết thùng rác');
  refreshWlView();
}
