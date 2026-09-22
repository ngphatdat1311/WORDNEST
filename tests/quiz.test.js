'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

const ctx = loadScripts(['quiz.js']);

test('quizScoreTier returns tier 0 ("cần cố gắng thêm") below 50%', () => {
  assert.equal(ctx.quizScoreTier(0), 0);
  assert.equal(ctx.quizScoreTier(49), 0);
});

test('quizScoreTier returns tier 1 ("khá tốt") from 50% up to (not including) 70%', () => {
  assert.equal(ctx.quizScoreTier(50), 1);
  assert.equal(ctx.quizScoreTier(69), 1);
});

test('quizScoreTier returns tier 2 ("tuyệt vời", confetti threshold) from 70% up to (not including) 90%', () => {
  assert.equal(ctx.quizScoreTier(70), 2);
  assert.equal(ctx.quizScoreTier(89), 2);
});

test('quizScoreTier returns tier 3 ("xuất sắc") from 90% up to 100%', () => {
  assert.equal(ctx.quizScoreTier(90), 3);
  assert.equal(ctx.quizScoreTier(100), 3);
});
