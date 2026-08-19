// ════════════════════════════════════════════════════════
// ADD WORD
// ════════════════════════════════════════════════════════
// Xóa sạch form Thêm từ sau khi thêm thành công (hoặc sau khi gắn thêm thư mục
// cho 1 từ đã có sẵn — xem addWord()) — tách riêng để dùng lại ở cả 2 nhánh.
function resetAddWordForm() {
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
}
function addWord() {
  const word    = clampStr(document.getElementById('aw-word').value.trim(), 60);
  const meaning = clampStr(document.getElementById('aw-meaning').value.trim(), 200);
  if (!word || !meaning) { showToast('Cần nhập từ và nghĩa!', 'error'); return; }
  const folderId = document.getElementById('aw-folder').value || null;
  const dupIdx = words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
  if (dupIdx !== -1) {
    // Từ đã tồn tại. Trước đây chặn thẳng (hoặc gắn thêm thư mục ÂM THẦM không
    // hỏi) — giờ luôn hỏi lại rõ ràng: hiện từ đó đang thuộc thư mục nào, có
    // muốn tiếp tục gắn thêm thư mục mới không. Xem confirmDuplicateWordAdd().
    confirmDuplicateWordAdd(dupIdx, folderId);
    return;
  }
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
    // Chỉ chọn được 1 thư mục ngay lúc thêm (giữ form đơn giản) — muốn gắn thêm
    // thư mục khác nữa thì dùng nút 📁 trên bảng Từ điển sau khi đã thêm từ.
    addedAt: Date.now(), folderIds: folderId ? [folderId] : []
  }));
  if (!saveWords()) { words.pop(); return; } // lưu thất bại (vd hết bộ nhớ) -> rút lại, không báo thành công giả
  resetAddWordForm();
  showToast('✅ Đã thêm từ "' + word + '"!', 'success');
  renderHome();
  renderWordList(); // đồng bộ luôn danh sách từ, tránh hiển thị stale nếu user quay lại tab Danh sách
}

// Gắn thêm 1 thư mục vào từ đã có sẵn ở words[idx] (KHÔNG tạo bản ghi mới —
// word vẫn là định danh duy nhất). Dùng reassign object mới (không mutate tại
// chỗ) để rollback đúng nếu saveWords() lỗi. Trả về true/false theo kết quả lưu.
function mergeWordFolder(idx, folderId) {
  const w = words[idx];
  const old = w.folderIds || [];
  words[idx] = { ...w, folderIds: [...old, folderId] };
  if (!saveWords()) { words[idx] = { ...words[idx], folderIds: old }; showToast('⚠️ Không lưu được!', 'error'); return false; }
  return true;
}

