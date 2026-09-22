// ════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════
// Cảnh báo nếu đang nhập dữ liệu ở tab "Thêm từ" mà chưa lưu, rồi mới thực sự
// chuyển tab. Dùng showConfirmDialog() (word-crud.js) thay vì confirm() gốc
// trình duyệt — trước đây đây là chỗ DUY NHẤT trong app bật popup hệ điều hành
// (nút OK/Cancel mặc định của trình duyệt, không style/dịch được), lạc lõng
// giữa toàn bộ modal còn lại đều tự vẽ theo đúng giao diện app.
function showSection(id) {
  const awWord = document.getElementById('aw-word');
  const awMeaning = document.getElementById('aw-meaning');
  const hasUnsavedAddWord = id !== 'add' && awWord && awMeaning && (awWord.value.trim() || awMeaning.value.trim());
  if (hasUnsavedAddWord) {
    showConfirmDialog({
      icon: '⚠️',
      title: 'Rời khỏi trang Thêm từ?',
      subHtml: 'Bạn đang nhập từ chưa lưu — rời khỏi sẽ mất toàn bộ dữ liệu đang nhập trong form.',
      confirmLabel: 'Rời khỏi, mất dữ liệu',
      onConfirm: () => {
        closeConfirm();
        resetUnsavedAddWordState();
        doShowSection(id);
      },
    });
    return;
  }
  doShowSection(id);
}

// Xóa sạch form Thêm từ + hủy request tra từ điển đang chạy dở — chỉ gọi khi
// user đã XÁC NHẬN rời tab dù đang nhập dở (xem showSection ở trên).
function resetUnsavedAddWordState() {
  ['aw-word','aw-phonetic','aw-meaning','aw-example','aw-category'].forEach(i => {
    const el = document.getElementById(i); if (el) { el.value = ''; el.classList.remove('autofilled'); }
  });
  const exVi = document.getElementById('aw-example-vi'); if (exVi) exVi.textContent = '';
  const altM = document.getElementById('aw-alt-meaning'); if (altM) altM.innerHTML = '';
  document.getElementById('aw-autofill-status').innerHTML = '';
  awAutoFilledValues = {};
  if (awAbortController) { awAbortController.abort(); awAbortController = null; }
}

// Thực sự chuyển tab — tách khỏi showSection() để gọi được cả ngay lập tức
// (không có gì chưa lưu) lẫn trễ hơn sau khi user xác nhận rời (có cảnh báo).
function doShowSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-' + id).classList.add('active');
  requestAnimationFrame(() => {
    if (id === 'home')      renderHome();
    if (id === 'flashcard') initFlashcard(false);
    if (id === 'quiz') {
      if (!qzWords.length) { if (!tryRestoreQuizSession()) startQuiz(); }
    }
    if (id === 'spelling')  initSpelling();
    if (id === 'wordlist')  refreshWlView();
    if (id === 'progress')  renderProgress();
    if (id === 'add')       populateAwFolderSelects();
  });
}

// ════════════════════════════════════════════════════════
// HOME
// ════════════════════════════════════════════════════════
function renderHome() {
  const s = loadStreak();
  const masteredCount = words.filter(w => w.mastery >= 3).length;
  document.getElementById('home-total').textContent = words.length;
  document.getElementById('home-mastered').textContent = masteredCount;
  document.getElementById('home-streak').textContent = s.count;
  document.getElementById('streak-count').textContent = s.count;
  const qsBest = storeGet('qs_best_score');
  document.getElementById('home-quiz-score').textContent = qsBest ? qsBest + '%' : '—';
  // SRS: hiển thị số từ đến hạn ôn
  const srsEl = document.getElementById('home-srs-due');
  if (srsEl) srsEl.textContent = srsDueCount();

  const chips = document.getElementById('recent-chips');
  // Dùng data-word attribute thay vì escape thủ công trong onclick string
  const recent = words.slice().sort((a, b) => (b.seen || 0) - (a.seen || 0)).slice(0, 10);
  chips.innerHTML = recent.map(w => {
    return `<span class="word-chip" data-word="${escAttr(w.word)}">${escHtml(w.word)}</span>`;
  }).join('');
  chips.querySelectorAll('.word-chip').forEach(el => el.addEventListener('click', () => speak(el.dataset.word)));
  document.getElementById('recent-section').style.display = recent.length ? '' : 'none';
}
