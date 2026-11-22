'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shuffle,
  Volume2,
} from 'lucide-react';
import { computeSrsNext, daysUntilDue, formatIntervalPreview, isSrsDue } from '@/lib/srs';
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

  const [modeFilter, setModeFilter] = useState<'all' | 'srs' | 'new' | 'review'>('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const deck = useMemo(() => {
    let pool = words.filter((w) => !w.suspended);
    if (modeFilter === 'srs') pool = pool.filter(isSrsDue);
    else if (modeFilter === 'new') pool = pool.filter((w) => w.mastery === 0);
    else if (modeFilter === 'review') pool = pool.filter((w) => w.mastery > 0 && w.mastery < 3);

    if (folderFilter !== 'all') {
      pool = pool.filter((w) => w.folderIds.includes(folderFilter));
    }

    const list = [...pool];
    if (shuffleSeed > 0) {
      let s = shuffleSeed * 9301 + 49297;
      for (let i = list.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    return list;
  }, [words, modeFilter, folderFilter, shuffleSeed]);

  const resetDeckPos = () => {
    setIndex(0);
    setFlipped(false);
  };

  const current: WordItem | undefined = deck[index];

  useEffect(() => {
    if (current) {
      markWordSeen(current.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const handleRate = useCallback(
    (rating: SrsRating) => {
      if (!current) return;
      reviewWordSrs(current.id, rating);
      vibrateLight(14);
      playChime(rating === 'again' ? 'error' : 'success');

      setFlipped(false);
      if (index < deck.length - 1) {
        setTimeout(() => setIndex((i) => i + 1), 120);
      } else {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        showToast('Tuyệt vời! Bạn đã ôn hết bộ thẻ này!', 'success');
      }
    },
    [current, reviewWordSrs, index, deck.length, showToast]
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
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft' && index > 0) {
        setFlipped(false);
        setIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' && index < deck.length - 1) {
        setFlipped(false);
        setIndex((i) => i + 1);
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
  }, [index, deck.length, current, flipped, handleRate]);

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
      again: formatIntervalPreview(computeSrsNext(current, 'again').srsInterval),
      hard: formatIntervalPreview(computeSrsNext(current, 'hard').srsInterval),
      good: formatIntervalPreview(computeSrsNext(current, 'good').srsInterval),
      easy: formatIntervalPreview(computeSrsNext(current, 'easy').srsInterval),
    };
  }, [current]);

  const pct = deck.length > 0 ? Math.round(((index + 1) / deck.length) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Flashcard SRS</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
          Chạm thẻ để lật · Vuốt phải (Nhớ) / Vuốt trái (Quên) hoặc chấm 4 mức SM-2 chuẩn Anki.
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
                resetDeckPos();
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
              setFolderFilter(e.target.value);
              resetDeckPos();
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
              setShuffleSeed((s) => s + 1);
              resetDeckPos();
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
            onClick={() => {
              setIndex(0);
              setFlipped(false);
            }}
            className="p-2 rounded-xl border cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            title="Học lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg3)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text3)' }}>
          {deck.length ? `${index + 1} / ${deck.length}` : '0 / 0'}
        </span>
      </div>

      {/* 3D Interactive Flashcard */}
      {!current ? (
        <div className="bg-warm-card rounded-3xl p-12 text-center space-y-2">
          <p className="font-serif-display text-lg font-medium">Không có thẻ nào trong bộ lọc này</p>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>
            Thử chuyển sang &ldquo;Tất cả&rdquo; hoặc thêm từ mới từ video YouTube!
          </p>
        </div>
      ) : (
        <motion.div
          key={current.id}
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
              <span
                className="text-[11px] uppercase tracking-widest font-semibold mb-4"
                style={{ color: 'var(--text3)' }}
              >
                Chạm để xem nghĩa
              </span>

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

              <p className="text-xl sm:text-2xl font-semibold leading-snug max-w-md">
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
                className="mt-5 inline-flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--text3)' }}
              >
                <Calendar className="w-3.5 h-3.5" />
                {srsLabel}
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
      ) : (
        /* Prev / Next Navigation */
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={index === 0}
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
            disabled={index >= deck.length - 1}
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
      )}
    </div>
  );
}
