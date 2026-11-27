import type { SrsRating, StreakData, WordItem } from '../types/wordnest';

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateKey(dt);
}

export function daysUntilDue(srsDue?: string): number | null {
  if (!srsDue) return null;
  const today = localDateKey();
  const ms = Date.parse(`${srsDue}T00:00:00`) - Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86400000);
}

export function isSrsDue(w: WordItem): boolean {
  if (w.suspended) return false;
  if (!w.srsDue) return true;
  const diff = daysUntilDue(w.srsDue);
  return diff === null || diff <= 0;
}

/**
 * FSRS v5 (Free Spaced Repetition Scheduler — Anki modern standard) default parameters.
 * Target retention R = 0.90. Fully backwards-compatible with WordNest v1 SM-2 fields.
 */
const FSRS_W = [
  0.40255, 1.18385, 3.173, 15.69105, // w0..w3: initial stability for Again/Hard/Good/Easy
  7.1949, 0.5345, 1.4604, 0.0046,    // w4..w7: difficulty initialization & mean reversion
  1.54575, 0.1192, 1.01925,          // w8..w10: recall stability growth
  1.9395, 0.11, 0.29605, 2.2698,     // w11..w14: lapse (forget) stability
  0.2315, 2.9898,                    // w15: hard penalty, w16: easy bonus
  0.51655, 0.6621,                   // w17..w18: same-day review stability
] as const;

const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19 / 81;
const FSRS_TARGET_RETENTION = 0.9;
const MAX_SRS_INTERVAL_DAYS = 36500;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ratingToGrade(rating: SrsRating): 1 | 2 | 3 | 4 {
  if (rating === 'again') return 1;
  if (rating === 'hard') return 2;
  if (rating === 'good') return 3;
  return 4;
}

function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const ms = Date.parse(`${toKey}T00:00:00`) - Date.parse(`${fromKey}T00:00:00`);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / 86400000));
}

/**
 * FSRS Power-Law Forgetting Curve: probability of recalling a card after `elapsedDays`
 * given memory stability `stability` (in days). At elapsedDays === stability, R === 0.90.
 */
export function computeRetrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  if (elapsedDays <= 0) return 1;
  const r = Math.pow(1 + (FSRS_FACTOR * elapsedDays) / stability, FSRS_DECAY);
  return clamp(r, 0, 1);
}

/**
 * Resolves effective FSRS stability & difficulty, seamlessly migrating legacy SM-2 words.
 */
export function resolveFsrsState(word: WordItem): {
  isNew: boolean;
  stability: number;
  difficulty: number;
} {
  if (
    typeof word.srsStability === 'number' &&
    word.srsStability > 0 &&
    typeof word.srsDifficulty === 'number'
  ) {
    return {
      isNew: false,
      stability: word.srsStability,
      difficulty: clamp(word.srsDifficulty, 1, 10),
    };
  }

  const prevReps = word.srsReps ?? 0;
  const prevInterval = word.srsInterval ?? 0;
  if (prevReps > 0 && prevInterval > 0) {
    const prevEase = word.srsEase ?? 2.5;
    return {
      isNew: false,
      stability: Math.max(0.5, prevInterval),
      difficulty: clamp(5.5 - (prevEase - 2.5) * 3.2, 1, 10),
    };
  }

  return { isNew: true, stability: 0, difficulty: FSRS_W[4] };
}

/**
 * Computes current estimated recall probability (0..1) for a word today, or null if brand new.
 */
