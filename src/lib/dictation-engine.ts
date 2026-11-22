import type { TranscriptSegment, WordType } from '../types/wordnest';

/**
 * Extract 11-char YouTube Video ID from watch URL, youtu.be, shorts, embed, live, or raw ID.
 */
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const regex of patterns) {
    const m = trimmed.match(regex);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Forgiving token normalizer for mobile-friendly English dictation:
 * - Case-insensitive
 * - Forgives missing apostrophes in contractions (dont == don't, werent == weren't, ive == I've)
 * - Forgives missing hyphens (wellknown == well-known)
 * - Strips all surrounding punctuation
 */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘`'"]/g, '')
    .replace(/[-–—]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface WordToken {
  raw: string; // original word with punctuation for clean display
  clean: string; // stripped outer punctuation (keeps inner apostrophes & hyphens)
  leadingPunct: string;
  trailingPunct: string;
  normalized: string;
}

/**
 * Tokenizes an English sentence into speakable/typeable words.
 * Automatically filters out standalone punctuation/dash artifacts (e.g. "--", "—", "...")
 * that frequently appear in YouTube captions so users NEVER get stuck on ghost tokens.
 */
export function tokenizeSentence(text: string): WordToken[] {
  // Break em-dashes or double-dashes attached to words into spaces so "word--word" splits cleanly
  const preprocessed = text
    .replace(/\s*(--+|—|–)\s*/g, ' ')
    .replace(/\u2026/g, ' ')
    .trim();

  if (!preprocessed) return [];

  const tokens: WordToken[] = [];
  for (const raw of preprocessed.split(/\s+/)) {
    if (!raw) continue;
    const normalized = normalizeToken(raw);
    // Skip pure-punctuation ghost tokens that contain zero letters or digits
    if (!normalized) continue;

    const m = raw.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9'’`-]+)([^a-zA-Z0-9]*)$/);
    if (!m) {
      tokens.push({
        raw,
        clean: raw,
        leadingPunct: '',
        trailingPunct: '',
        normalized,
      });
    } else {
      tokens.push({
        raw,
        leadingPunct: m[1] || '',
        clean: m[2] || raw,
        trailingPunct: m[3] || '',
        normalized,
      });
    }
  }
  return tokens;
}

export interface DiffWordResult {
  target: WordToken;
  typed: string;
  status: 'correct' | 'wrong' | 'partial' | 'pending';
  charStates: Array<{ char: string; state: 'correct' | 'wrong' | 'missing' }>;
}

/**
 * DOL-style realtime sentence diffing (word + character level).
 * Forgives mobile typing shortcuts:
 * - Missing apostrophes (werent == weren't)
 * - Space-separated hyphenated words ("well known" == "well-known")
 */
