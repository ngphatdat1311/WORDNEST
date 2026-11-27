import type {
  AirCombatStats,
  DictationLesson,
  DictationLessonProgress,
  FolderItem,
  QuizStats,
  StreakData,
  WordItem,
  WordNestBackupV1,
} from '../types/wordnest.ts';

function pickNewerWord(a: Partial<WordItem>, b: Partial<WordItem>): Partial<WordItem> {
  const tsA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
  const tsB = b.updatedAt ? Date.parse(b.updatedAt) : 0;

  let primary: Partial<WordItem>;
  let secondary: Partial<WordItem>;

  if (tsA && tsB && tsA !== tsB) {
    primary = tsA > tsB ? a : b;
    secondary = tsA > tsB ? b : a;
  } else {
    // Fallback heuristic when timestamps are absent/equal: keep the more practiced record
    const scoreA = (a.srsReps || 0) * 10 + (a.mastery || 0) * 5 + (a.seen || 0);
    const scoreB = (b.srsReps || 0) * 10 + (b.mastery || 0) * 5 + (b.seen || 0);
    primary = scoreA >= scoreB ? a : b;
    secondary = scoreA >= scoreB ? b : a;
  }

  const mergedFolderIds = Array.from(
    new Set([...(primary.folderIds || []), ...(secondary.folderIds || [])])
  );

  return {
    ...secondary,
    ...primary,
    phonetic: primary.phonetic || secondary.phonetic || '',
    example: primary.example || secondary.example || '',
    meaning: primary.meaning || secondary.meaning || '',
    folderIds: mergedFolderIds,
    seen: Math.max(primary.seen || 0, secondary.seen || 0),
    known: Math.max(primary.known || 0, secondary.known || 0),
  };
}

function mergeFolders(local: FolderItem[] = [], remote: FolderItem[] = []): FolderItem[] {
  const byId = new Map<string, FolderItem>();
  const seenNames = new Set<string>();

  for (const f of [...local, ...remote]) {
    if (!f?.id || !f?.name) continue;
    const normName = f.name.trim().toLowerCase();
    if (byId.has(f.id) || seenNames.has(normName)) continue;
    byId.set(f.id, f);
    seenNames.add(normName);
  }
  return Array.from(byId.values());
}

function mergeStreak(local?: StreakData, remote?: StreakData): StreakData | undefined {
  if (!local && !remote) return undefined;
  const a = local || { count: 0, lastDate: null, history: {}, freezes: 1, frozenDates: [] };
  const b = remote || { count: 0, lastDate: null, history: {}, freezes: 1, frozenDates: [] };

  const history: Record<string, number> = { ...(a.history || {}) };
  for (const [dateKey, count] of Object.entries(b.history || {})) {
    history[dateKey] = Math.max(history[dateKey] || 0, count || 0);
  }

  const frozenDates = Array.from(
    new Set([...(a.frozenDates || []), ...(b.frozenDates || [])])
  ).sort();

  const lastDate =
    !a.lastDate
      ? b.lastDate
      : !b.lastDate
        ? a.lastDate
        : a.lastDate >= b.lastDate
          ? a.lastDate
          : b.lastDate;

  return {
    count: Math.max(a.count || 0, b.count || 0),
    lastDate,
    history,
    freezes: Math.max(
      typeof a.freezes === 'number' ? a.freezes : 1,
      typeof b.freezes === 'number' ? b.freezes : 1
    ),
    frozenDates: frozenDates.slice(-30),
  };
}

function mergeDictationProgress(
  local: Record<string, DictationLessonProgress> = {},
  remote: Record<string, DictationLessonProgress> = {}
): Record<string, DictationLessonProgress> {
  const merged: Record<string, DictationLessonProgress> = { ...local };
  for (const [lessonId, rProg] of Object.entries(remote)) {
    const lProg = merged[lessonId];
    if (!lProg) {
      merged[lessonId] = rProg;
      continue;
    }
    const completedSegmentIds = Array.from(
      new Set([...(lProg.completedSegmentIds || []), ...(rProg.completedSegmentIds || [])])
    );
    const remoteIsNewer = (rProg.lastPracticedAt || '') > (lProg.lastPracticedAt || '');
    merged[lessonId] = {
      lessonId,
      completedSegmentIds,
      lastSegmentIndex: remoteIsNewer ? rProg.lastSegmentIndex : lProg.lastSegmentIndex,
      lastPracticedAt: remoteIsNewer ? rProg.lastPracticedAt : lProg.lastPracticedAt,
      accuracySum: Math.max(lProg.accuracySum || 0, rProg.accuracySum || 0),
      attempts: Math.max(lProg.attempts || 0, rProg.attempts || 0),
    };
  }
  return merged;
}

