import type { DictationLesson, TranscriptSegment } from '@/types/wordnest';

const segmentCache = new Map<string, TranscriptSegment[]>();
const inflightMap = new Map<string, Promise<TranscriptSegment[]>>();

/**
 * Returns the displayed sentence count for a lesson without requiring
 * its full transcript segments to be loaded into memory.
 */
export function getLessonSegmentCount(lesson: DictationLesson): number {
  if (lesson.segments.length > 0) return lesson.segments.length;
  return lesson.segmentCount ?? 0;
}

/**
 * Lazy-loads full transcript segments for a curated lesson from /lessons/<id>.json
 * with in-memory caching and concurrent-request deduplication.
 */
export async function loadCuratedLessonSegments(
  lessonId: string
): Promise<TranscriptSegment[]> {
  const cached = segmentCache.get(lessonId);
  if (cached) return cached;

  const existing = inflightMap.get(lessonId);
  if (existing) return existing;

  const req = fetch(`/lessons/${encodeURIComponent(lessonId)}.json`)
    .then(async (res) => {
      if (!res.ok) return [];
      const data = (await res.json()) as TranscriptSegment[];
      if (Array.isArray(data) && data.length > 0) {
        segmentCache.set(lessonId, data);
        return data;
      }
      return [];
    })
    .catch(() => [])
    .finally(() => {
      inflightMap.delete(lessonId);
    });

  inflightMap.set(lessonId, req);
  return req;
}

export function getCachedLessonSegments(lessonId: string): TranscriptSegment[] | undefined {
  return segmentCache.get(lessonId);
}
