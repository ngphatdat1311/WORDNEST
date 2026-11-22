import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateKey,
  computeSrsNext,
  formatIntervalPreview,
  isSrsDue,
  localDateKey,
} from '../src/lib/srs.ts';
import type { WordItem } from '../src/types/wordnest.ts';

function makeWord(overrides: Partial<WordItem> = {}): WordItem {
  return {
    id: 'w_1',
    word: 'serendipity',
    phonetic: '',
    meaning: 'sự tình cờ',
    example: '',
    type: 'noun',
    category: 'Cuộc sống',
    level: 'hard',
    mastery: 1,
    known: 2,
    seen: 3,
    folderIds: [],
    ...overrides,
  };
}

describe('SRS SM-2 Algorithm', () => {
  it('produces strictly increasing intervals across again < hard < good < easy', () => {
    const w = makeWord({ srsInterval: 4, srsEase: 2.5, srsReps: 2 });
    const a = computeSrsNext(w, 'again').srsInterval;
    const h = computeSrsNext(w, 'hard').srsInterval;
    const g = computeSrsNext(w, 'good').srsInterval;
    const e = computeSrsNext(w, 'easy').srsInterval;
    assert.ok(a < h && h < g && g < e, `Expected ${a} < ${h} < ${g} < ${e}`);
  });

  it('enforces ease factor bounds [1.3, 3.0]', () => {
    const low = computeSrsNext(makeWord({ srsEase: 1.3 }), 'again');
    assert.equal(low.srsEase, 1.3);

    const high = computeSrsNext(makeWord({ srsEase: 2.95 }), 'easy');
    assert.equal(high.srsEase, 3.0);
  });

  it('determines due status accurately and ignores suspended words', () => {
    const today = localDateKey();
    const yesterday = addDaysToDateKey(today, -1);
    const tomorrow = addDaysToDateKey(today, 1);

    assert.equal(isSrsDue(makeWord({ srsDue: undefined })), true);
    assert.equal(isSrsDue(makeWord({ srsDue: today })), true);
    assert.equal(isSrsDue(makeWord({ srsDue: yesterday })), true);
    assert.equal(isSrsDue(makeWord({ srsDue: tomorrow })), false);
    assert.equal(isSrsDue(makeWord({ srsDue: yesterday, suspended: true })), false);
  });

  it('formats interval preview cleanly in Vietnamese', () => {
    assert.equal(formatIntervalPreview(1), '1 ngày');
    assert.equal(formatIntervalPreview(12), '12 ngày');
    assert.equal(formatIntervalPreview(60), '2 tháng');
  });
});
