// Service worker — quản lý hàng đợi từ đã chọn (chrome.storage.local.pendingWords)
// và đồng bộ số huy hiệu trên icon tiện ích.

const MENU_ID = 'wordnest-capture-selection';
// App desktop (Electron) mở 1 server cục bộ ở cổng này khi đang chạy — nếu gửi
// được nghĩa là app đang mở, từ sẽ vào thẳng app, không cần xếp hàng đợi.
const DESKTOP_APP_URL = 'http://127.0.0.1:51789';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Thêm "%s" vào WordNest',
    contexts: ['selection']
  });
  refreshBadge();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  captureWord(info.selectionText, info.pageUrl || '');
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'CAPTURE_WORD' && msg.word) {
    captureWord(msg.word, msg.pageUrl || '');
  }
});

function sanitizeWord(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

async function captureWord(rawWord, pageUrl) {
  const word = sanitizeWord(rawWord);
  if (!word) return;

  // Thử gửi trực tiếp cho app desktop trước — nếu app đang mở, từ vào ngay
  // hộp thư trên app, không cần qua hàng đợi/mở tab nào cả.
  const sentToDesktopApp = await sendToDesktopApp(word, pageUrl);

  // Luôn lưu thêm vào hàng đợi (chrome.storage) để dùng cho bản web (content-bridge.js)
  // và để không mất từ nếu lúc bôi đen app desktop chưa mở.
  const { pendingWords = [] } = await chrome.storage.local.get('pendingWords');
  const exists = pendingWords.some(w => w.word.toLowerCase() === word.toLowerCase());
  if (!exists) {
    pendingWords.push({ word, pageUrl, ts: Date.now() });
    await chrome.storage.local.set({ pendingWords });
  }
  notifyCaptured(word, exists, sentToDesktopApp);
}

async function sendToDesktopApp(word, pageUrl) {
  try {
    const resp = await fetch(`${DESKTOP_APP_URL}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, pageUrl }),
    });
    return resp.ok;
  } catch (e) {
    return false; // app desktop không chạy — đây là tình huống bình thường, không phải lỗi
  }
}

function notifyCaptured(word, alreadyExists, sentToDesktopApp) {
  if (!chrome.notifications) return;
  let message;
  if (sentToDesktopApp) message = `"${word}" — đã gửi vào app WordNest đang mở.`;
  else if (alreadyExists) message = `"${word}" đã ở trong hàng đợi rồi.`;
  else message = `"${word}" — mở WordNest để tra nghĩa & thêm vào kho.`;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: sentToDesktopApp ? 'Đã gửi vào WordNest' : (alreadyExists ? 'Đã có trong hộp thư' : 'Đã lưu vào WordNest'),
    message,
  });
}

// Mọi thay đổi của pendingWords (do background hoặc do content-bridge.js trên
// trang WordNest tự xóa sau khi xử lý) đều cập nhật lại số trên icon.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pendingWords) refreshBadge();
});

async function refreshBadge() {
  const { pendingWords = [] } = await chrome.storage.local.get('pendingWords');
  const count = pendingWords.length;
  chrome.action.setBadgeText({ text: count ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#C9993A' });
}