export function diffDictation(
  targetText: string,
  typedText: string
): {
  words: DiffWordResult[];
  isComplete: boolean;
  accuracy: number;
  correctCount: number;
  totalCount: number;
} {
  const targetTokens = tokenizeSentence(targetText);
  const hasTrailingSpace = /\s$/.test(typedText);
  const rawTypedParts = typedText.trim()
    ? typedText
        .trim()
        .replace(/\s*(--+|—|–)\s*/g, ' ')
        .split(/\s+/)
        .filter((p) => normalizeToken(p).length > 0)
    : [];

  let correctCount = 0;
  let typedCursor = 0;

  const words: DiffWordResult[] = targetTokens.map((target) => {
    const typedRaw = rawTypedParts[typedCursor] ?? '';
    const targetNorm = target.normalized;

    if (!typedRaw) {
      return {
        target,
        typed: '',
        status: 'pending',
        charStates: [],
      };
    }

    // Handle hyphenated target typed as two separate words (e.g. "well known" for "well-known")
    let consumed = 1;
    let combinedTyped = typedRaw;
    if (
      target.clean.includes('-') &&
      typedCursor + 1 < rawTypedParts.length &&
      normalizeToken(typedRaw) !== targetNorm
    ) {
      const twoWordCombined = normalizeToken(typedRaw + rawTypedParts[typedCursor + 1]);
      if (twoWordCombined === targetNorm) {
        consumed = 2;
        combinedTyped = `${typedRaw} ${rawTypedParts[typedCursor + 1]}`;
      }
    }

    const isLastActive = typedCursor + consumed === rawTypedParts.length && !hasTrailingSpace;
    typedCursor += consumed;

    const typedNorm = normalizeToken(combinedTyped);
    const isExact = typedNorm === targetNorm && targetNorm.length > 0;

    if (isExact) {
      correctCount++;
      return {
        target,
        typed: combinedTyped,
        status: 'correct',
        charStates: target.clean.split('').map((c) => ({ char: c, state: 'correct' })),
      };
    }

    const isPrefix = targetNorm.startsWith(typedNorm) && typedNorm.length > 0;
    const status: DiffWordResult['status'] = isLastActive && isPrefix ? 'partial' : 'wrong';

    const charStates: DiffWordResult['charStates'] = [];
    const maxLen = Math.max(targetNorm.length, typedNorm.length);
    for (let i = 0; i < maxLen; i++) {
      const tc = targetNorm[i];
      const uc = typedNorm[i];
      if (uc && tc && uc === tc) {
        charStates.push({ char: uc, state: 'correct' });
      } else if (uc) {
        charStates.push({ char: uc, state: 'wrong' });
      } else if (tc) {
        charStates.push({ char: tc, state: 'missing' });
      }
    }

    return {
      target,
      typed: combinedTyped,
      status,
      charStates,
    };
  });

  const hasExtraTypedWords = typedCursor < rawTypedParts.length;
  const totalCount = targetTokens.length;
  const isComplete = totalCount > 0 && correctCount === totalCount && !hasExtraTypedWords;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return { words, isComplete, accuracy, correctCount, totalCount };
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'to', 'of',
  'in', 'on', 'at', 'for', 'and', 'or', 'but', 'it', 'i', 'you', 'he',
  'she', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'that',
  'this', 'as', 'by', 'so', 'if', 'do', 'no', 'not',
]);

/**
 * Deterministically picks ~35% meaningful keywords to blank out for Fill-in-the-Blanks mode.
 */
export function selectBlankIndices(text: string): number[] {
  const tokens = tokenizeSentence(text);
  if (tokens.length <= 2) return tokens.map((_, i) => i);

  const candidates: number[] = [];
  const fallbacks: number[] = [];

  tokens.forEach((t, i) => {
    if (t.normalized.length >= 4 && !STOP_WORDS.has(t.normalized)) {
      candidates.push(i);
    } else if (t.normalized.length >= 2) {
      fallbacks.push(i);
    }
  });

  const targetCount = Math.max(1, Math.min(4, Math.round(tokens.length * 0.35)));
  const pool = candidates.length >= targetCount ? candidates : [...candidates, ...fallbacks];

  const step = Math.max(1, Math.floor(pool.length / targetCount));
  const picked: number[] = [];
  for (let i = 0; i < pool.length && picked.length < targetCount; i += step) {
    picked.push(pool[i]);
  }
  return picked.sort((a, b) => a - b);
}

/**
 * Deterministic shuffle for Tap-to-Order word bank chips.
 */
export function createScrambledChips(
  text: string,
  seed = 7
): Array<{ id: string; token: WordToken; originalIndex: number }> {
  const tokens = tokenizeSentence(text);
  const items = tokens.map((token, idx) => ({
    id: `chip-${idx}-${token.normalized}`,
    token,
    originalIndex: idx,
  }));

  let s = seed + text.length * 31;
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  if (items.length > 1 && items.every((it, i) => it.originalIndex === i)) {
    [items[0], items[1]] = [items[1], items[0]];
  }

  return items;
}

