// ════════════════════════════════════════════════════════
// AUTO-LOOKUP (Add Word) — dictionary + translation autofill
// ════════════════════════════════════════════════════════
let autoLookupTimer = null;
let awAutoFilledValues = {};
let currentLookupWord = '';
let awAudioUrl = '';
let awSpeakWord = '';
let awCurrentAudio = null;
let awAbortController = null;
let lookupGen = 0; // generation counter để loại bỏ hoàn toàn race condition

const VI_HINTS = {
  happy:'vui vẻ, hạnh phúc', sad:'buồn bã', angry:'tức giận', fear:'sợ hãi',
  love:'tình yêu, yêu thương', hate:'ghét', joy:'niềm vui', grief:'đau buồn',
  anxiety:'lo lắng', calm:'bình tĩnh', excited:'hào hứng', bored:'chán nản',
  brave:'dũng cảm', kind:'tốt bụng', smart:'thông minh', lazy:'lười biếng',
  honest:'thành thật', rude:'thô lỗ', shy:'nhút nhát', confident:'tự tin',
  creative:'sáng tạo', patient:'kiên nhẫn', generous:'hào phóng',
  run:'chạy', walk:'đi bộ', eat:'ăn', drink:'uống', sleep:'ngủ',
  work:'làm việc', study:'học', read:'đọc', write:'viết', speak:'nói',
  listen:'lắng nghe', think:'suy nghĩ', help:'giúp đỡ', learn:'học hỏi',
  water:'nước', fire:'lửa', tree:'cây', flower:'hoa', animal:'động vật',
  mountain:'núi', river:'sông', ocean:'đại dương', sky:'bầu trời', sun:'mặt trời',
};

// ── LOOKUP CACHE ──
// Cache kết quả tra từ điển + dịch theo từ, để (1) không gọi lại API
// dictionaryapi.dev/Google Translate mỗi lần tra cùng một từ (giảm rủi ro bị
// rate-limit/block), và (2) kết quả trả về nhất quán giữa các lần tra (trước đây
// pickRandomExample() chọn ví dụ ngẫu nhiên mỗi lần, nay từ đã cache sẽ giữ
// nguyên ví dụ/nghĩa đã chọn).
const LOOKUP_CACHE_KEY = 'wordnest_lookup_cache';
const LOOKUP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const LOOKUP_CACHE_MAX = 300; // giới hạn số từ cache để tránh đầy localStorage

function loadLookupCacheRaw() {
  try { return JSON.parse(localStorage.getItem(LOOKUP_CACHE_KEY)) || {}; }
  catch { return {}; }
}
function saveLookupCacheRaw(cache) {
  try { localStorage.setItem(LOOKUP_CACHE_KEY, JSON.stringify(cache)); }
  catch(e) { /* localStorage đầy — bỏ qua cache, không ảnh hưởng chức năng tra từ */ }
}
function getCachedLookup(word) {
  const cache = loadLookupCacheRaw();
  const entry = cache[word.toLowerCase()];
  if (!entry) return null;
  if (Date.now() - entry.ts > LOOKUP_CACHE_TTL_MS) return null; // hết hạn, tra lại cho chắc
  return entry.result;
}
function setCachedLookup(word, result) {
  const cache = loadLookupCacheRaw();
  const key = word.toLowerCase();
  cache[key] = { ts: Date.now(), result };
  const keys = Object.keys(cache);
  if (keys.length > LOOKUP_CACHE_MAX) {
    keys.sort((a, b) => cache[a].ts - cache[b].ts); // cũ nhất trước
    const removeCount = keys.length - LOOKUP_CACHE_MAX;
    for (let i = 0; i < removeCount; i++) delete cache[keys[i]];
  }
  saveLookupCacheRaw(cache);
}

// Áp kết quả (từ cache hoặc từ API) vào form — dùng chung cho cả 2 đường
function applyLookupResult(word, r) {
  fillField('aw-phonetic', r.phonetic);
  fillField('aw-example', r.exampleEn);
  document.getElementById('aw-level').value = estimateLevel(word);
  fillField('aw-meaning', r.meaningVI);
  document.getElementById('aw-type').value = r.finalPos || 'other';
  fillField('aw-category', r.category);
  awAudioUrl = r.audioUrl || '';
  const altEl = document.getElementById('aw-alt-meaning');
  if (altEl) altEl.innerHTML = r.altHtml || '';
  const exViEl = document.getElementById('aw-example-vi');
  if (exViEl) exViEl.innerHTML = r.exampleVi ? '→ ' + escHtml(r.exampleVi) : '';
}

