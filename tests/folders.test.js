'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// deleteFolder() (folders.js) calls genTrashId() (trash.js) — load both.
const ctx = loadScripts(['trash.js', 'folders.js']);

function resetState({ words = [], folders = [], trash = [] } = {}) {
  ctx.words = words;
  ctx.folders = folders;
  ctx.trash = trash;
  ctx.saveWords = () => true;
  ctx.saveFolders = () => true;
  ctx.saveTrash = () => true;
  ctx.closeConfirm = () => {};
  ctx.refreshWlView = () => {};
}

test('deleteFolder moves the folder and its words into one trash entry, removing both from live data', () => {
  resetState({
    words: [
      { id: 'w1', word: 'passport', meaning: 'hộ chiếu', folderId: 'f1' },
      { id: 'w2', word: 'other', meaning: 'khác', folderId: null },
    ],
    folders: [{ id: 'f1', name: 'Du lịch' }],
  });
  ctx.deleteFolder('f1');
  assert.equal(ctx.folders.length, 0);
  assert.equal(ctx.words.length, 1);
  assert.equal(ctx.words[0].word, 'other'); // từ ngoài thư mục không bị đụng tới
  assert.equal(ctx.trash.length, 1);
  assert.equal(ctx.trash[0].type, 'folder');
  assert.equal(ctx.trash[0].folder.id, 'f1');
  assert.equal(ctx.trash[0].words.length, 1);
  assert.equal(ctx.trash[0].words[0].word, 'passport');
});

test('deleteFolder on an empty folder still moves it to trash with an empty words snapshot', () => {
  resetState({ folders: [{ id: 'f1', name: 'Trống' }] });
  ctx.deleteFolder('f1');
  assert.equal(ctx.folders.length, 0);
  assert.equal(ctx.trash.length, 1);
  assert.deepEqual(ctx.trash[0].words, []);
});

test('deleteFolder does nothing for an id that does not exist', () => {
  resetState({ folders: [{ id: 'f1', name: 'A' }] });
  ctx.deleteFolder('does-not-exist');
  assert.equal(ctx.folders.length, 1);
  assert.equal(ctx.trash.length, 0);
});

test('deleteFolder rolls back words/folders/trash if saving fails', () => {
  resetState({
    words: [{ id: 'w1', word: 'passport', meaning: 'hộ chiếu', folderId: 'f1' }],
    folders: [{ id: 'f1', name: 'Du lịch' }],
  });
  ctx.saveTrash = () => false;
  ctx.deleteFolder('f1');
  assert.equal(ctx.folders.length, 1);
  assert.equal(ctx.words.length, 1);
  assert.equal(ctx.trash.length, 0);
});

// Lưu ý: không test riêng "deleteFolder tự reset wlActiveFolder về null khi đang
// xem đúng thư mục vừa xóa" — wlActiveFolder khai báo bằng `let` ngay trong
// folders.js nên là 1 lexical binding thật trong vm context, không phải property
// của sandbox; gán/đọc ctx.wlActiveFolder từ NGOÀI vm không phản ánh đúng giá trị
// nội bộ (khác với words/folders/trash, vốn không được khai báo `let` trong bất kỳ
// file nào ở đây nên resolve qua property lookup bình thường). Hành vi này là UI-
// navigation phụ, không phải tính toàn vẹn dữ liệu — 4 test trên đã phủ phần cốt lõi.
