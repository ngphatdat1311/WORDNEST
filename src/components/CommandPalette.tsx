'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  Headphones,
  Home,
  Layers,
  Moon,
  PenLine,
  PlusCircle,
  Rocket,
  Search,
  Sparkles,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { CURATED_LESSONS_META } from '@/lib/curated-lessons-meta';
import { getLessonSegmentCount } from '@/lib/lesson-loader';
import { speakEnglish } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { NavTab } from '@/types/wordnest';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onLookupWord: (word: string) => void;
}

interface PaletteEntry {
  id: string;
  group: 'action' | 'lesson' | 'word' | 'lookup';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  pronounceText?: string;
  onSelect: () => void;
}

export function CommandPalette({ open, onClose, onLookupWord }: CommandPaletteProps) {
  const words = useWordNestStore((s) => s.words);
  const customLessons = useWordNestStore((s) => s.customLessons);
  const theme = useWordNestStore((s) => s.theme);
  const setActiveTab = useWordNestStore((s) => s.setActiveTab);
  const openDictationLesson = useWordNestStore((s) => s.openDictationLesson);
  const toggleTheme = useWordNestStore((s) => s.toggleTheme);

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteEntry[] = [];

    const navActions: Array<{ id: NavTab; title: string; subtitle: string; icon: React.ReactNode }> = [
      { id: 'home', title: 'Trang chủ', subtitle: 'Tổng quan mục tiêu & bài nghe hôm nay', icon: <Home className="w-4 h-4" /> },
      { id: 'dictation', title: 'Nghe YouTube (DOL Studio)', subtitle: 'Thư viện video & dán link bất kỳ', icon: <Headphones className="w-4 h-4" /> },
      { id: 'flashcard', title: 'Flashcard SRS', subtitle: 'Ôn thẻ đến hạn theo thuật toán FSRS v5', icon: <Layers className="w-4 h-4" /> },
      { id: 'quiz', title: 'Quiz Trắc Nghiệm', subtitle: 'Kiểm tra nhanh 4 đáp án', icon: <Brain className="w-4 h-4" /> },
      { id: 'spelling', title: 'Luyện Chính Tả', subtitle: 'Nghe phát âm & gõ từ điền khuyết', icon: <PenLine className="w-4 h-4" /> },
      { id: 'game', title: 'Không Chiến Từ Vựng', subtitle: 'Game bắn máy bay luyện phản xạ gõ', icon: <Rocket className="w-4 h-4" /> },
      { id: 'wordlist', title: 'Từ Điển Cá Nhân', subtitle: `Quản lý ${words.length} từ & thư mục`, icon: <BookOpen className="w-4 h-4" /> },
      { id: 'add', title: 'Thêm Từ Mới', subtitle: 'Tra tự động IPA + nghĩa hoặc nhập hàng loạt', icon: <PlusCircle className="w-4 h-4" /> },
      { id: 'progress', title: 'Tiến Độ & Đồng Bộ', subtitle: 'Heatmap 20 tuần, sao lưu & Supabase Sync', icon: <BarChart3 className="w-4 h-4" /> },
    ];

    // 1. Direct lookup suggestion if user typed an English-looking query
    if (q && /^[a-zA-Z][a-zA-Z\s'-]{1,40}$/.test(query.trim())) {
      const clean = query.trim();
      list.push({
        id: `lookup:${clean}`,
        group: 'lookup',
        title: `Tra từ điển & lưu "${clean}"`,
        subtitle: 'Mở khung tra IPA, phát âm bản ngữ và nghĩa tiếng Việt ngay',
        icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />,
        onSelect: () => {
          onClose();
          onLookupWord(clean);
        },
      });
    }

    // 2. Matching vocabulary words
    if (q) {
      const matchedWords = words
        .filter(
          (w) =>
            w.word.toLowerCase().includes(q) ||
            w.meaning.toLowerCase().includes(q) ||
            (w.example && w.example.toLowerCase().includes(q))
        )
        .slice(0, 8);

      for (const w of matchedWords) {
        list.push({
          id: `word:${w.id}`,
          group: 'word',
          title: w.phonetic ? `${w.word}  ${w.phonetic}` : w.word,
          subtitle: w.meaning,
          icon: <BookOpen className="w-4 h-4" style={{ color: 'var(--green)' }} />,
          pronounceText: w.word,
          onSelect: () => {
            onClose();
            onLookupWord(w.word);
          },
        });
      }
    }

    // 3. Matching YouTube lessons
    const allLessons = [...customLessons, ...CURATED_LESSONS_META];
    const matchedLessons = (
      q
        ? allLessons.filter(
            (l) =>
              l.title.toLowerCase().includes(q) ||
              l.channel.toLowerCase().includes(q) ||
              (l.description && l.description.toLowerCase().includes(q))
          )
        : allLessons.slice(0, 4)
    ).slice(0, 6);

    for (const lesson of matchedLessons) {
      list.push({
        id: `lesson:${lesson.id}`,
        group: 'lesson',
        title: lesson.title,
        subtitle: `${lesson.channel} · ${getLessonSegmentCount(lesson)} câu`,
        icon: <Headphones className="w-4 h-4" style={{ color: 'var(--accent)' }} />,
        onSelect: () => {
          openDictationLesson(lesson.id);
          onClose();
        },
      });
    }

    // 4. Matching navigation / quick actions
    for (const act of navActions) {
      if (
        !q ||
        act.title.toLowerCase().includes(q) ||
        act.subtitle.toLowerCase().includes(q)
      ) {
        list.push({
          id: `nav:${act.id}`,
          group: 'action',
          title: act.title,
          subtitle: act.subtitle,
          icon: act.icon,
          onSelect: () => {
            setActiveTab(act.id);
            onClose();
          },
        });
      }
    }

    if (!q || 'dark light tối sáng giao diện theme'.includes(q)) {
      list.push({
        id: 'action:theme',
        group: 'action',
        title: theme === 'light' ? 'Chuyển sang giao diện Tối (Dark Mode)' : 'Chuyển sang giao diện Sáng (Light Mode)',
        subtitle: 'Đổi tông màu Warm Academia',
        icon: theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
        onSelect: () => {
          toggleTheme();
          onClose();
        },
      });
    }

    return list;
  }, [query, words, customLessons, theme, onClose, onLookupWord, openDictationLesson, setActiveTab, toggleTheme]);

  const safeIdx = entries.length > 0 ? Math.min(selectedIdx, entries.length - 1) : 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text3)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(entries.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && entries[safeIdx]) {
                e.preventDefault();
                entries[safeIdx].onSelect();
              }
            }}
            placeholder="Tìm từ vựng, mở nhanh video YouTube, tra từ mới hoặc chuyển mục..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg cursor-pointer"
            style={{ color: 'var(--text3)' }}
            aria-label="Đóng tìm kiếm nhanh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-0.5">
          {entries.length === 0 ? (
            <div className="py-10 text-center text-xs" style={{ color: 'var(--text3)' }}>
              Không tìm thấy kết quả phù hợp cho &ldquo;{query}&rdquo;.
            </div>
          ) : (
            entries.map((item, idx) => {
              const active = idx === safeIdx;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={item.onSelect}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <div className="shrink-0" style={{ color: 'var(--text2)' }}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="text-xs truncate" style={{ color: 'var(--text3)' }}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.pronounceText && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakEnglish(item.pronounceText!);
                      }}
                      className="p-1.5 rounded-lg border shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--accent)',
                      }}
                      aria-label="Phát âm"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          className="px-4 py-2 border-t flex items-center justify-between text-[11px]"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg2)',
            color: 'var(--text3)',
          }}
        >
          <span>↑↓ di chuyển · Enter mở · Esc đóng</span>
          <span className="font-mono">Ctrl+K / ⌘K</span>
        </div>
      </div>
    </div>
  );
}
