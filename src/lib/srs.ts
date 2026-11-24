import type { SrsRating, WordItem } from '../types/wordnest';

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
