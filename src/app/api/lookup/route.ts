import { NextRequest, NextResponse } from 'next/server';
import { LookupResult, WordLevel, WordType } from '@/types/wordnest';

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

async function fetchDictionaryApi(word: string): Promise<{
  phonetic: string;
  audioUrl?: string;
  type: WordType;
  examples: string[];
}> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) {
      return { phonetic: '', type: mapPosToWordType('', word), examples: [] };
    }
    const entries = await res.json();
    const entry = Array.isArray(entries) ? entries[0] : null;
    if (!entry) return { phonetic: '', type: mapPosToWordType('', word), examples: [] };

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
      phonetic,
      audioUrl,
      type: mapPosToWordType(firstPos, word),
      examples: examples.slice(0, 5),
    };
  } catch {
    return { phonetic: '', type: mapPosToWordType('', word), examples: [] };
  }
}

export async function GET(request: NextRequest) {
  const rawWord = (request.nextUrl.searchParams.get('word') || '').trim();
  if (!rawWord) {
    return NextResponse.json({ error: 'Vui lòng nhập từ cần tra.' }, { status: 400 });
  }

  const cleanWord = rawWord.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  if (!cleanWord) {
    return NextResponse.json({ error: 'Từ không hợp lệ.' }, { status: 400 });
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

  return NextResponse.json(result);
}
