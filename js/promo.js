// ════════════════════════════════════════════════════════
// PROMO — popup quảng cáo game mini "Không Chiến Từ Vựng" (đang phát triển,
// chưa có gì để chơi). Hiện lại mỗi lần mở app (không nhớ trạng thái đã đóng,
// giống banner khuyến mãi kiểu Shopee) — đóng bằng nút ✕, bấm ra ngoài thẻ,
// hoặc phím Escape (xem js/flashcard.js, nơi gom xử lý Escape cho mọi overlay).
// ════════════════════════════════════════════════════════
function showComingSoonPromo() {
  const overlay = document.getElementById('promo-overlay');
  if (overlay) overlay.classList.add('show');
}

function closeComingSoonPromo() {
  const overlay = document.getElementById('promo-overlay');
  if (overlay) overlay.classList.remove('show');
}

// Chưa có trang riêng cho game này — tạm mở trang GitHub Releases (nơi sẽ báo
// tin khi game ra mắt) qua đúng kênh IPC đã dùng cho "mac-update-hint-banner"
// (electron/main.js hardcode sẵn URL, không nhận URL tùy ý từ renderer). Fallback
// window.open cho lúc chạy thử trực tiếp bằng trình duyệt thường (ngoài Electron).
function openComingSoonPromoLink() {
  if (window.electronAPI?.openReleasesPage) {
    window.electronAPI.openReleasesPage();
  } else {
    window.open('https://github.com/ngphatdat1311/WORDNEST/releases', '_blank', 'noopener');
  }
  closeComingSoonPromo();
}
