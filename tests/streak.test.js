'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// storage.js được nạp cùng vì streak.js dùng storeGet/storeSet/STREAK_KEY của nó.
const FILES = ['utils.js', 'storage.js', 'streak.js'];

test('srsInit sets sane SM-2 defaults on a fresh word', () => {
  const ctx = loadScripts(FILES);
  const w = ctx.srsInit({});
  assert.equal(w.srsInterval, 1);
  assert.equal(w.srsEF, 2.5);
  assert.equal(w.srsDue, ctx.localDateKey());
});

test('srsInit does not overwrite existing SRS fields', () => {
  const ctx = loadScripts(FILES);
  const w = ctx.srsInit({ srsInterval: 6, srsEF: 2.1, srsDue: '2020-01-01' });
  assert.equal(w.srsInterval, 6);
  assert.equal(w.srsEF, 2.1);
  assert.equal(w.srsDue, '2020-01-01');
});

test('srsUpdate on a correct answer grows the interval and raises ease factor', () => {
  const ctx = loadScripts(FILES);
  const w = ctx.srsUpdate({ srsInterval: 4, srsEF: 2.2 }, true);
  assert.ok(Math.abs(w.srsEF - 2.3) < 1e-9); // floating-point addition, avoid exact equality
  assert.equal(w.srsInterval, Math.round(4 * w.srsEF));
});

test('srsUpdate caps ease factor at 2.5 no matter how many correct answers in a row', () => {
  const ctx = loadScripts(FILES);
  let w = { srsInterval: 1, srsEF: 2.5 };
  for (let i = 0; i < 5; i++) w = ctx.srsUpdate(w, true);
  assert.equal(w.srsEF, 2.5);
});

test('srsUpdate on a wrong answer resets interval to 1 and floors ease factor at 1.3', () => {
  const ctx = loadScripts(FILES);
  const w = ctx.srsUpdate({ srsInterval: 20, srsEF: 1.35 }, false);
  assert.equal(w.srsInterval, 1);
  assert.equal(w.srsEF, 1.3);
});

test('srsUpdate sets srsDue to today + new interval days, in local time', () => {
  const ctx = loadScripts(FILES);
  const w = ctx.srsUpdate({ srsInterval: 2, srsEF: 2.0 }, true);
  const expectedDue = new Date();
  expectedDue.setDate(expectedDue.getDate() + w.srsInterval);
  assert.equal(w.srsDue, ctx.localDateKey(expectedDue));
});

test('recordLearningActivity increments the streak when last learned yesterday', () => {
  const ctx = loadScripts(FILES);
  const today = ctx.localDateKey();
  const yesterday = ctx.localDateKey(new Date(Date.now() - 86400000));
  ctx.localStorage.setItem('wordnest_streak', JSON.stringify({ count: 4, last: yesterday, history: [] }));
  const result = ctx.recordLearningActivity();
  assert.equal(result.count, 5);
  assert.equal(result.last, today);
});

test('recordLearningActivity resets the streak to 1 after a gap of more than a day', () => {
  const ctx = loadScripts(FILES);
  const twoDaysAgo = ctx.localDateKey(new Date(Date.now() - 2 * 86400000));
  ctx.localStorage.setItem('wordnest_streak', JSON.stringify({ count: 10, last: twoDaysAgo, history: [] }));
  const result = ctx.recordLearningActivity();
  assert.equal(result.count, 1);
});

test('recordLearningActivity is idempotent when called again the same day', () => {
  const ctx = loadScripts(FILES);
  const today = ctx.localDateKey();
  ctx.localStorage.setItem('wordnest_streak', JSON.stringify({ count: 3, last: today, history: [] }));
  const result = ctx.recordLearningActivity();
  assert.equal(result.count, 3);
});
