export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Lightweight in-memory LRU cache with TTL for Next.js API routes.
 * Protects external translation/dictionary/YouTube quotas and cuts repeat latency to <1ms.
 */
export class TtlLruCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries = 500, defaultTtlMs = 6 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency (Map preserves insertion order)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs, now = Date.now()): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, { value, expiresAt: now + ttlMs });
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Simple sliding-window per-client rate limiter for API routes.
 * Prevents open-proxy abuse while staying generous for real learners (including batch IPA fill).
 */
export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 90, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  allow(clientKey: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const cutoff = now - this.windowMs;
    const prev = (this.hits.get(clientKey) || []).filter((ts) => ts > cutoff);

    if (prev.length >= this.maxRequests) {
      this.hits.set(clientKey, prev);
      const oldest = prev[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    prev.push(now);
    this.hits.set(clientKey, prev);

    // Opportunistic cleanup to keep memory bounded
    if (this.hits.size > 2000) {
      for (const [k, arr] of this.hits.entries()) {
        if (!arr.length || arr[arr.length - 1] <= cutoff) {
          this.hits.delete(k);
        }
      }
    }

    return { allowed: true, remaining: this.maxRequests - prev.length, retryAfterSec: 0 };
  }
}

export function getClientIp(headers: { get: (name: string) => string | null }): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') || 'local';
}

/**
 * Generates likely base-form lemma candidates when dictionaryapi.dev returns 404
 * for an inflected English word (e.g. "procrastinating" -> ["procrastinate", "procrastinat"]).
 */
export function getLemmaCandidates(word: string): string[] {
  const w = word.trim().toLowerCase();
  if (!w || w.includes(' ') || w.length < 4) return [];

  const out: string[] = [];
  const push = (cand: string) => {
    if (cand.length >= 2 && cand !== w && !out.includes(cand)) {
      out.push(cand);
    }
  };

  if (w.endsWith('ies') && w.length > 4) {
    push(`${w.slice(0, -3)}y`);
  }
  if (w.endsWith('ied') && w.length > 4) {
    push(`${w.slice(0, -3)}y`);
  }
  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3);
    push(`${stem}e`); // procrastinating -> procrastinate, making -> make
    push(stem); // playing -> play
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1)); // running -> run, stopping -> stop
    }
  }
  if (w.endsWith('ed') && w.length > 4) {
    const stem = w.slice(0, -2);
    push(`${stem}e`); // created -> create
    push(stem); // played -> play
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1)); // stopped -> stop
    }
  }
  if (w.endsWith('es') && w.length > 4) {
    push(w.slice(0, -2)); // watches -> watch
    push(w.slice(0, -1)); // makes -> make
  } else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
    push(w.slice(0, -1));
  }
  if (w.endsWith('ly') && w.length > 5) {
    const stem = w.slice(0, -2);
    push(stem);
    if (stem.endsWith('i')) push(`${stem.slice(0, -1)}y`); // happily -> happy
  }

  return out.slice(0, 3);
}

export interface CaptionTrackLike {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

/**
 * Strictly selects an English caption track (preferring manual English over auto-generated ASR).
 * Never silently falls back to a non-English language track (e.g. Korean/Japanese/Spanish).
 */
export function pickEnglishCaptionTrack<T extends CaptionTrackLike>(tracks: T[]): T | null {
  if (!tracks?.length) return null;
  const isEnglish = (code: string) => {
    const norm = (code || '').toLowerCase();
    return norm === 'en' || norm.startsWith('en-') || norm.startsWith('en_');
  };
  const manualEn = tracks.find((t) => isEnglish(t.languageCode) && t.kind !== 'asr');
  if (manualEn) return manualEn;
  const asrEn = tracks.find((t) => isEnglish(t.languageCode));
  return asrEn || null;
}
