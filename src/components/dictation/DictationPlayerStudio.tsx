'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FastForward,
  FileAudio,
  FileEdit,
  Gauge,
  Headphones,
  Keyboard,
  Languages,
  Layers,
  Lightbulb,
  List,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  createScrambledChips,
  diffDictation,
  formatTime,
  normalizeToken,
  parseSrtOrLrc,
  selectBlankIndices,
  tokenizeSentence,
} from '@/lib/dictation-engine';
import { playChime, vibrateLight } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { DictationLesson, DictationMode, TranscriptSegment } from '@/types/wordnest';
import { ShadowingPanel } from '../ShadowingPanel';
import { WordLookupPopover } from '../WordLookupPopover';

// Minimal YouTube IFrame API types
interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      resolve();
    };
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    } else {
      const poll = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(poll);
          resolve();
        }
      }, 150);
    }
  });
  return ytApiPromise;
}

const SPEED_OPTIONS = [0.65, 0.75, 0.85, 1, 1.15, 1.25];

export function DictationPlayerStudio({
  lesson,
  onBack,
  onUpdateSessionAudioSegments,
}: {
  lesson: DictationLesson;
  onBack: () => void;
  onUpdateSessionAudioSegments: (lessonId: string, segs: TranscriptSegment[]) => void;
}) {
  const words = useWordNestStore((s) => s.words);
  const dictationProgress = useWordNestStore((s) => s.dictationProgress[lesson.id]);
  const markSegmentComplete = useWordNestStore((s) => s.markDictationSegmentComplete);
  const setLessonLastIndex = useWordNestStore((s) => s.setLessonLastIndex);
  const updateLessonSegments = useWordNestStore((s) => s.updateLessonSegments);
  const showToast = useWordNestStore((s) => s.showToast);

  const isAudioLesson = lesson.sourceType === 'audio';

  // Fast Set of normalized words already saved in user's WordNest vault (for Auto-Highlight!)
  const savedWordNorms = useMemo(() => {
    const s = new Set<string>();
    words.forEach((w) => {
      const n = normalizeToken(w.word);
      if (n.length >= 3) s.add(n);
    });
    return s;
  }, [words]);

  const [segIndex, setSegIndex] = useState(() => {
    const saved = dictationProgress?.lastSegmentIndex ?? 0;
    return Math.min(saved, Math.max(0, lesson.segments.length - 1));
  });

  const [mode, setMode] = useState<DictationMode>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 'full' : 'tap'
  );
  const [compactVideo, setCompactVideo] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(isAudioLesson);

  // Per-sentence interactive states
  const [fullInput, setFullInput] = useState('');
  const [blankInputs, setBlankInputs] = useState<Record<number, string>>({});
  const [tappedChipIds, setTappedChipIds] = useState<string[]>([]);
  const [wrongChipId, setWrongChipId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [completedNow, setCompletedNow] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [showShadowing, setShowShadowing] = useState(false);
  const [viCache, setViCache] = useState<Record<string, string>>({});
  const [loadingVi, setLoadingVi] = useState(false);

  // Drawers & Modals & Part Pagination
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [activePart, setActivePart] = useState<number | 'all'>('all');
  const [refreshingFull, setRefreshingFull] = useState(false);
  const [maskVideoSubtitles, setMaskVideoSubtitles] = useState(false);
  const [showManualModal, setShowManualModal] = useState(lesson.segments.length === 0);
  const [manualText, setManualText] = useState('');
  const [lookupWord, setLookupWord] = useState<string | null>(null);

  const PART_SIZE = 25;
  const totalParts = Math.ceil(lesson.segments.length / PART_SIZE);

  const handleRefreshFullTranscript = async () => {
    if (!lesson.youtubeId) return;
    setRefreshingFull(true);
    try {
      const res = await fetch(`/api/youtube/transcript?url=https://www.youtube.com/watch?v=${lesson.youtubeId}`);
      const data = await res.json();
      if (data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
        updateLessonSegments(lesson.id, data.segments);
        showToast(`Đã bóc trọn bộ ${data.segments.length} câu Full Video từ YouTube!`, 'success');
      } else {
        showToast(data.warning || 'Không tìm thấy thêm phụ đề mới cho video này', 'default');
      }
    } catch {
      showToast('Lỗi kết nối khi cập nhật phụ đề', 'error');
    } finally {
      setRefreshingFull(false);
    }
  };

  const playerRef = useRef<YTPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reactId = useId().replace(/:/g, '');
  const playerContainerId = `yt-player-${lesson.youtubeId || 'audio'}-${reactId}`;
  const fullInputRef = useRef<HTMLTextAreaElement | null>(null);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectSegment = useCallback(
    (nextIdx: number) => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      setSegIndex(nextIdx);
      setFullInput('');
      setBlankInputs({});
      setTappedChipIds([]);
      setWrongChipId(null);
      setRevealed(false);
      setCompletedNow(false);
      setLessonLastIndex(lesson.id, nextIdx);
    },
    [lesson.id, setLessonLastIndex]
  );

  const currentSeg: TranscriptSegment | undefined = lesson.segments[segIndex];
  const completedIds = useMemo(
    () => new Set(dictationProgress?.completedSegmentIds || []),
    [dictationProgress]
  );

  const tokens = useMemo(
    () => (currentSeg ? tokenizeSentence(currentSeg.text) : []),
    [currentSeg]
  );
  const blankIndices = useMemo(
    () => (currentSeg ? selectBlankIndices(currentSeg.text) : []),
    [currentSeg]
  );
  const scrambledChips = useMemo(
    () => (currentSeg ? createScrambledChips(currentSeg.text, segIndex + 11) : []),
    [currentSeg, segIndex]
  );

  // Mount YouTube IFrame API Player (only for YouTube lessons)
  useEffect(() => {
    if (isAudioLesson || !lesson.youtubeId) return;
    let mounted = true;
    loadYouTubeApi().then(() => {
      if (!mounted || !window.YT?.Player) return;
      const el = document.getElementById(playerContainerId);
      if (!el) return;

      playerRef.current = new window.YT.Player(playerContainerId, {
        videoId: lesson.youtubeId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 0,
          iv_load_policy: 3,
          controls: 1,
        },
        events: {
          onReady: (e) => {
            if (!mounted) return;
            setPlayerReady(true);
            e.target.setPlaybackRate(playbackRate);
          },
          onStateChange: (e) => {
            if (!mounted) return;
            const playing = e.data === (window.YT?.PlayerState?.PLAYING ?? 1);
            setIsPlaying(playing);
          },
        },
      });
    });

    return () => {
      mounted = false;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore cleanup errors
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.youtubeId, isAudioLesson]);

  // Sync playback rate for both YouTube & HTML5 Audio
  useEffect(() => {
    if (isAudioLesson) {
      if (audioRef.current) audioRef.current.playbackRate = playbackRate;
      return;
    }
    if (playerReady && playerRef.current) {
      try {
        playerRef.current.setPlaybackRate(playbackRate);
      } catch {
        // Ignore
      }
    }
  }, [playbackRate, playerReady, isAudioLesson]);

  const playSegment = useCallback(
    (seg?: TranscriptSegment) => {
      const target = seg || currentSeg;
      if (!target) return;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);

      if (isAudioLesson) {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, target.start - 0.1);
        audio.play().catch(() => {});
        return;
      }

      if (!playerRef.current) return;
      try {
        playerRef.current.seekTo(Math.max(0, target.start - 0.15), true);
        playerRef.current.playVideo();
      } catch {
        // Ignore
      }
    },
    [currentSeg, isAudioLesson]
  );

  const togglePlayPause = useCallback(() => {
    if (!currentSeg) return;
    if (isAudioLesson) {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) {
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
        audio.pause();
      } else {
        if (audio.currentTime < currentSeg.start - 0.3 || audio.currentTime >= currentSeg.end - 0.1) {
          playSegment();
        } else {
          audio.play().catch(() => {});
        }
      }
      return;
    }

    if (!playerRef.current) return;
    if (isPlaying) {
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      playerRef.current.pauseVideo();
    } else {
      const ct = playerRef.current.getCurrentTime?.() ?? 0;
      if (ct < currentSeg.start - 0.3 || ct >= currentSeg.end - 0.1) {
        playSegment();
      } else {
        playerRef.current.playVideo();
      }
    }
  }, [isPlaying, currentSeg, playSegment, isAudioLesson]);

  const rewindTwoSeconds = useCallback(() => {
    if (!currentSeg) return;
    if (isAudioLesson) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(currentSeg.start - 0.1, audio.currentTime - 2);
      audio.play().catch(() => {});
      return;
    }
    if (!playerRef.current) return;
    const ct = playerRef.current.getCurrentTime?.() ?? currentSeg.start;
    playerRef.current.seekTo(Math.max(currentSeg.start - 0.15, ct - 2), true);
    playerRef.current.playVideo();
  }, [currentSeg, isAudioLesson]);

  // Precision segment boundary monitor (60ms poll for both YouTube & Audio)
  useEffect(() => {
    if (!playerReady || !currentSeg) return;
    const interval = setInterval(() => {
      if (!isPlaying) return;
      const t = isAudioLesson
        ? audioRef.current?.currentTime ?? 0
        : playerRef.current?.getCurrentTime?.() ?? 0;

      if (t >= currentSeg.end + 0.15) {
        if (isAudioLesson) audioRef.current?.pause();
        else playerRef.current?.pauseVideo();

        if (autoLoop && !completedNow) {
          if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
          loopTimeoutRef.current = setTimeout(() => {
            playSegment(currentSeg);
          }, 950);
        }
      }
    }, 60);
    return () => clearInterval(interval);
  }, [playerReady, isPlaying, currentSeg, autoLoop, completedNow, playSegment, isAudioLesson]);

  const handleNextSegment = useCallback(() => {
    if (segIndex < lesson.segments.length - 1) {
      const nextIdx = segIndex + 1;
      selectSegment(nextIdx);
      setTimeout(() => playSegment(lesson.segments[nextIdx]), 120);
    }
  }, [segIndex, lesson.segments, playSegment, selectSegment]);

  const handlePrevSegment = useCallback(() => {
    if (segIndex > 0) {
      const prevIdx = segIndex - 1;
      selectSegment(prevIdx);
      setTimeout(() => playSegment(lesson.segments[prevIdx]), 120);
    }
  }, [segIndex, lesson.segments, playSegment, selectSegment]);

  // Trigger completion celebration (+ optional Auto-Advance!)
  const handleSentenceSuccess = useCallback(
    (accuracy = 100) => {
      if (!currentSeg || completedNow) return;
      setCompletedNow(true);
      playChime('success');
      vibrateLight(20);
      markSegmentComplete(lesson.id, currentSeg.id, segIndex, accuracy);

      const nextDoneCount = completedIds.has(currentSeg.id)
        ? completedIds.size
        : completedIds.size + 1;
      if (nextDoneCount === lesson.segments.length && lesson.segments.length > 0) {
        playChime('complete');
        confetti({ particleCount: 70, spread: 65, origin: { y: 0.7 } });
        showToast('Xuất sắc! Bạn đã hoàn thành toàn bộ bài nghe này!', 'success');
        return;
      }

      if (autoAdvance && segIndex < lesson.segments.length - 1) {
        if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = setTimeout(() => {
          handleNextSegment();
        }, 1350);
      }
    },
    [
      currentSeg,
      completedNow,
      markSegmentComplete,
      lesson.id,
      lesson.segments.length,
      segIndex,
      completedIds,
      showToast,
      autoAdvance,
      handleNextSegment,
    ]
  );

  // Full Dictation diffing
  const fullDiff = useMemo(
    () => (currentSeg ? diffDictation(currentSeg.text, fullInput) : null),
    [currentSeg, fullInput]
  );

  const handleFullInputChange = (nextVal: string) => {
    setFullInput(nextVal);
    if (!currentSeg || completedNow) return;
    const nextDiff = diffDictation(currentSeg.text, nextVal);
    if (nextDiff.isComplete) {
      handleSentenceSuccess(100);
    }
  };

  const handleBlankInputChange = (idx: number, nextVal: string) => {
    const nextMap = { ...blankInputs, [idx]: nextVal };
    setBlankInputs(nextMap);
    if (!currentSeg || blankIndices.length === 0 || completedNow) return;
    const allCorrect = blankIndices.every((bIdx) => {
      const typed = normalizeToken(nextMap[bIdx] || '');
      const target = tokens[bIdx]?.normalized || '';
      return typed === target && target.length > 0;
    });
    if (allCorrect) {
      handleSentenceSuccess(100);
    }
  };

  const handleChipTap = (chipId: string, tokenNormalized: string) => {
    if (completedNow || revealed) return;
    const expectedIndex = tappedChipIds.length;
    const expectedToken = tokens[expectedIndex];
    if (!expectedToken) return;

    if (tokenNormalized === expectedToken.normalized) {
      vibrateLight(10);
      const next = [...tappedChipIds, chipId];
      setTappedChipIds(next);
      setWrongChipId(null);
      if (next.length === tokens.length) {
        handleSentenceSuccess(100);
      }
    } else {
      playChime('error');
      vibrateLight([25, 30, 25]);
      setWrongChipId(chipId);
      setTimeout(() => setWrongChipId(null), 450);
    }
  };

  const handleHint = () => {
    if (!currentSeg || completedNow) return;

    if (mode === 'tap') {
      const expectedIndex = tappedChipIds.length;
      const expectedNorm = tokens[expectedIndex]?.normalized;
      const matchingChip = scrambledChips.find(
        (c) => !tappedChipIds.includes(c.id) && c.token.normalized === expectedNorm
      );
      if (matchingChip) {
        handleChipTap(matchingChip.id, matchingChip.token.normalized);
      }
      return;
    }

    if (mode === 'blanks') {
      const firstUnsolved = blankIndices.find(
        (idx) => normalizeToken(blankInputs[idx] || '') !== tokens[idx]?.normalized
      );
      if (firstUnsolved !== undefined) {
        const targetWord = tokens[firstUnsolved].clean;
        const cur = blankInputs[firstUnsolved] || '';
        const nextVal = targetWord.slice(0, Math.min(targetWord.length, cur.length + 2));
        handleBlankInputChange(firstUnsolved, nextVal);
      }
      return;
    }

    if (fullDiff) {
      const firstNotCorrect = fullDiff.words.findIndex((w) => w.status !== 'correct');
      if (firstNotCorrect !== -1) {
        const prefixWords = fullDiff.words.slice(0, firstNotCorrect + 1).map((w) => w.target.clean);
        handleFullInputChange(prefixWords.join(' ') + ' ');
        fullInputRef.current?.focus();
      }
    }
  };

  // Share link for Zalo (/?yt=VIDEO_ID)
  const handleShareLesson = async () => {
    if (!lesson.youtubeId) return;
    const shareUrl = `${window.location.origin}/?yt=${lesson.youtubeId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Luyện nghe: ${lesson.title}`,
          text: 'Cùng luyện nghe chép chính tả bài này trên WordNest nhé!',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or unsupported — fall back to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Đã chép link bài nghe — dán gửi qua Zalo là mở thẳng bài này!', 'success');
    } catch {
      showToast(shareUrl, 'default');
    }
  };

  // Keyboard shortcuts for Desktop power users
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        playSegment();
      } else if (e.key === 'Enter' && (completedNow || revealed)) {
        e.preventDefault();
        handleNextSegment();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSegment();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSegment();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playSegment, completedNow, revealed, handleNextSegment, handlePrevSegment]);

  // On-demand + auto Vietnamese translation when advancing sentences with "Dịch" ON
  const currentVi = currentSeg ? currentSeg.vi || viCache[currentSeg.id] : '';

  const fetchViForSegment = useCallback(async (seg: TranscriptSegment) => {
    setLoadingVi(true);
    try {
      const res = await fetch(`/api/translate?text=${encodeURIComponent(seg.text)}`);
      const d = await res.json();
      if (d.vi) {
        setViCache((prev) => ({ ...prev, [seg.id]: d.vi }));
      }
    } catch {
      // Ignore network errors cleanly
    } finally {
      setLoadingVi(false);
    }
  }, []);

  useEffect(() => {
    if (!showVi || !currentSeg || currentVi) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/translate?text=${encodeURIComponent(currentSeg.text)}`);
        const d = await res.json();
        if (!cancelled && d.vi) {
          setViCache((prev) => ({ ...prev, [currentSeg.id]: d.vi }));
        }
      } catch {
        // Ignore network errors cleanly
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [showVi, currentSeg, currentVi]);

  const handleToggleVi = () => {
    const next = !showVi;
    setShowVi(next);
    if (next && currentSeg && !currentVi) {
      fetchViForSegment(currentSeg);
    }
  };

  const handleSaveManualTranscript = () => {
    const segments = parseSrtOrLrc(manualText, lesson.durationSec || 120);
    if (!segments.length) {
      showToast('Hãy dán ít nhất 1 dòng phụ đề tiếng Anh hoặc nội dung SRT', 'error');
      return;
    }
    if (isAudioLesson) {
      onUpdateSessionAudioSegments(lesson.id, segments);
    } else {
      updateLessonSegments(lesson.id, segments);
    }
    selectSegment(0);
    setShowManualModal(false);
    showToast(`Đã tạo ${segments.length} câu luyện nghe!`, 'success');
  };

  const progressPct = lesson.segments.length
    ? Math.round((completedIds.size / lesson.segments.length) * 100)
    : 0;

  const visibleOutlineSegments = useMemo(() => {
    let segs = lesson.segments.map((seg, originalIndex) => ({ seg, originalIndex }));
    if (activePart !== 'all') {
      const startIdx = activePart * PART_SIZE;
      const endIdx = startIdx + PART_SIZE;
      segs = segs.slice(startIdx, endIdx);
    }
    if (drawerSearch.trim()) {
      const q = drawerSearch.trim().toLowerCase();
      segs = segs.filter(
        ({ seg, originalIndex }) =>
          seg.text.toLowerCase().includes(q) ||
          String(originalIndex + 1).includes(q) ||
          formatTime(seg.start).includes(q)
      );
    }
    return segs;
  }, [lesson.segments, activePart, drawerSearch]);

  return (
    <div className="space-y-4 pb-14 lg:pb-0">
      {/* Top Studio Bar (Sticky so Back & controls are always reachable without scrolling up!) */}
      <div
        className="sticky top-0 z-20 -mx-2 px-2 py-2 rounded-2xl backdrop-blur-md flex items-center justify-between gap-2"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--text2)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Kho bài nghe
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          {!isAudioLesson && (
            <>
              {!compactVideo && (
                <button
                  type="button"
                  onClick={() => setMaskVideoSubtitles((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    backgroundColor: maskVideoSubtitles ? 'var(--accent-soft)' : 'var(--card)',
                    borderColor: maskVideoSubtitles ? 'var(--accent)' : 'var(--border)',
                    color: maskVideoSubtitles ? 'var(--accent)' : 'var(--text2)',
                  }}
                  title="Che dải phụ đề YouTube ở cạnh dưới video để luyện nghe không bị lộ đáp án"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{maskVideoSubtitles ? 'Đang che sub' : 'Che sub video'}</span>
                </button>
              )}
              {lesson.youtubeId && (
                <button
                  type="button"
                  disabled={refreshingFull}
                  onClick={handleRefreshFullTranscript}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent)',
                  }}
                  title="Tải lại toàn bộ 100% câu từ YouTube"
                >
                  {refreshingFull ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Phụ đề Full</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareLesson}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text2)',
                }}
                title="Chia sẻ link bài nghe này qua Zalo"
              >
                <Share2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                <span className="hidden sm:inline">Chia sẻ</span>
              </button>

              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer"
                style={{
                  backgroundColor: focusMode ? 'var(--accent)' : 'var(--card)',
                  borderColor: focusMode ? 'var(--accent)' : 'var(--border)',
                  color: focusMode ? '#fff' : 'var(--text2)',
                }}
                title="Ẩn danh sách câu & thanh phụ để tập trung nghe chép 100%"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{focusMode ? 'Thoát tập trung' : 'Tập trung'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCompactVideo((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer"
                style={{
                  backgroundColor: compactVideo ? 'var(--accent-soft)' : 'var(--card)',
                  borderColor: compactVideo ? 'var(--accent)' : 'var(--border)',
                  color: compactVideo ? 'var(--accent)' : 'var(--text2)',
                }}
                title="Thu gọn video để có thêm không gian cho bàn phím điện thoại"
              >
                {compactVideo ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{compactVideo ? 'Hiện video' : 'Thu gọn'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowTranscriptDrawer((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer lg:hidden"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
          >
            <List className="w-3.5 h-3.5" />
            {segIndex + 1}/{lesson.segments.length}
          </button>

          {lesson.isCustom && (
            <button
              type="button"
              onClick={() => {
                setManualText(lesson.segments.map((s) => s.text).join('\n'));
                setShowManualModal(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl border cursor-pointer"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--text2)',
              }}
              title="Chỉnh sửa / Dán transcript hoặc SRT"
            >
              <FileEdit className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Part Navigator (If video is long with > 25 sentences) */}
      {totalParts > 1 && !focusMode && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 rounded-xl border text-xs"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <span className="text-[11px] font-semibold shrink-0 flex items-center gap-1" style={{ color: 'var(--text3)' }}>
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Phân đoạn ({lesson.segments.length} câu):
          </span>
          <button
            type="button"
            onClick={() => setActivePart('all')}
            className="px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors cursor-pointer"
            style={{
              backgroundColor: activePart === 'all' ? 'var(--accent)' : 'transparent',
              color: activePart === 'all' ? '#fff' : 'var(--text2)',
            }}
          >
            Tất cả ({lesson.segments.length})
          </button>
          {Array.from({ length: totalParts }).map((_, pIdx) => {
            const start = pIdx * PART_SIZE + 1;
            const end = Math.min((pIdx + 1) * PART_SIZE, lesson.segments.length);
            const isSelected = activePart === pIdx;
            return (
              <button
                key={pIdx}
                type="button"
                onClick={() => {
                  setActivePart(pIdx);
                  selectSegment(pIdx * PART_SIZE);
                }}
                className="px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors cursor-pointer"
                style={{
                  backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg2)',
                  color: isSelected ? '#fff' : 'var(--text2)',
                }}
              >
                Phần {pIdx + 1} ({start}–{end})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className={`${focusMode ? 'lg:col-span-10 lg:col-start-2' : 'lg:col-span-8'} space-y-3.5`}>
          {/* Media Player Card (YouTube IFrame OR HTML5 Audio) */}
          <div className="bg-warm-card rounded-2xl overflow-hidden">
            {isAudioLesson ? (
              <div
                className="p-4 border-b space-y-2.5"
                style={{ backgroundColor: 'var(--bg2)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif-display font-semibold text-sm truncate">{lesson.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text3)' }}>
                      Audio IELTS / MP3 · Câu {segIndex + 1}/{lesson.segments.length}
                    </p>
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={lesson.audioUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-10"
                />
              </div>
            ) : (
              <>
                <div
                  className={`relative w-full bg-black transition-all duration-300 ${
                    compactVideo ? 'h-0 opacity-0 pointer-events-none' : 'aspect-video'
                  }`}
                >
                  <div id={playerContainerId} className="w-full h-full" />
                  {maskVideoSubtitles && !compactVideo && (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-10 h-[20%] backdrop-blur-md bg-black/55 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="text-[11px] font-medium text-white/75 tracking-wide">
                        Đã che phụ đề gốc video
                      </span>
                    </div>
                  )}
                </div>

                {compactVideo && (
                  <div
                    className="px-4 py-3 flex items-center justify-between gap-3 border-b"
                    style={{ backgroundColor: 'var(--bg2)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
                      >
                        <Headphones className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{lesson.title}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
                          Chế độ Audio tiết kiệm màn hình · Câu {segIndex + 1}/{lesson.segments.length}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--accent)' }}>
                      {currentSeg ? `${formatTime(currentSeg.start)}–${formatTime(currentSeg.end)}` : ''}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Playback Control Strip */}
            <div className="p-3 sm:px-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevSegment}
                  disabled={segIndex === 0}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-35 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  aria-label="Câu trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="h-9 px-3.5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  {isPlaying ? 'Tạm dừng' : 'Nghe câu này'}
                </button>

                <button
                  type="button"
                  onClick={rewindTwoSeconds}
                  className="h-9 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  title="Tua lại 2 giây"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  -2s
                </button>

                <button
                  type="button"
                  onClick={handleNextSegment}
                  disabled={segIndex >= lesson.segments.length - 1}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-35 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  aria-label="Câu tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoLoop((v) => !v)}
                  className="h-9 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: autoLoop ? 'var(--accent-soft)' : 'transparent',
                    borderColor: autoLoop ? 'var(--accent)' : 'var(--border)',
                    color: autoLoop ? 'var(--accent)' : 'var(--text3)',
                  }}
                  title="Tự động lặp lại câu hiện tại"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Lặp
                </button>

                <button
                  type="button"
                  onClick={() => setAutoAdvance((v) => !v)}
                  className="h-9 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: autoAdvance ? 'var(--green-soft)' : 'transparent',
                    borderColor: autoAdvance ? 'var(--green)' : 'var(--border)',
                    color: autoAdvance ? 'var(--green)' : 'var(--text3)',
                  }}
                  title="Tự động chuyển sang câu tiếp theo sau khi gõ đúng"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tự chuyển</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (SPEED_OPTIONS.indexOf(playbackRate) + 1) % SPEED_OPTIONS.length;
                    setPlaybackRate(SPEED_OPTIONS[nextIdx]);
                  }}
                  className="h-9 px-2.5 rounded-xl border text-xs font-semibold tabular-nums inline-flex items-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  title="Đổi tốc độ phát"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  {playbackRate}x
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Dictation Card */}
          {!currentSeg ? (
            <div className="bg-warm-card rounded-2xl p-8 text-center space-y-3">
              <p className="font-medium">Bài nghe này chưa có câu phụ đề nào</p>
              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Dán phụ đề / SRT thủ công
              </button>
            </div>
          ) : (
            <div className="bg-warm-card rounded-2xl p-4 sm:p-6 space-y-4">
              {/* Sentence Progress & Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums"
                    style={{ backgroundColor: 'var(--bg2)', color: 'var(--text2)' }}
                  >
                    Câu {segIndex + 1} / {lesson.segments.length}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text3)' }}>
                    {formatTime(currentSeg.start)} – {formatTime(currentSeg.end)}
                  </span>
                  {completedIds.has(currentSeg.id) && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: 'var(--green)' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã xong
                    </span>
                  )}
                </div>

                {/* 3 Modes Switcher */}
                <div
                  className="inline-flex rounded-xl p-1 border"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                >
                  {(
                    [
                      { id: 'tap', label: 'Chạm từ', icon: Wand2 },
                      { id: 'blanks', label: 'Điền khuyết', icon: Sparkles },
                      { id: 'full', label: 'Gõ full', icon: Keyboard },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-all cursor-pointer"
                        style={{
                          backgroundColor: active ? 'var(--card)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text3)',
                          boxShadow: active ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── MODE 1: TAP TO ORDER ── */}
              {mode === 'tap' && !revealed && (
                <div className="space-y-4">
                  <div
                    className="min-h-[76px] rounded-2xl p-3.5 border-2 border-dashed flex flex-wrap gap-2 items-center transition-colors"
                    style={{
                      backgroundColor: completedNow ? 'var(--green-soft)' : 'var(--bg)',
                      borderColor: completedNow ? 'var(--green-border)' : 'var(--border2)',
                    }}
                  >
                    {tappedChipIds.length === 0 ? (
                      <span className="text-sm italic" style={{ color: 'var(--text3)' }}>
                        Nghe và chạm vào các từ bên dưới theo đúng thứ tự...
                      </span>
                    ) : (
                      tappedChipIds.map((id, i) => {
                        const tok = tokens[i];
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => completedNow && setLookupWord(tok.clean)}
                            className="px-3 py-1.5 rounded-xl text-sm font-medium border transition-transform active:scale-95 cursor-pointer"
                            style={{
                              backgroundColor: 'var(--card)',
                              borderColor: completedNow ? 'var(--green)' : 'var(--accent)',
                              color: completedNow ? 'var(--green)' : 'var(--text)',
                            }}
                          >
                            {tok?.raw}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {!completedNow && (
                    <div className="flex flex-wrap gap-2">
                      {scrambledChips.map((chip) => {
                        const used = tappedChipIds.includes(chip.id);
                        const isWrong = wrongChipId === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            disabled={used}
                            onClick={() => handleChipTap(chip.id, chip.token.normalized)}
                            className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer active:scale-95 ${
                              used ? 'opacity-20 pointer-events-none' : ''
                            } ${isWrong ? 'animate-pulse' : ''}`}
                            style={{
                              backgroundColor: isWrong ? 'var(--red-soft)' : 'var(--card)',
                              borderColor: isWrong ? 'var(--red)' : 'var(--border)',
                              color: isWrong ? 'var(--red)' : 'var(--text)',
                            }}
                          >
                            {chip.token.clean}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── MODE 2: FILL IN THE BLANKS ── */}
              {mode === 'blanks' && !revealed && (
                <div
                  className="rounded-2xl p-4 border leading-loose text-base sm:text-lg flex flex-wrap items-baseline gap-x-1.5 gap-y-2.5"
                  style={{
                    backgroundColor: completedNow ? 'var(--green-soft)' : 'var(--bg)',
                    borderColor: completedNow ? 'var(--green-border)' : 'var(--border)',
                  }}
                >
                  {tokens.map((tok, idx) => {
                    const isBlank = blankIndices.includes(idx);
                    const isSaved = savedWordNorms.has(tok.normalized);
                    if (!isBlank) {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLookupWord(tok.clean)}
                          className={`hover:underline decoration-dotted underline-offset-4 cursor-pointer rounded px-0.5 ${
                            isSaved ? 'underline decoration-2' : ''
                          }`}
                          style={{
                            color: 'var(--text)',
                            textDecorationColor: isSaved ? 'var(--gold)' : undefined,
                          }}
                          title={isSaved ? 'Từ đã có trong kho WordNest — chạm để xem lại' : 'Chạm để tra từ'}
                        >
                          {tok.raw}
                        </button>
                      );
                    }

                    const val = blankInputs[idx] || '';
                    const isRight = normalizeToken(val) === tok.normalized && tok.normalized.length > 0;
                    const widthCh = Math.max(5, tok.clean.length + 2);

                    return (
                      <span key={idx} className="inline-flex items-baseline">
                        {tok.leadingPunct}
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleBlankInputChange(idx, e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          style={{
                            width: `${widthCh}ch`,
                            backgroundColor: isRight ? 'var(--green-soft)' : 'var(--card)',
                            borderColor: isRight ? 'var(--green)' : 'var(--accent)',
                            color: isRight ? 'var(--green)' : 'var(--text)',
                          }}
                          className="border-b-2 rounded-t-md px-1.5 py-0.5 text-center font-medium outline-none text-sm sm:text-base transition-colors"
                          placeholder={'•'.repeat(Math.min(6, tok.clean.length))}
                        />
                        {tok.trailingPunct}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* ── MODE 3: FULL DICTATION (DOL PRO STYLE) ── */}
              {mode === 'full' && !revealed && (
                <div className="space-y-3.5">
                  <div
                    className="rounded-2xl p-4 border min-h-[72px] flex flex-wrap gap-x-2 gap-y-2 items-center"
                    style={{
                      backgroundColor: completedNow ? 'var(--green-soft)' : 'var(--bg)',
                      borderColor: completedNow ? 'var(--green-border)' : 'var(--border)',
                    }}
                  >
                    {fullDiff?.words.map((w, idx) => {
                      if (w.status === 'correct') {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLookupWord(w.target.clean)}
                            className="font-serif-display text-base sm:text-lg font-medium hover:underline cursor-pointer"
                            style={{ color: 'var(--green)' }}
                          >
                            {w.target.raw}
                          </button>
                        );
                      }
                      if (w.status === 'partial') {
                        return (
                          <span
                            key={idx}
                            className="font-serif-display text-base sm:text-lg px-1.5 rounded-md"
                            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
                          >
                            {w.typed}
                            <span className="opacity-35">
                              {'_'.repeat(Math.max(1, w.target.clean.length - w.typed.length))}
                            </span>
                          </span>
                        );
                      }
                      if (w.status === 'wrong') {
                        return (
                          <span
                            key={idx}
                            className="font-serif-display text-base sm:text-lg px-1.5 rounded-md"
                            style={{ backgroundColor: 'var(--red-soft)', color: 'var(--red)' }}
                          >
                            {w.typed}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={idx}
                          className="inline-block h-5 rounded-md border-b-2"
                          style={{
                            width: `${Math.max(24, w.target.clean.length * 8)}px`,
                            borderColor: 'var(--border2)',
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs px-0.5">
                      <span style={{ color: 'var(--text3)' }}>
                        Gõ toàn bộ câu (tự xuống dòng khi câu dài)
                      </span>
                      {fullDiff && fullDiff.totalCount > 0 && (
                        <span
                          className="font-semibold tabular-nums px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: fullDiff.isComplete ? 'var(--green-soft)' : 'var(--bg2)',
                            color: fullDiff.isComplete ? 'var(--green)' : 'var(--text2)',
                          }}
                        >
                          {fullDiff.correctCount}/{fullDiff.totalCount} từ đúng
                        </span>
                      )}
                    </div>
                    <textarea
                      ref={fullInputRef}
                      rows={Math.min(5, Math.max(2, Math.ceil((fullInput.length + 1) / 48)))}
                      value={fullInput}
                      onChange={(e) => handleFullInputChange(e.target.value.replace(/\r?\n/g, ' '))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (completedNow || revealed) {
                            handleNextSegment();
                          } else {
                            playSegment();
                          }
                        }
                      }}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="Nghe và gõ lại câu bạn nghe được..."
                      className="w-full rounded-xl px-4 py-3 text-base leading-relaxed border-2 outline-none transition-colors resize-none"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: completedNow ? 'var(--green)' : 'var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ── REVEALED / COMPLETED TRANSCRIPT WITH AUTO-HIGHLIGHT SAVED WORDS ── */}
              {(revealed || completedNow) && (
                <div
                  className="rounded-2xl p-4 border space-y-2"
                  style={{
                    backgroundColor: completedNow ? 'var(--green-soft)' : 'var(--accent-soft)',
                    borderColor: completedNow ? 'var(--green-border)' : 'var(--border2)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: completedNow ? 'var(--green)' : 'var(--accent)' }}
                    >
                      {completedNow ? (
                        <>
                          <Check className="w-4 h-4" /> Chính xác tuyệt đối!
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" /> Đáp án câu này
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-normal" style={{ color: 'var(--text3)' }}>
                      <BookmarkCheck className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
                      Từ tô vàng đã có trong WordNest · Chạm từ bất kỳ để tra/lưu
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 pt-1">
                    {tokens.map((tok, idx) => {
                      const isSaved = savedWordNorms.has(tok.normalized);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLookupWord(tok.clean)}
                          className="font-serif-display text-base sm:text-lg px-1.5 py-0.5 rounded-lg hover:underline decoration-2 underline-offset-4 transition-colors cursor-pointer"
                          style={{
                            color: isSaved ? 'var(--gold)' : 'var(--text)',
                            backgroundColor: isSaved ? 'var(--gold-soft)' : 'transparent',
                            fontWeight: isSaved ? 600 : 400,
                          }}
                          title={
                            isSaved
                              ? `"${tok.clean}" đã có trong kho WordNest — chạm để ôn lại`
                              : `Tra và lưu "${tok.clean}" vào WordNest`
                          }
                        >
                          {tok.raw}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SHADOWING PRONUNCIATION PANEL */}
              {showShadowing && (
                <ShadowingPanel
                  key={currentSeg.id}
                  targetText={currentSeg.text}
                  onReplayAudio={() => playSegment()}
                />
              )}

              {/* Vietnamese Translation Box */}
              {showVi && (
                <div
                  className="rounded-xl px-3.5 py-2.5 text-sm border flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--text2)',
                  }}
                >
                  <Languages className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                  {loadingVi ? (
                    <span className="text-xs italic">Đang dịch sang tiếng Việt...</span>
                  ) : (
                    <span>{currentVi || 'Không có bản dịch tiếng Việt cho câu này.'}</span>
                  )}
                </div>
              )}

              {/* Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleHint}
                    disabled={completedNow || revealed}
                    className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  >
                    <Lightbulb className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
                    Gợi ý
                  </button>

                  <button
                    type="button"
                    onClick={() => setRevealed((v) => !v)}
                    className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {revealed ? 'Ẩn' : 'Đáp án'}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleVi}
                    className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    style={{
                      backgroundColor: showVi ? 'var(--accent-soft)' : 'transparent',
                      borderColor: showVi ? 'var(--accent)' : 'var(--border)',
                      color: showVi ? 'var(--accent)' : 'var(--text2)',
                    }}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    Dịch
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowShadowing((v) => !v)}
                    className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    style={{
                      backgroundColor: showShadowing ? 'var(--accent-soft)' : 'transparent',
                      borderColor: showShadowing ? 'var(--accent)' : 'var(--border)',
                      color: showShadowing ? 'var(--accent)' : 'var(--text2)',
                    }}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Shadowing
                  </button>
                </div>

                {segIndex < lesson.segments.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNextSegment}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: completedNow || revealed ? 'var(--green)' : 'var(--accent)',
                    }}
                  >
                    Câu tiếp
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <p className="hidden md:block text-[11px]" style={{ color: 'var(--text3)' }}>
                Phím tắt: <kbd className="px-1.5 py-0.5 rounded border">Tab</kbd> nghe lại câu ·{' '}
                <kbd className="px-1.5 py-0.5 rounded border">Enter</kbd> sang câu tiếp khi xong ·{' '}
                <kbd className="px-1.5 py-0.5 rounded border">Alt + ←/→</kbd> chuyển câu
              </p>
            </div>
          )}
        </div>

        {/* Right Column (Desktop) / Modal Drawer (Mobile): Transcript Outline */}
        {!focusMode && (
        <div
          className={`${
            showTranscriptDrawer
              ? 'fixed inset-0 z-40 bg-black/45 p-4 flex items-end lg:static lg:bg-transparent lg:p-0 lg:block'
              : 'hidden lg:block'
          } lg:col-span-4`}
          onClick={() => setShowTranscriptDrawer(false)}
        >
          <div
            className="w-full max-h-[75dvh] lg:max-h-[calc(100vh-140px)] bg-warm-card rounded-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-semibold text-sm">Danh sách câu ({lesson.segments.length})</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  Hoàn thành {completedIds.size}/{lesson.segments.length} ({progressPct}%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscriptDrawer(false)}
                className="lg:hidden p-1.5 rounded-lg"
                style={{ color: 'var(--text3)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick search inside sentences list */}
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400" />
                <input
                  type="text"
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  placeholder="Tìm câu trong bài..."
                  className="w-full rounded-lg pl-8 pr-7 py-1.5 text-xs border outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                />
                {drawerSearch && (
                  <button
                    type="button"
                    onClick={() => setDrawerSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="h-1 w-full" style={{ backgroundColor: 'var(--bg3)' }}>
              <div
                className="h-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: 'var(--green)' }}
              />
            </div>

            <div className="overflow-y-auto p-2 space-y-1 flex-1">
              {visibleOutlineSegments.length === 0 ? (
                <div className="p-6 text-center text-xs" style={{ color: 'var(--text3)' }}>
                  Không tìm thấy câu nào khớp với từ khóa
                </div>
              ) : (
                visibleOutlineSegments.map(({ seg, originalIndex: i }) => {
                  const isCurrent = i === segIndex;
                  const isDone = completedIds.has(seg.id);
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => {
                        selectSegment(i);
                        setShowTranscriptDrawer(false);
                        setTimeout(() => playSegment(seg), 100);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isCurrent ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: isDone
                            ? 'var(--green)'
                            : isCurrent
                              ? 'var(--accent)'
                              : 'var(--bg2)',
                          color: isDone || isCurrent ? '#fff' : 'var(--text3)',
                        }}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text3)' }}>
                          <span>Câu #{i + 1}</span>
                          <span className="font-mono">{formatTime(seg.start)}</span>
                        </div>
                        <p
                          className="text-xs mt-0.5 truncate"
                          style={{ color: isDone ? 'var(--text)' : 'var(--text3)' }}
                        >
                          {isDone ? seg.text : '•••••••••••• (chưa hoàn thành)'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* MOBILE FLOATING QUICK-REPLAY PILL (Always 1 thumb-tap away above bottom nav!) */}
      {currentSeg && (
        <div className="lg:hidden fixed bottom-18 left-1/2 -translate-x-1/2 z-20">
          <div
            className="rounded-full px-2 py-1.5 shadow-lg border backdrop-blur-md flex items-center gap-1.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--card) 94%, transparent)',
              borderColor: 'var(--border2)',
            }}
          >
            <button
              type="button"
              onClick={rewindTwoSeconds}
              className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              style={{ color: 'var(--text2)' }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> -2s
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              className="px-3.5 py-1 rounded-full text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlaying ? 'Dừng' : 'Nghe lại'}
            </button>
            <button
              type="button"
              onClick={handleHint}
              disabled={completedNow || revealed}
              className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
              style={{ color: 'var(--gold)' }}
            >
              <Lightbulb className="w-3.5 h-3.5" /> Gợi ý
            </button>
          </div>
        </div>
      )}

      {/* 1-Click Word Lookup & Save Popover */}
      <WordLookupPopover
        word={lookupWord}
        contextSentence={currentSeg?.text}
        sourceVideoId={lesson.youtubeId || lesson.id}
        onClose={() => setLookupWord(null)}
      />

      {/* Manual Transcript / SRT Editor Modal */}
      {showManualModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowManualModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-5 border shadow-2xl space-y-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif-display font-semibold text-lg">Dán phụ đề / SRT thủ công</h3>
              <button type="button" onClick={() => setShowManualModal(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
              Hỗ trợ dán trực tiếp nội dung file <strong>.SRT, .VTT, .LRC</strong> (giữ nguyên timestamp chuẩn xác) hoặc lời thoại tiếng Anh mỗi dòng 1 câu!
            </p>
            <textarea
              rows={7}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={'Hello everyone, welcome back to my channel.\nToday we are going to talk about building better habits.'}
              className="w-full rounded-xl p-3 text-sm border outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-xl text-sm border cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveManualTranscript}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Lưu & Luyện ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