const IRREGULAR_VERBS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  become: ['became', 'becoming'],
  begin: ['began', 'begun', 'beginning'],
  blow: ['blew', 'blown'],
  break: ['broke', 'broken', 'breaking'],
  bring: ['brought'],
  build: ['built'],
  buy: ['bought'],
  catch: ['caught'],
  choose: ['chose', 'chosen', 'choosing'],
  come: ['came', 'coming'],
  cut: ['cutting'],
  do: ['did', 'done', 'does', 'doing'],
  draw: ['drew', 'drawn'],
  drink: ['drank', 'drunk'],
  drive: ['drove', 'driven', 'driving'],
  eat: ['ate', 'eaten'],
  fall: ['fell', 'fallen'],
  feel: ['felt'],
  fight: ['fought'],
  find: ['found'],
  fly: ['flew', 'flown'],
  forget: ['forgot', 'forgotten', 'forgetting'],
  get: ['got', 'gotten', 'getting'],
  give: ['gave', 'given', 'giving'],
  go: ['went', 'gone', 'goes', 'going'],
  grow: ['grew', 'grown'],
  have: ['had', 'has', 'having'],
  hear: ['heard'],
  hide: ['hid', 'hidden', 'hiding'],
  hold: ['held'],
  keep: ['kept'],
  know: ['knew', 'known'],
  lead: ['led'],
  leave: ['left', 'leaving'],
  lose: ['lost', 'losing'],
  make: ['made', 'making'],
  mean: ['meant'],
  meet: ['met'],
  pay: ['paid'],
  put: ['putting'],
  read: ['reading'],
  ride: ['rode', 'ridden', 'riding'],
  rise: ['rose', 'risen', 'rising'],
  run: ['ran', 'running'],
  say: ['said'],
  see: ['saw', 'seen'],
  sell: ['sold'],
  send: ['sent'],
  set: ['setting'],
  shake: ['shook', 'shaken', 'shaking'],
  show: ['showed', 'shown'],
  sing: ['sang', 'sung'],
  sit: ['sat', 'sitting'],
  sleep: ['slept'],
  speak: ['spoke', 'spoken', 'speaking'],
  spend: ['spent'],
  stand: ['stood'],
  steal: ['stole', 'stolen', 'stealing'],
  swim: ['swam', 'swum', 'swimming'],
  take: ['took', 'taken', 'taking'],
  teach: ['taught'],
  tell: ['told'],
  think: ['thought'],
  throw: ['threw', 'thrown'],
  understand: ['understood'],
  wake: ['woke', 'woken', 'waking'],
  wear: ['wore', 'worn'],
  win: ['won', 'winning'],
  write: ['wrote', 'written', 'writing'],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWordVariantsPattern(word: string): string {
  const lower = word.toLowerCase();
  const forms = new Set<string>([lower]);
  if (IRREGULAR_VERBS[lower]) {
    for (const f of IRREGULAR_VERBS[lower]) forms.add(f);
  }
  // Regular inflections (including silent-e drop & y->ies/ied)
  const regularPatterns = [
    `${escapeRegex(lower)}(?:s|es|ed|ing|d)?`,
  ];
  if (lower.endsWith('e') && lower.length >= 3) {
    regularPatterns.push(`${escapeRegex(lower.slice(0, -1))}(?:ing|ed|es)`);
  }
  if (lower.endsWith('y') && lower.length >= 3) {
    regularPatterns.push(`${escapeRegex(lower.slice(0, -1))}(?:ies|ied)`);
  }

  const allPatterns = [
    ...Array.from(forms).map(escapeRegex),
    ...regularPatterns,
  ];
  return `(?:${allPatterns.join('|')})`;
}

/**
 * Masks target word or phrasal verb (including regular & irregular inflections)
 * inside the example sentence so Spelling mode NEVER leaks the answer!
 */
