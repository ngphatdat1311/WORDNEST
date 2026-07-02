// ════════════════════════════════════════════════════════
// FLASHCARD
// ════════════════════════════════════════════════════════
let fcWords = [], fcIndex = 0, fcSeenThisSession = new Set();

function markSeenCurrent() {
  if (!fcWords.length) return;
  const w = fcWords[fcIndex];
  if (fcSeenThisSession.has(fcIndex)) return; // đã xem trong phiên này
  fcSeenThisSession.add(fcIndex);
  const origIdx = words.findIndex(x => x.word === w.word);
  if (origIdx !== -1) { words[origIdx].seen = (words[origIdx].seen || 0) + 1; saveWords(); }
}

function initFlashcard(shuffle = false) {
  populateCategorySelect(document.getElementById('fc-tag'));
  populateFolderSelect(document.getElementById('fc-folder'));
  const filter = document.getElementById('fc-category').value;
  const tag = document.getElementById('fc-tag').value;
  const folderVal = (document.getElementById('fc-folder') || {}).value || 'all';
  let pool = filter === 'srs' ? getSrsDueWords() : activeWords(); // SRS: từ đến hạn ôn (đã loại suspend)
  if (filter === 'new')    pool = pool.filter(w => w.mastery === 0);
  if (filter === 'review') pool = pool.filter(w => w.mastery > 0 && w.mastery < 3);
  if (tag !== 'all') pool = pool.filter(w => (w.category || 'Khác') === tag);
  pool = filterByFolderSel(pool, folderVal);
  if (!pool.length) {
    const hadFilter = filter !== 'all' || tag !== 'all' || folderVal !== 'all';
    pool = activeWords();
    // Reset dropdown về "Tất cả từ" để tránh mâu thuẫn UX
    const fcCatEl = document.getElementById('fc-category');
    if (fcCatEl && fcCatEl.value !== 'all') { fcCatEl.value = 'all'; }
    const fcFolderEl = document.getElementById('fc-folder');
    if (fcFolderEl && fcFolderEl.value !== 'all') { fcFolderEl.value = 'all'; }
    if (hadFilter && pool.length) showToast('Không có từ phù hợp — hiện tất cả!');
  }
  fcWords = shuffle ? shuffleArr(pool) : pool;
  fcIndex = 0;
  fcSeenThisSession = new Set();
  const fc = document.getElementById('flashcard');
  fc.classList.remove('flipped');
  document.getElementById('fc-know-row').style.display = 'none';
  renderFlashcard();
  markSeenCurrent();
}

function shuffleFlashcard() { initFlashcard(true); showToast('Đã xáo trộn thẻ!'); }

