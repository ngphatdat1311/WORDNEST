'use client';

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  Flame,
  Headphones,
  Home,
  Layers,
  Moon,
  PenLine,
  PlusCircle,
  Rocket,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { pushToSupabase } from '@/lib/cloud-sync';
import { CURATED_LESSONS } from '@/lib/curated-lessons';
import { extractYoutubeId } from '@/lib/dictation-engine';
import { isSrsDue } from '@/lib/srs';
import { useWordNestStore } from '@/store/useWordNestStore';
import { DictationLesson, NavTab } from '@/types/wordnest';
import { AddWordView } from './AddWordView';
import { AirCombatView } from './AirCombatView';
import { DictationView } from './DictationView';
import { FlashcardView } from './FlashcardView';
import { HomeView } from './HomeView';
import { ProgressView } from './ProgressView';
import { QuizView } from './QuizView';
import { SpellingView } from './SpellingView';
import { WordlistView } from './WordlistView';

function WordNestLogo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 rounded-[9px] shadow-xs"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wnLogoGrad" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0" stopColor="#9C7F57" />
          <stop offset="1" stopColor="#6E5538" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#wnLogoGrad)" />
      <path
        d="M22 36 C22 31 33 29 50 33 C67 29 78 31 78 36 L78 67 C78 62 67 60 50 64 C33 60 22 62 22 67 Z"
        fill="#FDFAF5"
      />
      <path d="M50 33 L50 64" stroke="#D8D0C0" strokeWidth="1.6" />
      <path
        d="M30 41 L42 38.5 M30 48 L42 46 M30 55 L41 53.5"
        stroke="#C8BFA8"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M70 41 L58 38.5 M70 48 L58 46 M70 55 L59 53.5"
        stroke="#C8BFA8"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M50 26 C45 21 46 14 53 11 C56 17 54 24 50 26 Z" fill="#8FAE7A" />
      <path d="M50 26 C54 22 55 17 53 12" stroke="#6F8F5C" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

const emptySubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const PRACTICE_TABS: NavTab[] = ['flashcard', 'quiz', 'spelling', 'game'];

