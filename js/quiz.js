// ════════════════════════════════════════════════════════
// QUIZ — option matching is index-based, not text-content based
// ════════════════════════════════════════════════════════
let qzWords = [], qzIndex = 0, qzScore = 0, qzAnswered = false;
let qzOptions = [];
let qzWrongWords = []; // Danh sách từ trả lời sai trong phiên quiz

// Lưu tiến trình quiz vào sessionStorage để refresh trang giữa bài không mất bài làm.
// Dùng sessionStorage (không phải localStorage) vì đây là trạng thái 1 phiên làm bài,
// không cần giữ qua nhiều ngày — tự xoá khi đóng tab là hợp lý.
const QUIZ_SESSION_KEY = 'wordnest_quiz_session';

function saveQuizSession() {
  try {
    sessionStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify({
      words: qzWords.map(w => w.word),
      index: qzIndex,
      score: qzScore,
      wrong: qzWrongWords.map(w => w.word),
      answered: qzAnswered
    }));
  } catch(e) { /* sessionStorage bị chặn/đầy — bỏ qua, không ảnh hưởng chức năng chính */ }
}
function clearQuizSession() {
  try { sessionStorage.removeItem(QUIZ_SESSION_KEY); } catch(e) {}
}
// Trả về true nếu khôi phục thành công (đã render lại câu hỏi/kết quả tương ứng)
function tryRestoreQuizSession() {
  let raw;
  try { raw = JSON.parse(sessionStorage.getItem(QUIZ_SESSION_KEY)); } catch(e) { raw = null; }
  if (!raw || !Array.isArray(raw.words) || !raw.words.length) return false;
  // Map lại theo từ hiện có — đề phòng từ đã bị xoá/đổi tên giữa lúc làm bài
  const resolved = raw.words.map(ws => words.find(x => x.word === ws)).filter(Boolean);
  if (resolved.length !== raw.words.length) { clearQuizSession(); return false; }
  qzWords = resolved;
  qzIndex = Math.min(raw.index || 0, qzWords.length - 1);
  qzScore = raw.score || 0;
  qzWrongWords = (raw.wrong || []).map(ws => words.find(x => x.word === ws)).filter(Boolean);
  document.getElementById('quiz-area').style.display = '';
  document.getElementById('quiz-result').style.display = 'none';
  if (raw.answered) {
    // Câu hiện tại đã được trả lời trước khi refresh — qua câu kế để tránh tính điểm trùng
    nextQuiz();
  } else {
    renderQuizQ();
  }
  return true;
}

function startQuiz() {
  if (activeWords().length < 4) { showToast('Cần ít nhất 4 từ (chưa ẩn) để chơi Quiz!', 'error'); return; }

  populateCategorySelect(document.getElementById('qz-tag-sel'));
  const countSel = document.getElementById('qz-count-sel');
  const levelSel = document.getElementById('qz-level-sel');
  const tagSel   = document.getElementById('qz-tag-sel');
  const countVal = countSel ? countSel.value : '10';
  const levelVal = levelSel ? levelSel.value : 'all';
  const tagVal   = tagSel ? tagSel.value : 'all';

  let pool = activeWords();
  if (tagVal !== 'all') pool = pool.filter(w => (w.category || 'Khác') === tagVal);
  if (levelVal === 'weak')  pool = pool.filter(w => w.mastery < 2);
  else if (levelVal !== 'all') pool = pool.filter(w => w.level === levelVal);
  if (pool.length < 4) pool = activeWords(); // fallback

  const count = countVal === 'all' ? pool.length : Math.min(parseInt(countVal) || 10, pool.length);
  qzWords = shuffleArr(pool).slice(0, count);
  qzIndex = 0; qzScore = 0; qzWrongWords = [];
  document.getElementById('quiz-area').style.display = '';
  document.getElementById('quiz-result').style.display = 'none';
  renderQuizQ();
}

function renderQuizQ() {
  if (!qzWords.length) return;
  const w = qzWords[qzIndex];
  qzAnswered = false;
  const pct = (qzIndex / qzWords.length * 100).toFixed(0);
  document.getElementById('qz-prog-fill').style.width = pct + '%';
  document.getElementById('qz-prog-text').textContent = `${qzIndex + 1} / ${qzWords.length}`;
  document.getElementById('qz-num').textContent = `Câu ${qzIndex + 1}`;
  document.getElementById('qz-word').textContent = w.word;
  document.getElementById('qz-phonetic').textContent = w.phonetic || '';

  // Lấy các từ sai: loại từ đang hỏi và từ đã suspend, shuffle, lấy tối đa 3
  const wrong = shuffleArr(activeWords().filter(x => x.word !== w.word)).slice(0, 3);
  qzOptions = shuffleArr([w, ...wrong]); // store globally
  const letters = ['A','B','C','D'];

  document.getElementById('qz-options').innerHTML = qzOptions.map((o, i) =>
    `<div class="quiz-option" data-idx="${i}" onclick="answerQuiz(${i})">
      <div class="opt-letter">${letters[i]}</div>
      <div>${escHtml(o.meaning)}</div>
    </div>`
  ).join('');

  document.getElementById('qz-feedback').className = 'quiz-feedback';
  document.getElementById('qz-feedback').innerHTML = '';
  document.getElementById('qz-next').style.display = 'none';
  saveQuizSession();
}

