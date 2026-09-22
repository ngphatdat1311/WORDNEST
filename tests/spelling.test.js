'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// buildBlanksHtml() calls escHtml() from utils.js
const ctx = loadScripts(['utils.js', 'spelling.js']);

test('buildBlanksHtml renders one blank per character, untyped chars have no fill/wrong class', () => {
  const html = ctx.buildBlanksHtml('cat', '');
  const matches = [...html.matchAll(/<div class="spell-blank ?([a-z]*)">([^<]*)<\/div>/g)];
  assert.equal(matches.length, 3);
  matches.forEach(m => { assert.equal(m[1], ''); assert.equal(m[2], ''); });
});

test('buildBlanksHtml marks correctly-typed characters as "filled"', () => {
  const html = ctx.buildBlanksHtml('cat', 'cat');
  assert.equal((html.match(/class="spell-blank filled"/g) || []).length, 3);
  assert.equal((html.match(/class="spell-blank wrong"/g) || []).length, 0);
});

test('buildBlanksHtml marks incorrectly-typed characters as "wrong"', () => {
  const html = ctx.buildBlanksHtml('cat', 'cop');
  assert.equal((html.match(/class="spell-blank filled"/g) || []).length, 1); // chỉ 'c' đúng
  assert.equal((html.match(/class="spell-blank wrong"/g) || []).length, 2); // 'o' và 'p' sai
});

test('buildBlanksHtml comparison is case-insensitive', () => {
  const html = ctx.buildBlanksHtml('Cat', 'cAT');
  assert.equal((html.match(/class="spell-blank filled"/g) || []).length, 3);
});

test('buildBlanksHtml renders a visual gap (not a letter blank) for spaces in phrases', () => {
  const html = ctx.buildBlanksHtml('give up', 'give up');
  assert.equal((html.match(/class="spell-gap"/g) || []).length, 1);
  // 6 ký tự chữ cái (g,i,v,e,u,p), không tính khoảng trắng
  assert.equal((html.match(/class="spell-blank/g) || []).length, 6);
});

test('buildBlanksHtml only fills up to the length actually typed, rest stay empty', () => {
  const html = ctx.buildBlanksHtml('cat', 'c');
  assert.equal((html.match(/class="spell-blank filled"/g) || []).length, 1);
  assert.equal((html.match(/class="spell-blank ">/g) || []).length, 2); // 'a' và 't' chưa gõ tới
});

test('buildBlanksHtml escapes HTML-special characters in the typed input', () => {
  const html = ctx.buildBlanksHtml('a<b', 'a<b');
  assert.match(html, /&lt;/);
  assert.doesNotMatch(html, /<b>/); // không được để lọt thẻ <b> thật vào DOM
});
