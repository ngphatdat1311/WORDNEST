// ════════════════════════════════════════════════════════
// AUTO-LOOKUP (Add Word) — điều phối tra từ điển + dịch tự động khi gõ vào ô
// "Từ tiếng Anh", và đổ kết quả vào form. Dựa vào lookup-cache.js (cache kết
// quả), lookup-classify.js (đoán từ loại/độ khó/chủ đề) và lookup-providers.js
// (gọi API dịch/từ điển bên ngoài).
// ════════════════════════════════════════════════════════
let autoLookupTimer = null;
let awAutoFilledValues = {};
let currentLookupWord = '';
let awAudioUrl = '';
let awSpeakWord = '';
let awCurrentAudio = null;
let awAbortController = null;
let lookupGen = 0; // generation counter để loại bỏ hoàn toàn race condition

// Lưu lại kết quả tra từ điển gần nhất để nút "Đổi ví dụ khác" có thể chọn 1
// ví dụ khác trong CÙNG dữ liệu đã tải, khỏi phải tra lại từ đầu (nhanh hơn
// nhiều — chỉ cần dịch câu mới, không cần gọi lại dictionaryapi.dev).
let lastLookupEntry = null;
let lastLookupDominantPos = '';
let lastLookupUsedExamples = new Set();
let lastLookupAllExamples = []; // toàn bộ ví dụ có trong từ điển cho từ hiện tại (mọi nghĩa) + Tatoeba
let lastLookupExampleVi = {}; // text -> bản dịch tiếng Việt có sẵn (Tatoeba), khỏi phải dịch máy lại

// Áp kết quả (từ cache hoặc từ API) vào form — dùng chung cho cả 2 đường
function applyLookupResult(word, r) {
  fillField('aw-phonetic', r.phonetic);
  fillField('aw-example', r.exampleEn);
  document.getElementById('aw-level').value = r.level || estimateLevel(word);
  fillField('aw-meaning', r.meaningVI);
  document.getElementById('aw-type').value = r.finalPos || 'other';
  fillField('aw-category', r.category);
  awAudioUrl = r.audioUrl || '';
  const altEl = document.getElementById('aw-alt-meaning');
  if (altEl) altEl.innerHTML = r.altHtml || '';
  const exViEl = document.getElementById('aw-example-vi');
  if (exViEl) exViEl.innerHTML = r.exampleVi ? '→ ' + escHtml(r.exampleVi) : '';
  // Chỉ hiện nút "Đổi ví dụ khác" khi THỰC SỰ có ≥2 ví dụ khác nhau để chọn —
  // nhiều từ (vd "profound", "genuine") chỉ có đúng 1 ví dụ trong từ điển, hiện
  // nút ra mà bấm không đổi gì sẽ trông như app bị lỗi. Kết quả từ cache cũng
  // không giữ dữ liệu từ điển gốc nên không có gì để chọn ví dụ khác.
  lastLookupAllExamples = lastLookupEntry ? getAllExamples(lastLookupEntry) : [];
  lastLookupExampleVi = {};
  refreshRerollVisibility();
}

// Hiện/ẩn + cập nhật nhãn nút "Đổi ví dụ khác" theo số ví dụ hiện có trong pool
// (dictionaryapi.dev + Tatoeba) — gọi lại mỗi khi pool thay đổi (Tatoeba tải
// xong ở nền sau khi đã hiện kết quả ban đầu).
function refreshRerollVisibility() {
  const rerollBtn = document.getElementById('aw-reroll-example-btn');
  if (!rerollBtn) return;
  rerollBtn.style.display = lastLookupAllExamples.length >= 2 ? 'flex' : 'none';
  if (lastLookupAllExamples.length >= 2) updateRerollButtonLabel();
}

