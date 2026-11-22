import { NextRequest, NextResponse } from 'next/server';
import { extractYoutubeId } from '@/lib/dictation-engine';
import { TranscriptSegment } from '@/types/wordnest';

interface RawCaption {
  start: number;
  dur: number;
  text: string;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

const IOS_UA =
  'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)';
const ANDROID_UA =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip';

function cleanCaptionText(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/<[^>]+>/g, '')
    .replace(/\((?:Laughter|Applause|Music|Sighs|Cheering)\)/gi, '')
    .replace(/\[(?:Music|Applause|Laughter)\]/gi, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseCaption(text: string): boolean {
  if (!text) return true;
  if (/^(Transcriber|Reviewer|Translator|Subtitles|Caption):/i.test(text)) return true;
  if (/^[\[(].*[\])]$/.test(text)) return true;
  if (/^[♪♫\s]+$/.test(text)) return true;
  return false;
}

function parseJson3Captions(json: {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}): RawCaption[] {
  const results: RawCaption[] = [];
  for (const ev of json.events || []) {
    if (!ev.segs || typeof ev.tStartMs !== 'number') continue;
    const rawText = ev.segs.map((s) => s.utf8 || '').join('');
    const text = cleanCaptionText(rawText);
    if (isNoiseCaption(text)) continue;
    results.push({
      start: ev.tStartMs / 1000,
      dur: (ev.dDurationMs || 2500) / 1000,
      text,
    });
  }
  return results;
}

function parseXmlCaptions(xml: string): RawCaption[] {
  const results: RawCaption[] = [];
  const pRegex = /<p\s+[^>]*t="(\d+)"[^>]*d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) !== null) {
    const start = parseInt(m[1], 10) / 1000;
    const dur = parseInt(m[2], 10) / 1000;
    const text = cleanCaptionText(m[3]);
    if (!isNoiseCaption(text)) {
      results.push({ start, dur, text });
    }
  }
  if (results.length > 0) return results;

  const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = textRegex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = m[2] ? parseFloat(m[2]) : 2.5;
    const text = cleanCaptionText(m[3]);
    if (!isNoiseCaption(text)) {
      results.push({ start, dur, text });
    }
  }
  return results;
}

function mergeIntoSentences(raw: RawCaption[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let bufText = '';
  let bufStart = 0;
  let bufEnd = 0;

  const flush = () => {
    const clean = bufText.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    segments.push({
      id: `seg-${segments.length + 1}`,
      start: Number(Math.max(0, bufStart).toFixed(2)),
      end: Number(Math.max(bufStart + 1.2, bufEnd).toFixed(2)),
      text: clean,
    });
    bufText = '';
  };

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!bufText) bufStart = item.start;
    bufText = bufText ? `${bufText} ${item.text}` : item.text;
    bufEnd = item.start + item.dur;

    const wordCount = bufText.split(/\s+/).length;
    const elapsed = bufEnd - bufStart;
    const endsSentence = /[.!?]["']?$/.test(bufText.trim());
    const nextGap = i + 1 < raw.length ? raw[i + 1].start - bufEnd : 0;

    if (
      (endsSentence && wordCount >= 4) ||
      wordCount >= 16 ||
      elapsed >= 9.5 ||
      (nextGap > 1.2 && wordCount >= 3)
    ) {
      flush();
    }
  }
  flush();
  return segments;
}

function pickEnglishTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks?.length) return null;
  const manualEn = tracks.find(
    (t) => (t.languageCode === 'en' || t.languageCode.startsWith('en-')) && t.kind !== 'asr'
  );
  if (manualEn) return manualEn;
  const anyEn = tracks.find((t) => t.languageCode === 'en' || t.languageCode.startsWith('en-'));
  return anyEn || tracks[0];
}

const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface PlayerFetchResult {
  tracks: CaptionTrack[];
  title?: string;
  author?: string;
  lengthSeconds?: number;
  ua: string;
  cookie?: string;
}

async function fetchViaInnertube(
  videoId: string,
  clientName: 'IOS' | 'ANDROID' | 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
  clientVersion: string,
  ua: string
): Promise<PlayerFetchResult> {
  try {
    const clientCtx: Record<string, unknown> = { clientName, clientVersion, hl: 'en', gl: 'US' };
    const bodyPayload: Record<string, unknown> = {
      context: {
        client: clientCtx,
        ...(clientName === 'TVHTML5_SIMPLY_EMBEDDED_PLAYER'
          ? { thirdParty: { embedUrl: 'https://www.youtube.com/' } }
          : {}),
      },
      videoId,
    };

    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ua,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { tracks: [], ua };
    const data = await res.json();
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return {
      tracks,
      title: data?.videoDetails?.title,
      author: data?.videoDetails?.author,
      lengthSeconds: data?.videoDetails?.lengthSeconds
        ? Number(data.videoDetails.lengthSeconds)
        : undefined,
      ua,
    };
  } catch {
    return { tracks: [], ua };
  }
}

