// ════════════════════════════════════════════════════════
// FOLDERS UI — tạo/đổi tên/xóa thư mục, gán từ vào thư mục
// (dữ liệu folders[]/loadFolders()/saveFolders() ở storage.js)
// ════════════════════════════════════════════════════════
let wlActiveFolder = null;
let wlFolderPage = 1;

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
  if (folderVal === '__unfiled__') return pool.filter(w => !w.folderIds || !w.folderIds.length);
  return pool.filter(w => w.folderIds && w.folderIds.includes(folderVal));
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

// Icon thư mục vẽ tay bằng SVG (thay emoji 📁/📂) — MÀU THEO TỪNG HỆ ĐIỀU HÀNH:
// macOS dùng xanh dương kiểu Finder, Windows/nền tảng khác dùng vàng kiểu folder
// quen thuộc (giống emoji 📁 vốn thấy trên Windows). Không dựa vào emoji gốc vì
// màu của nó "khắc chết" trong glyph hệ thống, không đoán/kiểm soát được — thực
// tế Apple Color Emoji cho 📁 là màu xám, không xanh cũng không vàng (xem
// project_wordnest.md). Vẽ tay 2 bộ màu, tự chọn đúng bộ theo window.electronAPI
// .platform ('darwin' = Mac) để CHỦ ĐỘNG mô phỏng cảm giác quen thuộc của từng OS
// thay vì phó mặc cho font emoji hệ thống.
const FOLDER_ICON_SVG_MAC = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 5.5C3 4.67 3.67 4 4.5 4H9.17C9.57 4 9.95 4.16 10.23 4.44L11.79 6H19.5C20.33 6 21 6.67 21 7.5V9H3V5.5Z" fill="#3E7CB8"/><path d="M2 8.5C2 7.67 2.67 7 3.5 7H20.5C21.33 7 22 7.67 22 8.5V18C22 18.83 21.33 19.5 20.5 19.5H3.5C2.67 19.5 2 18.83 2 18V8.5Z" fill="#5AACEA"/></svg>';
const FOLDER_ICON_SVG_WIN = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 5.5C3 4.67 3.67 4 4.5 4H9.17C9.57 4 9.95 4.16 10.23 4.44L11.79 6H19.5C20.33 6 21 6.67 21 7.5V9H3V5.5Z" fill="#D99A1B"/><path d="M2 8.5C2 7.67 2.67 7 3.5 7H20.5C21.33 7 22 7.67 22 8.5V18C22 18.83 21.33 19.5 20.5 19.5H3.5C2.67 19.5 2 18.83 2 18V8.5Z" fill="#FFC845"/></svg>';
const FOLDER_ICON_SVG = (window.electronAPI?.platform === 'darwin') ? FOLDER_ICON_SVG_MAC : FOLDER_ICON_SVG_WIN;