// Tải thêm ví dụ thật từ Tatoeba ở NỀN (không chặn UI ban đầu) — Tatoeba có
// hàng chục câu cho mỗi từ, nhiều hơn rất nhiều so với 1-3 câu cố định của
// dictionaryapi.dev, giúp "Đổi ví dụ khác" luôn ra câu MỚI, không lặp lại.
// Chỉ chạy trong app desktop (Electron) — API này không có CORS nên web thường
// không gọi được trực tiếp.
async function loadMoreExamplesFromTatoeba(word, myGen) {
  if (!window.electronAPI?.fetchTatoebaExamples) return;
  let list;
  try { list = await window.electronAPI.fetchTatoebaExamples(word); }
  catch { return; }
  if (myGen !== lookupGen || isStale(word) || !Array.isArray(list)) return;
  const seen = new Set(lastLookupAllExamples);
  for (const item of list) {
    if (!item?.text || seen.has(item.text)) continue;
    seen.add(item.text);
    lastLookupAllExamples.push(item.text);
    if (item.vi) lastLookupExampleVi[item.text] = item.vi;
  }
  refreshRerollVisibility();
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
  lastLookupEntry = null;
  lastLookupDominantPos = '';
  lastLookupUsedExamples = new Set();
  lastLookupAllExamples = [];
  lastLookupExampleVi = {};
  const rerollBtn = document.getElementById('aw-reroll-example-btn');
  if (rerollBtn) rerollBtn.style.display = 'none';
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

function playPronunciation() {
  const btn = document.getElementById('aw-speak-btn');
  if (btn) { btn.classList.add('speaking'); setTimeout(() => btn.classList.remove('speaking'), 600); }
  if (awAudioUrl) {
    try {
      if (awCurrentAudio) { awCurrentAudio.pause(); }
      awCurrentAudio = new Audio(awAudioUrl);
      awCurrentAudio.play().catch(() => speakWithBrowserTTS());
      return;
    } catch { /* fallthrough */ }
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
  } catch { /* browser doesn't support TTS */ }
}

async function doSentenceLookup(sentence, myGen) {
  const controller = new AbortController();
  awAbortController = controller;
  const signal = controller.signal;
  const guardTimer = setTimeout(() => controller.abort(), 9000);
  setStatus(statusBadge('⏳ Đang dịch câu...', 'loading'));

  let meaningVI = '';
  try { meaningVI = await translateText(sentence, signal); }
  catch { /* thử tiếp ở dưới, không throw */ }
  clearTimeout(guardTimer);
  if (myGen !== lookupGen || signal.aborted || isStale(sentence)) return;

  if (!meaningVI) {
    setStatus(statusBadge('❌ Không dịch được câu này — nhập tay nhé', 'error'));
    return;
  }

  const result = { phonetic: '', exampleEn: '', meaningVI, finalPos: 'phrase', category: 'Câu', audioUrl: '', altHtml: '', exampleVi: '', level: 'medium' };
  applyLookupResult(sentence, result);
  setStatus(statusBadge('✨ Đã dịch xong', 'success'));
}

async function doAutoLookup(word) {
  if (!word || word.length < 2) return;
  currentLookupWord = word;
  const myGen = ++lookupGen; // capture generation at start

  if (looksLikeSentence(word)) { await doSentenceLookup(word, myGen); return; }

  // Nếu đã tra từ này trước đó (còn hạn cache), dùng lại kết quả ngay —
  // không gọi lại dictionaryapi.dev/Google Translate, tránh rate-limit và
  // đảm bảo kết quả nhất quán giữa các lần tra cùng một từ.
  const cached = getCachedLookup(word);
  if (cached) {
    applyLookupResult(word, cached);
    setStatus(statusBadge('✨ Đã tra xong', 'success'));
    // Nếu phonetic bị thiếu trong cache, thử Datamuse trong nền — nhanh, không chặn UI
    if (!cached.phonetic && window.electronAPI?.fetchPhoneticFallback && !/\s/.test(word)) {
      window.electronAPI.fetchPhoneticFallback(word).then(ph => {
        if (!ph || myGen !== lookupGen || isStale(word)) return;
        fillField('aw-phonetic', ph);
        setCachedLookup(word, { ...cached, phonetic: ph });
      }).catch(() => {});
    }
    loadMoreExamplesFromTatoeba(word, myGen);
    return;
  }

  const controller = new AbortController();
  awAbortController = controller;
  const signal = controller.signal;
  const guardTimer = setTimeout(() => controller.abort(), 9000);
  setStatus(statusBadge('⏳ Đang tra từ điển & dịch...', 'loading'));

  // Datamuse chỉ tra phiên âm cho TỪ ĐƠN (không phải cụm từ) — dùng làm dự
  // phòng khi dictionaryapi.dev không có entry hoặc có entry nhưng thiếu phonetic.
  const phoneticFallbackPromise = (window.electronAPI?.fetchPhoneticFallback && !/\s/.test(word))
    ? window.electronAPI.fetchPhoneticFallback(word).catch(() => '')
    : Promise.resolve('');

  const dictPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  const transPromise = translateWordLikeGoogle(word, signal).catch(() => null);
  const [entries, gTrans, phoneticFallback] = await Promise.all([dictPromise, transPromise, phoneticFallbackPromise]);
  clearTimeout(guardTimer);
  // Kiểm tra generation counter — loại bỏ kết quả từ request cũ hơn
  if (myGen !== lookupGen || signal.aborted || isStale(word)) return;

  const entry = (Array.isArray(entries) && entries.length) ? entries[0] : null;
  const dominantPos = pickDominantPos(entry);
  lastLookupEntry = entry;
  lastLookupDominantPos = dominantPos;
  lastLookupUsedExamples = new Set();

  let phonetic = '';
  if (entry) {
    phonetic = entry.phonetic || '';
    if (!phonetic) { for (const p of (entry.phonetics || [])) { if (p.text) { phonetic = p.text; break; } } }
    awAudioUrl = pickAudio(entry.phonetics);
  }
  if (!phonetic && phoneticFallback) phonetic = phoneticFallback;

  const picked = pickRandomExample(entry, dominantPos);
  const exampleEn = picked.example || '';
  const enDefinition = picked.definition || '';
  if (exampleEn) lastLookupUsedExamples.add(exampleEn);

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
    } catch {
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    }
  }
  if (myGen !== lookupGen || signal.aborted || isStale(word)) return;

  // Tầng dự phòng cuối — Google (endpoint tra từ điển dt=bd) đôi khi không có
  // entry cho từ hiếm/ít gặp/biến thể số nhiều... thử lại bằng đường dịch câu
  // thông thường (đua song song Google dt=t + MyMemory) trước khi chịu thua.
  if (!meaningVI) {
    try {
      meaningVI = await translateText(word, signal);
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    } catch {
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    }
  }

  if (!meaningVI) {
    setStatus(statusBadge('❌ Không tìm thấy nghĩa — nhập tay nhé', 'error'));
    return;
  }

  const finalPos = dominantPos !== 'other' && dominantPos ? dominantPos : mapPartOfSpeech(primaryPos);
  const category = guessCategory(enDefinition, finalPos, meaningVI);

  const others = dictEntries.filter(e => mapPartOfSpeech(e.pos) !== finalPos).slice(0, 3);
  const parts = others.map(e => `<b>${escHtml(POS_LABEL_VI[mapPartOfSpeech(e.pos)] || e.pos)}</b>: ${escHtml(e.terms.slice(0, 2).join(', '))}`).filter(Boolean);
  const altHtml = parts.length ? 'Nghĩa khác — ' + parts.join('  •  ') : '';

  // Chờ luôn bản dịch câu ví dụ ở đây (không chạy ngầm không await) để có thể
  // cache toàn bộ kết quả một lần — cache mới phản ánh đúng những gì user thấy.
  let exampleVi = '';
  if (exampleEn) {
    try {
      exampleVi = await translateText(exampleEn, signal);
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    } catch {
      if (myGen !== lookupGen || signal.aborted || isStale(word)) return;
    }
  }

  const result = { phonetic, exampleEn, meaningVI, finalPos, category, audioUrl: awAudioUrl, altHtml, exampleVi };
  setCachedLookup(word, result);
  applyLookupResult(word, result);
  setStatus(statusBadge('✨ Đã tra xong', 'success'));
  loadMoreExamplesFromTatoeba(word, myGen);
}