function resetAwExtras() {
  const exVi = document.getElementById('aw-example-vi'); if (exVi) exVi.innerHTML = '';
  const altM = document.getElementById('aw-alt-meaning'); if (altM) altM.innerHTML = '';
  document.getElementById('aw-autofill-status').innerHTML = '';
}

function scheduleAutoLookup() {
  clearTimeout(autoLookupTimer);
  if (awAbortController) { awAbortController.abort(); awAbortController = null; }
  const word = document.getElementById('aw-word').value.trim();
  awAutoFilledValues = {};
  awAudioUrl = '';
  ['aw-phonetic','aw-meaning','aw-example','aw-category'].forEach(id => {
    const f = document.getElementById(id);
    if (f) { f.value = ''; f.classList.remove('autofilled'); }
  });
  resetAwExtras();
  const speakBtn = document.getElementById('aw-speak-btn');
  if (word.length < 2) {
    awSpeakWord = '';
    if (speakBtn) speakBtn.style.display = 'none';
    return;
  }
  awSpeakWord = word;
  if (speakBtn) speakBtn.style.display = 'flex';
  autoLookupTimer = setTimeout(() => doAutoLookup(word), 500);
}

function fillField(id, val) {
  if (!val) return;
  const el = document.getElementById(id);
  if (!el) return;
  const cur = el.value.trim();
  if (cur === '' || cur === (awAutoFilledValues[id] || '')) {
    el.value = val;
    el.classList.add('autofilled');
    awAutoFilledValues[id] = val;
  }
}

function isStale(word) {
  const el = document.getElementById('aw-word');
  return !el || el.value.trim() !== word;
}

function setStatus(html) { document.getElementById('aw-autofill-status').innerHTML = html; }

function statusBadge(text, type) {
  if (type === 'loading') return `<span class="autofill-badge autofill-loading">${text}</span>`;
  if (type === 'error')   return `<span class="autofill-badge" style="background:var(--fb-err-bg);border-color:var(--fb-err-bdr);color:var(--red)">${text}</span>`;
  if (type === 'info')    return `<span class="autofill-badge" style="background:var(--bg2);border-color:var(--border);color:var(--blue)">${text}</span>`;
  return `<span class="autofill-badge">${text}</span>`;
}

function mapPartOfSpeech(pos) {
  if (!pos) return 'other';
  const p = pos.toLowerCase();
  if (p.includes('noun') || p === 'pronoun') return 'noun';
  if (p.includes('verb') || p.includes('auxiliary')) return 'verb';
  if (p.includes('adjective')) return 'adj';
  if (p.includes('adverb')) return 'adv';
  if (p.includes('phrase') || p.includes('idiom') || p.includes('expression')) return 'phrase';
  return 'other';
}

const POS_LABEL_VI = { noun:'danh từ', verb:'động từ', adj:'tính từ', adv:'trạng từ', phrase:'cụm từ', other:'khác' };

