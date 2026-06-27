// ════════════════════════════════════════════════════════
// UTILS — escaping (XSS-safe HTML injection) + array helpers
// ════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function shuffleArr(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Giới hạn độ dài ở tầng JS — HTML maxlength chỉ chặn khi gõ tay, dễ bị bypass
// qua DevTools hoặc qua Import JSON (không qua input nào cả).
function clampStr(str, max) {
  return String(str || '').slice(0, max);
}

function typeLabel(t) {
  return { noun:'danh từ', verb:'động từ', adj:'tính từ', adv:'trạng từ', phrase:'cụm từ', other:'khác' }[t] || t || '';
}

// Từ đã suspend (đã thuộc hẳn) bị loại khỏi Flashcard/Quiz/Chính tả/SRS,
// nhưng vẫn hiển thị trong Từ điển cá nhân để có thể bỏ ẩn lại.
function activeWords() { return words.filter(w => !w.suspended); }

function getAllCategories() {
  return [...new Set(words.map(w => w.category || 'Khác'))].sort();
}

// Điền lại <select> chủ đề, giữ nguyên lựa chọn hiện tại nếu vẫn còn hợp lệ
function populateCategorySelect(selectEl) {
  if (!selectEl) return;
  const current = selectEl.value || 'all';
  const cats = getAllCategories();
  selectEl.innerHTML = '<option value="all">Tất cả chủ đề</option>' +
    cats.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
  if ([...selectEl.options].some(o => o.value === current)) selectEl.value = current;
}

// ════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ════════════════════════════════════════════════════════
// TEXT-TO-SPEECH
// ════════════════════════════════════════════════════════
function speak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.85;
  window.speechSynthesis.speak(u);
}
function speakWord(e) {
  e && e.stopPropagation();
  speak(fcWords[fcIndex]?.word || '');
}
