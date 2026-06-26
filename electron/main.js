const { app, BrowserWindow, ipcMain } = require('electron');
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

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
