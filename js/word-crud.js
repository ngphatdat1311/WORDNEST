// ════════════════════════════════════════════════════════
// ADD WORD
// ════════════════════════════════════════════════════════
function addWord() {
  const word    = clampStr(document.getElementById('aw-word').value.trim(), 60);
  const meaning = clampStr(document.getElementById('aw-meaning').value.trim(), 200);
  if (!word || !meaning) { showToast('Cần nhập từ và nghĩa!', 'error'); return; }
  if (words.find(w => w.word.toLowerCase() === word.toLowerCase())) { showToast('Từ này đã tồn tại!', 'error'); return; }
  words.push(srsInit({
    id: genWordId(),
    word,
    phonetic: clampStr(document.getElementById('aw-phonetic').value.trim(), 80),
    meaning,
    example:  clampStr(document.getElementById('aw-example').value.trim(), 300),
    type:     document.getElementById('aw-type').value,
    category: clampStr(document.getElementById('aw-category').value.trim(), 50) || 'Chung',
    level:    document.getElementById('aw-level').value,
    mastery: 0, known: 0, seen: 0,
    addedAt: Date.now(), folderId: document.getElementById('aw-folder').value || null
  }));
  if (!saveWords()) { words.pop(); return; } // lưu thất bại (vd hết bộ nhớ) -> rút lại, không báo thành công giả
  // Reset form
  ['aw-word','aw-phonetic','aw-meaning','aw-example','aw-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('autofilled'); }
  });
  document.getElementById('aw-folder').value = '';
  const exVi = document.getElementById('aw-example-vi'); if (exVi) exVi.textContent = '';
  const altM = document.getElementById('aw-alt-meaning'); if (altM) altM.innerHTML = '';
  const speakBtn = document.getElementById('aw-speak-btn'); if (speakBtn) speakBtn.style.display = 'none';
  document.getElementById('aw-autofill-status').innerHTML = '';
  awAutoFilledValues = {};
  showToast('✅ Đã thêm từ "' + word + '"!', 'success');
  renderHome();
  renderWordList(); // đồng bộ luôn danh sách từ, tránh hiển thị stale nếu user quay lại tab Danh sách
}

// Chuẩn hoá "loại từ" gõ tay trong form Thêm hàng loạt — chấp nhận cả nhãn
// tiếng Việt ngắn gọn (vd "danh từ") lẫn mã tiếng Anh (vd "noun"), không phân
// biệt hoa/thường hay khoảng trắng thừa. Không nhận diện được thì trả về null
// để parseBulkLine() tự đoán qua khoảng trắng trong từ như trước đây (giữ
// tương thích ngược với các dòng không có phần loại từ).
const BULK_TYPE_ALIASES = {
  noun: 'noun', n: 'noun', 'danh từ': 'noun', danhtu: 'noun',
  verb: 'verb', v: 'verb', 'động từ': 'verb', dongtu: 'verb',
  adj: 'adj', adjective: 'adj', 'tính từ': 'adj', tinhtu: 'adj',
  adv: 'adv', adverb: 'adv', 'trạng từ': 'adv', trangtu: 'adv',
  phrase: 'phrase', 'cụm từ': 'phrase', cumtu: 'phrase',
  other: 'other', khác: 'other', khac: 'other',
};
function parseBulkType(raw) {
  // Bỏ ngoặc/dấu chấm bao quanh (vd "(n)", "(adj)", "v.") trước khi tra bảng —
  // người dùng hay ghi loại từ kiểu từ điển giấy như vậy.
  const key = (raw || '').trim().toLowerCase().replace(/^[([]+/, '').replace(/[)\].]+$/, '').trim();
  return BULK_TYPE_ALIASES[key] || null;
}

