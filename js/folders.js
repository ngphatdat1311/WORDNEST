// ════════════════════════════════════════════════════════
// FOLDERS UI — tạo/đổi tên/xóa thư mục, gán từ vào thư mục
// (dữ liệu folders[]/loadFolders()/saveFolders() ở storage.js)
// ════════════════════════════════════════════════════════
let wlActiveFolder = null;

function genFolderId() {
  return 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// <option> thư mục dùng cho form Thêm từ + modal Sửa từ (chọn 1 thư mục để gán, có "— Không có —")
function folderOptionsHtml(selectedId) {
  const sorted = folders.slice().sort((a, b) => a.name.localeCompare(b.name));
  return '<option value="">— Không có —</option>' +
    sorted.map(f => `<option value="${escAttr(f.id)}"${selectedId === f.id ? ' selected' : ''}>📁 ${escHtml(f.name)}</option>`).join('');
}

// Điền sẵn 2 select thư mục ở form Thêm từ (đơn + hàng loạt) — gọi lại mỗi khi vào tab "Thêm từ"
// để luôn có danh sách thư mục mới nhất (kể cả thư mục vừa tạo ở tab Từ điển).
function populateAwFolderSelects() {
  const single = document.getElementById('aw-folder');
  const bulk = document.getElementById('aw-bulk-folder');
  if (single) single.innerHTML = folderOptionsHtml(single.value);
  if (bulk) bulk.innerHTML = folderOptionsHtml(bulk.value);
}

// Điền <select> bộ lọc thư mục dùng cho Flashcard/Quiz/Chính tả
function populateFolderSelect(selectEl) {
  if (!selectEl) return;
  const current = selectEl.value || 'all';
  const sorted = folders.slice().sort((a, b) => a.name.localeCompare(b.name));
  selectEl.innerHTML = '<option value="all">Tất cả thư mục</option>' +
    sorted.map(f => `<option value="${escAttr(f.id)}">📁 ${escHtml(f.name)}</option>`).join('') +
    '<option value="__unfiled__">📂 Chưa phân loại</option>';
  if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}

// pool đã lọc theo các điều kiện khác -> lọc tiếp theo thư mục đã chọn
function filterByFolderSel(pool, folderVal) {
  if (!folderVal || folderVal === 'all') return pool;
  if (folderVal === '__unfiled__') return pool.filter(w => !w.folderId);
  return pool.filter(w => w.folderId === folderVal);
}

function refreshWlView() {
  if (wlView === 'all') { renderWordList(); return; }
  if (wlView === 'trash') { renderTrash(); return; }
  if (wlActiveFolder === null) renderFolderGrid();
  else renderFolderDetail();
}

// ════════════════════════════════════════════════════════
// GRID — danh sách thư mục dạng "ô vuông" kiểu thư mục máy tính
// ════════════════════════════════════════════════════════
function openFolderGrid() { wlActiveFolder = null; renderFolderGrid(); }

function renderFolderGrid() {
  const gridEl = document.getElementById('wl-folder-grid');
  const detailEl = document.getElementById('wl-folder-detail');
  if (!gridEl || !detailEl) return;
  detailEl.style.display = 'none';
  gridEl.style.display = '';

  const sorted = folders.slice().sort((a, b) => a.name.localeCompare(b.name));
  // Đếm số từ theo từng thư mục trong 1 lần lặp duy nhất qua words — tránh
  // chạy words.filter() riêng cho mỗi thư mục (O(n×m) khi có nhiều thư mục).
  const countByFolder = {};
  let unfiledCount = 0;
  for (const w of words) {
    if (w.folderId) countByFolder[w.folderId] = (countByFolder[w.folderId] || 0) + 1;
    else unfiledCount++;
  }

  const cardsHtml = sorted.map(f => {
    const count = countByFolder[f.id] || 0;
    return `<div class="folder-card">
      <button class="folder-card-del" data-action="delete" data-id="${escAttr(f.id)}" title="Xóa thư mục" aria-label="Xóa thư mục ${escAttr(f.name)}">✕</button>
      <button class="folder-card-rename" data-action="rename" data-id="${escAttr(f.id)}" title="Đổi tên" aria-label="Đổi tên thư mục ${escAttr(f.name)}">✏️</button>
      <div class="folder-card-body" data-action="open" data-id="${escAttr(f.id)}">
        <div class="folder-card-icon">📁</div>
        <div class="folder-card-name">${escHtml(f.name)}</div>
        <div class="folder-card-count">${count} từ</div>
      </div>
    </div>`;
  }).join('');

  gridEl.innerHTML = `
    <div class="folder-card folder-card-unfiled">
      <div class="folder-card-body" data-action="open-unfiled">
        <div class="folder-card-icon">📂</div>
        <div class="folder-card-name">Chưa phân loại</div>
        <div class="folder-card-count">${unfiledCount} từ</div>
      </div>
    </div>
    ${cardsHtml}
    <div class="folder-card folder-card-new">
      <div class="folder-card-body" data-action="create">
        <div class="folder-card-icon">➕</div>
        <div class="folder-card-name">Tạo thư mục mới</div>
      </div>
    </div>`;

  gridEl.querySelectorAll('[data-action="open"]').forEach(el => el.addEventListener('click', () => openFolder(el.dataset.id)));
  const unfiledBtn = gridEl.querySelector('[data-action="open-unfiled"]');
  if (unfiledBtn) unfiledBtn.addEventListener('click', () => openFolder('__unfiled__'));
  gridEl.querySelectorAll('[data-action="create"]').forEach(el => el.addEventListener('click', () => createFolderPrompt()));
  gridEl.querySelectorAll('[data-action="rename"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); renameFolderPrompt(el.dataset.id); }));
  gridEl.querySelectorAll('[data-action="delete"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); deleteFolderConfirm(el.dataset.id); }));
}

// ════════════════════════════════════════════════════════
// DETAIL — danh sách từ bên trong 1 thư mục (hoặc "Chưa phân loại")
// ════════════════════════════════════════════════════════
function openFolder(id) { wlActiveFolder = id; renderFolderDetail(); }

function renderFolderDetail() {
  const gridEl = document.getElementById('wl-folder-grid');
  const detailEl = document.getElementById('wl-folder-detail');
  if (!gridEl || !detailEl) return;
  const isUnfiled = wlActiveFolder === '__unfiled__';
  const folder = isUnfiled ? null : folders.find(f => f.id === wlActiveFolder);
  if (!isUnfiled && !folder) { openFolderGrid(); return; } // thư mục đã bị xóa từ nơi khác

  gridEl.style.display = 'none';
  detailEl.style.display = '';
  document.getElementById('wl-folder-detail-name').textContent = isUnfiled ? '📂 Chưa phân loại' : `📁 ${folder.name}`;
  document.getElementById('wl-folder-detail-actions').style.display = isUnfiled ? 'none' : 'flex';

  let list = isUnfiled ? words.filter(w => !w.folderId) : words.filter(w => w.folderId === wlActiveFolder);
  if (wlShowMasteredOnly) list = list.filter(w => w.suspended);
  const folderSortVal = (document.getElementById('wl-folder-sort') || {}).value || 'default';
  list = list.slice().sort(wlComparator(folderSortVal));
  renderWlTableHead('wl-folder-thead');
  const tbody = document.getElementById('wl-folder-body');
  const colCount = 5;
  tbody.innerHTML = list.length
    ? list.map(w => wlRowHtml(w)).join('')
    : `<tr><td colspan="${colCount}" style="text-align:center;padding:2rem;color:var(--text3)">Chưa có từ nào ở đây 📭</td></tr>`;

  if (!isUnfiled) {
    // .onclick = ... (không addEventListener) để tránh chồng listener mỗi lần render lại
    document.getElementById('wl-folder-add-btn').onclick = () => openAddWordsToFolderModal(folder.id);
    document.getElementById('wl-folder-rename-btn').onclick = () => renameFolderPrompt(folder.id);
    document.getElementById('wl-folder-del-btn').onclick = () => deleteFolderConfirm(folder.id);
  }
}

// ════════════════════════════════════════════════════════
// TẠO / ĐỔI TÊN THƯ MỤC — modal nhập tên dùng chung
// ════════════════════════════════════════════════════════
function openFolderNameModal({ title = '📁 Tạo thư mục mới', initial = '', confirmLabel = 'Tạo', excludeId = null, onConfirm }) {
  const old = document.getElementById('folder-name-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'folder-name-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'fn-title');
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="cb-icon">📁</div>
      <div class="cb-title" id="fn-title">${escHtml(title)}</div>
      <input class="form-input" id="fn-input" maxlength="40" value="${escAttr(initial)}" placeholder="Tên thư mục...">
      <div class="cb-btns" style="margin-top:1.2rem;">
        <button class="cb-cancel" onclick="closeFolderNameModal()">Hủy</button>
        <button class="cb-confirm" id="fn-confirm-btn" style="background:var(--accent);border-color:var(--accent);">${escHtml(confirmLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById('fn-input');
  const confirm = () => {
    const name = clampStr(input.value.trim(), 40);
    if (!name) { showToast('Nhập tên thư mục!', 'error'); return; }
    const dup = folders.find(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== excludeId);
    if (dup) { showToast('Thư mục này đã tồn tại!', 'error'); return; }
    closeFolderNameModal();
    onConfirm(name);
  };
  document.getElementById('fn-confirm-btn').addEventListener('click', confirm);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFolderNameModal(); });
  setTimeout(() => { input.focus(); input.select(); }, 50);
}
function closeFolderNameModal() { const el = document.getElementById('folder-name-overlay'); if (el) el.remove(); }

function createFolderPrompt() {
  openFolderNameModal({
    title: '📁 Tạo thư mục mới', confirmLabel: 'Tạo',
    onConfirm: (name) => {
      const f = { id: genFolderId(), name, createdAt: Date.now() };
      folders.push(f);
      if (!saveFolders()) { folders.pop(); showToast('⚠️ Không lưu được!', 'error'); return; }
      showToast(`✅ Đã tạo thư mục "${name}"!`, 'success');
      refreshWlView();
    }
  });
}

function renameFolderPrompt(id) {
  const f = folders.find(x => x.id === id);
  if (!f) return;
  openFolderNameModal({
    title: '✏️ Đổi tên thư mục', initial: f.name, confirmLabel: 'Lưu', excludeId: id,
    onConfirm: (name) => {
      const old = f.name;
      f.name = name;
      if (!saveFolders()) { f.name = old; showToast('⚠️ Không lưu được!', 'error'); return; }
      showToast('✅ Đã đổi tên thư mục!', 'success');
      refreshWlView();
    }
  });
}

// ════════════════════════════════════════════════════════
// XÓA THƯ MỤC — từ trong thư mục KHÔNG bị xóa, chỉ chuyển về "Chưa phân loại"
// ════════════════════════════════════════════════════════
function deleteFolderConfirm(id) {
  const f = folders.find(x => x.id === id);
  if (!f) return;
  const count = words.filter(w => w.folderId === id).length;
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
      <div class="cb-title" id="cb-dialog-title">Xóa thư mục này?</div>
      <div class="cb-word">📁 ${escHtml(f.name)}</div>
      <div class="cb-sub">${count ? `Thư mục cùng ${count} từ bên trong sẽ chuyển vào 🗑️ Thùng rác` : 'Thư mục đang trống sẽ chuyển vào 🗑️ Thùng rác'} — khôi phục sẽ trả lại đúng như cũ.</div>
      <div class="cb-btns">
        <button class="cb-cancel" onclick="closeConfirm()">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Xóa thư mục</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-btn').addEventListener('click', () => deleteFolder(id));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}

function deleteFolder(id) {
  const f = folders.find(x => x.id === id);
  if (!f) return;
  const backupWords = words, backupFolders = folders, backupTrash = trash;
  // Xóa thư mục kiểu máy tính: cả thư mục + từ bên trong cùng chuyển vào Thùng rác,
  // khôi phục sẽ trả lại đúng như cũ (không phải chỉ "bỏ thư mục" như trước đây).
  const bundledWords = words.filter(w => w.folderId === id);
  words = words.filter(w => w.folderId !== id);
  folders = folders.filter(x => x.id !== id);
  trash = [...trash, { id: genTrashId(), type: 'folder', deletedAt: Date.now(), folder: f, words: bundledWords }];
  closeConfirm();
  if (!saveWords() || !saveFolders() || !saveTrash()) { words = backupWords; folders = backupFolders; trash = backupTrash; showToast('⚠️ Không xóa được — lỗi lưu dữ liệu!', 'error'); return; }
  showToast(`🗑️ Đã chuyển thư mục "${f.name}"${bundledWords.length ? ' và ' + bundledWords.length + ' từ' : ''} vào Thùng rác`);
  if (wlActiveFolder === id) wlActiveFolder = null;
  refreshWlView();
}

// ════════════════════════════════════════════════════════
// GÁN 1 TỪ VÀO THƯ MỤC — nút 📁 trên mỗi dòng trong bảng Từ điển
// ════════════════════════════════════════════════════════
function openFolderPicker(word) {
  const w = words.find(x => x.word === word);
  if (!w) return;
  const old = document.getElementById('folder-pick-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'folder-pick-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'fp-title');
  const sorted = folders.slice().sort((a, b) => a.name.localeCompare(b.name));
  const itemsHtml = sorted.map(f => `<button class="folder-pick-item${w.folderId === f.id ? ' active' : ''}" data-id="${escAttr(f.id)}">📁 ${escHtml(f.name)}${w.folderId === f.id ? ' ✓' : ''}</button>`).join('');
  overlay.innerHTML = `
    <div class="confirm-box folder-pick-box">
      <div class="cb-icon">📁</div>
      <div class="cb-title" id="fp-title">Thêm "${escHtml(w.word)}" vào thư mục</div>
      <div class="folder-pick-list">
        ${itemsHtml || '<div style="font-size:0.85rem;color:var(--text3);padding:6px 0;">Chưa có thư mục nào.</div>'}
      </div>
      <div class="folder-pick-new">
        <input class="form-input" id="fp-new-name" maxlength="40" placeholder="+ Tạo thư mục mới...">
        <button class="btn btn-outline" id="fp-create-btn">Tạo</button>
      </div>
      <div class="cb-btns">
        ${w.folderId ? '<button class="cb-cancel" id="fp-remove-btn">🚫 Bỏ khỏi thư mục</button><button class="cb-cancel" onclick="closeFolderPicker()">Đóng</button>' : '<button class="cb-cancel" onclick="closeFolderPicker()">Đóng</button>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.folder-pick-item').forEach(btn => btn.addEventListener('click', () => { assignWordToFolder(word, btn.dataset.id); closeFolderPicker(); }));
  document.getElementById('fp-create-btn').addEventListener('click', () => {
    const name = clampStr(document.getElementById('fp-new-name').value.trim(), 40);
    if (!name) { showToast('Nhập tên thư mục!', 'error'); return; }
    if (folders.find(f => f.name.toLowerCase() === name.toLowerCase())) { showToast('Thư mục này đã tồn tại!', 'error'); return; }
    const f = { id: genFolderId(), name, createdAt: Date.now() };
    folders.push(f);
    if (!saveFolders()) { folders.pop(); showToast('⚠️ Không lưu được!', 'error'); return; }
    assignWordToFolder(word, f.id);
    closeFolderPicker();
    showToast(`✅ Đã tạo thư mục "${name}" và thêm từ vào!`, 'success');
  });
  const removeBtn = document.getElementById('fp-remove-btn');
  if (removeBtn) removeBtn.addEventListener('click', () => { assignWordToFolder(word, null); closeFolderPicker(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFolderPicker(); });
  setTimeout(() => { const el = document.getElementById('fp-new-name'); if (el) el.focus(); }, 50);
}
function closeFolderPicker() { const el = document.getElementById('folder-pick-overlay'); if (el) el.remove(); }

function assignWordToFolder(word, folderId) {
  const idx = words.findIndex(x => x.word === word);
  if (idx === -1) return;
  const old = words[idx].folderId;
  words[idx].folderId = folderId || null;
  if (!saveWords()) { words[idx].folderId = old; showToast('⚠️ Không lưu được!', 'error'); return; }
  const f = folderId ? folders.find(x => x.id === folderId) : null;
  showToast(f ? `📁 Đã thêm vào "${f.name}"` : '🚫 Đã bỏ khỏi thư mục', 'success');
  refreshWlView();
}

// ════════════════════════════════════════════════════════
// QUẢN LÝ NHIỀU TỪ TRONG 1 THƯ MỤC — nút "+ Thêm từ" ở màn hình chi tiết thư mục
// ════════════════════════════════════════════════════════
function openAddWordsToFolderModal(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  const old = document.getElementById('folder-bulk-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'folder-bulk-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'fb-title');
  const sortedWords = words.slice().sort((a, b) => a.word.localeCompare(b.word));
  const rows = sortedWords.map(w => `
    <label class="folder-bulk-row" data-word="${escAttr(w.word.toLowerCase())}">
      <input type="checkbox" class="fb-check" value="${escAttr(w.word)}"${w.folderId === folderId ? ' checked' : ''}>
      <span class="fb-word">${escHtml(w.word)}</span>
      <span class="fb-meaning">${escHtml(w.meaning)}</span>
      ${w.folderId && w.folderId !== folderId ? `<span class="fb-other-folder">📁 ${escHtml((folders.find(f => f.id === w.folderId) || {}).name || '')}</span>` : ''}
    </label>`).join('');
  overlay.innerHTML = `
    <div class="confirm-box folder-pick-box">
      <div class="cb-icon">📁</div>
      <div class="cb-title" id="fb-title">Quản lý từ trong "${escHtml(folder.name)}"</div>
      <input class="form-input" id="fb-search" placeholder="🔍 Tìm từ..." style="margin-bottom:10px;">
      <div class="folder-bulk-list" id="fb-list">${rows || '<div style="font-size:0.85rem;color:var(--text3);padding:10px 0;">Chưa có từ nào trong từ điển.</div>'}</div>
      <div class="cb-btns" style="margin-top:1.2rem;">
        <button class="cb-cancel" onclick="closeFolderBulkModal()">Hủy</button>
        <button class="cb-confirm" id="fb-save-btn" style="background:var(--accent);border-color:var(--accent);">💾 Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('fb-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    overlay.querySelectorAll('.folder-bulk-row').forEach(row => {
      row.style.display = !q || row.dataset.word.includes(q) ? '' : 'none';
    });
  });
  document.getElementById('fb-save-btn').addEventListener('click', () => {
    const checked = new Set([...overlay.querySelectorAll('.fb-check:checked')].map(c => c.value));
    let changed = 0;
    const backup = words;
    words = words.map(w => {
      const inChecked = checked.has(w.word);
      if (inChecked && w.folderId !== folderId) { changed++; return { ...w, folderId }; }
      if (!inChecked && w.folderId === folderId) { changed++; return { ...w, folderId: null }; }
      return w;
    });
    closeFolderBulkModal();
    if (!saveWords()) { words = backup; showToast('⚠️ Không lưu được!', 'error'); return; }
    showToast(changed ? `✅ Đã cập nhật ${changed} từ!` : 'Không có thay đổi nào', 'success');
    refreshWlView();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFolderBulkModal(); });
  setTimeout(() => { const el = document.getElementById('fb-search'); if (el) el.focus(); }, 50);
}
function closeFolderBulkModal() { const el = document.getElementById('folder-bulk-overlay'); if (el) el.remove(); }
