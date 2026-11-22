import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createScrambledChips,
  diffDictation,
  evaluateShadowing,
  extractYoutubeId,
  formatTime,
  maskWordInExample,
  normalizeToken,
  normalizeWordType,
  parseBulkLine,
  parseSrtOrLrc,
  selectBlankIndices,
  tokenizeSentence,
} from '../src/lib/dictation-engine.ts';

describe('extractYoutubeId', () => {
  it('extracts ID from standard watch URL with extra query params', () => {
    assert.equal(
      extractYoutubeId('https://www.youtube.com/watch?v=H14bBuluwB8&t=30s&list=PL123'),
      'H14bBuluwB8'
    );
  });

  it('extracts ID from youtu.be short link', () => {
    assert.equal(extractYoutubeId('https://youtu.be/RcGyVTAoXEU?si=abc123'), 'RcGyVTAoXEU');
  });

  it('extracts ID from YouTube Shorts link', () => {
    assert.equal(
      extractYoutubeId('https://youtube.com/shorts/5MgBikgcWnY?feature=share'),
      '5MgBikgcWnY'
    );
  });

  it('extracts ID from mobile m.youtube.com and raw ID', () => {
    assert.equal(extractYoutubeId('https://m.youtube.com/watch?v=arj7oStGLkU'), 'arj7oStGLkU');
    assert.equal(extractYoutubeId('arj7oStGLkU'), 'arj7oStGLkU');
  });

  it('returns null for invalid URLs', () => {
    assert.equal(extractYoutubeId('https://example.com/video'), null);
    assert.equal(extractYoutubeId('short'), null);
  });
});

describe('tokenizeSentence & diffDictation', () => {
  it('ignores case and surrounding punctuation', () => {
    const r = diffDictation('I have a confession to make.', 'i have a confession to make');
    assert.equal(r.isComplete, true);
    assert.equal(r.accuracy, 100);
  });

  it('forgives missing apostrophes in contractions for mobile typing', () => {
    const r = diffDictation("Some kids weren't doing so well.", 'some kids werent doing so well');
    assert.equal(r.isComplete, true);
    assert.equal(r.correctCount, 6);
  });

  it('strips standalone double-dash (--) ghost tokens from YouTube captions', () => {
    const tokens = tokenizeSentence('So, you know -- you get started');
    assert.equal(tokens.length, 6);
    const r = diffDictation('So, you know -- you get started', 'so you know you get started');
    assert.equal(r.isComplete, true);
  });

  it('splits em-dash attached to words cleanly', () => {
    const tokens = tokenizeSentence('Wait—what happened?');
    assert.equal(tokens.length, 3);
    const r = diffDictation('Wait—what happened?', 'wait what happened');
    assert.equal(r.isComplete, true);
  });

  it('accepts both hyphenated and space-separated hyphenated words', () => {
    const r1 = diffDictation('She is a well-known speaker.', 'she is a well-known speaker');
    const r2 = diffDictation('She is a well-known speaker.', 'she is a well known speaker');
    const r3 = diffDictation('She is a well-known speaker.', 'she is a wellknown speaker');
    assert.equal(r1.isComplete, true);
    assert.equal(r2.isComplete, true);
    assert.equal(r3.isComplete, true);
  });

  it('handles colons cleanly', () => {
    const r = diffDictation('Even more demanding: teaching.', 'even more demanding teaching');
    assert.equal(r.isComplete, true);
  });

  it('does not mark complete when extra words are typed', () => {
    const r = diffDictation('Hello world.', 'hello world extra');
    assert.equal(r.isComplete, false);
  });

  it('marks partial prefix while actively typing last word', () => {
    const r = diffDictation('I have a confession', 'i have a conf');
    assert.equal(r.words[3].status, 'partial');
    assert.equal(r.isComplete, false);
  });
});

describe('selectBlankIndices & createScrambledChips', () => {
  it('selects meaningful non-stopword blanks', () => {
    const text = 'My confession is that I am a health psychologist.';
    const blanks = selectBlankIndices(text);
    const tokens = tokenizeSentence(text);
    assert.ok(blanks.length >= 1 && blanks.length <= 4);
    for (const idx of blanks) {
      assert.ok(tokens[idx].normalized.length >= 4);
    }
  });

  it('scrambles chips deterministically without losing tokens', () => {
    const text = 'I have a confession to make.';
    const chips = createScrambledChips(text, 7);
    assert.equal(chips.length, 6);
    assert.deepEqual(
      chips.map((c) => c.token.normalized).sort(),
      ['a', 'confession', 'have', 'i', 'make', 'to']
    );
  });
});

