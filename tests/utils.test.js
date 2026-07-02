'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

const ctx = loadScripts(['utils.js']);

test('escHtml escapes all 5 XSS-relevant characters', () => {
  assert.equal(
    ctx.escHtml(`<script>alert("x")&'y'</script>`),
    '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;y&#39;&lt;/script&gt;'
  );
});

test('escHtml handles null/undefined/number safely', () => {
  assert.equal(ctx.escHtml(null), '');
  assert.equal(ctx.escHtml(undefined), '');
  assert.equal(ctx.escHtml(42), '42');
});

test('clampStr truncates to max length, keeps shorter strings intact', () => {
  assert.equal(ctx.clampStr('hello world', 5), 'hello');
  assert.equal(ctx.clampStr('hi', 5), 'hi');
  assert.equal(ctx.clampStr(null, 5), '');
});

test('localDateKey formats using local time fields, not UTC', () => {
  assert.equal(ctx.localDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(ctx.localDateKey(new Date(2026, 2, 3)), '2026-03-03'); // pads single-digit month/day
});

test('shuffleArr returns a new array with the same elements, without mutating the original', () => {
  const original = [1, 2, 3, 4, 5];
  const copy = [...original];
  const shuffled = ctx.shuffleArr(original);
  assert.notEqual(shuffled, original);
  assert.deepEqual(original, copy);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
});

test('formatAddedAt returns empty string for falsy/invalid input', () => {
  assert.equal(ctx.formatAddedAt(0), '');
  assert.equal(ctx.formatAddedAt(null), '');
  assert.equal(ctx.formatAddedAt(NaN), '');
});

test('formatAddedAt formats a known timestamp as dd/mm/yyyy hh:mm (local time)', () => {
  const ts = new Date(2026, 5, 28, 14, 32).getTime();
  assert.equal(ctx.formatAddedAt(ts), '28/06/2026 14:32');
});

test('typeLabel maps known word types to Vietnamese, falls back to the raw value', () => {
  assert.equal(ctx.typeLabel('noun'), 'danh từ');
  assert.equal(ctx.typeLabel('verb'), 'động từ');
  assert.equal(ctx.typeLabel('unknown'), 'unknown');
  assert.equal(ctx.typeLabel(''), '');
});
