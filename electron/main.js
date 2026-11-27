const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');

const GITHUB_OWNER = 'ngphatdat1311';
const GITHUB_REPO = 'WORDNEST';

let mainWindow = null;
let serverProcess = null;
let activeServerUrl = null;
let captureServer = null;
const pendingExtensionWords = [];
const EXTENSION_CAPTURE_PORT = 51789;

function sanitizeStorageKey(key) {
  const safe = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || 'wordnest-store';
}

function getStorageFilePath(key) {
  const dir = path.join(app.getPath('userData'), 'storage');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${sanitizeStorageKey(key)}.json`);
}

function maybeWriteDailyBackup(key, rawValue) {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const prefix = `${sanitizeStorageKey(key)}-`;
    const backupPath = path.join(backupDir, `${prefix}${today}.json`);
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, rawValue, 'utf8');
      const existing = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
        .sort();
      while (existing.length > 5) {
        const oldest = existing.shift();
        if (oldest) {
          fs.unlinkSync(path.join(backupDir, oldest));
        }
      }
    }
  } catch (err) {
    console.error('[WordNest Backup]', err);
  }
}

function setupStorageIpc() {
  ipcMain.on('wordnest:storage-get-sync', (event, key) => {
    try {
      const filePath = getStorageFilePath(key);
      if (!fs.existsSync(filePath)) {
        event.returnValue = null;
        return;
      }
      event.returnValue = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error('[WordNest Storage Read]', err);
      event.returnValue = null;
    }
  });

  ipcMain.handle('wordnest:storage-set', async (_event, key, value) => {
    try {
      const filePath = getStorageFilePath(key);
      const tmpPath = `${filePath}.tmp`;
      const strVal = String(value);
      await fs.promises.writeFile(tmpPath, strVal, 'utf8');
      await fs.promises.rename(tmpPath, filePath);
      maybeWriteDailyBackup(key, strVal);
      return true;
    } catch (err) {
      console.error('[WordNest Storage Write]', err);
      return false;
    }
  });

  ipcMain.handle('wordnest:storage-remove', async (_event, key) => {
    try {
      const filePath = getStorageFilePath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch (err) {
      console.error('[WordNest Storage Remove]', err);
      return false;
    }
  });

  ipcMain.handle('wordnest:extension-drain', () => {
    const items = pendingExtensionWords.splice(0, pendingExtensionWords.length);
    return items;
  });
}

function startExtensionCaptureServer() {
  if (captureServer) return;
  captureServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/capture') {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 4096) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const word = String(parsed.word || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        const pageUrl = String(parsed.pageUrl || '').slice(0, 300);
        if (!word) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        const item = { word, pageUrl, ts: Date.now() };
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('wordnest:extension-capture', item);
        } else if (!pendingExtensionWords.some((w) => w.word.toLowerCase() === word.toLowerCase())) {
          pendingExtensionWords.push(item);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
  });

  captureServer.on('error', (err) => {
    console.warn('[WordNest Extension Capture]', err.message);
    captureServer = null;
  });

  captureServer.listen(EXTENSION_CAPTURE_PORT, '127.0.0.1');
}

function stopExtensionCaptureServer() {
  if (captureServer) {
    try {
      captureServer.close();
    } catch {
      // Ignore cleanup errors
    }
    captureServer = null;
  }
}

function findFreePort(startPort = 3210) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
    srv.listen(startPort, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('WordNest local server timed out'));
          return;
        }
        setTimeout(check, 200);
      });
      req.setTimeout(1500, () => {
        req.destroy();
      });
    };
    check();
  });
}

async function startEmbeddedServer() {
  if (process.env.ELECTRON_DEV_URL) {
    return process.env.ELECTRON_DEV_URL;
  }

  // Reuse the already running embedded server (prevents macOS activate from spawning
  // a second Next.js server on another port and splitting localStorage origins).
  if (activeServerUrl && serverProcess && !serverProcess.killed && serverProcess.exitCode === null) {
    return activeServerUrl;
  }

  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, 'standalone')
    : path.join(__dirname, '..', '.next', 'standalone');
  const serverEntry = path.join(standaloneDir, 'server.js');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Standalone server not found at ${serverEntry}. Run "npm run build:electron" first.`
    );
  }

  const port = await findFreePort(3210);
  const url = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneDir,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
    stdio: 'pipe',
  });

  let stderrBuf = '';
  let exitedEarly = null;

  serverProcess.on('exit', (code, signal) => {
    exitedEarly = { code, signal };
    activeServerUrl = null;
    serverProcess = null;
  });

  serverProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderrBuf = (stderrBuf + text).slice(-2000);
    console.error('[WordNest Server]', text);
  });

  await Promise.race([
    waitForServer(url),
    new Promise((_resolve, reject) => {
      const checkExit = setInterval(() => {
        if (exitedEarly) {
          clearInterval(checkExit);
          reject(
            new Error(
              `Embedded server exited early (code=${exitedEarly.code}, signal=${exitedEarly.signal}):\n${stderrBuf}`
            )
          );
        }
      }, 100);
      setTimeout(() => clearInterval(checkExit), 21000);
    }),
  ]);
  activeServerUrl = url;
  return url;
}

