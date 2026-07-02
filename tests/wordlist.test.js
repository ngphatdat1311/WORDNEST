'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

const ctx = loadScripts(['wordlist.js']);

test('wlComparator always pushes suspended ("đã thuộc hẳn") words to the end, regardless of sort mode', () => {
  const cmp = ctx.wlComparator('az');
  const suspended = { word: 'aardvark', suspended: true };
  const notSuspended = { word: 'zebra', suspended: false };
  // 'aardvark' would sort before 'zebra' alphabetically, but suspended must still lose.
  assert.ok(cmp(suspended, notSuspended) > 0);
  assert.ok(cmp(notSuspended, suspended) < 0);
});

test('wlComparator "az"/"za" sort by word alphabetically', () => {
  const words = [{ word: 'banana' }, { word: 'apple' }, { word: 'cherry' }];
  assert.deepEqual([...words].sort(ctx.wlComparator('az')).map(w => w.word), ['apple', 'banana', 'cherry']);
  assert.deepEqual([...words].sort(ctx.wlComparator('za')).map(w => w.word), ['cherry', 'banana', 'apple']);
});

test('wlComparator "mastery_desc"/"mastery_asc" sort by mastery level', () => {
  const words = [{ word: 'a', mastery: 1 }, { word: 'b', mastery: 3 }, { word: 'c', mastery: 0 }];
  assert.deepEqual([...words].sort(ctx.wlComparator('mastery_desc')).map(w => w.word), ['b', 'a', 'c']);
  assert.deepEqual([...words].sort(ctx.wlComparator('mastery_asc')).map(w => w.word), ['c', 'a', 'b']);
});

test('wlComparator "seen_desc" sorts by most-seen first, treating missing seen as 0', () => {
  const words = [{ word: 'a', seen: 2 }, { word: 'b' }, { word: 'c', seen: 9 }];
  assert.deepEqual([...words].sort(ctx.wlComparator('seen_desc')).map(w => w.word), ['c', 'a', 'b']);
});

test('wlComparator "added_desc"/"added_asc" sort by addedAt timestamp', () => {
  const words = [{ word: 'a', addedAt: 200 }, { word: 'b', addedAt: 100 }, { word: 'c', addedAt: 300 }];
  assert.deepEqual([...words].sort(ctx.wlComparator('added_desc')).map(w => w.word), ['c', 'a', 'b']);
  assert.deepEqual([...words].sort(ctx.wlComparator('added_asc')).map(w => w.word), ['b', 'a', 'c']);
});

test('wlComparator falls back to stable/no-op ordering for an unknown sort value', () => {
  const cmp = ctx.wlComparator('not-a-real-sort');
  assert.equal(cmp({ word: 'a' }, { word: 'b' }), 0);
});
