'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// utils.js cung cấp escHtml/escAttr/formatAddedAt mà trashEntryHtml() cần.
const ctx = loadScripts(['utils.js', 'trash.js']);
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

// ════════════════════════════════════════════════════════
// trashEntryHtml — regression coverage for the real v1.0.14 crash: a malformed
// trash entry (e.g. from a corrupted/foreign import file) used to throw inside
// .map(trashEntryHtml) and take down the whole Trash tab render, because the
// old code assumed every entry was either a well-formed 'word' or 'folder'
// entry and accessed .word.word / .folder.name unguarded. It must now fall
// back to a "corrupted entry" card (purge-only, no restore) instead.
// ════════════════════════════════════════════════════════

test('trashEntryHtml renders a valid word entry with word/meaning and both action buttons', () => {
  const html = ctx.trashEntryHtml({ id: 't1', type: 'word', deletedAt: Date.now(), word: { word: 'apple', meaning: 'quả táo' } });
  assert.match(html, /apple/);
  assert.match(html, /quả táo/);
  assert.match(html, /data-restore="t1"/);
  assert.match(html, /data-purge="t1"/);
});

test('trashEntryHtml renders a word entry with a missing meaning without throwing', () => {
  // Cùng đợt sửa v1.0.14: trước đây escHtml(w.meaning) không có fallback '' sẽ throw.
  assert.doesNotThrow(() => ctx.trashEntryHtml({ id: 't1', type: 'word', deletedAt: Date.now(), word: { word: 'apple' } }));
});

test('trashEntryHtml renders a valid folder entry with name and word count', () => {
  const html = ctx.trashEntryHtml({ id: 't2', type: 'folder', deletedAt: Date.now(), folder: { name: 'Du lịch' }, words: [{}, {}] });
  assert.match(html, /Du lịch/);
  assert.match(html, /2 từ bên trong/);
  assert.match(html, /data-restore="t2"/);
});

test('trashEntryHtml falls back to a "corrupted entry" card for a word-type entry missing .word, instead of throwing', () => {
  assert.doesNotThrow(() => {
    const html = ctx.trashEntryHtml({ id: 't3', type: 'word', deletedAt: Date.now() });
    assert.match(html, /Mục dữ liệu bị lỗi/);
    assert.doesNotMatch(html, /data-restore=/); // entry hỏng không cho khôi phục
    assert.match(html, /data-purge="t3"/); // vẫn xóa vĩnh viễn được để dọn đi
  });
});

test('trashEntryHtml falls back to a "corrupted entry" card when .word.word is not a string', () => {
  const html = ctx.trashEntryHtml({ id: 't4', type: 'word', deletedAt: Date.now(), word: { word: 12345 } });
  assert.match(html, /Mục dữ liệu bị lỗi/);
});

test('trashEntryHtml falls back to a "corrupted entry" card for a folder-type entry missing .folder', () => {
  const html = ctx.trashEntryHtml({ id: 't5', type: 'folder', deletedAt: Date.now() });
  assert.match(html, /Mục dữ liệu bị lỗi/);
  assert.doesNotMatch(html, /data-restore=/);
});

test('trashEntryHtml falls back to a "corrupted entry" card when .folder.name is not a string', () => {
  const html = ctx.trashEntryHtml({ id: 't6', type: 'folder', deletedAt: Date.now(), folder: {} });
  assert.match(html, /Mục dữ liệu bị lỗi/);
});

test('trashEntryHtml falls back to a "corrupted entry" card for an unrecognized type', () => {
  const html = ctx.trashEntryHtml({ id: 't7', type: 'something-else', deletedAt: Date.now() });
  assert.match(html, /Mục dữ liệu bị lỗi/);
});

// ════════════════════════════════════════════════════════
// restoreTrashWord / restoreTrashFolder — mutate the module-level words/folders/
// trash arrays. Since trash.js declares them with plain assignment (not `const`/
// `let` inside these functions — they're bound in storage.js in the real app),
// setting them directly as properties on `ctx` before each call works the same
// way loadScripts()'s extraGlobals does: sloppy-mode global lookups inside the
// vm context resolve through the sandbox object.
// ════════════════════════════════════════════════════════
function resetTrashState({ words = [], folders = [], trash = [] } = {}) {
  ctx.words = words;
  ctx.folders = folders;
  ctx.trash = trash;
  ctx.saveWords = () => true;
  ctx.saveFolders = () => true;
  ctx.saveTrash = () => true;
  ctx.refreshWlView = () => {};
  ctx.renderHome = () => {};
  // utils.js đã nạp định nghĩa showToast THẬT (đụng document.getElementById, trả
  // null trong sandbox tối giản) — ghi đè lại bằng no-op cho các test này.
  ctx.showToast = () => {};
}

