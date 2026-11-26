import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyWordCefr } from '../src/lib/cefr.ts';
import { VOCAB_STARTER_PACKS } from '../src/lib/starter-packs.ts';

describe('CEFR Word Level Classification', () => {
  it('accurately classifies short C1/C2 words as hard instead of easy', () => {
    assert.equal(classifyWordCefr('abyss').level, 'hard');
    assert.equal(classifyWordCefr('banal').level, 'hard');
    assert.equal(classifyWordCefr('mitigate').level, 'hard');
    assert.equal(classifyWordCefr('ephemeral').level, 'hard');
  });

  it('accurately classifies long everyday A1/A2 words as easy instead of hard', () => {
    assert.equal(classifyWordCefr('strawberry').level, 'easy');
    assert.equal(classifyWordCefr('grandfather').level, 'easy');
    assert.equal(classifyWordCefr('comfortable').level, 'easy');
    assert.equal(classifyWordCefr('supermarket').level, 'easy');
  });

  it('classifies B1/B2 workplace & academic words as medium and handles inflections', () => {
    assert.equal(classifyWordCefr('collaborate').level, 'medium');
    assert.equal(classifyWordCefr('procrastinating').level, 'medium');
    assert.equal(classifyWordCefr('figure out').level, 'medium');
  });
});

describe('Curated Vocabulary Starter Packs', () => {
  it('provides complete IPA, Vietnamese meanings, and examples with no duplicates per pack', () => {
    assert.ok(VOCAB_STARTER_PACKS.length >= 4);
    for (const pack of VOCAB_STARTER_PACKS) {
      const seen = new Set<string>();
      assert.ok(pack.words.length >= 15, `Pack ${pack.id} should have >=15 words`);
      for (const w of pack.words) {
        const key = w.word.toLowerCase();
        assert.ok(!seen.has(key), `Duplicate word ${w.word} in ${pack.id}`);
        seen.add(key);
        assert.ok(w.phonetic.startsWith('/'), `Missing IPA for ${w.word}`);
        assert.ok(w.meaning.trim().length > 0, `Missing meaning for ${w.word}`);
        assert.ok(w.example.trim().length > 0, `Missing example for ${w.word}`);
      }
    }
  });
});
