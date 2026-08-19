'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// parseBulkLine() calls clampStr() from utils.js; classifyBulkLines() also
// calls wordFolders() from folders.js (và đọc `words`/`folders` toàn cục —
// KHÔNG khai báo let/const trong 2 file này nên gán trực tiếp từ ngoài qua
// resetState() bên dưới hoạt động đúng, xem cùng gotcha trong folders.test.js).
const ctx = loadScripts(['utils.js', 'folders.js', 'word-crud.js']);

function resetState({ words = [], folders = [] } = {}) {
  ctx.words = words;
  ctx.folders = folders;
}

test('parseBulkLine reads the 4-part format "word | phonetic | meaning | example" (no type -> auto-detected)', () => {
  const r = ctx.parseBulkLine('apple | /ˈæp.əl/ | quả táo | I eat an apple every day.');
  assert.deepEqual({ ...r }, { word: 'apple', phonetic: '/ˈæp.əl/', meaning: 'quả táo', example: 'I eat an apple every day.', type: 'other' });
});

test('parseBulkLine reads the 5-part format with an explicit type field', () => {
  const r = ctx.parseBulkLine('apple | /ˈæp.əl/ | quả táo | I eat an apple every day. | danh từ');
  assert.deepEqual({ ...r }, { word: 'apple', phonetic: '/ˈæp.əl/', meaning: 'quả táo', example: 'I eat an apple every day.', type: 'noun' });
});

test('parseBulkLine type field accepts English codes as well as Vietnamese labels', () => {
  assert.equal(ctx.parseBulkLine('run | | chạy nhanh | | verb').type, 'verb');
  assert.equal(ctx.parseBulkLine('happy | | vui | | adj').type, 'adj');
  assert.equal(ctx.parseBulkLine('slowly | | chậm rãi | | trạng từ').type, 'adv');
});

test('parseBulkLine type field accepts bare single-letter abbreviations n/v/adj/adv', () => {
  assert.equal(ctx.parseBulkLine('cat | | con mèo | | n').type, 'noun');
  assert.equal(ctx.parseBulkLine('run | | chạy | | v').type, 'verb');
  assert.equal(ctx.parseBulkLine('happy | | vui | | adj').type, 'adj');
  assert.equal(ctx.parseBulkLine('slowly | | chậm rãi | | adv').type, 'adv');
});

test('parseBulkLine type field accepts abbreviations wrapped in parentheses or with a trailing dot', () => {
  assert.equal(ctx.parseBulkLine('cat | | con mèo | | (n)').type, 'noun');
  assert.equal(ctx.parseBulkLine('run | | chạy | | (v)').type, 'verb');
  assert.equal(ctx.parseBulkLine('happy | | vui | | (adj)').type, 'adj');
  assert.equal(ctx.parseBulkLine('slowly | | chậm rãi | | (adv)').type, 'adv');
  assert.equal(ctx.parseBulkLine('cat | | con mèo | | n.').type, 'noun');
  assert.equal(ctx.parseBulkLine('run | | chạy | | [v]').type, 'verb');
});

test('parseBulkLine falls back to auto-detected type when the type field is empty or unrecognized', () => {
  assert.equal(ctx.parseBulkLine('apple | | quả táo | | ').type, 'other'); // empty type field
  assert.equal(ctx.parseBulkLine('give up | | từ bỏ | | ???').type, 'phrase'); // garbage type -> auto-detect (has space -> phrase)
});

test('parseBulkLine falls back to the old 3-part format "word | meaning | example" (no phonetic, no type)', () => {
  const r = ctx.parseBulkLine('run | | chạy');
  assert.deepEqual({ ...r }, { word: 'run', phonetic: '', meaning: '', example: 'chạy', type: 'other' });
});

test('parseBulkLine treats a bare "word | meaning" line as old format with an empty example', () => {
  const r = ctx.parseBulkLine('book | quyển sách');
  assert.deepEqual({ ...r }, { word: 'book', phonetic: '', meaning: 'quyển sách', example: '', type: 'other' });
});

