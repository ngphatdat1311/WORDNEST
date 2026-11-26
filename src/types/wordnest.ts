export type WordType = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase' | 'other';
export type WordLevel = 'easy' | 'medium' | 'hard';
export type SrsRating = 'again' | 'hard' | 'good' | 'easy';
export type DictationMode = 'tap' | 'blanks' | 'full';
export type NavTab =
  | 'home'
  | 'dictation'
  | 'flashcard'
  | 'quiz'
  | 'spelling'
  | 'game'
  | 'wordlist'
  | 'add'
  | 'progress';

export interface WordItem {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  type: WordType;
  category: string;
  level: WordLevel;
  mastery: number; // 0..3
  known: number;
  seen: number;
  folderIds: string[];
  suspended?: boolean;
  addedAt?: string;
  updatedAt?: string; // ISO timestamp used for conflict-free 2-way sync merge
  // SM-2 SRS fields (compatible with WordNest v1)
  srsDue?: string; // YYYY-MM-DD
  srsInterval?: number; // days
  srsEase?: number; // default 2.5
  srsReps?: number;
  srsLapses?: number; // times rated 'again' (used for leech detection)
  sourceVideoId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
}

export interface TrashEntry {
  kind: 'word' | 'folder';
  deletedAt: string;
  data: WordItem | FolderItem;
  wordIds?: string[];
}

export interface StreakData {
  count: number;
  lastDate: string | null; // YYYY-MM-DD
  history: Record<string, number>; // YYYY-MM-DD -> activity count
  freezes?: number; // available Streak Freeze shields (starts at 1, +1 per 7-day milestone, max 3)
  frozenDates?: string[]; // dates automatically protected by Streak Freeze
}

export interface QuizStats {
  totalGames: number;
  totalQuestions: number;
  totalCorrect: number;
  bestScore: number; // 0..100
}

export interface AirCombatStats {
  gamesPlayed: number;
  bestScore: number;
  bestWave: number;
  bestWpm: number;
  totalDestroyed: number;
}

export interface TranscriptSegment {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  vi?: string; // optional Vietnamese translation
}

export interface DictationLesson {
  id: string;
  youtubeId: string;
  sourceType?: 'youtube' | 'audio';
  audioUrl?: string; // blob URL for uploaded local MP3/audio files
  accent?: 'US' | 'UK';
  title: string;
  channel: string;
  category: 'shorts' | 'ted' | 'ielts' | 'daily' | 'music' | 'science' | 'custom';
  level: WordLevel;
  durationSec: number;
  thumbnail: string;
  description?: string;
  segments: TranscriptSegment[];
  segmentCount?: number;
  viewsCount?: number;
  viewsFormatted?: string;
  isCustom?: boolean;
  addedAt: string;
}

export interface DictationLessonProgress {
  lessonId: string;
  completedSegmentIds: string[];
  lastSegmentIndex: number;
  lastPracticedAt: string;
  accuracySum: number;
  attempts: number;
}

export interface CloudSyncConfig {
  enabled: boolean;
  autoSync?: boolean;
  authMode?: 'account' | 'code';
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncCode: string;
  userEmail?: string;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  geminiApiKey?: string;
  lastSyncedAt: string | null;
}

export interface LookupResult {
  word: string;
  phonetic: string;
  audioUrl?: string;
  meaning: string;
  altMeanings: string[];
  type: WordType;
  examples: string[];
  exampleVi?: string;
  level: WordLevel;
  cefr?: string;
}

export interface WordNestBackupV1 {
  version?: number | string;
  exportedAt?: string;
  words: Partial<WordItem>[];
  folders?: FolderItem[];
  trash?: TrashEntry[];
  streak?: StreakData;
  quizStats?: QuizStats;
  airCombatStats?: AirCombatStats;
  dailyGoal?: number;
  customLessons?: DictationLesson[];
  dictationProgress?: Record<string, DictationLessonProgress>;
}
