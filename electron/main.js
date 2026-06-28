const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

// Cổng cục bộ để tiện ích Chrome "WordNest Capture" gửi từ trực tiếp vào app
// desktop đang chạy — không cần mở tab WordNest nào cả.
const BRIDGE_PORT = 51789;

let mainWindow = null;

// Chặn mở 2 instance cùng lúc: nếu app đã chạy mà người dùng mở thêm 1 lần nữa
// (vd double-click nhầm icon lần 2, hoặc app cũ chưa thoát hết), bản mới sẽ
// không giành được cổng cầu nối ở trên — lỗi đó âm thầm, người dùng chỉ thấy
// "tiện ích Chrome không hoạt động" mà không hiểu vì sao. Single-instance lock
// đảm bảo luôn chỉ có 1 app + 1 server cầu nối tồn tại.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    startBridgeServer();
    setupAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon-512.png'),
    backgroundColor: '#F5F0E8',
    autoHideMenuBar: true,
    show: false, // chỉ hiện cửa sổ khi trang đã render xong — tránh nhấp nháy/khung trắng lúc mở app
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true, // giảm CPU khi thu nhỏ/không active
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Server HTTP cục bộ tối giản — chỉ phục vụ 2 việc: báo "app đang chạy" (GET /ping)
// và nhận từ tiện ích Chrome gửi tới (POST /capture). Không dùng framework ngoài
// để tránh phải cài thêm dependency cho 1 việc rất nhỏ.
function startBridgeServer() {
  const server = http.createServer((req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, app: 'wordnest' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/capture') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; if (body.length > 10_000) req.destroy(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const word = String(data.word || '').trim().slice(0, 60);
          if (word && mainWindow) {
            mainWindow.webContents.send('capture-word', { word, pageUrl: data.pageUrl || '' });
            if (mainWindow.isMinimized()) mainWindow.flashFrame(true);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid body' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
  });

  // Chỉ lắng nghe trên 127.0.0.1 — không mở ra ngoài mạng LAN/internet.
  server.listen(BRIDGE_PORT, '127.0.0.1');
  server.on('error', () => { /* cổng đang bị chiếm bởi tiến trình khác (hiếm, vì đã chặn 2 instance) — app vẫn dùng được bình thường, chỉ là không nhận được từ từ tiện ích */ });
  return server;
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-app-version', () => app.getVersion());

// ════════════════════════════════════════════════════════
// MỞ RỘNG NGUỒN TRA TỪ — Tatoeba (kho câu ví dụ thật, có bản dịch tiếng Việt
// sẵn cho rất nhiều câu) + Datamuse (phiên âm ARPAbet, chuyển sang IPA) khi
// dictionaryapi.dev không có hoặc quá ít dữ liệu. Cả 2 API này KHÔNG trả
// header CORS nên phải gọi từ main process (Node, không bị CORS chặn) rồi
// chuyển kết quả qua IPC cho renderer — renderer tự gọi trực tiếp sẽ bị chặn.
// ════════════════════════════════════════════════════════
async function fetchJsonWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const TATOEBA_SEARCH_URL = 'https://tatoeba.org/en/api_v0/search';

ipcMain.handle('fetch-tatoeba-examples', async (event, rawWord) => {
  const word = String(rawWord || '').trim().slice(0, 60);
  if (!word) return [];

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRe = new RegExp('\\b' + escaped + '\\b', 'i');
  const seen = new Set();
  const out = [];

  function ingest(data) {
    for (const r of (data?.results || [])) {
      if (out.length >= 60) break;
      if (!r?.text || seen.has(r.text) || !wordRe.test(r.text)) continue;
      seen.add(r.text);
      let vi = null;
      const flat = (r.translations || []).flat();
      const match = flat.find(t => t && t.lang === 'vie' && t.text);
      if (match) vi = match.text;
      out.push({ text: r.text, vi });
    }
  }

  const q = encodeURIComponent(word);
  // Ưu tiên câu đã có sẵn bản dịch tiếng Việt (do người thật dịch, nhanh + chính xác hơn máy dịch)
  const withVi = await fetchJsonWithTimeout(`${TATOEBA_SEARCH_URL}?from=eng&to=vie&query=${q}&orphans=no&unapproved=no&perPage=50`, 8000);
  if (withVi) ingest(withVi);

  // Nếu chưa đủ đa dạng, lấy thêm câu tiếng Anh thuần (chưa có bản dịch sẵn, sẽ dịch máy khi hiện ra)
  if (out.length < 20) {
    const plain = await fetchJsonWithTimeout(`${TATOEBA_SEARCH_URL}?from=eng&query=${q}&orphans=no&unapproved=no&perPage=50`, 8000);
    if (plain) ingest(plain);
  }

  return out;
});

// Bảng quy đổi ARPAbet (CMU Pronouncing Dictionary, Datamuse trả về dạng này)
// sang IPA — dùng làm phiên âm dự phòng khi dictionaryapi.dev không có.
const ARPABET_TO_IPA = {
  AA: 'ɑ', AE: 'æ', AH: 'ə', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð',
  EH: 'ɛ', ER: 'ɚ', EY: 'eɪ',
  F: 'f', G: 'g', HH: 'h',
  IH: 'ɪ', IY: 'i',
  JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ',
  OW: 'oʊ', OY: 'ɔɪ',
  P: 'p', R: 'r', S: 's', SH: 'ʃ',
  T: 't', TH: 'θ',
  UH: 'ʊ', UW: 'u',
  V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
function arpabetToIpa(pronTag) {
  const phones = pronTag.trim().split(/\s+/);
  let ipa = '';
  for (const ph of phones) {
    const m = ph.match(/^([A-Z]+)([0-2])?$/);
    if (!m) continue;
    const base = m[1], stress = m[2];
    let sym = ARPABET_TO_IPA[base];
    if (sym === undefined) continue;
    if (base === 'AH' && stress && stress !== '0') sym = 'ʌ'; // AH có trọng âm đọc /ʌ/, không phải schwa
    if (stress === '1') ipa += 'ˈ' + sym;
    else if (stress === '2') ipa += 'ˌ' + sym;
    else ipa += sym;
  }
  return ipa;
}

ipcMain.handle('fetch-phonetic-fallback', async (event, rawWord) => {
  const word = String(rawWord || '').trim().toLowerCase().slice(0, 60);
  if (!word || /\s/.test(word)) return ''; // Datamuse chỉ tra được từ đơn, không tra cụm từ

  const data = await fetchJsonWithTimeout(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=r&max=1`, 6000);
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry || entry.word !== word) return null; // tránh lấy phiên âm của từ gần đúng khác nghĩa
  const tag = (entry.tags || []).find(t => t.startsWith('pron:'));
  if (!tag) return '';
  const ipa = arpabetToIpa(tag.slice(5));
  return ipa ? '/' + ipa + '/' : '';
});

// ════════════════════════════════════════════════════════
// AUTO-UPDATE — chỉ KIỂM TRA và BÁO khi mở app, không tự tải gì cả nếu người
// dùng chưa đồng ý. Bấm "Cập nhật ngay" mới thật sự tải, rồi tự khởi động lại
// để áp dụng — không cần gỡ cài đặt rồi tải file mới như cách thủ công.
// LƯU Ý: macOS yêu cầu app được ký bằng chứng chỉ Apple (trả phí) mới auto-update
// được; chưa có chứng chỉ thì bước này sẽ lỗi êm và người dùng Mac vẫn phải tải
// bản .dmg mới thủ công như trước. Windows không cần ký vẫn auto-update được.
// ════════════════════════════════════════════════════════
function setupAutoUpdater() {
  if (!app.isPackaged) return; // chạy bằng `electron .` lúc dev thì không có gì để kiểm tra

  autoUpdater.autoDownload = false;       // CHỈ kiểm tra, không tự tải
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', { version: info.version });
  });
  autoUpdater.on('update-downloaded', () => {
    // Người dùng đã bấm "Cập nhật ngay" trước đó và tải xong -> tự khởi động lại luôn,
    // không bắt bấm thêm lần nữa.
    autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update-error');
    console.error('[auto-update] lỗi:', err == null ? 'unknown' : err.message);
  });

  // Hoãn vài giây để không cạnh tranh CPU/băng thông với lúc app vừa mở/render —
  // người dùng cũng không cần biết kết quả ngay tức khắc trong vài giây đầu.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => { /* không có mạng, hoặc nền tảng chưa hỗ trợ (vd Mac chưa ký) — bỏ qua, app vẫn chạy bình thường */ });
  }, 4000);
}

// Người dùng bấm "Cập nhật ngay" trên banner trong app -> mới thật sự tải về
ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate().catch(() => {
    if (mainWindow) mainWindow.webContents.send('update-error');
  });
});