// Tách 1 dòng "từ | phiên âm | nghĩa | ví dụ | loại từ" (hoặc định dạng cũ
// "từ | nghĩa | ví dụ" không phiên âm/loại từ, nhận diện qua số lượng phần
// tách được) thành object. Tách riêng khỏi bulkAdd() để test được logic nhận
// diện định dạng độc lập, không phụ thuộc DOM/state toàn cục.
function parseBulkLine(line) {
  const parts = line.split('|').map(s => s.trim());
  let word, phonetic, meaning, example, typeRaw;
  if (parts.length >= 5) {
    [word, phonetic, meaning, example, typeRaw] = parts;
  } else if (parts.length >= 4) {
    [word, phonetic, meaning, example] = parts;
  } else {
    word = parts[0]; phonetic = ''; meaning = parts[1]; example = parts[2] || '';
  }
  word = clampStr(word, 60);
  // Không gõ loại từ (hoặc gõ sai) -> đoán qua khoảng trắng trong từ, giống hành vi cũ.
  const type = parseBulkType(typeRaw) || (/\s/.test(word) ? 'phrase' : 'other');
  return {
    word,
    phonetic: clampStr(phonetic, 80),
    meaning: clampStr(meaning, 200),
    example: clampStr(example, 300),
    type,
  };
}

function bulkAdd() {
  const raw = document.getElementById('aw-bulk').value.trim();
  if (!raw) { showToast('Vui lòng nhập từ!'); return; }
  const folderId = document.getElementById('aw-bulk-folder').value || null;
  const lines = raw.split('\n').filter(l => l.trim());
  const backup = words;
  words = [...words];
  let added = 0;
  lines.forEach(line => {
    const { word, phonetic, meaning, example, type } = parseBulkLine(line);
    if (!word || !meaning) return;
    if (words.find(w => w.word.toLowerCase() === word.toLowerCase())) return;
    words.push(srsInit({ id: genWordId(), word, phonetic, meaning, example, type, category:'Nhập nhanh', level:'medium', mastery:0, known:0, seen:0, addedAt: Date.now(), folderId }));
    added++;
  });
  if (!added) { showToast('Không có từ hợp lệ nào để thêm (trùng tên hoặc thiếu nghĩa)!', 'error'); return; }
  if (!saveWords()) { words = backup; showToast('⚠️ Không lưu được — bộ nhớ đầy! Không có từ nào được thêm.', 'error'); return; }
  document.getElementById('aw-bulk').value = '';
  showToast(`✅ Đã thêm ${added} từ!`, 'success');
  renderHome();
  renderWordList(); // đồng bộ luôn danh sách từ
}

// ════════════════════════════════════════════════════════
// DELETE WORD
// ════════════════════════════════════════════════════════
function confirmDelete(id) {
  const w = words.find(x => x.id === id);
  if (!w) return;
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
      <div class="cb-title" id="cb-dialog-title">Xóa từ này?</div>
      <div class="cb-word">${escHtml(w.word)}</div>
      <div class="cb-sub">${escHtml(w.meaning)}<br>Từ sẽ được chuyển vào 🗑️ Thùng rác — có thể khôi phục lại sau.</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Xóa</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // Dùng event listener, không nối chuỗi từ vào onclick inline
  document.getElementById('cb-confirm-btn').addEventListener('click', () => deleteWord(id));
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  // Focus vào nút đầu tiên khi modal mở
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}
function closeConfirm() { const el = document.getElementById('delete-overlay'); if (el) el.remove(); }

function confirmDeleteAll() {
  if (!words.length) { showToast('Từ điển đang trống!'); return; }
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
      <div class="cb-title" id="cb-dialog-title">Xóa toàn bộ từ điển?</div>
      <div class="cb-word">${words.length} từ</div>
      <div class="cb-sub">Toàn bộ từ vựng sẽ được chuyển vào 🗑️ Thùng rác — có thể khôi phục lại sau, hoặc xuất JSON để sao lưu chắc chắn hơn.</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-all-btn">Có, xóa tất cả</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-all-btn').addEventListener('click', deleteAllWords);
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}
function deleteAllWords() {
  const backupWords = words, backupTrash = trash;
  const count = words.length;
  const now = Date.now();
  trash = [...trash, ...words.map(w => ({ id: genTrashId(), type: 'word', deletedAt: now, word: w }))];
  words = [];
  closeConfirm();
  if (!saveWords() || !saveTrash()) { words = backupWords; trash = backupTrash; showToast('⚠️ Không xóa được — lỗi lưu dữ liệu!', 'error'); return; }
  showToast(`🗑️ Đã chuyển ${count} từ vào Thùng rác`);
  refreshWlView(); renderHome();
}

