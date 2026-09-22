'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, createMemoryStore } = require('./helpers/sandbox');

// backup.js đọc storeGet/storeSet (định nghĩa ở storage.js, không load ở đây)
// và words/DEFAULT_WORDS (định nghĩa ở storage.js) — tiêm store giả qua
// extraGlobals và gán words/DEFAULT_WORDS trực tiếp lên sandbox, cùng cách
// tests/word-crud.test.js đã làm với `words`/`folders`.
const store = createMemoryStore();
const ctx = loadScripts(['backup.js'], { storeGet: store.storeGet, storeSet: store.storeSet });

function resetState({ words = [], defaultWords = [] } = {}) {
  ctx.words = words;
  ctx.DEFAULT_WORDS = defaultWords;
}

const DAY_MS = 86400000;

// ════════════════════════════════════════════════════════
// daysSince
// ════════════════════════════════════════════════════════
test('daysSince returns Infinity for falsy input (never backed up)', () => {
  assert.equal(ctx.daysSince(null), Infinity);
  assert.equal(ctx.daysSince(undefined), Infinity);
  assert.equal(ctx.daysSince(''), Infinity);
});

test('daysSince returns 0 for a timestamp from right now', () => {
  assert.equal(ctx.daysSince(new Date().toISOString()), 0);
});

test('daysSince returns 7 for a timestamp exactly 7 days ago', () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
  assert.equal(ctx.daysSince(sevenDaysAgo), 7);
});

test('daysSince floors partial days (6 days 23 hours ago -> 6, not 7)', () => {
  const almostSevenDays = new Date(Date.now() - (7 * DAY_MS - 3600000)).toISOString();
  assert.equal(ctx.daysSince(almostSevenDays), 6);
});

// ════════════════════════════════════════════════════════
// hasUnsavedChanges
// ════════════════════════════════════════════════════════
test('hasUnsavedChanges is false when words[] exactly matches DEFAULT_WORDS in order', () => {
  const defaultWords = [{ word: 'apple' }, { word: 'banana' }];
  resetState({ words: [{ word: 'apple' }, { word: 'banana' }], defaultWords });
  assert.equal(ctx.hasUnsavedChanges(), false);
});

test('hasUnsavedChanges is true when word count differs from DEFAULT_WORDS', () => {
  resetState({ words: [{ word: 'apple' }], defaultWords: [{ word: 'apple' }, { word: 'banana' }] });
  assert.equal(ctx.hasUnsavedChanges(), true);
});

test('hasUnsavedChanges is true when same count but a word differs at some index (e.g. edited/reordered)', () => {
  resetState({ words: [{ word: 'apple' }, { word: 'cherry' }], defaultWords: [{ word: 'apple' }, { word: 'banana' }] });
  assert.equal(ctx.hasUnsavedChanges(), true);
});

test('hasUnsavedChanges is false for two empty arrays (fresh install, nothing added yet)', () => {
  resetState({ words: [], defaultWords: [] });
  assert.equal(ctx.hasUnsavedChanges(), false);
});

// ════════════════════════════════════════════════════════
// shouldRemindBackup
// ════════════════════════════════════════════════════════
test('shouldRemindBackup is false when there are no unsaved changes, regardless of backup history', () => {
  resetState({ words: [{ word: 'apple' }], defaultWords: [{ word: 'apple' }] });
  store.storeSet('wordnest_last_backup', ''); // chưa từng backup -> daysSince = Infinity, vẫn phải false vì không có gì để nhắc
  assert.equal(ctx.shouldRemindBackup(), false);
});

test('shouldRemindBackup is false while the "nhắc lại sau" (dismiss) window is still active', () => {
  resetState({ words: [{ word: 'apple' }], defaultWords: [] }); // khác DEFAULT_WORDS -> có thay đổi chưa lưu
  store.storeSet('wordnest_last_backup', ''); // chưa từng backup
  store.storeSet('wordnest_backup_dismiss_until', String(Date.now() + DAY_MS)); // còn 1 ngày nữa mới hết hạn dismiss
  assert.equal(ctx.shouldRemindBackup(), false);
});

test('shouldRemindBackup is false when backed up recently (fewer than 7 days ago)', () => {
  resetState({ words: [{ word: 'apple' }], defaultWords: [] });
  store.storeSet('wordnest_backup_dismiss_until', '0');
  store.storeSet('wordnest_last_backup', new Date(Date.now() - 3 * DAY_MS).toISOString());
  assert.equal(ctx.shouldRemindBackup(), false);
});

test('shouldRemindBackup is true once 7+ days have passed since the last backup', () => {
  resetState({ words: [{ word: 'apple' }], defaultWords: [] });
  store.storeSet('wordnest_backup_dismiss_until', '0');
  store.storeSet('wordnest_last_backup', new Date(Date.now() - 8 * DAY_MS).toISOString());
  assert.equal(ctx.shouldRemindBackup(), true);
});

test('shouldRemindBackup is true when there are unsaved changes and backup has never been done', () => {
  resetState({ words: [{ word: 'apple' }], defaultWords: [] });
  store.storeSet('wordnest_backup_dismiss_until', '0');
  store.storeSet('wordnest_last_backup', '');
  assert.equal(ctx.shouldRemindBackup(), true);
});
