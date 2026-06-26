// ════════════════════════════════════════════════════════
// WORD LIST
// ════════════════════════════════════════════════════════
let wlFilter = 'all';
let wlPage = 1;
const WL_PAGE_SIZE = 30;

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

  // Sắp xếp theo lựa chọn
  if (sortVal === 'az')           list = list.slice().sort((a,b) => a.word.localeCompare(b.word));
  else if (sortVal === 'za')      list = list.slice().sort((a,b) => b.word.localeCompare(a.word));
  else if (sortVal === 'mastery_desc') list = list.slice().sort((a,b) => (b.mastery||0) - (a.mastery||0));
  else if (sortVal === 'mastery_asc')  list = list.slice().sort((a,b) => (a.mastery||0) - (b.mastery||0));
  else if (sortVal === 'seen_desc')    list = list.slice().sort((a,b) => (b.seen||0) - (a.seen||0));

  const tbody = document.getElementById('wl-body');
  const pagEl = document.getElementById('wl-pagination');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)">Không tìm thấy từ nào 📭</td></tr>';
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  // Phân trang 30 từ/trang để tránh render chậm với 500+ từ
  const totalPages = Math.ceil(list.length / WL_PAGE_SIZE);
  if (wlPage > totalPages) wlPage = totalPages;
  const paginated = list.slice((wlPage - 1) * WL_PAGE_SIZE, wlPage * WL_PAGE_SIZE);

  tbody.innerHTML = paginated.map(w => {
    const dots = [0,1,2,3].map(i => `<div class="wl-dot${i < w.mastery ? ' filled' : ''}"></div>`).join('');
    // Dùng data-word attribute thay vì nối chuỗi vào onclick
    const esc = escAttr(w.word);
    return `<tr class="${w.suspended ? 'wl-row-suspended' : ''}">
      <td><div class="wl-word">${escHtml(w.word)}</div><div class="wl-phon">${escHtml(w.phonetic || '')}</div></td>
      <td><div class="wl-meaning">${escHtml(w.meaning)}</div><div class="wl-example">${escHtml(w.example || '')}</div></td>
      <td><span class="wl-type">${escHtml(w.category || 'Khác')}</span></td>
      <td><div class="wl-mastery">${dots}</div></td>
      <td><button class="wl-suspend${w.suspended ? ' active' : ''}" data-word="${esc}" onclick="toggleSuspend(this.dataset.word)" title="${w.suspended ? 'Bỏ ẩn — đưa lại vào ôn tập' : 'Đã thuộc hẳn — ẩn khỏi ôn tập'}" aria-label="Ẩn/bỏ ẩn ${escAttr(w.word)}">${w.suspended ? '🔒' : '📌'}</button></td>
      <td><button class="wl-speak" data-word="${esc}" onclick="speak(this.dataset.word)" aria-label="Phát âm ${escAttr(w.word)}">🔊</button></td>
      <td><button class="wl-edit"   data-word="${esc}" onclick="openEditModal(this.dataset.word)" title="Sửa" aria-label="Sửa từ ${escAttr(w.word)}">✏️</button></td>
      <td><button class="wl-delete" data-word="${esc}" onclick="confirmDelete(this.dataset.word)" title="Xóa" aria-label="Xóa từ ${escAttr(w.word)}">🗑️</button></td>
    </tr>`;
  }).join('');

  // Render pagination controls
  if (pagEl && totalPages > 1) {
    let pagHtml = `<span style="font-size:0.8rem;color:var(--text3);align-self:center;">${list.length} từ — Trang ${wlPage}/${totalPages}</span>`;
    if (wlPage > 1) pagHtml += `<button class="btn btn-outline" onclick="wlPage--;renderWordList()" style="padding:5px 12px;font-size:0.8rem;">← Trước</button>`;
    if (wlPage < totalPages) pagHtml += `<button class="btn btn-outline" onclick="wlPage++;renderWordList()" style="padding:5px 12px;font-size:0.8rem;">Tiếp →</button>`;
    pagEl.innerHTML = pagHtml;
  } else if (pagEl) {
    pagEl.innerHTML = '';
  }
}

function setWlFilter(cat) { wlFilter = cat; wlPage = 1; renderWordList(true); }

// Debounce search input + reset to page 1 so filtering doesn't fire a full
// re-render on every keystroke and doesn't leave the user stuck on an old page number
let wlSearchDebounceTimer = null;
function debouncedRenderWordList() {
  clearTimeout(wlSearchDebounceTimer);
  wlSearchDebounceTimer = setTimeout(() => renderWordList(true), 250);
}
