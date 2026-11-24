'use client';

import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onGoHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('[WordNest ErrorBoundary]', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="max-w-xl mx-auto my-8 bg-warm-card rounded-3xl p-8 text-center space-y-4">
        <div
          className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
          style={{ backgroundColor: 'var(--red-soft)', color: 'var(--red)' }}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-serif-display text-xl font-semibold">
            Mục này vừa gặp sự cố tạm thời
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
            Dữ liệu từ vựng và tiến độ học của bạn vẫn an toàn 100%. Bạn có thể tải lại mục này
            hoặc quay về Trang chủ.
          </p>
          {this.state.errorMessage && (
            <p
              className="text-[11px] font-mono px-3 py-1.5 rounded-lg mt-2 break-words"
              style={{ backgroundColor: 'var(--bg2)', color: 'var(--text2)' }}
            >
              {this.state.errorMessage}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Thử lại
          </button>
          {this.props.onGoHome && (
            <button
              type="button"
              onClick={() => {
                this.handleReset();
                this.props.onGoHome?.();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium border inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--text2)',
              }}
            >
              <Home className="w-3.5 h-3.5" />
              Về Trang chủ
            </button>
          )}
        </div>
      </div>
    );
  }
}
