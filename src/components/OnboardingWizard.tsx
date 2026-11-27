'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  Flame,
  GraduationCap,
  Headphones,
  Layers,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { VOCAB_STARTER_PACKS } from '@/lib/starter-packs';
import { useWordNestStore } from '@/store/useWordNestStore';
import type { LearnerLevel } from '@/types/wordnest';

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const LEVELS: Array<{
  id: LearnerLevel;
  title: string;
  badge: string;
  desc: string;
  recommendedPacks: string[];
  recommendedGoal: number;
}> = [
  {
    id: 'beginner',
    title: 'Nền tảng & Giao tiếp',
    badge: 'A1 – A2',
    desc: 'Xây nền từ vựng đời sống, luyện nghe câu ngắn và làm quen phản xạ phát âm.',
    recommendedPacks: ['pack-daily-a2-b1'],
    recommendedGoal: 10,
  },
  {
    id: 'intermediate',
    title: 'Trung cấp & Công việc',
    badge: 'B1 – B2',
    desc: 'Nâng phản xạ nghe TED/YouTube, cụm động từ tự nhiên và từ vựng TOEIC công sở.',
    recommendedPacks: ['pack-daily-a2-b1', 'pack-phrasal-verbs', 'pack-toeic-office'],
    recommendedGoal: 15,
  },
  {
    id: 'advanced',
    title: 'Học thuật & IELTS 7.0+',
    badge: 'C1 – C2',
    desc: 'Chinh phục từ vựng học thuật sắc bén, nghe chép tốc độ bản xứ & AI Coach viết câu.',
    recommendedPacks: ['pack-ielts-b2-c1', 'pack-phrasal-verbs'],
    recommendedGoal: 25,
  },
];

const DAILY_GOALS = [10, 15, 25, 40];

