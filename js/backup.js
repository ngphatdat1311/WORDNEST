// ════════════════════════════════════════════════════════
// BACKUP REMINDER — localStorage có thể mất sạch nếu user xóa cache trình
// duyệt, nên nhắc xuất JSON định kỳ nếu đã thêm từ mới mà lâu chưa sao lưu.
// ════════════════════════════════════════════════════════
const BACKUP_KEY = 'wordnest_last_backup';
const BACKUP_DISMISS_KEY = 'wordnest_backup_dismiss_until';
const BACKUP_REMINDER_DAYS = 7;
const BACKUP_DISMISS_DAYS = 3;

function markBackedUpNow() {
  storeSet(BACKUP_KEY, new Date().toISOString());
  hideBackupBanner();
}

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

function hasUnsavedChanges() {
  // Chưa thêm/sửa gì so với bộ từ mặc định ban đầu thì không cần nhắc backup
  if (words.length !== DEFAULT_WORDS.length) return true;
  return words.some((w, i) => !DEFAULT_WORDS[i] || w.word !== DEFAULT_WORDS[i].word);
}

function shouldRemindBackup() {
  if (!hasUnsavedChanges()) return false;
  const dismissedUntil = parseInt(storeGet(BACKUP_DISMISS_KEY) || '0', 10);
  if (Date.now() < dismissedUntil) return false;
  return daysSince(storeGet(BACKUP_KEY)) >= BACKUP_REMINDER_DAYS;
}

function showBackupBannerIfNeeded() {
  if (!shouldRemindBackup()) return;
  const banner = document.getElementById('backup-banner');
  if (banner) banner.classList.add('show');
}

function hideBackupBanner() {
  const banner = document.getElementById('backup-banner');
  if (banner) banner.classList.remove('show');
}

function dismissBackupBanner() {
  storeSet(BACKUP_DISMISS_KEY, String(Date.now() + BACKUP_DISMISS_DAYS * 86400000));
  hideBackupBanner();
}

function doBackupFromBanner() {
  exportWords(); // exportWords() tự gọi markBackedUpNow() và ẩn banner
}
