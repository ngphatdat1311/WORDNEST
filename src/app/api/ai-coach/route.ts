import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getLemmaCandidates, SlidingWindowRateLimiter } from '@/lib/server-cache';

const aiCoachLimiter = new SlidingWindowRateLimiter(40, 60_000);

interface AiCoachRequest {
  mode: 'explain' | 'check-sentence';
  word: string;
  meaning?: string;
  contextSentence?: string;
  userSentence?: string;
}

interface AiCoachResponse {
  provider: 'gemini' | 'local';
  isCorrect?: boolean;
  score?: number;
  feedbackVi: string;
  naturalRewrite?: string;
  collocations?: string[];
  memoryTipVi?: string;
}

function containsTargetWord(sentence: string, targetWord: string): boolean {
  const lowerSent = sentence.toLowerCase();
  const cleanTarget = targetWord.trim().toLowerCase();
  if (!cleanTarget) return false;
  if (lowerSent.includes(cleanTarget)) return true;

  // Check stem & lemma forms (e.g. "procrastinate" matches "procrastinating", "procrastinated")
  const stem = cleanTarget.length > 4 && cleanTarget.endsWith('e')
    ? cleanTarget.slice(0, -1)
    : cleanTarget;
  if (stem.length >= 4 && lowerSent.includes(stem)) return true;

  for (const lemma of getLemmaCandidates(cleanTarget)) {
    if (lemma.length >= 3 && lowerSent.includes(lemma)) return true;
  }
  return false;
}

function buildLocalFallback(req: AiCoachRequest): AiCoachResponse {
  if (req.mode === 'explain') {
    const contextNote = req.contextSentence
      ? `Trong câu "${req.contextSentence}", từ "${req.word}" được dùng theo đúng ngữ cảnh tự nhiên.`
      : `Từ "${req.word}"${req.meaning ? ` (${req.meaning})` : ''} nên được học kèm một câu ví dụ gắn với đời sống hằng ngày của bạn.`;
    return {
      provider: 'local',
      feedbackVi: `${contextNote} Hãy thử tự đặt 1 câu tiếng Anh ngắn chứa từ "${req.word}" ở ô bên dưới để nhớ lâu gấp 3 lần!`,
      collocations: [
        `use "${req.word}" in daily conversation`,
        `context sentence with "${req.word}"`,
      ],
      memoryTipVi:
        'Mẹo: Thêm Gemini API key miễn phí trong mục Tiến Độ & Đồng Bộ để mở khóa giải thích sắc thái & chấm ngữ pháp chuẩn bản xứ bằng AI.',
    };
  }

  const sent = (req.userSentence || '').trim();
  const wordCount = sent.split(/\s+/).filter(Boolean).length;
  const hasWord = containsTargetWord(sent, req.word);
  const startsUpper = /^[A-Z]/.test(sent);
  const endsPunct = /[.!?]$/.test(sent);

  if (!hasWord) {
    return {
      provider: 'local',
      isCorrect: false,
      score: 30,
      feedbackVi: `Câu của bạn chưa có từ "${req.word}" (hoặc dạng chia của nó). Hãy đưa "${req.word}" vào câu nhé!`,
    };
  }

  if (wordCount < 4) {
    return {
      provider: 'local',
      isCorrect: false,
      score: 55,
      feedbackVi: `Bạn đã dùng đúng từ "${req.word}", nhưng câu còn khá ngắn (${wordCount} từ). Thử mở rộng thêm chủ ngữ + ngữ cảnh cụ thể (>= 5 từ) để não bộ ghi nhớ sâu hơn!`,
    };
  }

  const tips: string[] = [];
  if (!startsUpper) tips.push('viết hoa chữ cái đầu câu');
  if (!endsPunct) tips.push('thêm dấu chấm/hỏi cuối câu');

  const polished = `${sent.charAt(0).toUpperCase()}${sent.slice(1)}${endsPunct ? '' : '.'}`;
  return {
    provider: 'local',
    isCorrect: true,
    score: tips.length === 0 ? 90 : 80,
    feedbackVi:
      tips.length === 0
        ? `Rất tốt! Bạn đã đặt câu hoàn chỉnh có chứa "${req.word}" (${wordCount} từ).`
        : `Tốt lắm! Bạn đã dùng đúng từ "${req.word}". Góp ý nhỏ: nên ${tips.join(' và ')}.`,
    naturalRewrite: tips.length > 0 ? polished : undefined,
    memoryTipVi:
      'Gắn Gemini API key miễn phí trong mục Tiến Độ & Đồng Bộ để AI chấm sâu ngữ pháp & collocation tự nhiên hơn.',
  };
}

