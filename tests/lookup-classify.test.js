'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

const ctx = loadScripts(['lookup-classify.js']);

test('mapPartOfSpeech normalizes dictionaryapi.dev POS strings to app categories', () => {
  assert.equal(ctx.mapPartOfSpeech('noun'), 'noun');
  assert.equal(ctx.mapPartOfSpeech('pronoun'), 'noun');
  assert.equal(ctx.mapPartOfSpeech('auxiliary verb'), 'verb');
  assert.equal(ctx.mapPartOfSpeech('adjective'), 'adj');
  assert.equal(ctx.mapPartOfSpeech('adverb'), 'adv');
  assert.equal(ctx.mapPartOfSpeech('idiom'), 'phrase');
  assert.equal(ctx.mapPartOfSpeech('interjection'), 'other');
  assert.equal(ctx.mapPartOfSpeech(''), 'other');
  assert.equal(ctx.mapPartOfSpeech(null), 'other');
});

test('estimateLevel recognizes known CEFR easy/hard words', () => {
  assert.equal(ctx.estimateLevel('happy'), 'easy');
  assert.equal(ctx.estimateLevel('ubiquitous'), 'hard');
});

test('estimateLevel falls back to word length for words outside the CEFR lists', () => {
  assert.equal(ctx.estimateLevel('cat'), 'easy'); // len <= 3
  assert.equal(ctx.estimateLevel('internationalization'), 'hard'); // len >= 12
  assert.equal(ctx.estimateLevel('picture'), 'medium'); // len 7, in neither list
});

test('estimateLevel is case-insensitive and trims whitespace', () => {
  assert.equal(ctx.estimateLevel('  HAPPY  '), 'easy');
});

test('guessCategory classifies by English or Vietnamese keyword match', () => {
  assert.equal(ctx.guessCategory('a strong feeling of joy', '', ''), 'Cảm xúc');
  assert.equal(ctx.guessCategory('', '', 'công việc kinh doanh'), 'Công việc');
});

test('guessCategory falls back to "Hành động" for unmatched verbs, "Cuộc sống" otherwise', () => {
  assert.equal(ctx.guessCategory('to run quickly', 'verb', ''), 'Hành động');
  assert.equal(ctx.guessCategory('a random thing', 'noun', ''), 'Cuộc sống');
});