// Danh sách từ CEFR A1-A2 phổ biến (easy) và C1-C2 phổ biến (hard)
// Từ không nằm trong hai danh sách này → medium (B1-B2)
const CEFR_EASY = new Set([
  'a','able','about','above','after','again','age','ago','all','also','always','am','an','and','animal',
  'another','any','are','ask','at','away','back','bad','be','because','before','big','blue','book',
  'both','boy','bread','but','buy','by','call','can','car','cat','city','class','clean','come','cool',
  'could','country','day','do','dog','door','down','drink','drive','eat','end','english','even','every',
  'eye','face','far','fast','find','first','food','for','friend','from','get','girl','give','go','good',
  'great','green','had','hair','hand','happy','have','he','help','her','here','him','his','home','hot',
  'house','how','if','in','is','it','job','just','kind','know','large','last','late','learn','left',
  'like','little','live','long','look','lot','love','make','man','many','me','meet','milk','more','most',
  'mother','much','my','name','new','next','nice','no','not','now','number','of','old','on','one','open',
  'or','other','our','out','over','own','part','people','phone','place','play','please','put','read',
  'red','right','run','sad','same','school','see','she','sleep','small','some','son','soon','sorry',
  'speak','start','stay','stop','study','sun','take','talk','teacher','tell','than','thank','that','the',
  'their','them','then','there','they','thing','think','this','time','to','today','together','too','try',
  'under','up','use','very','walk','want','warm','water','way','we','well','what','when','where','which',
  'white','who','why','will','with','work','world','write','year','yes','you','young','your',
  'bad','deft','grim','taut','gush','keen','limp','mild','neat','pale','rash','tame','vain','wary','woe',
]);
const CEFR_HARD = new Set([
  'aberrant','abhorrent','abject','abrogate','abscond','abstain','abstinence','acrimony','acumen',
  'admonish','adroit','adversarial','aegis','affidavit','aggrandize','alacrity','alleviate','ameliorate',
  'anachronism','anomalous','antipathy','apocryphal','approbation','arduous','ascertain','asperity',
  'assiduous','atrophy','audacious','auspicious','austere','avarice','banal','belligerent','benevolent',
  'bequeath','besmirch','cacophony','capricious','catharsis','caustic','chicanery','circumspect',
  'clandestine','coerce','cogent','complacent','convoluted','copious','corroborate','credulous',
  'culpable','cursory','debilitate','decorum','deleterious','demagogue','deprecated','depravity',
  'deranged','desiccate','desultory','dilapidated','dilettante','diminutive','disavow','disconcert',
  'disparate','dissemble','dogmatic','duplicity','ebullient','egregious','elusive','embroil','empirical',
  'endemic','enervate','enigmatic','ephemeral','equivocal','erudite','esoteric','euphemism','evanescent',
  'exacerbate','excoriate','exemplary','exonerate','expedient','extraneous','fecund','fervent','flagrant',
  'foment','fortuitous','fractious','fraudulent','furtive','garrulous','grandiose','gregarious',
  'hapless','harangue','hegemony','heterogeneous','hubris','hypocritical','iconoclast','idiosyncrasy',
  'ignominious','immutable','imperious','implacable','impudent','inadvertent','incendiary','incorrigible',
  'indomitable','inequitable','inexorable','infallible','ingenuous','insidious','intransigent','inveterate',
  'irascible','labyrinthine','laconic','lethargic','litigious','loquacious','lucid','lugubrious',
  'magnanimous','malevolent','malleable','mendacious','meticulous','misanthrope','mitigate','mundane',
  'nefarious','neologism','nihilism','nonchalant','obdurate','obfuscate','oblique','obstinate','obtuse',
  'odious','omnipotent','omniscient','opaque','ostentatious','ostracize','parsimonious','pedantic',
  'pejorative','pernicious','perspicacious','pervasive','philanthropy','platitude','plausible',
  'polemical','portentous','pragmatic','precarious','predilection','preposterous','presumptuous',
  'prevaricate','probity','procrastinate','profound','proliferate','propitious','provincial','prudent',
  'pugnacious','querulous','ramification','rancorous','rapacious','recalcitrant','recondite',
  'remonstrate','repudiate','resilient','reticent','rhetoric','sanctimonious','sanguine','sardonic',
  'scrupulous','serendipity','solicitous','specious','spurious','squalor','stoic','strident',
  'subjugate','superfluous','sycophant','taciturn','tangential','tenacious','timorous','torpid',
  'transient','trite','truculent','turbulent','ubiquitous','unconscionable','unctuous','utilitarian',
  'vacillate','venerate','verbose','vexatious','vicarious','vindictive','virulent','volatile',
  'wanton','zealous','zeal',
]);
function estimateLevel(word) {
  const w = (word || '').toLowerCase().trim();
  if (CEFR_EASY.has(w)) return 'easy';
  if (CEFR_HARD.has(w)) return 'hard';
  // Fallback: từ rất ngắn (≤3) thường dễ, từ rất dài (≥12) thường khó
  const len = w.length;
  if (len <= 3) return 'easy';
  if (len >= 12) return 'hard';
  return 'medium';
}

