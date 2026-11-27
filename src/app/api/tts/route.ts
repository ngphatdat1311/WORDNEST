import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, SlidingWindowRateLimiter, TtlLruCache } from '@/lib/server-cache';

const ttsCache = new TtlLruCache<Uint8Array>(300, 24 * 60 * 60 * 1000);
const ttsLimiter = new SlidingWindowRateLimiter(150, 60_000);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sanitizeSpeechText(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 190) return cleaned;
  // Cut cleanly on a word boundary so TTS never clips mid-word
  const cut = cleaned.slice(0, 190);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 80 ? cut.slice(0, lastSpace) : cut;
}

async function fetchAudioBuffer(url: string, timeoutMs = 4500): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
        Referer: 'https://translate.google.com/',
      },
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // Reject HTML/JSON error pages disguised as 200 OK
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return null;
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 512) return null;
    return new Uint8Array(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const rawText = req.nextUrl.searchParams.get('text') || '';
  const langParam = (req.nextUrl.searchParams.get('lang') || 'en-US').trim();
  const lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(langParam) ? langParam : 'en-US';

  const text = sanitizeSpeechText(rawText);
  if (!text) {
    return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
  }

  const cacheKey = `${lang.toLowerCase()}::${text.toLowerCase()}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    return new NextResponse(Buffer.from(cached), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(cached.byteLength),
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-TTS-Cache': 'HIT',
      },
    });
  }

  const ip = getClientIp(req.headers);
  const limit = ttsLimiter.allow(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const encoded = encodeURIComponent(text);
  const providers: string[] = [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${encodeURIComponent(lang)}&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encoded}`,
  ];

  // For single words & short phrases, also include US English human dictionary pronunciation fallback
  if (lang.toLowerCase().startsWith('en') && text.length <= 45) {
    providers.push(`https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`);
  }

  let audioBytes: Uint8Array | null = null;
  for (const url of providers) {
    audioBytes = await fetchAudioBuffer(url);
    if (audioBytes) break;
  }

  if (!audioBytes) {
    return NextResponse.json({ error: 'TTS providers unavailable' }, { status: 503 });
  }

  ttsCache.set(cacheKey, audioBytes);

  return new NextResponse(Buffer.from(audioBytes), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBytes.byteLength),
      'Cache-Control': 'public, max-age=86400, immutable',
      'X-TTS-Cache': 'MISS',
    },
  });
}
