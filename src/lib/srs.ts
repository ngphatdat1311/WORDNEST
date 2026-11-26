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
 * Upgraded 4-level SM-2 algorithm (Anki-style) compatible with WordNest v1 fields.
 */
export function computeSrsNext(
  word: WordItem,
  rating: SrsRating
): {
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  srsDue: string;
  masteryDelta: number;
} {
  const prevInterval = word.srsInterval ?? 0;
  const prevEase = word.srsEase ?? 2.5;
  const prevReps = word.srsReps ?? 0;

  let interval = 1;
  let ease = prevEase;
  let reps = prevReps;
  let masteryDelta = 0;

  if (rating === 'again') {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, prevEase - 0.2);
    masteryDelta = -1;
  } else if (rating === 'hard') {
    reps = prevReps === 0 ? 1 : prevReps;
    interval = prevInterval <= 1 ? 1 : Math.max(2, Math.round(prevInterval * 1.2));
    ease = Math.max(1.3, prevEase - 0.15);
    masteryDelta = 0;
  } else if (rating === 'good') {
    reps = prevReps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 4;
    else interval = Math.max(4, Math.round(prevInterval * prevEase));
    masteryDelta = 1;
  } else {
    // easy
    reps = prevReps + 1;
    if (reps === 1) interval = 4;
    else if (reps === 2) interval = 8;
    else interval = Math.max(6, Math.round(prevInterval * prevEase * 1.3));
    ease = Math.min(3.0, prevEase + 0.15);
    masteryDelta = 1;
  }

  return {
    srsInterval: interval,
    srsEase: Number(ease.toFixed(2)),
    srsReps: reps,
    srsDue: addDaysToDateKey(localDateKey(), interval),
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
