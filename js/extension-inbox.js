// ════════════════════════════════════════════════════════
// EXTENSION INBOX — nhận từ tiện ích Chrome "WordNest Capture".
// Content script của tiện ích (chạy trên chính trang WordNest) gửi danh
// sách từ đang chờ qua window.postMessage; trang gửi lại CONSUME_WORD để
// tiện ích xóa khỏi hàng đợi sau khi người dùng xử lý xong.
// ════════════════════════════════════════════════════════
let extensionInboxWords = [];

window.addEventListener('message', (event) => {
  // Chỉ nhận message từ chính trang này gửi cho chính nó (cách content-bridge.js
  // của tiện ích giao tiếp) — kiểm tra cả source lẫn origin để chắc chắn không
  // phải script lạ nào khác giả mạo message.
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== 'wordnest-extension' || data.type !== 'PENDING_WORDS') return;
  extensionInboxWords = Array.isArray(data.words) ? data.words : [];
  renderExtensionInbox();
});

// Bản desktop (Electron) không có content script chui vào trang được — tiện ích
// gửi từ trực tiếp đến app qua HTTP cục bộ, main process chuyển tiếp qua IPC.
if (window.electronAPI && window.electronAPI.onCaptureWord) {
  window.electronAPI.onCaptureWord((item) => {
    // Không tin tưởng tuyệt đối phía gửi (IPC) dù main.js đã validate — kiểm tra lại ở đây
    // để tránh crash toàn bộ listener nếu payload thiếu field `word`.
    const word = String(item?.word || '').trim();
    if (!word) return;
    const exists = extensionInboxWords.some(w => w.word.toLowerCase() === word.toLowerCase());
    if (!exists) {
      extensionInboxWords.push({ ...item, word });
      renderExtensionInbox();
      showToast('📥 Đã nhận từ "' + word + '" từ tiện ích Chrome', 'success');
    }
  });
}

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
      <span class="ic-use" data-idx="${i}" title="Nhấn để điền vào form Thêm từ">${escHtml(item.word)}</span>
      <span class="ic-remove" data-idx="${i}" title="Bỏ qua">✕</span>
    </span>
  `).join('');
  chipsEl.querySelectorAll('.ic-use').forEach(el => el.addEventListener('click', () => useInboxWord(Number(el.dataset.idx))));
  chipsEl.querySelectorAll('.ic-remove').forEach(el => el.addEventListener('click', () => removeInboxWord(Number(el.dataset.idx))));
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
