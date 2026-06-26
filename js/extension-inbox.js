// ════════════════════════════════════════════════════════
// EXTENSION INBOX — nhận từ tiện ích Chrome "WordNest Capture".
// Content script của tiện ích (chạy trên chính trang WordNest) gửi danh
// sách từ đang chờ qua window.postMessage; trang gửi lại CONSUME_WORD để
// tiện ích xóa khỏi hàng đợi sau khi người dùng xử lý xong.
// ════════════════════════════════════════════════════════
let extensionInboxWords = [];

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== 'wordnest-extension' || data.type !== 'PENDING_WORDS') return;
  extensionInboxWords = Array.isArray(data.words) ? data.words : [];
  renderExtensionInbox();
});

function renderExtensionInbox() {
  const panel = document.getElementById('inbox-panel');
  const chipsEl = document.getElementById('inbox-chips');
  const navDot = document.getElementById('nav-add-dot');
  if (!panel || !chipsEl) return;

  if (!extensionInboxWords.length) {
    panel.style.display = 'none';
    if (navDot) navDot.style.display = 'none';
    return;
  }
  panel.style.display = '';
  if (navDot) navDot.style.display = '';
  chipsEl.innerHTML = extensionInboxWords.map((item, i) => `
    <span class="inbox-chip">
      <span onclick="useInboxWord(${i})" title="Nhấn để điền vào form Thêm từ">${escHtml(item.word)}</span>
      <span class="ic-remove" onclick="removeInboxWord(${i})" title="Bỏ qua">✕</span>
    </span>
  `).join('');
}

function useInboxWord(idx) {
  const item = extensionInboxWords[idx];
  if (!item) return;
  showSection('add');
  // Đợi section "add" hiện ra (display:none -> block) rồi mới focus/điền form
  setTimeout(() => {
    const wEl = document.getElementById('aw-word');
    if (wEl) {
      wEl.value = item.word;
      wEl.focus();
      scheduleAutoLookup();
    }
  }, 60);
  removeInboxWord(idx, true);
}

function removeInboxWord(idx, silent) {
  const item = extensionInboxWords[idx];
  if (!item) return;
  extensionInboxWords.splice(idx, 1);
  renderExtensionInbox();
  window.postMessage({ source: 'wordnest-page', type: 'CONSUME_WORD', word: item.word }, '*');
  if (!silent) showToast('Đã bỏ "' + item.word + '" khỏi hộp thư');
}

function clearExtensionInbox() {
  extensionInboxWords.slice().forEach(item => {
    window.postMessage({ source: 'wordnest-page', type: 'CONSUME_WORD', word: item.word }, '*');
  });
  extensionInboxWords = [];
  renderExtensionInbox();
}
