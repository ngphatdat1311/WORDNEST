// Chỉ hoạt động trên chính trang WordNest (nhận diện qua <meta name="wordnest-app">).
// Cầu nối hai chiều giữa chrome.storage.local (chỉ extension đọc được) và
// window.postMessage (cách duy nhất để nói chuyện với JS của trang web).

(() => {
  if (!document.querySelector('meta[name="wordnest-app"]')) return;

  function pushPendingWords() {
    chrome.storage.local.get('pendingWords', ({ pendingWords = [] }) => {
      window.postMessage({ source: 'wordnest-extension', type: 'PENDING_WORDS', words: pendingWords }, '*');
    });
  }

  // Gửi ngay khi trang vừa tải xong
  pushPendingWords();

  // Nếu người dùng để tab WordNest mở và bôi đen từ ở tab khác, tự đồng bộ luôn
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pendingWords) pushPendingWords();
  });

  // Trang báo đã xử lý xong 1 từ -> xóa khỏi hàng đợi
  window.addEventListener('message', (event) => {
    // event.origin === window.location.origin đảm bảo chỉ tin message từ chính
    // trang đang chạy script này, không phải script lạ nào khác giả mạo.
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== 'wordnest-page' || data.type !== 'CONSUME_WORD') return;
    chrome.storage.local.get('pendingWords', ({ pendingWords = [] }) => {
      const next = pendingWords.filter(w => w.word.toLowerCase() !== String(data.word).toLowerCase());
      chrome.storage.local.set({ pendingWords: next });
    });
  });
})();