function mergeCustomLessons(
  local: DictationLesson[] = [],
  remote: DictationLesson[] = []
): DictationLesson[] {
  const byKey = new Map<string, DictationLesson>();
  for (const lesson of [...local, ...remote]) {
    if (!lesson?.id) continue;
    const key = lesson.youtubeId ? `yt:${lesson.youtubeId}` : `id:${lesson.id}`;
    const existing = byKey.get(key);
    if (!existing || (lesson.segments?.length || 0) > (existing.segments?.length || 0)) {
      byKey.set(key, lesson);
    }
  }
  return Array.from(byKey.values());
}

function mergeQuizStats(local?: QuizStats, remote?: QuizStats): QuizStats | undefined {
  if (!local && !remote) return undefined;
  const a = local || { totalGames: 0, totalQuestions: 0, totalCorrect: 0, bestScore: 0 };
  const b = remote || { totalGames: 0, totalQuestions: 0, totalCorrect: 0, bestScore: 0 };
  return {
    totalGames: Math.max(a.totalGames, b.totalGames),
    totalQuestions: Math.max(a.totalQuestions, b.totalQuestions),
    totalCorrect: Math.max(a.totalCorrect, b.totalCorrect),
    bestScore: Math.max(a.bestScore, b.bestScore),
  };
}

function mergeAirCombatStats(
  local?: AirCombatStats,
  remote?: AirCombatStats
): AirCombatStats | undefined {
  if (!local && !remote) return undefined;
  const a = local || { gamesPlayed: 0, bestScore: 0, bestWave: 0, bestWpm: 0, totalDestroyed: 0 };
  const b = remote || { gamesPlayed: 0, bestScore: 0, bestWave: 0, bestWpm: 0, totalDestroyed: 0 };
  return {
    gamesPlayed: Math.max(a.gamesPlayed, b.gamesPlayed),
    bestScore: Math.max(a.bestScore, b.bestScore),
    bestWave: Math.max(a.bestWave, b.bestWave),
    bestWpm: Math.max(a.bestWpm, b.bestWpm),
    totalDestroyed: Math.max(a.totalDestroyed, b.totalDestroyed),
  };
}

/**
 * Conflict-free two-way merge between local and remote WordNest backups.
 * Ensures studying offline on multiple devices (e.g. phone + laptop) never wipes
 * completed sentences, newly added words, streak days, or SRS progress.
 */
export function mergeWordNestBackups(
  local: WordNestBackupV1,
  remote: WordNestBackupV1
): WordNestBackupV1 {
  const wordByKey = new Map<string, Partial<WordItem>>();
  for (const w of [...(local.words || []), ...(remote.words || [])]) {
    const key = (w.word || '').trim().toLowerCase();
    if (!key) continue;
    const prev = wordByKey.get(key);
    wordByKey.set(key, prev ? pickNewerWord(prev, w) : w);
  }

  return {
    version: '2.2.0',
    exportedAt: new Date().toISOString(),
    words: Array.from(wordByKey.values()),
    folders: mergeFolders(local.folders, remote.folders),
    trash: local.trash || remote.trash || [],
    streak: mergeStreak(local.streak, remote.streak),
    quizStats: mergeQuizStats(local.quizStats, remote.quizStats),
    airCombatStats: mergeAirCombatStats(local.airCombatStats, remote.airCombatStats),
    dailyGoal: local.dailyGoal ?? remote.dailyGoal ?? 15,
    customLessons: mergeCustomLessons(local.customLessons, remote.customLessons),
    dictationProgress: mergeDictationProgress(local.dictationProgress, remote.dictationProgress),
  };
}
