'use client';

import React, { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarClock,
  Flame,
  Headphones,
  Layers,
  PenLine,
  Play,
  Rocket,
  Sparkles,
  Trophy,
  Volume2,
} from 'lucide-react';
import { CURATED_LESSONS_META } from '@/lib/curated-lessons-meta';
import { getLessonSegmentCount } from '@/lib/lesson-loader';
import { isSrsDue, localDateKey } from '@/lib/srs';
import { speakEnglish } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';

export function HomeView() {
  const words = useWordNestStore((s) => s.words);
  const streak = useWordNestStore((s) => s.streak);
  const dailyGoal = useWordNestStore((s) => s.dailyGoal);
  const quizStats = useWordNestStore((s) => s.quizStats);
  const customLessons = useWordNestStore((s) => s.customLessons);
  const dictationProgress = useWordNestStore((s) => s.dictationProgress);
  const setActiveTab = useWordNestStore((s) => s.setActiveTab);
  const openDictationLesson = useWordNestStore((s) => s.openDictationLesson);

  const activeWords = useMemo(() => words.filter((w) => !w.suspended), [words]);
  const masteredCount = useMemo(() => words.filter((w) => w.mastery >= 3).length, [words]);
  const srsDueCount = useMemo(() => activeWords.filter(isSrsDue).length, [activeWords]);

  const totalDictationDone = useMemo(
    () =>
      Object.values(dictationProgress).reduce(
        (acc, p) => acc + p.completedSegmentIds.length,
        0
      ),
    [dictationProgress]
  );

  // Pick most recently practiced YouTube lesson or default first curated lesson
  const featuredLesson = useMemo(() => {
    const all = [...customLessons, ...CURATED_LESSONS_META];
    const sorted = Object.values(dictationProgress).sort((a, b) =>
      b.lastPracticedAt.localeCompare(a.lastPracticedAt)
    );
    if (sorted[0]) {
      const found = all.find((l) => l.id === sorted[0].lessonId);
      if (found) return found;
    }
    return CURATED_LESSONS_META[0];
  }, [customLessons, dictationProgress]);

  const recentWords = useMemo(
    () =>
      words
        .slice()
        .sort((a, b) => (b.seen || 0) - (a.seen || 0))
        .slice(0, 10),
    [words]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  const todayDone = streak.history[localDateKey()] || 0;
  const goalPct = Math.min(100, Math.round((todayDone / Math.max(1, dailyGoal)) * 100));
  const ringCircumference = 2 * Math.PI * 18;
  const ringOffset = ringCircumference * (1 - goalPct / 100);

  return (
    <div className="space-y-6">
      {/* Greeting Header + Daily Goal Ring */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold tracking-tight">
            {greeting}!
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
            Hôm nay bạn muốn nghe YouTube hay ôn lại kho từ vựng của mình?
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className="bg-warm-card rounded-2xl px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-transform hover:scale-[1.02]"
            title="Mục tiêu học mỗi ngày"
          >
            <svg width="42" height="42" viewBox="0 0 44 44" className="-rotate-90 shrink-0">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="var(--bg3)"
                strokeWidth="4"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={goalPct >= 100 ? 'var(--green)' : 'var(--accent)'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="text-left">
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text3)' }}>
                Mục tiêu ngày
              </div>
              <div className="text-xs font-bold tabular-nums" style={{ color: goalPct >= 100 ? 'var(--green)' : 'var(--text)' }}>
                {todayDone} / {dailyGoal} lượt
              </div>
            </div>
          </button>

          <div
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border"
            style={{
              backgroundColor: 'var(--gold-soft)',
              borderColor: 'var(--border)',
              color: 'var(--gold)',
            }}
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            {streak.count} ngày
          </div>
        </div>
      </div>

      {/* HERO DAILY FOCUS BANNER (Fixes v1 flat hierarchy & orphan SRS card!) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Hero: YouTube Dictation Featured */}
        <div
          onClick={() => openDictationLesson(featuredLesson.id)}
          className="md:col-span-7 relative rounded-2xl p-5 sm:p-6 overflow-hidden cursor-pointer border transition-all hover:shadow-lg group flex flex-col justify-between"
          style={{
            background:
              'linear-gradient(135deg, var(--accent) 0%, #634C30 100%)',
            borderColor: 'transparent',
            color: '#FFFDF8',
          }}
        >
          <div className="relative z-10 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
              <Headphones className="w-3.5 h-3.5" />
              Nghe chép YouTube hôm nay
            </span>
            <h2 className="font-serif-display text-xl sm:text-2xl font-semibold leading-snug">
              {featuredLesson.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 line-clamp-2">
              {featuredLesson.channel} · {getLessonSegmentCount(featuredLesson)} câu ngắn · Chế độ chạm chọn từ & gõ DOL
            </p>
          </div>

          <div className="relative z-10 mt-5 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 bg-white text-[#2E2720] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm group-hover:translate-x-0.5 transition-transform">
              <Play className="w-3.5 h-3.5 fill-current" />
              Nghe & Chép ngay
            </span>
            <span className="text-xs text-white/75 hidden sm:inline">
              hoặc dán link YouTube bất kỳ →
            </span>
          </div>
        </div>

        {/* Right Hero: SRS Daily Review */}
        <div
          onClick={() => setActiveTab('flashcard')}
          className="md:col-span-5 bg-warm-card rounded-2xl p-5 sm:p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--gold)' }}
              >
                <CalendarClock className="w-4 h-4" />
                Ôn tập SRS hôm nay
              </span>
              <div
                className="font-serif-display text-4xl font-semibold mt-2 tabular-nums"
                style={{ color: 'var(--text)' }}
              >
                {srsDueCount}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                từ đến hạn nhắc lại theo thuật toán SM-2
              </p>
            </div>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--gold-soft)', color: 'var(--gold)' }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div
            className="mt-5 pt-3 border-t flex items-center justify-between text-xs font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
          >
            <span>Mở Flashcard SRS</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* SYMMETRIC 4-STAT GRID (Zero orphan cards!) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-warm-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Kho từ vựng
            </span>
            <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
            {words.length}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            {masteredCount} từ đã thuộc
          </p>
        </div>

        <div className="bg-warm-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Câu đã chép
            </span>
            <Headphones className="w-4 h-4" style={{ color: 'var(--green)' }} />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: 'var(--green)' }}>
            {totalDictationDone}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            từ video YouTube
          </p>
        </div>

        <div className="bg-warm-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Kỷ lục Quiz
            </span>
            <Trophy className="w-4 h-4" style={{ color: 'var(--gold)' }} />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: 'var(--gold)' }}>
            {quizStats.bestScore ? `${quizStats.bestScore}%` : '—'}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            {quizStats.totalGames} lượt đã chơi
          </p>
        </div>

        <div className="bg-warm-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
              Độ thành thạo
            </span>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--blue)' }} />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: 'var(--blue)' }}>
            {words.length ? `${Math.round((masteredCount / words.length) * 100)}%` : '0%'}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            tỉ lệ thuộc toàn kho
          </p>
        </div>
      </div>

      {/* QUICK PRACTICE MODES */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text2)' }}>
          Chế độ luyện tập
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              tab: 'dictation' as const,
              title: 'Nghe YouTube',
              desc: 'Chép chính tả & Shadowing',
              icon: Headphones,
              tint: 'var(--accent)',
              bg: 'var(--accent-soft)',
            },
            {
              tab: 'flashcard' as const,
              title: 'Flashcard SRS',
              desc: 'Lật thẻ 4 mức nhớ',
              icon: Layers,
              tint: 'var(--gold)',
              bg: 'var(--gold-soft)',
            },
            {
              tab: 'quiz' as const,
              title: 'Quiz 4 lựa chọn',
              desc: 'Kiểm tra phản xạ nhanh',
              icon: Brain,
              tint: 'var(--blue)',
              bg: 'var(--blue-soft)',
            },
            {
              tab: 'spelling' as const,
              title: 'Luyện chính tả',
              desc: 'Điền ký tự chuẩn xác',
              icon: PenLine,
              tint: 'var(--green)',
              bg: 'var(--green-soft)',
            },
            {
              tab: 'game' as const,
              title: 'Không Chiến',
              desc: 'Bắn phi thuyền từ vựng',
              icon: Rocket,
              tint: 'var(--red)',
              bg: 'var(--red-soft)',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => setActiveTab(item.tab)}
                className="bg-warm-card rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: item.bg, color: item.tint }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-sm">{item.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  {item.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RECENT WORDS STRIP */}
      {recentWords.length > 0 && (
        <div className="bg-warm-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Từ gần đây (chạm để nghe phát âm)</h3>
            <button
              type="button"
              onClick={() => setActiveTab('wordlist')}
              className="text-xs font-medium hover:underline cursor-pointer"
              style={{ color: 'var(--accent)' }}
            >
              Xem tất cả →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentWords.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => speakEnglish(w.word)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text2)',
                }}
              >
                <Volume2 className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                {w.word}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