function deleteWord(id) {
  const idx = words.findIndex(w => w.id === id);
  if (idx === -1) { closeConfirm(); return; }
  const backupWords = words, backupTrash = trash;
  const snapshot = words[idx];
  words = words.filter(w => w.id !== id);
  trash = [...trash, { id: genTrashId(), type: 'word', deletedAt: Date.now(), word: snapshot }];
  closeConfirm();
  if (!saveWords() || !saveTrash()) { words = backupWords; trash = backupTrash; showToast('⚠️ Không xóa được — lỗi lưu dữ liệu!', 'error'); return; }
  showToast('🗑️ Đã chuyển "' + snapshot.word + '" vào Thùng rác');
  refreshWlView(); renderHome();
}

// ════════════════════════════════════════════════════════
// SUSPEND — đánh dấu từ đã thuộc hẳn, loại khỏi Flashcard/Quiz/Chính tả/SRS
// ════════════════════════════════════════════════════════
function toggleSuspend(id) {
  const idx = words.findIndex(x => x.id === id);
  if (idx === -1) return;
  words[idx].suspended = !words[idx].suspended;
  if (!saveWords()) { words[idx].suspended = !words[idx].suspended; showToast('⚠️ Không lưu được thay đổi!', 'error'); return; }
  showToast(words[idx].suspended ? '📌 Đã ẩn khỏi ôn tập' : '🔓 Đã bỏ ẩn — sẽ xuất hiện lại khi ôn tập', 'success');
  refreshWlView();
  renderHome();
}

// ════════════════════════════════════════════════════════
// EDIT WORD
// ════════════════════════════════════════════════════════
function openEditModal(id) {
  const w = words.find(x => x.id === id);
  if (!w) return;
  const old = document.getElementById('edit-overlay');
  if (old) old.remove();

  const typeOptions = ['noun','verb','adj','adv','phrase','other'];
  const typeLabels = { noun:'Danh từ (noun)', verb:'Động từ (verb)', adj:'Tính từ (adj)', adv:'Trạng từ (adv)', phrase:'Cụm từ (phrase)', other:'Khác' };
  const typeSel  = typeOptions.map(t => `<option value="${t}"${w.type === t ? ' selected' : ''}>${typeLabels[t]}</option>`).join('');
  const levelSel = ['easy','medium','hard'].map(l => `<option value="${l}"${w.level === l ? ' selected' : ''}>${l==='easy'?'Dễ (A1–A2)':l==='medium'?'Trung bình (B1–B2)':'Khó (C1–C2)'}</option>`).join('');
  const folderSel = folderOptionsHtml(w.folderId);
  const masteryLabels = ['Chưa thuộc (0)', 'Mới biết (1)', 'Khá thuộc (2)', 'Đã thuộc (3)'];
  const masterySel = [0,1,2,3].map(m => `<option value="${m}"${ (w.mastery||0) === m ? ' selected' : ''}>${masteryLabels[m]}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  overlay.id = 'edit-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'edit-dialog-title');
  // Dùng escAttr() cho mọi value attribute để tránh XSS / phá vỡ attribute
  overlay.innerHTML = `
    <div class="edit-box">
      <div class="eb-title" id="edit-dialog-title">
        <span>✏️ Sửa từ: <em>${escHtml(w.word)}</em></span>
        <button class="eb-close" id="eb-close-btn">✕</button>
      </div>
      <div class="edit-form-grid">
        <div class="edit-row">
          <div class="edit-group"><label>Từ tiếng Anh</label><input class="form-input" id="ew-word" value="${escAttr(w.word)}"></div>
          <div class="edit-group"><label>Phiên âm</label><input class="form-input" id="ew-phonetic" value="${escAttr(w.phonetic||'')}"></div>
        </div>
        <div class="edit-group"><label>Nghĩa tiếng Việt *</label><input class="form-input" id="ew-meaning" value="${escAttr(w.meaning)}"></div>
        <div class="edit-group"><label>Ví dụ câu</label><input class="form-input" id="ew-example" value="${escAttr(w.example||'')}"></div>
        <div class="edit-row">
          <div class="edit-group"><label>Chủ đề / Bộ từ</label><input class="form-input" id="ew-category" value="${escAttr(w.category||'')}"></div>
          <div class="edit-group"><label>Loại từ</label><select class="form-select" id="ew-type">${typeSel}</select></div>
        </div>
        <div class="edit-row">
          <div class="edit-group"><label>Mức độ khó</label><select class="form-select" id="ew-level">${levelSel}</select></div>
          <div class="edit-group"><label>📁 Thư mục</label><select class="form-select" id="ew-folder">${folderSel}</select></div>
        </div>
        <div class="edit-row">
          <div class="edit-group"><label>Mức độ thuộc</label><select class="form-select" id="ew-mastery">${masterySel}</select></div>
          <div class="edit-group"><label>Ngày thêm</label><div style="font-size:0.85rem;color:var(--text3);padding:9px 0;">${w.addedAt ? formatAddedAt(w.addedAt) : 'Không rõ (từ cũ)'}</div></div>
        </div>
        <div class="edit-group">
          <label class="ew-suspend-label">
            <input type="checkbox" id="ew-suspended"${w.suspended ? ' checked' : ''}>
            <span>📌 Đã thuộc hẳn — ẩn khỏi Flashcard/Quiz/Chính tả</span>
          </label>
        </div>
      </div>
      <div class="edit-btns">
        <button class="btn btn-outline" id="eb-cancel-btn">Hủy</button>
        <button class="btn" id="eb-save-btn">💾 Lưu thay đổi</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('eb-save-btn').addEventListener('click', () => saveEditWord(id));
  document.getElementById('eb-close-btn').addEventListener('click', closeEditModal);
  document.getElementById('eb-cancel-btn').addEventListener('click', closeEditModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeEditModal(); });
  // Focus vào field đầu tiên khi edit modal mở
  setTimeout(() => { const el = document.getElementById('ew-word'); if (el) el.focus(); }, 50);
}
function closeEditModal() { const el = document.getElementById('edit-overlay'); if (el) el.remove(); }