function answerQuiz(chosenIdx) {
  if (qzAnswered) return;
  qzAnswered = true;
  const correctWord = qzWords[qzIndex].word;
  const correctIdx = qzOptions.findIndex(o => o.word === correctWord);
  const opts = document.querySelectorAll('.quiz-option');
  opts.forEach(o => o.style.pointerEvents = 'none');

  const fb = document.getElementById('qz-feedback');
  // Mark correct answer always
  opts[correctIdx].classList.add('correct');

  if (chosenIdx === correctIdx) {
    qzScore++;
    fb.className = 'quiz-feedback correct show';
    fb.innerHTML = '✅ Chính xác! Bạn thật giỏi.';
  } else {
    opts[chosenIdx].classList.add('wrong');
    fb.className = 'quiz-feedback wrong show';
    const correctMeaning = escHtml(qzOptions[correctIdx].meaning);
    const correctEx = escHtml(qzOptions[correctIdx].example || '');
    fb.innerHTML = `❌ Sai rồi! Đáp án đúng: <strong>${correctMeaning}</strong>${correctEx ? `<br><em>${correctEx}</em>` : ''}`;
    // Lưu từ sai để hiện trong kết quả
    qzWrongWords.push(qzWords[qzIndex]);
  }
  // Ghi nhận hoạt động học bất kể đúng hay sai — học từ sai cũng là học
  recordLearningActivity();
  document.getElementById('qz-next').style.display = 'block';
  saveQuizSession();
}

function nextQuiz() {
  qzIndex++;
  if (qzIndex < qzWords.length) renderQuizQ();
  else showQuizResult();
}

// Quiz keyboard shortcut — chỉ xử lý khi focus KHÔNG nằm trên button để tránh double-fire
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('section-quiz').classList.contains('active')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  // Nếu focus đang ở button, trình duyệt tự fire click — không xử lý thêm ở đây
  if (e.target.tagName === 'BUTTON') return;
  const nextBtn = document.getElementById('qz-next');
  if ((e.key === 'Enter' || e.key === ' ') && nextBtn && nextBtn.style.display !== 'none') {
    e.preventDefault(); nextQuiz();
  }
});

function showQuizResult() {
  clearQuizSession(); // quiz đã hoàn tất — không cần resume nữa
  document.getElementById('quiz-area').style.display = 'none';
  document.getElementById('quiz-result').style.display = '';
  const pct = Math.round(qzScore / qzWords.length * 100);
  document.getElementById('qz-final-score').textContent = pct + '%';
  const msgs = ['Cần cố gắng thêm! 💪','Khá tốt! Tiếp tục nhé 👍','Tuyệt vời! Bạn giỏi lắm 🌟','Xuất sắc! Bậc thầy từ vựng 🏆'];
  const mi = pct < 50 ? 0 : pct < 70 ? 1 : pct < 90 ? 2 : 3;
  document.getElementById('qz-result-msg').textContent = `${qzScore}/${qzWords.length} câu đúng. ${msgs[mi]}`;
  const best = parseInt(localStorage.getItem('qs_best_score') || 0);
  if (pct > best) localStorage.setItem('qs_best_score', pct);

  // Hiện danh sách từ sai để ôn lại
  const wrongEl = document.getElementById('qz-wrong-list');
  if (wrongEl) {
    if (qzWrongWords.length) {
      wrongEl.innerHTML = `
        <div style="margin-top:1.4rem;text-align:left;">
          <div style="font-size:0.85rem;font-weight:600;color:var(--text2);margin-bottom:10px;">📋 Từ cần ôn lại (${qzWrongWords.length}):</div>
          ${qzWrongWords.map(w => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
              <button class="speak-btn" onclick="speak('${escAttr(w.word)}')" title="Phát âm" style="flex-shrink:0;width:30px;height:30px;font-size:0.85rem;">🔊</button>
              <div>
                <span style="font-weight:600;color:var(--text);font-family:'Lora',serif;">${escHtml(w.word)}</span>
                <span style="color:var(--text3);font-size:0.8rem;margin-left:6px;">${escHtml(w.phonetic||'')}</span>
                <div style="font-size:0.82rem;color:var(--text2);margin-top:2px;">${escHtml(w.meaning)}</div>
              </div>
            </div>`).join('')}
        </div>`;
    } else {
      wrongEl.innerHTML = '<div style="margin-top:1rem;font-size:0.88rem;color:var(--green);">🎯 Hoàn hảo! Bạn không sai câu nào.</div>';
    }
  }
}
