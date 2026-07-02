'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

const ctx = loadScripts(['sync.js']);

test('shouldShowSyncBanner is true when the synced file is newer than the local save', () => {
  assert.equal(ctx.shouldShowSyncBanner(1000, 2000), true);
});

test('shouldShowSyncBanner is false when the local save is newer or equally recent', () => {
  assert.equal(ctx.shouldShowSyncBanner(2000, 2000), false);
  assert.equal(ctx.shouldShowSyncBanner(3000, 2000), false);
});

test('shouldShowSyncBanner treats a corrupted (NaN) local timestamp as 0, not "never show"', () => {
  // Regression: parseInt('') -> NaN used to make `syncedAt <= NaN` always false,
  // silently hiding the restore banner forever once the stored value got corrupted.
  assert.equal(ctx.shouldShowSyncBanner(NaN, 1), true);
});

test('shouldShowSyncBanner with a NaN local timestamp and syncedAt 0 stays false', () => {
  assert.equal(ctx.shouldShowSyncBanner(NaN, 0), false);
});