async function fetchViaWatchPage(videoId: string): Promise<PlayerFetchResult> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        'User-Agent': WEB_UA,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { tracks: [], ua: WEB_UA };
    const setCookie = res.headers.get('set-cookie') || '';
    const cookie = setCookie
      .split(',')
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    const html = await res.text();
    const marker = 'ytInitialPlayerResponse = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return { tracks: [], ua: WEB_UA };
    const jsonStart = startIdx + marker.length;
    // Match balanced JSON object safely
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;
    for (let i = jsonStart; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
    }
    if (endIdx === -1) return { tracks: [], ua: WEB_UA };
    const data = JSON.parse(html.slice(jsonStart, endIdx));
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return {
      tracks,
      title: data?.videoDetails?.title,
      author: data?.videoDetails?.author,
      lengthSeconds: data?.videoDetails?.lengthSeconds
        ? Number(data.videoDetails.lengthSeconds)
        : undefined,
      ua: WEB_UA,
      cookie,
    };
  } catch {
    return { tracks: [], ua: WEB_UA };
  }
}

async function fetchOEmbed(videoId: string): Promise<{ title?: string; author?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return {};
    const data = await res.json();
    return { title: data.title, author: data.author_name };
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url') || '';
  const videoId = extractYoutubeId(rawUrl);

  if (!videoId) {
    return NextResponse.json(
      { error: 'Link hoặc ID YouTube không hợp lệ. Vui lòng dán link youtube.com hoặc youtu.be.' },
      { status: 400 }
    );
  }

  const [iosResult, oembed] = await Promise.all([
    fetchViaInnertube(videoId, 'IOS', '20.10.4', IOS_UA),
    fetchOEmbed(videoId),
  ]);

  let playerInfo = iosResult;
  if (!playerInfo.tracks.length) {
    playerInfo = await fetchViaInnertube(videoId, 'ANDROID', '20.10.38', ANDROID_UA);
  }
  if (!playerInfo.tracks.length) {
    playerInfo = await fetchViaInnertube(
      videoId,
      'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      '2.0',
      WEB_UA
    );
  }
  if (!playerInfo.tracks.length) {
    playerInfo = await fetchViaWatchPage(videoId);
  }

  const title = oembed.title || playerInfo.title || `YouTube Video (${videoId})`;
  const channel = oembed.author || playerInfo.author || 'YouTube';
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const track = pickEnglishTrack(playerInfo.tracks);
  if (!track?.baseUrl) {
    return NextResponse.json({
      videoId,
      title,
      channel,
      thumbnail,
      durationSec: playerInfo.lengthSeconds || 120,
      segments: [],
      warning:
        'Video này chưa bật phụ đề tiếng Anh hoặc YouTube đang giới hạn máy chủ web. Dùng bản App máy tính WordNest sẽ tự động bóc phụ đề 100%!',
    });
  }

  try {
    const capHeaders: Record<string, string> = {
      'User-Agent': playerInfo.ua,
      'Accept-Language': 'en-US,en;q=0.9',
      ...(playerInfo.cookie ? { Cookie: playerInfo.cookie } : {}),
    };

    const tryFetchCaptionBody = async (fmt?: string): Promise<string> => {
      const capUrl = fmt
        ? track.baseUrl.includes('fmt=')
          ? track.baseUrl
          : `${track.baseUrl}&fmt=${fmt}`
        : track.baseUrl;
      const capRes = await fetch(capUrl, {
        headers: capHeaders,
        signal: AbortSignal.timeout(8000),
      });
      if (!capRes.ok) return '';
      return (await capRes.text()).trim();
    };

    let bodyText = await tryFetchCaptionBody('json3');
    if (!bodyText) {
      bodyText = await tryFetchCaptionBody();
    }
    if (!bodyText) throw new Error('Empty caption response');

    let rawCaptions: RawCaption[] = [];
    if (bodyText.startsWith('{')) {
      rawCaptions = parseJson3Captions(JSON.parse(bodyText));
    } else {
      rawCaptions = parseXmlCaptions(bodyText);
    }

    const segments = mergeIntoSentences(rawCaptions);
    const lastEnd = segments.length ? segments[segments.length - 1].end : 60;

    return NextResponse.json({
      videoId,
      title,
      channel,
      thumbnail,
      durationSec: playerInfo.lengthSeconds || Math.ceil(lastEnd),
      language: track.languageCode,
      isAutoGenerated: track.kind === 'asr',
      segments,
    });
  } catch {
    return NextResponse.json({
      videoId,
      title,
      channel,
      thumbnail,
      durationSec: playerInfo.lengthSeconds || 120,
      segments: [],
      warning:
        'Không tải được phụ đề từ YouTube lúc này. Bạn có thể dán transcript thủ công để luyện nghe ngay!',
    });
  }
}
