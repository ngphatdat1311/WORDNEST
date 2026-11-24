'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  Volume2,
} from 'lucide-react';
import { parseBulkLine } from '@/lib/dictation-engine';
import { playAudioUrlOrSpeak } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { LookupResult, WordLevel, WordType } from '@/types/wordnest';

export function AddWordView() {
  const folders = useWordNestStore((s) => s.folders);
  const addWord = useWordNestStore((s) => s.addWord);
  const bulkAddWords = useWordNestStore((s) => s.bulkAddWords);
  const showToast = useWordNestStore((s) => s.showToast);

  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [type, setType] = useState<WordType>('noun');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState<WordLevel>('medium');
  const [folderId, setFolderId] = useState('');

  // Auto-lookup state
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);

  // Bulk add state
  const [bulkText, setBulkText] = useState('');
  const [bulkFolderId, setBulkFolderId] = useState('');

  // Debounced server-side auto-lookup (zero CORS issues, with AbortController against race conditions!)
  useEffect(() => {
    const clean = word.trim();
    if (clean.length < 2) return;

    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(async () => {
      setLookupStatus('loading');
      try {
        const res = await fetch(`/api/lookup?word=${encodeURIComponent(clean)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const data: LookupResult = await res.json();
        if (cancelled) return;
        setLookupData(data);
        setExampleIdx(0);
        if (data.phonetic) setPhonetic(data.phonetic);
        if (data.meaning) setMeaning(data.meaning);
        if (data.type) setType(data.type);
        if (data.level) setLevel(data.level);
        if (data.examples?.[0]) setExample(data.examples[0]);
        setLookupStatus('done');
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setLookupStatus('idle');
      }
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [word]);

  const handleRerollExample = () => {
    if (!lookupData?.examples?.length) return;
    const next = (exampleIdx + 1) % lookupData.examples.length;
    setExampleIdx(next);
    setExample(lookupData.examples[next]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addWord({
      word,
      phonetic,
      meaning,
      example,
      type,
      category: category.trim() || 'Khác',
      level,
      folderIds: folderId ? [folderId] : [],
    });
    if (res.ok) {
      showToast(`Đã thêm "${word.trim()}" vào kho từ vựng!`, 'success');
      setWord('');
      setPhonetic('');
      setMeaning('');
      setExample('');
      setCategory('');
      setLookupStatus('idle');
      setLookupData(null);
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleBulkSubmit = () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map(parseBulkLine).filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (!parsed.length) {
      showToast('Chưa có dòng nào đúng định dạng (từ | nghĩa)', 'error');
      return;
    }
    const res = bulkAddWords(parsed, bulkFolderId || undefined);
    showToast(
      `Đã thêm ${res.added} từ mới${res.skipped ? ` (bỏ qua ${res.skipped} từ trùng)` : ''}!`,
      'success'
    );
    setBulkText('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Thêm Từ Mới</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
          Chỉ cần gõ từ tiếng Anh — WordNest tự động tra phiên âm IPA, nghĩa tiếng Việt và ví dụ.
        </p>
      </div>

      {/* Single Word Form (FIXED alignment: badge stays inline with label!) */}
      <form onSubmit={handleSubmit} className="bg-warm-card rounded-3xl p-5 sm:p-7 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
              <label className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
                Từ tiếng Anh *
              </label>
              {lookupStatus === 'loading' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--gold)' }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang tra...
                </span>
              )}
              {lookupStatus === 'done' && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--green-soft)', color: 'var(--green)' }}
                >
                  <Sparkles className="w-3 h-3" /> Đã điền tự động
                </span>
              )}
            </div>
            <input
              required
              type="text"
              value={word}
              onChange={(e) => {
                const next = e.target.value;
                setWord(next);
                if (next.trim().length < 2) {
                  setLookupStatus('idle');
                  setLookupData(null);
                }
              }}
              placeholder="vd: serendipity"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
              <label className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
                Phiên âm IPA
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="/ˌser.ənˈdɪp.ɪ.ti/"
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm border outline-none"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
              {word.trim().length > 1 && (
                <button
                  type="button"
                  onClick={() => playAudioUrlOrSpeak(word, lookupData?.audioUrl)}
                  className="w-10 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg2)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent)',
                  }}
                  title="Nghe phát âm"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>
              Nghĩa tiếng Việt *
            </label>
            <input
              required
              type="text"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="vd: sự tình cờ may mắn"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
            {lookupData?.altMeanings && lookupData.altMeanings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {lookupData.altMeanings.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => setMeaning(alt)}
                    className="text-[11px] px-2 py-0.5 rounded-full border cursor-pointer"
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

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>
              Loại từ
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WordType)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value="noun">Danh từ (noun)</option>
              <option value="verb">Động từ (verb)</option>
              <option value="adj">Tính từ (adj)</option>
              <option value="adv">Trạng từ (adv)</option>
              <option value="phrase">Cụm từ (phrase)</option>
              <option value="other">Khác</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>
            Ví dụ câu
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="vd: It was serendipity that we met."
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm border outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
            {lookupData?.examples && lookupData.examples.length > 1 && (
              <button
                type="button"
                onClick={handleRerollExample}
                className="px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg2)',
                  borderColor: 'var(--border)',
                  color: 'var(--accent)',
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Đổi ví dụ
              </button>
            )}
          </div>
          {lookupData?.exampleVi && (
            <p className="text-xs italic mt-1.5" style={{ color: 'var(--text3)' }}>
              Dịch gợi ý: {lookupData.exampleVi}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>
              Chủ đề
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="IELTS, Đời sống..."
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>
              Mức độ khó
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as WordLevel)}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none cursor-pointer"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <option value="easy">Dễ (A1–A2)</option>
              <option value="medium">Trung bình (B1–B2)</option>
              <option value="hard">Khó (C1–C2)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>
              Thư mục
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none cursor-pointer"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <option value="">— Không có —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Check className="w-4 h-4" />
          Thêm từ vào WordNest
        </button>
      </form>

      {/* Bulk Add Card (Compatible with WordNest v1 syntax) */}
      <div className="bg-warm-card rounded-3xl p-5 sm:p-6 space-y-3.5">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="font-serif-display font-semibold text-base">
            Thêm nhanh nhiều từ (mỗi dòng 1 từ)
          </h2>
        </div>
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          Hỗ trợ định dạng <code className="px-1 py-0.5 rounded bg-black/5">từ | phiên âm | nghĩa | ví dụ | loại từ</code> hoặc đơn giản <code className="px-1 py-0.5 rounded bg-black/5">từ | nghĩa</code>.
        </p>
        <textarea
          rows={5}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={
            'apple | /ˈæp.əl/ | quả táo | I eat an apple every day. | noun\ncollaborate | hợp tác, cộng tác'
          }
          className="w-full rounded-xl p-3.5 text-sm border outline-none"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            value={bulkFolderId}
            onChange={(e) => setBulkFolderId(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <option value="">Thư mục: Không chọn</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleBulkSubmit}
            className="px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Thêm hàng loạt
          </button>
        </div>
      </div>
    </div>
  );
}
