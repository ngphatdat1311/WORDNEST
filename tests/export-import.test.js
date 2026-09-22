'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// ankiRowFor() calls escHtml() from utils.js; partitionImportWords() đọc `words` toàn cục.
const ctx = loadScripts(['utils.js', 'export-import.js']);

function resetWords(words = []) { ctx.words = words; }

// ════════════════════════════════════════════════════════
// csvCell — quy tắc CSV chuẩn RFC 4180
// ════════════════════════════════════════════════════════
test('csvCell leaves a plain value unquoted', () => {
  assert.equal(ctx.csvCell('hello'), 'hello');
});

test('csvCell wraps a value containing a comma in quotes', () => {
  assert.equal(ctx.csvCell('a,b'), '"a,b"');
});

test('csvCell wraps and doubles internal quotes for a value containing a quote', () => {
  assert.equal(ctx.csvCell('say "hi"'), '"say ""hi"""');
});

test('csvCell wraps a value containing a newline in quotes', () => {
  assert.equal(ctx.csvCell('line1\nline2'), '"line1\nline2"');
});

test('csvCell treats null/undefined as an empty string, not the literal text "null"/"undefined"', () => {
  assert.equal(ctx.csvCell(null), '');
  assert.equal(ctx.csvCell(undefined), '');
});

test('csvCell keeps 0 as "0" (nullish coalescing must not treat falsy 0 as missing)', () => {
  assert.equal(ctx.csvCell(0), '0');
});

// ════════════════════════════════════════════════════════
// ankiRowFor — định dạng Anki .txt (tab-separated, HTML front/back)
// ════════════════════════════════════════════════════════
test('ankiRowFor builds front/back/blank/blank/tags joined by tabs', () => {
  const row = ctx.ankiRowFor({ word: 'apple', phonetic: '/ˈæpl/', meaning: 'quả táo', example: 'I eat an apple.', category: 'Thiên nhiên' });
  const parts = row.split('\t');
  assert.equal(parts.length, 5);
  assert.equal(parts[0], 'apple<br><small style="color:#888">/ˈæpl/</small>');
  assert.equal(parts[1], '<b>quả táo</b><br><i>I eat an apple.</i>');
  assert.equal(parts[2], '');
  assert.equal(parts[3], '');
  assert.equal(parts[4], 'Thiên_nhiên');
});

test('ankiRowFor omits the phonetic <br><small> block entirely when phonetic is missing', () => {
  const row = ctx.ankiRowFor({ word: 'apple', meaning: 'quả táo' });
  assert.equal(row.split('\t')[0], 'apple');
});

test('ankiRowFor omits the example <br><i> block entirely when example is missing', () => {
  const row = ctx.ankiRowFor({ word: 'apple', meaning: 'quả táo' });
  assert.equal(row.split('\t')[1], '<b>quả táo</b>');
});

test('ankiRowFor collapses all whitespace runs in the category into single underscores for the tags column', () => {
  const row = ctx.ankiRowFor({ word: 'x', meaning: 'y', category: 'IELTS   Writing Task' });
  assert.equal(row.split('\t')[4], 'IELTS_Writing_Task');
});

test('ankiRowFor uses an empty tags column when category is missing', () => {
  const row = ctx.ankiRowFor({ word: 'x', meaning: 'y' });
  assert.equal(row.split('\t')[4], '');
});

test('ankiRowFor escapes HTML-special characters in word/meaning/example', () => {
  const row = ctx.ankiRowFor({ word: '<script>', meaning: 'a & b', example: '5 < 10' });
  assert.doesNotMatch(row, /<script>/);
  assert.match(row, /&lt;script&gt;/);
  assert.match(row, /a &amp; b/);
});

// ════════════════════════════════════════════════════════
// partitionImportWords — dedup khi nhập JSON (xem lịch sử: trước đây chỉ so
// với kho hiện có nên lọt cả từ trùng NGAY TRONG chính file import)
// ════════════════════════════════════════════════════════
test('partitionImportWords puts every word in toAdd when words[] is empty', () => {
  resetWords([]);
  const { toAdd, skipped } = ctx.partitionImportWords([{ word: 'apple' }, { word: 'banana' }]);
  assert.equal(toAdd.length, 2);
  assert.equal(skipped, 0);
});

test('partitionImportWords skips (and counts) a word that already exists in words[], case-insensitively', () => {
  resetWords([{ word: 'Apple' }]);
  const { toAdd, skipped } = ctx.partitionImportWords([{ word: 'apple' }, { word: 'banana' }]);
  // [...toAdd] trước khi .map() — toAdd đến từ bên trong vm sandbox (context/realm
  // khác), mảng nó tạo ra mang Array constructor của sandbox đó; so trực tiếp với
  // mảng literal viết ở đây (Array của Node thường) khiến assert.deepEqual (alias
  // deepStrictEqual do dùng node:assert/strict) báo "same structure but are not
  // reference-equal" dù nội dung giống hệt. Spread ra mảng MỚI ở đúng realm hiện
  // tại (Node thường) trước rồi mới .map()/so sánh — cùng cách classifyBulkLines
  // test ở word-crud.test.js dùng { ...r } cho object.
  assert.deepEqual([...toAdd].map(w => w.word), ['banana']);
  assert.equal(skipped, 1);
});

test('partitionImportWords treats a 2nd occurrence of the same word WITHIN the imported file as a duplicate too', () => {
  resetWords([]); // kho hiện có trống — chỉ trùng trong chính file import
  const { toAdd, skipped } = ctx.partitionImportWords([{ word: 'apple' }, { word: 'Apple' }, { word: 'banana' }]);
  assert.deepEqual([...toAdd].map(w => w.word), ['apple', 'banana']); // chỉ occurrence đầu tiên được thêm
  assert.equal(skipped, 1);
});

test('partitionImportWords returns an empty toAdd for an empty import list', () => {
  resetWords([{ word: 'apple' }]);
  const { toAdd, skipped } = ctx.partitionImportWords([]);
  assert.deepEqual([...toAdd], []); // spread ra mảng ở đúng realm hiện tại trước khi so sánh — xem giải thích ở trên
  assert.equal(skipped, 0);
});
