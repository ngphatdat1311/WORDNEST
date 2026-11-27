/**
 * Stateful Vietnamese IME (Unikey / EVKey / macOS Telex) Auto-English Guard.
 *
 * Vietnamese learners frequently keep Unikey/Telex enabled while practicing English.
 * When they type English words like "this", "hired", "word", "free", "awesome",
 * Unikey intercepts keystrokes at the OS level and turns them into "thís", "hỉed",
 * "wỏd", "frê", "ăesome".
 *
 * By comparing `prevValue` (clean ASCII) with `nextValue` (IME-transformed text),
 * this module deterministically recovers the exact English ASCII keystroke the user
 * pressed in real time — so learners NEVER need to switch Unikey from V -> E!
 */

const TONE_MARK_TO_TELEX: Record<string, string> = {
  '\u0301': 's', // sắc
  '\u0300': 'f', // huyền
  '\u0309': 'r', // hỏi
  '\u0303': 'x', // ngã
  '\u0323': 'j', // nặng
};

const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
const NON_ASCII_VI_RE = /[À-ỹĐđ]/;

/**
 * Strips Vietnamese diacritics and maps đ/Đ -> d/D while preserving letter casing.
 */
export function stripVietnameseToAscii(text: string): string {
  return text
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '');
}

/**
 * Detects which single Telex modifier key produced the transformation from `prev` -> `next`
 * when `stripVietnameseToAscii(next) === stripVietnameseToAscii(prev)`.
 */
function detectAddedTelexKey(prev: string, next: string): string | null {
  const prevChars = Array.from(prev);
  const nextChars = Array.from(next);
  if (prevChars.length !== nextChars.length) return null;

  let detected: string | null = null;
  let upperHint = false;

  for (let i = 0; i < nextChars.length; i++) {
    const pc = prevChars[i];
    const nc = nextChars[i];
    if (pc === nc) continue;

    // d -> đ / D -> Đ
    if ((pc === 'd' && nc === 'đ') || (pc === 'D' && nc === 'Đ')) {
      detected = 'd';
      upperHint = nc === 'Đ';
      break;
    }

    const pNfd = pc.normalize('NFD');
    const nNfd = nc.normalize('NFD');
    const baseChar = nNfd[0] || '';
    const pMarks = new Set(Array.from(pNfd.slice(1)));
    const nMarks = Array.from(nNfd.slice(1));

    for (const mark of nMarks) {
      if (pMarks.has(mark)) continue;
      if (TONE_MARK_TO_TELEX[mark]) {
        detected = TONE_MARK_TO_TELEX[mark];
        upperHint = baseChar === baseChar.toUpperCase() && baseChar !== baseChar.toLowerCase();
        break;
      }
      if (mark === '\u0302') {
        // Circumflex: aa -> â, ee -> ê, oo -> ô
        detected = baseChar.toLowerCase();
        upperHint = baseChar === baseChar.toUpperCase() && baseChar !== baseChar.toLowerCase();
        break;
      }
      if (mark === '\u0306' || mark === '\u031b') {
        // Breve (aw -> ă) or Horn (ow -> ơ, uw -> ư)
        detected = 'w';
        upperHint = baseChar === baseChar.toUpperCase() && baseChar !== baseChar.toLowerCase();
        break;
      }
    }
    if (detected) break;
  }

  if (!detected) return null;
  // Preserve uppercase only if the entire previous token is uppercase (e.g., CAPS LOCK)
  const isAllCaps = prev.length >= 2 && prev === prev.toUpperCase() && prev !== prev.toLowerCase();
  if (upperHint && isAllCaps) {
    return detected.toUpperCase();
  }
  return detected;
}

/**
 * Stateless fallback reverse-Telex expansion for any remaining Vietnamese characters
 * (e.g., if a user pasted composed text or typed multiple keys inside an IME composition).
 */