describe('maskWordInExample', () => {
  it('masks exact word', () => {
    assert.equal(
      maskWordInExample('The referee blew his whistle.', 'referee'),
      'The _______ blew his whistle.'
    );
  });

  it('masks regular past tense inflections', () => {
    assert.equal(
      maskWordInExample('The police arrested six men.', 'arrest'),
      'The police ________ six men.'
    );
  });

  it('masks irregular verb forms (spoke vs speak, blew vs blow)', () => {
    assert.equal(
      maskWordInExample('He spoke clearly at the meeting.', 'speak'),
      'He _____ clearly at the meeting.'
    );
    assert.equal(
      maskWordInExample('The referee blew his whistle.', 'blow'),
      'The referee _____ his whistle.'
    );
  });

  it('masks phrasal verbs including irregular and split forms', () => {
    assert.equal(
      maskWordInExample('Never give up on your dreams.', 'give up'),
      'Never _______ on your dreams.'
    );
    assert.equal(
      maskWordInExample('He gave up too early.', 'give up'),
      'He _______ too early.'
    );
    assert.equal(
      maskWordInExample('He gave himself up to the police.', 'give up'),
      'He _____ himself ___ to the police.'
    );
  });
});

describe('parseBulkLine & helpers', () => {
  it('parses WordNest v1 5-column pipe format', () => {
    const p = parseBulkLine('apple | /ˈæp.əl/ | quả táo | I eat an apple. | danh từ');
    assert.equal(p?.word, 'apple');
    assert.equal(p?.phonetic, '/ˈæp.əl/');
    assert.equal(p?.meaning, 'quả táo');
    assert.equal(p?.example, 'I eat an apple.');
    assert.equal(p?.type, 'noun');
  });

  it('parses legacy 3-column pipe format', () => {
    const p = parseBulkLine('resilient | kiên cường | She is resilient.');
    assert.equal(p?.meaning, 'kiên cường');
    assert.equal(p?.example, 'She is resilient.');
  });

  it('normalizes token & word types & formats timestamps', () => {
    assert.equal(normalizeToken("Weren't!"), 'werent');
    assert.equal(normalizeWordType('(adj.)'), 'adj');
    assert.equal(normalizeWordType('', 'give up'), 'phrase');
    assert.equal(formatTime(125), '2:05');
  });
});

describe('parseSrtOrLrc', () => {
  it('parses standard SRT subtitle blocks accurately', () => {
    const srt = `1
00:00:01,500 --> 00:00:04,250
Hello everyone, welcome back.

2
00:00:05,000 --> 00:00:08,500
Today we practice IELTS listening.`;
    const segs = parseSrtOrLrc(srt);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].start, 1.5);
    assert.equal(segs[0].end, 4.25);
    assert.equal(segs[0].text, 'Hello everyone, welcome back.');
    assert.equal(segs[1].start, 5);
  });

  it('parses LRC timestamped lyrics/transcripts', () => {
    const lrc = `[00:10.50] First line here
[00:15.20] Second line here`;
    const segs = parseSrtOrLrc(lrc, 25);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].start, 10.5);
    assert.equal(segs[0].end, 15.2);
    assert.equal(segs[1].end, 25);
  });

  it('falls back to evenly distributed plain lines', () => {
    const segs = parseSrtOrLrc('Line one.\nLine two.', 20);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].start, 0);
    assert.equal(segs[0].end, 10);
    assert.equal(segs[1].start, 10);
  });
});

describe('evaluateShadowing', () => {
  it('scores 100% when all spoken words match', () => {
    const r = evaluateShadowing("I've got a confession to make.", 'ive got a confession to make');
    assert.equal(r.score, 100);
    assert.equal(r.matchedCount, 6);
  });

  it('stays resilient when one middle word is skipped', () => {
    const r = evaluateShadowing('I have a little confession to make.', 'I have a confession to make');
    assert.equal(r.matchedCount, 6);
    assert.equal(r.words[3].matched, false); // "little" missed
    assert.equal(r.words[4].matched, true); // "confession" still aligned!
  });
});
