// ════════════════════════════════════════════════════════
// STREAK — chỉ tăng sau khi user học ít nhất 1 thẻ/quiz
// ════════════════════════════════════════════════════════
function loadStreak() {
  try { return JSON.parse(storeGet(STREAK_KEY)) || { count:0, last:null, history:[] }; }
  catch { return { count:0, last:null, history:[] }; }
}
function saveStreak(s) { storeSet(STREAK_KEY, JSON.stringify(s)); }

// Lưu số lượt học theo từng ngày (date -> count) để vẽ heatmap kiểu GitHub.
// Tách riêng khỏi streak vì streak chỉ cần biết "có học hay không" mỗi ngày,
// còn heatmap cần biết "học bao nhiêu" để tô đậm/nhạt theo cường độ.
const DAILY_ACTIVITY_KEY = 'wordnest_daily_activity';
const DAILY_ACTIVITY_MAX_DAYS = 370;

function loadDailyActivity() {
  try { return JSON.parse(storeGet(DAILY_ACTIVITY_KEY)) || {}; }
  catch { return {}; }
}
function saveDailyActivity(map) { storeSet(DAILY_ACTIVITY_KEY, JSON.stringify(map)); }
function bumpDailyActivity() {
  const map = loadDailyActivity();
  const today = localDateKey();
  map[today] = (map[today] || 0) + 1;
  const keys = Object.keys(map);
  if (keys.length > DAILY_ACTIVITY_MAX_DAYS) {
    keys.sort().slice(0, keys.length - DAILY_ACTIVITY_MAX_DAYS).forEach(k => delete map[k]);
  }
  saveDailyActivity(map);
}

// Chỉ gọi hàm này SAU KHI user thực sự học (markCard, answerQuiz, checkSpelling)
function recordLearningActivity() {
  bumpDailyActivity();
  const s = loadStreak();
  const today = localDateKey();
  if (s.last !== today) {
    const yesterday = localDateKey(new Date(Date.now() - 86400000));
    s.count = (s.last === yesterday) ? s.count + 1 : 1;
    s.last = today;
    s.history = [...(s.history || []).slice(-29), today];
    saveStreak(s);
    const sc = document.getElementById('streak-count');
    if (sc) sc.textContent = s.count;
    const hs = document.getElementById('home-streak');
    if (hs) hs.textContent = s.count;
  }
  return s;
}

migrateKeyIfNeeded(DAILY_ACTIVITY_KEY); // migration localStorage → file
let streak = loadStreak(); // Chỉ đọc, không ghi

// ════════════════════════════════════════════════════════
// SPACED REPETITION SYSTEM (SM-2 simplified)
// ════════════════════════════════════════════════════════
// Mỗi word cần thêm: srsInterval (ngày), srsEF (ease factor), srsDue (ISO date)
// known=true: interval = prev*EF; EF += 0.1 (max 2.5)
// known=false: interval = 1; EF -= 0.2 (min 1.3)

function srsInit(word) {
  if (word.srsInterval === undefined || word.srsInterval === null) word.srsInterval = 1;
  if (word.srsEF === undefined || word.srsEF === null) word.srsEF = 2.5;
  if (!word.srsDue) word.srsDue = localDateKey();
  return word;
}

function srsUpdate(word, correct) {
  word = srsInit(word);
  if (correct) {
    word.srsEF = Math.min(2.5, (word.srsEF || 2.5) + 0.1);
    word.srsInterval = Math.round((word.srsInterval || 1) * word.srsEF);
  } else {
    word.srsEF = Math.max(1.3, (word.srsEF || 2.5) - 0.2);
    word.srsInterval = 1;
  }
  const due = new Date();
  due.setDate(due.getDate() + word.srsInterval);
  word.srsDue = localDateKey(due);
  return word;
}

function srsDueCount() {
  const today = localDateKey();
  return activeWords().filter(w => !w.srsDue || w.srsDue <= today).length;
}

function getSrsDueWords() {
  const today = localDateKey();
  return activeWords().filter(w => !w.srsDue || w.srsDue <= today);
}
