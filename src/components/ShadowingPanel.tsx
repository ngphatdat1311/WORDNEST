'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Play, Repeat, Sparkles, Square, Volume2 } from 'lucide-react';
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
  // Electron Chromium lacks Google Speech API keys and throws 'network' errors,
  // so skip Web Speech API in Desktop mode and rely cleanly on Record & Compare.
  const w = window as unknown as {
    wordnestDesktop?: { isDesktop?: boolean };
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  if (w.wordnestDesktop?.isDesktop) return null;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

interface ShadowingPanelProps {
  targetText: string;
  onReplayAudio: () => void;
}

export function ShadowingPanel({ targetText, onReplayAudio }: ShadowingPanelProps) {
  const [recording, setRecording] = useState(false);
  const [recordedForText, setRecordedForText] = useState('');
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [playingBack, setPlayingBack] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [spoken, setSpoken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const speechRecRef = useRef<SpeechRecognitionLike | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const meterAudioCtxRef = useRef<AudioContext | null>(null);
  const compareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const canRecord = useMemo(() => isMediaRecorderSupported(), []);
  const canSpeechScore = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const activeRecordedUrl = recordedForText === targetText ? recordedUrl : null;
  const activeSpoken = recordedForText === targetText ? spoken : '';

  const evaluation = useMemo(
    () => (activeSpoken.trim() ? evaluateShadowing(targetText, activeSpoken) : null),
    [targetText, activeSpoken]
  );

  const cleanupMeter = useCallback(() => {
    if (analyserRafRef.current !== null) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (meterAudioCtxRef.current) {
      meterAudioCtxRef.current.close().catch(() => {});
      meterAudioCtxRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const stopRecordingHardware = useCallback(() => {
    try {
      speechRecRef.current?.stop();
    } catch {
      // ignore
    }
    speechRecRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    cleanupMeter();
    setRecording(false);
  }, [cleanupMeter]);

  useEffect(() => {
    return () => {
      stopRecordingHardware();
      if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
      playbackAudioRef.current?.pause();
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
    };
  }, [stopRecordingHardware]);

  const startLiveMeter = (stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      meterAudioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms * 4.5));
        analyserRafRef.current = requestAnimationFrame(tick);
      };
      analyserRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Optional visual meter
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      stopRecordingHardware();
      return;
    }

    if (!canRecord && !canSpeechScore) {
      setErrorMsg('Thiết bị hoặc trình duyệt hiện tại chưa hỗ trợ ghi âm Microphone.');
      return;
    }

    setErrorMsg('');
    setRecordedForText(targetText);
    setSpoken('');
    playbackAudioRef.current?.pause();
    setPlayingBack(false);

    // 1. Start MediaRecorder (universal Record & Compare on Electron + all browsers)
    if (canRecord) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        chunksRef.current = [];
        recStartRef.current = Date.now();

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size > 0) {
            if (recordedUrlRef.current) {
              URL.revokeObjectURL(recordedUrlRef.current);
            }
            const nextUrl = URL.createObjectURL(blob);
            recordedUrlRef.current = nextUrl;
            setRecordedUrl(nextUrl);
            setRecordedDurationSec(
              Math.max(0.5, Number(((Date.now() - recStartRef.current) / 1000).toFixed(1)))
            );
          }
        };

        recorder.start();
        startLiveMeter(stream);
      } catch {
        setErrorMsg('Không thể mở Microphone. Hãy kiểm tra quyền truy cập micro của hệ thống/trình duyệt.');
        stopRecordingHardware();
        return;
      }
    }

    // 2. Optionally run Web Speech API word-match scoring in parallel (Chrome/Safari Web)
    const SpeechCtor = getSpeechRecognitionCtor();
    if (SpeechCtor) {
      try {
        const rec = new SpeechCtor();
        rec.lang = 'en-US';
        rec.interimResults = true;
        rec.continuous = true;
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
        rec.onerror = () => {
          // Silently degrade to Record & Compare if browser speech cloud is unavailable
        };
        rec.start();
        speechRecRef.current = rec;
      } catch {
        // Silent fallback to Record & Compare
      }
    }

    setRecording(true);
    vibrateLight(12);
  };

  const playSelfRecording = useCallback(() => {
    if (!activeRecordedUrl) return;
    if (playingBack && playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setPlayingBack(false);
      return;
    }
    const audio = new Audio(activeRecordedUrl);
    playbackAudioRef.current = audio;
    audio.onended = () => setPlayingBack(false);
    audio.onerror = () => setPlayingBack(false);
    setPlayingBack(true);
    audio.play().catch(() => setPlayingBack(false));
  }, [activeRecordedUrl, playingBack]);

  const handleCompareWithNative = () => {
    if (!activeRecordedUrl) return;
    if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
    onReplayAudio();
    const wordEstimateMs = Math.min(7500, Math.max(2200, targetText.split(/\s+/).length * 360));
    compareTimerRef.current = setTimeout(() => {
      playSelfRecording();
    }, wordEstimateMs);
  };

  const meterBars = [0.25, 0.45, 0.7, 0.95, 1, 0.85, 0.65, 0.9, 0.75, 0.5, 0.35, 0.2];

  return (
    <div
      className="rounded-2xl p-4 border space-y-3"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: recording ? 'var(--red)' : 'var(--border)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-semibold inline-flex items-center gap-1.5"
            style={{ color: 'var(--accent)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Shadowing 2.0 (Ghi âm & So sánh giọng mẫu)
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

        <div className="flex flex-wrap items-center gap-1.5">
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
            onClick={() => speakEnglish(targetText, 0.78)}
            className="px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--text2)',
            }}
            title="Đọc chậm 0.78x để nghe rõ nối âm"
          >
            Đọc chậm
          </button>

          <button
            type="button"
            disabled={!canRecord && !canSpeechScore}
            onClick={toggleRecording}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 transition-all ${
              recording ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: recording ? 'var(--red)' : 'var(--accent)' }}
          >
            {recording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Dừng ghi âm
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" /> Ghi âm nói theo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Audio Level Equalizer while Recording */}
      {recording && (
        <div
          className="rounded-xl px-3.5 py-2.5 border flex items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--red-border)' }}
        >
          <span className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--red)' }}>
            <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: 'var(--red)' }} />
            Đang thu âm giọng nói của bạn... Đọc to theo câu mẫu rồi bấm Dừng!
          </span>
          <div className="flex items-end gap-0.5 h-5 shrink-0" aria-hidden="true">
            {meterBars.map((weight, i) => {
              const heightPct = Math.max(18, Math.round(micLevel * weight * 100));
              return (
                <span
                  key={i}
                  className="w-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: 'var(--red)',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Playback & Side-by-Side Comparison Controls (Works 100% on Electron & All Browsers!) */}
      {activeRecordedUrl && !recording && (
        <div
          className="rounded-xl px-3.5 py-2.5 border flex flex-wrap items-center justify-between gap-2"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text2)' }}>
            Bản ghi âm của bạn ({recordedDurationSec}s) — nghe lại để kiểm tra ngữ điệu & phát âm đuôi:
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={playSelfRecording}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: playingBack ? 'var(--red)' : 'var(--green)' }}
            >
              {playingBack ? (
                <>
                  <Square className="w-3 h-3 fill-current" /> Dừng nghe
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" /> Nghe giọng mình
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCompareWithNative}
              className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--border2)',
                color: 'var(--accent)',
              }}
              title="Phát giọng mẫu trước rồi tự động phát giọng của bạn ngay sau đó"
            >
              <Repeat className="w-3.5 h-3.5" />
              So sánh (Mẫu → Bạn)
            </button>
          </div>
        </div>
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
            Nhận diện lời nói: &ldquo;{activeSpoken}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