// ── UNDO ──
let _undoTimer = null;
function showUndoToast(msg, onUndo) {
  const t = document.getElementById('undo-toast');
  if (!t) return;
  clearTimeout(_undoTimer);
  t.querySelector('#undo-label').textContent = msg;
  t.classList.add('show');
  t.querySelector('#undo-btn').onclick = () => {
    clearTimeout(_undoTimer);
    t.classList.remove('show');
    onUndo();
  };
  _undoTimer = setTimeout(() => t.classList.remove('show'), 5000);
}

function saveEditWord(id) {
  const idx = words.findIndex(x => x.id === id);
  if (idx === -1) return;
  const originalWord = words[idx].word;
  const newWord    = clampStr(document.getElementById('ew-word').value.trim(), 60);
  const newMeaning = clampStr(document.getElementById('ew-meaning').value.trim(), 200);
  if (!newWord || !newMeaning) { showToast('Cần có từ và nghĩa!', 'error'); return; }
  if (newWord.toLowerCase() !== originalWord.toLowerCase() && words.find(w => w.word.toLowerCase() === newWord.toLowerCase())) {
    showToast('Từ "' + newWord + '" đã tồn tại!', 'error'); return;
  }
  const backup = words[idx];
  words[idx] = {
    ...words[idx],
    word:     newWord,
    phonetic: clampStr(document.getElementById('ew-phonetic').value.trim(), 80),
    meaning:  newMeaning,
    example:  clampStr(document.getElementById('ew-example').value.trim(), 300),
    category: clampStr(document.getElementById('ew-category').value.trim(), 50) || 'Chung',
    type:     document.getElementById('ew-type').value,
    level:    document.getElementById('ew-level').value,
    suspended: document.getElementById('ew-suspended').checked,
    folderId: document.getElementById('ew-folder').value || null,
    mastery: Math.max(0, Math.min(3, parseInt(document.getElementById('ew-mastery').value, 10) || 0)),
  };
  if (!saveWords()) { words[idx] = backup; showToast('⚠️ Không lưu được thay đổi!', 'error'); return; }
  closeEditModal();
  refreshWlView(); renderHome();
  // Undo: khôi phục lại trạng thái cũ trong vòng 5 giây — tìm lại theo id (ổn định
  // dù đã đổi tên), không cần tìm theo word MỚI như trước.
  showUndoToast('✅ Đã sửa "' + newWord + '"', () => {
    const ri = words.findIndex(x => x.id === id);
    if (ri === -1) { showToast('⚠️ Không hoàn tác được — từ đã bị xóa', 'error'); return; }
    words[ri] = { ...backup };
    if (!saveWords()) { showToast('⚠️ Hoàn tác thất bại!', 'error'); return; }
    showToast('↩️ Đã hoàn tác!', 'success');
    refreshWlView(); renderHome();
  });
}