// "Đổi ví dụ khác" — chọn 1 câu khác trong CÙNG dữ liệu từ điển đã tải (không
// tra lại từ đầu), chỉ cần dịch câu mới -> nhanh hơn nhiều so với tra lại.
// Cập nhật chữ trên nút theo số ví dụ CHƯA xem — báo trước rõ ràng còn bao
// nhiêu, và tự khoá nút lại khi đã xem hết để KHÔNG BAO GIỜ lặp lại ví dụ cũ
// (trước đây hết ví dụ mới vẫn cho bấm, quay lại ví dụ đã xem, trông như lỗi).
function updateRerollButtonLabel() {
  const btn = document.getElementById('aw-reroll-example-btn');
  if (!btn) return;
  const remaining = lastLookupAllExamples.length - lastLookupUsedExamples.size;
  if (remaining > 0) {
    btn.disabled = false;
    btn.textContent = `🔄 Đổi ví dụ khác (còn ${remaining})`;
  } else {
    btn.disabled = true;
    btn.textContent = '✓ Đã xem hết ví dụ';
  }
}

async function rerollExample() {
  if (lastLookupAllExamples.length < 2) { showToast('Từ này chỉ có 1 ví dụ trong từ điển'); return; }

  const unseen = lastLookupAllExamples.filter(ex => !lastLookupUsedExamples.has(ex));
  if (!unseen.length) { showToast('Đã xem hết tất cả ví dụ có sẵn cho từ này'); updateRerollButtonLabel(); return; }

  const btn = document.getElementById('aw-reroll-example-btn');
  if (btn) btn.disabled = true;

  const picked = unseen[Math.floor(Math.random() * unseen.length)];
  lastLookupUsedExamples.add(picked);
  const wordAtPick = currentLookupWord;

  const exampleEl = document.getElementById('aw-example');
  const exViEl = document.getElementById('aw-example-vi');
  exampleEl.value = picked;
  exampleEl.classList.add('autofilled');
  awAutoFilledValues['aw-example'] = picked;

  // Câu lấy từ Tatoeba đã có sẵn bản dịch người dịch thật (chính xác + nhanh hơn
  // dịch máy) — chỉ gọi API dịch khi không có sẵn (câu từ dictionaryapi.dev).
  const knownVi = lastLookupExampleVi[picked];
  if (knownVi) {
    if (exViEl) exViEl.innerHTML = '→ ' + escHtml(knownVi);
    updateRerollButtonLabel();
    return;
  }

  if (exViEl) exViEl.innerHTML = '⏳ Đang dịch...';
  try {
    const vi = await translateText(picked);
    if (isStale(wordAtPick)) { updateRerollButtonLabel(); return; }
    if (exViEl) exViEl.innerHTML = vi ? '→ ' + escHtml(vi) : '';
  } catch {
    if (!isStale(wordAtPick) && exViEl) exViEl.innerHTML = '';
  }
  updateRerollButtonLabel();
}
