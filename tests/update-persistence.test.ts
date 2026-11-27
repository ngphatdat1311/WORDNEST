import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDurableStorage } = require('../electron/durable-storage.js');

describe('Zero-Data-Loss Storage & Update Safety', () => {
  it('serializes rapid concurrent writes so the final word is never lost or overwritten by stale state', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-durable-'));
    try {
      const store = createDurableStorage(tmpDir);
      const key = 'wordnest-v2-storage';

      // Fire 25 rapid overlapping writes (simulating fast flashcard reviews & word additions)
      const promises: Promise<boolean>[] = [];
      for (let i = 1; i <= 25; i++) {
        const payload = JSON.stringify({
          state: {
            words: Array.from({ length: i }, (_, idx) => ({
              id: `w_${idx + 1}`,
              word: `word_${idx + 1}`,
            })),
          },
        });
        promises.push(store.writeQueued(key, payload));
      }

      const results = await Promise.all(promises);
      assert.ok(results.every(Boolean), 'Every queued write should succeed');
      await store.flushAll();

      const finalRaw = store.readSafe(key);
      assert.ok(finalRaw, 'Final state should exist on disk');
      const parsed = JSON.parse(finalRaw);
      assert.equal(parsed.state.words.length, 25);
      assert.equal(parsed.state.words[24].word, 'word_25');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects corrupted/truncated writes and self-heals automatically if primary file is damaged', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-heal-'));
    try {
      const store = createDurableStorage(tmpDir);
      const key = 'wordnest-v2-storage';

      const good1 = JSON.stringify({ state: { words: [{ id: '1', word: 'serendipity' }] } });
      const good2 = JSON.stringify({
        state: {
          words: [
            { id: '1', word: 'serendipity' },
            { id: '2', word: 'resilient' },
          ],
        },
      });

      await store.writeQueued(key, good1);
      await store.writeQueued(key, good2);

      // Attempt to write truncated/invalid JSON — MUST be rejected without damaging good2
      const badOk = await store.writeQueued(key, '{"state": {"words": [BROKEN');
      assert.equal(badOk, false);
      assert.equal(store.readSafe(key), good2);

      // Simulate sudden power-cut corrupting the primary file to 0 bytes
      const filePath = store.getStorageFilePath(key);
      fs.writeFileSync(filePath, '', 'utf8');

      // readSafe MUST automatically recover from .prev shadow backup & self-heal!
      const recovered = store.readSafe(key);
      assert.ok(recovered, 'Should self-heal from .prev shadow copy');
      const parsed = JSON.parse(recovered);
      assert.equal(parsed.state.words[0].word, 'serendipity');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('creates pre-update snapshot and preserves 100% of data across simulated version upgrade', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-upgrade-'));
    try {
      const key = 'wordnest-v2-storage';
      // Old version (v2.4.1) running & saving user data
      const oldAppStore = createDurableStorage(tmpDir);
      const lastSecondPayload = JSON.stringify({
        state: {
          words: [
            { id: 'w1', word: 'meticulous', meaning: 'tỉ mỉ' },
            { id: 'w2', word: 'eloquent', meaning: 'lưu loát' },
            { id: 'w3', word: 'last_second_word', meaning: 'từ vừa thêm 10ms trước khi update' },
          ],
          streak: { current: 14, best: 21, streakFreezes: 2 },
          dictationProgress: { 'lesson-1': { completedSegmentIds: ['s1', 's2', 's3'] } },
        },
      });

      // Simulate sync flush right before window closes for update
      const syncOk = oldAppStore.writeSyncSafe(key, lastSecondPayload);
      assert.equal(syncOk, true);
      await oldAppStore.flushAll();

      const snap = oldAppStore.createPreUpdateSnapshot(key, '2.4.1');
      assert.equal(snap.ok, true);
      assert.equal(fs.existsSync(snap.path), true);

      // New version (v2.4.2) starts up pointing to the same OS userData directory
      const newAppStore = createDurableStorage(tmpDir);
      const loaded = newAppStore.readSafe(key);
      assert.equal(loaded, lastSecondPayload);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });
});
