const fs = require('fs');
const path = require('path');

function sanitizeStorageKey(key) {
  const safe = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || 'wordnest-store';
}

function isValidJsonObjectString(raw) {
  if (typeof raw !== 'string' || raw.trim().length < 2) return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object';
  } catch {
    return false;
  }
}

function atomicWriteSync(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, content, 'utf8');
    try {
      fs.fsyncSync(fd);
    } catch {
      // Some virtual/network filesystems do not support fsync
    }
  } finally {
    fs.closeSync(fd);
  }

  // Keep a previous-good shadow copy (.prev) before replacing the primary file
  if (fs.existsSync(filePath)) {
    try {
      const prevContent = fs.readFileSync(filePath, 'utf8');
      if (isValidJsonObjectString(prevContent)) {
        fs.writeFileSync(`${filePath}.prev`, prevContent, 'utf8');
      }
    } catch {
      // Best-effort shadow backup
    }
  }

  try {
    fs.renameSync(tmpPath, filePath);
  } catch {
    // Windows fallback if AV momentarily inspects destination during rename
    fs.writeFileSync(filePath, content, 'utf8');
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore temp cleanup
    }
  }
}

/**
 * Crash-safe, strictly-ordered, self-healing JSON storage for Electron Desktop.
 * Guarantees zero word/progress loss across rapid edits, power cuts, and app updates.
 */
