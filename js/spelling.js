// ════════════════════════════════════════════════════════
// SPELLING
// ════════════════════════════════════════════════════════
let spWords = [], spIndex = 0, spCorrect = 0, spWrong = 0, spStreak = 0, spHintLevel = 0, spRevealed = false;
let spSessionStarted = false; // track nếu phiên chính tả đã bắt đầu

// Lưu tiến trình luyện chính tả vào sessionStorage — refresh trang giữa phiên không mất điểm.
const SPELLING_SESSION_KEY = 'wordnest_spelling_session';

function saveSpellingSession() {
  if (!spSessionStarted) return;
  try {
    sessionStorage.setItem(SPELLING_SESSION_KEY, JSON.stringify({
      words: spWords.map(w => w.word),
      index: spIndex,
      correct: spCorrect,
      wrong: spWrong,
      streak: spStreak
    }));
  } catch(e) { /* sessionStorage bị chặn/đầy — bỏ qua, không ảnh hưởng chức năng chính */ }
}
function clearSpellingSession() {
  try { sessionStorage.removeItem(SPELLING_SESSION_KEY); } catch(e) {}
}
// Trả về true nếu khôi phục thành công (đã load lại từ hiện tại của phiên cũ)
function tryRestoreSpellingSession() {
  let raw;
  try { raw = JSON.parse(sessionStorage.getItem(SPELLING_SESSION_KEY)); } catch(e) { raw = null; }
  if (!raw || !Array.isArray(raw.words) || !raw.words.length) return false;
  const resolved = raw.words.map(ws => words.find(x => x.word === ws)).filter(Boolean);
  if (resolved.length !== raw.words.length || (raw.index || 0) >= resolved.length) { clearSpellingSession(); return false; }
  spWords = resolved;
  spIndex = raw.index || 0;
  spCorrect = raw.correct || 0;
  spWrong = raw.wrong || 0;
  spStreak = raw.streak || 0;
  spSessionStarted = true;
  updateSpScore();
  return true;
}

// Hàm restart rõ ràng cho Spelling — buộc reset phiên mới
function restartSpelling() {
  spSessionStarted = false;
  clearSpellingSession();
  initSpelling();
  showToast('🔄 Đã bắt đầu lại!');
}

function spellingPool() {
  const folderVal = (document.getElementById('sp-folder-sel') || {}).value || 'all';
  const levelVal  = (document.getElementById('sp-level-sel')  || {}).value || 'all';
  const tagVal    = (document.getElementById('sp-tag-sel')    || {}).value || 'all';
  let pool = activeWords();
  if (levelVal === 'weak')       pool = pool.filter(w => w.mastery < 2);
  else if (levelVal !== 'all')   pool = pool.filter(w => w.level === levelVal);
  if (tagVal !== 'all')          pool = pool.filter(w => (w.category || 'Khác') === tagVal);
  pool = filterByFolderSel(pool, folderVal);
  return pool.length ? pool : activeWords(); // fallback nếu bộ lọc cho ra 0 từ
}

function initSpelling() {
  populateCategorySelect(document.getElementById('sp-tag-sel'));
  populateFolderSelect(document.getElementById('sp-folder-sel'));
  // Không reset điểm nếu đang giữa phiên (giống Quiz giữ tiến trình)
  // Chỉ reset hoàn toàn khi chưa có phiên nào, hoặc đã xong hết từ
  if (!spSessionStarted || spIndex >= spWords.length) {
    // Nếu có phiên cũ chưa làm xong lưu trong sessionStorage (do refresh trang), khôi phục lại
    if (tryRestoreSpellingSession()) { loadSpellingWord(); return; }
    spWords = shuffleArr(spellingPool());
    spIndex = 0; spCorrect = 0; spWrong = 0; spStreak = 0;
    spSessionStarted = true;
    updateSpScore();
  }
  loadSpellingWord();
}

function updateSpScore() {
  document.getElementById('sp-correct').textContent = spCorrect;
  document.getElementById('sp-wrong').textContent = spWrong;
  document.getElementById('sp-streak').textContent = spStreak;
}

function loadSpellingWord() {
  spHintLevel = 0;
  spRevealed = false;
  if (!spWords.length) {
    document.getElementById('sp-meaning').textContent = 'Chưa có từ nào';
    document.getElementById('sp-phonetic').textContent = '';
    document.getElementById('sp-example').textContent = 'Hãy thêm từ mới để luyện chính tả!';
    document.getElementById('sp-input').value = '';
    document.getElementById('sp-input').disabled = true;
    document.getElementById('sp-blanks').innerHTML = '';
    const fb = document.getElementById('sp-feedback');
    fb.className = 'quiz-feedback'; fb.innerHTML = '';
    document.getElementById('sp-next').style.display = 'none';
    ['sp-check-btn','sp-hint-btn','sp-speak-btn','sp-reveal-btn'].forEach(id => {
      const el = document.getElementById(id); if (el) el.disabled = true;
    });
    return;
  }
  document.getElementById('sp-input').disabled = false;
  ['sp-check-btn','sp-hint-btn','sp-speak-btn','sp-reveal-btn'].forEach(id => {
    const el = document.getElementById(id); if (el) el.disabled = false;
  });
  const w = spWords[spIndex];
  document.getElementById('sp-meaning').textContent = w.meaning;
  document.getElementById('sp-phonetic').textContent = w.phonetic || '';
  document.getElementById('sp-example').textContent = w.example ? `Ví dụ: "${w.example}"` : '';
  document.getElementById('sp-input').value = '';
  document.getElementById('sp-input').className = 'spell-input';
  const fb = document.getElementById('sp-feedback');
  fb.className = 'quiz-feedback';
  fb.innerHTML = '';
  document.getElementById('sp-next').style.display = 'none';
  // Re-enable nút Kiểm tra cho từ mới
  const checkBtn = document.getElementById('sp-check-btn');
  if (checkBtn) checkBtn.disabled = false;
  renderBlanks('');
  document.getElementById('sp-input').focus();
  saveSpellingSession();
}