function guessCategory(definition, partOfSpeech, meaningVI) {
  const d = (definition || '').toLowerCase();
  const v = (meaningVI || '').toLowerCase();
  if (/feel|emotion|happy|sad|anger|love|fear|joy|grief/.test(d) || /cảm xúc|vui|buồn|giận|sợ|yêu thương/.test(v)) return 'Cảm xúc';
  if (/person|character|behav|personality|trait|manner/.test(d) || /tính cách|tính khí/.test(v)) return 'Tính cách';
  if (/work|job|career|business|profess|office|manage/.test(d) || /công việc|nghề nghiệp/.test(v)) return 'Công việc';
  if (/learn|educat|school|study|knowledge|university|college|campus|academ/.test(d) || /giáo dục|học tập|trường/.test(v)) return 'Giáo dục';
  if (/\bnature\b|plant|animal|\bearth\b|wildlife|forest|ocean|mountain|river/.test(d) || /thiên nhiên|động vật|thực vật/.test(v)) return 'Thiên nhiên';
  if (/speak|talk|language|word|communicat|express/.test(d) || /giao tiếp|nói|ngôn ngữ/.test(v)) return 'Giao tiếp';
  if (/think|idea|mind|philosoph|concept|logic|reason/.test(d) || /triết học|tư tưởng/.test(v)) return 'Triết học';
  if (/travel|journey|place|country|city|trip/.test(d) || /du lịch|chuyến đi/.test(v)) return 'Du lịch';
  if (/food|eat|cook|drink|meal|taste/.test(d) || /ẩm thực|món ăn/.test(v)) return 'Ẩm thực';
  if (/science|technolog|digital|computer|data|system/.test(d) || /công nghệ|khoa học/.test(v)) return 'Công nghệ';
  if (/art|music|paint|creat|design|aesthetic/.test(d) || /nghệ thuật/.test(v)) return 'Nghệ thuật';
  if (/health|medic|body|disease|treatment/.test(d) || /sức khỏe|bệnh/.test(v)) return 'Sức khỏe';
  if (/society|social|culture|community|people/.test(d) || /xã hội|cộng đồng/.test(v)) return 'Xã hội';
  if (mapPartOfSpeech(partOfSpeech) === 'verb') return 'Hành động';
  return 'Cuộc sống';
}