export function maskWordInExample(example: string, targetWord: string): string {
  if (!example || !targetWord) return example;
  const cleanTarget = targetWord.trim();
  if (!cleanTarget) return example;

  const words = cleanTarget.split(/\s+/).filter(Boolean);

  // Single word
  if (words.length === 1) {
    const pattern = `\\b${buildWordVariantsPattern(words[0])}\\b`;
    const regex = new RegExp(pattern, 'gi');
    const masked = example.replace(regex, (m) => '_'.repeat(Math.max(5, Math.min(12, m.length))));
    if (masked !== example) return masked;

    // Fallback prefix stem for long words (e.g. collaborate -> collaboration)
    if (words[0].length >= 5) {
      const stem = escapeRegex(words[0].slice(0, -1));
      const stemRegex = new RegExp(`\\b${stem}[a-z]*\\b`, 'gi');
      return example.replace(stemRegex, '_______');
    }
    return example;
  }

  // Multi-word phrase / phrasal verb (e.g. "give up" -> masks "gave up", "giving up", "gave himself up")
  const firstPat = buildWordVariantsPattern(words[0]);
  const restPats = words.slice(1).map((w) => escapeRegex(w.toLowerCase()));
  // Exact consecutive or with 1 optional pronoun/object word between verb & particle
  const consecutiveRegex = new RegExp(`\\b${firstPat}\\s+${restPats.join('\\s+')}\\b`, 'gi');
  let masked = example.replace(consecutiveRegex, (m) =>
    '_'.repeat(Math.max(7, Math.min(14, m.length)))
  );
  if (masked !== example) return masked;

  if (words.length === 2) {
    const splitRegex = new RegExp(`\\b${firstPat}\\s+([a-z']+\\s+)${restPats[0]}\\b`, 'gi');
    masked = example.replace(splitRegex, (_, middle: string) => `_____ ${middle}___`);
    return masked;
  }

  return example;
}

/**
 * Parse WordNest v1 pipe-separated bulk lines:
 * "word | phonetic | meaning | example | type" OR legacy "word | meaning | example"
 */
export function parseBulkLine(line: string): {
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  type: WordType;
} | null {
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length < 2 || !parts[0]) return null;

  const word = parts[0];
  let phonetic = '';
  let meaning = '';
  let example = '';
  let rawType = '';

  const looksLikePhonetic = (s: string) => /^\/.*\/$/.test(s) || /^\[.*\]$/.test(s);

  if (parts.length >= 4 || (parts.length >= 3 && (looksLikePhonetic(parts[1]) || parts[1] === ''))) {
    phonetic = parts[1] || '';
    meaning = parts[2] || '';
    example = parts[3] || '';
    rawType = parts[4] || '';
  } else {
    meaning = parts[1] || '';
    example = parts[2] || '';
  }

  if (!meaning) return null;

  const type = normalizeWordType(rawType, word);
  return { word, phonetic, meaning, example, type };
}

