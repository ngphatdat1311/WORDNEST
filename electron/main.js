const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const net = require('net');
const fs = require('fs');

let mainWindow = null;
let serverProcess = null;
let activeServerUrl = null;

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
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
    stdio: 'pipe',
  });

  serverProcess.on('exit', () => {
    activeServerUrl = null;
    serverProcess = null;
  });

  serverProcess.stderr?.on('data', (chunk) => {
    console.error('[WordNest Server]', chunk.toString());
  });

  await waitForServer(url);
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

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  } catch {
    // Ignore offline update check failures
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
    try {
      const appUrl = await startEmbeddedServer();
      createWindow(appUrl);
      setupAutoUpdater();
    } catch (err) {
      console.error('Failed to launch WordNest:', err);
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
      stopEmbeddedServer();
      app.quit();
    }
  });

  app.on('before-quit', () => {
    stopEmbeddedServer();
  });
}
