// Chạy trên mọi trang (trừ trang WordNest). Khi người dùng bôi đen một từ/cụm
// từ tiếng Anh ngắn, hiện một nút nhỏ "+ WordNest" cạnh vùng chọn để gửi vào
// hàng đợi của tiện ích — không cần mở context menu.

(() => {
  const ENGLISH_PATTERN = /^[A-Za-z][A-Za-z'-]*(?:\s[A-Za-z][A-Za-z'-]*){0,3}$/;
  let bubble = null;

  function removeBubble() {
    if (bubble) { bubble.remove(); bubble = null; }
  }

  function showBubble(text, rect) {
    removeBubble();
    bubble = document.createElement('div');
    bubble.textContent = '+ WordNest';
    Object.assign(bubble.style, {
      position: 'fixed',
      left: Math.max(4, rect.left) + 'px',
      top: Math.max(4, rect.top - 34) + 'px',
      zIndex: '2147483647',
      background: '#8B6F47',
      color: '#fff',
      font: '600 12px/1 Inter, Arial, sans-serif',
      padding: '6px 12px',
      borderRadius: '999px',
      boxShadow: '0 4px 14px rgba(0,0,0,.25)',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'transform .12s ease',
    });
    bubble.addEventListener('mouseenter', () => { bubble.style.transform = 'scale(1.06)'; });
    bubble.addEventListener('mouseleave', () => { bubble.style.transform = 'scale(1)'; });
    bubble.addEventListener('mousedown', (e) => e.preventDefault()); // tránh xóa selection khi click
    bubble.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_WORD', word: text, pageUrl: location.href });
      bubble.textContent = '✓ Đã lưu';
      setTimeout(removeBubble, 700);
    });
    document.documentElement.appendChild(bubble);
  }

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length > 60 || !ENGLISH_PATTERN.test(text)) { removeBubble(); return; }
      if (sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      showBubble(text, rect);
    }, 0);
  });

  document.addEventListener('mousedown', (e) => {
    if (bubble && e.target !== bubble) removeBubble();
  });
  document.addEventListener('scroll', removeBubble, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') removeBubble(); });
})();
