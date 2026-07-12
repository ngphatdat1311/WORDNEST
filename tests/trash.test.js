'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

const ctx = loadScripts(['trash.js']);
// Giá trị ttlMs tùy ý dùng cho test biên — không đọc ctx.TRASH_TTL_MS vì hằng số
// top-level khai báo bằng `const` không lộ ra thành property của sandbox (vm module),
// khác với function declaration. Test "dùng default" bên dưới tự kiểm tra riêng.
const TTL = 1000;

test('isTrashEntryExpired is false for an entry deleted well within the TTL window', () => {
  const now = Date.now();
  assert.equal(ctx.isTrashEntryExpired({ deletedAt: now - 10 }, now, TTL), false);
});

test('isTrashEntryExpired is false exactly at the TTL boundary', () => {
  const now = Date.now();
  assert.equal(ctx.isTrashEntryExpired({ deletedAt: now - TTL }, now, TTL), false);
});

test('isTrashEntryExpired is true once an entry is older than the TTL', () => {
  const now = Date.now();
  assert.equal(ctx.isTrashEntryExpired({ deletedAt: now - TTL - 1 }, now, TTL), true);
});

test('isTrashEntryExpired treats a missing/corrupted deletedAt as very old (expired)', () => {
  // Nhất quán với trashEntryHtml(): entry hỏng dạng này vốn đã chỉ có thể xóa,
  // không khôi phục được — nên tự dọn luôn thay vì tồn tại vĩnh viễn.
  const now = Date.now();
  assert.equal(ctx.isTrashEntryExpired({}, now, TTL), true);
  assert.equal(ctx.isTrashEntryExpired({ deletedAt: null }, now, TTL), true);
});

test('isTrashEntryExpired defaults to a 30-day TTL when ttlMs is omitted', () => {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  assert.equal(ctx.isTrashEntryExpired({ deletedAt: now - THIRTY_DAYS_MS + 1000 }, now), false);
  assert.equal(ctx.isTrashEntryExpired({ deletedAt: now - THIRTY_DAYS_MS - 1000 }, now), true);
});