// Hỏi lại khi Thêm từ (đơn lẻ) gặp từ trùng tên — hiện rõ từ đó ĐANG thuộc thư
// mục nào (có thể nhiều), rồi mới hỏi có muốn tiếp tục gắn thêm thư mục mới
// (nếu form có chọn thư mục và từ đó chưa thuộc thư mục đó) hay không. Không
// chọn thư mục, hoặc thư mục đã gắn sẵn rồi -> chỉ hiện thông tin, không có gì
// để làm thêm (nút "Đóng" thay vì "Hủy"/"Tiếp tục").
function confirmDuplicateWordAdd(dupIdx, folderId) {
  const w = words[dupIdx];
  const existingNames = wordFolders(w).map(f => f.name);
  const newFolder = folderId ? folders.find(f => f.id === folderId) : null;
  const alreadyHas = newFolder && existingNames.includes(newFolder.name);
  const canMerge = !!(newFolder && !alreadyHas);

  const old = document.getElementById('dup-word-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'dup-word-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'dup-word-title');
  const folderText = existingNames.length ? escHtml(existingNames.join(', ')) : 'chưa thuộc thư mục nào';
  let subHtml = `Từ này hiện thuộc thư mục: <strong>${folderText}</strong>.`;
  if (canMerge) subHtml += `<br><br>Bạn có muốn gắn thêm vào thư mục <strong>${escHtml(newFolder.name)}</strong> không?`;
  else if (newFolder && alreadyHas) subHtml += `<br><br>Từ này đã thuộc thư mục "${escHtml(newFolder.name)}" rồi.`;
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="cb-icon">⚠️</div>
      <div class="cb-title" id="dup-word-title">Từ đã tồn tại</div>
      <div class="cb-word">${escHtml(w.word)}</div>
      <div class="cb-sub">${subHtml}</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="dup-word-cancel-btn">${canMerge ? 'Hủy' : 'Đóng'}</button>
        ${canMerge ? '<button class="cb-confirm" id="dup-word-confirm-btn">Tiếp tục</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('dup-word-cancel-btn').addEventListener('click', closeDuplicateWordConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeDuplicateWordConfirm(); });
  if (canMerge) {
    document.getElementById('dup-word-confirm-btn').addEventListener('click', () => {
      closeDuplicateWordConfirm();
      if (!mergeWordFolder(dupIdx, folderId)) return;
      showToast(`⚠️ Từ "${w.word}" đã có sẵn — đã gắn thêm vào thư mục "${newFolder.name}"!`, 'success');
      resetAddWordForm();
      renderHome();
      renderWordList();
    });
  }
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}
function closeDuplicateWordConfirm() { const el = document.getElementById('dup-word-overlay'); if (el) el.remove(); }

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

// Đọc & phân loại các dòng nhập trong ô Thêm hàng loạt thành 2 nhóm: từ MỚI
// (chưa có trong từ điển, kể cả trùng nhau NGAY TRONG chính danh sách đang dán
// — chỉ dòng đầu tiên được tính là mới) và từ TRÙNG (đã có sẵn trong từ điển
// từ trước). Tách riêng để test độc lập, không phụ thuộc DOM/state toàn cục
// ngoài `words`.
function classifyBulkLines(lines, folderId) {
  const seen = new Set();
  const newItems = [];
  const dupItems = []; // { word, folderNames, inBatch, alreadyHasFolder }
  lines.forEach(line => {
    const { word, phonetic, meaning, example, type } = parseBulkLine(line);
    if (!word || !meaning) return;
    const lc = word.toLowerCase();
    if (seen.has(lc)) { dupItems.push({ word, folderNames: [], inBatch: true, alreadyHasFolder: false }); return; }
    const existing = words.find(w => w.word.toLowerCase() === lc);
    if (existing) {
      dupItems.push({
        word,
        folderNames: wordFolders(existing).map(f => f.name),
        inBatch: false,
        alreadyHasFolder: !!(folderId && (existing.folderIds || []).includes(folderId)),
      });
      return;
    }
    seen.add(lc);
    newItems.push({ word, phonetic, meaning, example, type });
  });
  return { newItems, dupItems };
}

function bulkAdd() {
  const raw = document.getElementById('aw-bulk').value.trim();
  if (!raw) { showToast('Vui lòng nhập từ!'); return; }
  const folderId = document.getElementById('aw-bulk-folder').value || null;
  const lines = raw.split('\n').filter(l => l.trim());
  const { newItems, dupItems } = classifyBulkLines(lines, folderId);
  if (!newItems.length && !dupItems.length) { showToast('Không có từ hợp lệ nào để thêm (trùng tên hoặc thiếu nghĩa)!', 'error'); return; }
  // Chỉ hỏi lại khi có từ trùng cần cảnh báo — không có gì bất ngờ thì thêm
  // thẳng luôn như trước, đỡ phải bấm thêm 1 bước cho trường hợp phổ biến nhất.
  if (dupItems.length) confirmBulkDuplicates(newItems, dupItems, folderId);
  else commitBulkAdd(newItems, dupItems, folderId);
}

// Hỏi lại khi Thêm hàng loạt phát hiện 1+ từ đã trùng — liệt kê ĐẦY ĐỦ từng từ
// bị trùng (kèm thư mục hiện có của nó) thay vì chỉ báo 1 con số chung chung,
// rồi mới hỏi có muốn tiếp tục (thêm từ mới + gắn thêm thư mục cho từ trùng
// chưa thuộc thư mục vừa chọn) hay không.
function confirmBulkDuplicates(newItems, dupItems, folderId) {
  const willAdd = newItems.length;
  const willMerge = folderId ? dupItems.filter(d => !d.inBatch && !d.alreadyHasFolder).length : 0;
  const canProceed = willAdd > 0 || willMerge > 0;
  const folderName = folderId ? (folders.find(f => f.id === folderId) || {}).name || '' : '';

  const rows = dupItems.map(d => {
    let note;
    if (d.inBatch) note = 'trùng lặp trong chính danh sách bạn vừa dán';
    else if (!d.folderNames.length) note = 'đã có trong từ điển, chưa thuộc thư mục nào';
    else note = 'đã thuộc: ' + d.folderNames.join(', ');
    if (folderId && !d.inBatch && d.alreadyHasFolder) note += ` (đã có thư mục "${folderName}" rồi)`;
    return `<div class="dup-list-row"><span class="dup-list-word">${escHtml(d.word)}</span><span class="dup-list-note">${escHtml(note)}</span></div>`;
  }).join('');

  const summaryParts = [];
  if (willAdd) summaryParts.push(`thêm <strong>${willAdd}</strong> từ mới`);
  if (willMerge) summaryParts.push(`gắn thêm thư mục "${escHtml(folderName)}" cho <strong>${willMerge}</strong> từ đã có`);

  const old = document.getElementById('bulk-dup-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'bulk-dup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'bulk-dup-title');
  overlay.innerHTML = `
    <div class="confirm-box folder-pick-box">
      <div class="cb-icon">⚠️</div>
      <div class="cb-title" id="bulk-dup-title">${dupItems.length} từ đã trùng</div>
      <div class="cb-sub" style="margin-bottom:8px;">Trong danh sách bạn nhập có <strong>${dupItems.length}</strong> từ đã tồn tại:</div>
      <div class="folder-bulk-list">${rows}</div>
      <div class="cb-sub" style="margin-top:10px;">
        ${canProceed ? `Sẽ ${summaryParts.join(', ')}. Bạn có muốn tiếp tục không?` : 'Không có gì để thêm hoặc thay đổi.'}
      </div>
      <div class="cb-btns">
        <button class="cb-cancel" id="bulk-dup-cancel-btn">${canProceed ? 'Hủy' : 'Đóng'}</button>
        ${canProceed ? '<button class="cb-confirm" id="bulk-dup-confirm-btn">Tiếp tục</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('bulk-dup-cancel-btn').addEventListener('click', closeBulkDupConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeBulkDupConfirm(); });
  if (canProceed) {
    document.getElementById('bulk-dup-confirm-btn').addEventListener('click', () => {
      closeBulkDupConfirm();
      commitBulkAdd(newItems, dupItems, folderId);
    });
  }
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}
function closeBulkDupConfirm() { const el = document.getElementById('bulk-dup-overlay'); if (el) el.remove(); }

// Thực sự ghi vào words[] — được gọi thẳng từ bulkAdd() khi không có từ nào
// trùng, hoặc sau khi user bấm "Tiếp tục" ở confirmBulkDuplicates().
function commitBulkAdd(newItems, dupItems, folderId) {
  const backup = words;
  words = [...words];
  // Mỗi từ có mảng folderIds RIÊNG (không dùng chung 1 tham chiếu mảng cho cả
  // batch) — tránh việc sửa thư mục của 1 từ sau này vô tình ảnh hưởng tới các
  // từ khác cùng thêm hàng loạt 1 lượt.
  newItems.forEach(item => {
    words.push(srsInit({ id: genWordId(), ...item, category:'Nhập nhanh', level:'medium', mastery:0, known:0, seen:0, addedAt: Date.now(), folderIds: folderId ? [folderId] : [] }));
  });
  // Tìm lại theo TEXT (không dùng index đã tính từ lúc classify) — an toàn hơn
  // nếu words[] đổi giữa lúc mở dialog và lúc user bấm Tiếp tục (vd đồng bộ nền).
  let merged = 0;
  if (folderId) {
    dupItems.forEach(({ word, inBatch }) => {
      if (inBatch) return; // dòng lặp lại trong chính batch — dòng đầu đã tạo mới với đúng folderId rồi
      const idx = words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
      if (idx === -1) return;
      if (!(words[idx].folderIds || []).includes(folderId)) {
        words[idx] = { ...words[idx], folderIds: [...(words[idx].folderIds || []), folderId] };
        merged++;
      }
    });
  }
  if (!newItems.length && !merged) { words = backup; showToast('Không có thay đổi nào để lưu.'); return; }
  if (!saveWords()) { words = backup; showToast('⚠️ Không lưu được — bộ nhớ đầy! Không có từ nào được thêm.', 'error'); return; }
  document.getElementById('aw-bulk').value = '';
  const parts = [];
  if (newItems.length) parts.push(`thêm ${newItems.length} từ mới`);
  if (merged) {
    const folderName = (folders.find(f => f.id === folderId) || {}).name || '';
    parts.push(`gắn thêm thư mục "${folderName}" cho ${merged} từ đã có`);
  }
  showToast(`✅ Đã ${parts.join(', ')}!`, 'success');
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
  // Quản lý thư mục KHÔNG còn nằm ở đây (1 từ có thể thuộc nhiều thư mục cùng
  // lúc — dropdown chọn 1 sẽ vô tình làm mất bớt thư mục khi Lưu) — chỉ hiện đọc,
  // trỏ sang nút 📁 trên bảng Từ điển (đã hỗ trợ chọn nhiều, xem folders.js).
  const wFolderNames = wordFolders(w).map(f => f.name);
  const folderReadout = wFolderNames.length ? wFolderNames.map(n => `📁 ${escHtml(n)}`).join(', ') : '<span style="color:var(--text3);">Chưa có thư mục</span>';
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
          <div class="edit-group"><label>📁 Thư mục</label><div style="font-size:0.85rem;padding:9px 0;">${folderReadout}<br><span style="font-size:0.76rem;color:var(--text3);">Dùng nút 📁 trên bảng Từ điển để đổi (chọn được nhiều thư mục)</span></div></div>
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
    // folderIds KHÔNG đụng ở đây — modal Sửa từ không còn quản lý thư mục (xem
    // openEditModal), giữ nguyên giá trị hiện có nhờ spread ...words[idx] ở trên.
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
// BATCH-FIX TOOLS (dùng chung) — quét 1 tập từ, tuần tự gọi API ngoài để tự
// điền/sửa 1 field còn thiếu/chưa rõ, hiện tiến độ NGAY TRONG hộp thoại xác
// nhận (không bắn hàng loạt toast gây nhấp nháy). Dùng chung cho "Phân loại
// lại từ chưa rõ" (field type) và "Tự động điền phiên âm còn thiếu" (field
// phonetic) — khác nhau ở predicate lọc/hàm tra API/hàm áp kết quả, còn lại
// (tra tuần tự + nghỉ giữa mỗi từ + tự retry khi rate-limit + progress UI +
// nút Dừng lại) giống hệt nhau nên tách ra đây một lần, dùng lại cho cả 2.
// ════════════════════════════════════════════════════════
function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} giây`;
  const min = Math.floor(totalSec / 60), sec = totalSec % 60;
  return sec ? `${min} phút ${sec} giây` : `${min} phút`;
}

// Đếm số lần confirmBatchFix() được mở, dùng làm "mã định danh" cho từng lượt
// chạy (runId) — xem comment trong confirmBatchFix() bên dưới.
let batchFixRunSeq = 0;

// cfg: { icon, title, targets, emptyMsg, descriptionHtml, fetchFn, applyFn,
//        doneLabel, notFoundLabel } — fetchFn(word) trả 'rate-limited' | falsy
// (không xác định được) | giá trị cần áp; applyFn(wordObj, result) tự mutate
// đúng field cần sửa trên bản ghi trong words[].
function confirmBatchFix(cfg) {
  if (!cfg.targets.length) { showToast(cfg.emptyMsg); return; }
  const old = document.getElementById('delete-overlay');
  if (old) old.remove();
  // runId gắn vào chính overlay (data-bf-run) — cả 2 tool batch-fix (phân loại
  // lại + phiên âm) dùng CHUNG 1 bộ id DOM ('delete-overlay'/'bf-*'), nên nếu
  // user đóng hộp thoại của tool A giữa chừng (loop vẫn chạy ngầm) rồi mở tool
  // B, các lần cập nhật UI/kết quả TRỄ của tool A phải tự nhận ra dialog hiện
  // tại không còn phải của mình nữa (runId không khớp) để bỏ qua, tránh ghi đè
  // nhầm lên tiêu đề/nội dung/nút Dừng của tool B đang hiển thị.
  const runId = ++batchFixRunSeq;
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'delete-overlay';
  overlay.dataset.bfRun = String(runId);
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cb-dialog-title');
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="cb-icon">${cfg.icon}</div>
      <div class="cb-title" id="cb-dialog-title">${escHtml(cfg.title)}</div>
      <div class="cb-sub" id="bf-msg">${cfg.descriptionHtml}</div>
      <div class="reclassify-progress" id="bf-progress" style="display:none;">
        <div class="prog-bar"><div class="prog-fill" id="bf-prog-fill" style="width:0%"></div></div>
        <div class="prog-text" id="bf-prog-text">0 / ${cfg.targets.length} từ</div>
      </div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Bắt đầu</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-btn').addEventListener('click', () => startBatchFixProgress(cfg, runId));
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
}

// true nếu hộp thoại 'delete-overlay' hiện đang hiển thị trên trang vẫn đúng
// là hộp thoại của lượt chạy runId này (chưa bị đóng/thay bằng 1 lượt batch-fix
// khác) — dùng để chặn loop cũ ghi đè UI của loop mới hơn, xem confirmBatchFix().
function isBatchFixDialogActive(runId) {
  const overlay = document.getElementById('delete-overlay');
  return !!overlay && overlay.dataset.bfRun === String(runId);
}

// Chuyển hộp thoại xác nhận sang chế độ hiện THANH TIẾN ĐỘ ngay trong hộp thoại
// đó — thay vì bắn hàng loạt toast (mỗi toast tự ẩn sau ~2.6s rồi toast mới lại
// hiện, tạo cảm giác nhấp nháy khó chịu khi cập nhật liên tục trong quá trình
// chạy dài cả phút).
function startBatchFixProgress(cfg, runId) {
  // Cờ Dừng riêng cho TỪNG lượt chạy (không dùng biến module dùng chung nữa) —
  // để bấm "Dừng lại" ở tool đang mở không lỡ dừng luôn 1 tool khác đang chạy
  // ngầm phía sau (xem comment runId ở confirmBatchFix()).
  const cancelFlag = { value: false };
  const msgEl = document.getElementById('bf-msg');
  const progressEl = document.getElementById('bf-progress');
  const btnsEl = document.querySelector('#delete-overlay .cb-btns');
  if (msgEl) msgEl.textContent = 'Đang tra từ điển, xin đợi chút...';
  if (progressEl) progressEl.style.display = '';
  if (btnsEl) btnsEl.innerHTML = '<button class="cb-cancel" id="bf-stop-btn">⏹ Dừng lại</button>';
  const stopBtn = document.getElementById('bf-stop-btn');
  if (stopBtn) stopBtn.addEventListener('click', () => {
    cancelFlag.value = true;
    stopBtn.disabled = true;
    stopBtn.textContent = 'Đang dừng...';
  });
  runBatchFixLoop(cfg, runId, cancelFlag);
}

async function runBatchFixLoop(cfg, runId, cancelFlag) {
  const { targets, fetchFn, applyFn } = cfg;
  const total = targets.length;
  const startedAt = performance.now();
  let fixed = 0, notFound = 0, rateLimited = 0, processed = 0;

  // Tra TUẦN TỰ (không song song) + nghỉ giữa mỗi từ — nguồn tra giới hạn tốc
  // độ khá thấp, tra dồn dập (kể cả chỉ 2 luồng song song) với batch lớn (100+
  // từ) vẫn dễ chạm trần ngay từ đầu. Chậm hơn nhưng tra được nhiều hơn hẳn.
  for (let i = 0; i < targets.length; i++) {
    if (cancelFlag.value) break;
    const target = targets[i];
    const result = await fetchFn(target.word);
    if (cancelFlag.value) break; // user bấm Dừng lại trong lúc đang chờ kết quả từ này
    const idx = words.findIndex(x => x.id === target.id);
    if (idx !== -1) {
      if (result === 'rate-limited') rateLimited++;
      else if (result) { applyFn(words[idx], result); fixed++; }
      else notFound++;
    }
    processed++;

    // Chỉ đụng vào DOM nếu hộp thoại đang hiện vẫn là của lượt chạy này — nếu
    // user đã đóng/mở tool batch-fix khác, bỏ qua phần UI (dữ liệu vẫn được
    // tính/lưu đúng ở dưới, chỉ là không còn gì để cập nhật lên màn hình).
    if (isBatchFixDialogActive(runId)) {
      const fillEl = document.getElementById('bf-prog-fill');
      const textEl = document.getElementById('bf-prog-text');
      if (fillEl) fillEl.style.width = Math.round((processed / total) * 100) + '%';
      if (textEl) {
        const elapsedMs = performance.now() - startedAt;
        const remainingMs = (elapsedMs / processed) * (total - processed);
        textEl.textContent = processed < total
          ? `${processed} / ${total} từ — còn khoảng ${formatDuration(remainingMs)}`
          : `${processed} / ${total} từ`;
      }
    }

    if (i < targets.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  if (fixed) saveWords();
  refreshWlView();
  if (isBatchFixDialogActive(runId)) {
    showBatchFixResult(cfg, { fixed, notFound, rateLimited, total, processed, cancelled: cancelFlag.value });
  }
}

// Hiện kết quả cuối NGAY TRONG hộp thoại (thay thanh tiến độ) — nếu user đã tự
// đóng hộp thoại giữa chừng thì bỏ qua phần UI (việc tra vẫn chạy ngầm và lưu
// bình thường, chỉ là không còn gì để cập nhật lên màn hình nữa).
function showBatchFixResult(cfg, { fixed, notFound, rateLimited, total, processed, cancelled }) {
  const overlay = document.getElementById('delete-overlay');
  if (!overlay) return;
  const msgEl = document.getElementById('bf-msg');
  const progressEl = document.getElementById('bf-progress');
  const btnsEl = overlay.querySelector('.cb-btns');
  const titleEl = document.getElementById('cb-dialog-title');
  if (titleEl) titleEl.textContent = cancelled ? 'Đã dừng lại' : 'Hoàn tất!';
  if (progressEl) progressEl.style.display = 'none';
  const extras = [];
  if (notFound) extras.push(`${notFound} ${cfg.notFoundLabel}`);
  if (rateLimited) extras.push(`${rateLimited} bị giới hạn tốc độ — thử lại sau vài phút`);
  if (cancelled && processed < total) extras.push(`${total - processed} từ chưa kịp tra`);
  if (msgEl) msgEl.innerHTML = `${cfg.doneLabel} <strong>${fixed}/${total}</strong> từ.${extras.length ? '<br>' + escHtml(extras.join(', ')) + '.' : ''}`;
  if (btnsEl) btnsEl.innerHTML = '<button class="cb-confirm" id="bf-close-btn">Đóng</button>';
  const closeBtn = document.getElementById('bf-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeConfirm);
}

// ════════════════════════════════════════════════════════
// PHÂN LOẠI LẠI TỪ CHƯA RÕ LOẠI — quét toàn bộ từ đang có type 'other' (thường
// do Thêm hàng loạt không ghi loại từ), tự tra dictionaryapi.dev để xác định
// đúng danh/động/tính/trạng từ. CHỈ sửa field `type` — không đụng tới nghĩa/
// phiên âm/ví dụ/chủ đề người dùng đã nhập, tôn trọng dữ liệu có sẵn.
// ════════════════════════════════════════════════════════
// Trả về: mã loại từ ('noun'/'verb'/...) nếu tra được, null nếu từ điển không
// có/không xác định được (khác hẳn với bị giới hạn tốc độ — xem 'rate-limited'
// bên dưới, để confirmBatchFix() báo đúng nguyên nhân cho người dùng).
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

function confirmReclassifyUnclearWords() {
  const targets = words.filter(w => w.type === 'other');
  confirmBatchFix({
    icon: '🔍',
    title: 'Phân loại lại từ chưa rõ?',
    targets,
    emptyMsg: 'Không có từ nào chưa rõ loại từ!',
    descriptionHtml: `Tìm thấy <strong>${targets.length}</strong> từ chưa rõ loại từ. App sẽ tự tra từ điển để xác định đúng danh từ/động từ/tính từ/trạng từ — chỉ sửa loại từ, không đổi nghĩa/phiên âm/ví dụ bạn đã nhập. Tra chậm rãi từng từ (đỡ bị nguồn tra từ giới hạn tốc độ), dự kiến khoảng ${formatDuration(targets.length * 700)}.`,
    fetchFn: fetchWordTypeWithRetry,
    applyFn: (w, result) => { w.type = result; },
    doneLabel: 'Đã phân loại lại',
    notFoundLabel: 'từ điển không tìm thấy',
  });
}

// ════════════════════════════════════════════════════════
// TỰ ĐỘNG ĐIỀN PHIÊN ÂM CÒN THIẾU — quét toàn bộ từ chưa có phiên âm, tự tra
// dictionaryapi.dev (dự phòng Datamuse cho từ đơn) để điền vào. CHỈ sửa field
// `phonetic` — không đụng tới nghĩa/loại từ/ví dụ đã có.
// ════════════════════════════════════════════════════════
// Trả về: chuỗi phiên âm nếu tra được, null nếu không tra được, 'rate-limited'
// nếu bị giới hạn tốc độ (dictionaryapi.dev) — cùng quy ước với fetchWordType().
async function fetchPhoneticForWord(word, signal) {
  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal });
    if (resp.status === 429) return 'rate-limited';
    let phonetic = '';
    if (resp.ok) {
      const entries = await resp.json();
      const entry = Array.isArray(entries) && entries.length ? entries[0] : null;
      if (entry) {
        phonetic = entry.phonetic || '';
        if (!phonetic) { for (const p of (entry.phonetics || [])) { if (p.text) { phonetic = p.text; break; } } }
      }
    }
    // Datamuse chỉ tra được từ đơn (không phải cụm từ) — dùng làm dự phòng khi
    // dictionaryapi.dev không có entry hoặc có entry nhưng thiếu phonetic.
    if (!phonetic && window.electronAPI?.fetchPhoneticFallback && !/\s/.test(word)) {
      phonetic = await window.electronAPI.fetchPhoneticFallback(word).catch(() => '');
    }
    return phonetic || null;
  } catch {
    return null; // mất mạng/timeout — bỏ qua từ này, không chặn cả lô
  }
}

async function fetchPhoneticWithRetry(word) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const result = await fetchPhoneticForWord(word, controller.signal);
    clearTimeout(timer);
    if (result !== 'rate-limited') return result;
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  return 'rate-limited';
}

function confirmAutoPhonetic() {
  const targets = words.filter(w => !w.phonetic);
  confirmBatchFix({
    icon: '🔤',
    title: 'Tự động điền phiên âm còn thiếu?',
    targets,
    emptyMsg: 'Mọi từ đều đã có phiên âm!',
    descriptionHtml: `Tìm thấy <strong>${targets.length}</strong> từ chưa có phiên âm. App sẽ tự tra từ điển để điền vào — chỉ sửa phiên âm, không đổi nghĩa/loại từ/ví dụ bạn đã nhập. Tra chậm rãi từng từ (đỡ bị nguồn tra từ giới hạn tốc độ), dự kiến khoảng ${formatDuration(targets.length * 700)}.`,
    fetchFn: fetchPhoneticWithRetry,
    applyFn: (w, result) => { w.phonetic = result; },
    doneLabel: 'Đã điền phiên âm cho',
    notFoundLabel: 'từ điển không tìm thấy',
  });
}
