import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CURATED_LESSONS_META } from '../src/lib/curated-lessons-meta.ts';
import { getLessonSegmentCount } from '../src/lib/lesson-loader.ts';
import type { TranscriptSegment } from '../src/types/wordnest.ts';

describe('Curated Lessons Lazy-Load Integrity', () => {
  it('ships lightweight metadata without inline segments and matching public/lessons JSON files', () => {
    assert.ok(CURATED_LESSONS_META.length >= 18, 'Expected at least 18 curated lessons');

    const lessonsDir = path.resolve(import.meta.dirname, '..', 'public', 'lessons');
    let totalSegments = 0;

    for (const meta of CURATED_LESSONS_META) {
      assert.equal(meta.segments.length, 0, `Lesson ${meta.id} should not inline segments in JS bundle`);
      assert.ok((meta.segmentCount ?? 0) > 0, `Lesson ${meta.id} should declare positive segmentCount`);

      const jsonPath = path.join(lessonsDir, `${meta.id}.json`);
      assert.ok(fs.existsSync(jsonPath), `Missing lazy JSON file for ${meta.id}`);

      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as TranscriptSegment[];
      assert.equal(
        parsed.length,
        meta.segmentCount,
        `Segment count mismatch for ${meta.id}: meta=${meta.segmentCount}, json=${parsed.length}`
      );
      assert.equal(getLessonSegmentCount(meta), parsed.length);
      totalSegments += parsed.length;
    }

    assert.ok(totalSegments > 2500, `Expected >2500 total segments across library, got ${totalSegments}`);
  });
});