function renderFlashcard() {
  const fcKnowRow = document.getElementById('fc-know-row');
  if (!fcWords.length) {
    document.getElementById('fc-word').textContent = 'Chưa có từ nào';
    document.getElementById('fc-phonetic').textContent = '';
    document.getElementById('fc-type').textContent = '';
    document.getElementById('fc-type-back').textContent = '';
    document.getElementById('fc-meaning').textContent = 'Hãy thêm từ mới để bắt đầu học!';
    document.getElementById('fc-example').textContent = '';
    const srsEl = document.getElementById('fc-srs-info'); if (srsEl) srsEl.textContent = '';
    document.getElementById('fc-prog-fill').style.width = '0%';
    document.getElementById('fc-prog-text').textContent = '0 / 0';
    document.getElementById('fc-prev').disabled = true;
    document.getElementById('fc-next').disabled = true;
    document.getElementById('flashcard').classList.remove('flipped');
    fcKnowRow.style.display = 'none';
    return;
  }
  const w = fcWords[fcIndex];
  // seen chỉ tăng khi navigate đến thẻ mới, không tăng khi re-render/flip
  // — được xử lý bởi prevCard/nextCard/initFlashcard qua fcSeenThisSession
  document.getElementById('fc-word').textContent = w.word;
  document.getElementById('fc-phonetic').textContent = w.phonetic || '';
  const tl = typeLabel(w.type);
  document.getElementById('fc-type').textContent = tl;
  document.getElementById('fc-type-back').textContent = tl;
  document.getElementById('fc-meaning').textContent = w.meaning;
  document.getElementById('fc-example').textContent = w.example ? `"${w.example}"` : '';

  // SRS: hiển thị ngày ôn tiếp theo
  const srsEl = document.getElementById('fc-srs-info');
  if (srsEl) {
    const today = localDateKey();
    const daysUntil = Math.round((Date.parse(w.srsDue + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86400000);
    if (w.srsDue && Number.isFinite(daysUntil)) {
      if (daysUntil <= 0) srsEl.textContent = '📅 Đến hạn ôn hôm nay';
      else if (daysUntil === 1) srsEl.textContent = '📅 Ôn lại vào ngày mai';
      else srsEl.textContent = `📅 Ôn lại sau ${daysUntil} ngày`;
    } else {
      // Không có srsDue, hoặc dữ liệu ngày bị hỏng (import lỗi/sửa tay) -> coi như chưa lên lịch
      srsEl.textContent = '🆕 Chưa lên lịch ôn';
    }
  }

  const pct = (fcIndex / (fcWords.length || 1) * 100).toFixed(0);
  document.getElementById('fc-prog-fill').style.width = pct + '%';
  document.getElementById('fc-prog-text').textContent = `${fcIndex + 1} / ${fcWords.length}`;
  document.getElementById('fc-prev').disabled = fcIndex === 0;
  document.getElementById('fc-next').disabled = fcIndex === fcWords.length - 1;

  // Reset flip state on navigation
  document.getElementById('flashcard').classList.remove('flipped');
  document.getElementById('fc-know-row').style.display = 'none';
}

function flipCard() {
  const fc = document.getElementById('flashcard');
  fc.classList.toggle('flipped');
  document.getElementById('fc-know-row').style.display = fc.classList.contains('flipped') ? 'flex' : 'none';
}

function prevCard() { if (fcIndex > 0) { fcIndex--; renderFlashcard(); markSeenCurrent(); } }
function nextCard() { if (fcIndex < fcWords.length - 1) { fcIndex++; renderFlashcard(); markSeenCurrent(); } }

function markCard(known) {
  if (!fcWords.length) return;
  const w = fcWords[fcIndex];
  const idx = words.findIndex(x => x.word === w.word);
  if (idx !== -1) {
    if (known) { words[idx].known = (words[idx].known || 0) + 1; words[idx].mastery = Math.min(3, (words[idx].mastery || 0) + 1); }
    else { words[idx].mastery = Math.max(0, (words[idx].mastery || 0) - 1); }
    // SRS: cập nhật ngày ôn tập tiếp theo theo SM-2
    words[idx] = srsUpdate(words[idx], known);
    saveWords();
  }
  // Chỉ tăng streak sau khi user thực sự học 1 thẻ
  recordLearningActivity();
  showToast(known ? '✅ Đã đánh dấu biết!' : '❌ Sẽ ôn lại sau!');
  if (fcIndex < fcWords.length - 1) { fcIndex++; renderFlashcard(); }
  else {
    showToast('🎉 Đã xem hết tất cả thẻ!', 'success');
    triggerConfetti(24);
    document.getElementById('fc-know-row').style.display = 'none';
    document.getElementById('fc-next').disabled = true;
  }
}

// Keyboard handler chung — xử lý Escape (modal) + điều hướng flashcard
document.addEventListener('keydown', function(e) {
  // Escape: đóng modal đang mở (ưu tiên cao nhất)
  if (e.key === 'Escape') {
    const editOverlay = document.getElementById('edit-overlay');
    const deleteOverlay = document.getElementById('delete-overlay');
    const importOverlay = document.getElementById('import-confirm-overlay');
    const folderNameOverlay = document.getElementById('folder-name-overlay');
    const folderPickOverlay = document.getElementById('folder-pick-overlay');
    const folderBulkOverlay = document.getElementById('folder-bulk-overlay');
    if (editOverlay) { closeEditModal(); return; }
    if (deleteOverlay) { closeConfirm(); return; }
    if (importOverlay) { closeImportConfirm(); return; }
    if (folderNameOverlay) { closeFolderNameModal(); return; }
    if (folderPickOverlay) { closeFolderPicker(); return; }
    if (folderBulkOverlay) { closeFolderBulkModal(); return; }
    return;
  }

  // Điều hướng flashcard (chỉ khi tab Flashcard đang active và không đang nhập liệu)
  const fcSection = document.getElementById('section-flashcard');
  if (!fcSection.classList.contains('active')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prevCard(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); nextCard(); }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
});
