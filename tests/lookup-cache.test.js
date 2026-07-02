'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, createMemoryStore } = require('./helpers/sandbox');

test('getCachedLookup/setCachedLookup round-trip a full result, case-insensitively', () => {
  const store = createMemoryStore();
  const c = loadScripts(['lookup-cache.js'], store);
  const result = { phonetic: '/tɛst/', exampleEn: 'This is a test.', meaningVI: 'bài kiểm tra' };
  c.setCachedLookup('Test', result);
  // Shallow-spread to a plain object of this realm — values built inside the vm
  // sandbox belong to a different realm, so deepEqual would otherwise compare prototypes across realms.
  assert.deepEqual({ ...c.getCachedLookup('test') }, result);
});

test('setCachedLookup skips caching a result missing both phonetic and example', () => {
  const store = createMemoryStore();
  const c = loadScripts(['lookup-cache.js'], store);
  c.setCachedLookup('word', { meaningVI: 'nghĩa' });
  assert.equal(c.getCachedLookup('word'), null);
});

test('getCachedLookup returns null once a full entry passes the 30-day TTL', () => {
  const store = createMemoryStore();
  const c = loadScripts(['lookup-cache.js'], store);
  const cache = { word: { ts: Date.now() - 31 * 24 * 60 * 60 * 1000, result: { phonetic: '/w/', exampleEn: 'e' } } };
  store.storeSet('wordnest_lookup_cache', JSON.stringify(cache));
  assert.equal(c.getCachedLookup('word'), null);
});

test('getCachedLookup expires partial entries (missing phonetic or example) after just 1 day', () => {
  const store = createMemoryStore();
  const c = loadScripts(['lookup-cache.js'], store);
  const cache = { word: { ts: Date.now() - 2 * 24 * 60 * 60 * 1000, partialTtl: true, result: { exampleEn: 'e' } } };
  store.storeSet('wordnest_lookup_cache', JSON.stringify(cache));
  assert.equal(c.getCachedLookup('word'), null);
});

test('setCachedLookup evicts the oldest entry once the cache exceeds 300 words', () => {
  const store = createMemoryStore();
  const c = loadScripts(['lookup-cache.js'], store);
  const cache = {};
  for (let i = 0; i < 300; i++) cache['w' + i] = { ts: i, result: { phonetic: '/x/' } }; // w0 = oldest
  store.storeSet('wordnest_lookup_cache', JSON.stringify(cache));
  c.setCachedLookup('newword', { phonetic: '/n/', exampleEn: 'e' });
  const saved = JSON.parse(store.storeGet('wordnest_lookup_cache'));
  assert.equal(Object.keys(saved).length, 300);
  assert.ok(!('w0' in saved));
  assert.ok('newword' in saved);
});
