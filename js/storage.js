// ════════════════════════════════════════════════════════
// STORAGE BACKEND — file-based trong Electron (không giới hạn kích thước),
// localStorage làm fallback khi chạy trên web thường.
// ════════════════════════════════════════════════════════
function storeGet(key) {
  if (window.electronAPI?.storeRead) return window.electronAPI.storeRead(key);
  try { return localStorage.getItem(key); } catch { return null; }
}
function storeSet(key, val) {
  if (window.electronAPI?.storeWrite) {
    const ok = window.electronAPI.storeWrite(key, val) !== false;
    if (!ok) { try { showToast('⚠️ Không ghi được file dữ liệu!', 'error'); } catch {} }
    return ok;
  }
  try { localStorage.setItem(key, val); return true; } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showToast('⚠️ Bộ nhớ đầy! Hãy xuất JSON và xóa bớt từ để tiếp tục.', 'error');
    }
    return false;
  }
}
// Migration: chép dữ liệu từ localStorage sang file khi lần đầu chạy Electron
function migrateKeyIfNeeded(key) {
  if (!window.electronAPI?.storeRead || !window.electronAPI?.storeWrite) return;
  if (window.electronAPI.storeRead(key) !== null) return; // đã có file rồi
  try { const v = localStorage.getItem(key); if (v !== null) window.electronAPI.storeWrite(key, v); } catch {}
}

// ════════════════════════════════════════════════════════
// DATA STORE
// ════════════════════════════════════════════════════════
const STORAGE_KEY    = 'wordnest_data';
const STREAK_KEY     = 'wordnest_streak';
const THEME_KEY      = 'wordnest_theme';
const FOLDERS_KEY    = 'wordnest_folders';
const TRASH_KEY      = 'wordnest_trash';
const QUIZ_STATS_KEY = 'wordnest_quiz_stats';

const DEFAULT_WORDS = [
  { word:'serendipity', phonetic:'/ˌser.ənˈdɪp.ɪ.ti/', meaning:'sự tình cờ may mắn', example:'It was serendipity that we met.', type:'noun', category:'Cuộc sống', level:'hard', mastery:0, known:0, seen:0 },
  { word:'ephemeral', phonetic:'/ɪˈfem.ər.əl/', meaning:'ngắn ngủi, thoáng qua', example:'Youth is ephemeral.', type:'adj', category:'Triết học', level:'hard', mastery:0, known:0, seen:0 },
  { word:'resilient', phonetic:'/rɪˈzɪl.i.ənt/', meaning:'kiên cường, đàn hồi', example:'She is a resilient person.', type:'adj', category:'Tính cách', level:'medium', mastery:1, known:2, seen:4 },
  { word:'abundant', phonetic:'/əˈbʌn.dənt/', meaning:'dồi dào, phong phú', example:'Fish are abundant in this river.', type:'adj', category:'Thiên nhiên', level:'medium', mastery:0, known:1, seen:3 },
  { word:'meticulous', phonetic:'/məˈtɪk.jʊ.ləs/', meaning:'tỉ mỉ, cẩn thận', example:'She is meticulous about details.', type:'adj', category:'Tính cách', level:'hard', mastery:0, known:0, seen:1 },
  { word:'collaborate', phonetic:'/kəˈlæb.ə.reɪt/', meaning:'hợp tác, cộng tác', example:'We need to collaborate on this project.', type:'verb', category:'Công việc', level:'medium', mastery:2, known:5, seen:7 },
  { word:'genuine', phonetic:'/ˈdʒen.jʊ.ɪn/', meaning:'thật sự, chân thành', example:'She gave a genuine smile.', type:'adj', category:'Tính cách', level:'easy', mastery:3, known:8, seen:9 },
  { word:'eloquent', phonetic:'/ˈel.ə.kwənt/', meaning:'hùng hồn, lưu loát', example:'He is an eloquent speaker.', type:'adj', category:'Giao tiếp', level:'hard', mastery:0, known:0, seen:2 },
  { word:'persist', phonetic:'/pəˈsɪst/', meaning:'kiên trì, tiếp tục', example:'She persisted despite the difficulties.', type:'verb', category:'Cuộc sống', level:'medium', mastery:1, known:3, seen:5 },
  { word:'inevitable', phonetic:'/ɪnˈev.ɪ.tə.bəl/', meaning:'không thể tránh khỏi', example:'Change is inevitable.', type:'adj', category:'Triết học', level:'medium', mastery:0, known:1, seen:4 },
  { word:'innovative', phonetic:'/ˈɪn.ə.veɪ.tɪv/', meaning:'sáng tạo, đổi mới', example:'We need innovative solutions.', type:'adj', category:'Công việc', level:'medium', mastery:2, known:4, seen:6 },
  { word:'gratitude', phonetic:'/ˈɡræt.ɪ.tjuːd/', meaning:'lòng biết ơn', example:'She expressed her gratitude.', type:'noun', category:'Cảm xúc', level:'easy', mastery:3, known:10, seen:12 },
  { word:'ambiguous', phonetic:'/æmˈbɪɡ.jʊ.əs/', meaning:'mơ hồ, không rõ ràng', example:'The statement was ambiguous.', type:'adj', category:'Ngôn ngữ', level:'hard', mastery:0, known:0, seen:2 },
  { word:'profound', phonetic:'/prəˈfaʊnd/', meaning:'sâu sắc, thâm thúy', example:'It had a profound effect on me.', type:'adj', category:'Triết học', level:'medium', mastery:1, known:2, seen:5 },
  { word:'versatile', phonetic:'/ˈvɜː.sə.taɪl/', meaning:'đa năng, linh hoạt', example:'She is a versatile actress.', type:'adj', category:'Tính cách', level:'medium', mastery:0, known:1, seen:3 },
];