function renderFolderGrid() {
  const gridEl = document.getElementById('wl-folder-grid');
  const detailEl = document.getElementById('wl-folder-detail');
  if (!gridEl || !detailEl) return;
  detailEl.style.display = 'none';
  gridEl.style.display = '';

  const sorted = folders.slice().sort((a, b) => a.name.localeCompare(b.name));
  // Đếm số từ theo từng thư mục trong 1 lần lặp duy nhất qua words — tránh
  // chạy words.filter() riêng cho mỗi thư mục (O(n×m) khi có nhiều thư mục).
  // 1 từ có thể thuộc NHIỀU thư mục cùng lúc nên được cộng vào từng thư mục nó
  // thuộc, không chỉ 1 — vẫn O(n) tổng thể vì số thư mục/từ thường rất nhỏ.
  const countByFolder = {};
  let unfiledCount = 0;
  for (const w of words) {
    if (w.folderIds && w.folderIds.length) {
      w.folderIds.forEach(fid => { countByFolder[fid] = (countByFolder[fid] || 0) + 1; });
    } else {
      unfiledCount++;
    }
  }

  const cardsHtml = sorted.map(f => {
    const count = countByFolder[f.id] || 0;
    return `<div class="folder-card">
      <button class="folder-card-del" data-action="delete" data-id="${escAttr(f.id)}" title="Xóa thư mục" aria-label="Xóa thư mục ${escAttr(f.name)}">✕</button>
      <button class="folder-card-rename" data-action="rename" data-id="${escAttr(f.id)}" title="Đổi tên" aria-label="Đổi tên thư mục ${escAttr(f.name)}">✏️</button>
      <div class="folder-card-body" data-action="open" data-id="${escAttr(f.id)}">
        <div class="folder-card-icon">${FOLDER_ICON_SVG}</div>
        <div class="folder-card-name">${escHtml(f.name)}</div>
        <div class="folder-card-count">${count} từ</div>
      </div>
    </div>`;
  }).join('');

  gridEl.innerHTML = `
    <div class="folder-card folder-card-unfiled">
      <div class="folder-card-body" data-action="open-unfiled">
        <div class="folder-card-icon">${FOLDER_ICON_SVG}</div>
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
function openFolder(id) { wlActiveFolder = id; wlFolderPage = 1; renderFolderDetail(true); }

function renderFolderDetail(resetPage = false) {
  const gridEl = document.getElementById('wl-folder-grid');
  const detailEl = document.getElementById('wl-folder-detail');
  if (!gridEl || !detailEl) return;
  if (resetPage) wlFolderPage = 1;
  const isUnfiled = wlActiveFolder === '__unfiled__';
  const folder = isUnfiled ? null : folders.find(f => f.id === wlActiveFolder);
  if (!isUnfiled && !folder) { openFolderGrid(); return; } // thư mục đã bị xóa từ nơi khác

  gridEl.style.display = 'none';
  detailEl.style.display = '';
  document.getElementById('wl-folder-detail-name').textContent = isUnfiled ? '📂 Chưa phân loại' : `📁 ${folder.name}`;
  document.getElementById('wl-folder-detail-actions').style.display = isUnfiled ? 'none' : 'flex';
  if (!isUnfiled) {
    // .onclick = ... (không addEventListener) để tránh chồng listener mỗi lần render lại
    document.getElementById('wl-folder-add-btn').onclick = () => openAddWordsToFolderModal(folder.id);
    document.getElementById('wl-folder-rename-btn').onclick = () => renameFolderPrompt(folder.id);
    document.getElementById('wl-folder-del-btn').onclick = () => deleteFolderConfirm(folder.id);
  }

  let list = isUnfiled
    ? words.filter(w => !w.folderIds || !w.folderIds.length)
    : words.filter(w => w.folderIds && w.folderIds.includes(wlActiveFolder));
  if (wlShowMasteredOnly) list = list.filter(w => w.suspended);
  const folderSortVal = (document.getElementById('wl-folder-sort') || {}).value || 'default';
  list = list.slice().sort(wlComparator(folderSortVal));
  renderWlTableHead('wl-folder-thead');
  const tbody = document.getElementById('wl-folder-body');
  const pagEl = document.getElementById('wl-folder-pagination');
  const colCount = 5;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:2rem;color:var(--text3)">Chưa có từ nào ở đây 📭</td></tr>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  // Phân trang 30 từ/trang (WL_PAGE_SIZE, định nghĩa ở wordlist.js) — cùng cơ chế
  // với danh sách "Tất cả", tránh render chậm nếu 1 thư mục gom quá nhiều từ.
  const totalPages = Math.ceil(list.length / WL_PAGE_SIZE);
  if (wlFolderPage > totalPages) wlFolderPage = totalPages;
  const paginated = list.slice((wlFolderPage - 1) * WL_PAGE_SIZE, wlFolderPage * WL_PAGE_SIZE);
  tbody.innerHTML = paginated.map(w => wlRowHtml(w)).join('');
  wireWlRowActions(tbody);

  if (pagEl && totalPages > 1) {
    let pagHtml = `<span style="font-size:0.8rem;color:var(--text3);align-self:center;">${list.length} từ — Trang ${wlFolderPage}/${totalPages}</span>`;
    if (wlFolderPage > 1) pagHtml += `<button class="btn btn-outline" id="wl-folder-page-prev-btn" style="padding:5px 12px;font-size:0.8rem;">← Trước</button>`;
    if (wlFolderPage < totalPages) pagHtml += `<button class="btn btn-outline" id="wl-folder-page-next-btn" style="padding:5px 12px;font-size:0.8rem;">Tiếp →</button>`;
    pagEl.innerHTML = pagHtml;
    const prevBtn = document.getElementById('wl-folder-page-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { wlFolderPage--; renderFolderDetail(); });
    const nextBtn = document.getElementById('wl-folder-page-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => { wlFolderPage++; renderFolderDetail(); });
  } else if (pagEl) {
    pagEl.innerHTML = '';
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
        <button class="cb-cancel" id="fn-cancel-btn">Hủy</button>
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
  document.getElementById('fn-cancel-btn').addEventListener('click', closeFolderNameModal);
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
// XÓA THƯ MỤC — từ CHỈ thuộc riêng thư mục này cùng chuyển vào Thùng rác với
// nó (kiểu máy tính, khôi phục trả lại đúng như cũ). Từ còn thuộc THÊM thư mục
// khác nữa thì được GIỮ LẠI, chỉ gỡ tag thư mục đang xóa — giống Gmail xóa 1
// label không xóa mất email còn label khác.
// ════════════════════════════════════════════════════════
function deleteFolderConfirm(id) {
  const f = folders.find(x => x.id === id);
  if (!f) return;
  const inFolder = words.filter(w => w.folderIds && w.folderIds.includes(id));
  const soleCount = inFolder.filter(w => w.folderIds.length === 1).length;
  const sharedCount = inFolder.length - soleCount;
  let sub;
  if (!inFolder.length) {
    sub = 'Thư mục đang trống sẽ chuyển vào 🗑️ Thùng rác';
  } else if (!sharedCount) {
    sub = `Thư mục cùng ${soleCount} từ bên trong sẽ chuyển vào 🗑️ Thùng rác`;
  } else if (!soleCount) {
    sub = `Cả ${sharedCount} từ bên trong đều còn thuộc thư mục khác nữa nên sẽ được GIỮ LẠI, chỉ gỡ khỏi thư mục này`;
  } else {
    sub = `${soleCount} từ chỉ thuộc riêng thư mục này sẽ chuyển vào 🗑️ Thùng rác; ${sharedCount} từ còn thuộc thư mục khác sẽ được giữ lại, chỉ gỡ khỏi thư mục này`;
  }
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
      <div class="cb-sub">${sub} — khôi phục sẽ trả lại đúng như cũ.</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Xóa thư mục</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-btn').addEventListener('click', () => deleteFolder(id));
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}

function deleteFolder(id) {
  const f = folders.find(x => x.id === id);
  if (!f) return;
  const backupWords = words, backupFolders = folders, backupTrash = trash;
  // Từ chỉ thuộc DUY NHẤT thư mục này -> xóa hẳn, gộp vào cùng 1 trash entry với
  // thư mục (khôi phục sẽ trả lại đúng như cũ). Từ còn thuộc thư mục KHÁC nữa ->
  // chỉ gỡ tag thư mục này ra, bản thân từ vẫn được giữ nguyên trong từ điển.
  const soleWords = words.filter(w => w.folderIds && w.folderIds.includes(id) && w.folderIds.length === 1);
  const soleIds = new Set(soleWords.map(w => w.id));
  words = words
    .filter(w => !soleIds.has(w.id))
    .map(w => (w.folderIds && w.folderIds.includes(id))
      ? { ...w, folderIds: w.folderIds.filter(x => x !== id) }
      : w);
  folders = folders.filter(x => x.id !== id);
  trash = [...trash, { id: genTrashId(), type: 'folder', deletedAt: Date.now(), folder: f, words: soleWords }];
  closeConfirm();
  if (!saveWords() || !saveFolders() || !saveTrash()) { words = backupWords; folders = backupFolders; trash = backupTrash; showToast('⚠️ Không xóa được — lỗi lưu dữ liệu!', 'error'); return; }
  showToast(`🗑️ Đã chuyển thư mục "${f.name}"${soleWords.length ? ' và ' + soleWords.length + ' từ' : ''} vào Thùng rác`);
  if (wlActiveFolder === id) wlActiveFolder = null;
  refreshWlView();
}

// ════════════════════════════════════════════════════════
// GÁN 1 TỪ VÀO NHIỀU THƯ MỤC — nút 📁 trên mỗi dòng trong bảng Từ điển.
// Danh sách thư mục dạng checkbox (không phải chọn 1) + nút Lưu để xác nhận
// hàng loạt cùng lúc, thay vì gán ngay khi bấm như trước (khi đó chỉ chọn được 1).
// ════════════════════════════════════════════════════════
// forceChecked: Set các folderId cần tick sẵn thay vì đọc từ w.folderIds — dùng
// khi reopen dialog ngay sau khi tạo thư mục mới giữa chừng, để không mất các
// lựa chọn đang tick dở trước đó (xem handler fp-create-btn bên dưới).
function openFolderPicker(id, forceChecked = null) {
  const w = words.find(x => x.id === id);
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
  const current = forceChecked || new Set(w.folderIds || []);
  const itemsHtml = sorted.map(f => `
    <label class="folder-pick-item">
      <input type="checkbox" class="fp-check" value="${escAttr(f.id)}"${current.has(f.id) ? ' checked' : ''}>
      📁 ${escHtml(f.name)}
    </label>`).join('');
  overlay.innerHTML = `
    <div class="confirm-box folder-pick-box">
      <div class="cb-icon">📁</div>
      <div class="cb-title" id="fp-title">Thư mục cho "${escHtml(w.word)}"</div>
      <div class="folder-pick-list">
        ${itemsHtml || '<div style="font-size:0.85rem;color:var(--text3);padding:6px 0;">Chưa có thư mục nào.</div>'}
      </div>
      <div class="folder-pick-new">
        <input class="form-input" id="fp-new-name" maxlength="40" placeholder="+ Tạo thư mục mới...">
        <button class="btn btn-outline" id="fp-create-btn">Tạo</button>
      </div>
      <div class="cb-btns">
        <button class="cb-cancel" id="fp-close-btn">Hủy</button>
        <button class="cb-confirm" id="fp-save-btn">💾 Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('fp-close-btn').addEventListener('click', closeFolderPicker);
  document.getElementById('fp-save-btn').addEventListener('click', () => {
    const checked = [...overlay.querySelectorAll('.fp-check:checked')].map(c => c.value);
    assignWordFolders(id, checked);
    closeFolderPicker();
  });
  document.getElementById('fp-create-btn').addEventListener('click', () => {
    const name = clampStr(document.getElementById('fp-new-name').value.trim(), 40);
    if (!name) { showToast('Nhập tên thư mục!', 'error'); return; }
    if (folders.find(f => f.name.toLowerCase() === name.toLowerCase())) { showToast('Thư mục này đã tồn tại!', 'error'); return; }
    // Giữ lại các lựa chọn đang tick dở trước khi tạo thư mục mới, rồi mở lại
    // dialog kèm thư mục vừa tạo (tự tick sẵn) — không đóng hẳn, cho phép chọn
    // thêm thư mục khác trong cùng 1 lượt trước khi bấm Lưu.
    const pending = new Set([...overlay.querySelectorAll('.fp-check:checked')].map(c => c.value));
    const f = { id: genFolderId(), name, createdAt: Date.now() };
    folders.push(f);
    if (!saveFolders()) { folders.pop(); showToast('⚠️ Không lưu được!', 'error'); return; }
    pending.add(f.id);
    openFolderPicker(id, pending);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFolderPicker(); });
  setTimeout(() => { const el = document.getElementById('fp-new-name'); if (el) el.focus(); }, 50);
}
function closeFolderPicker() { const el = document.getElementById('folder-pick-overlay'); if (el) el.remove(); }