// ════════════════════════════════════════════════════════
// PHÂN LOẠI LẠI TỪ CHƯA RÕ LOẠI — quét toàn bộ từ đang có type 'other' (thường
// do Thêm hàng loạt không ghi loại từ), tự tra dictionaryapi.dev để xác định
// đúng danh/động/tính/trạng từ. CHỈ sửa field `type` — không đụng tới nghĩa/
// phiên âm/ví dụ/chủ đề người dùng đã nhập, tôn trọng dữ liệu có sẵn.
// ════════════════════════════════════════════════════════
// Trả về: mã loại từ ('noun'/'verb'/...) nếu tra được, null nếu từ điển không
// có/không xác định được (khác hẳn với bị giới hạn tốc độ — xem 'rate-limited'
// bên dưới, để reclassifyUnclearWords() báo đúng nguyên nhân cho người dùng).
async function fetchWordType(word, signal) {
  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });
    if (resp.status === 429) return 'rate-limited'; // dictionaryapi.dev giới hạn tốc độ — KHÁC với "không tìm thấy"
    if (!resp.ok) return null;
    const entries = await resp.json();
    const entry = Array.isArray(entries) && entries.length ? entries[0] : null;
    if (!entry) return null;
    const pos = pickDominantPos(entry);
    return pos && pos !== 'other' ? pos : null; // null = từ điển không xác định được, giữ nguyên 'other'
  } catch {
    return null; // mất mạng/timeout — bỏ qua từ này, không chặn cả lô
  }
}