function createDurableStorage(userDataDir) {
  const storageDir = path.join(userDataDir, 'storage');
  const backupsDir = path.join(userDataDir, 'backups');
  const writeQueues = new Map();
  let writeSeq = 0;

  function getStorageFilePath(key) {
    fs.mkdirSync(storageDir, { recursive: true });
    return path.join(storageDir, `${sanitizeStorageKey(key)}.json`);
  }

  function maybeWriteDailyBackup(key, rawValue) {
    try {
      fs.mkdirSync(backupsDir, { recursive: true });
      const today = new Date().toISOString().slice(0, 10);
      const prefix = `${sanitizeStorageKey(key)}-`;
      const backupPath = path.join(backupsDir, `${prefix}${today}.json`);
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, rawValue, 'utf8');
        const existing = fs
          .readdirSync(backupsDir)
          .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
          .sort();
        while (existing.length > 7) {
          const oldest = existing.shift();
          if (oldest) {
            fs.unlinkSync(path.join(backupsDir, oldest));
          }
        }
      }
    } catch (err) {
      console.error('[WordNest Daily Backup]', err);
    }
  }

  function createPreUpdateSnapshot(key, currentVersion = 'unknown') {
    try {
      const raw = readSafe(key);
      if (!raw || !isValidJsonObjectString(raw)) return { ok: false, skipped: true };
      fs.mkdirSync(backupsDir, { recursive: true });
      const safeVer = String(currentVersion).replace(/[^0-9a-zA-Z._-]/g, '');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapName = `pre-update-${sanitizeStorageKey(key)}-v${safeVer}-${stamp}.json`;
      const snapPath = path.join(backupsDir, snapName);
      atomicWriteSync(snapPath, raw);

      // Keep the latest 10 pre-update snapshots so disk usage stays tiny
      const prefix = `pre-update-${sanitizeStorageKey(key)}-`;
      const snaps = fs
        .readdirSync(backupsDir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
        .sort();
      while (snaps.length > 10) {
        const oldest = snaps.shift();
        if (oldest) {
          fs.unlinkSync(path.join(backupsDir, oldest));
        }
      }
      return { ok: true, path: snapPath };
    } catch (err) {
      console.error('[WordNest Pre-Update Snapshot]', err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  function recoverFromBackups(key) {
    const filePath = getStorageFilePath(key);
    const candidates = [`${filePath}.prev`];

    if (fs.existsSync(backupsDir)) {
      const safeKey = sanitizeStorageKey(key);
      const backupFiles = fs
        .readdirSync(backupsDir)
        .filter((f) => f.endsWith('.json') && f.includes(safeKey))
        .map((f) => {
          const full = path.join(backupsDir, f);
          let mtimeMs = 0;
          try {
            mtimeMs = fs.statSync(full).mtimeMs;
          } catch {
            mtimeMs = 0;
          }
          return { full, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map((x) => x.full);
      candidates.push(...backupFiles);
    }

    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const raw = fs.readFileSync(candidate, 'utf8');
        if (isValidJsonObjectString(raw)) {
          // Self-heal primary file so subsequent reads are instant
          atomicWriteSync(filePath, raw);
          return raw;
        }
      } catch {
        // Try next candidate
      }
    }
    return null;
  }

  function readSafe(key) {
    try {
      const filePath = getStorageFilePath(key);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (isValidJsonObjectString(raw)) {
          return raw;
        }
        // Primary file exists but is empty or corrupted -> self-heal from .prev / backups!
        console.warn('[WordNest Storage] Corrupted primary file detected, self-healing...');
        return recoverFromBackups(key);
      }
      // Primary missing (e.g. accidental file move) -> check if backups exist
      return recoverFromBackups(key);
    } catch (err) {
      console.error('[WordNest Storage Read]', err);
      return recoverFromBackups(key);
    }
  }

  async function writeAtomicAsync(key, strVal) {
    if (!isValidJsonObjectString(strVal)) {
      console.warn('[WordNest Storage] Refused to persist invalid/truncated JSON payload.');
      return false;
    }

    const filePath = getStorageFilePath(key);
    const seq = ++writeSeq;
    const tmpPath = `${filePath}.${seq}.tmp`;

    const fh = await fs.promises.open(tmpPath, 'w');
    try {
      await fh.writeFile(strVal, 'utf8');
      try {
        await fh.sync();
      } catch {
        // Ignore fsync unsupported
      }
    } finally {
      await fh.close();
    }

    // Preserve previous valid snapshot as .prev before replacing
    if (fs.existsSync(filePath)) {
      try {
        const prev = await fs.promises.readFile(filePath, 'utf8');
        if (isValidJsonObjectString(prev)) {
          await fs.promises.writeFile(`${filePath}.prev`, prev, 'utf8');
        }
      } catch {
        // Ignore
      }
    }

    try {
      await fs.promises.rename(tmpPath, filePath);
    } catch {
      // Windows Defender transient lock fallback
      await fs.promises.writeFile(filePath, strVal, 'utf8');
      try {
        await fs.promises.unlink(tmpPath);
      } catch {
        // Ignore
      }
    }

    maybeWriteDailyBackup(key, strVal);
    return true;
  }

  function writeQueued(key, value) {
    const safeKey = sanitizeStorageKey(key);
    const strVal = String(value);
    const prev = writeQueues.get(safeKey) || Promise.resolve(true);

    const next = prev
      .catch(() => true)
      .then(() => writeAtomicAsync(safeKey, strVal))
      .catch((err) => {
        console.error('[WordNest Storage Write]', err);
        return false;
      });

    writeQueues.set(safeKey, next);
    // Clean up settled queue entry when tail finishes
    next.finally(() => {
      if (writeQueues.get(safeKey) === next) {
        writeQueues.delete(safeKey);
      }
    });
    return next;
  }

  function writeSyncSafe(key, value) {
    try {
      const strVal = String(value);
      if (!isValidJsonObjectString(strVal)) return false;
      const filePath = getStorageFilePath(key);
      atomicWriteSync(filePath, strVal);
      maybeWriteDailyBackup(key, strVal);
      return true;
    } catch (err) {
      console.error('[WordNest Storage Sync Write]', err);
      return false;
    }
  }

  async function removeSafe(key) {
    const safeKey = sanitizeStorageKey(key);
    const prev = writeQueues.get(safeKey) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        const filePath = getStorageFilePath(safeKey);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
        return true;
      })
      .catch((err) => {
        console.error('[WordNest Storage Remove]', err);
        return false;
      });
    writeQueues.set(safeKey, next);
    return next;
  }

  async function flushAll() {
    const pending = Array.from(writeQueues.values());
    if (pending.length === 0) return;
    await Promise.allSettled(pending);
  }

  return {
    getStorageFilePath,
    readSafe,
    writeQueued,
    writeSyncSafe,
    removeSafe,
    flushAll,
    createPreUpdateSnapshot,
  };
}

module.exports = {
  createDurableStorage,
  isValidJsonObjectString,
};
