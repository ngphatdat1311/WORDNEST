'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  Flame,
  Headphones,
  Loader2,
  Rocket,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Volume2,
  Wand2,
} from 'lucide-react';
import { pullFromSupabase, pushToSupabase } from '@/lib/cloud-sync';
import { addDaysToDateKey, localDateKey } from '@/lib/srs';
import { speakEnglish } from '@/lib/speech';
import { useWordNestStore } from '@/store/useWordNestStore';
import { WordType } from '@/types/wordnest';

const POS_LABELS: Record<WordType, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adj: 'Tính từ',
  adv: 'Trạng từ',
  phrase: 'Cụm từ',
  other: 'Khác',
};

export function ProgressView() {
  const words = useWordNestStore((s) => s.words);
  const streak = useWordNestStore((s) => s.streak);
  const dailyGoal = useWordNestStore((s) => s.dailyGoal);
  const setDailyGoal = useWordNestStore((s) => s.setDailyGoal);
  const quizStats = useWordNestStore((s) => s.quizStats);
  const airCombatStats = useWordNestStore((s) => s.airCombatStats);
  const dictationProgress = useWordNestStore((s) => s.dictationProgress);
  const cloudSync = useWordNestStore((s) => s.cloudSync);
  const updateCloudSync = useWordNestStore((s) => s.updateCloudSync);
  const updateWord = useWordNestStore((s) => s.updateWord);
  const exportBackup = useWordNestStore((s) => s.exportBackup);
  const importBackup = useWordNestStore((s) => s.importBackup);
  const resetLearningProgress = useWordNestStore((s) => s.resetLearningProgress);
  const showToast = useWordNestStore((s) => s.showToast);

  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const masteredCount = useMemo(() => words.filter((w) => w.mastery >= 3).length, [words]);
  const missingPhoneticWords = useMemo(
    () => words.filter((w) => !w.phonetic || !w.phonetic.trim()),
    [words]
  );

  const totalDictationSentences = useMemo(
    () =>
      Object.values(dictationProgress).reduce(
        (sum, p) => sum + p.completedSegmentIds.length,
        0
      ),
    [dictationProgress]
  );

  // Difficult words: seen >= 2 times with low mastery (< 2)
  const difficultWords = useMemo(
    () =>
      words
        .filter((w) => !w.suspended && (w.seen || 0) >= 2 && w.mastery < 2)
        .sort((a, b) => (b.seen - b.known) - (a.seen - a.known))
        .slice(0, 6),
    [words]
  );

  const levelStats = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 };
    words.forEach((w) => {
      counts[w.level] = (counts[w.level] || 0) + 1;
    });
    return counts;
  }, [words]);

  const posStats = useMemo(() => {
    const counts: Record<WordType, number> = {
      noun: 0,
      verb: 0,
      adj: 0,
      adv: 0,
      phrase: 0,
      other: 0,
    };
    words.forEach((w) => {
      counts[w.type] = (counts[w.type] || 0) + 1;
    });
    return counts;
  }, [words]);

  const todayCount = streak.history[localDateKey()] || 0;
  const goalPct = Math.min(100, Math.round((todayCount / Math.max(1, dailyGoal)) * 100));

  // Last 140 days (20 weeks) heatmap
  const heatmapDays = useMemo(() => {
    const today = localDateKey();
    const days: Array<{ key: string; count: number }> = [];
    for (let i = 139; i >= 0; i--) {
      const k = addDaysToDateKey(today, -i);
      days.push({ key: k, count: streak.history[k] || 0 });
    }
    return days;
  }, [streak.history]);

  const handleBatchAutoPhonetic = async () => {
    if (!missingPhoneticWords.length || batchProgress) return;
    const targets = missingPhoneticWords.slice(0, 25); // cap batch to stay respectful to DictionaryAPI
    setBatchProgress({ done: 0, total: targets.length });
    let filled = 0;

    for (let i = 0; i < targets.length; i++) {
      const w = targets[i];
      try {
        const res = await fetch(`/api/lookup?word=${encodeURIComponent(w.word)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.phonetic) {
            updateWord(w.id, {
              phonetic: data.phonetic,
              type: w.type === 'other' && data.type ? data.type : w.type,
            });
            filled++;
          }
        }
      } catch {
        // continue batch on single failure
      }
      setBatchProgress({ done: i + 1, total: targets.length });
    }

    setBatchProgress(null);
    showToast(`Đã tự động điền phiên âm IPA cho ${filled}/${targets.length} từ!`, 'success');
  };

  const handlePushCloud = async () => {
    setSyncing('push');
    const res = await pushToSupabase(cloudSync, exportBackup());
    setSyncing(null);
    if (res.ok) {
      updateCloudSync({ enabled: true, lastSyncedAt: res.syncedAt || new Date().toISOString() });
      showToast('Đã đồng bộ dữ liệu lên Cloud thành công!', 'success');
    } else {
      showToast(res.error || 'Đẩy dữ liệu thất bại', 'error');
    }
  };

  const handlePullCloud = async () => {
    setSyncing('pull');
    const res = await pullFromSupabase(cloudSync);
    setSyncing(null);
    if (res.ok && res.payload) {
      const imp = importBackup(res.payload, 'replace');
      updateCloudSync({ enabled: true, lastSyncedAt: res.updatedAt || new Date().toISOString() });
      showToast(`Đã tải về ${imp.imported} từ từ Cloud!`, 'success');
    } else {
      showToast(res.error || 'Tải dữ liệu thất bại', 'error');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordnest-v2-${localDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file sao lưu JSON!', 'success');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const res = importBackup(parsed, 'merge');
      showToast(`Đã gộp ${res.imported} từ từ file backup!`, 'success');
    } catch {
      showToast('File JSON không hợp lệ!', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold">Tiến Độ & Đồng Bộ</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>
          Theo dõi mục tiêu mỗi ngày, từ khó hay sai, thống kê Không Chiến và đồng bộ Cloud tự động.
        </p>
      </div>

      {/* 5 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-warm-card rounded-2xl p-4">
          <Sparkles className="w-4 h-4 mb-2" style={{ color: 'var(--accent)' }} />
          <div className="font-serif-display text-2xl font-semibold">{words.length}</div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Từ vựng ({masteredCount} thuộc)
          </div>
        </div>
        <div className="bg-warm-card rounded-2xl p-4">
          <Headphones className="w-4 h-4 mb-2" style={{ color: 'var(--green)' }} />
          <div className="font-serif-display text-2xl font-semibold">{totalDictationSentences}</div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Câu YouTube đã chép
          </div>
        </div>
        <div className="bg-warm-card rounded-2xl p-4">
          <Trophy className="w-4 h-4 mb-2" style={{ color: 'var(--gold)' }} />
          <div className="font-serif-display text-2xl font-semibold">
            {quizStats.totalQuestions
              ? `${Math.round((quizStats.totalCorrect / quizStats.totalQuestions) * 100)}%`
              : '—'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Chính xác Quiz TB
          </div>
        </div>
        <div className="bg-warm-card rounded-2xl p-4">
          <Rocket className="w-4 h-4 mb-2" style={{ color: 'var(--blue)' }} />
          <div className="font-serif-display text-2xl font-semibold">{airCombatStats.bestScore}</div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Kỷ lục Không Chiến ({airCombatStats.bestWpm} WPM)
          </div>
        </div>
        <div className="bg-warm-card rounded-2xl p-4 col-span-2 lg:col-span-1">
          <Flame className="w-4 h-4 mb-2" style={{ color: 'var(--red)' }} />
          <div className="font-serif-display text-2xl font-semibold">{streak.count}</div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Ngày liên tiếp
          </div>
        </div>
      </div>

      {/* Daily Goal Setting */}
      <div className="bg-warm-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-sm inline-flex items-center gap-1.5">
            <Target className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Mục tiêu học mỗi ngày ({todayCount} / {dailyGoal} lượt · {goalPct}%)
          </h2>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>
            Mỗi câu YouTube chép xong, thẻ SRS đã ôn hoặc lượt Quiz/Chính tả đều tính vào mục tiêu ngày.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {[10, 15, 25, 40].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setDailyGoal(g)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors"
              style={{
                backgroundColor: dailyGoal === g ? 'var(--accent)' : 'var(--bg)',
                borderColor: dailyGoal === g ? 'var(--accent)' : 'var(--border)',
                color: dailyGoal === g ? '#fff' : 'var(--text2)',
              }}
            >
              {g} lượt
            </button>
          ))}
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="bg-warm-card rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Hoạt động 20 tuần gần nhất</h2>
        <div className="overflow-x-auto pb-1">
          <div
            className="grid grid-flow-col grid-rows-7 gap-1 w-max"
            role="grid"
            aria-label="Biểu đồ nhiệt học tập"
          >
            {heatmapDays.map((d) => {
              let bg = 'var(--bg3)';
              if (d.count >= 8) bg = 'var(--accent)';
              else if (d.count >= 3) bg = 'var(--gold)';
              else if (d.count >= 1) bg = 'var(--border2)';
              return (
                <div
                  key={d.key}
                  title={`${d.key}: ${d.count} lượt học`}
                  className="w-3.5 h-3.5 rounded-[3px] transition-transform hover:scale-125"
                  style={{ backgroundColor: bg }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Breakdown Grid: Level & Part of Speech */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-warm-card rounded-2xl p-5 space-y-3.5">
          <h2 className="font-semibold text-sm">Phân bổ theo độ khó</h2>
          {(
            [
              { key: 'easy', label: 'Dễ (A1–A2)', color: 'var(--green)' },
              { key: 'medium', label: 'Trung bình (B1–B2)', color: 'var(--gold)' },
              { key: 'hard', label: 'Khó (C1–C2)', color: 'var(--red)' },
            ] as const
          ).map((row) => {
            const val = levelStats[row.key];
            const pct = words.length ? Math.round((val / words.length) * 100) : 0;
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text2)' }}>{row.label}</span>
                  <span className="tabular-nums" style={{ color: 'var(--text3)' }}>
                    {val} từ ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-warm-card rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Phân bổ theo loại từ</h2>
          {(Object.keys(POS_LABELS) as WordType[]).map((pos) => {
            const val = posStats[pos];
            const pct = words.length ? Math.round((val / words.length) * 100) : 0;
            return (
              <div key={pos} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text2)' }}>{POS_LABELS[pos]}</span>
                  <span className="tabular-nums" style={{ color: 'var(--text3)' }}>
                    {val} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Difficult Words (Từ khó cần ôn thêm) */}
      {difficultWords.length > 0 && (
        <div className="bg-warm-card rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-sm inline-flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--red)' }} />
            Từ khó cần ôn thêm ({difficultWords.length})
          </h2>
          <div className="divide-y" style={{ borderColor: 'var(--bg3)' }}>
            {difficultWords.map((w) => (
              <div
                key={w.id}
                className="py-2.5 flex items-center justify-between gap-3"
                style={{ borderColor: 'var(--bg3)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-serif-display font-semibold text-sm">{w.word}</span>
                    {w.phonetic && (
                      <span className="text-xs italic" style={{ color: 'var(--text3)' }}>
                        {w.phonetic}
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>
                    {w.meaning}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--text3)' }}>
                    Gặp {w.seen} lần
                  </span>
                  <button
                    type="button"
                    onClick={() => speakEnglish(w.word)}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Auto-Fill Missing Phonetics */}
      <div className="bg-warm-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm inline-flex items-center gap-1.5">
            <Wand2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Tự động điền phiên âm IPA còn thiếu
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            {missingPhoneticWords.length > 0
              ? `Hiện có ${missingPhoneticWords.length} từ chưa có phiên âm IPA.`
              : 'Tuyệt vời! Toàn bộ từ vựng trong kho đều đã có phiên âm IPA.'}
          </p>
        </div>
        <button
          type="button"
          disabled={missingPhoneticWords.length === 0 || Boolean(batchProgress)}
          onClick={handleBatchAutoPhonetic}
          className="self-start sm:self-auto px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer shrink-0"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          {batchProgress ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang tra {batchProgress.done}/{batchProgress.total}...
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Điền IPA tự động
            </>
          )}
        </button>
      </div>

      {/* Backup / Import WordNest v1 JSON */}
      <div className="bg-warm-card rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Sao lưu & Di chuyển từ WordNest bản cũ (JSON)</h2>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          Hỗ trợ nhập trực tiếp file JSON xuất ra từ WordNest Electron cũ (v1.0.x) mà không mất từ vựng, thư mục hay lịch SRS.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Download className="w-3.5 h-3.5" />
            Xuất file Backup JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Nhập file JSON (v1 / v2)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />
        </div>
      </div>

      {/* Cloud Sync Panel + Auto-Sync Toggle */}
      <div className="bg-warm-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-sm inline-flex items-center gap-1.5">
              <Cloud className="w-4 h-4" style={{ color: 'var(--blue)' }} />
              Đồng bộ Cloud (Máy tính ↔ Điện thoại qua Supabase)
            </h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text3)' }}>
              Cắm Supabase miễn phí để đồng bộ kho từ & bài nghe YouTube giữa máy tính và điện thoại bằng 1 Mã đồng bộ riêng.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(cloudSync.autoSync)}
              onChange={(e) => updateCloudSync({ autoSync: e.target.checked })}
            />
            <span>Tự đồng bộ ngầm</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={cloudSync.supabaseUrl}
            onChange={(e) => updateCloudSync({ supabaseUrl: e.target.value })}
            placeholder="https://xxxx.supabase.co"
            className="rounded-xl px-3 py-2 text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
          <input
            type="password"
            value={cloudSync.supabaseAnonKey}
            onChange={(e) => updateCloudSync({ supabaseAnonKey: e.target.value })}
            placeholder="Supabase Anon Key"
            className="rounded-xl px-3 py-2 text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
          <input
            type="text"
            value={cloudSync.syncCode}
            onChange={(e) => updateCloudSync({ syncCode: e.target.value })}
            placeholder="Mã đồng bộ bí mật (vd: heo-2026)"
            className="rounded-xl px-3 py-2 text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing !== null}
            onClick={handlePushCloud}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: 'var(--blue)' }}
          >
            {syncing === 'push' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
            Đẩy lên Cloud
          </button>
          <button
            type="button"
            disabled={syncing !== null}
            onClick={handlePullCloud}
            className="px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
          >
            {syncing === 'pull' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            Tải từ Cloud về máy này
          </button>
          {cloudSync.lastSyncedAt && (
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
              Đồng bộ lần cuối: {new Date(cloudSync.lastSyncedAt).toLocaleString('vi-VN')}
            </span>
          )}
        </div>
      </div>

      {/* Danger Zone: Reset Progress */}
      <div className="bg-warm-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Đặt lại tiến độ học tập</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            Chỉ xóa điểm số, chuỗi ngày và lịch SRS — giữ nguyên toàn bộ từ vựng & thư mục.
          </p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 rounded-xl border text-xs cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                resetLearningProgress();
                setConfirmReset(false);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--red)' }}
            >
              Xác nhận đặt lại
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại tiến độ
          </button>
        )}
      </div>
    </div>
  );
}
