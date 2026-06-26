// ════════════════════════════════════════════════════════
// ADD WORD
// ════════════════════════════════════════════════════════
function addWord() {
  const word    = document.getElementById('aw-word').value.trim();
  const meaning = document.getElementById('aw-meaning').value.trim();
  if (!word || !meaning) { showToast('Cần nhập từ và nghĩa!', 'error'); return; }
  if (words.find(w => w.word.toLowerCase() === word.toLowerCase())) { showToast('Từ này đã tồn tại!', 'error'); return; }
  words.push(srsInit({
    word,
    phonetic: document.getElementById('aw-phonetic').value.trim(),
    meaning,
    example:  document.getElementById('aw-example').value.trim(),
    type:     document.getElementById('aw-type').value,
    category: document.getElementById('aw-category').value.trim() || 'Chung',
    level:    document.getElementById('aw-level').value,
    mastery: 0, known: 0, seen: 0
  }));
  saveWords();
  // Reset form
  ['aw-word','aw-phonetic','aw-meaning','aw-example','aw-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('autofilled'); }
  });
  const exVi = document.getElementById('aw-example-vi'); if (exVi) exVi.textContent = '';
  const altM = document.getElementById('aw-alt-meaning'); if (altM) altM.innerHTML = '';
  const speakBtn = document.getElementById('aw-speak-btn'); if (speakBtn) speakBtn.style.display = 'none';
  document.getElementById('aw-autofill-status').innerHTML = '';
  awAutoFilledValues = {};
  showToast('✅ Đã thêm từ "' + word + '"!', 'success');
  renderHome();
  renderWordList(); // đồng bộ luôn danh sách từ, tránh hiển thị stale nếu user quay lại tab Danh sách
}

function bulkAdd() {
  const raw = document.getElementById('aw-bulk').value.trim();
  if (!raw) { showToast('Vui lòng nhập từ!'); return; }
  const lines = raw.split('\n').filter(l => l.trim());
  let added = 0;
  lines.forEach(line => {
    const parts = line.split('|').map(s => s.trim());
    const word = parts[0]; const meaning = parts[1]; const example = parts[2] || '';
    if (!word || !meaning) return;
    if (words.find(w => w.word.toLowerCase() === word.toLowerCase())) return;
    words.push(srsInit({ word, phonetic:'', meaning, example, type:'other', category:'Nhập nhanh', level:'medium', mastery:0, known:0, seen:0 }));
    added++;
  });
  saveWords();
  document.getElementById('aw-bulk').value = '';
  showToast(`✅ Đã thêm ${added} từ!`, 'success');
  renderHome();
  renderWordList(); // đồng bộ luôn danh sách từ
}

// ════════════════════════════════════════════════════════
// DELETE WORD
// ════════════════════════════════════════════════════════
function confirmDelete(word) {
  const w = words.find(x => x.word === word);
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
      <div class="cb-sub">${escHtml(w.meaning)}<br>Hành động này không thể hoàn tác.</div>
      <div class="cb-btns">
        <button class="cb-cancel" onclick="closeConfirm()">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Xóa</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // Dùng event listener, không nối chuỗi từ vào onclick inline
  document.getElementById('cb-confirm-btn').addEventListener('click', () => deleteWord(word));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  // Focus vào nút đầu tiên khi modal mở
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}
function closeConfirm() { const el = document.getElementById('delete-overlay'); if (el) el.remove(); }
function deleteWord(word) {
  words = words.filter(w => w.word !== word);
  saveWords(); closeConfirm();
  showToast('🗑️ Đã xóa "' + word + '"');
  renderWordList(); renderHome();
}

// ════════════════════════════════════════════════════════
// SUSPEND — đánh dấu từ đã thuộc hẳn, loại khỏi Flashcard/Quiz/Chính tả/SRS
// ════════════════════════════════════════════════════════
function toggleSuspend(word) {
  const idx = words.findIndex(x => x.word === word);
  if (idx === -1) return;
  words[idx].suspended = !words[idx].suspended;
  saveWords();
  showToast(words[idx].suspended ? '📌 Đã ẩn khỏi ôn tập' : '🔓 Đã bỏ ẩn — sẽ xuất hiện lại khi ôn tập', 'success');
  renderWordList();
  renderHome();
}

// ════════════════════════════════════════════════════════
// EDIT WORD
// ════════════════════════════════════════════════════════
function openEditModal(word) {
  const w = words.find(x => x.word === word);
  if (!w) return;
  const old = document.getElementById('edit-overlay');
  if (old) old.remove();

  const typeOptions = ['noun','verb','adj','adv','phrase','other'];
  const typeLabels = { noun:'Danh từ (noun)', verb:'Động từ (verb)', adj:'Tính từ (adj)', adv:'Trạng từ (adv)', phrase:'Cụm từ (phrase)', other:'Khác' };
  const typeSel  = typeOptions.map(t => `<option value="${t}"${w.type === t ? ' selected' : ''}>${typeLabels[t]}</option>`).join('');
  const levelSel = ['easy','medium','hard'].map(l => `<option value="${l}"${w.level === l ? ' selected' : ''}>${l==='easy'?'Dễ (A1–A2)':l==='medium'?'Trung bình (B1–B2)':'Khó (C1–C2)'}</option>`).join('');

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
        <button class="eb-close" onclick="closeEditModal()">✕</button>
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
        <div class="edit-group"><label>Mức độ khó</label><select class="form-select" id="ew-level">${levelSel}</select></div>
        <div class="edit-group">
          <label class="ew-suspend-label">
            <input type="checkbox" id="ew-suspended"${w.suspended ? ' checked' : ''}>
            <span>📌 Đã thuộc hẳn — ẩn khỏi Flashcard/Quiz/Chính tả</span>
          </label>
        </div>
      </div>
      <div class="edit-btns">
        <button class="btn btn-outline" onclick="closeEditModal()">Hủy</button>
        <button class="btn" id="eb-save-btn">💾 Lưu thay đổi</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('eb-save-btn').addEventListener('click', () => saveEditWord(word));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeEditModal(); });
  // Focus vào field đầu tiên khi edit modal mở
  setTimeout(() => { const el = document.getElementById('ew-word'); if (el) el.focus(); }, 50);
}
function closeEditModal() { const el = document.getElementById('edit-overlay'); if (el) el.remove(); }
function saveEditWord(originalWord) {
  const idx = words.findIndex(x => x.word === originalWord);
  if (idx === -1) return;
  const newWord    = document.getElementById('ew-word').value.trim();
  const newMeaning = document.getElementById('ew-meaning').value.trim();
  if (!newWord || !newMeaning) { showToast('Cần có từ và nghĩa!', 'error'); return; }
  if (newWord.toLowerCase() !== originalWord.toLowerCase() && words.find(w => w.word.toLowerCase() === newWord.toLowerCase())) {
    showToast('Từ "' + newWord + '" đã tồn tại!', 'error'); return;
  }
  words[idx] = {
    ...words[idx],
    word:     newWord,
    phonetic: document.getElementById('ew-phonetic').value.trim(),
    meaning:  newMeaning,
    example:  document.getElementById('ew-example').value.trim(),
    category: document.getElementById('ew-category').value.trim() || 'Chung',
    type:     document.getElementById('ew-type').value,
    level:    document.getElementById('ew-level').value,
    suspended: document.getElementById('ew-suspended').checked,
  };
  saveWords(); closeEditModal();
  showToast('✅ Đã cập nhật "' + newWord + '"!', 'success');
  renderWordList(); renderHome();
}
