'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  Flame,
  Lightbulb,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { maskWordInExample } from '@/lib/dictation-engine';
import { playChime, speakEnglish, vibrateLight } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';

export function SpellingView() {
  const words = useWordNestStore((s) => s.words);
  const folders = useWordNestStore((s) => s.folders);
  const recordSpellingResult = useWordNestStore((s) => s.recordSpellingResult);
  const showToast = useWordNestStore((s) => s.showToast);

  const [level, setLevel] = useState('all');
  const [folderId, setFolderId] = useState('all');
  const [seed, setSeed] = useState(0);

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hintLevel, setHintLevel] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [streak, setStreak] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const pool = useMemo(() => {
    let list = words.filter((w) => !w.suspended);
    if (level === 'weak') list = list.filter((w) => w.mastery < 2);
    else if (level !== 'all') list = list.filter((w) => w.level === level);
    if (folderId !== 'all') list = list.filter((w) => w.folderIds.includes(folderId));
    if (!list.length) list = words.filter((w) => !w.suspended);

    const copy = [...list];
    let s = (seed + 1) * 48271;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 48271) % 2147483647;
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [words, level, folderId, seed]);

  const resetSpellingState = () => {
    setIndex(0);
    setTyped('');
    setStatus('idle');
    setHintLevel(0);
    setCorrectCount(0);
    setWrongCount(0);
    setStreak(0);
  };

  const current = pool[index];

  const maskedExample = useMemo(() => {
    if (!current?.example) return '';
    return status === 'idle'
      ? maskWordInExample(current.example, current.word)
      : current.example;
  }, [current, status]);

  const handleCheck = () => {
    if (!current || status !== 'idle') return;
    const clean = typed.trim();
    if (!clean) {
      showToast('Hãy gõ từ tiếng Anh trước khi kiểm tra!', 'default');
      return;
    }

    const isRight = clean.toLowerCase() === current.word.toLowerCase();
    setStatus(isRight ? 'correct' : 'wrong');
    recordSpellingResult(current.id, isRight);

    if (isRight) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => s + 1);
      playChime('success');
      vibrateLight(14);
    } else {
      setWrongCount((w) => w + 1);
      setStreak(0);
      playChime('error');
      vibrateLight([25, 30, 25]);
    }
  };

  const handleReveal = () => {
    if (!current || status !== 'idle') return;
    setTyped(current.word);
    setStatus('wrong');
    setWrongCount((w) => w + 1);
    setStreak(0);
    recordSpellingResult(current.id, false);
  };

  const handleHint = () => {
    if (!current || status !== 'idle') return;
    const nextLen = Math.min(current.word.length, hintLevel + 1);
    setHintLevel(nextLen);
    setTyped(current.word.slice(0, nextLen));
    inputRef.current?.focus();
  };

  const handleNext = () => {
    if (index < pool.length - 1) {
      setIndex((i) => i + 1);
    } else {
      showToast('Đã hoàn thành hết danh sách từ! Bắt đầu vòng mới!', 'success');
      setSeed((s) => s + 1);
      resetSpellingState();
      setTimeout(() => inputRef.current?.focus(), 60);
      return;
    }
    setTyped('');
    setStatus('idle');
    setHintLevel(0);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header with dedicated Restart button (separated from stat cards!) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Luyện Chính Tả</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
            Nghe phát âm hoặc đọc gợi ý — từ trong câu ví dụ đã được tự động che kín.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSeed((s) => s + 1);
            resetSpellingState();
          }}
          className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Làm lại
        </button>
      </div>

      {/* Filters (auto-apply immediately) */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            resetSpellingState();
          }}
          className="px-3 py-1.5 rounded-full text-xs border outline-none cursor-pointer"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
        >
          <option value="all">Tất cả mức độ</option>
          <option value="easy">Dễ (A1–A2)</option>
          <option value="medium">Trung bình (B1–B2)</option>
          <option value="hard">Khó (C1–C2)</option>
          <option value="weak">Từ chưa thuộc</option>
        </select>

        {folders.length > 0 && (
          <select
            value={folderId}
            onChange={(e) => {
              setFolderId(e.target.value);
              resetSpellingState();
            }}
            className="px-3 py-1.5 rounded-full text-xs border outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <option value="all">Tất cả thư mục</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Clean 3-Stat Display Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-warm-card rounded-2xl p-3.5 text-center">
          <div className="text-xl font-serif-display font-semibold tabular-nums" style={{ color: 'var(--green)' }}>
            {correctCount}
          </div>
          <div className="text-xs flex items-center justify-center gap-1 mt-0.5" style={{ color: 'var(--text3)' }}>
            <Check className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} /> Đúng
          </div>
        </div>
        <div className="bg-warm-card rounded-2xl p-3.5 text-center">
          <div className="text-xl font-serif-display font-semibold tabular-nums" style={{ color: 'var(--red)' }}>
            {wrongCount}
          </div>
          <div className="text-xs flex items-center justify-center gap-1 mt-0.5" style={{ color: 'var(--text3)' }}>
            <X className="w-3.5 h-3.5" style={{ color: 'var(--red)' }} /> Sai
          </div>
        </div>
        <div className="bg-warm-card rounded-2xl p-3.5 text-center">
          <div className="text-xl font-serif-display font-semibold tabular-nums" style={{ color: 'var(--gold)' }}>
            {streak}
          </div>
          <div className="text-xs flex items-center justify-center gap-1 mt-0.5" style={{ color: 'var(--text3)' }}>
            <Flame className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} /> Chuỗi
          </div>
        </div>
      </div>

      {!current ? (
        <div className="bg-warm-card rounded-2xl p-10 text-center">
          <p className="text-sm font-medium">Chưa có từ nào để luyện chính tả!</p>
        </div>
      ) : (
        <div className="bg-warm-card rounded-3xl p-5 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-xl sm:text-2xl font-semibold">{current.meaning}</p>
            {current.phonetic && (
              <p className="text-sm italic" style={{ color: 'var(--text3)' }}>
                {current.phonetic}
              </p>
            )}
            {maskedExample && (
              <p className="text-sm italic max-w-md mx-auto pt-1" style={{ color: 'var(--text2)' }}>
                &ldquo;{maskedExample}&rdquo;
              </p>
            )}
          </div>

          {/* Unified Inline Letter-by-Letter Typing Surface (click directly on underlines to type!) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (status === 'idle') handleCheck();
              else handleNext();
            }}
            className="space-y-4"
          >
            <div
              onClick={() => inputRef.current?.focus()}
              className="relative rounded-2xl px-4 py-5 border-2 cursor-text transition-colors space-y-2.5"
              style={{
                backgroundColor:
                  status === 'correct'
                    ? 'var(--green-soft)'
                    : status === 'wrong'
                      ? 'var(--red-soft)'
                      : inputFocused
                        ? 'var(--card)'
                        : 'var(--bg)',
                borderColor:
                  status === 'correct'
                    ? 'var(--green)'
                    : status === 'wrong'
                      ? 'var(--red)'
                      : inputFocused
                        ? 'var(--accent)'
                        : 'var(--border)',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={typed}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onChange={(e) => status === 'idle' && setTyped(e.target.value)}
                aria-label="Gõ từ tiếng Anh trực tiếp lên gạch"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              />

              <div className="flex flex-wrap justify-center gap-1.5">
                {current.word.split('').map((targetChar, i) => {
                  if (targetChar === ' ') {
                    return <div key={i} className="w-4" />;
                  }
                  const userChar = typed[i] || '';
                  const matches = userChar.toLowerCase() === targetChar.toLowerCase();
                  const isActiveChar =
                    status === 'idle' && inputFocused && i === typed.length;
                  let bdr = isActiveChar ? 'var(--accent)' : 'var(--border2)';
                  let color = 'var(--accent)';
                  if (userChar) {
                    bdr = matches ? 'var(--green)' : 'var(--red)';
                    color = matches ? 'var(--green)' : 'var(--red)';
                  }
                  return (
                    <div
                      key={i}
                      className="w-8 sm:w-9 h-11 border-b-2 rounded-t-md flex items-center justify-center font-serif-display text-xl font-semibold leading-none transition-colors"
                      style={{
                        borderColor: bdr,
                        color,
                        backgroundColor: isActiveChar ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      {userChar || (isActiveChar ? <span className="wn-caret" aria-hidden="true" /> : null)}
                    </div>
                  );
                })}
                {typed.length > current.word.length && (
                  <div
                    className="h-11 px-1.5 border-b-2 flex items-center justify-center font-serif-display text-xl font-semibold leading-none"
                    style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                  >
                    {typed.slice(current.word.length)}
                  </div>
                )}
              </div>

              <p className="text-center text-[11px]" style={{ color: 'var(--text3)' }}>
                {status !== 'idle'
                  ? 'Nhấn Enter để sang từ tiếp theo'
                  : inputFocused
                    ? 'Đang gõ trực tiếp · Nhấn Enter để kiểm tra'
                    : 'Bấm vào dòng gạch để gõ từ tiếng Anh...'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={status !== 'idle'}
                onClick={handleHint}
                className="py-2.5 px-3 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                <Lightbulb className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
                Gợi ý
              </button>

              <button
                type="button"
                onClick={() => speakEnglish(current.word)}
                className="py-2.5 px-3 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                Phát âm
              </button>

              <button
                type="button"
                disabled={status !== 'idle'}
                onClick={handleReveal}
                className="py-2.5 px-3 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                <Eye className="w-3.5 h-3.5" />
                Hiện từ
              </button>

              <button
                type="submit"
                className="py-2.5 px-3 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: status === 'idle' ? 'var(--accent)' : 'var(--green)' }}
              >
                {status === 'idle' ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Kiểm tra
                  </>
                ) : (
                  <>
                    Từ tiếp <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {status !== 'idle' && (
            <div
              className="rounded-2xl px-4 py-3 text-sm border text-center"
              style={{
                backgroundColor: status === 'correct' ? 'var(--green-soft)' : 'var(--red-soft)',
                borderColor: status === 'correct' ? 'var(--green-border)' : 'var(--red-border)',
                color: status === 'correct' ? 'var(--green)' : 'var(--red)',
              }}
            >
              {status === 'correct' ? (
                'Chính xác tuyệt đối! Nhấn Enter để sang từ tiếp theo.'
              ) : (
                <>
                  Từ đúng là: <strong className="font-serif-display text-base">{current.word}</strong>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