test('restoreTrashWord moves the word back into words[] and removes the trash entry', () => {
  resetTrashState({
    trash: [{ id: 't1', type: 'word', deletedAt: Date.now(), word: { id: 'w1', word: 'apple', meaning: 'quả táo' } }],
  });
  ctx.restoreTrashWord('t1');
  assert.equal(ctx.words.length, 1);
  assert.equal(ctx.words[0].word, 'apple');
  assert.equal(ctx.trash.length, 0);
});

test('restoreTrashWord refuses to restore a word whose text already exists (case-insensitive), leaving trash untouched', () => {
  resetTrashState({
    words: [{ id: 'w-existing', word: 'Apple', meaning: 'đã có' }],
    trash: [{ id: 't1', type: 'word', deletedAt: Date.now(), word: { id: 'w1', word: 'apple', meaning: 'quả táo' } }],
  });
  ctx.restoreTrashWord('t1');
  assert.equal(ctx.words.length, 1); // không thêm bản trùng
  assert.equal(ctx.trash.length, 1); // vẫn còn trong thùng rác, chưa bị xóa
});

test('restoreTrashWord clears folderId if the original folder no longer exists', () => {
  resetTrashState({
    folders: [], // thư mục gốc đã bị xóa hẳn
    trash: [{ id: 't1', type: 'word', deletedAt: Date.now(), word: { id: 'w1', word: 'apple', meaning: 'quả táo', folderId: 'gone' } }],
  });
  ctx.restoreTrashWord('t1');
  assert.equal(ctx.words[0].folderId, null);
});

test('restoreTrashWord keeps folderId if the original folder still exists', () => {
  resetTrashState({
    folders: [{ id: 'f1', name: 'Du lịch' }],
    trash: [{ id: 't1', type: 'word', deletedAt: Date.now(), word: { id: 'w1', word: 'apple', meaning: 'quả táo', folderId: 'f1' } }],
  });
  ctx.restoreTrashWord('t1');
  assert.equal(ctx.words[0].folderId, 'f1');
});

test('restoreTrashWord rolls back words/trash if saving fails', () => {
  resetTrashState({
    trash: [{ id: 't1', type: 'word', deletedAt: Date.now(), word: { id: 'w1', word: 'apple', meaning: 'quả táo' } }],
  });
  ctx.saveWords = () => false;
  ctx.restoreTrashWord('t1');
  assert.equal(ctx.words.length, 0);
  assert.equal(ctx.trash.length, 1);
});

test('restoreTrashFolder restores the folder and its words, reusing an existing same-name local folder', () => {
  resetTrashState({
    folders: [{ id: 'f-local', name: 'Du Lịch' }], // đã có thư mục trùng tên (khác hoa/thường) tạo tay trước đó
    trash: [{
      id: 't1', type: 'folder', deletedAt: Date.now(),
      folder: { id: 'f-old', name: 'du lịch' },
      words: [{ id: 'w1', word: 'passport', meaning: 'hộ chiếu' }],
    }],
  });
  ctx.restoreTrashFolder('t1');
  assert.equal(ctx.folders.length, 1); // không tạo thư mục trùng, dùng lại cái local
  assert.equal(ctx.words.length, 1);
  assert.equal(ctx.words[0].folderId, 'f-local');
  assert.equal(ctx.trash.length, 0);
});

test('restoreTrashFolder skips words that would collide by name, restores the rest', () => {
  resetTrashState({
    words: [{ id: 'w-existing', word: 'passport', meaning: 'đã có sẵn' }],
    trash: [{
      id: 't1', type: 'folder', deletedAt: Date.now(),
      folder: { id: 'f-old', name: 'Du lịch' },
      words: [
        { id: 'w1', word: 'passport', meaning: 'hộ chiếu' }, // trùng -> bị bỏ qua
        { id: 'w2', word: 'visa', meaning: 'thị thực' },
      ],
    }],
  });
  ctx.restoreTrashFolder('t1');
  assert.equal(ctx.words.length, 2); // 1 cũ + 1 mới (visa), bỏ qua passport trùng
  assert.ok(ctx.words.some(w => w.word === 'visa'));
  assert.equal(ctx.words.filter(w => w.word === 'passport').length, 1); // không nhân đôi
  assert.equal(ctx.folders.length, 1); // thư mục vẫn được tạo lại dù có từ bị bỏ qua
});

test('restoreTrashFolder rolls back words/folders/trash if saving fails', () => {
  resetTrashState({
    trash: [{
      id: 't1', type: 'folder', deletedAt: Date.now(),
      folder: { id: 'f-old', name: 'Du lịch' },
      words: [{ id: 'w1', word: 'passport', meaning: 'hộ chiếu' }],
    }],
  });
  ctx.saveFolders = () => false;
  ctx.restoreTrashFolder('t1');
  assert.equal(ctx.words.length, 0);
  assert.equal(ctx.folders.length, 0);
  assert.equal(ctx.trash.length, 1);
});
