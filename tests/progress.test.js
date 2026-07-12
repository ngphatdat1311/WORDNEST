'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// resetWordMastery() calls localDateKey() from utils.js.
const ctx = loadScripts(['utils.js', 'progress.js']);

test('resetWordMastery zeroes mastery/known/seen and resets SRS fields to their initial values', () => {
  const w = { word: 'apple', meaning: 'táo', mastery: 3, known: 12, seen: 15, srsInterval: 40, srsEF: 1.9, srsDue: '2020-01-01' };
  const result = ctx.resetWordMastery(w);
  assert.equal(result.mastery, 0);
  assert.equal(result.known, 0);
  assert.equal(result.seen, 0);
  assert.equal(result.srsInterval, 1);
  assert.equal(result.srsEF, 2.5);
  assert.equal(result.srsDue, ctx.localDateKey());
});

test('resetWordMastery does not mutate the original word object (pure)', () => {
  const w = { word: 'apple', meaning: 'táo', mastery: 3, known: 12, seen: 15 };
  ctx.resetWordMastery(w);
  assert.equal(w.mastery, 3);
  assert.equal(w.known, 12);
});

test('resetWordMastery preserves all other fields untouched (word, meaning, category, folderId...)', () => {
  const w = { word: 'apple', meaning: 'táo', category: 'Ẩm thực', type: 'noun', folderId: 'f1', suspended: true, mastery: 2 };
  const result = ctx.resetWordMastery(w);
  assert.equal(result.word, 'apple');
  assert.equal(result.meaning, 'táo');
  assert.equal(result.category, 'Ẩm thực');
  assert.equal(result.type, 'noun');
  assert.equal(result.folderId, 'f1');
  assert.equal(result.suspended, true); // "đã thuộc hẳn" là lựa chọn thủ công riêng, không bị đụng tới
});

// Không test RESET_PROGRESS_OPTIONS trực tiếp — khai báo bằng `const` ở top-level
// nên không lộ ra thành property của sandbox (vm module), giống TRASH_TTL_MS đã
// gặp trước đó (xem tests/trash.test.js). Đã test đủ phần logic thuần quan trọng
// (resetWordMastery) ở trên; danh sách 4 mục chỉ là cấu hình UI tĩnh.
