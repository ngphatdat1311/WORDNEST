'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, CheckCircle2, RotateCcw, Volume2, XCircle } from 'lucide-react';
import { playChime, speakEnglish, vibrateLight } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { WordItem } from '@/types/wordnest';

interface QuizQuestion {
  target: WordItem;
  options: WordItem[];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizView() {
  const words = useWordNestStore((s) => s.words);
  const folders = useWordNestStore((s) => s.folders);
  const recordQuizSession = useWordNestStore((s) => s.recordQuizSession);
  const recordSpellingResult = useWordNestStore((s) => s.recordSpellingResult);

  const [count, setCount] = useState<number>(10);
  const [level, setLevel] = useState<string>('all');
  const [folderId, setFolderId] = useState<string>('all');
  const [sessionId, setSessionId] = useState(0);

  const [qIndex, setQIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongItems, setWrongItems] = useState<WordItem[]>([]);
  const [finished, setFinished] = useState(false);

  const activePool = useMemo(() => words.filter((w) => !w.suspended), [words]);

  const questions: QuizQuestion[] = useMemo(() => {
    let pool = activePool;
    if (level === 'weak') pool = pool.filter((w) => w.mastery < 2);
    else if (level !== 'all') pool = pool.filter((w) => w.level === level);
    if (folderId !== 'all') pool = pool.filter((w) => w.folderIds.includes(folderId));
    if (pool.length === 0) pool = activePool;

    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    return picked.map((target) => {
      const distractors = shuffle(activePool.filter((w) => w.id !== target.id)).slice(0, 3);
      return {
        target,
        options: shuffle([target, ...distractors]),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePool.length, count, level, folderId, sessionId]);

  const resetQuizState = () => {
    setQIndex(0);
    setSelectedId(null);
    setCorrectCount(0);
    setWrongItems([]);
    setFinished(false);
  };

  const current = questions[qIndex];

  const handleSelect = useCallback(
    (opt: WordItem) => {
      if (!current || selectedId) return;
      setSelectedId(opt.id);
      const isRight = opt.id === current.target.id;
      recordSpellingResult(current.target.id, isRight);

      if (isRight) {
        setCorrectCount((c) => c + 1);
        playChime('success');
        vibrateLight(14);
      } else {
        setWrongItems((prev) => [...prev, current.target]);
        playChime('error');
        vibrateLight([25, 30, 25]);
      }
    },
    [current, selectedId, recordSpellingResult]
  );

  const handleNext = useCallback(() => {
    if (qIndex < questions.length - 1) {
      setQIndex((i) => i + 1);
      setSelectedId(null);
    } else {
      setFinished(true);
      recordQuizSession(correctCount, questions.length);
      if (questions.length > 0 && correctCount / questions.length >= 0.8) {
        playChime('complete');
        confetti({ particleCount: 65, spread: 60, origin: { y: 0.7 } });
      }
    }
  }, [qIndex, questions.length, recordQuizSession, correctCount]);

  // Keyboard shortcuts 1-4 / Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || !current) return;
      if (!selectedId && ['1', '2', '3', '4'].includes(e.key)) {
        const opt = current.options[Number(e.key) - 1];
        if (opt) handleSelect(opt);
      } else if (selectedId && e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, current, selectedId, handleSelect, handleNext]);

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Quiz Trắc Nghiệm</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
            Chọn nghĩa đúng cho từ được hỏi · Phím 1–4 để chọn nhanh.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSessionId((s) => s + 1);
            resetQuizState();
          }}
          className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Đề mới
        </button>
      </div>

      {/* Auto-applying filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setCount(n);
              resetQuizState();
            }}
            className="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer"
            style={{
              backgroundColor: count === n ? 'var(--accent)' : 'var(--card)',
              borderColor: count === n ? 'var(--accent)' : 'var(--border)',
              color: count === n ? '#fff' : 'var(--text2)',
            }}
          >
            {n} câu
          </button>
        ))}

        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            resetQuizState();
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
              resetQuizState();
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

      {questions.length < 2 ? (
        <div className="bg-warm-card rounded-2xl p-10 text-center">
          <p className="text-sm font-medium">Cần ít nhất 2 từ vựng để bắt đầu Quiz!</p>
        </div>
      ) : finished ? (
        <div className="bg-warm-card rounded-3xl p-6 sm:p-8 text-center space-y-5">
          <div>
            <div
              className="font-serif-display text-5xl font-semibold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {Math.round((correctCount / questions.length) * 100)}%
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
              Đúng {correctCount} / {questions.length} câu
            </p>
          </div>

          {wrongItems.length > 0 && (
            <div className="text-left space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--red)' }}>
                Từ cần xem lại ({wrongItems.length})
              </p>
              <div className="space-y-1.5">
                {wrongItems.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-xl p-3 border flex items-center justify-between gap-3"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                  >
                    <div>
                      <span className="font-serif-display font-semibold">{w.word}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text2)' }}>
                        — {w.meaning}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakEnglish(w.word)}
                      className="p-1.5 rounded-lg cursor-pointer"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSessionId((s) => s + 1);
              resetQuizState();
            }}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Chơi lượt mới
          </button>
        </div>
      ) : (
        current && (
          <div className="bg-warm-card rounded-3xl p-5 sm:p-7 space-y-5">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg3)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(((qIndex + 1) / questions.length) * 100)}%`,
                    backgroundColor: 'var(--accent)',
                  }}
                />
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text3)' }}>
                {qIndex + 1} / {questions.length}
              </span>
            </div>

            {/* Question Word */}
            <div>
              <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
                Câu {qIndex + 1}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold">
                  {current.target.word}
                </h2>
                <button
                  type="button"
                  onClick={() => speakEnglish(current.target.word)}
                  className="w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg2)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent)',
                  }}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              {current.target.phonetic && (
                <p className="text-sm italic mt-1" style={{ color: 'var(--text3)' }}>
                  {current.target.phonetic}
                </p>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {current.options.map((opt, idx) => {
                const isSelected = selectedId === opt.id;
                const isRight = opt.id === current.target.id;
                let bg = 'var(--card)';
                let border = 'var(--border)';
                let color = 'var(--text)';

                if (selectedId) {
                  if (isRight) {
                    bg = 'var(--green-soft)';
                    border = 'var(--green)';
                    color = 'var(--green)';
                  } else if (isSelected) {
                    bg = 'var(--red-soft)';
                    border = 'var(--red)';
                    color = 'var(--red)';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(selectedId)}
                    onClick={() => handleSelect(opt)}
                    className="w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 flex items-start gap-3 transition-all cursor-pointer disabled:cursor-default"
                    style={{ backgroundColor: bg, borderColor: border, color }}
                  >
                    <span
                      className="w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5 border"
                      style={{
                        backgroundColor:
                          selectedId && isRight
                            ? 'var(--green)'
                            : selectedId && isSelected
                              ? 'var(--red)'
                              : 'var(--bg2)',
                        borderColor: 'transparent',
                        color:
                          selectedId && (isRight || isSelected) ? '#fff' : 'var(--text3)',
                      }}
                    >
                      {letters[idx]}
                    </span>
                    <span className="text-sm sm:text-base leading-relaxed flex-1 pt-0.5">
                      {opt.meaning}
                    </span>
                    {selectedId && isRight && <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                    {selectedId && isSelected && !isRight && <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>

            {selectedId && (
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {qIndex < questions.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
