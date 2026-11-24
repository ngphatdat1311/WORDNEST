import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLemmaCandidates,
  pickEnglishCaptionTrack,
  SlidingWindowRateLimiter,
  TtlLruCache,
} from '../src/lib/server-cache.ts';

describe('TtlLruCache', () => {
  it('evicts least-recently-used entry when maxEntries is reached', () => {
    const cache = new TtlLruCache<string>(2, 10_000);
    cache.set('a', '1', 10_000, 1000);
    cache.set('b', '2', 10_000, 1000);
    // Touch 'a' so 'b' becomes least-recently-used
    assert.equal(cache.get('a', 1001), '1');
    cache.set('c', '3', 10_000, 1002);

    assert.equal(cache.get('b', 1003), undefined);
    assert.equal(cache.get('a', 1003), '1');
    assert.equal(cache.get('c', 1003), '3');
  });

  it('expires entries after TTL elapses', () => {
    const cache = new TtlLruCache<string>(5, 500);
    cache.set('hello', 'xin chào', 500, 1000);
    assert.equal(cache.get('hello', 1499), 'xin chào');
    assert.equal(cache.get('hello', 1500), undefined);
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('blocks requests exceeding the window quota and recovers after window passes', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    assert.equal(limiter.allow('1.2.3.4', 100).allowed, true);
    assert.equal(limiter.allow('1.2.3.4', 200).allowed, true);

    const blocked = limiter.allow('1.2.3.4', 300);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec >= 1);

    // After first request expires (> 1100ms), a new request is allowed
    assert.equal(limiter.allow('1.2.3.4', 1101).allowed, true);
  });
});

describe('getLemmaCandidates', () => {
  it('generates base lemma candidates for inflected English words', () => {
    assert.ok(getLemmaCandidates('procrastinating').includes('procrastinate'));
    assert.ok(getLemmaCandidates('running').includes('run'));
    assert.ok(getLemmaCandidates('studies').includes('study'));
    assert.ok(getLemmaCandidates('happily').includes('happy'));
    assert.deepEqual(getLemmaCandidates('give up'), []);
  });
});

describe('pickEnglishCaptionTrack', () => {
  it('prefers manual English over auto-generated ASR English', () => {
    const tracks = [
      { baseUrl: 'https://example.com/asr', languageCode: 'en', kind: 'asr' },
      { baseUrl: 'https://example.com/manual', languageCode: 'en-US' },
    ];
    assert.equal(pickEnglishCaptionTrack(tracks)?.baseUrl, 'https://example.com/manual');
  });

  it('returns null instead of silently picking non-English tracks', () => {
    const tracks = [
      { baseUrl: 'https://example.com/ko', languageCode: 'ko' },
      { baseUrl: 'https://example.com/ja', languageCode: 'ja' },
      { baseUrl: 'https://example.com/vi', languageCode: 'vi' },
    ];
    assert.equal(pickEnglishCaptionTrack(tracks), null);
  });
});