function nextSpelling() {
  spIndex++;
  if (spIndex >= spWords.length) {
    showToast('🎉 Đã luyện hết tất cả từ!', 'success');
    spIndex = 0;
    spWords = shuffleArr(spellingPool());
    spCorrect = 0; spWrong = 0; spStreak = 0;
    spSessionStarted = false; // Reset để lần vào tab tiếp theo bắt đầu phiên mới
    clearSpellingSession(); // phiên đã hoàn tất — không cần resume nữa
    updateSpScore();
  }
  loadSpellingWord();
}

function renderBlanks(typed) {
  if (!spWords.length) return;
  const w = spWords[spIndex].word;
  let html = '';
  for (let i = 0; i < w.length; i++) {
    // Cụm từ (vd "give up", "be fond of ...") có khoảng trắng giữa các tiếng —
    // hiện khoảng cách trực quan thay vì 1 ô trống trống trơn gây nhầm là thiếu ký tự.
    // Dấu "..." không phải khoảng trắng nên vẫn là ô riêng, vẫn phải gõ đủ 3 dấu chấm.
    if (w[i] === ' ') { html += '<div class="spell-gap"></div>'; continue; }
    const ch = typed[i] || '';
    const cls = ch ? (ch.toLowerCase() === w[i].toLowerCase() ? 'filled' : 'wrong') : '';
    html += `<div class="spell-blank ${cls}">${escHtml(ch)}</div>`;
  }
  document.getElementById('sp-blanks').innerHTML = html;
}

function updateBlanks() { renderBlanks(document.getElementById('sp-input').value); }

function giveHint() {
  if (!spWords.length) return;
  const w = spWords[spIndex].word;
  const inp = document.getElementById('sp-input');
  if (spHintLevel < w.length) {
    inp.value = w.slice(0, spHintLevel + 1);
    spHintLevel++;
    updateBlanks();
    showToast('💡 Gợi ý: ' + inp.value + '...');
  }
}

function revealWord() {
  if (!spWords.length) return;
  const w = spWords[spIndex].word;
  document.getElementById('sp-input').value = w;
  updateBlanks();
  if (!spRevealed) {
    spRevealed = true;
    spWrong++; spStreak = 0;
    updateSpScore();
    const fb = document.getElementById('sp-feedback');
    fb.className = 'quiz-feedback wrong show';
    fb.innerHTML = `👁️ Đã hiện từ — tính là sai. Từ đúng: <strong>${escHtml(w)}</strong>`;
    document.getElementById('sp-next').style.display = 'block';
    document.getElementById('sp-input').className = 'spell-input wrong';
    const idx = words.findIndex(x => x.word === w);
    if (idx !== -1) { words[idx].mastery = Math.max(0, words[idx].mastery - 1); saveWords(); }
    recordLearningActivity();
  }
}

function speakSpelling() { speak(spWords[spIndex]?.word || ''); }

function checkSpelling() {
  if (spRevealed) { showToast('Đã hiện từ — ấn "Từ tiếp theo" để tiếp tục!'); return; }
  if (!spWords.length) return;
  // Chặn bấm nhiều lần làm tăng spCorrect/spWrong ảo
  const checkBtn = document.getElementById('sp-check-btn');
  if (checkBtn && checkBtn.disabled) return;
  const typed = document.getElementById('sp-input').value.trim();
  const w = spWords[spIndex].word;
  const inp = document.getElementById('sp-input');
  const fb = document.getElementById('sp-feedback');
  if (!typed) { showToast('Vui lòng nhập từ!'); return; }
  if (checkBtn) checkBtn.disabled = true;
  if (typed.toLowerCase() === w.toLowerCase()) {
    inp.className = 'spell-input correct';
    fb.className = 'quiz-feedback correct show';
    fb.textContent = '✅ Đúng rồi! Tuyệt vời!';
    spCorrect++; spStreak++;
    const idx = words.findIndex(x => x.word === w);
    if (idx !== -1) { words[idx].mastery = Math.min(3, words[idx].mastery + 1); words[idx].known = (words[idx].known || 0) + 1; saveWords(); }
    // Ghi nhận học khi chính tả đúng
    recordLearningActivity();
  } else {
    inp.className = 'spell-input wrong';
    fb.className = 'quiz-feedback wrong show';
    fb.innerHTML = `❌ Sai! Từ đúng là: <strong>${escHtml(w)}</strong>`;
    spWrong++; spStreak = 0;
    // Giảm mastery khi sai — nhất quán với revealWord()
    const idxW = words.findIndex(x => x.word === w);
    if (idxW !== -1) { words[idxW].mastery = Math.max(0, words[idxW].mastery - 1); saveWords(); }
    // Ghi nhận hoạt động học bất kể đúng hay sai — học từ sai cũng là học
    // (trước đây chỉ ghi nhận khi đúng, khiến người mới học sai nhiều bị mất hẳn streak/heatmap dù đã học thật)
    recordLearningActivity();
  }
  updateSpScore();
  document.getElementById('sp-next').style.display = 'block';
  renderBlanks(typed);
}