function stopEmbeddedServer() {
  activeServerUrl = null;
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {
      // Ignore cleanup errors
    }
    serverProcess = null;
  }
}

function setupAppMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        {
          label: 'Kiểm tra cập nhật...',
          click: () => {
            triggerUpdateCheck(true);
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 480,
    minHeight: 620,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon-512.png'),
    backgroundColor: '#F6F2EA',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in system browser while allowing YouTube iframe embeds
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Native mouse Back/Forward buttons on Windows & Linux
  mainWindow.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward' && mainWindow?.webContents.navigationHistory.canGoBack()) {
      mainWindow.webContents.navigationHistory.goBack();
    } else if (
      cmd === 'browser-forward' &&
      mainWindow?.webContents.navigationHistory.canGoForward()
    ) {
      mainWindow.webContents.navigationHistory.goForward();
    }
  });

  // Native two-finger swipe Back/Forward on macOS
  // Swiping fingers left-to-right fires 'right' (Go Back); right-to-left fires 'left' (Go Forward)
  mainWindow.on('swipe', (_e, direction) => {
    if (direction === 'right' && mainWindow?.webContents.navigationHistory.canGoBack()) {
      mainWindow.webContents.navigationHistory.goBack();
    } else if (direction === 'left' && mainWindow?.webContents.navigationHistory.canGoForward()) {
      mainWindow.webContents.navigationHistory.goForward();
    }
  });

  mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function compareSemver(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function fetchLatestGithubRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        headers: {
          'User-Agent': `WordNest-Desktop/${app.getVersion()}`,
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('GitHub Release check timeout'));
    });
  });
}

function pickOsDownloadUrl(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const findAsset = (re) => assets.find((a) => re.test(a.name || ''))?.browser_download_url;
  if (process.platform === 'win32') {
    return findAsset(/\.exe$/i) || release.html_url;
  }
  if (process.platform === 'darwin') {
    return findAsset(/\.dmg$/i) || release.html_url;
  }
  if (process.env.APPIMAGE) {
    return findAsset(/\.AppImage$/i) || release.html_url;
  }
  return findAsset(/\.deb$/i) || findAsset(/\.AppImage$/i) || release.html_url;
}

