// ════════════════════════════════════════════════════════
// PROGRESS
// ════════════════════════════════════════════════════════
function renderProgress() {
  const s = loadStreak();
  const mastered = words.filter(w => w.mastery >= 3).length;
  const qs = parseInt(storeGet('qs_best_score') || 0);
  document.getElementById('pg-total').textContent = words.length;
  document.getElementById('pg-mastered').textContent = mastered;
  document.getElementById('pg-accuracy').textContent = qs ? qs + '%' : '—';
  document.getElementById('pg-streak').textContent = s.count;

  renderQuizStats();

  // Mastery bars — gom nhóm 1 lần bằng reduce thay vì filter() lại toàn bộ words cho mỗi category
  const catStats = {};
  words.forEach(w => {
    const c = w.category || 'Khác';
    const st = catStats[c] || (catStats[c] = { sum: 0, count: 0 });
    st.sum += (w.mastery || 0);
    st.count++;
  });
  const cats = Object.keys(catStats).sort();
  document.getElementById('mastery-bars').innerHTML = cats.length
    ? cats.map(c => {
        const { sum, count } = catStats[c];
        const pct = (sum / count / 3 * 100).toFixed(0);
        return `<div class="mastery-bar-wrap">
          <div class="mastery-bar-label"><span>${escHtml(c)}</span><span>${pct}%</span></div>
          <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);font-size:0.85rem;">Chưa có từ nào.</p>';

  renderVocabBreakdown();
  renderDifficultWords();

  // SRS info
  const today = localDateKey();
  const srsDue = words.filter(w => !w.srsDue || w.srsDue <= today).length;
  const srsScheduled = words.filter(w => w.srsDue && w.srsDue > today).length;
  const srsNew = words.filter(w => !w.srsDue).length;
  const srsEl = document.getElementById('srs-info');
  if (srsEl) {
    srsEl.innerHTML = `
      <div class="prog-card" style="flex:1;min-width:120px;">
        <div class="pc-icon">📅</div>
        <div class="pc-val" style="color:var(--gold)">${srsDue}</div>
        <div class="pc-label">Đến hạn hôm nay</div>
      </div>
      <div class="prog-card" style="flex:1;min-width:120px;">
        <div class="pc-icon">⏳</div>
        <div class="pc-val">${srsScheduled}</div>
        <div class="pc-label">Đã lên lịch</div>
      </div>
      <div class="prog-card" style="flex:1;min-width:120px;">
        <div class="pc-icon">🆕</div>
        <div class="pc-val">${srsNew}</div>
        <div class="pc-label">Chưa ôn lần nào</div>
      </div>
    `;
  }

  renderActivityHeatmap();
}

function renderQuizStats() {
  const el = document.getElementById('quiz-stats-grid');
  if (!el) return;
  const st = loadQuizStats();
  const overallPct = st.totalQ > 0 ? Math.round(st.totalCorrect / st.totalQ * 100) : null;
  const best = parseInt(storeGet('qs_best_score') || 0);
  el.innerHTML = `
    <div class="prog-card" style="flex:1;min-width:120px;">
      <div class="pc-icon">🎮</div>
      <div class="pc-val">${st.sessions || 0}</div>
      <div class="pc-label">Số lần chơi</div>
    </div>
    <div class="prog-card" style="flex:1;min-width:120px;">
      <div class="pc-icon">❓</div>
      <div class="pc-val">${st.totalQ || 0}</div>
      <div class="pc-label">Tổng câu hỏi</div>
    </div>
    <div class="prog-card" style="flex:1;min-width:120px;">
      <div class="pc-icon">✅</div>
      <div class="pc-val" style="color:var(--green)">${overallPct !== null ? overallPct + '%' : '—'}</div>
      <div class="pc-label">Độ chính xác TB</div>
    </div>
    <div class="prog-card" style="flex:1;min-width:120px;">
      <div class="pc-icon">🏆</div>
      <div class="pc-val" style="color:var(--gold)">${best ? best + '%' : '—'}</div>
      <div class="pc-label">Kỷ lục cao nhất</div>
    </div>
  `;
}

function renderVocabBreakdown() {
  const levelEl = document.getElementById('vocab-level-bars');
  const typeEl = document.getElementById('vocab-type-bars');
  if (!levelEl || !typeEl) return;

  const levels = [
    { key: 'easy',   label: 'Dễ (A1–A2)',    color: 'var(--green)' },
    { key: 'medium', label: 'Trung bình (B1–B2)', color: 'var(--gold)' },
    { key: 'hard',   label: 'Khó (C1–C2)',    color: 'var(--accent)' },
  ];
  const types = [
    { key: 'noun',   label: 'Danh từ' },
    { key: 'verb',   label: 'Động từ' },
    { key: 'adj',    label: 'Tính từ' },
    { key: 'adv',    label: 'Trạng từ' },
    { key: 'phrase', label: 'Cụm từ' },
    { key: 'other',  label: 'Khác' },
  ];

  const total = words.length || 1;

  // Đếm 1 lần duy nhất qua words thay vì filter() riêng cho từng level/type (9 lượt duyệt trước đây)
  const levelCounts = {}, typeCounts = {};
  words.forEach(w => {
    levelCounts[w.level] = (levelCounts[w.level] || 0) + 1;
    const t = w.type || 'other';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  levelEl.innerHTML = levels.map(l => {
    const cnt = levelCounts[l.key] || 0;
    const pct = Math.round(cnt / total * 100);
    return `<div class="mastery-bar-wrap">
      <div class="mastery-bar-label"><span>${l.label}</span><span>${cnt} từ (${pct}%)</span></div>
      <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%;background:${l.color}"></div></div>
    </div>`;
  }).join('');

  typeEl.innerHTML = types.map(t => {
    const cnt = typeCounts[t.key] || 0;
    if (!cnt) return '';
    const pct = Math.round(cnt / total * 100);
    return `<div class="mastery-bar-wrap">
      <div class="mastery-bar-label"><span>${t.label}</span><span>${cnt} từ (${pct}%)</span></div>
      <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') || '<p style="color:var(--text3);font-size:0.85rem;">Chưa có từ nào.</p>';
}

function renderDifficultWords() {
  const el = document.getElementById('difficult-words-list');
  if (!el) return;

  // Từ "khó nhớ": đã xem ít nhất 3 lần, mastery <= 1, tỷ lệ sai cao nhất
  const difficult = words
    .filter(w => (w.seen || 0) >= 3 && (w.mastery || 0) <= 1 && !w.suspended)
    .map(w => ({ ...w, failRate: 1 - (w.known || 0) / (w.seen || 1) }))
    .sort((a, b) => b.failRate - a.failRate || b.seen - a.seen)
    .slice(0, 8);

  if (!difficult.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Chưa có đủ dữ liệu — hãy luyện Flashcard thêm để xem phân tích.</p>';
    return;
  }

  el.innerHTML = difficult.map(w => {
    const failPct = Math.round(w.failRate * 100);
    return `<div class="diff-word-row">
      <button class="speak-btn" data-word="${escAttr(w.word)}" title="Phát âm" style="flex-shrink:0;width:30px;height:30px;font-size:0.85rem;">🔊</button>
      <div style="flex:1;min-width:0;">
        <div class="diff-word-name">${escHtml(w.word)} <span class="diff-phonetic">${escHtml(w.phonetic || '')}</span></div>
        <div class="diff-word-meaning">${escHtml(w.meaning)}</div>
      </div>
      <div class="diff-word-meta">
        <span class="diff-seen">${w.seen} lần xem</span>
        <span class="diff-fail" title="Tỷ lệ chưa thuộc">${failPct}% chưa thuộc</span>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('.speak-btn').forEach(btn => btn.addEventListener('click', () => speak(btn.dataset.word)));
}

// ════════════════════════════════════════════════════════
// ACTIVITY HEATMAP — kiểu GitHub: ~53 tuần x 7 ngày, tô đậm/nhạt theo số
// lượt học thật trong ngày (wordnest_daily_activity), không phải chỉ
// "có học hay không" như streak.
// ════════════════════════════════════════════════════════
function renderActivityHeatmap() {
  const grid = document.getElementById('activity-grid');
  if (!grid) return;
  const dailyMap = loadDailyActivity();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);

  const TOTAL_DAYS = 371; // 53 tuần
  const start = new Date(today.getTime() - (TOTAL_DAYS - 1) * 86400000);
  start.setDate(start.getDate() - start.getDay()); // lùi về Chủ Nhật gần nhất để cột thẳng theo tuần thực tế

  const max = Math.max(1, ...Object.values(dailyMap));

  // Gom hết vào 1 DocumentFragment rồi append 1 lần — tránh 371 lần reflow
  // riêng lẻ (mỗi appendChild trực tiếp vào DOM đang gắn cây có thể trigger
  // tính toán layout/style lại) khi mở tab Tiến độ.
  const frag = document.createDocumentFragment();
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = localDateKey(d);
    const div = document.createElement('div');
    if (key > todayKey) {
      div.className = 'activity-day future';
    } else {
      const count = dailyMap[key] || 0;
      let level = '';
      if (count > 0) {
        const ratio = count / max;
        level = ratio > 0.66 ? 'l3' : ratio > 0.33 ? 'l2' : 'l1';
      }
      div.className = 'activity-day ' + level;
      div.title = key + (count ? ` — ${count} lượt học` : ' — không học');
    }
    frag.appendChild(div);
  }
  grid.innerHTML = '';
  grid.appendChild(frag);
}

// ════════════════════════════════════════════════════════
// ĐẶT LẠI TIẾN ĐỘ HỌC TẬP — reset có chọn lọc từng mảng số liệu, không đụng
// tới danh sách từ vựng/thư mục/thùng rác. Có Hoàn tác 5 giây như sửa từ.
// ════════════════════════════════════════════════════════

// Hàm thuần: trả về bản sao 1 từ đã đặt lại mastery/known/seen + lịch ôn SRS
// về trạng thái ban đầu (giống srsInit() cho từ mới) — tách riêng để test độc lập.
function resetWordMastery(w) {
  return { ...w, mastery: 0, known: 0, seen: 0, srsInterval: 1, srsEF: 2.5, srsDue: localDateKey() };
}

const RESET_PROGRESS_OPTIONS = [
  { id: 'rp-mastery', label: 'Mức độ thành thạo từ vựng (kèm lịch ôn SRS)' },
  { id: 'rp-quiz', label: 'Thống kê & điểm cao nhất Quiz' },
  { id: 'rp-streak', label: 'Chuỗi ngày học liên tiếp' },
  { id: 'rp-heatmap', label: 'Hoạt động trong năm (heatmap)' },
];

function openResetProgressModal() {
  const old = document.getElementById('delete-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'delete-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cb-dialog-title');
  const rowsHtml = RESET_PROGRESS_OPTIONS.map(o => `
    <label class="ew-suspend-label" style="margin-bottom:8px;">
      <input type="checkbox" id="${o.id}">
      <span>${escHtml(o.label)}</span>
    </label>`).join('');
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="cb-icon">🔄</div>
      <div class="cb-title" id="cb-dialog-title">Đặt lại tiến độ học tập</div>
      <div class="cb-sub">Chọn phần muốn xóa sạch. Không đụng tới danh sách từ vựng/thư mục/thùng rác. Có thể hoàn tác trong 5 giây sau khi xác nhận.</div>
      <div style="text-align:left;margin-bottom:1.2rem;">${rowsHtml}</div>
      <div class="cb-btns">
        <button class="cb-cancel" id="cb-cancel-btn">Hủy</button>
        <button class="cb-confirm" id="cb-confirm-btn">Đặt lại</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('cb-confirm-btn').addEventListener('click', confirmResetProgress);
  document.getElementById('cb-cancel-btn').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);
}

function confirmResetProgress() {
  const checked = {};
  let anyChecked = false;
  RESET_PROGRESS_OPTIONS.forEach(o => {
    const el = document.getElementById(o.id);
    checked[o.id] = !!(el && el.checked);
    if (checked[o.id]) anyChecked = true;
  });
  if (!anyChecked) { showToast('Chọn ít nhất 1 mục để đặt lại!', 'error'); return; }

  // Snapshot toàn bộ (dù có chọn hay không) để Hoàn tác luôn khôi phục đúng —
  // đơn giản hơn phải theo dõi riêng từng phần đã đổi.
  const snapshot = {
    words: words.map(w => ({ ...w })),
    quizStats: loadQuizStats(),
    bestScore: storeGet('qs_best_score'),
    streak: loadStreak(),
    dailyActivity: loadDailyActivity(),
  };

  // Kiểm tra đủ cả 4 phần (không chỉ riêng mastery như trước) — 1 thao tác "đặt
  // lại" nên coi là trọn gói, lỡ 1 phần ghi lỗi (đầy đĩa, mất quyền...) mà vẫn
  // báo "thành công" thì user sẽ tưởng nhầm đã đặt lại trong khi dữ liệu trên
  // đĩa không đổi thật, dễ gây hiểu lầm khi mở lại app sau này.
  const backupWords = words;
  const backupStreak = streak;
  let ok = true;

  if (checked['rp-mastery']) {
    words = words.map(resetWordMastery);
    if (!saveWords()) ok = false;
  }
  if (ok && checked['rp-quiz']) {
    if (!saveQuizStats({ sessions: 0, totalQ: 0, totalCorrect: 0 }) || !storeSet('qs_best_score', '0')) ok = false;
  }
  if (ok && checked['rp-streak']) {
    const newStreak = { count: 0, last: null, history: [] };
    if (saveStreak(newStreak)) streak = newStreak; else ok = false;
  }
  if (ok && checked['rp-heatmap']) {
    if (!saveDailyActivity({})) ok = false;
  }

  if (!ok) {
    // Rollback toàn bộ, kể cả phần đã lỡ ghi thành công trước khi gặp lỗi.
    // Tự kiểm tra luôn KẾT QUẢ của chính các lần ghi rollback này — nếu lỗi đĩa
    // vẫn còn đó, ghi rollback cũng có thể lỗi theo, và báo "không đặt lại được"
    // trong khi thật ra 1 phần đã bị đổi thật trên đĩa sẽ gây hiểu lầm y hệt bug
    // ban đầu. Không thể đảm bảo chắc chắn 100% (ghi lỗi thì rollback cũng có thể
    // lỗi), nhưng ít nhất báo đúng khi phát hiện được.
    words = backupWords; const rb1 = saveWords();
    streak = backupStreak; const rb2 = saveStreak(streak);
    const rb3 = saveQuizStats(snapshot.quizStats);
    const rb4 = storeSet('qs_best_score', snapshot.bestScore || '0');
    const rb5 = saveDailyActivity(snapshot.dailyActivity);
    const rolledBackOk = rb1 && rb2 && rb3 && rb4 && rb5;
    showToast(
      rolledBackOk
        ? '⚠️ Không đặt lại được — lỗi lưu dữ liệu!'
        : '⚠️ Lỗi lưu dữ liệu — vài phần có thể chưa được khôi phục đúng, hãy khởi động lại app để kiểm tra!',
      'error'
    );
    return;
  }

  closeConfirm();
  renderProgress();
  renderHome();
  const sc = document.getElementById('streak-count');
  if (sc) sc.textContent = streak.count;

  showUndoToast('✅ Đã đặt lại tiến độ đã chọn', () => {
    // Cùng nguyên tắc check-all-saves ở trên: đừng báo "Đã hoàn tác!" nếu ghi
    // đĩa lỗi — nếu không app sẽ hiện đúng bug đã sửa ở nhánh đặt lại (giờ chỉ
    // là bug xảy ra ở chiều ngược lại, lúc Hoàn tác thay vì lúc Đặt lại).
    const resetWords = words, resetStreak = streak;
    words = snapshot.words;
    let uOk = saveWords();
    uOk = saveQuizStats(snapshot.quizStats) && uOk;
    uOk = storeSet('qs_best_score', snapshot.bestScore || '0') && uOk;
    streak = snapshot.streak;
    uOk = saveStreak(streak) && uOk;
    uOk = saveDailyActivity(snapshot.dailyActivity) && uOk;

    if (!uOk) {
      // Ghi lỗi giữa chừng -> thử ghi lại đúng trạng thái ĐÃ ĐẶT LẠI (trạng thái
      // thật sự đang nằm trên đĩa trước khi bấm Hoàn tác), để bộ nhớ khớp đĩa —
      // best-effort, không đảm bảo 100% nếu lỗi đĩa vẫn còn (xem comment rollback ở trên).
      words = resetWords; saveWords();
      streak = resetStreak; saveStreak(streak);
      saveQuizStats({ sessions: 0, totalQ: 0, totalCorrect: 0 });
      storeSet('qs_best_score', '0');
      saveDailyActivity({});
    }

    renderProgress();
    renderHome();
    const sc2 = document.getElementById('streak-count');
    if (sc2) sc2.textContent = streak.count;
    showToast(uOk ? '↩️ Đã hoàn tác!' : '⚠️ Hoàn tác thất bại — lỗi lưu dữ liệu!', uOk ? 'success' : 'error');
  });
}