const GEMINI_COACH_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

async function callGeminiCoach(
  apiKey: string,
  req: AiCoachRequest
): Promise<AiCoachResponse | null> {
  const prompt =
    req.mode === 'explain'
      ? `You are a friendly Vietnamese-English IELTS/communication tutor. Explain the English word/phrase "${req.word}" (Vietnamese meaning: "${req.meaning || 'unknown'}") in this exact context sentence: "${req.contextSentence || 'general usage'}".
Return STRICT JSON with keys:
- feedbackVi (string, concise 2-3 sentences in Vietnamese explaining nuance & usage in context)
- collocations (array of 3 natural English collocations/phrases using the word)
- memoryTipVi (string, 1 short vivid Vietnamese mnemonic/tip)`
      : `You are a friendly Vietnamese-English tutor. The learner wrote this English sentence to practice the word "${req.word}" (meaning: "${req.meaning || ''}"):
"${req.userSentence}"
Evaluate grammar, naturalness, and whether "${req.word}" is used accurately.
Return STRICT JSON with keys:
- isCorrect (boolean, true if understandable and uses the target word well)
- score (number 0-100)
- feedbackVi (string, concise constructive feedback in Vietnamese, 1-2 sentences)
- naturalRewrite (string, the most natural native-sounding version of their sentence in English)
- collocations (array of 2-3 useful collocations for "${req.word}")`;

  for (const model of GEMINI_COACH_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.status === 401 || res.status === 403) {
        // Invalid/unauthorized key — don't waste retries across models
        return null;
      }
      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText || typeof rawText !== 'string') continue;

      const cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleaned) as Partial<AiCoachResponse>;
      if (!parsed.feedbackVi) continue;

      return {
        provider: 'gemini',
        isCorrect: typeof parsed.isCorrect === 'boolean' ? parsed.isCorrect : undefined,
        score:
          typeof parsed.score === 'number'
            ? Math.max(0, Math.min(100, Math.round(parsed.score)))
            : undefined,
        feedbackVi: String(parsed.feedbackVi),
        naturalRewrite: parsed.naturalRewrite ? String(parsed.naturalRewrite) : undefined,
        collocations: Array.isArray(parsed.collocations)
          ? parsed.collocations.filter((x): x is string => typeof x === 'string').slice(0, 4)
          : undefined,
        memoryTipVi: parsed.memoryTipVi ? String(parsed.memoryTipVi) : undefined,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = aiCoachLimiter.allow(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Bạn gửi yêu cầu AI Coach quá nhanh. Vui lòng chờ vài giây.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  let body: AiCoachRequest;
  try {
    body = (await request.json()) as AiCoachRequest;
  } catch {
    return NextResponse.json({ error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
  }

  const word = String(body.word || '').trim().slice(0, 60);
  const mode = body.mode === 'explain' ? 'explain' : 'check-sentence';
  const userSentence = String(body.userSentence || '').trim().slice(0, 300);
  const contextSentence = String(body.contextSentence || '').trim().slice(0, 300);
  const meaning = String(body.meaning || '').trim().slice(0, 120);

  if (!word) {
    return NextResponse.json({ error: 'Thiếu từ cần luyện tập.' }, { status: 400 });
  }
  if (mode === 'check-sentence' && !userSentence) {
    return NextResponse.json({ error: 'Vui lòng nhập câu tiếng Anh của bạn.' }, { status: 400 });
  }

  const cleanReq: AiCoachRequest = { mode, word, meaning, contextSentence, userSentence };
  const headerKey = (request.headers.get('x-gemini-key') || '').trim();
  const apiKey = headerKey || process.env.GEMINI_API_KEY || '';

  if (apiKey) {
    const aiResult = await callGeminiCoach(apiKey, cleanReq);
    if (aiResult) {
      return NextResponse.json(aiResult);
    }
  }

  return NextResponse.json(buildLocalFallback(cleanReq));
}