// Tra 1 từ, tự thử lại (nghỉ tăng dần) nếu bị giới hạn tốc độ — dictionaryapi.dev
// giới hạn khá thấp, giới hạn ngắn hạn nên chờ 1 chút rồi thử lại thường qua được.
async function fetchWordTypeWithRetry(word) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const result = await fetchWordType(word, controller.signal);
    clearTimeout(timer);
    if (result !== 'rate-limited') return result;
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); // 2s rồi 4s
  }
  return 'rate-limited';
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} giây`;
  const min = Math.floor(totalSec / 60), sec = totalSec % 60;
  return sec ? `${min} phút ${sec} giây` : `${min} phút`;
}

function confirmReclassifyUnclearWords() {
  const targets = words.filter(w => w.type === 'other');
  if (!targets.length) { showToast('Không có từ nào chưa rõ loại từ!'); return; }
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
      <div class="cb-icon">🔍</div>
      <div class="cb-title" id="cb-dialog-title">Phân loại lại từ chưa rõ?</div>
      <div class="cb-sub" id="reclassify-msg">Tìm thấy <strong>${targets.length}</strong> từ chưa rõ loại từ. App sẽ tự tra từ điển để xác định đúng danh từ/động từ/tính từ/trạng từ — chỉ sửa loại từ, không đổi nghĩa/phiên âm/ví dụ bạn đã nhập. Tra chậm rãi từng từ (đỡ bị nguồn tra từ giới hạn tốc độ), dự kiến khoảng ${formatDuration(targets.length * 700)}.</div>
      <div class="reclassify-progress" id="reclassify-progress" style="display:none;">
        <div class="prog-bar"><div class="prog-fill" id="reclassify-prog-fill" style="width:0%"></div></div>
        <div class="prog-text" id="reclassify-prog-text">0 / ${targets.length} từ</div>
      </div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Bắt đầu</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-btn').addEventListener('click', () => startReclassifyProgress(targets));
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
}

let reclassifyCancelRequested = false;

// Chuyển hộp thoại xác nhận sang chế độ hiện THANH TIẾN ĐỘ ngay trong hộp thoại
// đó — thay vì bắn hàng loạt toast (mỗi toast tự ẩn sau ~2.6s rồi toast mới lại
// hiện, tạo cảm giác nhấp nháy khó chịu khi cập nhật liên tục trong quá trình
// chạy dài cả phút).
function startReclassifyProgress(targets) {
  reclassifyCancelRequested = false;
  const msgEl = document.getElementById('reclassify-msg');
  const progressEl = document.getElementById('reclassify-progress');
  const btnsEl = document.querySelector('#delete-overlay .cb-btns');
  if (msgEl) msgEl.textContent = 'Đang tra từ điển, xin đợi chút...';
  if (progressEl) progressEl.style.display = '';
  if (btnsEl) btnsEl.innerHTML = '<button class="cb-cancel" id="reclassify-stop-btn">⏹ Dừng lại</button>';
  const stopBtn = document.getElementById('reclassify-stop-btn');
  if (stopBtn) stopBtn.addEventListener('click', () => {
    reclassifyCancelRequested = true;
    stopBtn.disabled = true;
    stopBtn.textContent = 'Đang dừng...';
  });
  runReclassifyLoop(targets);
}

async function runReclassifyLoop(targets) {
  const total = targets.length;
  const startedAt = performance.now();
  let fixed = 0, notFound = 0, rateLimited = 0, processed = 0;

  // Tra TUẦN TỰ (không song song) + nghỉ giữa mỗi từ — dictionaryapi.dev giới
  // hạn tốc độ khá thấp, tra dồn dập (kể cả chỉ 2 luồng song song) với batch lớn
  // (100+ từ) vẫn dễ chạm trần ngay từ đầu. Chậm hơn nhưng tra được nhiều hơn hẳn.
  for (let i = 0; i < targets.length; i++) {
    if (reclassifyCancelRequested) break;
    const target = targets[i];
    const result = await fetchWordTypeWithRetry(target.word);
    if (reclassifyCancelRequested) break; // user bấm Dừng lại trong lúc đang chờ kết quả từ này
    const idx = words.findIndex(x => x.id === target.id);
    if (idx !== -1) {
      if (result === 'rate-limited') rateLimited++;
      else if (result) { words[idx].type = result; fixed++; }
      else notFound++;
    }
    processed++;

    const fillEl = document.getElementById('reclassify-prog-fill');
    const textEl = document.getElementById('reclassify-prog-text');
    if (fillEl) fillEl.style.width = Math.round((processed / total) * 100) + '%';
    if (textEl) {
      const elapsedMs = performance.now() - startedAt;
      const remainingMs = (elapsedMs / processed) * (total - processed);
      textEl.textContent = processed < total
        ? `${processed} / ${total} từ — còn khoảng ${formatDuration(remainingMs)}`
        : `${processed} / ${total} từ`;
    }

    if (i < targets.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  if (fixed) saveWords();
  refreshWlView();
  showReclassifyResult({ fixed, notFound, rateLimited, total, processed, cancelled: reclassifyCancelRequested });
}

// Hiện kết quả cuối NGAY TRONG hộp thoại (thay thanh tiến độ) — nếu user đã tự
// đóng hộp thoại giữa chừng thì bỏ qua phần UI (việc tra vẫn chạy ngầm và lưu
// bình thường, chỉ là không còn gì để cập nhật lên màn hình nữa).
function showReclassifyResult({ fixed, notFound, rateLimited, total, processed, cancelled }) {
  const overlay = document.getElementById('delete-overlay');
  if (!overlay) return;
  const msgEl = document.getElementById('reclassify-msg');
  const progressEl = document.getElementById('reclassify-progress');
  const btnsEl = overlay.querySelector('.cb-btns');
  const titleEl = document.getElementById('cb-dialog-title');
  if (titleEl) titleEl.textContent = cancelled ? 'Đã dừng lại' : 'Hoàn tất!';
  if (progressEl) progressEl.style.display = 'none';
  const extras = [];
  if (notFound) extras.push(`${notFound} từ điển không tìm thấy`);
  if (rateLimited) extras.push(`${rateLimited} bị giới hạn tốc độ — thử lại sau vài phút`);
  if (cancelled && processed < total) extras.push(`${total - processed} từ chưa kịp tra`);
  if (msgEl) msgEl.innerHTML = `Đã phân loại lại <strong>${fixed}/${total}</strong> từ.${extras.length ? '<br>' + escHtml(extras.join(', ')) + '.' : ''}`;
  if (btnsEl) btnsEl.innerHTML = '<button class="cb-confirm" id="reclassify-close-btn">Đóng</button>';
  const closeBtn = document.getElementById('reclassify-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeConfirm);
}