function assignWordFolders(id, folderIds) {
  const idx = words.findIndex(x => x.id === id);
  if (idx === -1) return;
  const old = words[idx].folderIds;
  const next = [...new Set(folderIds)]; // phòng hờ trùng, dù UI không tạo ra trùng
  words[idx].folderIds = next;
  if (!saveWords()) { words[idx].folderIds = old; showToast('⚠️ Không lưu được!', 'error'); return; }
  showToast(next.length ? `📁 Đã cập nhật thư mục (${next.length})` : '🚫 Đã bỏ khỏi mọi thư mục', 'success');
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
  const rows = sortedWords.map(w => {
    const otherIds = (w.folderIds || []).filter(fid => fid !== folderId);
    const otherNames = otherIds.map(fid => (folders.find(f => f.id === fid) || {}).name).filter(Boolean);
    return `
    <label class="folder-bulk-row" data-word="${escAttr(w.word.toLowerCase())}">
      <input type="checkbox" class="fb-check" value="${escAttr(w.id)}"${w.folderIds && w.folderIds.includes(folderId) ? ' checked' : ''}>
      <span class="fb-word">${escHtml(w.word)}</span>
      <span class="fb-meaning">${escHtml(w.meaning)}</span>
      ${otherNames.length ? `<span class="fb-other-folder">📁 ${escHtml(otherNames.join(', '))}</span>` : ''}
    </label>`;
  }).join('');
  overlay.innerHTML = `
    <div class="confirm-box folder-pick-box">
      <div class="cb-icon">📁</div>
      <div class="cb-title" id="fb-title">Quản lý từ trong "${escHtml(folder.name)}"</div>
      <input class="form-input" id="fb-search" placeholder="🔍 Tìm từ..." style="margin-bottom:10px;">
      <div class="folder-bulk-list" id="fb-list">${rows || '<div style="font-size:0.85rem;color:var(--text3);padding:10px 0;">Chưa có từ nào trong từ điển.</div>'}</div>
      <div class="cb-btns" style="margin-top:1.2rem;">
        <button class="cb-cancel" id="fb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="fb-save-btn" style="background:var(--accent);border-color:var(--accent);">💾 Lưu</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('fb-cancel-btn').addEventListener('click', closeFolderBulkModal);
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
    // Tick thêm CHỈ thêm folderId này vào mảng (không đụng các thư mục khác từ
    // đó đang thuộc); bỏ tick CHỈ gỡ đúng folderId này ra.
    words = words.map(w => {
      const has = w.folderIds && w.folderIds.includes(folderId);
      const inChecked = checked.has(w.id);
      if (inChecked && !has) { changed++; return { ...w, folderIds: [...(w.folderIds || []), folderId] }; }
      if (!inChecked && has) { changed++; return { ...w, folderIds: w.folderIds.filter(x => x !== folderId) }; }
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
