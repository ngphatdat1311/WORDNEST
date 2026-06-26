// ════════════════════════════════════════════════════════
// THEME (light/dark) — persisted in localStorage
// ════════════════════════════════════════════════════════
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
}
// Apply saved theme immediately (before DOMContentLoaded to avoid flash)
(function() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

// ════════════════════════════════════════════════════════
// FULLSCREEN
// ════════════════════════════════════════════════════════
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}
document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('fs-btn');
  if (!btn) return;
  btn.textContent = document.fullscreenElement ? '✕' : '⛶';
  btn.title = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình';
});