test('parseBulkLine trims whitespace around each field, including the type field', () => {
  const r = ctx.parseBulkLine('  give up  |  /ɡɪv ʌp/  |  từ bỏ  |  Don\'t give up.  |  Cụm Từ  ');
  assert.deepEqual({ ...r }, { word: 'give up', phonetic: '/ɡɪv ʌp/', meaning: 'từ bỏ', example: "Don't give up.", type: 'phrase' });
});

test('parseBulkLine auto-detects "phrase" for multi-word entries and "other" for single words when type is omitted', () => {
  assert.equal(ctx.parseBulkLine('be fond of | | thích').type, 'phrase');
  assert.equal(ctx.parseBulkLine('genuine | | thật sự').type, 'other');
});

test('parseBulkLine clamps each field to the same max lengths enforced on the manual Add Word form', () => {
  const r = ctx.parseBulkLine(`${'w'.repeat(80)} | ${'p'.repeat(100)} | ${'m'.repeat(250)} | ${'e'.repeat(350)}`);
  assert.equal(r.word.length, 60);
  assert.equal(r.phonetic.length, 80);
  assert.equal(r.meaning.length, 200);
  assert.equal(r.example.length, 300);
});

// ── classifyBulkLines — phân loại dòng nhập trong Thêm hàng loạt thành từ MỚI
// và từ TRÙNG, dùng cho confirmBulkDuplicates() (dialog cảnh báo trùng). ──
test('classifyBulkLines puts every line in newItems when none of them already exist', () => {
  resetState();
  const { newItems, dupItems } = ctx.classifyBulkLines(['apple | quả táo', 'banana | quả chuối'], null);
  assert.equal(newItems.length, 2);
  assert.equal(dupItems.length, 0);
  assert.equal(newItems[0].word, 'apple');
  assert.equal(newItems[1].word, 'banana');
});

test('classifyBulkLines treats a word already in words[] (case-insensitive) as a duplicate, with its existing folder names', () => {
  resetState({
    words: [{ id: 'w1', word: 'Apple', folderIds: ['f1', 'f2'] }],
    folders: [{ id: 'f1', name: 'Trái cây' }, { id: 'f2', name: 'Yêu thích' }],
  });
  const { newItems, dupItems } = ctx.classifyBulkLines(['apple | quả táo'], null);
  assert.equal(newItems.length, 0);
  assert.equal(dupItems.length, 1);
  assert.equal(dupItems[0].word, 'apple');
  assert.deepEqual([...dupItems[0].folderNames], ['Trái cây', 'Yêu thích']);
  assert.equal(dupItems[0].inBatch, false);
});

test('classifyBulkLines marks alreadyHasFolder true only when the selected folderId is already on the existing word', () => {
  resetState({
    words: [{ id: 'w1', word: 'apple', folderIds: ['f1'] }],
    folders: [{ id: 'f1', name: 'Trái cây' }, { id: 'f2', name: 'Yêu thích' }],
  });
  assert.equal(ctx.classifyBulkLines(['apple | quả táo'], 'f1').dupItems[0].alreadyHasFolder, true);
  assert.equal(ctx.classifyBulkLines(['apple | quả táo'], 'f2').dupItems[0].alreadyHasFolder, false);
  assert.equal(ctx.classifyBulkLines(['apple | quả táo'], null).dupItems[0].alreadyHasFolder, false);
});

test('classifyBulkLines treats a 2nd occurrence of the same word within the pasted list as an in-batch duplicate (first occurrence still counts as new)', () => {
  resetState();
  const { newItems, dupItems } = ctx.classifyBulkLines(['apple | quả táo', 'Apple | quả táo 2'], null);
  assert.equal(newItems.length, 1);
  assert.equal(newItems[0].word, 'apple');
  assert.equal(dupItems.length, 1);
  assert.equal(dupItems[0].word, 'Apple');
  assert.equal(dupItems[0].inBatch, true);
  assert.deepEqual([...dupItems[0].folderNames], []);
});

test('classifyBulkLines skips lines missing a word or meaning entirely (not counted in either list)', () => {
  resetState();
  const { newItems, dupItems } = ctx.classifyBulkLines(['  | không có từ', 'onlyword'], null);
  assert.equal(newItems.length, 0);
  assert.equal(dupItems.length, 0);
});