export function getWordRetrievability(word: WordItem, todayKey = localDateKey()): number | null {
  const { isNew, stability } = resolveFsrsState(word);
  if (isNew || stability <= 0) return null;

  let elapsed = 0;
  if (word.srsLastReview) {
    elapsed = daysBetweenDateKeys(word.srsLastReview, todayKey);
  } else if (word.srsDue && word.srsInterval) {
    const dueDiff = daysBetweenDateKeys(todayKey, word.srsDue);
    const msDiff = Date.parse(`${word.srsDue}T00:00:00`) - Date.parse(`${todayKey}T00:00:00`);
    const signedDiff = Number.isFinite(msDiff) ? Math.round(msDiff / 86400000) : dueDiff;
    elapsed = Math.max(0, word.srsInterval - signedDiff);
  } else if (word.srsInterval) {
    elapsed = word.srsInterval;
  }

  return Number(computeRetrievability(elapsed, stability).toFixed(3));
}

function stabilityToInterval(stability: number, targetRetention = FSRS_TARGET_RETENTION): number {
  const raw =
    (stability / FSRS_FACTOR) * (Math.pow(targetRetention, 1 / FSRS_DECAY) - 1);
  return clamp(Math.round(raw), 1, MAX_SRS_INTERVAL_DAYS);
}

function initDifficulty(grade: 1 | 2 | 3 | 4): number {
  return clamp(FSRS_W[4] - Math.exp(FSRS_W[5] * (grade - 1)) + 1, 1, 10);
}

function nextDifficulty(d: number, grade: 1 | 2 | 3 | 4): number {
  const d0Easy = initDifficulty(4);
  const delta = -FSRS_W[6] * (grade - 3);
  const next = FSRS_W[7] * d0Easy + (1 - FSRS_W[7]) * (d + delta);
  return clamp(next, 1, 10);
}

/**
 * FSRS v5 next-review scheduler (with legacy SM-2 field compatibility).
 */
