import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBackupVaultManager, unlockDirAndFiles } = require('../electron/backup-vault.js');

describe('Protected Auto-Backup Vault (Encrypted, Lightweight & Delete-Locked)', () => {
  it('compresses JSON heavily, encrypts with AES-256-GCM, blocks deletion without password, and restores cleanly', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-vault-test-'));
    const userDataDir = path.join(tmpRoot, 'userdata');
    const vaultDir = path.join(tmpRoot, 'my-vault');

    try {
      const mgr = createBackupVaultManager({
        userDataDir,
        defaultVaultDir: vaultDir,
      });

      const setupRes = mgr.setupVault({ password: 'TestPass123', vaultDir });
      assert.equal(setupRes.ok, true);

      // Simulate realistic WordNest payload (~45 KB JSON)
      const payloadObj = {
        state: {
          words: Array.from({ length: 120 }, (_, i) => ({
            id: `w_${i}`,
            word: `vocabulary_${i}`,
            phonetic: '/vəʊˈkæb.jʊ.lər.i/',
            meaning: 'từ vựng học thuật tiếng Anh dùng hằng ngày',
            example: `This is example sentence number ${i} for continuous backup testing.`,
            mastery: i % 4,
          })),
        },
      };
      const rawJson = JSON.stringify(payloadObj);
      const writeRes = mgr.writeContinuousBackup(rawJson);
      assert.equal(writeRes.ok, true);

      // Must be super lightweight (compressed >75% smaller than raw JSON)
      assert.ok(
        writeRes.bytes < rawJson.length * 0.3,
        `Expected lightweight backup (<30% of ${rawJson.length}B), got ${writeRes.bytes}B`
      );

      // On Linux/macOS, OS delete-lock prevents unlinking the backup file directly!
      const latestFile = path.join(vaultDir, 'wordnest-latest.wnbak');
      let deleteBlocked = false;
      try {
        fs.unlinkSync(latestFile);
      } catch {
        deleteBlocked = true;
      }
      assert.equal(deleteBlocked, true, 'Backup file should be delete-protected while locked');

      // Wrong password MUST be rejected for both unlock and restore
      const badUnlock = mgr.unlockWithPassword('WrongPass', 'delete-all');
      assert.equal(badUnlock.ok, false);
      assert.equal(fs.existsSync(latestFile), true);

      const badRestore = mgr.restoreFromFile(latestFile, 'WrongPass');
      assert.equal(badRestore.ok, false);

      // Correct password restores 100% identical data
      const goodRestore = mgr.restoreFromFile(latestFile, 'TestPass123');
      assert.equal(goodRestore.ok, true);
      assert.equal(goodRestore.rawJson, rawJson);

      // Continuous backup updates cleanly even while vault is locked!
      const updatedJson = JSON.stringify({ updated: true, count: 121 });
      const writeRes2 = mgr.writeContinuousBackup(updatedJson);
      assert.equal(writeRes2.ok, true);
      const goodRestore2 = mgr.restoreFromFile(latestFile, 'TestPass123');
      assert.equal(goodRestore2.rawJson, updatedJson);

      // Correct password unlocks & allows deletion
      const goodUnlock = mgr.unlockWithPassword('TestPass123', 'delete-all');
      assert.equal(goodUnlock.ok, true);
      assert.equal(fs.existsSync(latestFile), false);
    } finally {
      // Ensure OS locks (Windows icacls/attrib, macOS chflags, Linux chmod) are released before cleanup
      try {
        unlockDirAndFiles(vaultDir);
      } catch {
        // ignore
      }
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // ignore transient Windows Defender/indexer lock on OS temp folder cleanup
      }
    }
  });
});
