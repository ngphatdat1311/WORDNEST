// ════════════════════════════════════════════════════════
// WORD LIST
// ════════════════════════════════════════════════════════
let wlFilter = 'all';
let wlPage = 1;
const WL_PAGE_SIZE = 30;
const WL_SHOWDATE_KEY = 'wordnest_wl_showdate';
let wlShowDate = localStorage.getItem(WL_SHOWDATE_KEY) === '1';
const WL_MASTERED_ONLY_KEY = 'wordnest_wl_mastered_only';
// true = chỉ hiện từ "Đã thuộc hẳn", ẩn hết từ còn lại. false = hiện bình thường
// (2 nhóm nối tiếp nhau: từ chưa thuộc ở trên, đã thuộc hẳn ở dưới — xem wlComparator).
let wlShowMasteredOnly = localStorage.getItem(WL_MASTERED_ONLY_KEY) === '1';

// 'all' = danh sách phẳng quen thuộc, 'folders' = chế độ thư mục, 'trash' = thùng rác
let wlView = 'all';

function switchWlView(view) {
  wlView = view;
  document.getElementById('wl-tab-all').classList.toggle('active', view === 'all');
  document.getElementById('wl-tab-folders').classList.toggle('active', view === 'folders');
  document.getElementById('wl-tab-trash').classList.toggle('active', view === 'trash');
  document.getElementById('wl-view-all').style.display = view === 'all' ? '' : 'none';
  document.getElementById('wl-view-folders').style.display = view === 'folders' ? '' : 'none';
  document.getElementById('wl-view-trash').style.display = view === 'trash' ? '' : 'none';
  if (view === 'all') renderWordList();
  else if (view === 'folders') openFolderGrid();
  else renderTrash();
}

function toggleWlShowDate() {
  wlShowDate = !wlShowDate;
  localStorage.setItem(WL_SHOWDATE_KEY, wlShowDate ? '1' : '0');
  document.getElementById('wl-showdate-btn').classList.toggle('active', wlShowDate);
  renderWordList();
}

function toggleWlMasteredOnly() {
  wlShowMasteredOnly = !wlShowMasteredOnly;
  localStorage.setItem(WL_MASTERED_ONLY_KEY, wlShowMasteredOnly ? '1' : '0');
  document.querySelectorAll('.wl-mastered-only-btn').forEach(b => b.classList.toggle('active', wlShowMasteredOnly));
  if (wlView === 'all') { wlPage = 1; renderWordList(); }
  else refreshWlView();
}

// Comparator dùng chung cho cả bảng "Tất cả" và bảng chi tiết thư mục — từ đã
// đánh dấu "Đã thuộc hẳn" (suspended) luôn bị đẩy xuống cuối danh sách, bất kể
// đang sắp xếp theo kiểu gì, để không bị lẫn vào giữa các từ còn cần ôn tập.
function wlComparator(sortVal) {
  return (a, b) => {
    const sa = !!a.suspended, sb = !!b.suspended;
    if (sa !== sb) return sa ? 1 : -1;
    if (sortVal === 'az')           return a.word.localeCompare(b.word);
    if (sortVal === 'za')           return b.word.localeCompare(a.word);
    if (sortVal === 'mastery_desc') return (b.mastery||0) - (a.mastery||0);
    if (sortVal === 'mastery_asc')  return (a.mastery||0) - (b.mastery||0);
    if (sortVal === 'seen_desc')    return (b.seen||0) - (a.seen||0);
    if (sortVal === 'added_desc')   return (b.addedAt||0) - (a.addedAt||0);
    if (sortVal === 'added_asc')    return (a.addedAt||0) - (b.addedAt||0);
    return 0;
  };
}

