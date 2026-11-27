'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Headphones,
  RotateCcw,
  Shuffle,
  Volume2,
} from 'lucide-react';
import { maskWordInExample } from '@/lib/dictation-engine';
import {
  buildFlashcardSessionIds,
  computeSrsNext,
  daysUntilDue,
  FlashcardModeFilter,
  formatIntervalPreview,
  getWordRetrievability,
  isLeechWord,
  requeueForgottenCard,
  resolveFsrsState,
} from '@/lib/srs';
import { playChime, speakEnglish, vibrateLight } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { SrsRating, WordItem } from '@/types/wordnest';

const TYPE_VI: Record<string, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adj: 'Tính từ',
  adv: 'Trạng từ',
  phrase: 'Cụm từ',
  other: 'Khác',
};

export function FlashcardView() {
  const words = useWordNestStore((s) => s.words);
  const folders = useWordNestStore((s) => s.folders);
  const markWordSeen = useWordNestStore((s) => s.markWordSeen);
  const reviewWordSrs = useWordNestStore((s) => s.reviewWordSrs);
  const showToast = useWordNestStore((s) => s.showToast);

  const [modeFilter, setModeFilter] = useState<FlashcardModeFilter>('all');
  const [studyDir, setStudyDir] = useState<'en-vi' | 'vi-en' | 'audio'>('en-vi');
  const [folderFilter, setFolderFilter] = useState('all');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>(() =>
    buildFlashcardSessionIds(words, 'all', 'all', 0)
  );
  const [relearnCount, setRelearnCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const wordsById = useMemo(() => {
    const map = new Map<string, WordItem>();
    for (const w of words) {
      if (!w.suspended) map.set(w.id, w);
    }
    return map;
  }, [words]);

  // Resolve frozen session queue against live word records (never shrinks when srsDue updates!)
  const deck = useMemo(
    () =>
      sessionIds
        .map((id) => wordsById.get(id))
        .filter((w): w is WordItem => Boolean(w)),
    [sessionIds, wordsById]
  );

  const startSession = useCallback(
    (nextMode: FlashcardModeFilter, nextFolder: string, nextSeed: number) => {
      setSessionIds(buildFlashcardSessionIds(words, nextMode, nextFolder, nextSeed));
      setIndex(0);
      setFlipped(false);
      setRelearnCount(0);
      setReviewedCount(0);
      setSessionDone(false);
    },
    [words]
  );

  const safeIndex = deck.length > 0 ? Math.min(index, deck.length - 1) : 0;
  const current: WordItem | undefined = sessionDone ? undefined : deck[safeIndex];

  useEffect(() => {
    if (current) {
      markWordSeen(current.id);
      if (studyDir === 'audio') {
        const timer = setTimeout(() => speakEnglish(current.word), 180);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, safeIndex, studyDir]);

  const handleRate = useCallback(
    (rating: SrsRating) => {
      if (!current) return;
      reviewWordSrs(current.id, rating);
      vibrateLight(14);
      playChime(rating === 'again' ? 'error' : 'success');
      setReviewedCount((c) => c + 1);

      let nextQueueLength = deck.length;
      if (rating === 'again') {
        // Anki-style intra-session relearning: re-insert forgotten card a few cards ahead
        setSessionIds((prev) => requeueForgottenCard(prev, safeIndex, 3));
        setRelearnCount((c) => c + 1);
        nextQueueLength = deck.length + 1;
        showToast('Sẽ lặp lại thẻ này trong phiên để bạn nhớ chắc hơn!', 'default');
      }

      setFlipped(false);
      if (safeIndex < nextQueueLength - 1) {
        setTimeout(() => setIndex((i) => i + 1), 120);
      } else {
        setSessionDone(true);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        showToast('Tuyệt vời! Bạn đã ôn hết bộ thẻ này!', 'success');
      }
    },
    [current, reviewWordSrs, safeIndex, deck.length, showToast]
  );

  const handleSwipeEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!flipped) return;
    if (info.offset.x > 85) {
      handleRate('good');
    } else if (info.offset.x < -85) {
      handleRate('again');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (sessionDone) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft' && safeIndex > 0) {
        setFlipped(false);
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight' && safeIndex < deck.length - 1) {
        setFlipped(false);
        setIndex((i) => Math.min(deck.length - 1, i + 1));
      } else if (e.key.toLowerCase() === 's' && current) {
        speakEnglish(current.word);
      } else if (flipped) {
        if (e.key === '1') handleRate('again');
        if (e.key === '2') handleRate('hard');
        if (e.key === '3') handleRate('good');
        if (e.key === '4') handleRate('easy');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safeIndex, deck.length, current, flipped, sessionDone, handleRate]);

  const srsLabel = useMemo(() => {
    if (!current) return '';
    const diff = daysUntilDue(current.srsDue);
    if (diff === null) return 'Chưa lên lịch ôn';
    if (diff <= 0) return 'Đến hạn ôn hôm nay';
    if (diff === 1) return 'Ôn lại vào ngày mai';
    return `Ôn lại sau ${diff} ngày`;
  }, [current]);

  const previews = useMemo(() => {
    if (!current) return null;
    return {
      again: 'Lặp lại ngay',
      hard: formatIntervalPreview(computeSrsNext(current, 'hard').srsInterval),
      good: formatIntervalPreview(computeSrsNext(current, 'good').srsInterval),
      easy: formatIntervalPreview(computeSrsNext(current, 'easy').srsInterval),
    };
  }, [current]);

  const pct =
    deck.length > 0
      ? sessionDone
        ? 100
        : Math.round(((safeIndex + 1) / deck.length) * 100)
      : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Flashcard SRS</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
          Chạm thẻ để lật · Vuốt phải (Nhớ) / Vuốt trái (Quên) hoặc chấm 4 mức FSRS v5 chuẩn Anki.
        </p>
      </div>

      {/* Auto-applying Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: 'Tất cả' },
            { id: 'srs', label: 'Đến hạn SRS' },
            { id: 'new', label: 'Từ mới' },
            { id: 'review', label: 'Đang học' },
          ] as const
        ).map((tab) => {
          const active = modeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setModeFilter(tab.id);
                startSession(tab.id, folderFilter, shuffleSeed);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'var(--card)',
                borderColor: active ? 'var(--accent)' : 'var(--border)',
                color: active ? '#fff' : 'var(--text2)',
              }}
            >
              {tab.label}
            </button>
          );
        })}

        {folders.length > 0 && (
          <select
            value={folderFilter}
            onChange={(e) => {
              const nextFolder = e.target.value;
              setFolderFilter(nextFolder);
              startSession(modeFilter, nextFolder, shuffleSeed);
            }}
            className="px-3 py-1.5 rounded-full text-xs border outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
          >
            <option value="all">Tất cả thư mục</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextSeed = shuffleSeed + 1;
              setShuffleSeed(nextSeed);
              startSession(modeFilter, folderFilter, nextSeed);
              showToast('Đã xáo trộn bộ thẻ!');
            }}
            className="p-2 rounded-xl border cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            title="Xáo trộn"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => startSession(modeFilter, folderFilter, shuffleSeed)}
            className="p-2 rounded-xl border cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            title="Học lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Study Direction Mode Switcher (Anh->Việt, Việt->Anh, Chỉ nghe âm thanh) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: 'en-vi', label: 'Anh → Việt', icon: ArrowLeftRight },
            { id: 'vi-en', label: 'Việt → Anh (Chủ động)', icon: ArrowLeftRight },
            { id: 'audio', label: 'Chỉ nghe (Luyện tai)', icon: Headphones },
          ] as const
        ).map((dir) => {
          const Icon = dir.icon;
          const active = studyDir === dir.id;
          return (
            <button
              key={dir.id}
              type="button"
              onClick={() => {
                setStudyDir(dir.id);
                setFlipped(false);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              style={{
                backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)',
                borderColor: active ? 'var(--accent)' : 'var(--border)',
                color: active ? 'var(--accent)' : 'var(--text2)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {dir.label}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg3)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: sessionDone ? 'var(--green)' : 'var(--accent)',
            }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text3)' }}>
          {deck.length ? `${sessionDone ? deck.length : safeIndex + 1} / ${deck.length}` : '0 / 0'}
          {relearnCount > 0 ? ` · +${relearnCount} ôn lại` : ''}
        </span>
      </div>

      {/* 3D Interactive Flashcard */}
      {sessionDone ? (
        <div className="bg-warm-card rounded-3xl p-10 text-center space-y-3">
          <p className="font-serif-display text-2xl font-semibold" style={{ color: 'var(--green)' }}>
            Hoàn thành phiên ôn tập!
          </p>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            Bạn đã ôn xong <strong>{reviewedCount}</strong> lượt thẻ
            {relearnCount > 0 ? ` (gồm ${relearnCount} thẻ được lặp lại để nhớ sâu hơn)` : ''}.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => startSession(modeFilter, folderFilter, shuffleSeed)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Kiểm tra thẻ đến hạn mới
            </button>
            {modeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setModeFilter('all');
                  startSession('all', folderFilter, shuffleSeed);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text2)',
                }}
              >
                Xem tất cả từ
              </button>
            )}
          </div>
        </div>
      ) : !current ? (
        <div className="bg-warm-card rounded-3xl p-12 text-center space-y-2">
          <p className="font-serif-display text-lg font-medium">Không có thẻ nào trong bộ lọc này</p>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>
            Thử chuyển sang &ldquo;Tất cả&rdquo; hoặc thêm từ mới từ video YouTube!
          </p>
        </div>
      ) : (
        <motion.div
          key={`${current.id}-${safeIndex}`}
          drag={flipped ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.22}
          onDragEnd={handleSwipeEnd}
          className="perspective-1200 cursor-pointer select-none"
          onClick={() => setFlipped((f) => !f)}
        >
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full min-h-[300px] sm:min-h-[320px] preserve-3d"
          >
            {/* FRONT FACE */}
            <div
              className="absolute inset-0 backface-hidden rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center border"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {isLeechWord(current) && (
                <span
                  className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: 'var(--gold-soft)',
                    borderColor: 'var(--border2)',
                    color: 'var(--gold)',
                  }}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Từ hay quên · Hãy đặt câu gần gũi với bạn
                </span>
              )}

              <span
                className="text-[11px] uppercase tracking-widest font-semibold mb-4"
                style={{ color: 'var(--text3)' }}
              >
                {studyDir === 'vi-en'
                  ? 'Nhớ từ tiếng Anh · Chạm để kiểm tra'
                  : studyDir === 'audio'
                    ? 'Nghe phát âm & đoán từ · Chạm để lật'
                    : 'Chạm để xem nghĩa'}
              </span>

              {studyDir === 'vi-en' ? (
                <>
                  <h2 className="font-serif-display text-2xl sm:text-4xl font-semibold leading-snug max-w-md break-words">
                    {current.meaning}
                  </h2>
                  {current.example && (
                    <p className="text-sm italic mt-3 max-w-md" style={{ color: 'var(--text2)' }}>
                      &ldquo;{maskWordInExample(current.example, current.word)}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-4">
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full border"
                      style={{
                        backgroundColor: 'var(--bg2)',
                        borderColor: 'var(--border)',
                        color: 'var(--accent)',
                      }}
                    >
                      {TYPE_VI[current.type] || 'Khác'}
                    </span>
                  </div>
                </>
              ) : studyDir === 'audio' ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakEnglish(current.word);
                    }}
                    className="w-20 h-20 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                    aria-label="Nghe phát âm từ"
                  >
                    <Volume2 className="w-9 h-9" />
                  </button>
                  <p className="text-xs mt-4" style={{ color: 'var(--text3)' }}>
                    Bấm loa (hoặc phím S) để nghe lại · Loại từ: {TYPE_VI[current.type] || 'Khác'}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-serif-display text-3xl sm:text-5xl font-semibold break-words max-w-full">
                    {current.word}
                  </h2>

                  {current.phonetic && (
                    <p className="text-base italic mt-2" style={{ color: 'var(--text3)' }}>
                      {current.phonetic}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full border"
                      style={{
                        backgroundColor: 'var(--bg2)',
                        borderColor: 'var(--border)',
                        color: 'var(--accent)',
                      }}
                    >
                      {TYPE_VI[current.type] || 'Khác'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakEnglish(current.word);
                      }}
                      className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors hover:opacity-80 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--border)',
                        color: 'var(--accent)',
                      }}
                      aria-label="Phát âm từ"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* BACK FACE */}
            <div
              className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center border"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <span
                className="text-xs font-medium px-3 py-1 rounded-full border mb-3"
                style={{
                  backgroundColor: 'var(--bg2)',
                  borderColor: 'var(--border)',
                  color: 'var(--accent)',
                }}
              >
                {TYPE_VI[current.type] || 'Khác'}
              </span>

              {studyDir !== 'en-vi' && (
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="font-serif-display text-2xl sm:text-4xl font-semibold">
                    {current.word}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakEnglish(current.word);
                    }}
                    className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--border)',
                      color: 'var(--accent)',
                    }}
                    aria-label="Phát âm từ"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {studyDir !== 'en-vi' && current.phonetic && (
                <p className="text-sm italic mb-2" style={{ color: 'var(--text3)' }}>
                  {current.phonetic}
                </p>
              )}

              <p
                className={`${
                  studyDir === 'en-vi' ? 'text-xl sm:text-2xl font-semibold' : 'text-base font-medium'
                } leading-snug max-w-md`}
                style={{ color: studyDir === 'en-vi' ? 'var(--text)' : 'var(--text2)' }}
              >
                {current.meaning}
              </p>

              {current.example && (
                <div className="mt-4 flex items-center justify-center gap-2 max-w-md">
                  <p className="text-sm italic" style={{ color: 'var(--text2)' }}>
                    &ldquo;{current.example}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakEnglish(current.example);
                    }}
                    className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg2)',
                      borderColor: 'var(--border)',
                      color: 'var(--accent)',
                    }}
                    title="Nghe câu ví dụ"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div
                className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs"
                style={{ color: 'var(--text3)' }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {srsLabel}
                </span>
                {(() => {
                  const ret = getWordRetrievability(current);
                  const fsrs = resolveFsrsState(current);
                  if (ret === null || fsrs.isNew) {
                    return (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: 'var(--bg2)', color: 'var(--accent)' }}
                      >
                        FSRS v5 · Thẻ mới
                      </span>
                    );
                  }
                  return (
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums"
                      style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
                      title="Thuật toán FSRS v5: Xác suất nhớ hiện tại và Độ bền trí nhớ (Stability)"
                    >
                      FSRS · Nhớ {Math.round(ret * 100)}% · S={fsrs.stability.toFixed(1)}d
                    </span>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 4-Level Anki SM-2 Rating Row (appears when flipped) */}
      {current && flipped && previews ? (
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { rating: 'again', label: 'Quên', hint: previews.again, bg: 'var(--red-soft)', bdr: 'var(--red-border)', color: 'var(--red)' },
              { rating: 'hard', label: 'Khó', hint: previews.hard, bg: 'var(--gold-soft)', bdr: 'var(--border2)', color: 'var(--gold)' },
              { rating: 'good', label: 'Tốt', hint: previews.good, bg: 'var(--green-soft)', bdr: 'var(--green-border)', color: 'var(--green)' },
              { rating: 'easy', label: 'Dễ', hint: previews.easy, bg: 'var(--blue-soft)', bdr: 'var(--border2)', color: 'var(--blue)' },
            ] as const
          ).map((btn) => (
            <button
              key={btn.rating}
              type="button"
              onClick={() => handleRate(btn.rating)}
              className="py-2.5 px-2 rounded-2xl border flex flex-col items-center justify-center transition-transform active:scale-95 cursor-pointer"
              style={{
                backgroundColor: btn.bg,
                borderColor: btn.bdr,
                color: btn.color,
              }}
            >
              <span className="text-xs sm:text-sm font-semibold">{btn.label}</span>
              <span className="text-[11px] opacity-80 mt-0.5">{btn.hint}</span>
            </button>
          ))}
        </div>
      ) : !sessionDone && current ? (
        /* Prev / Next Navigation */
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => {
              setFlipped(false);
              setIndex((i) => Math.max(0, i - 1));
            }}
            className="w-11 h-11 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            aria-label="Thẻ trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            Phím Space để lật · S để phát âm
          </span>
          <button
            type="button"
            disabled={safeIndex >= deck.length - 1}
            onClick={() => {
              setFlipped(false);
              setIndex((i) => Math.min(deck.length - 1, i + 1));
            }}
            className="w-11 h-11 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            aria-label="Thẻ sau"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
