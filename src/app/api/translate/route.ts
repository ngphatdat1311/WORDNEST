import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, SlidingWindowRateLimiter, TtlLruCache } from '@/lib/server-cache';

const translateCache = new TtlLruCache<string>(2000, 24 * 60 * 60 * 1000);
const translateLimiter = new SlidingWindowRateLimiter(120, 60_000);
const MAX_TRANSLATE_LENGTH = 1000;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = translateLimiter.allow(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { vi: '', error: 'Bạn dịch quá nhanh. Vui lòng thử lại sau vài giây.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const rawText = (request.nextUrl.searchParams.get('text') || '').trim();
  if (!rawText) {
    return NextResponse.json({ vi: '' });
  }
  const text = rawText.slice(0, MAX_TRANSLATE_LENGTH);
  const cacheKey = text.toLowerCase();

  const cached = translateCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(
      { vi: cached },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'X-WordNest-Cache': 'HIT',
        },
      }
    );
  }

  // 1. Try MyMemory Translation API (reliable & CORS/serverless friendly)
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=en|vi`;
    const res = await fetch(mmUrl, {
      headers: { 'User-Agent': 'WordNest/2.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const translation = data?.responseData?.translatedText;
      if (
        translation &&
        typeof translation === 'string' &&
        !translation.includes('MYMEMORY WARNING')
      ) {
        const vi = translation.trim();
        translateCache.set(cacheKey, vi);
        return NextResponse.json(
          { vi },
          {
            headers: {
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
              'X-WordNest-Cache': 'MISS',
            },
          }
        );
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Fallback to Google Translate public proxy
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
      text
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const vi = Array.isArray(data?.[0])
        ? data[0].map((part: [string]) => part?.[0] || '').join('').trim()
        : '';
      if (vi) {
        translateCache.set(cacheKey, vi);
        return NextResponse.json(
          { vi },
          {
            headers: {
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
              'X-WordNest-Cache': 'MISS',
            },
          }
        );
      }
    }
  } catch {
    // Fallback failed
  }

  return NextResponse.json({ vi: '' });
}
