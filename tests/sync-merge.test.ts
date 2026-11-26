import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeWordNestBackups } from '../src/lib/sync-merge.ts';
import type { WordNestBackupV1 } from '../src/types/wordnest.ts';

describe('Conflict-Free Two-Way Sync Merge', () => {
  it('merges words added offline on both devices and picks newer updatedAt without losing folders', () => {
    const local: WordNestBackupV1 = {
      words: [
        {
          id: 'w1',
          word: 'mitigate',
          phonetic: '/ˈmɪt.ɪ.ɡeɪt/',
          meaning: 'giảm nhẹ',
          mastery: 1,
          seen: 3,
          known: 2,
          folderIds: ['f-ielts'],
          updatedAt: '2026-11-26T10:00:00.000Z',
        },
        {
          id: 'w-laptop-only',
          word: 'ubiquitous',
          meaning: 'phổ biến khắp nơi',
          folderIds: [],
          updatedAt: '2026-11-26T11:00:00.000Z',
        },
      ],
      folders: [{ id: 'f-ielts', name: 'IELTS', createdAt: '2026-11-01' }],
    };

    const remote: WordNestBackupV1 = {
      words: [
        {
          id: 'w1',
          word: 'mitigate',
          phonetic: '',
          meaning: 'giảm nhẹ, làm dịu bớt',
          mastery: 2,
          seen: 5,
          known: 4,
          folderIds: ['f-review'],
          updatedAt: '2026-11-26T12:00:00.000Z',
        },
        {
          id: 'w-phone-only',
          word: 'resilient',
          meaning: 'kiên cường',
          folderIds: [],
          updatedAt: '2026-11-26T11:30:00.000Z',
        },
      ],
      folders: [{ id: 'f-review', name: 'Ôn thi', createdAt: '2026-11-02' }],
    };

    const merged = mergeWordNestBackups(local, remote);
    assert.equal(merged.words.length, 3);

    const mitigate = merged.words.find((w) => w.word === 'mitigate');
    assert.ok(mitigate);
    // Remote was newer -> keeps updated meaning & mastery=2, while preserving local IPA & unioning folders!
    assert.equal(mitigate.meaning, 'giảm nhẹ, làm dịu bớt');
    assert.equal(mitigate.mastery, 2);
    assert.equal(mitigate.phonetic, '/ˈmɪt.ɪ.ɡeɪt/');
    assert.deepEqual(mitigate.folderIds?.sort(), ['f-ielts', 'f-review']);
    assert.equal(merged.folders?.length, 2);
  });

  it('unions completed dictation segments and preserves max streak/stats across devices', () => {
    const local: WordNestBackupV1 = {
      words: [],
      streak: {
        count: 4,
        lastDate: '2026-11-25',
        history: { '2026-11-24': 10, '2026-11-25': 5 },
        freezes: 1,
        frozenDates: ['2026-11-20'],
      },
      dictationProgress: {
        'ted-1': {
          lessonId: 'ted-1',
          completedSegmentIds: ['s1', 's2'],
          lastSegmentIndex: 2,
          lastPracticedAt: '2026-11-26T09:00:00.000Z',
          accuracySum: 180,
          attempts: 2,
        },
      },
      airCombatStats: { gamesPlayed: 3, bestScore: 1200, bestWave: 4, bestWpm: 45, totalDestroyed: 30 },
    };

    const remote: WordNestBackupV1 = {
      words: [],
      streak: {
        count: 5,
        lastDate: '2026-11-26',
        history: { '2026-11-25': 12, '2026-11-26': 8 },
        freezes: 2,
        frozenDates: ['2026-11-22'],
      },
      dictationProgress: {
        'ted-1': {
          lessonId: 'ted-1',
          completedSegmentIds: ['s2', 's3', 's4'],
          lastSegmentIndex: 4,
          lastPracticedAt: '2026-11-26T11:00:00.000Z',
          accuracySum: 270,
          attempts: 3,
        },
      },
      airCombatStats: { gamesPlayed: 5, bestScore: 950, bestWave: 6, bestWpm: 52, totalDestroyed: 48 },
    };

    const merged = mergeWordNestBackups(local, remote);
    assert.deepEqual(
      merged.dictationProgress?.['ted-1']?.completedSegmentIds.sort(),
      ['s1', 's2', 's3', 's4']
    );
    assert.equal(merged.streak?.count, 5);
    assert.equal(merged.streak?.history['2026-11-24'], 10);
    assert.equal(merged.streak?.history['2026-11-25'], 12);
    assert.equal(merged.streak?.history['2026-11-26'], 8);
    assert.deepEqual(merged.streak?.frozenDates, ['2026-11-20', '2026-11-22']);
    assert.equal(merged.airCombatStats?.bestScore, 1200);
    assert.equal(merged.airCombatStats?.bestWave, 6);
  });
});
