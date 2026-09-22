'use strict';
// electron/pure.js chỉ dùng 'fs'/'path' (module Node lõi) — không đụng module
// 'electron' — nên require() thẳng được trong Node thường, không cần vm sandbox
// như các file js/*.js viết cho trình duyệt (xem tests/helpers/sandbox.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isValidStoreKey, isValidSyncFolder, atomicWriteFileSync, arpabetToIpa } = require('../electron/pure');

// ════════════════════════════════════════════════════════
// isValidStoreKey — biên bảo vệ path traversal cho IPC store-read/store-write
// ════════════════════════════════════════════════════════
test('isValidStoreKey accepts letters/digits/underscore up to 64 chars', () => {
  assert.equal(isValidStoreKey('wordnest_data'), true);
  assert.equal(isValidStoreKey('QUIZ_STATS_KEY_123'), true);
  assert.equal(isValidStoreKey('a'), true);
  assert.equal(isValidStoreKey('a'.repeat(64)), true);
});

test('isValidStoreKey rejects empty string and strings over 64 chars', () => {
  assert.equal(isValidStoreKey(''), false);
  assert.equal(isValidStoreKey('a'.repeat(65)), false);
});

test('isValidStoreKey rejects path-traversal / path-separator characters', () => {
  assert.equal(isValidStoreKey('../secret'), false);
  assert.equal(isValidStoreKey('a/b'), false);
  assert.equal(isValidStoreKey('a\\b'), false);
  assert.equal(isValidStoreKey('a.json'), false);
  assert.equal(isValidStoreKey('a b'), false); // khoảng trắng cũng không hợp lệ
});

test('isValidStoreKey rejects non-string inputs without throwing', () => {
  assert.equal(isValidStoreKey(null), false);
  assert.equal(isValidStoreKey(undefined), false);
  assert.equal(isValidStoreKey(123), false);
  assert.equal(isValidStoreKey(['a']), false);
  assert.equal(isValidStoreKey({}), false);
});

// ════════════════════════════════════════════════════════
// isValidSyncFolder — chỉ chấp nhận đường dẫn tuyệt đối, thực sự là thư mục
// ════════════════════════════════════════════════════════
test('isValidSyncFolder accepts a real, existing, absolute directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-sync-'));
  try {
    assert.equal(isValidSyncFolder(dir), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('isValidSyncFolder rejects a relative path even if it happens to exist', () => {
  assert.equal(isValidSyncFolder('.'), false);
  assert.equal(isValidSyncFolder('some/relative/dir'), false);
});

test('isValidSyncFolder rejects a path that does not exist on disk', () => {
  const nonExistent = path.join(os.tmpdir(), 'wordnest-does-not-exist-' + Date.now());
  assert.equal(isValidSyncFolder(nonExistent), false);
});

test('isValidSyncFolder rejects a path that points to a file, not a directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-sync-'));
  const filePath = path.join(dir, 'not-a-folder.txt');
  fs.writeFileSync(filePath, 'hi', 'utf8');
  try {
    assert.equal(isValidSyncFolder(filePath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('isValidSyncFolder rejects empty string / non-string input without throwing', () => {
  assert.equal(isValidSyncFolder(''), false);
  assert.equal(isValidSyncFolder(null), false);
  assert.equal(isValidSyncFolder(undefined), false);
  assert.equal(isValidSyncFolder(42), false);
});

// ════════════════════════════════════════════════════════
// atomicWriteFileSync — ghi qua file tạm + rename, không được để lộ trạng thái
// ghi dở, và không được để rác file .tmp lại sau khi thành công.
// ════════════════════════════════════════════════════════
test('atomicWriteFileSync creates a new file with the exact content given', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-write-'));
  try {
    const target = path.join(dir, 'store_wordnest_data.json');
    atomicWriteFileSync(target, '{"words":[]}');
    assert.equal(fs.readFileSync(target, 'utf8'), '{"words":[]}');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('atomicWriteFileSync fully replaces existing (longer) content, no leftover bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-write-'));
  try {
    const target = path.join(dir, 'data.json');
    fs.writeFileSync(target, '{"words":[1,2,3,4,5,6,7,8,9,10]}', 'utf8'); // nội dung cũ DÀI hơn nội dung mới
    atomicWriteFileSync(target, '{}');
    assert.equal(fs.readFileSync(target, 'utf8'), '{}'); // không còn sót ký tự nào của bản cũ
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('atomicWriteFileSync leaves no stray .tmp files behind after a successful write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-write-'));
  try {
    const target = path.join(dir, 'data.json');
    atomicWriteFileSync(target, 'hello');
    const entries = fs.readdirSync(dir);
    assert.deepEqual(entries, ['data.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('atomicWriteFileSync throws (and does not silently succeed) when the target directory does not exist', () => {
  const missingDir = path.join(os.tmpdir(), 'wordnest-missing-dir-' + Date.now());
  assert.throws(() => atomicWriteFileSync(path.join(missingDir, 'data.json'), 'x'));
});

test('atomicWriteFileSync round-trips a large JSON payload unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordnest-write-'));
  try {
    const target = path.join(dir, 'data.json');
    const payload = JSON.stringify({ words: Array.from({ length: 500 }, (_, i) => ({ id: 'w_' + i, word: 'word' + i })) });
    atomicWriteFileSync(target, payload);
    assert.equal(fs.readFileSync(target, 'utf8'), payload);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ════════════════════════════════════════════════════════
// arpabetToIpa — quy đổi ARPAbet (Datamuse) sang IPA cho phiên âm dự phòng
// ════════════════════════════════════════════════════════
test('arpabetToIpa converts a simple one-syllable word (CMU: "cup" -> K AH1 P)', () => {
  assert.equal(arpabetToIpa('K AH1 P'), 'kˈʌp');
});

test('arpabetToIpa converts a two-syllable word with secondary+primary stress (CMU: "hello" -> HH AH0 L OW1)', () => {
  assert.equal(arpabetToIpa('HH AH0 L OW1'), 'həlˈoʊ');
});

test('arpabetToIpa uses schwa (ə) for unstressed AH, but ʌ for stressed AH', () => {
  assert.match(arpabetToIpa('AH0'), /^ə$/);
  assert.match(arpabetToIpa('AH1'), /^ˈʌ$/);
  assert.match(arpabetToIpa('AH2'), /^ˌʌ$/);
});

test('arpabetToIpa marks primary stress with ˈ and secondary stress with ˌ', () => {
  assert.equal(arpabetToIpa('K1'), 'ˈk');
  assert.equal(arpabetToIpa('T2'), 'ˌt');
  assert.equal(arpabetToIpa('K1 T2'), 'ˈkˌt');
});

test('arpabetToIpa silently skips phones it does not recognize instead of throwing', () => {
  // "XX" không có trong bảng ARPABET_TO_IPA -> bị bỏ qua, không throw, không chèn ký tự lạ
  assert.equal(arpabetToIpa('XX1 K'), 'k');
});

test('arpabetToIpa silently skips malformed (lowercase) tokens', () => {
  assert.equal(arpabetToIpa('abc K'), 'k');
});

test('arpabetToIpa returns an empty string for empty/whitespace-only input', () => {
  assert.equal(arpabetToIpa(''), '');
  assert.equal(arpabetToIpa('   '), '');
});
