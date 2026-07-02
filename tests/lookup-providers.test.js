'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// pickDominantPos/pickRandomExample call mapPartOfSpeech, which lives in
// lookup-classify.js — load both, same as index.html does.
const ctx = loadScripts(['lookup-classify.js', 'lookup-providers.js']);

test('looksLikeSentence flags long input or short input ending with punctuation', () => {
  assert.equal(ctx.looksLikeSentence('hello'), false);
  assert.equal(ctx.looksLikeSentence('a b c d e f'), true); // >= 6 words
  assert.equal(ctx.looksLikeSentence('Hello world.'), true); // >= 2 words + ends with punctuation
  assert.equal(ctx.looksLikeSentence('word'), false);
});

test('pickAudio prefers the first phonetic entry with audio and normalizes protocol-relative URLs', () => {
  assert.equal(ctx.pickAudio([{ text: '/x/' }, { audio: '//example.com/a.mp3' }]), 'https://example.com/a.mp3');
  assert.equal(ctx.pickAudio([{ audio: 'https://example.com/b.mp3' }]), 'https://example.com/b.mp3');
  assert.equal(ctx.pickAudio([]), '');
  assert.equal(ctx.pickAudio(undefined), '');
});

test('getAllExamples collects unique example sentences across all meanings, in order', () => {
  const entry = {
    meanings: [
      { definitions: [{ example: 'A dog runs.' }, { definition: 'no example here' }] },
      { definitions: [{ example: 'A dog runs.' }, { example: 'A cat sleeps.' }] },
    ],
  };
  // Spread into a plain array of this realm — arrays built inside the vm sandbox
  // belong to a different realm, so deepEqual would otherwise compare prototypes across realms.
  assert.deepEqual([...ctx.getAllExamples(entry)], ['A dog runs.', 'A cat sleeps.']);
});

test('pickDominantPos picks the part of speech with the most definitions', () => {
  const entry = {
    meanings: [
      { partOfSpeech: 'noun', definitions: [{}, {}] },
      { partOfSpeech: 'verb', definitions: [{}] },
    ],
  };
  assert.equal(ctx.pickDominantPos(entry), 'noun');
});

test('pickDominantPos breaks ties using noun > verb > adj > adv > phrase > other priority', () => {
  const entry = {
    meanings: [
      { partOfSpeech: 'adjective', definitions: [{}] },
      { partOfSpeech: 'verb', definitions: [{}] },
    ],
  };
  assert.equal(ctx.pickDominantPos(entry), 'verb');
});

test('pickDominantPos returns an empty string for a missing or empty entry', () => {
  assert.equal(ctx.pickDominantPos(null), '');
  assert.equal(ctx.pickDominantPos({ meanings: [] }), '');
});

test('pickRandomExample excludes already-seen examples while unseen ones remain', () => {
  const entry = {
    meanings: [{ partOfSpeech: 'noun', definitions: [
      { definition: 'd1', example: 'ex1' },
      { definition: 'd2', example: 'ex2' },
    ] }],
  };
  const excluded = new Set(['ex1']);
  for (let i = 0; i < 20; i++) {
    assert.equal(ctx.pickRandomExample(entry, 'noun', excluded).example, 'ex2');
  }
});

test('pickRandomExample falls back to repeating an example once all have been seen', () => {
  const entry = {
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'd1', example: 'ex1' }] }],
  };
  const picked = ctx.pickRandomExample(entry, 'noun', new Set(['ex1']));
  assert.equal(picked.example, 'ex1');
});

test('pickRandomExample falls back to a non-dominant part of speech when the dominant one has no entries', () => {
  const entry = {
    meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'vd', example: 'vex' }] }],
  };
  assert.equal(ctx.pickRandomExample(entry, 'noun').example, 'vex');
});
