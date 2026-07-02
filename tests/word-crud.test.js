'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// parseBulkLine() calls clampStr() from utils.js.
const ctx = loadScripts(['utils.js', 'word-crud.js']);

test('parseBulkLine reads the new 4-part format "word | phonetic | meaning | example"', () => {
  const r = ctx.parseBulkLine('apple | /ˈæp.əl/ | quả táo | I eat an apple every day.');
  assert.deepEqual({ ...r }, { word: 'apple', phonetic: '/ˈæp.əl/', meaning: 'quả táo', example: 'I eat an apple every day.' });
});

test('parseBulkLine falls back to the old 3-part format "word | meaning | example" (no phonetic)', () => {
  const r = ctx.parseBulkLine('run | | chạy');
  assert.deepEqual({ ...r }, { word: 'run', phonetic: '', meaning: '', example: 'chạy' });
});

test('parseBulkLine treats a bare "word | meaning" line as old format with an empty example', () => {
  const r = ctx.parseBulkLine('book | quyển sách');
  assert.deepEqual({ ...r }, { word: 'book', phonetic: '', meaning: 'quyển sách', example: '' });
});

test('parseBulkLine trims whitespace around each field', () => {
  const r = ctx.parseBulkLine('  give up  |  /ɡɪv ʌp/  |  từ bỏ  |  Don\'t give up.  ');
  assert.deepEqual({ ...r }, { word: 'give up', phonetic: '/ɡɪv ʌp/', meaning: 'từ bỏ', example: "Don't give up." });
});

test('parseBulkLine clamps each field to the same max lengths enforced on the manual Add Word form', () => {
  const r = ctx.parseBulkLine(`${'w'.repeat(80)} | ${'p'.repeat(100)} | ${'m'.repeat(250)} | ${'e'.repeat(350)}`);
  assert.equal(r.word.length, 60);
  assert.equal(r.phonetic.length, 80);
  assert.equal(r.meaning.length, 200);
  assert.equal(r.example.length, 300);
});
