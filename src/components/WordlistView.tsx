'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  EyeOff,
  Folder,
  FolderPlus,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { speakEnglish } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { FolderItem, WordItem } from '@/types/wordnest';
import {
  BulkFolderAssignModal,
  EditWordModal,
  WORD_TYPE_VI as TYPE_VI,
} from './wordlist/WordlistModals';

const PAGE_SIZE = 30;

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WordlistView() {
  const words = useWordNestStore((s) => s.words);
  const folders = useWordNestStore((s) => s.folders);
  const trash = useWordNestStore((s) => s.trash);
  const setActiveTab = useWordNestStore((s) => s.setActiveTab);
  const deleteWordSoft = useWordNestStore((s) => s.deleteWordSoft);
  const toggleSuspendWord = useWordNestStore((s) => s.toggleSuspendWord);
  const updateWord = useWordNestStore((s) => s.updateWord);
  const createFolder = useWordNestStore((s) => s.createFolder);
  const renameFolder = useWordNestStore((s) => s.renameFolder);
  const deleteFolderSoft = useWordNestStore((s) => s.deleteFolderSoft);
  const setWordFolders = useWordNestStore((s) => s.setWordFolders);
  const bulkAddWordsToFolder = useWordNestStore((s) => s.bulkAddWordsToFolder);
  const restoreTrashEntry = useWordNestStore((s) => s.restoreTrashEntry);
  const emptyTrash = useWordNestStore((s) => s.emptyTrash);
  const exportBackup = useWordNestStore((s) => s.exportBackup);
  const importBackup = useWordNestStore((s) => s.importBackup);
  const showToast = useWordNestStore((s) => s.showToast);

  const [subTab, setSubTab] = useState<'all' | 'folders' | 'trash'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Modals
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [folderPickerWord, setFolderPickerWord] = useState<WordItem | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<FolderItem | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [bulkFolderTarget, setBulkFolderTarget] = useState<FolderItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Unique categories for quick filter chips
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    words.forEach((w) => {
      const cat = w.category?.trim() || 'Khác';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [words]);

  const filteredWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = words.filter((w) => {
      if (selectedFolderId && !w.folderIds.includes(selectedFolderId)) return false;
      if (typeFilter !== 'all' && w.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && (w.category?.trim() || 'Khác') !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.category || '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'az') list = [...list].sort((a, b) => a.word.localeCompare(b.word));
    else if (sortBy === 'za') list = [...list].sort((a, b) => b.word.localeCompare(a.word));
    else if (sortBy === 'mastery_desc') list = [...list].sort((a, b) => b.mastery - a.mastery);
    else if (sortBy === 'mastery_asc') list = [...list].sort((a, b) => a.mastery - b.mastery);
    else if (sortBy === 'added_desc')
      list = [...list].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));

    return list;
  }, [words, search, sortBy, typeFilter, categoryFilter, selectedFolderId]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedWords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredWords.slice(start, start + PAGE_SIZE);
  }, [filteredWords, safePage]);

  const activeFolder = useMemo(
    () => (selectedFolderId ? folders.find((f) => f.id === selectedFolderId) || null : null),
    [folders, selectedFolderId]
  );

  const handleExportJson = () => {
    const data = exportBackup();
    downloadFile(
      JSON.stringify(data, null, 2),
      `wordnest-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    showToast('Đã xuất file backup JSON (tương thích WordNest v1 & v2)', 'success');
    setShowMoreMenu(false);
  };

  const handleExportCsv = () => {
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const rows = [
      ['Word', 'Phonetic', 'Meaning', 'Type', 'Example', 'Category', 'Level'].join(','),
      ...words.map((w) =>
        [w.word, w.phonetic, w.meaning, w.type, w.example, w.category, w.level].map(esc).join(',')
      ),
    ];
    downloadFile('\uFEFF' + rows.join('\n'), 'wordnest-words.csv', 'text/csv;charset=utf-8');
    showToast('Đã xuất file CSV!', 'success');
    setShowMoreMenu(false);
  };

  const handleExportAnki = () => {
    const lines = words.map(
      (w) =>
        `${w.word}${w.phonetic ? ` (${w.phonetic})` : ''}\t${w.meaning}${
          w.example ? `<br><i>${w.example}</i>` : ''
        }`
    );
    downloadFile(lines.join('\n'), 'wordnest-anki.txt', 'text/plain;charset=utf-8');
    showToast('Đã xuất file Anki (.txt)!', 'success');
    setShowMoreMenu(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = importBackup(parsed, 'merge');
      showToast(
        `Đã nhập ${res.imported} từ mới${res.skipped ? ` (bỏ qua ${res.skipped} từ trùng)` : ''}!`,
        'success'
      );
    } catch {
      showToast('File JSON không hợp lệ!', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowMoreMenu(false);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName('');
    showToast('Đã tạo thư mục mới!', 'success');
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder || !renameInput.trim()) return;
    renameFolder(renamingFolder.id, renameInput.trim());
    setRenamingFolder(null);
    showToast('Đã đổi tên thư mục!', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Từ Điển Cá Nhân</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
            {words.length} từ vựng · Tương thích hoàn toàn file JSON từ WordNest bản cũ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus className="w-4 h-4" />
          Thêm từ mới
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {(
          [
            { id: 'all', label: `Tất cả (${words.length})`, icon: BookOpen },
            { id: 'folders', label: `Thư mục (${folders.length})`, icon: Folder },
            { id: 'trash', label: `Thùng rác (${trash.length})`, icon: Trash2 },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSubTab(t.id);
                if (t.id !== 'folders') setSelectedFolderId(null);
              }}
              className="px-3.5 py-2.5 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer -mb-px"
              style={{
                borderColor: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text3)',
              }}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: ALL WORDS (OR INSIDE A FOLDER) ── */}
      {(subTab === 'all' || (subTab === 'folders' && activeFolder)) && (
        <div className="space-y-4">
          {activeFolder && (
            <div className="bg-warm-card rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                >
                  ← Thư mục
                </button>
                <span className="font-serif-display font-semibold text-base">
                  {activeFolder.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBulkFolderTarget(activeFolder)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  Thêm nhiều từ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingFolder(activeFolder);
                    setRenameInput(activeFolder.name);
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Đổi tên
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteFolderSoft(activeFolder.id);
                    setSelectedFolderId(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          )}

          {/* Search + Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text3)' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm từ tiếng Anh, nghĩa tiếng Việt..."
                className="w-full rounded-xl pl-10 pr-4 py-2 text-sm border outline-none"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <option value="default">Mặc định</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="mastery_desc">Thuộc nhiều nhất</option>
              <option value="mastery_asc">Chưa thuộc</option>
              <option value="added_desc">Mới thêm nhất</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <option value="all">Tất cả loại từ</option>
              {Object.entries(TYPE_VI).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {/* More Dropdown (Export / Import WordNest v1) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((v) => !v)}
                className="p-2 rounded-xl border cursor-pointer"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                aria-label="Tùy chọn xuất nhập"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMoreMenu && (
                <div
                  className="absolute right-0 mt-1.5 w-52 rounded-2xl border p-1.5 shadow-xl z-30 space-y-0.5"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-black/5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                    Nhập JSON (từ bản v1/v2)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-black/5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                    Xuất Backup JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-black/5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Xuất CSV (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAnki}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-black/5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Xuất Anki (.txt)
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </div>

          {/* Category Quick Filter Chips (WordNest v1 parity!) */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setPage(1);
                }}
                className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap cursor-pointer transition-colors"
                style={{
                  backgroundColor: categoryFilter === 'all' ? 'var(--accent)' : 'var(--card)',
                  borderColor: categoryFilter === 'all' ? 'var(--accent)' : 'var(--border)',
                  color: categoryFilter === 'all' ? '#fff' : 'var(--text2)',
                }}
              >
                Tất cả chủ đề
              </button>
              {categories.map(([cat, cnt]) => {
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(active ? 'all' : cat);
                      setPage(1);
                    }}
                    className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent)' : 'var(--card)',
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      color: active ? '#fff' : 'var(--text2)',
                    }}
                  >
                    {cat} ({cnt})
                  </button>
                );
              })}
            </div>
          )}

          {/* Responsive List: Clean Cards on Mobile, Structured Table on Desktop */}
          {pagedWords.length === 0 ? (
            <div className="bg-warm-card rounded-2xl p-10 text-center">
              <p className="text-sm font-medium">Không tìm thấy từ nào phù hợp</p>
            </div>
          ) : (
            <>
              {/* MOBILE CARD LIST (< md) */}
              <div className="space-y-2.5 md:hidden">
                {pagedWords.map((w) => (
                  <div
                    key={w.id}
                    className={`bg-warm-card rounded-2xl p-4 space-y-2 ${w.suspended ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif-display font-semibold text-base">{w.word}</span>
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: 'var(--bg2)',
                              borderColor: 'var(--border)',
                              color: 'var(--accent)',
                            }}
                          >
                            {TYPE_VI[w.type]}
                          </span>
                        </div>
                        {w.phonetic && (
                          <p className="text-xs italic mt-0.5" style={{ color: 'var(--text3)' }}>
                            {w.phonetic}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 pt-1">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: d < w.mastery ? 'var(--gold)' : 'var(--bg3)',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-sm" style={{ color: 'var(--text2)' }}>
                      {w.meaning}
                    </p>
                    {w.example && (
                      <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
                        &ldquo;{w.example}&rdquo;
                      </p>
                    )}

                    <div
                      className="pt-2 border-t flex items-center justify-between"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                        {w.category || 'Khác'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => speakEnglish(w.word)}
                          className="p-1.5 rounded-lg cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFolderPickerWord(w)}
                          className="p-1.5 rounded-lg cursor-pointer"
                          style={{ color: w.folderIds.length ? 'var(--gold)' : 'var(--text3)' }}
                        >
                          <Folder className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWord(w)}
                          className="p-1.5 rounded-lg cursor-pointer"
                          style={{ color: 'var(--blue)' }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWordSoft(w.id)}
                          className="p-1.5 rounded-lg cursor-pointer"
                          style={{ color: 'var(--red)' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE (>= md) */}
              <div className="hidden md:block bg-warm-card rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className="border-b text-[11px] uppercase tracking-wider"
                      style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}
                    >
                      <th className="py-3 px-4 font-semibold">Từ vựng</th>
                      <th className="py-3 px-4 font-semibold">Nghĩa & Ví dụ</th>
                      <th className="py-3 px-4 font-semibold">Chủ đề</th>
                      <th className="py-3 px-4 font-semibold">Thuộc</th>
                      <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWords.map((w) => (
                      <tr
                        key={w.id}
                        className={`border-b last:border-b-0 transition-colors hover:bg-black/[0.02] ${
                          w.suspended ? 'opacity-50' : ''
                        }`}
                        style={{ borderColor: 'var(--bg3)' }}
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-serif-display font-semibold text-base">{w.word}</div>
                          {w.phonetic && (
                            <div className="text-xs italic mt-0.5" style={{ color: 'var(--text3)' }}>
                              {w.phonetic}
                            </div>
                          )}
                          <span
                            className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: 'var(--bg2)',
                              borderColor: 'var(--border)',
                              color: 'var(--text2)',
                            }}
                          >
                            {TYPE_VI[w.type]}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-sm">
                          <div className="text-sm" style={{ color: 'var(--text)' }}>
                            {w.meaning}
                          </div>
                          {w.example && (
                            <div className="text-xs italic mt-1" style={{ color: 'var(--text3)' }}>
                              {w.example}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className="inline-block whitespace-nowrap text-xs px-2.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: 'var(--bg2)',
                              borderColor: 'var(--border)',
                              color: 'var(--accent)',
                            }}
                          >
                            {w.category || 'Khác'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1 pt-1.5">
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: d < w.mastery ? 'var(--gold)' : 'var(--bg3)',
                                }}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => speakEnglish(w.word)}
                              className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                              style={{ color: 'var(--text3)' }}
                              title="Phát âm"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFolderPickerWord(w)}
                              className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                              style={{ color: w.folderIds.length ? 'var(--gold)' : 'var(--text3)' }}
                              title="Gán thư mục"
                            >
                              <Folder className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSuspendWord(w.id)}
                              className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                              style={{ color: w.suspended ? 'var(--gold)' : 'var(--text3)' }}
                              title={w.suspended ? 'Bỏ tạm ẩn' : 'Tạm ẩn khỏi ôn tập'}
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingWord(w)}
                              className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                              style={{ color: 'var(--text3)' }}
                              title="Chỉnh sửa"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteWordSoft(w.id)}
                              className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                              style={{ color: 'var(--red)' }}
                              title="Chuyển vào thùng rác"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--text3)' }}>
                    Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filteredWords.length)} / {filteredWords.length} từ
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Trước
                    </button>
                    <span className="text-xs font-semibold px-2 tabular-nums">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => {
                        setPage((p) => Math.min(totalPages, p + 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      Sau <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: FOLDERS GRID ── */}
      {subTab === 'folders' && !activeFolder && (
        <div className="space-y-4">
          <form onSubmit={handleCreateFolder} className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Tên bộ từ / thư mục mới (vd: IELTS Reading, Video TED)..."
              className="flex-1 rounded-xl px-4 py-2 text-sm border outline-none"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <FolderPlus className="w-4 h-4" />
              Tạo thư mục
            </button>
          </form>

          {folders.length === 0 ? (
            <div className="bg-warm-card rounded-2xl p-10 text-center">
              <Folder className="w-9 h-9 mx-auto mb-2 opacity-35" />
              <p className="text-sm font-medium">Chưa có thư mục nào</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                Tạo thư mục để gom từ vựng theo bài học hoặc video YouTube yêu thích.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {folders.map((f) => {
                const count = words.filter((w) => w.folderIds.includes(f.id)).length;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    className="bg-warm-card rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md relative group"
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFolder(f);
                          setRenameInput(f.name);
                        }}
                        className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                        style={{ color: 'var(--text3)' }}
                        title="Đổi tên thư mục"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolderSoft(f.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                        style={{ color: 'var(--red)' }}
                        title="Xóa thư mục"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <Folder className="w-8 h-8 mb-3" style={{ color: 'var(--accent)' }} />
                    <div className="font-serif-display font-semibold text-base truncate">{f.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      {count} từ vựng
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: TRASH ── */}
      {subTab === 'trash' && (
        <div className="space-y-3">
          {trash.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  emptyTrash();
                  showToast('Đã dọn sạch thùng rác');
                }}
                className="px-3.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
              >
                Đổ sạch thùng rác
              </button>
            </div>
          )}

          {trash.length === 0 ? (
            <div className="bg-warm-card rounded-2xl p-10 text-center">
              <Trash2 className="w-9 h-9 mx-auto mb-2 opacity-35" />
              <p className="text-sm font-medium">Thùng rác đang trống</p>
            </div>
          ) : (
            trash.map((entry, idx) => (
              <div
                key={`${entry.deletedAt}-${idx}`}
                className="bg-warm-card rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-serif-display font-semibold">
                    {entry.kind === 'word'
                      ? (entry.data as WordItem).word
                      : `Thư mục: ${(entry.data as FolderItem).name}`}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>
                    {entry.kind === 'word'
                      ? (entry.data as WordItem).meaning
                      : `${entry.wordIds?.length || 0} từ liên kết`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restoreTrashEntry(idx)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Khôi phục
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* EDIT WORD MODAL */}
      {editingWord && (
        <EditWordModal
          word={editingWord}
          onClose={() => setEditingWord(null)}
          onSave={(patch) => {
            updateWord(editingWord.id, patch);
            setEditingWord(null);
            showToast('Đã cập nhật từ vựng!', 'success');
          }}
        />
      )}

      {/* RENAME FOLDER MODAL */}
      {renamingFolder && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setRenamingFolder(null)}
        >
          <form
            onSubmit={handleConfirmRename}
            className="w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif-display font-semibold text-base">Đổi tên thư mục</h3>
              <button type="button" onClick={() => setRenamingFolder(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              autoFocus
              required
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingFolder(null)}
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
                Lưu tên mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BULK ADD WORDS TO FOLDER MODAL */}
      {bulkFolderTarget && (
        <BulkFolderAssignModal
          folder={bulkFolderTarget}
          words={words}
          onClose={() => setBulkFolderTarget(null)}
          onConfirm={(ids) => {
            const added = bulkAddWordsToFolder(bulkFolderTarget.id, ids);
            setBulkFolderTarget(null);
            showToast(`Đã thêm ${added} từ vào thư mục "${bulkFolderTarget.name}"!`, 'success');
          }}
        />
      )}

      {/* FOLDER PICKER MODAL (Single word -> multi folder) */}
      {folderPickerWord && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setFolderPickerWord(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif-display font-semibold text-base">
                Gán thư mục cho &ldquo;{folderPickerWord.word}&rdquo;
              </h3>
              <button type="button" onClick={() => setFolderPickerWord(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {folders.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text3)' }}>
                Bạn chưa có thư mục nào. Chuyển sang tab &ldquo;Thư mục&rdquo; để tạo nhé!
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {folders.map((f) => {
                  const checked = folderPickerWord.folderIds.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer"
                      style={{
                        backgroundColor: checked ? 'var(--accent-soft)' : 'var(--bg)',
                        borderColor: checked ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...folderPickerWord.folderIds, f.id]
                            : folderPickerWord.folderIds.filter((id) => id !== f.id);
                          setWordFolders(folderPickerWord.id, next);
                          setFolderPickerWord({ ...folderPickerWord, folderIds: next });
                        }}
                      />
                      <span className="text-sm font-medium">{f.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

