import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recoverEnglishFromVietnameseIme } from '../src/lib/vietnamese-ime-guard.ts';

function simulateTyping(steps: string[]): string {
  let cur = '';
  for (const rawNext of steps) {
    // Each step simulates what Unikey puts in the input given `cur`
    cur = recoverEnglishFromVietnameseIme(cur, rawNext, rawNext.length).value;
  }
  return cur;
}

describe('Vietnamese IME (Unikey/Telex) Auto-English Guard', () => {
  it('passes pure ASCII through untouched', () => {
    const res = recoverEnglishFromVietnameseIme('hello', 'hello world');
    assert.equal(res.value, 'hello world');
    assert.equal(res.cursorOffsetDelta, 0);
  });

  it('recovers tone-mark words (s, f, r, x, j) cleanly as user types', () => {
    // "this": thi + s -> thís => this
    assert.equal(simulateTyping(['t', 'th', 'thi', 'thí']), 'this');
    // "hired": hi + r -> hỉ => hir -> hire -> hired
    assert.equal(simulateTyping(['h', 'hi', 'hỉ', 'hire', 'hired']), 'hired');
    // "of": o + f -> ò => of
    assert.equal(simulateTyping(['o', 'ò']), 'of');
    // "example": e + x -> ẽ => ex -> example
    assert.equal(simulateTyping(['e', 'ẽ', 'exa', 'exam', 'examp', 'exampl', 'example']), 'example');
    // "object": ob + j -> ọb => obj -> object
    assert.equal(simulateTyping(['o', 'ob', 'ọb', 'obje', 'objec', 'object']), 'object');
    // "skills": skill + s -> skíll => skills
    assert.equal(simulateTyping(['s', 'sk', 'ski', 'skil', 'skill', 'skíll']), 'skills');
  });

  it('recovers double-vowel & d-stroke words (aa, ee, oo, dd) cleanly', () => {
    // "free": fre + e -> frê => free
    assert.equal(simulateTyping(['f', 'fr', 'fre', 'frê']), 'free');
    // "too": to + o -> tô => too
    assert.equal(simulateTyping(['t', 'to', 'tô']), 'too');
    // "add": ad + d -> ađ => add
    assert.equal(simulateTyping(['a', 'ad', 'ađ']), 'add');
    // "aar": aa -> â
    assert.equal(simulateTyping(['a', 'â', 'aar']), 'aar');
  });

  it('recovers w-based words (standalone ư, aw -> ă, ow -> ơ, uw -> ư)', () => {
    // "word": "" -> ư => w -> wo -> wỏ => wor -> word
    assert.equal(simulateTyping(['ư', 'wo', 'wỏ', 'word']), 'word');
    // "Word": "" -> Ư => W -> Wo -> Wỏ => Wor -> Word
    assert.equal(simulateTyping(['Ư', 'Wo', 'Wỏ', 'Word']), 'Word');
    // "awesome": a + w -> ă => aw -> awe -> awé => awes -> awesome
    assert.equal(simulateTyping(['a', 'ă', 'awe', 'awé', 'aweso', 'awesom', 'awesome']), 'awesome');
    // "how": ho + w -> hơ => how
    assert.equal(simulateTyping(['h', 'ho', 'hơ']), 'how');
    // "swim": s + w -> sư => sw -> swi -> swim
    assert.equal(simulateTyping(['s', 'sư', 'swi', 'swim']), 'swim');
  });

  it('inserts recovered key at cursor position when editing middle of a word', () => {
    // Editing "he" with cursor at index 2 -> user types 'r' -> Unikey outputs "hẻ"
    const res = recoverEnglishFromVietnameseIme('he', 'hẻ', 2);
    assert.equal(res.value, 'her');
    assert.equal(res.cursorOffsetDelta, 1);
  });

  it('handles stateless fallback for pasted/composed Vietnamese strings', () => {
    const res = recoverEnglishFromVietnameseIme('', 'thí hỉed');
    assert.equal(res.value, 'this hired');
  });
});
