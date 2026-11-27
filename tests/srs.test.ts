import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateKey,
  buildFlashcardSessionIds,
  computeRetrievability,
  computeSrsNext,
  computeUpdatedStreak,
  formatIntervalPreview,
  getWordRetrievability,
  isLeechWord,
  isSrsDue,
  localDateKey,
  requeueForgottenCard,
  resolveFsrsState,
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

describe('SRS FSRS v5 Algorithm', () => {
  it('produces strictly increasing intervals across again < hard < good < easy', () => {
    const w = makeWord({ srsInterval: 4, srsEase: 2.5, srsReps: 2 });
    const a = computeSrsNext(w, 'again').srsInterval;
    const h = computeSrsNext(w, 'hard').srsInterval;
    const g = computeSrsNext(w, 'good').srsInterval;
    const e = computeSrsNext(w, 'easy').srsInterval;
    assert.ok(a < h && h < g && g < e, `Expected ${a} < ${h} < ${g} < ${e}`);
  });

  it('computes FSRS power-law retrievability accurately (R=0.9 at t=S)', () => {
    assert.equal(computeRetrievability(0, 10), 1);
    const rAtStability = computeRetrievability(10, 10);
    assert.ok(Math.abs(rAtStability - 0.9) < 0.001, `Expected ~0.9, got ${rAtStability}`);
    assert.ok(computeRetrievability(20, 10) < rAtStability);
  });

  it('initializes FSRS stability/difficulty on new words and grows stability on recall', () => {
    const fresh = makeWord({ srsReps: 0, srsInterval: undefined, srsStability: undefined });
    const first = computeSrsNext(fresh, 'good', '2026-11-20');
    assert.ok(first.srsStability > 2.5);
    assert.ok(first.srsDifficulty >= 1 && first.srsDifficulty <= 10);
    assert.equal(first.srsLastReview, '2026-11-20');

    const reviewedWord = makeWord({
      ...fresh,
      srsReps: first.srsReps,
      srsInterval: first.srsInterval,
      srsDue: first.srsDue,
      srsStability: first.srsStability,
      srsDifficulty: first.srsDifficulty,
      srsLastReview: first.srsLastReview,
    });
    const second = computeSrsNext(reviewedWord, 'good', '2026-11-23');
    assert.ok(second.srsStability > first.srsStability);
    assert.ok(second.srsInterval > first.srsInterval);

    const lapse = computeSrsNext(reviewedWord, 'again', '2026-11-23');
    assert.ok(lapse.srsStability <= first.srsStability);
    assert.equal(lapse.srsInterval, 1);
    assert.equal(lapse.srsReps, 0);
  });

  it('migrates legacy SM-2 words seamlessly into FSRS state and estimates retrievability', () => {
    const legacy = makeWord({ srsInterval: 10, srsEase: 2.6, srsReps: 3, srsDue: '2026-11-26' });
    const state = resolveFsrsState(legacy);
    assert.equal(state.isNew, false);
    assert.equal(state.stability, 10);
    assert.ok(state.difficulty >= 1 && state.difficulty <= 10);

    const ret = getWordRetrievability(legacy, '2026-11-26');
    assert.ok(ret !== null && Math.abs(ret - 0.9) < 0.02, `Expected ~0.9, got ${ret}`);
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

describe('Flashcard SRS Session Queue (No-Skip & Intra-Session Relearning)', () => {
  it('snapshots due card IDs stably and filters folders/suspended words', () => {
    const today = localDateKey();
    const tomorrow = addDaysToDateKey(today, 1);
    const words = [
      makeWord({ id: 'a', srsDue: today, folderIds: ['f1'] }),
      makeWord({ id: 'b', srsDue: undefined, folderIds: ['f1'] }),
      makeWord({ id: 'c', srsDue: tomorrow, folderIds: ['f1'] }),
      makeWord({ id: 'd', srsDue: today, suspended: true, folderIds: ['f1'] }),
      makeWord({ id: 'e', srsDue: today, folderIds: ['f2'] }),
    ];

    assert.deepEqual(buildFlashcardSessionIds(words, 'srs', 'all', 0), ['a', 'b', 'e']);
    assert.deepEqual(buildFlashcardSessionIds(words, 'srs', 'f1', 0), ['a', 'b']);

    // FSRS urgency ordering: overdue low-retrievability card comes BEFORE fresher due card and new card
    const urgentPool = [
      makeWord({ id: 'new_card', srsDue: undefined }),
      makeWord({ id: 'due_today', srsDue: today, srsInterval: 10, srsStability: 10, srsDifficulty: 5, srsLastReview: addDaysToDateKey(today, -10) }),
      makeWord({ id: 'very_overdue', srsDue: addDaysToDateKey(today, -15), srsInterval: 5, srsStability: 5, srsDifficulty: 6, srsLastReview: addDaysToDateKey(today, -20) }),
    ];
    assert.deepEqual(buildFlashcardSessionIds(urgentPool, 'srs', 'all', 0), [
      'very_overdue',
      'due_today',
      'new_card',
    ]);
  });

  it('requeues a forgotten card ahead in the current session without skipping neighbors', () => {
    const queue = ['a', 'b', 'c', 'd', 'e'];
    // Forget index 0 ('a') with gap 3 -> inserted at index 4 (after b, c, d)
    assert.deepEqual(requeueForgottenCard(queue, 0, 3), ['a', 'b', 'c', 'd', 'a', 'e']);
    // Forget last card -> inserted immediately at end so user must reinforce it before finishing
    assert.deepEqual(requeueForgottenCard(['a', 'b'], 1, 3), ['a', 'b', 'b']);
  });
});

describe('Streak Freeze & Leech Detection', () => {
  it('preserves streak using a Streak Freeze shield when exactly 1 day is missed', () => {
    const res = computeUpdatedStreak(
      { count: 5, lastDate: '2026-11-24', history: { '2026-11-24': 4 }, freezes: 1, frozenDates: [] },
      '2026-11-26'
    );
    assert.equal(res.usedFreeze, true);
    assert.equal(res.next.count, 6);
    assert.equal(res.next.freezes, 0);
    assert.deepEqual(res.next.frozenDates, ['2026-11-25']);
  });

  it('resets streak when >1 day is missed or no freezes remain, and earns +1 freeze on 7-day milestone', () => {
    const resetRes = computeUpdatedStreak(
      { count: 5, lastDate: '2026-11-22', history: {}, freezes: 2, frozenDates: [] },
      '2026-11-26'
    );
    assert.equal(resetRes.usedFreeze, false);
    assert.equal(resetRes.next.count, 1);
    assert.equal(resetRes.next.freezes, 2);

    const milestoneRes = computeUpdatedStreak(
      { count: 6, lastDate: '2026-11-25', history: {}, freezes: 1, frozenDates: [] },
      '2026-11-26'
    );
    assert.equal(milestoneRes.next.count, 7);
    assert.equal(milestoneRes.earnedFreeze, true);
    assert.equal(milestoneRes.next.freezes, 2);
  });

  it('detects leech words accurately and ignores suspended words', () => {
    assert.equal(isLeechWord(makeWord({ srsLapses: 4 })), true);
    assert.equal(isLeechWord(makeWord({ srsLapses: 4, suspended: true })), false);
    assert.equal(isLeechWord(makeWord({ seen: 6, mastery: 0, srsLapses: 1 })), true);
    assert.equal(isLeechWord(makeWord({ seen: 6, mastery: 2, srsLapses: 1 })), false);
  });
});
