'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-warm-card rounded-3xl p-8 text-center space-y-4">
        <div
          className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
          style={{ backgroundColor: 'var(--red-soft)', color: 'var(--red)' }}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="font-serif-display text-xl font-semibold">WordNest vừa gặp sự cố</h2>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          {error?.message || 'Đã có lỗi bất ngờ xảy ra. Toàn bộ dữ liệu học của bạn vẫn được lưu an toàn.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Tải lại WordNest
        </button>
      </div>
    </div>
  );
}
