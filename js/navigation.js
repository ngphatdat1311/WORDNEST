// ════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════
function showSection(id) {
  // Cảnh báo nếu đang nhập dữ liệu ở tab "Thêm từ" mà chưa lưu
  if (id !== 'add') {
    const awWord = document.getElementById('aw-word');
    const awMeaning = document.getElementById('aw-meaning');
    if (awWord && awMeaning && (awWord.value.trim() || awMeaning.value.trim())) {
      if (!confirm('Bạn đang nhập từ chưa lưu. Rời khỏi sẽ mất dữ liệu. Tiếp tục không?')) return;
      // Reset form nếu user xác nhận rời
      ['aw-word','aw-phonetic','aw-meaning','aw-example','aw-category'].forEach(i => {
        const el = document.getElementById(i); if (el) { el.value = ''; el.classList.remove('autofilled'); }
      });
      const exVi = document.getElementById('aw-example-vi'); if (exVi) exVi.textContent = '';
      const altM = document.getElementById('aw-alt-meaning'); if (altM) altM.innerHTML = '';
      document.getElementById('aw-autofill-status').innerHTML = '';
      awAutoFilledValues = {};
      if (awAbortController) { awAbortController.abort(); awAbortController = null; }
    }
  }
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
  const qsBest = localStorage.getItem('qs_best_score');
  document.getElementById('home-quiz-score').textContent = qsBest ? qsBest + '%' : '—';
  // SRS: hiển thị số từ đến hạn ôn
  const srsEl = document.getElementById('home-srs-due');
  if (srsEl) srsEl.textContent = srsDueCount();

  const chips = document.getElementById('recent-chips');
  // Dùng data-word attribute thay vì escape thủ công trong onclick string
  const recent = words.slice().sort((a, b) => (b.seen || 0) - (a.seen || 0)).slice(0, 10);
  chips.innerHTML = recent.map(w => {
    return `<span class="word-chip" data-word="${escAttr(w.word)}" onclick="speak(this.dataset.word)">${escHtml(w.word)}</span>`;
  }).join('');
  document.getElementById('recent-section').style.display = recent.length ? '' : 'none';
}