export function normalizeWordType(raw: string, word = ''): WordType {
  const s = raw.toLowerCase().replace(/[()[\].]/g, '').trim();
  if (['n', 'noun', 'danh từ', 'dt'].includes(s)) return 'noun';
  if (['v', 'verb', 'động từ', 'đt'].includes(s)) return 'verb';
  if (['adj', 'adjective', 'tính từ', 'tt'].includes(s)) return 'adj';
  if (['adv', 'adverb', 'trạng từ'].includes(s)) return 'adv';
  if (['phrase', 'idiom', 'cụm từ', 'phrasal verb'].includes(s)) return 'phrase';
  if (word.trim().includes(' ')) return 'phrase';
  return 'other';
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function parseSrtTimestamp(ts: string): number {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number.isFinite(parts[0]) ? parts[0] : 0;
}

/**
 * Parses SRT, VTT, LRC, or plain line-by-line transcripts into synced TranscriptSegment[].
 */
export function parseSrtOrLrc(
  rawContent: string,
  fallbackDurationSec = 120
): TranscriptSegment[] {
  const content = rawContent.replace(/\r\n/g, '\n').trim();
  if (!content) return [];

  // 1. Try SRT / WebVTT blocks: "00:00:01,500 --> 00:00:04,200"
  const srtRegex =
    /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})[^\n]*\n([\s\S]*?)(?=\n\s*\n|$)/g;
  const srtSegments: TranscriptSegment[] = [];
  let m: RegExpExecArray | null;
  while ((m = srtRegex.exec(content)) !== null) {
    const start = parseSrtTimestamp(m[1]);
    const end = parseSrtTimestamp(m[2]);
    const text = m[3]
      .replace(/<[^>]+>/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      srtSegments.push({
        id: `srt-${srtSegments.length + 1}`,
        start: Number(start.toFixed(2)),
        end: Number(Math.max(start + 1, end).toFixed(2)),
        text,
      });
    }
  }
  if (srtSegments.length > 0) return srtSegments;

  // 2. Try LRC timestamps: "[00:12.50] Hello everyone"
  const lrcLines = content.split('\n');
  const lrcEntries: Array<{ start: number; text: string }> = [];
  for (const line of lrcLines) {
    const lm = line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]\s*(.+)$/);
    if (lm) {
      const start = parseInt(lm[1], 10) * 60 + parseFloat(lm[2]);
      const text = lm[3].trim();
      if (text) lrcEntries.push({ start, text });
    }
  }
  if (lrcEntries.length > 0) {
    return lrcEntries.map((item, idx) => {
      const nextStart =
        idx + 1 < lrcEntries.length
          ? lrcEntries[idx + 1].start
          : Math.max(item.start + 4, fallbackDurationSec);
      return {
        id: `lrc-${idx + 1}`,
        start: Number(item.start.toFixed(2)),
        end: Number(Math.max(item.start + 1.2, nextStart).toFixed(2)),
        text: item.text,
      };
    });
  }

  // 3. Fallback: plain text split by lines, evenly distributed across duration
  const plainLines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\d+$/.test(l) && l.toUpperCase() !== 'WEBVTT');
  if (!plainLines.length) return [];

  const totalSec = Math.max(plainLines.length * 3, fallbackDurationSec);
  const perLine = totalSec / plainLines.length;
  return plainLines.map((text, idx) => ({
    id: `txt-${idx + 1}`,
    start: Number((idx * perLine).toFixed(2)),
    end: Number(((idx + 1) * perLine).toFixed(2)),
    text,
  }));
}

export interface ShadowingWordResult {
  token: WordToken;
  matched: boolean;
}

/**
 * Evaluates spoken Shadowing transcript against target sentence using greedy forward matching
 * so 1 skipped or misheard word does not cascade errors onto the rest of the sentence.
 */
export function evaluateShadowing(
  targetText: string,
  spokenText: string
): {
  words: ShadowingWordResult[];
  score: number;
  matchedCount: number;
  totalCount: number;
} {
  const targetTokens = tokenizeSentence(targetText);
  const spokenNorms = tokenizeSentence(spokenText).map((t) => t.normalized);

  let spokenCursor = 0;
  let matchedCount = 0;

  const words: ShadowingWordResult[] = targetTokens.map((token) => {
    // Look ahead up to 3 words in spoken transcript for resilient alignment
    const windowEnd = Math.min(spokenNorms.length, spokenCursor + 4);
    let foundIdx = -1;
    for (let i = spokenCursor; i < windowEnd; i++) {
      if (spokenNorms[i] === token.normalized) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      matchedCount++;
      spokenCursor = foundIdx + 1;
      return { token, matched: true };
    }

    return { token, matched: false };
  });

  const totalCount = targetTokens.length;
  const score = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
  return { words, score, matchedCount, totalCount };
}
