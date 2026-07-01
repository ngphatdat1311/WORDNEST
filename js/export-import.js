// ════════════════════════════════════════════════════════
// EXPORT / IMPORT — backup & restore
// ════════════════════════════════════════════════════════
function exportWords() {
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    words: words,
    folders: folders,
    trash: trash
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wordnest-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  markBackedUpNow(); // export thủ công cũng tính là đã backup, reset luôn bộ đếm nhắc nhở
  showToast('✅ Đã xuất ' + words.length + ' từ!', 'success');
}

function importWords(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let imported = Array.isArray(data) ? data : (data.words || []);
      // folderId trong file là id của thư mục ở MÁY KHÁC -> chỉ map được qua tên,
      // không thể dùng trực tiếp (id có thể trùng tình cờ với 1 thư mục khác ở đây).
      const importedFolders = Array.isArray(data.folders) ? data.folders : [];
      const importedFolderNameById = {};
      importedFolders.forEach(f => { if (f && f.id && f.name) importedFolderNameById[f.id] = f.name; });
      if (!Array.isArray(imported) || !imported.length) throw new Error('Không có từ nào');
      imported = imported
        .filter(w => w && typeof w.word === 'string' && typeof w.meaning === 'string')
        // File import không qua maxlength của <input> nào cả -> phải tự giới hạn ở đây,
        // tránh 1 entry dữ liệu rác (vd hàng chục nghìn ký tự) làm vỡ layout/phình localStorage.
        .map(w => ({
          ...w,
          word: clampStr(w.word, 60),
          meaning: clampStr(w.meaning, 200),
          phonetic: clampStr(w.phonetic || '', 80),
          example: clampStr(w.example || '', 300),
          category: clampStr(w.category || '', 50),
        }))
        .filter(w => w.word && w.meaning); // loại bỏ luôn nếu sau khi cắt mà rỗng (vd word toàn khoảng trắng)

      // Tính trước số từ mới / trùng để hiện trong confirm dialog
      let toAdd = [], skipped = 0;
      imported.forEach(w => {
        if (words.find(x => x.word.toLowerCase() === w.word.toLowerCase())) { skipped++; }
        else { toAdd.push(w); }
      });

      if (!toAdd.length) {
        showToast(`⚠️ Tất cả ${skipped} từ đã tồn tại, không có gì để nhập!`, '');
        event.target.value = '';
        return;
      }

      // Hiện confirm dialog với thông tin preview
      const old = document.getElementById('import-confirm-overlay');
      if (old) old.remove();
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.id = 'import-confirm-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'import-dialog-title');
      overlay.innerHTML = `
        <div class="confirm-box">
          <div class="cb-icon">📥</div>
          <div class="cb-title" id="import-dialog-title">Xác nhận nhập từ</div>
          <div class="cb-word">${escHtml(file.name)}</div>
          <div class="cb-sub">
            Sẽ thêm <strong>${toAdd.length}</strong> từ mới vào kho của bạn.
            ${skipped ? `<br>Bỏ qua <strong>${skipped}</strong> từ đã tồn tại.` : ''}
            <br><br>Bạn có muốn tiếp tục không?
          </div>
          <div class="cb-btns">
            <button class="cb-cancel" onclick="closeImportConfirm()">Hủy</button>
            <button class="cb-confirm" id="import-confirm-btn">Nhập ${toAdd.length} từ</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', ev => { if (ev.target === overlay) closeImportConfirm(); });
      setTimeout(() => { const btn = overlay.querySelector('.cb-cancel'); if (btn) btn.focus(); }, 50);

      document.getElementById('import-confirm-btn').addEventListener('click', () => {
        closeImportConfirm();
        const backupWords = words, backupFolders = folders, backupTrash = trash;
        words = [...words];
        folders = [...folders];
        // Thùng rác chỉ gộp thêm (best-effort), không khôi phục tự động — đổi id mới
        // để tránh đụng id trùng với thùng rác hiện có trên máy này.
        if (Array.isArray(data.trash)) {
          trash = [...trash, ...data.trash.map(t => ({ ...t, id: genTrashId() }))];
        }
        // Map id thư mục bên file -> id thư mục cục bộ (ghép theo tên, trùng tên thì dùng lại,
        // chưa có thì tạo mới) — cache lại để 1 thư mục chỉ phải tra/tạo 1 lần dù nhiều từ dùng chung.
        const folderIdCache = {};
        function resolveImportedFolder(oldId) {
          if (!oldId) return null;
          if (folderIdCache[oldId] !== undefined) return folderIdCache[oldId];
          const name = importedFolderNameById[oldId];
          if (!name) return (folderIdCache[oldId] = null);
          let local = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
          if (!local) { local = { id: genFolderId(), name, createdAt: Date.now() }; folders.push(local); }
          return (folderIdCache[oldId] = local.id);
        }
        let added = 0;
        toAdd.forEach(w => {
          words.push(srsInit({
            word: w.word, phonetic: w.phonetic||'', meaning: w.meaning,
            example: w.example||'', type: w.type||'other', category: w.category||'Nhập',
            level: w.level||'medium', mastery: w.mastery||0, known: w.known||0, seen: w.seen||0,
            addedAt: w.addedAt || Date.now(), folderId: resolveImportedFolder(w.folderId)
          }));
          added++;
        });
        if (!saveWords() || !saveFolders() || !saveTrash()) { words = backupWords; folders = backupFolders; trash = backupTrash; showToast('⚠️ Không nhập được — lỗi lưu dữ liệu (có thể do hết bộ nhớ)!', 'error'); return; }
        refreshWlView(); renderHome();
        showToast(`✅ Nhập ${added} từ mới${skipped ? ', bỏ qua ' + skipped + ' từ trùng' : ''}!`, 'success');
      });

    } catch(err) {
      showToast('❌ File không hợp lệ: ' + err.message, 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}
function closeImportConfirm() { const el = document.getElementById('import-confirm-overlay'); if (el) el.remove(); }

// ════════════════════════════════════════════════════════
// EXPORT CSV
// ════════════════════════════════════════════════════════
function exportCSV() {
  function csvCell(v) {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const header = ['word','phonetic','meaning','example','type','category','level','mastery'];
  const rows = words.map(w => [
    w.word, w.phonetic||'', w.meaning, w.example||'',
    w.type||'other', w.category||'', w.level||'medium', w.mastery||0
  ].map(csvCell).join(','));
  const csv = '﻿' + [header.join(','), ...rows].join('\r\n'); // BOM giúp Excel mở đúng UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wordnest-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ Đã xuất CSV ' + words.length + ' từ!', 'success');
}

// ════════════════════════════════════════════════════════
// EXPORT ANKI (tab-separated .txt — Anki import trực tiếp được)
// ════════════════════════════════════════════════════════
function exportAnkiTxt() {
  const lines = [
    '#separator:Tab',
    '#html:true',
    '#notetype:Basic',
    '#deck:WordNest',
    '#tags column:5',
    ''
  ];
  words.forEach(w => {
    const front = escHtml(w.word) +
      (w.phonetic ? `<br><small style="color:#888">${escHtml(w.phonetic)}</small>` : '');
    const back  = `<b>${escHtml(w.meaning)}</b>` +
      (w.example ? `<br><i>${escHtml(w.example)}</i>` : '');
    const tags  = (w.category || '').replace(/\s+/g, '_');
    lines.push([front, back, '', '', tags].join('\t'));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wordnest-anki-' + new Date().toISOString().slice(0,10) + '.txt';
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ Đã xuất Anki ' + words.length + ' từ!', 'success');
}