export function computeSrsNext(
  word: WordItem,
  rating: SrsRating,
  todayKey = localDateKey()
): {
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  srsDue: string;
  srsStability: number;
  srsDifficulty: number;
  srsLastReview: string;
  masteryDelta: number;
} {
  const grade = ratingToGrade(rating);
  const prevEase = word.srsEase ?? 2.5;
  const prevReps = word.srsReps ?? 0;
  const state = resolveFsrsState(word);

  let stability: number;
  let difficulty: number;
  let interval: number;
  let reps = prevReps;
  let ease = prevEase;
  let masteryDelta = 0;

  if (state.isNew) {
    stability = FSRS_W[grade - 1];
    difficulty = initDifficulty(grade);
    if (rating === 'again') {
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, prevEase - 0.2);
      masteryDelta = -1;
    } else if (rating === 'hard') {
      reps = 1;
      interval = Math.max(1, stabilityToInterval(stability));
      ease = Math.max(1.3, prevEase - 0.15);
      masteryDelta = 0;
    } else if (rating === 'good') {
      reps = 1;
      interval = Math.max(2, stabilityToInterval(stability));
      masteryDelta = 1;
    } else {
      reps = 1;
      interval = Math.max(4, stabilityToInterval(stability));
      ease = Math.min(3.0, prevEase + 0.15);
      masteryDelta = 1;
    }
  } else {
    const prevS = Math.max(0.1, state.stability);
    const prevD = state.difficulty;

    let elapsed = Math.max(1, Math.round(word.srsInterval ?? prevS));
    if (word.srsLastReview) {
      elapsed = daysBetweenDateKeys(word.srsLastReview, todayKey);
    }

    const r = computeRetrievability(elapsed, prevS);
    difficulty = nextDifficulty(prevD, grade);

    if (rating === 'again') {
      // Lapse: memory stability shrinks according to FSRS forget formula
      const forgetS =
        FSRS_W[11] *
        Math.pow(difficulty, -FSRS_W[12]) *
        (Math.pow(prevS + 1, FSRS_W[13]) - 1) *
        Math.exp(FSRS_W[14] * (1 - r));
      stability = clamp(Math.min(prevS, forgetS), 0.2, MAX_SRS_INTERVAL_DAYS);
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, prevEase - 0.2);
      masteryDelta = -1;
    } else {
      let nextS: number;
      if (elapsed === 0) {
        // Same-day reinforcement uses FSRS-5 short-term stability update
        nextS = prevS * Math.exp(FSRS_W[17] * (grade - 3 + FSRS_W[18]));
      } else {
        const hardPenalty = grade === 2 ? FSRS_W[15] : 1;
        const easyBonus = grade === 4 ? FSRS_W[16] : 1;
        const gain =
          Math.exp(FSRS_W[8]) *
          (11 - difficulty) *
          Math.pow(prevS, -FSRS_W[9]) *
          (Math.exp(FSRS_W[10] * (1 - r)) - 1) *
          hardPenalty *
          easyBonus;
        nextS = prevS * (gain + 1);
      }

      stability = clamp(nextS, 0.4, MAX_SRS_INTERVAL_DAYS);
      const rawInterval = stabilityToInterval(stability);

      if (rating === 'hard') {
        reps = prevReps === 0 ? 1 : prevReps;
        interval = Math.max(2, rawInterval);
        ease = Math.max(1.3, prevEase - 0.15);
        masteryDelta = 0;
      } else if (rating === 'good') {
        reps = prevReps + 1;
        // Guarantee Good > Hard when stability is very small
        const hardS =
          elapsed === 0
            ? prevS * Math.exp(FSRS_W[17] * (2 - 3 + FSRS_W[18]))
            : prevS *
              (Math.exp(FSRS_W[8]) *
                (11 - nextDifficulty(prevD, 2)) *
                Math.pow(prevS, -FSRS_W[9]) *
                (Math.exp(FSRS_W[10] * (1 - r)) - 1) *
                FSRS_W[15] +
                1);
        const hardInterval = Math.max(2, stabilityToInterval(clamp(hardS, 0.4, MAX_SRS_INTERVAL_DAYS)));
        interval = Math.max(hardInterval + 1, rawInterval);
        masteryDelta = 1;
      } else {
        reps = prevReps + 1;
        const goodS =
          elapsed === 0
            ? prevS * Math.exp(FSRS_W[17] * (3 - 3 + FSRS_W[18]))
            : prevS *
              (Math.exp(FSRS_W[8]) *
                (11 - nextDifficulty(prevD, 3)) *
                Math.pow(prevS, -FSRS_W[9]) *
                (Math.exp(FSRS_W[10] * (1 - r)) - 1) +
                1);
        const goodInterval = Math.max(3, stabilityToInterval(clamp(goodS, 0.4, MAX_SRS_INTERVAL_DAYS)));
        interval = Math.max(goodInterval + 1, rawInterval);
        ease = Math.min(3.0, prevEase + 0.15);
        masteryDelta = 1;
      }
    }
  }

  return {
    srsInterval: interval,
    srsEase: Number(ease.toFixed(2)),
    srsReps: reps,
    srsDue: addDaysToDateKey(todayKey, interval),
    srsStability: Number(stability.toFixed(2)),
    srsDifficulty: Number(difficulty.toFixed(2)),
    srsLastReview: todayKey,
    masteryDelta,
  };
}

