import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const text = (request.nextUrl.searchParams.get('text') || '').trim();
  if (!text) {
    return NextResponse.json({ vi: '' });
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
      if (translation && typeof translation === 'string' && !translation.includes('MYMEMORY WARNING')) {
        return NextResponse.json({ vi: translation.trim() });
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
      if (vi) return NextResponse.json({ vi });
    }
  } catch {
    // Fallback failed
  }

  return NextResponse.json({ vi: '' });
}