export function AppShell() {
  const activeTab = useWordNestStore((s) => s.activeTab);
  const activeDictationLessonId = useWordNestStore((s) => s.activeDictationLessonId);
  const setActiveTab = useWordNestStore((s) => s.setActiveTab);
  const theme = useWordNestStore((s) => s.theme);
  const toggleTheme = useWordNestStore((s) => s.toggleTheme);
  const streak = useWordNestStore((s) => s.streak);
  const words = useWordNestStore((s) => s.words);
  const toast = useWordNestStore((s) => s.toast);
  const clearToast = useWordNestStore((s) => s.clearToast);
  const customLessons = useWordNestStore((s) => s.customLessons);
  const folders = useWordNestStore((s) => s.folders);
  const dictationProgress = useWordNestStore((s) => s.dictationProgress);
  const cloudSync = useWordNestStore((s) => s.cloudSync);
  const updateCloudSync = useWordNestStore((s) => s.updateCloudSync);
  const exportBackup = useWordNestStore((s) => s.exportBackup);
  const addCustomLesson = useWordNestStore((s) => s.addCustomLesson);
  const openDictationLesson = useWordNestStore((s) => s.openDictationLesson);
  const showToast = useWordNestStore((s) => s.showToast);
  const hydrated = useIsClient();

  const historyInitRef = useRef(false);
  const isPoppingHistoryRef = useRef(false);

  // Sync activeTab & activeDictationLessonId with Browser History API
  // Enables native Chrome/Safari Back & Forward buttons + 2-finger trackpad swipe!
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;

    const VALID_TABS: NavTab[] = [
      'home',
      'dictation',
      'flashcard',
      'quiz',
      'spelling',
      'game',
      'wordlist',
      'add',
      'progress',
    ];

    const buildUrl = (tab: NavTab, lessonId: string | null) => {
      const qs = new URLSearchParams();
      if (tab !== 'home') qs.set('tab', tab);
      if (tab === 'dictation' && lessonId) qs.set('lesson', lessonId);
      const qStr = qs.toString();
      return qStr ? `${window.location.pathname}?${qStr}` : window.location.pathname;
    };

    if (!historyInitRef.current) {
      historyInitRef.current = true;
      const params = new URLSearchParams(window.location.search);
      // Skip overwriting if ?yt= deep-link is being handled below
      if (!params.get('yt')) {
        const urlTab = params.get('tab') as NavTab | null;
        const urlLesson = params.get('lesson');
        if (urlTab && VALID_TABS.includes(urlTab)) {
          isPoppingHistoryRef.current = true;
          useWordNestStore.setState({
            activeTab: urlTab,
            activeDictationLessonId: urlTab === 'dictation' ? urlLesson : null,
          });
          window.history.replaceState(
            { tab: urlTab, lessonId: urlTab === 'dictation' ? urlLesson : null },
            '',
            buildUrl(urlTab, urlTab === 'dictation' ? urlLesson : null)
          );
          queueMicrotask(() => {
            isPoppingHistoryRef.current = false;
          });
          return;
        }
        window.history.replaceState(
          { tab: activeTab, lessonId: activeDictationLessonId },
          '',
          buildUrl(activeTab, activeDictationLessonId)
        );
      }
      return;
    }

    if (isPoppingHistoryRef.current) {
      isPoppingHistoryRef.current = false;
      return;
    }

    const nextUrl = buildUrl(activeTab, activeDictationLessonId);
    const currentState = window.history.state as { tab?: NavTab; lessonId?: string | null } | null;
    if (
      currentState?.tab === activeTab &&
      (currentState?.lessonId ?? null) === (activeDictationLessonId ?? null)
    ) {
      return;
    }
    window.history.pushState(
      { tab: activeTab, lessonId: activeDictationLessonId },
      '',
      nextUrl
    );
  }, [hydrated, activeTab, activeDictationLessonId]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const onPopState = (e: PopStateEvent) => {
      const state = e.state as { tab?: NavTab; lessonId?: string | null } | null;
      isPoppingHistoryRef.current = true;
      if (state?.tab) {
        useWordNestStore.setState({
          activeTab: state.tab,
          activeDictationLessonId: state.tab === 'dictation' ? (state.lessonId ?? null) : null,
        });
      } else {
        const params = new URLSearchParams(window.location.search);
        const tab = (params.get('tab') as NavTab | null) || 'home';
        const lesson = params.get('lesson');
        useWordNestStore.setState({
          activeTab: tab,
          activeDictationLessonId: tab === 'dictation' ? lesson : null,
        });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme, hydrated]);

  // Register PWA Offline Service Worker & listen for storage quota warnings
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onQuotaError = () => {
      showToast(
        'Bộ nhớ trình duyệt gần đầy (5MB)! Hãy xuất file sao lưu JSON hoặc xóa bớt bài nghe tự thêm.',
        'error'
      );
    };
    window.addEventListener('wordnest:storage-quota-error', onQuotaError);
    return () => window.removeEventListener('wordnest:storage-quota-error', onQuotaError);
  }, [hydrated, showToast]);

  // Background debounced Auto Cloud Sync when Supabase + autoSync are enabled
  useEffect(() => {
    if (
      !hydrated ||
      !cloudSync.enabled ||
      !cloudSync.autoSync ||
      !cloudSync.supabaseUrl ||
      !cloudSync.supabaseAnonKey ||
      !cloudSync.syncCode
    ) {
      return;
    }
    const timer = setTimeout(() => {
      pushToSupabase(cloudSync, exportBackup()).then((res) => {
        if (res.ok && res.syncedAt) {
          updateCloudSync({ lastSyncedAt: res.syncedAt });
        }
      });
    }, 4500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, words, folders, dictationProgress, streak, cloudSync.enabled, cloudSync.autoSync]);

  // Deep-link support for Zalo quick-share: https://wordnest.app/?yt=VIDEO_ID
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ytParam = params.get('yt');
    if (!ytParam) return;
    const vid = extractYoutubeId(ytParam);
    if (!vid) return;

    // Clean query param from URL bar
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    const existing = [...customLessons, ...CURATED_LESSONS].find((l) => l.youtubeId === vid);
    if (existing) {
      openDictationLesson(existing.id);
      return;
    }

    showToast('Đang tải video YouTube được chia sẻ...', 'default');
    fetch(`/api/youtube/transcript?url=${encodeURIComponent(vid)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.error) {
          showToast(data?.error || 'Không tải được video chia sẻ', 'error');
          return;
        }
        const lesson: DictationLesson = {
          id: `yt_${vid}`,
          youtubeId: vid,
          sourceType: 'youtube',
          title: data.title || `YouTube (${vid})`,
          channel: data.channel || 'YouTube',
          category: 'custom',
          level: 'medium',
          durationSec: data.durationSec || 120,
          thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          segments: Array.isArray(data.segments) ? data.segments : [],
          isCustom: true,
          addedAt: new Date().toISOString().slice(0, 10),
        };
        addCustomLesson(lesson);
        openDictationLesson(lesson.id);
        showToast(`Đã mở video chia sẻ (${lesson.segments.length} câu)!`, 'success');
      })
      .catch(() => showToast('Lỗi tải video chia sẻ', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const srsDueCount = useMemo(
    () => words.filter((w) => !w.suspended && isSrsDue(w)).length,
    [words]
  );

  const sidebarGroups: Array<{
    title: string;
    items: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }>;
  }> = [
    {
      title: 'Tổng quan',
      items: [{ id: 'home', label: 'Trang chủ', icon: Home }],
    },
    {
      title: 'Luyện tập',
      items: [
        { id: 'dictation', label: 'Nghe YouTube', icon: Headphones, badge: 'Mới' },
        {
          id: 'flashcard',
          label: 'Flashcard SRS',
          icon: Layers,
          badge: srsDueCount > 0 ? String(srsDueCount) : undefined,
        },
        { id: 'quiz', label: 'Quiz Trắc Nghiệm', icon: Brain },
        { id: 'spelling', label: 'Luyện Chính Tả', icon: PenLine },
        { id: 'game', label: 'Không Chiến Từ Vựng', icon: Rocket },
      ],
    },
    {
      title: 'Kho từ vựng',
      items: [
        { id: 'wordlist', label: 'Từ Điển Cá Nhân', icon: BookOpen },
        { id: 'add', label: 'Thêm Từ Mới', icon: PlusCircle },
      ],
    },
    {
      title: 'Hệ thống',
      items: [{ id: 'progress', label: 'Tiến Độ & Đồng Bộ', icon: BarChart3 }],
    },
  ];

  const isPracticeTab = PRACTICE_TABS.includes(activeTab);

  // Prevent SSR/client hydration mismatch with Zustand localStorage persistence
  if (!hydrated) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <WordNestLogo size={48} />
          <span
            className="font-serif-display text-lg font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            WordNest
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* ═══ DESKTOP SIDEBAR (>= lg) ═══ */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r z-30"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Brand */}
        <div
          onClick={() => setActiveTab('home')}
          className="h-16 px-5 flex items-center gap-3 border-b cursor-pointer"
          style={{ borderColor: 'var(--border)' }}
        >
          <WordNestLogo size={34} />
          <div>
            <div
              className="font-serif-display font-semibold text-lg leading-none"
              style={{ color: 'var(--accent)' }}
            >
              WordNest
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              2.0 · YouTube & SRS
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {sidebarGroups.map((group) => (
            <div key={group.title}>
              <div
                className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text3)' }}
              >
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text2)',
                      }}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              item.id === 'dictation' ? 'var(--accent)' : 'var(--gold-soft)',
                            color: item.id === 'dictation' ? '#fff' : 'var(--gold)',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Controls */}
        <div
          className="p-3.5 border-t flex items-center justify-between gap-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
          >
            <Flame className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            {streak.count} ngày
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--accent)',
            }}
            aria-label="Đổi giao diện sáng/tối"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ═══ MOBILE STICKY TOP HEADER (< lg) ═══ */}
      <header
        className="lg:hidden sticky top-0 z-30 h-14 px-4 border-b flex items-center justify-between backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--card) 92%, transparent)',
          borderColor: 'var(--border)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <WordNestLogo size={30} />
          <span
            className="font-serif-display font-semibold text-lg"
            style={{ color: 'var(--accent)' }}
          >
            WordNest
          </span>
        </button>

        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
          >
            <Flame className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            {streak.count}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer"
            style={{
              backgroundColor: activeTab === 'progress' ? 'var(--accent-soft)' : 'var(--bg2)',
              borderColor: activeTab === 'progress' ? 'var(--accent)' : 'var(--border)',
              color: activeTab === 'progress' ? 'var(--accent)' : 'var(--text2)',
            }}
            aria-label="Tiến độ & Đồng bộ"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer"
            style={{
              backgroundColor: 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--accent)',
            }}
            aria-label="Đổi chế độ sáng tối"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT CANVAS ═══ */}
      <main className="flex-1 lg:pl-64 pb-24 lg:pb-12">
        <div
          className={`mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 ${
            activeTab === 'dictation' || activeTab === 'game' ? 'max-w-6xl' : 'max-w-4xl'
          }`}
        >
          {/* Mobile Practice Mode Sub-Switcher (only visible when inside Flashcard / Quiz / Spelling on mobile) */}
          {isPracticeTab && (
            <div
              className="lg:hidden mb-4 p-1 rounded-2xl border grid grid-cols-4 gap-1"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {(
                [
                  { id: 'flashcard', label: 'Thẻ', icon: Layers },
                  { id: 'quiz', label: 'Quiz', icon: Brain },
                  { id: 'spelling', label: 'Chính tả', icon: PenLine },
                  { id: 'game', label: 'Game', icon: Rocket },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = activeTab === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveTab(m.id)}
                    className="py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--text2)',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'home' && <HomeView />}
          {activeTab === 'dictation' && <DictationView />}
          {activeTab === 'flashcard' && <FlashcardView />}
          {activeTab === 'quiz' && <QuizView />}
          {activeTab === 'spelling' && <SpellingView />}
          {activeTab === 'game' && <AirCombatView />}
          {activeTab === 'wordlist' && <WordlistView />}
          {activeTab === 'add' && <AddWordView />}
          {activeTab === 'progress' && <ProgressView />}
        </div>
      </main>

      {/* ═══ MOBILE FIXED BOTTOM NAVIGATION BAR (< lg) ═══ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t pb-safe backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--card) 95%, transparent)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="grid grid-cols-5 h-15 px-1">
          {[
            { id: 'home' as NavTab, label: 'Trang chủ', icon: Home, match: activeTab === 'home' },
            {
              id: 'dictation' as NavTab,
              label: 'Nghe YT',
              icon: Headphones,
              match: activeTab === 'dictation',
            },
            {
              id: 'flashcard' as NavTab,
              label: 'Luyện tập',
              icon: Layers,
              match: isPracticeTab,
            },
            {
              id: 'wordlist' as NavTab,
              label: 'Từ điển',
              icon: BookOpen,
              match: activeTab === 'wordlist',
            },
            {
              id: 'add' as NavTab,
              label: 'Thêm từ',
              icon: PlusCircle,
              match: activeTab === 'add',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors cursor-pointer"
                style={{ color: tab.match ? 'var(--accent)' : 'var(--text3)' }}
              >
                <div
                  className="px-3 py-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: tab.match ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ═══ GLOBAL TOAST & 5s UNDO TOAST ═══ */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-max max-w-[92vw]">
          <div
            className="rounded-2xl px-4 py-2.5 shadow-xl border flex items-center gap-3 text-xs sm:text-sm font-medium"
            style={{
              backgroundColor:
                toast.tone === 'success'
                  ? 'var(--green)'
                  : toast.tone === 'error'
                    ? 'var(--red)'
                    : 'var(--text)',
              borderColor: 'transparent',
              color: toast.tone === 'default' ? 'var(--bg)' : '#fff',
            }}
          >
            <span>{toast.message}</span>
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  toast.undoAction?.();
                  clearToast();
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                <RotateCcw className="w-3 h-3" />
                Hoàn tác
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
