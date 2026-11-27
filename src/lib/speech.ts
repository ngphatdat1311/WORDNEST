'use client';

let cachedAudioCtx: AudioContext | null = null;
let activeAudioEl: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let speakSeq = 0;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!cachedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) cachedAudioCtx = new AudioCtx();
  }
  if (cachedAudioCtx && cachedAudioCtx.state === 'suspended') {
    cachedAudioCtx.resume().catch(() => {});
  }
  return cachedAudioCtx;
}

function stopActiveAudio(): void {
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // Ignore audio cleanup errors
    }
    activeAudioEl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  activeUtterance = null;
}

function playHtmlAudioSync(
  url: string,
  rate: number,
  seq: number,
  onFailure?: () => void
): void {
  if (seq !== speakSeq) return;
  let failed = false;
  const triggerFailure = () => {
    if (failed || seq !== speakSeq) return;
    failed = true;
    onFailure?.();
  };

  try {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.playbackRate = Math.max(0.5, Math.min(1.5, rate));
    audio.volume = 1;
    activeAudioEl = audio;

    audio.onerror = () => triggerFailure();
    audio.onended = () => {
      if (activeAudioEl === audio) activeAudioEl = null;
    };

    // Called synchronously inside the user gesture so Safari/iOS/Chrome/Electron all allow playback immediately
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => triggerFailure());
    }
  } catch {
    triggerFailure();
  }
}

function speakWithWebSpeechFallback(text: string, rate: number, seq: number): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (seq !== speakSeq) return;

  const runSpeak = () => {
    if (seq !== speakSeq) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      if (synth.paused) synth.resume();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = Math.max(0.5, Math.min(1.5, rate));
      utter.volume = 1;

      const voices = synth.getVoices();
      const preferred =
        voices.find((v) => v.lang === 'en-US' && /Google|Samantha|Natural|Alex|Jenny|Aria/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en-US')) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utter.voice = preferred;

      // Keep strong module reference so Chromium GC never cuts off speech mid-sentence
      activeUtterance = utter;
      utter.onend = () => {
        if (activeUtterance === utter) activeUtterance = null;
      };
      utter.onerror = () => {
        if (activeUtterance === utter) activeUtterance = null;
      };

      // Small delay after cancel() avoids Chromium's notorious silent-drop bug
      setTimeout(() => {
        if (seq !== speakSeq) return;
        try {
          synth.speak(utter);
        } catch {
          // Ignore
        }
      }, 40);
    } catch {
      // Ignore speech synthesis errors on restricted environments
    }
  };

  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      runSpeak();
    } else {
      let triggered = false;
      const onVoices = () => {
        if (triggered) return;
        triggered = true;
        window.speechSynthesis.onvoiceschanged = null;
        runSpeak();
      };
      window.speechSynthesis.onvoiceschanged = onVoices;
      setTimeout(onVoices, 200);
    }
  } catch {
    // Ignore
  }
}

/**
 * Plays natural English pronunciation reliably across Windows, macOS, Linux, Electron & Mobile:
 * 1) Plays real cached MP3 audio synchronously via local `/api/tts` (works even when Electron/Linux has 0 OS voices!)
 * 2) Seamlessly falls back to hardened Web Speech API when completely offline.
 */
export function speakEnglish(text: string, rate = 0.95): void {
  if (typeof window === 'undefined' || !text.trim()) return;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const seq = ++speakSeq;
  stopActiveAudio();

  const ttsUrl = `/api/tts?text=${encodeURIComponent(clean)}&lang=en-US`;
  playHtmlAudioSync(ttsUrl, rate, seq, () => {
    speakWithWebSpeechFallback(clean, rate, seq);
  });
}

export function playAudioUrlOrSpeak(text: string, audioUrl?: string, rate = 0.95): void {
  if (typeof window === 'undefined') return;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean && !audioUrl) return;

  if (audioUrl) {
    const seq = ++speakSeq;
    stopActiveAudio();
    playHtmlAudioSync(audioUrl, rate, seq, () => {
      if (clean) {
        const ttsUrl = `/api/tts?text=${encodeURIComponent(clean)}&lang=en-US`;
        playHtmlAudioSync(ttsUrl, rate, seq, () => {
          speakWithWebSpeechFallback(clean, rate, seq);
        });
      }
    });
    return;
  }

  if (clean) {
    speakEnglish(clean, rate);
  }
}

export function playChime(kind: 'success' | 'error' | 'complete'): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (kind === 'complete') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      osc.frequency.setValueAtTime(783.99, now + 0.18);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.start(now);
      osc.stop(now + 0.43);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch {
    // Silent fallback
  }
}

export function vibrateLight(pattern: number | number[] = 15): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore on unsupported devices
    }
  }
}
