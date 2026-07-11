'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// parseBulkLine() calls clampStr() from utils.js.
const ctx = loadScripts(['utils.js', 'word-crud.js']);

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