function renderWordList(resetPage = false) {
  if (resetPage) wlPage = 1;
  const search = (document.getElementById('wl-search').value || '').toLowerCase();
  const sortVal = (document.getElementById('wl-sort') || {}).value || 'default';
  const cats = [...new Set(words.map(w => w.category || 'Khác'))].sort();
  const filtersEl = document.getElementById('wl-filters');
  filtersEl.innerHTML = ['all', ...cats].map(c =>
    `<button class="wl-filter-btn${wlFilter === c ? ' active' : ''}" data-cat="${escAttr(c)}">
      ${c === 'all' ? 'Tất cả' : escHtml(c)}
    </button>`
  ).join('');
  // Gán event listener sau khi render — tránh XSS qua tên category đặc biệt
  filtersEl.querySelectorAll('.wl-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setWlFilter(btn.dataset.cat));
  });

  let list = words.filter(w => {
    const matchSearch = !search || w.word.toLowerCase().includes(search) || w.meaning.toLowerCase().includes(search);
    const matchCat = wlFilter === 'all' || (w.category || 'Khác') === wlFilter;
    return matchSearch && matchCat;
  });
  if (wlShowMasteredOnly) list = list.filter(w => w.suspended);

  // Sắp xếp theo lựa chọn — từ "Đã thuộc hẳn" luôn bị đẩy xuống cuối (xem wlComparator)
  list = list.slice().sort(wlComparator(sortVal));

  renderWlTableHead('wl-thead');
  const tbody = document.getElementById('wl-body');
  const pagEl = document.getElementById('wl-pagination');
  const colCount = 5;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:2rem;color:var(--text3)">Không tìm thấy từ nào 📭</td></tr>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  // Phân trang 30 từ/trang để tránh render chậm với 500+ từ
  const totalPages = Math.ceil(list.length / WL_PAGE_SIZE);
  if (wlPage > totalPages) wlPage = totalPages;
  const paginated = list.slice((wlPage - 1) * WL_PAGE_SIZE, wlPage * WL_PAGE_SIZE);

  tbody.innerHTML = paginated.map(w => wlRowHtml(w)).join('');
  wireWlRowActions(tbody);

  // Render pagination controls
  if (pagEl && totalPages > 1) {
    let pagHtml = `<span style="font-size:0.8rem;color:var(--text3);align-self:center;">${list.length} từ — Trang ${wlPage}/${totalPages}</span>`;
    if (wlPage > 1) pagHtml += `<button class="btn btn-outline" id="wl-page-prev-btn" style="padding:5px 12px;font-size:0.8rem;">← Trước</button>`;
    if (wlPage < totalPages) pagHtml += `<button class="btn btn-outline" id="wl-page-next-btn" style="padding:5px 12px;font-size:0.8rem;">Tiếp →</button>`;
    pagEl.innerHTML = pagHtml;
    const prevBtn = document.getElementById('wl-page-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { wlPage--; renderWordList(); });
    const nextBtn = document.getElementById('wl-page-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => { wlPage++; renderWordList(); });
  } else if (pagEl) {
    pagEl.innerHTML = '';
  }
}

// Header bảng — luôn 5 cột cố định, dùng chung cho bảng "Tất cả" và bảng chi tiết thư mục
function renderWlTableHead(theadId) {
  const thead = document.getElementById(theadId);
  if (!thead) return;
  thead.innerHTML = `<tr><th>Từ</th><th>Nghĩa</th><th>Chủ đề</th><th>Thuộc</th><th></th></tr>`;
}

// Dùng chung cho cả 2 chế độ (danh sách phẳng + bên trong 1 thư mục)
// Ngày thêm hiện trong ô "Từ" (không tách cột riêng), các nút hành động gộp vào 1 ô
// duy nhất — tránh bảng phình quá nhiều cột gây xuống dòng/lệch tiêu đề trên màn hẹp.
function wlRowHtml(w) {
  // mastery chạy 0-3 (3 mức tăng dần) -> 3 chấm là vừa đủ để "Đã thuộc (3)" lấp đầy
  // toàn bộ thanh chấm; 4 chấm sẽ khiến mức cao nhất luôn dở dang (3/4), gây hiểu lầm.
  const dots = [0,1,2].map(i => `<div class="wl-dot${i < w.mastery ? ' filled' : ''}"></div>`).join('');
  const esc = escAttr(w.word);
  const folder = w.folderId ? folders.find(f => f.id === w.folderId) : null;
  return `<tr class="${w.suspended ? 'wl-row-suspended' : ''}">
    <td>
      <div class="wl-word">${escHtml(w.word)}</div>
      <div class="wl-phon">${escHtml(w.phonetic || '')}</div>
      ${wlShowDate ? `<div class="wl-added">🕒 ${w.addedAt ? escHtml(formatAddedAt(w.addedAt)) : 'Không rõ (từ cũ)'}</div>` : ''}
    </td>
    <td><div class="wl-meaning">${escHtml(w.meaning)}</div><div class="wl-example">${escHtml(w.example || '')}</div></td>
    <td>
      <span class="wl-type">${escHtml(w.category || 'Khác')}</span>
      ${folder ? `<div class="wl-folder-tag">📁 ${escHtml(folder.name)}</div>` : ''}
    </td>
    <td><div class="wl-mastery">${dots}</div></td>
    <td>
      <div class="wl-actions">
        <button class="wl-folder-btn${folder ? ' active' : ''}" data-word="${esc}" title="${folder ? '📁 ' + escAttr(folder.name) : 'Thêm vào thư mục'}" aria-label="Gán thư mục cho ${escAttr(w.word)}">📁</button>
        <button class="wl-suspend${w.suspended ? ' active' : ''}" data-word="${esc}" title="${w.suspended ? 'Bỏ ẩn — đưa lại vào ôn tập' : 'Đã thuộc hẳn — ẩn khỏi ôn tập'}" aria-label="Ẩn/bỏ ẩn ${escAttr(w.word)}">${w.suspended ? '🔒' : '📌'}</button>
        <button class="wl-speak" data-word="${esc}" aria-label="Phát âm ${escAttr(w.word)}">🔊</button>
        <button class="wl-edit" data-word="${esc}" title="Sửa" aria-label="Sửa từ ${escAttr(w.word)}">✏️</button>
        <button class="wl-delete" data-word="${esc}" title="Xóa" aria-label="Xóa từ ${escAttr(w.word)}">🗑️</button>
      </div>
    </td>
  </tr>`;
}

// Gán listener cho các nút hành động trong 1 <tbody> bảng từ vựng — dùng chung
// cho cả bảng "Tất cả" (#wl-body) và bảng chi tiết thư mục (#wl-folder-body).
function wireWlRowActions(tbody) {
  tbody.querySelectorAll('.wl-folder-btn').forEach(btn => btn.addEventListener('click', () => openFolderPicker(btn.dataset.word)));
  tbody.querySelectorAll('.wl-suspend').forEach(btn => btn.addEventListener('click', () => toggleSuspend(btn.dataset.word)));
  tbody.querySelectorAll('.wl-speak').forEach(btn => btn.addEventListener('click', () => speak(btn.dataset.word)));
  tbody.querySelectorAll('.wl-edit').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.word)));
  tbody.querySelectorAll('.wl-delete').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.word)));
}

function setWlFilter(cat) { wlFilter = cat; wlPage = 1; renderWordList(true); }

// ════════════════════════════════════════════════════════
// Menu "⋯ Khác" (Xuất/Nhập JSON, Xóa tất cả) — gom lại thay vì dàn hàng nút to
// ════════════════════════════════════════════════════════
function toggleWlMoreMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('wl-more-menu');
  if (menu) menu.classList.toggle('open');
}
function closeWlMoreMenu() {
  const menu = document.getElementById('wl-more-menu');
  if (menu) menu.classList.remove('open');
}
document.addEventListener('click', (e) => {
  const menu = document.getElementById('wl-more-menu');
  if (!menu || !menu.classList.contains('open')) return;
  if (menu.contains(e.target) || e.target.closest('#wl-more-btn')) return;
  menu.classList.remove('open');
});

// Debounce search input + reset to page 1 so filtering doesn't fire a full
// re-render on every keystroke and doesn't leave the user stuck on an old page number
let wlSearchDebounceTimer = null;
function debouncedRenderWordList() {
  clearTimeout(wlSearchDebounceTimer);
  wlSearchDebounceTimer = setTimeout(() => renderWordList(true), 250);
}
