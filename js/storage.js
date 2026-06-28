// ════════════════════════════════════════════════════════
// DATA STORE
// ════════════════════════════════════════════════════════
const STORAGE_KEY  = 'wordnest_data';
const STREAK_KEY   = 'wordnest_streak';
const THEME_KEY    = 'wordnest_theme';
const FOLDERS_KEY  = 'wordnest_folders';
const TRASH_KEY    = 'wordnest_trash';

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
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [...DEFAULT_WORDS];
  } catch { return [...DEFAULT_WORDS]; }
}
// Trả về true/false để nơi gọi biết có thực sự lưu được hay không — tránh báo
// "thành công" trong khi dữ liệu chưa hề được ghi xuống (vd lúc hết quota).
function saveWords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    return true;
  } catch(e) {
    // QuotaExceededError: localStorage đầy (giới hạn ~5-10MB tùy trình duyệt)
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showToast('⚠️ Bộ nhớ đầy! Hãy xuất JSON và xóa bớt từ để tiếp tục.', 'error');
    }
    return false;
  }
}

let words = loadWords();

// ════════════════════════════════════════════════════════
// FOLDERS — nhóm từ thủ công (khác Chủ đề), kiểu thư mục
// ════════════════════════════════════════════════════════
function loadFolders() {
  try {
    const saved = localStorage.getItem(FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function saveFolders() {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showToast('⚠️ Bộ nhớ đầy! Hãy xuất JSON và xóa bớt từ để tiếp tục.', 'error');
    }
    return false;
  }
}

let folders = loadFolders();

// ════════════════════════════════════════════════════════
// TRASH — từ/thư mục đã xóa, khôi phục được (kiểu Thùng rác máy tính)
// entry dạng từ:    { id, type:'word',   deletedAt, word: {...snapshot} }
// entry dạng folder:{ id, type:'folder', deletedAt, folder: {...snapshot}, words: [...snapshot] }
// ════════════════════════════════════════════════════════
function loadTrash() {
  try {
    const saved = localStorage.getItem(TRASH_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function saveTrash() {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
    return true;
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showToast('⚠️ Bộ nhớ đầy! Hãy xuất JSON và xóa bớt từ để tiếp tục.', 'error');
    }
    return false;
  }
}

let trash = loadTrash();
