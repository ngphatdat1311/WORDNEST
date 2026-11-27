const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const MAGIC = Buffer.from('WNBK1'); // 5-byte magic header for WordNest Protected Backup v1
const MAX_DAILY_SNAPSHOTS = 7;

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
}

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = deriveKey(password, salt);
  return {
    saltHex: salt.toString('hex'),
    hashHex: hash.toString('hex'),
  };
}

function verifyPassword(password, saltHex, expectedHashHex) {
  if (!password || !saltHex || !expectedHashHex) return false;
  try {
    const { hashHex } = hashPassword(password, saltHex);
    const a = Buffer.from(hashHex, 'hex');
    const b = Buffer.from(expectedHashHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Compresses (gzip level 9) and encrypts (AES-256-GCM) backup JSON into a tiny,
 * portable `.wnbak` binary buffer. Embeds a password-wrapped copy of the dataKey
 * so the file can be decrypted on ANY computer using only the vault password.
 */
function encodeProtectedBackup(rawJsonString, dataKeyBuf, wrappedKeyBlock) {
  const compressed = zlib.gzipSync(Buffer.from(String(rawJsonString), 'utf8'), { level: 9 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKeyBuf, iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Binary layout:
  // [5B MAGIC] [2B wrappedLen] [wrappedKeyBlock JSON UTF8] [12B iv] [16B authTag] [ciphertext]
  const wrappedBuf = Buffer.from(JSON.stringify(wrappedKeyBlock), 'utf8');
  const lenBuf = Buffer.alloc(2);
  lenBuf.writeUInt16BE(wrappedBuf.length, 0);

  return Buffer.concat([MAGIC, lenBuf, wrappedBuf, iv, authTag, ciphertext]);
}

function createWrappedKeyBlock(password, dataKeyBuf) {
  const salt = crypto.randomBytes(16);
  const kek = deriveKey(password, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const encKey = Buffer.concat([cipher.update(dataKeyBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    encKey: encKey.toString('hex'),
  };
}

function unwrapDataKeyWithPassword(password, wrappedKeyBlock) {
  const salt = Buffer.from(wrappedKeyBlock.salt, 'hex');
  const iv = Buffer.from(wrappedKeyBlock.iv, 'hex');
  const tag = Buffer.from(wrappedKeyBlock.tag, 'hex');
  const encKey = Buffer.from(wrappedKeyBlock.encKey, 'hex');
  const kek = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encKey), decipher.final()]);
}

function decodeProtectedBackup(fileBuf, password) {
  if (!Buffer.isBuffer(fileBuf) || fileBuf.length < 40) {
    throw new Error('File sao lưu không hợp lệ hoặc bị hỏng.');
  }
  if (!fileBuf.subarray(0, 5).equals(MAGIC)) {
    throw new Error('Định dạng file không phải WordNest Protected Backup (.wnbak).');
  }
  const wrappedLen = fileBuf.readUInt16BE(5);
  const wrappedStart = 7;
  const wrappedEnd = wrappedStart + wrappedLen;
  if (wrappedEnd + 28 > fileBuf.length) {
    throw new Error('Header file sao lưu không hợp lệ.');
  }

  const wrappedBlock = JSON.parse(fileBuf.subarray(wrappedStart, wrappedEnd).toString('utf8'));
  let dataKeyBuf;
  try {
    dataKeyBuf = unwrapDataKeyWithPassword(password, wrappedBlock);
  } catch {
    throw new Error('Mật khẩu bảo vệ không đúng!');
  }

  const iv = fileBuf.subarray(wrappedEnd, wrappedEnd + 12);
  const authTag = fileBuf.subarray(wrappedEnd + 12, wrappedEnd + 28);
  const ciphertext = fileBuf.subarray(wrappedEnd + 28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', dataKeyBuf, iv);
  decipher.setAuthTag(authTag);
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return zlib.gunzipSync(compressed).toString('utf8');
}

/* ═══ Cross-OS File & Directory Delete Protection ═══ */

function lockFileAndDir(vaultDir, filePaths) {
  const platform = process.platform;
  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) continue;
    try {
      if (platform === 'darwin') {
        fs.chmodSync(fp, 0o444);
        execFileSync('chflags', ['uchg', fp], { stdio: 'ignore' });
      } else if (platform === 'win32') {
        execFileSync('attrib', ['+R', fp], { stdio: 'ignore', windowsHide: true });
        const user = process.env.USERNAME || '';
        if (user) {
          execFileSync('icacls', [fp, '/deny', `${user}:(D,DC)`], {
            stdio: 'ignore',
            windowsHide: true,
          });
        }
      } else {
        // Linux: file read-only (0444)
        fs.chmodSync(fp, 0o444);
      }
    } catch {
      // Best-effort OS lock; never crash app
    }
  }

  try {
    if (platform === 'darwin') {
      execFileSync('chflags', ['uchg', vaultDir], { stdio: 'ignore' });
    } else if (platform === 'win32') {
      const user = process.env.USERNAME || '';
      if (user) {
        execFileSync('icacls', [vaultDir, '/deny', `${user}:(D,DC)`], {
          stdio: 'ignore',
          windowsHide: true,
        });
      }
    } else {
      // Linux: removing write permission on the vault directory (0555) makes normal
      // rm / unlink / Finder / Files delete fail with EACCES Permission Denied!
      fs.chmodSync(vaultDir, 0o555);
    }
  } catch {
    // Ignore unsupported filesystem errors (e.g. FAT32/exFAT USB drives)
  }
}

function unlockDirAndFiles(vaultDir) {
  if (!vaultDir || !fs.existsSync(vaultDir)) return;
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      execFileSync('chflags', ['nouchg', vaultDir], { stdio: 'ignore' });
    } else if (platform === 'win32') {
      const user = process.env.USERNAME || '';
      if (user) {
        execFileSync('icacls', [vaultDir, '/remove:d', user], {
          stdio: 'ignore',
          windowsHide: true,
        });
      }
    } else {
      fs.chmodSync(vaultDir, 0o755);
    }
  } catch {
    // Ignore
  }

  try {
    const entries = fs.readdirSync(vaultDir);
    for (const name of entries) {
      const fp = path.join(vaultDir, name);
      try {
        if (platform === 'darwin') {
          execFileSync('chflags', ['nouchg', fp], { stdio: 'ignore' });
          fs.chmodSync(fp, 0o644);
        } else if (platform === 'win32') {
          const user = process.env.USERNAME || '';
          if (user) {
            execFileSync('icacls', [fp, '/remove:d', user], {
              stdio: 'ignore',
              windowsHide: true,
            });
          }
          execFileSync('attrib', ['-R', fp], { stdio: 'ignore', windowsHide: true });
        } else {
          fs.chmodSync(fp, 0o644);
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }
}

/* ═══ Vault Manager (Config + Continuous Auto-Backup + Password-Gated Unlock) ═══ */

function createBackupVaultManager({ userDataDir, defaultVaultDir, safeStorage }) {
  const configPath = path.join(userDataDir, 'vault-config.json');

  function readConfig() {
    try {
      if (!fs.existsSync(configPath)) return null;
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      return null;
    }
  }

  function saveConfig(cfg) {
    fs.mkdirSync(userDataDir, { recursive: true });
    const tmp = `${configPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, configPath);
  }

  function sealDataKeyForRuntime(dataKeyBuf) {
    const hex = dataKeyBuf.toString('hex');
    if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
      return {
        mode: 'safeStorage',
        blob: safeStorage.encryptString(hex).toString('base64'),
      };
    }
    return {
      mode: 'local',
      blob: Buffer.from(hex, 'utf8').toString('base64'),
    };
  }

  function unsealDataKeyForRuntime(sealed) {
    if (!sealed?.blob) return null;
    try {
      if (sealed.mode === 'safeStorage' && safeStorage?.decryptString) {
        const hex = safeStorage.decryptString(Buffer.from(sealed.blob, 'base64'));
        return Buffer.from(hex, 'hex');
      }
      const hex = Buffer.from(sealed.blob, 'base64').toString('utf8');
      return Buffer.from(hex, 'hex');
    } catch {
      return null;
    }
  }

  function getStatus() {
    const cfg = readConfig();
    if (!cfg) {
      return {
        configured: false,
        enabled: false,
        locked: false,
        vaultDir: defaultVaultDir,
        lastBackupAt: null,
        lastBackupSizeBytes: 0,
        fileCount: 0,
      };
    }

    let fileCount = 0;
    try {
      if (cfg.vaultDir && fs.existsSync(cfg.vaultDir)) {
        fileCount = fs.readdirSync(cfg.vaultDir).filter((f) => f.endsWith('.wnbak')).length;
      }
    } catch {
      // Ignore
    }

    return {
      configured: true,
      enabled: Boolean(cfg.enabled),
      locked: Boolean(cfg.locked),
      vaultDir: cfg.vaultDir || defaultVaultDir,
      lastBackupAt: cfg.lastBackupAt || null,
      lastBackupSizeBytes: cfg.lastBackupSizeBytes || 0,
      fileCount,
    };
  }

  function setupVault({ password, currentPassword, vaultDir }) {
    const cleanPass = String(password || '').trim();
    if (cleanPass.length < 4) {
      return { ok: false, error: 'Mật khẩu bảo vệ cần tối thiểu 4 ký tự.' };
    }

    const existing = readConfig();
    if (existing?.passwordHash) {
      if (!verifyPassword(currentPassword, existing.passwordSalt, existing.passwordHash)) {
        return { ok: false, error: 'Mật khẩu hiện tại không đúng!' };
      }
      // Unlock previous folder cleanly before changing settings
      if (existing.vaultDir) {
        unlockDirAndFiles(existing.vaultDir);
      }
    }

    const targetDir = (vaultDir || existing?.vaultDir || defaultVaultDir).trim();
    fs.mkdirSync(targetDir, { recursive: true });

    const { saltHex, hashHex } = hashPassword(cleanPass);
    const dataKeyBuf = crypto.randomBytes(32);
    const wrappedKeyBlock = createWrappedKeyBlock(cleanPass, dataKeyBuf);
    const runtimeSealedKey = sealDataKeyForRuntime(dataKeyBuf);

    const nextCfg = {
      enabled: true,
      locked: true,
      vaultDir: targetDir,
      passwordSalt: saltHex,
      passwordHash: hashHex,
      wrappedKeyBlock,
      runtimeSealedKey,
      lastBackupAt: existing?.lastBackupAt || null,
      lastBackupSizeBytes: existing?.lastBackupSizeBytes || 0,
    };
    saveConfig(nextCfg);
    return { ok: true, status: getStatus() };
  }

  function writeContinuousBackup(rawJsonString) {
    const cfg = readConfig();
    if (!cfg || !cfg.enabled || !cfg.vaultDir || !cfg.wrappedKeyBlock) {
      return { ok: false, skipped: true };
    }
    const dataKeyBuf = unsealDataKeyForRuntime(cfg.runtimeSealedKey);
    if (!dataKeyBuf) {
      return { ok: false, error: 'Không thể giải mã khóa phiên sao lưu.' };
    }

    try {
      fs.mkdirSync(cfg.vaultDir, { recursive: true });
      unlockDirAndFiles(cfg.vaultDir);

      const encoded = encodeProtectedBackup(rawJsonString, dataKeyBuf, cfg.wrappedKeyBlock);
      const latestPath = path.join(cfg.vaultDir, 'wordnest-latest.wnbak');
      const tmpPath = path.join(cfg.vaultDir, '.wordnest-latest.tmp');
      fs.writeFileSync(tmpPath, encoded);
      fs.renameSync(tmpPath, latestPath);

      // Keep lightweight rotating daily snapshots (max 7 days)
      const todayKey = new Date().toISOString().slice(0, 10);
      const dailyName = `wordnest-${todayKey}.wnbak`;
      const dailyPath = path.join(cfg.vaultDir, dailyName);
      fs.writeFileSync(dailyPath, encoded);

      const dailyFiles = fs
        .readdirSync(cfg.vaultDir)
        .filter((f) => /^wordnest-\d{4}-\d{2}-\d{2}\.wnbak$/.test(f))
        .sort();
      while (dailyFiles.length > MAX_DAILY_SNAPSHOTS) {
        const oldest = dailyFiles.shift();
        if (oldest) {
          fs.unlinkSync(path.join(cfg.vaultDir, oldest));
        }
      }

      const allBackupPaths = fs
        .readdirSync(cfg.vaultDir)
        .filter((f) => f.endsWith('.wnbak'))
        .map((f) => path.join(cfg.vaultDir, f));

      if (cfg.locked !== false) {
        lockFileAndDir(cfg.vaultDir, allBackupPaths);
      }

      cfg.lastBackupAt = new Date().toISOString();
      cfg.lastBackupSizeBytes = encoded.length;
      saveConfig(cfg);
      return { ok: true, bytes: encoded.length, path: latestPath, status: getStatus() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function unlockWithPassword(password, action = 'unlock-folder') {
    const cfg = readConfig();
    if (!cfg) return { ok: false, error: 'Chưa thiết lập két sao lưu.' };
    if (!verifyPassword(password, cfg.passwordSalt, cfg.passwordHash)) {
      return { ok: false, error: 'Mật khẩu không đúng! Không thể mở khóa hoặc xóa file backup.' };
    }

    unlockDirAndFiles(cfg.vaultDir);

    if (action === 'delete-all') {
      try {
        if (fs.existsSync(cfg.vaultDir)) {
          for (const f of fs.readdirSync(cfg.vaultDir)) {
            if (f.endsWith('.wnbak')) {
              fs.unlinkSync(path.join(cfg.vaultDir, f));
            }
          }
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      cfg.lastBackupAt = null;
      cfg.lastBackupSizeBytes = 0;
      cfg.locked = false;
      saveConfig(cfg);
      return { ok: true, status: getStatus() };
    }

    if (action === 'disable') {
      cfg.enabled = false;
      cfg.locked = false;
      saveConfig(cfg);
      return { ok: true, status: getStatus() };
    }

    // action === 'unlock-folder': temporarily unlocks delete protection on OS
    cfg.locked = false;
    saveConfig(cfg);
    return { ok: true, status: getStatus() };
  }

  function relockVault() {
    const cfg = readConfig();
    if (!cfg || !cfg.vaultDir) return { ok: false, error: 'Chưa thiết lập két sao lưu.' };
    if (fs.existsSync(cfg.vaultDir)) {
      const files = fs
        .readdirSync(cfg.vaultDir)
        .filter((f) => f.endsWith('.wnbak'))
        .map((f) => path.join(cfg.vaultDir, f));
      lockFileAndDir(cfg.vaultDir, files);
    }
    cfg.enabled = true;
    cfg.locked = true;
    saveConfig(cfg);
    return { ok: true, status: getStatus() };
  }

  function restoreFromFile(filePath, password) {
    const cfg = readConfig();
    const targetFile =
      filePath || (cfg?.vaultDir ? path.join(cfg.vaultDir, 'wordnest-latest.wnbak') : '');
    if (!targetFile || !fs.existsSync(targetFile)) {
      return { ok: false, error: 'Không tìm thấy file sao lưu (.wnbak).' };
    }
    try {
      const buf = fs.readFileSync(targetFile);
      const rawJson = decodeProtectedBackup(buf, password);
      return { ok: true, rawJson };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Mật khẩu không đúng!' };
    }
  }

  return {
    getStatus,
    setupVault,
    writeContinuousBackup,
    unlockWithPassword,
    relockVault,
    restoreFromFile,
  };
}

module.exports = {
  createBackupVaultManager,
  encodeProtectedBackup,
  decodeProtectedBackup,
  createWrappedKeyBlock,
  hashPassword,
  verifyPassword,
};