async function checkGithubReleaseFallback(manual = false) {
  try {
    const release = await fetchLatestGithubRelease();
    const latestTag = String(release?.tag_name || '').replace(/^v/i, '');
    const currentVer = app.getVersion();
    if (latestTag && compareSemver(latestTag, currentVer) > 0) {
      const targetUrl = pickOsDownloadUrl(release);
      const { response } = await dialog.showMessageBox(mainWindow || undefined, {
        type: 'info',
        title: 'Đã có bản cập nhật WordNest mới',
        message: `WordNest v${latestTag} đã sẵn sàng! (Hiện tại: v${currentVer})`,
        detail:
          'Toàn bộ từ vựng, tiến độ nghe và lịch ôn FSRS v5 của bạn được lưu riêng và giữ nguyên 100% khi cài đè bản mới.',
        buttons: ['Tải bản mới ngay', 'Để sau'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0 && targetUrl) {
        shell.openExternal(targetUrl);
      }
      return { status: 'available', latestVersion: latestTag };
    }

    if (manual) {
      await dialog.showMessageBox(mainWindow || undefined, {
        type: 'info',
        title: 'WordNest đã ở bản mới nhất',
        message: `Bạn đang dùng WordNest v${currentVer} mới nhất!`,
        buttons: ['Đóng'],
      });
    }
    return { status: 'up-to-date', currentVersion: currentVer };
  } catch (err) {
    if (manual) {
      await dialog.showMessageBox(mainWindow || undefined, {
        type: 'warning',
        title: 'Không thể kiểm tra cập nhật',
        message: 'Không thể kết nối GitHub Releases lúc này. Vui lòng thử lại sau.',
        detail: err instanceof Error ? err.message : '',
        buttons: ['Đóng'],
      });
    }
    return { status: 'error' };
  }
}

function supportsSilentAutoUpdate() {
  if (!app.isPackaged) return false;
  if (process.platform === 'win32') return true;
  if (process.platform === 'linux') return Boolean(process.env.APPIMAGE);
  // macOS Squirrel.Mac only works when Apple Developer code-signed; otherwise fallback cleanly
  return process.platform === 'darwin';
}

let updaterInitialized = false;
let manualCheckPending = false;

function setupAutoUpdater() {
  ipcMain.handle('wordnest:get-version', () => app.getVersion());
  ipcMain.handle('wordnest:check-updates', () => triggerUpdateCheck(true));

  if (!app.isPackaged || updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-not-available', () => {
    if (manualCheckPending) {
      manualCheckPending = false;
      dialog.showMessageBox(mainWindow || undefined, {
        type: 'info',
        title: 'WordNest đã ở bản mới nhất',
        message: `Bạn đang dùng WordNest v${app.getVersion()} mới nhất!`,
        buttons: ['Đóng'],
      });
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    manualCheckPending = false;
    const version = info?.version || 'mới';
    const { response } = await dialog.showMessageBox(mainWindow || undefined, {
      type: 'info',
      title: 'Đã tải xong bản cập nhật WordNest',
      message: `Đã tải xong WordNest v${version}!`,
      detail:
        'Khởi động lại ngay để cài bản mới? Toàn bộ từ vựng, tiến độ nghe và lịch ôn FSRS v5 của bạn được giữ nguyên 100%.',
      buttons: ['Cập nhật & Khởi động lại', 'Để sau (tự cài khi đóng app)'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      stopExtensionCaptureServer();
      stopEmbeddedServer();
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on('error', () => {
    // On unsigned macOS builds or restricted Linux installs, Squirrel/updater throws —
    // transparently fall back to GitHub Release API check so the user still gets notified!
    const wasManual = manualCheckPending;
    manualCheckPending = false;
    checkGithubReleaseFallback(wasManual);
  });

  // Check silently 4 seconds after launch so startup feels instant
  setTimeout(() => {
    triggerUpdateCheck(false);
  }, 4000);
}

async function triggerUpdateCheck(manual = false) {
  if (!app.isPackaged) {
    return checkGithubReleaseFallback(manual);
  }
  if (!supportsSilentAutoUpdate()) {
    // e.g. Linux .deb (requires sudo to overwrite system package) -> open direct .deb download
    return checkGithubReleaseFallback(manual);
  }
  try {
    manualCheckPending = manual;
    await autoUpdater.checkForUpdates();
    return { status: 'checking' };
  } catch {
    manualCheckPending = false;
    return checkGithubReleaseFallback(manual);
  }
}

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

  app.whenReady().then(async () => {
    setupAppMenu();
    setupStorageIpc();
    startExtensionCaptureServer();
    try {
      const appUrl = await startEmbeddedServer();
      createWindow(appUrl);
      setupAutoUpdater();
    } catch (err) {
      console.error('Failed to launch WordNest:', err);
      dialog.showErrorBox(
        'WordNest không thể khởi động',
        err instanceof Error ? err.message : String(err)
      );
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        startEmbeddedServer()
          .then((url) => createWindow(url))
          .catch(() => {});
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      stopExtensionCaptureServer();
      stopEmbeddedServer();
      app.quit();
    }
  });

  app.on('before-quit', () => {
    stopExtensionCaptureServer();
    stopEmbeddedServer();
  });
}
