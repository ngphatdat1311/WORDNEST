// ════════════════════════════════════════════════════════
// LOOKUP PROVIDERS — gọi API dịch/từ điển bên ngoài (Google Translate,
// MyMemory, dictionaryapi.dev) và phân tích kết quả trả về từ chúng.
// ════════════════════════════════════════════════════════

// Gọi SONG SONG cả Google Translate (unofficial) và MyMemory, lấy kết quả của
// bất kỳ nguồn nào trả về thành công trước — nhanh hơn cách nối tiếp cũ (phải
// đợi Google lỗi/timeout hẳn rồi mới thử MyMemory, có thể tốn gấp đôi thời gian
// khi Google chậm/bị chặn).
async function translateText(text, signal) {
  if (!text || !text.trim()) return '';

  const tryGoogle = async () => {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + encodeURIComponent(text);
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error('Google HTTP ' + resp.status);
    const data = await resp.json();
    const result = (data[0] || []).map(seg => (seg && seg[0]) || '').join('').trim().normalize('NFC');
    if (!result) throw new Error('Google: kết quả rỗng');
    return result;
  };

  const tryMyMemory = async () => {
    const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`;
    const resp2 = await fetch(url2, { signal });
    if (!resp2.ok) throw new Error('MyMemory HTTP ' + resp2.status);
    const data2 = await resp2.json();
    const result2 = (data2.responseData?.translatedText || '').trim().normalize('NFC');
    if (!result2 || result2 === text) throw new Error('MyMemory: kết quả rỗng/không dịch được');
    return result2;
  };

  try {
    return await Promise.any([tryGoogle(), tryMyMemory()]);
  } catch (e) {
    if (signal?.aborted) {
      const err = new Error('aborted'); err.name = 'AbortError'; throw err;
    }
    throw new Error('Tất cả API dịch đều không khả dụng', { cause: e });
  }
}

async function translateWordLikeGoogle(word, signal) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=' + encodeURIComponent(word);
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error('Translate HTTP ' + resp.status);
  const data = await resp.json();
  const quick = (data[0] || []).map(seg => (seg && seg[0]) || '').join('').trim().normalize('NFC');
  let dictEntries;
  try {
    dictEntries = (data[1] || [])
      .map(e => ({ pos: (e && e[0]) || '', terms: (e && Array.isArray(e[1])) ? e[1].filter(t => typeof t === 'string' && t.trim()).map(t => t.normalize('NFC')) : [] }))
      .filter(e => e.terms.length);
  } catch { dictEntries = []; }
  return { quick, dictEntries };
}

function pickAudio(phonetics) {
  for (const p of (phonetics || [])) {
    if (p.audio) return p.audio.startsWith('http') ? p.audio : 'https:' + p.audio;
  }
  return '';
}

// Lấy TẤT CẢ câu ví dụ có trong từ điển (mọi nghĩa/từ loại, không chỉ từ loại
// chính) — dùng cho nút "Đổi ví dụ khác" để có nhiều lựa chọn đa dạng nhất,
// không bị giới hạn chỉ trong nhóm từ loại chiếm đa số như lúc tra tự động.
function getAllExamples(entry) {
  const examples = [];
  const seen = new Set();
  for (const m of (entry?.meanings || [])) {
    for (const def of (m.definitions || [])) {
      if (def.example && !seen.has(def.example)) { seen.add(def.example); examples.push(def.example); }
    }
  }
  return examples;
}

function pickDominantPos(entry) {
  if (!entry) return '';
  const counts = {};
  for (const m of (entry.meanings || [])) {
    const p = mapPartOfSpeech(m.partOfSpeech || '');
    counts[p] = (counts[p] || 0) + (m.definitions || []).length;
  }
  const priority = ['noun','verb','adj','adv','phrase','other'];
  const sorted = Object.entries(counts).sort(([pa, a], [pb, b]) => {
    if (b !== a) return b - a;
    return priority.indexOf(pa) - priority.indexOf(pb);
  });
  return sorted[0]?.[0] || '';
}

function pickRandomExample(entry, dominantPos, excludeExamples) {
  if (!entry) return { example: '', definition: '', pos: '' };
  const pool = [], fallback = [];
  for (const m of (entry.meanings || [])) {
    const p = mapPartOfSpeech(m.partOfSpeech || '');
    for (const def of (m.definitions || [])) {
      if (!def.definition) continue;
      const item = { pos: m.partOfSpeech || '', definition: def.definition, example: def.example || '' };
      if (p === dominantPos) pool.push(item);
      else fallback.push(item);
    }
  }
  const source = pool.length ? pool : fallback;
  let withEx = source.filter(x => x.example);
  // Đang đổi ví dụ khác -> ưu tiên ví dụ chưa từng hiện; hết ví dụ mới thì mới cho lặp lại.
  if (excludeExamples && excludeExamples.size) {
    const unseen = withEx.filter(x => !excludeExamples.has(x.example));
    if (unseen.length) withEx = unseen;
  }
  return withEx.length
    ? withEx[Math.floor(Math.random() * withEx.length)]
    : (source[Math.floor(Math.random() * source.length)] || { example:'', definition:'', pos:'' });
}

// Người dùng đôi khi dán/gõ nguyên 1 CÂU vào ô "Từ tiếng Anh" (muốn lưu lại +
// học nguyên câu đó) thay vì 1 từ/cụm từ — câu thì tra dictionaryapi.dev chắc
// chắn không ra gì (API chỉ có từ/cụm cố định), và việc đoán từ loại/chủ đề
// cũng vô nghĩa với cả câu. Nhận diện sớm để dịch thẳng nguyên câu, không tra
// từ điển, không đoán từ loại.
function looksLikeSentence(input) {
  const trimmed = (input || '').trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 6) return true;
  if (wordCount >= 2 && /[.!?]$/.test(trimmed)) return true;
  return false;
}
