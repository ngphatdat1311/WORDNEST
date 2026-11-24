import { NextRequest, NextResponse } from 'next/server';
import {
  getClientIp,
  getLemmaCandidates,
  SlidingWindowRateLimiter,
  TtlLruCache,
} from '@/lib/server-cache';
import { LookupResult, WordLevel, WordType } from '@/types/wordnest';

const lookupCache = new TtlLruCache<LookupResult>(1000, 24 * 60 * 60 * 1000);
const lookupLimiter = new SlidingWindowRateLimiter(120, 60_000);
const MAX_WORD_LENGTH = 80;

function mapPosToWordType(pos?: string, word = ''): WordType {
  if (word.trim().includes(' ')) return 'phrase';
  const p = (pos || '').toLowerCase();
  if (p.includes('noun')) return 'noun';
  if (p.includes('verb')) return 'verb';
  if (p.includes('adjective')) return 'adj';
  if (p.includes('adverb')) return 'adv';
  return 'other';
}

function guessLevel(word: string): WordLevel {
  const len = word.trim().length;
  if (len <= 5) return 'easy';
  if (len <= 9) return 'medium';
  return 'hard';
}

async function fetchTranslateVi(text: string): Promise<{ main: string; alts: string[] }> {
  // 1. Try MyMemory API
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
      const main = data?.responseData?.translatedText;
      if (main && typeof main === 'string' && !main.includes('MYMEMORY WARNING')) {
        const alts: string[] = [];
        if (Array.isArray(data?.matches)) {
          for (const m of data.matches) {
            const tr = m?.translation?.trim();
            if (tr && tr.toLowerCase() !== main.toLowerCase() && !alts.includes(tr)) {
              alts.push(tr);
            }
          }
        }
        return { main: main.trim(), alts: alts.slice(0, 4) };
      }
    }
  } catch {
    // Continue to Google fallback
  }

  // 2. Google Translate fallback
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(
      text
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { main: '', alts: [] };
    const data = await res.json();
    const main = Array.isArray(data?.[0])
      ? data[0].map((part: [string]) => part?.[0] || '').join('').trim()
      : '';
    const alts: string[] = [];
    if (Array.isArray(data?.[1])) {
      for (const group of data[1]) {
        if (Array.isArray(group?.[1])) {
          for (const alt of group[1].slice(0, 3)) {
            if (typeof alt === 'string' && alt.toLowerCase() !== main.toLowerCase() && !alts.includes(alt)) {
              alts.push(alt);
            }
          }
        }
      }
    }
    return { main, alts: alts.slice(0, 4) };
  } catch {
    return { main: '', alts: [] };
  }
}

interface DictFetchResult {
  found: boolean;
  phonetic: string;
  audioUrl?: string;
  type: WordType;
  examples: string[];
}

async function fetchDictionarySingle(word: string): Promise<DictFetchResult> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) {
      return { found: false, phonetic: '', type: mapPosToWordType('', word), examples: [] };
    }
    const entries = await res.json();
    const entry = Array.isArray(entries) ? entries[0] : null;
    if (!entry) return { found: false, phonetic: '', type: mapPosToWordType('', word), examples: [] };

    let phonetic = entry.phonetic || '';
    let audioUrl: string | undefined;

    if (Array.isArray(entry.phonetics)) {
      for (const p of entry.phonetics) {
        if (!phonetic && p.text) phonetic = p.text;
        if (!audioUrl && p.audio) audioUrl = p.audio;
      }
    }

    let firstPos = '';
    const examples: string[] = [];

    if (Array.isArray(entry.meanings)) {
      for (const m of entry.meanings) {
        if (!firstPos && m.partOfSpeech) firstPos = m.partOfSpeech;
        if (Array.isArray(m.definitions)) {
          for (const d of m.definitions) {
            if (d.example && typeof d.example === 'string' && !examples.includes(d.example)) {
              examples.push(d.example.trim());
            }
          }
        }
      }
    }

    return {
      found: true,
      phonetic,
      audioUrl,
      type: mapPosToWordType(firstPos, word),
      examples: examples.slice(0, 5),
    };
  } catch {
    return { found: false, phonetic: '', type: mapPosToWordType('', word), examples: [] };
  }
}

async function fetchDictionaryApi(word: string): Promise<DictFetchResult> {
  const direct = await fetchDictionarySingle(word);
  if (direct.found) return direct;

  // Fallback to base-form lemma candidates for inflected words (e.g. procrastinating -> procrastinate)
  for (const lemma of getLemmaCandidates(word)) {
    const fallback = await fetchDictionarySingle(lemma);
    if (fallback.found) return fallback;
  }

  return direct;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = lookupLimiter.allow(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Bạn tra từ quá nhanh. Vui lòng thử lại sau vài giây.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const rawWord = (request.nextUrl.searchParams.get('word') || '').trim();
  if (!rawWord) {
    return NextResponse.json({ error: 'Vui lòng nhập từ cần tra.' }, { status: 400 });
  }
  if (rawWord.length > MAX_WORD_LENGTH) {
    return NextResponse.json(
      { error: `Từ cần tra tối đa ${MAX_WORD_LENGTH} ký tự.` },
      { status: 400 }
    );
  }

  const cleanWord = rawWord.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  if (!cleanWord) {
    return NextResponse.json({ error: 'Từ không hợp lệ.' }, { status: 400 });
  }

  const cacheKey = cleanWord.toLowerCase();
  const cached = lookupCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-WordNest-Cache': 'HIT',
      },
    });
  }

  const [dict, trans] = await Promise.all([
    fetchDictionaryApi(cleanWord),
    fetchTranslateVi(cleanWord),
  ]);

  let exampleVi: string | undefined;
  if (dict.examples[0]) {
    const exTrans = await fetchTranslateVi(dict.examples[0]);
    if (exTrans.main) exampleVi = exTrans.main;
  }

  const result: LookupResult = {
    word: cleanWord,
    phonetic: dict.phonetic,
    audioUrl: dict.audioUrl,
    meaning: trans.main || '',
    altMeanings: trans.alts,
    type: dict.type,
    examples: dict.examples,
    exampleVi,
    level: guessLevel(cleanWord),
  };

  // Only cache meaningful results so transient upstream outages aren't pinned for 24h
  if (result.meaning || result.phonetic) {
    lookupCache.set(cacheKey, result);
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-WordNest-Cache': 'MISS',
    },
  });
}