export function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const currentLevel = useWordNestStore((s) => s.learnerLevel);
  const currentGoal = useWordNestStore((s) => s.dailyGoal);
  const completeOnboarding = useWordNestStore((s) => s.completeOnboarding);
  const setOnboardingCompleted = useWordNestStore((s) => s.setOnboardingCompleted);
  const setActiveTab = useWordNestStore((s) => s.setActiveTab);
  const showToast = useWordNestStore((s) => s.showToast);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [level, setLevel] = useState<LearnerLevel>(currentLevel || 'intermediate');
  const [goal, setGoal] = useState<number>(currentGoal || 15);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([
    'pack-daily-a2-b1',
    'pack-phrasal-verbs',
  ]);

  if (!open) return null;

  const handleSelectLevel = (nextLevel: LearnerLevel) => {
    setLevel(nextLevel);
    const meta = LEVELS.find((l) => l.id === nextLevel);
    if (meta) {
      setGoal(meta.recommendedGoal);
      setSelectedPacks(meta.recommendedPacks);
    }
  };

  const togglePack = (packId: string) => {
    setSelectedPacks((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  const handleSkip = () => {
    setOnboardingCompleted(true);
    onClose();
  };

  const handleFinish = (targetTab: 'home' | 'dictation' | 'flashcard') => {
    const { totalAdded } = completeOnboarding(level, goal, selectedPacks);
    onClose();
    setActiveTab(targetTab);
    if (totalAdded > 0) {
      showToast(
        `Đã thiết lập lộ trình & thêm ${totalAdded} từ vựng chuẩn CEFR vào kho của bạn!`,
        'success'
      );
    } else {
      showToast('Đã lưu lộ trình học cá nhân của bạn!', 'success');
    }
  };

  const selectedWordCount = VOCAB_STARTER_PACKS.filter((p) =>
    selectedPacks.includes(p.id)
  ).reduce((sum, p) => sum + p.words.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
      style={{ backgroundColor: 'rgba(20, 17, 13, 0.56)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Thiết lập lộ trình học WordNest"
    >
      <div
        className="w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="px-6 pt-5 pb-4 border-b flex items-start justify-between gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg2)' }}
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles className="w-3 h-3" />
              Chào mừng đến WordNest · Bước {step}/3
            </div>
            <h2 className="font-serif-display text-xl sm:text-2xl font-semibold">
              {step === 1 && 'Chọn trình độ & mục tiêu mỗi ngày'}
              {step === 2 && 'Chọn bộ từ vựng khởi đầu chuẩn CEFR'}
              {step === 3 && 'Lộ trình cá nhân của bạn đã sẵn sàng'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer shrink-0"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text3)' }}
            aria-label="Đóng hướng dẫn"
            title="Bỏ qua"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="h-1 w-full" style={{ backgroundColor: 'var(--bg3)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {step === 1 && (
            <>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                  Trình độ hiện tại của bạn
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {LEVELS.map((item) => {
                    const active = level === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectLevel(item.id)}
                        className="text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3"
                        style={{
                          backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg)',
                          borderColor: active ? 'var(--accent)' : 'var(--border)',
                        }}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <GraduationCap
                              className="w-4 h-4 shrink-0"
                              style={{ color: active ? 'var(--accent)' : 'var(--text3)' }}
                            />
                            <span className="font-semibold text-sm">{item.title}</span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: active ? 'var(--accent)' : 'var(--bg3)',
                                color: active ? '#fff' : 'var(--text2)',
                              }}
                            >
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                            {item.desc}
                          </p>
                        </div>
                        <div
                          className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            borderColor: active ? 'var(--accent)' : 'var(--border2)',
                            backgroundColor: active ? 'var(--accent)' : 'transparent',
                            color: '#fff',
                          }}
                        >
                          {active && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5" style={{ color: 'var(--text3)' }}>
                    <Target className="w-3.5 h-3.5" />
                    Mục tiêu hoạt động mỗi ngày
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    {goal} lượt học / ngày
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {DAILY_GOALS.map((g) => {
                    const active = goal === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGoal(g)}
                        className="py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors"
                        style={{
                          backgroundColor: active ? 'var(--accent)' : 'var(--bg)',
                          borderColor: active ? 'var(--accent)' : 'var(--border)',
                          color: active ? '#fff' : 'var(--text2)',
                        }}
                      >
                        {g} lượt
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                Chọn các bộ từ vựng mẫu (đầy đủ phiên âm IPA, nghĩa Việt & câu ví dụ) để nạp ngay vào kho học với thuật toán lặp lại ngắt quãng <strong>FSRS v5</strong>. Bạn có thể bổ sung thêm bất cứ lúc nào.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VOCAB_STARTER_PACKS.map((pack) => {
                  const selected = selectedPacks.includes(pack.id);
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => togglePack(pack.id)}
                      className="text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2"
                      style={{
                        backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg)',
                        borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1"
                            style={{
                              backgroundColor: selected ? 'var(--accent)' : 'var(--bg3)',
                              color: selected ? '#fff' : 'var(--text2)',
                            }}
                          >
                            {pack.badge} · {pack.words.length} từ
                          </span>
                          <p className="font-semibold text-sm leading-snug">{pack.title}</p>
                        </div>
                        <div
                          className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
                          style={{
                            borderColor: selected ? 'var(--accent)' : 'var(--border2)',
                            backgroundColor: selected ? 'var(--accent)' : 'transparent',
                            color: '#fff',
                          }}
                        >
                          {selected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                        {pack.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
                Đã chọn: <strong style={{ color: 'var(--text)' }}>{selectedPacks.length} bộ</strong> ({selectedWordCount} từ vựng chuẩn CEFR)
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div
                className="p-4 rounded-2xl border grid grid-cols-3 gap-3 text-center"
                style={{ backgroundColor: 'var(--bg2)', borderColor: 'var(--border)' }}
              >
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>Trình độ</div>
                  <div className="font-serif-display font-semibold text-base mt-0.5" style={{ color: 'var(--accent)' }}>
                    {LEVELS.find((l) => l.id === level)?.badge}
                  </div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>Mục tiêu ngày</div>
                  <div className="font-serif-display font-semibold text-base mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--green)' }}>
                    <Flame className="w-4 h-4" />
                    {goal} lượt
                  </div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>Từ nạp thêm</div>
                  <div className="font-serif-display font-semibold text-base mt-0.5 inline-flex items-center gap-1">
                    <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    +{selectedWordCount} từ
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                  Bạn muốn bắt đầu trải nghiệm ngay với chế độ nào?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleFinish('dictation')}
                    className="p-4 rounded-2xl border text-left transition-transform active:scale-[0.98] cursor-pointer space-y-1.5"
                    style={{
                      backgroundColor: 'var(--accent)',
                      borderColor: 'var(--accent)',
                      color: '#fff',
                    }}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Headphones className="w-4 h-4" />
                      Nghe chép YouTube
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed">
                      Luyện nghe từng câu TED/Shorts, bấm tra từ và Shadowing 2.0 ngay.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFinish('flashcard')}
                    className="p-4 rounded-2xl border text-left transition-transform active:scale-[0.98] cursor-pointer space-y-1.5"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--accent)',
                      color: 'var(--text)',
                    }}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--accent)' }}>
                      <Layers className="w-4 h-4" />
                      Ôn Flashcard FSRS v5
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                      Lật thẻ 2 chiều Anh ↔ Việt & chỉ nghe bằng lịch ôn thông minh FSRS.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg2)' }}
        >
          {step === 1 ? (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-medium cursor-pointer hover:underline"
              style={{ color: 'var(--text3)' }}
            >
              Để sau, tự khám phá
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Quay lại
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Tiếp tục
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleFinish('home')}
              className="px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Vào Trang chủ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
