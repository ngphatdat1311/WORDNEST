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

  // Mastery bars
  const cats = [...new Set(words.map(w => w.category || 'Khác'))].sort();
  document.getElementById('mastery-bars').innerHTML = cats.length
    ? cats.map(c => {
        const cw = words.filter(w => (w.category || 'Khác') === c);
        const avg = cw.reduce((a, b) => a + (b.mastery || 0), 0) / cw.length;
        const pct = (avg / 3 * 100).toFixed(0);
        return `<div class="mastery-bar-wrap">
          <div class="mastery-bar-label"><span>${escHtml(c)}</span><span>${pct}%</span></div>
          <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);font-size:0.85rem;">Chưa có từ nào.</p>';

  renderVocabBreakdown();
  renderDifficultWords();

  // SRS info
  const today = new Date().toISOString().slice(0,10);
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

  levelEl.innerHTML = levels.map(l => {
    const cnt = words.filter(w => w.level === l.key).length;
    const pct = Math.round(cnt / total * 100);
    return `<div class="mastery-bar-wrap">
      <div class="mastery-bar-label"><span>${l.label}</span><span>${cnt} từ (${pct}%)</span></div>
      <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%;background:${l.color}"></div></div>
    </div>`;
  }).join('');

  typeEl.innerHTML = types.map(t => {
    const cnt = words.filter(w => (w.type || 'other') === t.key).length;
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
      <button class="speak-btn" onclick="speak('${escAttr(w.word)}')" title="Phát âm" style="flex-shrink:0;width:30px;height:30px;font-size:0.85rem;">🔊</button>
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
  const todayKey = today.toISOString().slice(0, 10);

  const TOTAL_DAYS = 371; // 53 tuần
  const start = new Date(today.getTime() - (TOTAL_DAYS - 1) * 86400000);
  start.setDate(start.getDate() - start.getDay()); // lùi về Chủ Nhật gần nhất để cột thẳng theo tuần thực tế

  const max = Math.max(1, ...Object.values(dailyMap));

  // Gom hết vào 1 DocumentFragment rồi append 1 lần — tránh 371 lần reflow
  // riêng lẻ (mỗi appendChild trực tiếp vào DOM đang gắn cây có thể trigger
  // tính toán layout/style lại) khi mở tab Tiến độ.
  const frag = document.createDocumentFragment();
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
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
