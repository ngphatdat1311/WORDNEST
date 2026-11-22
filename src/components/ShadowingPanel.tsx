'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, Volume2 } from 'lucide-react';
import { evaluateShadowing } from '@/lib/dictation-engine';
import { playChime, speakEnglish, vibrateLight } from '@/lib/speech';

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface ShadowingPanelProps {
  targetText: string;
  onReplayAudio: () => void;
}

export function ShadowingPanel({ targetText, onReplayAudio }: ShadowingPanelProps) {
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const evaluation = useMemo(
    () => (spoken.trim() ? evaluateShadowing(targetText, spoken) : null),
    [targetText, spoken]
  );

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const toggleMic = () => {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setErrorMsg('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói (hãy dùng Chrome / Safari mới).');
      return;
    }

    setErrorMsg('');
    setSpoken('');
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e) => {
      let full = '';
      let isFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript + ' ';
        if (e.results[i].isFinal) isFinal = true;
      }
      const trimmed = full.trim();
      setSpoken(trimmed);
      if (isFinal && trimmed) {
        const res = evaluateShadowing(targetText, trimmed);
        if (res.score >= 80) {
          playChime('success');
          vibrateLight(18);
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setErrorMsg('Chưa cấp quyền Microphone cho trình duyệt.');
      } else if (e.error !== 'no-speech') {
        setErrorMsg('Không nghe rõ giọng nói, hãy thử lại gần micro hơn.');
      }
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      vibrateLight(12);
    } catch {
      setListening(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 border space-y-3"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: listening ? 'var(--accent)' : 'var(--border)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold inline-flex items-center gap-1.5"
            style={{ color: 'var(--accent)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Luyện nói Shadowing (Đọc nhại theo câu)
          </span>
          {evaluation && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
              style={{
                backgroundColor:
                  evaluation.score >= 80
                    ? 'var(--green-soft)'
                    : evaluation.score >= 50
                      ? 'var(--gold-soft)'
                      : 'var(--red-soft)',
                color:
                  evaluation.score >= 80
                    ? 'var(--green)'
                    : evaluation.score >= 50
                      ? 'var(--gold)'
                      : 'var(--red)',
              }}
            >
              {evaluation.score}% ({evaluation.matchedCount}/{evaluation.totalCount} từ)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReplayAudio}
            className="px-2.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
          >
            <Volume2 className="w-3.5 h-3.5" />
            Nghe mẫu
          </button>

          <button
            type="button"
            onClick={() => speakEnglish(targetText, 0.8)}
            className="px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
            title="Đọc chậm 0.8x bằng giọng đọc máy"
          >
            Đọc chậm
          </button>

          <button
            type="button"
            disabled={!supported}
            onClick={toggleMic}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 transition-all ${
              listening ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: listening ? 'var(--red)' : 'var(--accent)' }}
          >
            {listening ? (
              <>
                <MicOff className="w-3.5 h-3.5" /> Đang nghe... (Dừng)
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" /> Bấm để nói
              </>
            )}
          </button>
        </div>
      </div>

      {!supported && (
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          Trình duyệt này chưa hỗ trợ Web Speech API. Hãy mở trên Chrome hoặc Safari để dùng Shadowing.
        </p>
      )}

      {errorMsg && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {errorMsg}
        </p>
      )}

      {evaluation && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-1.5 gap-y-1">
            {evaluation.words.map((w, idx) => (
              <span
                key={idx}
                className="font-serif-display text-sm sm:text-base px-1.5 py-0.5 rounded-md font-medium"
                style={{
                  backgroundColor: w.matched ? 'var(--green-soft)' : 'var(--red-soft)',
                  color: w.matched ? 'var(--green)' : 'var(--red)',
                }}
              >
                {w.token.raw}
              </span>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
            Bạn vừa đọc: <span className="italic">&ldquo;{spoken}&rdquo;</span>
          </p>
        </div>
      )}
    </div>
  );
}
