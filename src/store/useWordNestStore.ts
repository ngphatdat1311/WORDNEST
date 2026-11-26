'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  AirCombatStats,
  CloudSyncConfig,
  DictationLesson,
  DictationLessonProgress,
  FolderItem,
  NavTab,
  QuizStats,
  SrsRating,
  StreakData,
  TrashEntry,
  WordItem,
  WordLevel,
  WordNestBackupV1,
  WordType,
} from '@/types/wordnest';
import { computeSrsNext, computeUpdatedStreak, localDateKey } from '@/lib/srs';
import { VOCAB_STARTER_PACKS } from '@/lib/starter-packs';
import { wordNestStateStorage } from '@/lib/storage-adapter';

function genId(prefix = 'w'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_WORDS: WordItem[] = [
  { id: 'w_def_1', word: 'serendipity', phonetic: '/ˌser.ənˈdɪp.ɪ.ti/', meaning: 'sự tình cờ may mắn', example: 'It was serendipity that we met.', type: 'noun', category: 'Cuộc sống', level: 'hard', mastery: 0, known: 0, seen: 0, folderIds: [], addedAt: '2026-01-01' },
  { id: 'w_def_2', word: 'ephemeral', phonetic: '/ɪˈfem.ər.əl/', meaning: 'ngắn ngủi, thoáng qua', example: 'Youth is ephemeral.', type: 'adj', category: 'Triết học', level: 'hard', mastery: 0, known: 0, seen: 0, folderIds: [], addedAt: '2026-01-01' },
  { id: 'w_def_3', word: 'resilient', phonetic: '/rɪˈzɪl.i.ənt/', meaning: 'kiên cường, đàn hồi', example: 'She is a resilient person.', type: 'adj', category: 'Tính cách', level: 'medium', mastery: 1, known: 2, seen: 4, folderIds: [], addedAt: '2026-01-02' },
  { id: 'w_def_4', word: 'abundant', phonetic: '/əˈbʌn.dənt/', meaning: 'dồi dào, phong phú', example: 'Fish are abundant in this river.', type: 'adj', category: 'Thiên nhiên', level: 'medium', mastery: 0, known: 1, seen: 3, folderIds: [], addedAt: '2026-01-02' },
  { id: 'w_def_5', word: 'meticulous', phonetic: '/məˈtɪk.jʊ.ləs/', meaning: 'tỉ mỉ, cẩn thận', example: 'She is meticulous about details.', type: 'adj', category: 'Tính cách', level: 'hard', mastery: 0, known: 0, seen: 1, folderIds: [], addedAt: '2026-01-03' },
  { id: 'w_def_6', word: 'collaborate', phonetic: '/kəˈlæb.ə.reɪt/', meaning: 'hợp tác, cộng tác', example: 'We need to collaborate on this project.', type: 'verb', category: 'Công việc', level: 'medium', mastery: 2, known: 5, seen: 7, folderIds: [], addedAt: '2026-01-03' },
  { id: 'w_def_7', word: 'genuine', phonetic: '/ˈdʒen.jʊ.ɪn/', meaning: 'thật sự, chân thành', example: 'She gave a genuine smile.', type: 'adj', category: 'Tính cách', level: 'easy', mastery: 3, known: 8, seen: 9, folderIds: [], addedAt: '2026-01-04' },
  { id: 'w_def_8', word: 'eloquent', phonetic: '/ˈel.ə.kwənt/', meaning: 'hùng hồn, lưu loát', example: 'He is an eloquent speaker.', type: 'adj', category: 'Giao tiếp', level: 'hard', mastery: 0, known: 0, seen: 2, folderIds: [], addedAt: '2026-01-04' },
  { id: 'w_def_9', word: 'persist', phonetic: '/pəˈsɪst/', meaning: 'kiên trì, tiếp tục', example: 'She persisted despite the difficulties.', type: 'verb', category: 'Cuộc sống', level: 'medium', mastery: 1, known: 3, seen: 5, folderIds: [], addedAt: '2026-01-05' },
  { id: 'w_def_10', word: 'inevitable', phonetic: '/ɪnˈev.ɪ.tə.bəl/', meaning: 'không thể tránh khỏi', example: 'Change is inevitable.', type: 'adj', category: 'Triết học', level: 'medium', mastery: 0, known: 1, seen: 4, folderIds: [], addedAt: '2026-01-05' },
  { id: 'w_def_11', word: 'innovative', phonetic: '/ˈɪn.ə.veɪ.tɪv/', meaning: 'sáng tạo, đổi mới', example: 'We need innovative solutions.', type: 'adj', category: 'Công việc', level: 'medium', mastery: 2, known: 4, seen: 6, folderIds: [], addedAt: '2026-01-06' },
  { id: 'w_def_12', word: 'gratitude', phonetic: '/ˈɡræt.ɪ.tjuːd/', meaning: 'lòng biết ơn', example: 'She expressed her gratitude.', type: 'noun', category: 'Cảm xúc', level: 'easy', mastery: 3, known: 10, seen: 12, folderIds: [], addedAt: '2026-01-06' },
  { id: 'w_def_13', word: 'confession', phonetic: '/kənˈfeʃ.ən/', meaning: 'lời thú nhận', example: 'I have a confession to make.', type: 'noun', category: 'YouTube', level: 'medium', mastery: 0, known: 0, seen: 1, folderIds: [], addedAt: '2026-01-07' },
  { id: 'w_def_14', word: 'perseverance', phonetic: '/ˌpɜː.sɪˈvɪə.rəns/', meaning: 'sự kiên trì, bền bỉ', example: 'Success requires passion and perseverance.', type: 'noun', category: 'YouTube', level: 'hard', mastery: 0, known: 0, seen: 1, folderIds: [], addedAt: '2026-01-07' },
  { id: 'w_def_15', word: 'procrastinate', phonetic: '/prəˈkræs.tɪ.neɪt/', meaning: 'trì hoãn, chần chừ', example: 'I tend to procrastinate before big deadlines.', type: 'verb', category: 'YouTube', level: 'medium', mastery: 0, known: 0, seen: 1, folderIds: [], addedAt: '2026-01-07' },
];

export interface ToastState {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error';
  undoAction?: () => void;
}

interface WordNestState {
  activeTab: NavTab;
  activeDictationLessonId: string | null;
  theme: 'light' | 'dark';
  words: WordItem[];
  folders: FolderItem[];
  trash: TrashEntry[];
  streak: StreakData;
  quizStats: QuizStats;
  airCombatStats: AirCombatStats;
  dailyGoal: number;
  customLessons: DictationLesson[];
  dictationProgress: Record<string, DictationLessonProgress>;
  cloudSync: CloudSyncConfig;
  toast: ToastState | null;

  // Navigation & Theme
  setActiveTab: (tab: NavTab) => void;
  openDictationLesson: (lessonId: string | null) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  showToast: (message: string, tone?: 'default' | 'success' | 'error', undoAction?: () => void) => void;
  clearToast: () => void;

  // Word CRUD
  addWord: (input: {
    word: string;
    phonetic?: string;
    meaning: string;
    example?: string;
    type?: WordType;
    category?: string;
    level?: WordLevel;
    folderIds?: string[];
    sourceVideoId?: string;
  }) => { ok: boolean; error?: string; word?: WordItem };
  bulkAddWords: (
    items: Array<{
      word: string;
      phonetic: string;
      meaning: string;
      example: string;
      type: WordType;
    }>,
    folderId?: string
  ) => { added: number; skipped: number };
  importStarterPack: (packId: string) => { added: number; skipped: number; folderName: string };
  updateWord: (id: string, patch: Partial<WordItem>) => void;
  deleteWordSoft: (id: string) => void;
  toggleSuspendWord: (id: string) => void;
  markWordSeen: (id: string) => void;
  reviewWordSrs: (id: string, rating: SrsRating) => void;
  recordSpellingResult: (id: string, correct: boolean) => void;

  // Folders & Trash
  createFolder: (name: string) => FolderItem | null;
  renameFolder: (id: string, name: string) => void;
  deleteFolderSoft: (id: string) => void;
  setWordFolders: (wordId: string, folderIds: string[]) => void;
  bulkAddWordsToFolder: (folderId: string, wordIds: string[]) => number;
  restoreTrashEntry: (index: number) => void;
  emptyTrash: () => void;

  // Streak, Goals, Quiz & Game
  recordActivity: () => void;
  recordQuizSession: (correct: number, total: number) => void;
  recordAirCombatGame: (score: number, wave: number, wpm: number, destroyed: number) => void;
  setDailyGoal: (goal: number) => void;
  resetLearningProgress: () => void;

  // YouTube Dictation
  addCustomLesson: (lesson: DictationLesson) => void;
  deleteCustomLesson: (lessonId: string) => void;
  updateLessonSegments: (lessonId: string, segments: DictationLesson['segments']) => void;
  markDictationSegmentComplete: (lessonId: string, segmentId: string, segmentIndex: number, accuracy: number) => void;
  setLessonLastIndex: (lessonId: string, segmentIndex: number) => void;

  // Import / Export / Sync
  exportBackup: () => WordNestBackupV1;
  importBackup: (raw: unknown, mode: 'merge' | 'replace') => { imported: number; skipped: number };
  updateCloudSync: (patch: Partial<CloudSyncConfig>) => void;
}

function normalizeImportedWord(raw: Partial<WordItem>): WordItem | null {
  const wordStr = (raw.word || '').trim();
  const meaningStr = (raw.meaning || '').trim();
  if (!wordStr || !meaningStr) return null;

  const validTypes: WordType[] = ['noun', 'verb', 'adj', 'adv', 'phrase', 'other'];
  const validLevels: WordLevel[] = ['easy', 'medium', 'hard'];
  const legacyFolderId = (raw as { folderId?: string | null }).folderId;
  const folderIds = Array.isArray(raw.folderIds)
    ? raw.folderIds.filter((x): x is string => typeof x === 'string')
    : legacyFolderId
      ? [legacyFolderId]
      : [];

  return {
    id: raw.id || genId('w'),
    word: wordStr,
    phonetic: raw.phonetic || '',
    meaning: meaningStr,
    example: raw.example || '',
    type: validTypes.includes(raw.type as WordType) ? (raw.type as WordType) : 'other',
    category: raw.category || 'Khác',
    level: validLevels.includes(raw.level as WordLevel) ? (raw.level as WordLevel) : 'medium',
    mastery: typeof raw.mastery === 'number' ? Math.max(0, Math.min(3, raw.mastery)) : 0,
    known: typeof raw.known === 'number' ? raw.known : 0,
    seen: typeof raw.seen === 'number' ? raw.seen : 0,
    folderIds,
    suspended: Boolean(raw.suspended),
    addedAt: raw.addedAt || localDateKey(),
    srsDue: raw.srsDue,
    srsInterval: raw.srsInterval,
    srsEase: raw.srsEase,
    srsReps: raw.srsReps,
    sourceVideoId: raw.sourceVideoId,
  };
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useWordNestStore = create<WordNestState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      activeDictationLessonId: null,
      theme: 'light',
      words: DEFAULT_WORDS,
      folders: [],
      trash: [],
      streak: { count: 0, lastDate: null, history: {}, freezes: 1, frozenDates: [] },
      quizStats: { totalGames: 0, totalQuestions: 0, totalCorrect: 0, bestScore: 0 },
      airCombatStats: { gamesPlayed: 0, bestScore: 0, bestWave: 0, bestWpm: 0, totalDestroyed: 0 },
      dailyGoal: 15,
      customLessons: [],
      dictationProgress: {},
      cloudSync: {
        enabled: false,
        autoSync: false,
        supabaseUrl: '',
        supabaseAnonKey: '',
        syncCode: '',
        lastSyncedAt: null,
      },
      toast: null,

      setActiveTab: (tab) => set({ activeTab: tab }),
      openDictationLesson: (lessonId) =>
        set({ activeDictationLessonId: lessonId, activeTab: 'dictation' }),

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
      },
      setTheme: (theme) => set({ theme }),

      showToast: (message, tone = 'default', undoAction) => {
        if (toastTimer) clearTimeout(toastTimer);
        const id = Date.now();
        set({ toast: { id, message, tone, undoAction } });
        toastTimer = setTimeout(() => {
          set((s) => (s.toast?.id === id ? { toast: null } : s));
        }, undoAction ? 5000 : 2800);
      },
      clearToast: () => set({ toast: null }),

      addWord: (input) => {
        const cleanWord = input.word.trim();
        const cleanMeaning = input.meaning.trim();
        if (!cleanWord || !cleanMeaning) {
          return { ok: false, error: 'Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt.' };
        }
        const exists = get().words.some(
          (w) => w.word.toLowerCase() === cleanWord.toLowerCase()
        );
        if (exists) {
          return { ok: false, error: `Từ "${cleanWord}" đã có trong kho của bạn.` };
        }
        const newWord: WordItem = {
          id: genId('w'),
          word: cleanWord,
          phonetic: input.phonetic?.trim() || '',
          meaning: cleanMeaning,
          example: input.example?.trim() || '',
          type: input.type || (cleanWord.includes(' ') ? 'phrase' : 'other'),
          category: input.category?.trim() || (input.sourceVideoId ? 'YouTube' : 'Khác'),
          level: input.level || 'medium',
          mastery: 0,
          known: 0,
          seen: 0,
          folderIds: input.folderIds || [],
          addedAt: localDateKey(),
          updatedAt: new Date().toISOString(),
          sourceVideoId: input.sourceVideoId,
        };
        set((s) => ({ words: [newWord, ...s.words] }));
        return { ok: true, word: newWord };
      },

      bulkAddWords: (items, folderId) => {
        const existingSet = new Set(get().words.map((w) => w.word.toLowerCase()));
        const toAdd: WordItem[] = [];
        let skipped = 0;

        for (const item of items) {
          const key = item.word.trim().toLowerCase();
          if (!key || existingSet.has(key)) {
            skipped++;
            continue;
          }
          existingSet.add(key);
          toAdd.push({
            id: genId('w'),
            word: item.word.trim(),
            phonetic: item.phonetic.trim(),
            meaning: item.meaning.trim(),
            example: item.example.trim(),
            type: item.type,
            category: 'Nhập nhanh',
            level: 'medium',
            mastery: 0,
            known: 0,
            seen: 0,
            folderIds: folderId ? [folderId] : [],
            addedAt: localDateKey(),
          });
        }

        if (toAdd.length) {
          set((s) => ({ words: [...toAdd, ...s.words] }));
        }
        return { added: toAdd.length, skipped };
      },

      importStarterPack: (packId) => {
        const pack = VOCAB_STARTER_PACKS.find((p) => p.id === packId);
        if (!pack) return { added: 0, skipped: 0, folderName: '' };

        let folder = get().folders.find(
          (f) => f.name.toLowerCase() === pack.folderName.toLowerCase()
        );
        if (!folder) {
          folder = get().createFolder(pack.folderName) || undefined;
        }
        const folderId = folder?.id;

        const existingSet = new Set(get().words.map((w) => w.word.toLowerCase()));
        const toAdd: WordItem[] = [];
        let skipped = 0;

        for (const item of pack.words) {
          const key = item.word.trim().toLowerCase();
          if (!key || existingSet.has(key)) {
            skipped++;
            continue;
          }
          existingSet.add(key);
          toAdd.push({
            id: genId('w'),
            word: item.word.trim(),
            phonetic: item.phonetic.trim(),
            meaning: item.meaning.trim(),
            example: item.example.trim(),
            type: item.type,
            category: pack.category,
            level: item.level,
            mastery: 0,
            known: 0,
            seen: 0,
            folderIds: folderId ? [folderId] : [],
            addedAt: localDateKey(),
          });
        }

        if (toAdd.length) {
          set((s) => ({ words: [...toAdd, ...s.words] }));
        }
        return { added: toAdd.length, skipped, folderName: pack.folderName };
      },

      updateWord: (id, patch) => {
        const nowIso = new Date().toISOString();
        set((s) => ({
          words: s.words.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: nowIso } : w)),
        }));
      },

      deleteWordSoft: (id) => {
        const prevWords = get().words;
        const target = prevWords.find((w) => w.id === id);
        if (!target) return;

        const entry: TrashEntry = {
          kind: 'word',
          deletedAt: new Date().toISOString(),
          data: target,
        };

        set((s) => ({
          words: s.words.filter((w) => w.id !== id),
          trash: [entry, ...s.trash],
        }));

        get().showToast(`Đã chuyển "${target.word}" vào thùng rác`, 'default', () => {
          set((s) => ({
            words: [target, ...s.words.filter((w) => w.id !== target.id)],
            trash: s.trash.filter((t) => !(t.kind === 'word' && (t.data as WordItem).id === target.id)),
          }));
        });
      },

      toggleSuspendWord: (id) => {
        const nowIso = new Date().toISOString();
        set((s) => ({
          words: s.words.map((w) =>
            w.id === id ? { ...w, suspended: !w.suspended, updatedAt: nowIso } : w
          ),
        }));
      },

      markWordSeen: (id) => {
        set((s) => ({
          words: s.words.map((w) => (w.id === id ? { ...w, seen: (w.seen || 0) + 1 } : w)),
        }));
      },

      reviewWordSrs: (id, rating) => {
        set((s) => ({
          words: s.words.map((w) => {
            if (w.id !== id) return w;
            const next = computeSrsNext(w, rating);
            return {
              ...w,
              srsDue: next.srsDue,
              srsInterval: next.srsInterval,
              srsEase: next.srsEase,
              srsReps: next.srsReps,
              srsLapses: rating === 'again' ? (w.srsLapses || 0) + 1 : w.srsLapses || 0,
              updatedAt: new Date().toISOString(),
              mastery: Math.max(0, Math.min(3, (w.mastery || 0) + next.masteryDelta)),
              known: rating !== 'again' ? (w.known || 0) + 1 : w.known || 0,
            };
          }),
        }));
        get().recordActivity();
      },

      recordSpellingResult: (id, correct) => {
        set((s) => ({
          words: s.words.map((w) => {
            if (w.id !== id) return w;
            return {
              ...w,
              mastery: Math.max(0, Math.min(3, (w.mastery || 0) + (correct ? 1 : -1))),
              known: correct ? (w.known || 0) + 1 : w.known || 0,
              seen: (w.seen || 0) + 1,
            };
          }),
        }));
        get().recordActivity();
      },

      createFolder: (name) => {
        const clean = name.trim();
        if (!clean) return null;
        const folder: FolderItem = {
          id: genId('f'),
          name: clean,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ folders: [...s.folders, folder] }));
        return folder;
      },

      renameFolder: (id, name) => {
        const clean = name.trim();
        if (!clean) return;
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name: clean } : f)),
        }));
      },

      deleteFolderSoft: (id) => {
        const folder = get().folders.find((f) => f.id === id);
        if (!folder) return;
        const affectedWordIds = get()
          .words.filter((w) => w.folderIds.includes(id))
          .map((w) => w.id);

        const entry: TrashEntry = {
          kind: 'folder',
          deletedAt: new Date().toISOString(),
          data: folder,
          wordIds: affectedWordIds,
        };

        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          words: s.words.map((w) => ({
            ...w,
            folderIds: w.folderIds.filter((fid) => fid !== id),
          })),
          trash: [entry, ...s.trash],
        }));

        get().showToast(`Đã xóa thư mục "${folder.name}"`, 'default', () => {
          set((s) => ({
            folders: [...s.folders, folder],
            words: s.words.map((w) =>
              affectedWordIds.includes(w.id) && !w.folderIds.includes(id)
                ? { ...w, folderIds: [...w.folderIds, id] }
                : w
            ),
            trash: s.trash.filter((t) => !(t.kind === 'folder' && (t.data as FolderItem).id === id)),
          }));
        });
      },

      setWordFolders: (wordId, folderIds) => {
        set((s) => ({
          words: s.words.map((w) => (w.id === wordId ? { ...w, folderIds } : w)),
        }));
      },

      bulkAddWordsToFolder: (folderId, wordIds) => {
        const targetSet = new Set(wordIds);
        let added = 0;
        set((s) => ({
          words: s.words.map((w) => {
            if (!targetSet.has(w.id) || w.folderIds.includes(folderId)) return w;
            added++;
            return { ...w, folderIds: [...w.folderIds, folderId] };
          }),
        }));
        return added;
      },

      restoreTrashEntry: (index) => {
        const entry = get().trash[index];
        if (!entry) return;
        if (entry.kind === 'word') {
          const w = normalizeImportedWord(entry.data as WordItem);
          if (w) {
            set((s) => ({
              words: [w, ...s.words.filter((x) => x.id !== w.id)],
              trash: s.trash.filter((_, i) => i !== index),
            }));
            get().showToast(`Đã khôi phục từ "${w.word}"`, 'success');
          }
        } else {
          const f = entry.data as FolderItem;
          const ids = entry.wordIds || [];
          set((s) => ({
            folders: [...s.folders.filter((x) => x.id !== f.id), f],
            words: s.words.map((w) =>
              ids.includes(w.id) && !w.folderIds.includes(f.id)
                ? { ...w, folderIds: [...w.folderIds, f.id] }
                : w
            ),
            trash: s.trash.filter((_, i) => i !== index),
          }));
          get().showToast(`Đã khôi phục thư mục "${f.name}"`, 'success');
        }
      },

      emptyTrash: () => set({ trash: [] }),

      recordActivity: () => {
        const today = localDateKey();
        const result = computeUpdatedStreak(get().streak, today);
        set({ streak: result.next });
        if (result.usedFreeze) {
          get().showToast(
            `Khiên đóng băng đã bảo vệ chuỗi ${result.next.count} ngày học của bạn!`,
            'success'
          );
        } else if (result.earnedFreeze) {
          get().showToast(
            `Mốc ${result.next.count} ngày liên tiếp! Bạn nhận thêm 1 Khiên Đóng Băng Streak!`,
            'success'
          );
        }
      },

      recordQuizSession: (correct, total) => {
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        set((s) => ({
          quizStats: {
            totalGames: s.quizStats.totalGames + 1,
            totalQuestions: s.quizStats.totalQuestions + total,
            totalCorrect: s.quizStats.totalCorrect + correct,
            bestScore: Math.max(s.quizStats.bestScore, score),
          },
        }));
        get().recordActivity();
      },

      recordAirCombatGame: (score, wave, wpm, destroyed) => {
        set((s) => ({
          airCombatStats: {
            gamesPlayed: s.airCombatStats.gamesPlayed + 1,
            bestScore: Math.max(s.airCombatStats.bestScore, score),
            bestWave: Math.max(s.airCombatStats.bestWave, wave),
            bestWpm: Math.max(s.airCombatStats.bestWpm, wpm),
            totalDestroyed: s.airCombatStats.totalDestroyed + destroyed,
          },
        }));
        if (destroyed > 0) get().recordActivity();
      },

      setDailyGoal: (goal) => set({ dailyGoal: Math.max(5, Math.min(100, Math.round(goal))) }),

      resetLearningProgress: () => {
        set((s) => ({
          words: s.words.map((w) => ({
            ...w,
            mastery: 0,
            known: 0,
            seen: 0,
            srsDue: undefined,
            srsInterval: undefined,
            srsEase: undefined,
            srsReps: undefined,
          })),
          streak: { count: 0, lastDate: null, history: {}, freezes: 1, frozenDates: [] },
          quizStats: { totalGames: 0, totalQuestions: 0, totalCorrect: 0, bestScore: 0 },
          dictationProgress: {},
        }));
        get().showToast('Đã đặt lại toàn bộ tiến độ học tập', 'success');
      },

      addCustomLesson: (lesson) => {
        set((s) => ({
          customLessons: [
            lesson,
            ...s.customLessons.filter((l) => l.youtubeId !== lesson.youtubeId),
          ],
        }));
      },

      deleteCustomLesson: (lessonId) => {
        set((s) => ({
          customLessons: s.customLessons.filter((l) => l.id !== lessonId),
          activeDictationLessonId:
            s.activeDictationLessonId === lessonId ? null : s.activeDictationLessonId,
        }));
      },

      updateLessonSegments: (lessonId, segments) => {
        set((s) => ({
          customLessons: s.customLessons.map((l) =>
            l.id === lessonId ? { ...l, segments } : l
          ),
        }));
      },

      markDictationSegmentComplete: (lessonId, segmentId, segmentIndex, accuracy) => {
        set((s) => {
          const prev = s.dictationProgress[lessonId] || {
            lessonId,
            completedSegmentIds: [],
            lastSegmentIndex: 0,
            lastPracticedAt: new Date().toISOString(),
            accuracySum: 0,
            attempts: 0,
          };
          const completed = prev.completedSegmentIds.includes(segmentId)
            ? prev.completedSegmentIds
            : [...prev.completedSegmentIds, segmentId];

          return {
            dictationProgress: {
              ...s.dictationProgress,
              [lessonId]: {
                ...prev,
                completedSegmentIds: completed,
                lastSegmentIndex: segmentIndex,
                lastPracticedAt: new Date().toISOString(),
                accuracySum: prev.accuracySum + accuracy,
                attempts: prev.attempts + 1,
              },
            },
          };
        });
        get().recordActivity();
      },

      setLessonLastIndex: (lessonId, segmentIndex) => {
        set((s) => {
          const prev = s.dictationProgress[lessonId] || {
            lessonId,
            completedSegmentIds: [],
            lastSegmentIndex: 0,
            lastPracticedAt: new Date().toISOString(),
            accuracySum: 0,
            attempts: 0,
          };
          return {
            dictationProgress: {
              ...s.dictationProgress,
              [lessonId]: {
                ...prev,
                lastSegmentIndex: segmentIndex,
                lastPracticedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      exportBackup: () => {
        const s = get();
        return {
          version: '2.0.1',
          exportedAt: new Date().toISOString(),
          words: s.words,
          folders: s.folders,
          trash: s.trash,
          streak: s.streak,
          quizStats: s.quizStats,
          airCombatStats: s.airCombatStats,
          dailyGoal: s.dailyGoal,
          customLessons: s.customLessons,
          dictationProgress: s.dictationProgress,
        };
      },

      importBackup: (raw, mode) => {
        let rawWords: Partial<WordItem>[] = [];
        let incomingFolders: FolderItem[] | undefined;
        let incomingStreak: StreakData | undefined;
        let incomingQuizStats: QuizStats | undefined;
        let incomingAirCombatStats: AirCombatStats | undefined;
        let incomingDailyGoal: number | undefined;
        let incomingCustomLessons: DictationLesson[] | undefined;
        let incomingDictationProgress: Record<string, DictationLessonProgress> | undefined;

        if (Array.isArray(raw)) {
          rawWords = raw;
        } else if (raw && typeof raw === 'object') {
          const obj = raw as WordNestBackupV1;
          if (Array.isArray(obj.words)) rawWords = obj.words;
          if (Array.isArray(obj.folders)) incomingFolders = obj.folders;
          if (obj.streak && typeof obj.streak === 'object') incomingStreak = obj.streak;
          if (obj.quizStats && typeof obj.quizStats === 'object') incomingQuizStats = obj.quizStats;
          if (obj.airCombatStats && typeof obj.airCombatStats === 'object') {
            incomingAirCombatStats = obj.airCombatStats;
          }
          if (typeof obj.dailyGoal === 'number' && Number.isFinite(obj.dailyGoal)) {
            incomingDailyGoal = Math.max(5, Math.min(200, Math.round(obj.dailyGoal)));
          }
          if (Array.isArray(obj.customLessons)) incomingCustomLessons = obj.customLessons;
          if (obj.dictationProgress && typeof obj.dictationProgress === 'object') {
            incomingDictationProgress = obj.dictationProgress;
          }
        }

        const normalized = rawWords
          .map(normalizeImportedWord)
          .filter((x): x is WordItem => Boolean(x));

        if (mode === 'replace') {
          set((s) => ({
            words: normalized,
            folders: incomingFolders ?? s.folders,
            streak: incomingStreak ?? s.streak,
            quizStats: incomingQuizStats ?? s.quizStats,
            airCombatStats: incomingAirCombatStats ?? s.airCombatStats,
            dailyGoal: incomingDailyGoal ?? s.dailyGoal,
            customLessons: incomingCustomLessons ?? s.customLessons,
            dictationProgress: incomingDictationProgress ?? s.dictationProgress,
          }));
          return { imported: normalized.length, skipped: rawWords.length - normalized.length };
        }

        const existingMap = new Set(get().words.map((w) => w.word.toLowerCase()));
        const toAdd: WordItem[] = [];
        let skipped = 0;

        for (const w of normalized) {
          if (existingMap.has(w.word.toLowerCase())) {
            skipped++;
            continue;
          }
          existingMap.add(w.word.toLowerCase());
          toAdd.push(w);
        }

        set((s) => ({
          words: [...toAdd, ...s.words],
          folders: incomingFolders
            ? [
                ...s.folders,
                ...incomingFolders.filter((f) => !s.folders.some((ef) => ef.id === f.id)),
              ]
            : s.folders,
          airCombatStats: incomingAirCombatStats
            ? {
                gamesPlayed: Math.max(s.airCombatStats.gamesPlayed, incomingAirCombatStats.gamesPlayed),
                bestScore: Math.max(s.airCombatStats.bestScore, incomingAirCombatStats.bestScore),
                bestWave: Math.max(s.airCombatStats.bestWave, incomingAirCombatStats.bestWave),
                bestWpm: Math.max(s.airCombatStats.bestWpm, incomingAirCombatStats.bestWpm),
                totalDestroyed: Math.max(
                  s.airCombatStats.totalDestroyed,
                  incomingAirCombatStats.totalDestroyed
                ),
              }
            : s.airCombatStats,
          dailyGoal: incomingDailyGoal ?? s.dailyGoal,
          customLessons: incomingCustomLessons
            ? [
                ...s.customLessons,
                ...incomingCustomLessons.filter(
                  (l) => !s.customLessons.some((el) => el.youtubeId === l.youtubeId)
                ),
              ]
            : s.customLessons,
          dictationProgress: incomingDictationProgress
            ? { ...s.dictationProgress, ...incomingDictationProgress }
            : s.dictationProgress,
        }));

        return { imported: toAdd.length, skipped };
      },

      updateCloudSync: (patch) => {
        set((s) => ({ cloudSync: { ...s.cloudSync, ...patch } }));
      },
    }),
    {
      name: 'wordnest-v2-storage',
      storage: createJSONStorage(() => wordNestStateStorage),
      partialize: (state) => ({
        theme: state.theme,
        words: state.words,
        folders: state.folders,
        trash: state.trash,
        streak: state.streak,
        quizStats: state.quizStats,
        airCombatStats: state.airCombatStats,
        dailyGoal: state.dailyGoal,
        customLessons: state.customLessons,
        dictationProgress: state.dictationProgress,
        cloudSync: state.cloudSync,
      }),
    }
  )
);