async function translateText(text, signal) {
  if (!text || !text.trim()) return '';
  // Thử Google Translate unofficial API trước
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + encodeURIComponent(text);
    const resp = await fetch(url, { signal });
    if (resp.ok) {
      const data = await resp.json();
      const result = (data[0] || []).map(seg => (seg && seg[0]) || '').join('').trim().normalize('NFC');
      if (result) return result;
    }
  } catch(e) { if (e.name === 'AbortError') throw e; }

  // Fallback sang MyMemory API (official free tier)
  try {
    const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`;
    const resp2 = await fetch(url2, { signal });
    if (resp2.ok) {
      const data2 = await resp2.json();
      const result2 = (data2.responseData?.translatedText || '').trim().normalize('NFC');
      if (result2 && result2 !== text) return result2;
    }
  } catch(e) { if (e.name === 'AbortError') throw e; }

  throw new Error('Tất cả API dịch đều không khả dụng');
}

async function translateWordLikeGoogle(word, signal) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=' + encodeURIComponent(word);
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error('Translate HTTP ' + resp.status);
  const data = await resp.json();
  const quick = (data[0] || []).map(seg => (seg && seg[0]) || '').join('').trim().normalize('NFC');
  let dictEntries = [];
  try {
    dictEntries = (data[1] || [])
      .map(e => ({ pos: (e && e[0]) || '', terms: (e && Array.isArray(e[1])) ? e[1].filter(t => typeof t === 'string' && t.trim()).map(t => t.normalize('NFC')) : [] }))
      .filter(e => e.terms.length);
  } catch(e) { dictEntries = []; }
  return { quick, dictEntries };
}

function pickAudio(phonetics) {
  for (const p of (phonetics || [])) {
    if (p.audio) return p.audio.startsWith('http') ? p.audio : 'https:' + p.audio;
  }
  return '';
}

function playPronunciation() {
  const btn = document.getElementById('aw-speak-btn');
  if (btn) { btn.classList.add('speaking'); setTimeout(() => btn.classList.remove('speaking'), 600); }
  if (awAudioUrl) {
    try {
      if (awCurrentAudio) { awCurrentAudio.pause(); }
      awCurrentAudio = new Audio(awAudioUrl);
      awCurrentAudio.play().catch(() => speakWithBrowserTTS());
      return;
    } catch(e) { /* fallthrough */ }
  }
  speakWithBrowserTTS();
}

function speakWithBrowserTTS() {
  if (!awSpeakWord || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(awSpeakWord);
    u.lang = 'en-US'; u.rate = 0.92;
    window.speechSynthesis.speak(u);
  } catch(e) { /* browser doesn't support TTS */ }
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

function pickRandomExample(entry, dominantPos) {
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
  const withEx = source.filter(x => x.example);
  return withEx.length
    ? withEx[Math.floor(Math.random() * withEx.length)]
    : (source[Math.floor(Math.random() * source.length)] || { example:'', definition:'', pos:'' });
}

async function doAutoLookup(word) {
  if (!word || word.length < 2) return;
  currentLookupWord = word;
  const myGen = ++lookupGen; // capture generation at start

  // Nếu đã tra từ này trước đó (còn hạn cache), dùng lại kết quả ngay —
  // không gọi lại dictionaryapi.dev/Google Translate, tránh rate-limit và
  // đảm bảo kết quả nhất quán giữa các lần tra cùng một từ.
  const cached = getCachedLookup(word);
  if (cached) {
    applyLookupResult(word, cached);
    setStatus(statusBadge('✨ Đã tra xong (từ bộ nhớ đệm)', 'success'));
    return;
  }

  const controller = new AbortController();
  awAbortController = controller;
  const signal = controller.signal;
  const guardTimer = setTimeout(() => controller.abort(), 9000);
  setStatus(statusBadge('⏳ Đang tra từ điển & dịch...', 'loading'));

  const dictPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  const transPromise = translateWordLikeGoogle(word, signal).catch(() => null);
  const [entries, gTrans] = await Promise.all([dictPromise, transPromise]);
  clearTimeout(guardTimer);
  // Kiểm tra generation counter — loại bỏ kết quả từ request cũ hơn
  if (myGen !== lookupGen || signal.aborted || isStale(word)) return;

  const entry = (Array.isArray(entries) && entries.length) ? entries[0] : null;
  const dominantPos = pickDominantPos(entry);

  let phonetic = '';
  if (entry) {
    phonetic = entry.phonetic || '';
    if (!phonetic) { for (const p of (entry.phonetics || [])) { if (p.text) { phonetic = p.text; break; } } }
    awAudioUrl = pickAudio(entry.phonetics);
  }

  const picked = pickRandomExample(entry, dominantPos);
  const exampleEn = picked.example || '';
  const enDefinition = picked.definition || '';

  let meaningVI = '', primaryPos = '', dictEntries = [];
  if (gTrans) {
    dictEntries = gTrans.dictEntries || [];
    const matchedEntry = dictEntries.find(e => mapPartOfSpeech(e.pos) === dominantPos && dominantPos !== 'other');
    if (matchedEntry) {
      meaningVI = matchedEntry.terms.slice(0, 2).join(', ');
      primaryPos = matchedEntry.pos;
    } else if (gTrans.quick) {
      meaningVI = gTrans.quick;
      primaryPos = dictEntries[0]?.pos || '';
    } else if (dictEntries.length) {
      meaningVI = dictEntries[0].terms.slice(0, 2).join(', ');
      primaryPos = dictEntries[0].pos || '';
    }
  }

  if (!meaningVI) meaningVI = VI_HINTS[word.toLowerCase()] || '';
  if (!meaningVI && enDefinition) {
    try {
      const translated = await translateText(enDefinition, signal);
      // Kiểm tra lại ngay sau await — người dùng có thể đã gõ từ mới trong lúc chờ dịch
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
      meaningVI = translated;
    } catch(e) {
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    }
  }
  if (myGen !== lookupGen || signal.aborted || isStale(word)) return;

  if (!meaningVI) {
    setStatus(statusBadge('❌ Không tìm thấy nghĩa cho từ "<b>' + escHtml(word) + '</b>"', 'error'));
    return;
  }

  const finalPos = dominantPos !== 'other' && dominantPos ? dominantPos : mapPartOfSpeech(primaryPos);
  const category = guessCategory(enDefinition, finalPos, meaningVI);

  const others = dictEntries.filter(e => mapPartOfSpeech(e.pos) !== finalPos).slice(0, 3);
  const parts = others.map(e => `<b>${POS_LABEL_VI[mapPartOfSpeech(e.pos)] || e.pos}</b>: ${escHtml(e.terms.slice(0, 2).join(', '))}`).filter(Boolean);
  const altHtml = parts.length ? 'Nghĩa khác — ' + parts.join('  •  ') : '';

  // Chờ luôn bản dịch câu ví dụ ở đây (không chạy ngầm không await) để có thể
  // cache toàn bộ kết quả một lần — cache mới phản ánh đúng những gì user thấy.
  let exampleVi = '';
  if (exampleEn) {
    try {
      exampleVi = await translateText(exampleEn, signal);
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    } catch(e) {
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    }
  }

  const result = { phonetic, exampleEn, meaningVI, finalPos, category, audioUrl: awAudioUrl, altHtml, exampleVi };
  setCachedLookup(word, result);
  applyLookupResult(word, result);
  setStatus(statusBadge('✨ Đã tra xong — bạn có thể chỉnh sửa nếu cần', 'success'));
}