function loadWords() {
  try {
    const saved = storeGet(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [...DEFAULT_WORDS];
  } catch { return [...DEFAULT_WORDS]; }
}
function saveWords() {
  const ok = storeSet(STORAGE_KEY, JSON.stringify(words));
  if (ok && typeof autoSyncWrite === 'function') autoSyncWrite();
  return ok;
}

// ════════════════════════════════════════════════════════
// FOLDERS — nhóm từ thủ công (khác Chủ đề), kiểu thư mục
// ════════════════════════════════════════════════════════
function loadFolders() {
  try {
    const saved = storeGet(FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function saveFolders() {
  const ok = storeSet(FOLDERS_KEY, JSON.stringify(folders));
  if (ok && typeof autoSyncWrite === 'function') autoSyncWrite();
  return ok;
}

// ════════════════════════════════════════════════════════
// TRASH — từ/thư mục đã xóa, khôi phục được (kiểu Thùng rác máy tính)
// entry dạng từ:    { id, type:'word',   deletedAt, word: {...snapshot} }
// entry dạng folder:{ id, type:'folder', deletedAt, folder: {...snapshot}, words: [...snapshot] }
// ════════════════════════════════════════════════════════
function loadTrash() {
  try {
    const saved = storeGet(TRASH_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function saveTrash() {
  const ok = storeSet(TRASH_KEY, JSON.stringify(trash));
  if (ok && typeof autoSyncWrite === 'function') autoSyncWrite();
  return ok;
}

// Migration từ localStorage sang file (chỉ chạy 1 lần lần đầu Electron)
migrateKeyIfNeeded(STORAGE_KEY);
migrateKeyIfNeeded(FOLDERS_KEY);
migrateKeyIfNeeded(TRASH_KEY);
migrateKeyIfNeeded(STREAK_KEY);
migrateKeyIfNeeded(QUIZ_STATS_KEY);
migrateKeyIfNeeded('qs_best_score');

let words   = loadWords();
let folders = loadFolders();
let trash   = loadTrash();

// ════════════════════════════════════════════════════════
// QUIZ STATS — thống kê tích lũy qua nhiều phiên quiz
// ════════════════════════════════════════════════════════
function loadQuizStats() {
  try {
    const saved = storeGet(QUIZ_STATS_KEY);
    return saved ? JSON.parse(saved) : { sessions: 0, totalQ: 0, totalCorrect: 0 };
  } catch { return { sessions: 0, totalQ: 0, totalCorrect: 0 }; }
}
function saveQuizStats(stats) { storeSet(QUIZ_STATS_KEY, JSON.stringify(stats)); }
