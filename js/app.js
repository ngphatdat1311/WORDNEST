// ════════════════════════════════════════════════════════
// APP INIT
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  words = loadWords();
  renderHome();
  initFlashcard(false);
  document.querySelectorAll('.wl-mastered-only-btn').forEach(b => b.classList.toggle('active', wlShowMasteredOnly));
  showBackupBannerIfNeeded();
  showMacUpdateHintIfNeeded();
  if (typeof initSync === 'function') initSync();
  // Chỉ đọc streak, không ghi — streak chỉ tăng sau khi học
  streak = loadStreak();
  document.getElementById('streak-count').textContent = streak.count;

  // Greeting
  const h = new Date().getHours();
  const greet = h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  document.querySelector('#section-home .section-title').textContent = greet + '! 👋';

  // Add word: re-lookup on blur if empty
  const wEl = document.getElementById('aw-word');
  if (wEl) {
    wEl.addEventListener('blur', () => {
      const word = wEl.value.trim();
      if (word.length >= 2 && Object.keys(awAutoFilledValues).length === 0) {
        clearTimeout(autoLookupTimer);
        doAutoLookup(word);
      }
    });
  }

  const spInput = document.getElementById('sp-input');
  if (spInput) {
    spInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextBtn = document.getElementById('sp-next');
        if (nextBtn && nextBtn.style.display !== 'none') {
          nextSpelling();
        } else {
          checkSpelling();
        }
      }
    });
  }

  // Clear autofill highlight when user manually edits
  ['aw-phonetic','aw-meaning','aw-example','aw-category'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('autofilled');
      delete awAutoFilledValues[id];
    });
  });
});
