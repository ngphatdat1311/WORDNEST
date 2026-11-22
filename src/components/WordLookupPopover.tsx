'use client';

import React, { useEffect, useState } from 'react';
import { BookmarkCheck, BookmarkPlus, Loader2, Volume2, X } from 'lucide-react';
import { LookupResult } from '@/types/wordnest';
import { playAudioUrlOrSpeak } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';

interface WordLookupPopoverProps {
  word: string | null;
  contextSentence?: string;
  sourceVideoId?: string;
  onClose: () => void;
}

export function WordLookupPopover({
  word,
  contextSentence,
  sourceVideoId,
  onClose,
}: WordLookupPopoverProps) {
  const [fetchedFor, setFetchedFor] = useState<string>('');
  const [data, setData] = useState<LookupResult | null>(null);
  const [customMeaning, setCustomMeaning] = useState('');
  const [error, setError] = useState('');

  const words = useWordNestStore((s) => s.words);
  const addWord = useWordNestStore((s) => s.addWord);
  const showToast = useWordNestStore((s) => s.showToast);

  const cleanWord = (word || '').replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
  const loading = Boolean(cleanWord) && fetchedFor !== cleanWord;
  const alreadySaved = words.some(
    (w) => w.word.toLowerCase() === cleanWord.toLowerCase()
  );

  useEffect(() => {
    if (!cleanWord) return;
    let cancelled = false;

    fetch(`/api/lookup?word=${encodeURIComponent(cleanWord)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setData(null);
          setCustomMeaning('');
          setError(res.error);
        } else {
          setError('');
          setData(res);
          setCustomMeaning(res.meaning || '');
        }
        setFetchedFor(cleanWord);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setCustomMeaning('');
          setError('Không tra được từ lúc này.');
          setFetchedFor(cleanWord);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cleanWord]);

  if (!word || !cleanWord) return null;

  const handleSave = () => {
    const meaning = customMeaning.trim() || data?.meaning || '';
    if (!meaning) {
      showToast('Hãy nhập nghĩa tiếng Việt trước khi lưu', 'error');
      return;
    }
    const res = addWord({
      word: cleanWord,
      phonetic: data?.phonetic || '',
      meaning,
      example: contextSentence || data?.examples?.[0] || '',
      type: data?.type || 'other',
      category: sourceVideoId ? 'YouTube' : 'Tra nhanh',
      level: data?.level || 'medium',
      sourceVideoId,
    });
    if (res.ok) {
      showToast(`Đã lưu "${cleanWord}" vào WordNest!`, 'success');
      onClose();
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-safe shadow-2xl border transition-all"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-serif-display text-2xl font-semibold" style={{ color: 'var(--text)' }}>
                {cleanWord}
              </h3>
              <button
                type="button"
                onClick={() => playAudioUrlOrSpeak(cleanWord, data?.audioUrl)}
                className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors hover:opacity-80 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg2)',
                  borderColor: 'var(--border)',
                  color: 'var(--accent)',
                }}
                aria-label="Nghe phát âm"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            {data?.phonetic && !loading && (
              <p className="text-sm italic mt-0.5" style={{ color: 'var(--text3)' }}>
                {data.phonetic}
                {data.type && data.type !== 'other' ? ` · ${data.type}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: 'var(--text3)' }}
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text3)' }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-sm">Đang tra từ điển...</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {error && (
              <p className="text-sm" style={{ color: 'var(--red)' }}>
                {error}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text3)' }}>
                Nghĩa tiếng Việt
              </label>
              <input
                type="text"
                value={customMeaning}
                onChange={(e) => setCustomMeaning(e.target.value)}
                placeholder="Nhập nghĩa tiếng Việt..."
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
              {data?.altMeanings && data.altMeanings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.altMeanings.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      onClick={() => setCustomMeaning(alt)}
                      className="text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors"
                      style={{
                        backgroundColor: 'var(--bg2)',
                        borderColor: 'var(--border)',
                        color: 'var(--text2)',
                      }}
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(contextSentence || data?.examples?.[0]) && (
              <div
                className="rounded-xl p-3 text-xs leading-relaxed border"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text2)',
                }}
              >
                <span className="font-semibold block mb-0.5" style={{ color: 'var(--text3)' }}>
                  Ngữ cảnh lưu kèm:
                </span>
                <span className="italic">&ldquo;{contextSentence || data?.examples?.[0]}&rdquo;</span>
              </div>
            )}

            <div className="pt-1 flex gap-2">
              {alreadySaved ? (
                <div
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border"
                  style={{
                    backgroundColor: 'var(--green-soft)',
                    borderColor: 'var(--green-border)',
                    color: 'var(--green)',
                  }}
                >
                  <BookmarkCheck className="w-4 h-4" />
                  Đã có trong kho WordNest
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Lưu vào WordNest (SRS)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
