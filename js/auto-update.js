// ════════════════════════════════════════════════════════
// AUTO-UPDATE (chỉ chạy trong bản desktop/Electron) — main process tự kiểm
// tra GitHub Releases lúc mở app; nếu có bản mới, banner hiện ra. Người dùng
// bấm "Cập nhật ngay" mới thật sự tải, không có gì tự động tải ngầm trước đó.
// Tải xong, main process tự khởi động lại để áp dụng — không cần gỡ cài/tải
// file mới về cài tay như trước.
// ════════════════════════════════════════════════════════
if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
  window.electronAPI.onUpdateAvailable((data) => {
    const textEl = document.getElementById('app-update-text');
    if (textEl) textEl.textContent = `Đã có bản cập nhật mới (v${data.version}).`;
    const banner = document.getElementById('app-update-banner');
    if (banner) banner.classList.add('show');
  });

  window.electronAPI.onUpdateError(() => {
    const textEl = document.getElementById('app-update-text');
    const btn = document.getElementById('app-update-btn');
    if (textEl) textEl.textContent = '⚠️ Không tải được bản cập nhật. Vui lòng kiểm tra mạng hoặc tải bản mới từ GitHub.';
    if (btn) { btn.disabled = false; btn.textContent = '⬇️ Cập nhật ngay'; }
  });
}

function downloadAppUpdate() {
  const btn = document.getElementById('app-update-btn');
  const textEl = document.getElementById('app-update-text');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải...'; }
  if (textEl) textEl.textContent = 'Đang tải bản cập nhật, app sẽ tự khởi động lại khi xong...';
  if (window.electronAPI && window.electronAPI.downloadUpdate) window.electronAPI.downloadUpdate();
}

function dismissAppUpdateBanner() {
  const banner = document.getElementById('app-update-banner');
  if (banner) banner.classList.remove('show');
}
