'use client';

import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { FolderItem, WordItem, WordLevel, WordType } from '@/types/wordnest';

export const WORD_TYPE_VI: Record<WordType, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adj: 'Tính từ',
  adv: 'Trạng từ',
  phrase: 'Cụm từ',
  other: 'Khác',
};

export function BulkFolderAssignModal({
  folder,
  words,
  onClose,
  onConfirm,
}: {
  folder: FolderItem;
  words: WordItem[];
  onClose: () => void;
  onConfirm: (wordIds: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const candidates = useMemo(() => {
    const query = q.trim().toLowerCase();
    return words.filter((w) => {
      if (w.folderIds.includes(folder.id)) return false;
      if (!query) return true;
      return w.word.toLowerCase().includes(query) || w.meaning.toLowerCase().includes(query);
    });
  }, [words, folder.id, q]);

  const toggleId = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-3.5"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif-display font-semibold text-base">
            Thêm từ vào &ldquo;{folder.name}&rdquo;
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm từ để chọn nhanh..."
          className="w-full rounded-xl px-3.5 py-2 text-sm border outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        />

        <div
          className="max-h-64 overflow-y-auto rounded-xl border divide-y"
          style={{ borderColor: 'var(--border)' }}
        >
          {candidates.length === 0 ? (
            <p className="p-6 text-center text-xs" style={{ color: 'var(--text3)' }}>
              Không còn từ nào chưa có trong thư mục này.
            </p>
          ) : (
            candidates.slice(0, 80).map((w) => {
              const isPicked = picked.includes(w.id);
              return (
                <label
                  key={w.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-black/[0.02]"
                  style={{ borderColor: 'var(--bg3)' }}
                >
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onChange={() => toggleId(w.id)}
                  />
                  <span className="font-serif-display font-medium shrink-0">{w.word}</span>
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--text3)' }}>
                    {w.meaning}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            Đã chọn {picked.length} từ
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs border cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => onConfirm(picked)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1 disabled:opacity-45 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Check className="w-3.5 h-3.5" />
              Thêm ({picked.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditWordModal({
  word,
  onClose,
  onSave,
}: {
  word: WordItem;
  onClose: () => void;
  onSave: (patch: Partial<WordItem>) => void;
}) {
  const [form, setForm] = useState({
    word: word.word,
    phonetic: word.phonetic,
    meaning: word.meaning,
    example: word.example,
    type: word.type,
    category: word.category,
    level: word.level,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-3.5"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif-display font-semibold text-lg">Sửa từ vựng</h3>
          <button type="button" onClick={onClose} className="cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>
              Từ tiếng Anh
            </label>
            <input
              required
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>
              Phiên âm
            </label>
            <input
              value={form.phonetic}
              onChange={(e) => setForm({ ...form, phonetic: e.target.value })}
              className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            />
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>
            Nghĩa tiếng Việt
          </label>
          <input
            required
            value={form.meaning}
            onChange={(e) => setForm({ ...form, meaning: e.target.value })}
            className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text3)' }}>
            Ví dụ câu
          </label>
          <input
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            className="w-full rounded-xl px-3 py-2 text-sm border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as WordType })}
            className="rounded-xl px-2.5 py-2 text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            {Object.entries(WORD_TYPE_VI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as WordLevel })}
            className="rounded-xl px-2.5 py-2 text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Chủ đề"
            className="rounded-xl px-2.5 py-2 text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs border cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}
