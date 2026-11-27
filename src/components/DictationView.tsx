'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Clock,
  FileAudio,
  Flame,
  Headphones,
  Link2,
  Loader2,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Video,
  X,
} from 'lucide-react';
import { CURATED_LESSONS_META } from '@/lib/curated-lessons-meta';
import {
  getCachedLessonSegments,
  getLessonSegmentCount,
  loadCuratedLessonSegments,
} from '@/lib/lesson-loader';
import {
  extractYoutubeId,
  formatTime,
} from '@/lib/dictation-engine';
import { useWordNestStore } from '@/store/useWordNestStore';
import { DictationLesson, TranscriptSegment } from '@/types/wordnest';
import { AudioUploadModal } from './dictation/AudioUploadModal';

const DictationPlayerStudio = dynamic(
  () => import('./dictation/DictationPlayerStudio').then((m) => ({ default: m.DictationPlayerStudio })),
  {
    ssr: false,
    loading: () => (
      <div className="py-16 flex flex-col items-center justify-center gap-2.5" style={{ color: 'var(--text3)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-medium">Đang mở phòng luyện nghe...</span>
      </div>
    ),
  }
);

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tất cả',
  ted: 'TED Talks (Tư duy)',
  ielts: 'Thuyết trình (Steve Jobs)',
  daily: 'Giao tiếp đời thực (MrBeast)',
  music: 'Âm nhạc tiếng Anh',
  shorts: 'Đoạn ngắn 1 phút',
  custom: 'Bài của bạn & IELTS Audio',
};

type ViewFilter = 'all' | 'billion' | 'viral' | 'popular';
type LevelFilter = 'all' | 'easy' | 'medium' | 'hard';
type DurationFilter = 'all' | 'short' | 'medium' | 'long';
type SortOption = 'featured' | 'views_desc' | 'sentences_desc' | 'duration_asc' | 'duration_desc';

const LEVEL_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  easy: { label: 'Dễ (A2–B1)', bg: 'var(--green-soft)', color: 'var(--green)' },
  medium: { label: 'Trung bình (B1–B2)', bg: 'var(--gold-soft)', color: 'var(--gold)' },
  hard: { label: 'Nâng cao (C1)', bg: 'var(--red-soft)', color: 'var(--red)' },
};

