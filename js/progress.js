// ════════════════════════════════════════════════════════
// PROGRESS
// ════════════════════════════════════════════════════════
function renderProgress() {
  const s = loadStreak();
  const mastered = words.filter(w => w.mastery >= 3).length;
  const qs = parseInt(localStorage.getItem('qs_best_score') || 0);
  document.getElementById('pg-total').textContent = words.length;
  document.getElementById('pg-mastered').textContent = mastered;
  document.getElementById('pg-accuracy').textContent = qs ? qs + '%' : '—';
  document.getElementById('pg-streak').textContent = s.count;

  // Mastery bars
  const cats = [...new Set(words.map(w => w.category || 'Khác'))].sort();
  document.getElementById('mastery-bars').innerHTML = cats.map(c => {
    const cw = words.filter(w => (w.category || 'Khác') === c);
    const avg = cw.reduce((a, b) => a + (b.mastery || 0), 0) / (cw.length || 1);
    const pct = (avg / 3 * 100).toFixed(0);
    return `<div class="mastery-bar-wrap">
      <div class="mastery-bar-label"><span>${escHtml(c)}</span><span>${pct}%</span></div>
      <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

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