export function formatIntervalPreview(days: number): string {
  if (days <= 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  const months = Math.round(days / 30);
  return `${months} tháng`;
}

export type FlashcardModeFilter = 'all' | 'srs' | 'new' | 'review';

/**
 * Build a stable snapshot of card IDs for a flashcard study session so rating a card
 * (which updates srsDue / mastery) never mutates indices mid-session and skips cards.
 */
export function buildFlashcardSessionIds(
  words: WordItem[],
  modeFilter: FlashcardModeFilter,
  folderFilter: string,
  shuffleSeed: number
): string[] {
  let pool = words.filter((w) => !w.suspended);
  if (modeFilter === 'srs') pool = pool.filter(isSrsDue);
  else if (modeFilter === 'new') pool = pool.filter((w) => w.mastery === 0);
  else if (modeFilter === 'review') pool = pool.filter((w) => w.mastery > 0 && w.mastery < 3);

  if (folderFilter !== 'all') {
    pool = pool.filter((w) => w.folderIds.includes(folderFilter));
  }

  // Scientific FSRS urgency ordering for due SRS sessions:
  // Rescue cards with the lowest estimated retrievability R(t, S) first before they are forgotten.
  if (modeFilter === 'srs' && shuffleSeed === 0) {
    const today = localDateKey();
    pool = [...pool].sort((a, b) => {
      const ra = getWordRetrievability(a, today);
      const rb = getWordRetrievability(b, today);
      if (ra !== null && rb !== null) return ra - rb;
      if (ra !== null && rb === null) return -1;
      if (ra === null && rb !== null) return 1;
      return 0;
    });
  }

  const ids = pool.map((w) => w.id);
  if (shuffleSeed > 0) {
    let s = shuffleSeed * 9301 + 49297;
    for (let i = ids.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  return ids;
}

/**
 * Anki-style intra-session relearning: when a user presses "Again", re-insert the
 * forgotten card a few positions ahead in the current session queue so they reinforce it now.
 */
export function requeueForgottenCard(
  queue: string[],
  currentIndex: number,
  gap = 3
): string[] {
  const cardId = queue[currentIndex];
  if (!cardId) return queue;
  const next = [...queue];
  const insertAt = Math.min(next.length, currentIndex + Math.max(1, gap) + 1);
  next.splice(insertAt, 0, cardId);
  return next;
}

/**
 * Identifies "leech" words (words the learner repeatedly forgets) so the UI
 * can suggest adding a memorable personal example or mnemonic.
 */
export function isLeechWord(word: WordItem): boolean {
  if (word.suspended) return false;
  if ((word.srsLapses ?? 0) >= 4) return true;
  return (word.seen || 0) >= 6 && (word.mastery || 0) === 0;
}

/**
 * Computes updated daily learning streak with automatic 1-day Streak Freeze protection.
 * - Starts with 1 free Streak Freeze shield; earns +1 shield every 7-day streak milestone (max 3).
 * - If user misses exactly 1 day (lastDate === twoDaysAgo) and has >= 1 shield, preserves streak!
 */
export function computeUpdatedStreak(
  prev: StreakData,
  todayKey = localDateKey()
): { next: StreakData; usedFreeze: boolean; earnedFreeze: boolean } {
  const history = {
    ...(prev.history || {}),
    [todayKey]: ((prev.history || {})[todayKey] || 0) + 1,
  };
  let freezes = typeof prev.freezes === 'number' ? prev.freezes : 1;
  const frozenDates = Array.isArray(prev.frozenDates) ? [...prev.frozenDates] : [];
  let count = prev.count || 0;
  let usedFreeze = false;
  let earnedFreeze = false;

  if (prev.lastDate === todayKey) {
    return {
      next: { count: Math.max(1, count), lastDate: todayKey, history, freezes, frozenDates },
      usedFreeze: false,
      earnedFreeze: false,
    };
  }

  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  const twoDaysAgoKey = addDaysToDateKey(todayKey, -2);

  if (prev.lastDate === yesterdayKey) {
    count = count + 1;
  } else if (prev.lastDate === twoDaysAgoKey && count > 0 && freezes > 0) {
    // Missed exactly 1 day -> consume 1 Streak Freeze shield to save streak!
    freezes -= 1;
    usedFreeze = true;
    if (!frozenDates.includes(yesterdayKey)) {
      frozenDates.push(yesterdayKey);
    }
    count = count + 1;
  } else {
    count = 1;
  }

  // Reward +1 Streak Freeze shield every 7-day milestone (capped at 3)
  if (count > 0 && count % 7 === 0 && freezes < 3) {
    freezes += 1;
    earnedFreeze = true;
  }

  return {
    next: {
      count,
      lastDate: todayKey,
      history,
      freezes,
      frozenDates: frozenDates.slice(-30),
    },
    usedFreeze,
    earnedFreeze,
  };
}