export function DictationView() {
  const activeLessonId = useWordNestStore((s) => s.activeDictationLessonId);
  const openDictationLesson = useWordNestStore((s) => s.openDictationLesson);
  const customLessons = useWordNestStore((s) => s.customLessons);
  const addCustomLesson = useWordNestStore((s) => s.addCustomLesson);
  const deleteCustomLesson = useWordNestStore((s) => s.deleteCustomLesson);
  const dictationProgress = useWordNestStore((s) => s.dictationProgress);
  const showToast = useWordNestStore((s) => s.showToast);

  const [urlInput, setUrlInput] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);

  // Ephemeral in-memory audio lessons (Blob URLs live for current session)
  const [sessionAudioLessons, setSessionAudioLessons] = useState<DictationLesson[]>([]);
  // Lazy-loaded curated lesson transcripts keyed by lesson ID
  const [curatedSegmentsMap, setCuratedSegmentsMap] = useState<Record<string, TranscriptSegment[]>>(
    {}
  );

  const allLessons = useMemo(
    () => [...sessionAudioLessons, ...customLessons, ...CURATED_LESSONS_META],
    [sessionAudioLessons, customLessons]
  );

  const activeLessonBase = useMemo(
    () => allLessons.find((l) => l.id === activeLessonId) || null,
    [allLessons, activeLessonId]
  );

  const needsCuratedSegments = Boolean(
    activeLessonBase &&
      !activeLessonBase.isCustom &&
      activeLessonBase.sourceType !== 'audio' &&
      activeLessonBase.segments.length === 0 &&
      !curatedSegmentsMap[activeLessonBase.id] &&
      !getCachedLessonSegments(activeLessonBase.id)
  );

  useEffect(() => {
    if (!activeLessonBase || !needsCuratedSegments) return;
    let cancelled = false;
    loadCuratedLessonSegments(activeLessonBase.id).then((segs) => {
      if (cancelled) return;
      setCuratedSegmentsMap((prev) => ({ ...prev, [activeLessonBase.id]: segs }));
    });
    return () => {
      cancelled = true;
    };
  }, [activeLessonBase, needsCuratedSegments]);

  const activeLesson = useMemo(() => {
    if (!activeLessonBase) return null;
    if (activeLessonBase.segments.length > 0) return activeLessonBase;
    const loaded =
      curatedSegmentsMap[activeLessonBase.id] || getCachedLessonSegments(activeLessonBase.id);
    if (loaded) {
      return { ...activeLessonBase, segments: loaded };
    }
    return activeLessonBase;
  }, [activeLessonBase, curatedSegmentsMap]);

  const activeFiltersCount =
    (catFilter !== 'all' ? 1 : 0) +
    (viewFilter !== 'all' ? 1 : 0) +
    (levelFilter !== 'all' ? 1 : 0) +
    (durationFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (sortBy !== 'featured' ? 1 : 0);

  const resetFilters = () => {
    setCatFilter('all');
    setViewFilter('all');
    setLevelFilter('all');
    setDurationFilter('all');
    setSortBy('featured');
    setSearchQuery('');
  };

  const filteredLessons = useMemo(() => {
    let list = [...allLessons];

    // Category
    if (catFilter === 'custom') {
      list = list.filter((l) => l.isCustom || l.sourceType === 'audio');
    } else if (catFilter !== 'all') {
      list = list.filter((l) => l.category === catFilter);
    }

    // Views
    if (viewFilter === 'billion') {
      list = list.filter((l) => (l.viewsCount || 0) >= 1_000_000_000);
    } else if (viewFilter === 'viral') {
      list = list.filter((l) => (l.viewsCount || 0) >= 50_000_000);
    } else if (viewFilter === 'popular') {
      list = list.filter(
        (l) => (l.viewsCount || 0) >= 20_000_000 && (l.viewsCount || 0) < 50_000_000
      );
    }

    // Level
    if (levelFilter !== 'all') {
      list = list.filter((l) => l.level === levelFilter);
    }

    // Duration
    if (durationFilter === 'short') {
      list = list.filter((l) => l.durationSec <= 180);
    } else if (durationFilter === 'medium') {
      list = list.filter((l) => l.durationSec > 180 && l.durationSec <= 600);
    } else if (durationFilter === 'long') {
      list = list.filter((l) => l.durationSec > 600);
    }

    // Search Query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.channel.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'views_desc') {
      list.sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
    } else if (sortBy === 'sentences_desc') {
      list.sort((a, b) => getLessonSegmentCount(b) - getLessonSegmentCount(a));
    } else if (sortBy === 'duration_asc') {
      list.sort((a, b) => a.durationSec - b.durationSec);
    } else if (sortBy === 'duration_desc') {
      list.sort((a, b) => b.durationSec - a.durationSec);
    }

    return list;
  }, [allLessons, catFilter, viewFilter, levelFilter, durationFilter, searchQuery, sortBy]);

  const handleLoadYoutubeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const vid = extractYoutubeId(trimmed);
    if (!vid) {
      showToast('Link YouTube chưa đúng định dạng (youtube.com / youtu.be / shorts)', 'error');
      return;
    }

    const existing = allLessons.find((l) => l.youtubeId === vid);
    const existingCount = existing ? getLessonSegmentCount(existing) : 0;
    if (existing && existingCount > 10) {
      openDictationLesson(existing.id);
      setUrlInput('');
      showToast(`Mở bài học có sẵn: ${existing.title} (${existingCount} câu)`, 'default');
      return;
    }

    setLoadingVideo(true);
    try {
      const res = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Không thể tải video này', 'error');
        return;
      }

      const newLesson: DictationLesson = {
        id: `yt_${vid}`,
        youtubeId: vid,
        sourceType: 'youtube',
        title: data.title || `YouTube Video (${vid})`,
        channel: data.channel || 'YouTube',
        category: 'custom',
        level: 'medium',
        durationSec: data.durationSec || 120,
        thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        segments: Array.isArray(data.segments) ? data.segments : [],
        isCustom: true,
        addedAt: new Date().toISOString().slice(0, 10),
      };

      addCustomLesson(newLesson);
      openDictationLesson(newLesson.id);
      setUrlInput('');

      if (data.warning) {
        showToast(data.warning, 'default');
      } else {
        showToast(`Đã bóc trọn bộ ${newLesson.segments.length} câu Full Video!`, 'success');
      }
    } catch {
      showToast('Lỗi kết nối khi lấy phụ đề YouTube', 'error');
    } finally {
      setLoadingVideo(false);
    }
  };

  if (activeLesson) {
    if (needsCuratedSegments) {
      return (
        <div className="bg-warm-card rounded-3xl p-12 text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="font-serif-display text-lg font-medium">{activeLesson.title}</p>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>
            Đang tải {getLessonSegmentCount(activeLesson)} câu phụ đề...
          </p>
        </div>
      );
    }
    return (
      <DictationPlayerStudio
        lesson={activeLesson}
        onBack={() => openDictationLesson(null)}
        onUpdateSessionAudioSegments={(lessonId, segs) => {
          setSessionAudioLessons((prev) =>
            prev.map((l) => (l.id === lessonId ? { ...l, segments: segs } : l))
          );
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-2"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Headphones className="w-3.5 h-3.5" />
            DOL × YouTube Studio · 100% Full Video · Miễn phí không giới hạn
          </div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Nghe Chép Chính Tả YouTube
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
            Học trọn vẹn toàn bộ video kinh điển (TED, Steve Jobs, MrBeast, Queen) với phụ đề song ngữ, hoặc dán link YouTube bất kỳ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAudioModal(true)}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
          }}
        >
          <FileAudio className="w-4 h-4" />
          Nạp MP3 + SRT (IELTS)
        </button>
      </div>

      {/* Paste YouTube URL Bar */}
      <form
        onSubmit={handleLoadYoutubeUrl}
        className="bg-warm-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5"
      >
        <div className="relative flex-1">
          <Link2
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text3)' }}
          />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Dán link YouTube bất kỳ (youtube.com/watch?v=... hoặc shorts/...)"
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm border outline-none transition-colors"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loadingVideo || !urlInput.trim()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {loadingVideo ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang bóc phụ đề Full...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Tạo bài Full Video
            </>
          )}
        </button>
      </form>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text3)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm video theo tên, diễn giả, kênh (TED, Stress, Jobs, MrBeast, Bohemian...)"
              className="w-full rounded-xl pl-10 pr-4 py-2 text-sm border outline-none transition-colors"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs p-1 rounded-full text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Filter Panel Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFiltersPanel((v) => !v)}
              className="px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              style={{
                backgroundColor: showFiltersPanel || activeFiltersCount > 0 ? 'var(--accent-soft)' : 'var(--card)',
                borderColor: showFiltersPanel || activeFiltersCount > 0 ? 'var(--accent)' : 'var(--border)',
                color: showFiltersPanel || activeFiltersCount > 0 ? 'var(--accent)' : 'var(--text2)',
              }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Bộ lọc & Sắp xếp
              {activeFiltersCount > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center font-bold"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                style={{ color: 'var(--text3)' }}
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const active = catFilter === key;
            const customCount = sessionAudioLessons.length + customLessons.length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCatFilter(key)}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  backgroundColor: active ? 'var(--accent)' : 'var(--card)',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  color: active ? '#fff' : 'var(--text2)',
                }}
              >
                {key === 'ted' && <Flame className="w-3 h-3 text-red-500 fill-current" />}
                {key === 'music' && <Sparkles className="w-3 h-3 text-amber-400" />}
                {label}
                {key === 'custom' && customCount > 0 ? ` (${customCount})` : ''}
              </button>
            );
          })}
        </div>

        {/* Expandable Advanced Filters Panel */}
        {showFiltersPanel && (
          <div
            className="p-4 rounded-2xl border space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Filter by Views */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-semibold w-28 shrink-0 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Lượt xem YouTube:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Tất cả view' },
                  { id: 'billion', label: '👑 Tỷ views (> 1 Tỷ)' },
                  { id: 'viral', label: '🔥 Siêu hot (> 50M views)' },
                  { id: 'popular', label: '⭐ Phổ biến (20M–50M)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setViewFilter(item.id as ViewFilter)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: viewFilter === item.id ? 'var(--accent)' : 'var(--bg)',
                      borderColor: viewFilter === item.id ? 'var(--accent)' : 'var(--border)',
                      color: viewFilter === item.id ? '#fff' : 'var(--text2)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Level */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-semibold w-28 shrink-0 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                <Trophy className="w-3.5 h-3.5 text-blue-500" />
                Độ khó / Trình độ:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Mọi trình độ' },
                  { id: 'easy', label: 'Dễ (A2–B1)' },
                  { id: 'medium', label: 'Trung bình (B1–B2)' },
                  { id: 'hard', label: 'Nâng cao (C1)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLevelFilter(item.id as LevelFilter)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: levelFilter === item.id ? 'var(--accent)' : 'var(--bg)',
                      borderColor: levelFilter === item.id ? 'var(--accent)' : 'var(--border)',
                      color: levelFilter === item.id ? '#fff' : 'var(--text2)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Duration */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-semibold w-28 shrink-0 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                Thời lượng video:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Mọi độ dài' },
                  { id: 'short', label: '< 3 phút (Nhanh)' },
                  { id: 'medium', label: '3–10 phút (Chuẩn)' },
                  { id: 'long', label: '> 10 phút (Chuyên sâu)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDurationFilter(item.id as DurationFilter)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: durationFilter === item.id ? 'var(--accent)' : 'var(--bg)',
                      borderColor: durationFilter === item.id ? 'var(--accent)' : 'var(--border)',
                      color: durationFilter === item.id ? '#fff' : 'var(--text2)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort by */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs font-semibold w-28 shrink-0 flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                Sắp xếp theo:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'featured', label: 'Đề xuất hay nhất ✨' },
                  { id: 'views_desc', label: 'Nhiều view nhất 🔥' },
                  { id: 'sentences_desc', label: 'Nhiều câu nhất 📝' },
                  { id: 'duration_asc', label: 'Ngắn nhất ⏱️' },
                  { id: 'duration_desc', label: 'Dài nhất 🎬' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSortBy(item.id as SortOption)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: sortBy === item.id ? 'var(--accent)' : 'var(--bg)',
                      borderColor: sortBy === item.id ? 'var(--accent)' : 'var(--border)',
                      color: sortBy === item.id ? '#fff' : 'var(--text2)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Library Info Pill */}
      <div className="flex items-center justify-between text-xs px-1" style={{ color: 'var(--text3)' }}>
        <span>
          Hiển thị <strong>{filteredLessons.length}</strong> bài nghe (100% Full Video đầy đủ câu)
        </span>
        <span className="hidden sm:inline">
          Hơn 2.500 câu chính tả · Tự động phát hiện âm câm & viết tắt
        </span>
      </div>

      {/* Lessons Grid */}
      {filteredLessons.length === 0 ? (
        <div className="bg-warm-card rounded-2xl p-10 text-center">
          <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-sm">Không tìm thấy bài nghe phù hợp với bộ lọc</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
            Hãy thử đổi từ khóa tìm kiếm hoặc bấm &quot;Đặt lại&quot; bộ lọc để xem toàn bộ 18+ video.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Xem tất cả video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map((lesson) => {
            const prog = dictationProgress[lesson.id];
            const doneCount = prog?.completedSegmentIds.length || 0;
            const totalSegs = getLessonSegmentCount(lesson);
            const pct = totalSegs > 0 ? Math.round((doneCount / totalSegs) * 100) : 0;
            const lvl = LEVEL_STYLES[lesson.level] || LEVEL_STYLES.medium;
            const isAudio = lesson.sourceType === 'audio';

            return (
              <div
                key={lesson.id}
                data-testid="lesson-card"
                onClick={() => openDictationLesson(lesson.id)}
                className="group bg-warm-card rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black/10">
                  {isAudio ? (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-2"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--accent) 0%, #5B452B 100%)',
                        color: '#FFFDF8',
                      }}
                    >
                      <FileAudio className="w-12 h-12 opacity-90" />
                      <span className="text-xs font-medium opacity-85">Audio IELTS / MP3</span>
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lesson.thumbnail}
                        alt={lesson.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

                  {/* Views Badge (Top-Left) */}
                  {lesson.viewsFormatted && (
                    <div className="absolute top-2.5 left-2.5">
                      <span className="inline-flex items-center gap-1 bg-black/70 backdrop-blur-md text-amber-300 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-sm">
                        <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {lesson.viewsFormatted}
                      </span>
                    </div>
                  )}

                  {/* Badges (Top-Right) */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {lesson.accent && (
                      <span className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        {lesson.accent}
                      </span>
                    )}
                    {lesson.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAudio) {
                            setSessionAudioLessons((prev) => prev.filter((l) => l.id !== lesson.id));
                          } else {
                            deleteCustomLesson(lesson.id);
                          }
                          showToast('Đã xóa bài nghe khỏi danh sách', 'default');
                        }}
                        className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                        aria-label="Xóa bài nghe"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Bottom Stats */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs">
                    <span className="inline-flex items-center gap-1.5 bg-black/65 backdrop-blur-sm px-2 py-0.5 rounded-md font-medium text-[11px]">
                      <Clock className="w-3 h-3" />
                      {formatTime(lesson.durationSec)} · {totalSegs} câu Full
                    </span>
                    <span className="w-8 h-8 rounded-full bg-white/95 text-[#2E2720] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: lvl.bg, color: lvl.color }}
                    >
                      {lvl.label}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--text3)' }}>
                      {lesson.channel}
                    </span>
                  </div>
                  <h3 className="font-serif-display font-semibold text-base leading-snug line-clamp-2 mb-1.5">
                    {lesson.title}
                  </h3>
                  {lesson.description && (
                    <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--text3)' }}>
                      {lesson.description}
                    </p>
                  )}

                  <div className="mt-auto pt-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text3)' }}>
                      <span>Tiến độ</span>
                      <span className="font-semibold tabular-nums">
                        {doneCount}/{totalSegs} câu ({pct}%)
                      </span>
                    </div>
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--bg3)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? 'var(--green)' : 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Local Audio MP3 + SRT/LRC Modal */}
      {showAudioModal && (
        <AudioUploadModal
          onClose={() => setShowAudioModal(false)}
          onCreated={(audioLesson) => {
            setSessionAudioLessons((prev) => [audioLesson, ...prev]);
            setShowAudioModal(false);
            openDictationLesson(audioLesson.id);
            showToast(`Đã nạp Audio (${audioLesson.segments.length} câu)!`, 'success');
          }}
        />
      )}
    </div>
  );
}