function fallbackReverseTelexWord(word: string): string {
  if (!NON_ASCII_VI_RE.test(word)) return word;

  let out = '';

  for (const ch of Array.from(word)) {
    if (ch === 'đ') {
      out += 'dd';
      continue;
    }
    if (ch === 'Đ') {
      out += 'Dd';
      continue;
    }

    const nfd = ch.normalize('NFD');
    const base = nfd[0] || ch;
    const marks = Array.from(nfd.slice(1));
    out += base;

    let vowelTone = '';
    for (const m of marks) {
      if (m === '\u0302') {
        out += base.toLowerCase();
      } else if (m === '\u0306' || m === '\u031b') {
        if (out.length === 1 && base.toLowerCase() === 'u' && m === '\u031b') {
          out = base === 'U' ? 'W' : 'w';
        } else {
          out += 'w';
        }
      } else if (TONE_MARK_TO_TELEX[m]) {
        vowelTone += TONE_MARK_TO_TELEX[m];
      }
    }
    if (vowelTone) out += vowelTone;
  }

  return out;
}

/**
 * Recovers clean English ASCII text when a Vietnamese IME (Unikey / EVKey / macOS Telex)
 * transforms keystrokes inside an English-only input field.
 *
 * @param prevValue The previous clean input value before this change event
 * @param nextValue The raw `e.target.value` emitted by the input
 * @param selectionStart Optional cursor position after the change
 */
export function recoverEnglishFromVietnameseIme(
  prevValue: string,
  nextValue: string,
  selectionStart?: number | null
): { value: string; cursorOffsetDelta: number } {
  // Fast path: pure ASCII needs zero processing
  if (!NON_ASCII_VI_RE.test(nextValue)) {
    return { value: nextValue, cursorOffsetDelta: 0 };
  }

  // Case A: User pressed 'w' / 'W' -> IME inserted standalone 'ư' / 'Ư'
  // (e.g., "" -> "ư" => "w", "s" -> "sư" => "sw", "th" -> "thư" => "thw")
  if (nextValue.length === prevValue.length + 1) {
    // Find the single inserted character
    let insertIdx = prevValue.length;
    for (let i = 0; i < prevValue.length; i++) {
      if (prevValue[i] !== nextValue[i]) {
        insertIdx = i;
        break;
      }
    }
    const inserted = nextValue[insertIdx];
    const withoutInserted = nextValue.slice(0, insertIdx) + nextValue.slice(insertIdx + 1);
    if (withoutInserted === prevValue && (inserted === 'ư' || inserted === 'Ư' || inserted === 'ơ' || inserted === 'Ơ')) {
      const recovered = inserted === 'Ư' || inserted === 'Ơ' ? 'W' : 'w';
      return {
        value: prevValue.slice(0, insertIdx) + recovered + prevValue.slice(insertIdx),
        cursorOffsetDelta: 0,
      };
    }
  }

  // Case B: Unikey modified an existing vowel/consonant in `prevValue` by adding a Telex diacritic/tone
  // (e.g., "thi" -> "thí" => "this", "hi" -> "hỉ" => "hir", "fre" -> "frê" => "free", "ad" -> "ađ" => "add")
  if (nextValue.length === prevValue.length && stripVietnameseToAscii(nextValue) === prevValue) {
    const recoveredKey = detectAddedTelexKey(prevValue, nextValue);
    if (recoveredKey) {
      const insertAt =
        typeof selectionStart === 'number' && selectionStart >= 0 && selectionStart <= prevValue.length
          ? selectionStart
          : prevValue.length;
      return {
        value: prevValue.slice(0, insertAt) + recoveredKey + prevValue.slice(insertAt),
        cursorOffsetDelta: 1,
      };
    }
  }

  // Case C: Fallback per-token reverse Telex recovery (handles multi-char composition commits & paste)
  const recovered = nextValue
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : fallbackReverseTelexWord(part)))
    .join('');

  return {
    value: recovered,
    cursorOffsetDelta: recovered.length - nextValue.length,
  };
}
