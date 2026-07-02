// ════════════════════════════════════════════════════════
// EVENT WIRING — nối các phần tử TĨNH trong index.html tới hàm xử lý, thay
// cho onclick="..."/oninput="..."/onchange="..." trực tiếp trong HTML (đã bỏ
// để có thể tắt 'unsafe-inline' trong script-src của CSP). Phần tử render
// ĐỘNG (dòng từ điển, thẻ thư mục, thùng rác...) tự nối listener ngay trong
// hàm render của chúng ở các file js/ khác, không nằm ở đây.
// ════════════════════════════════════════════════════════
function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

function wireStaticEvents() {
  on('theme-toggle', 'click', toggleTheme);
  on('fs-btn', 'click', toggleFullscreen);

  on('nav-home', 'click', () => showSection('home'));
  on('nav-flashcard', 'click', () => showSection('flashcard'));
  on('nav-quiz', 'click', () => showSection('quiz'));
  on('nav-spelling', 'click', () => showSection('spelling'));
  on('nav-wordlist', 'click', () => showSection('wordlist'));
  on('nav-progress', 'click', () => showSection('progress'));
  on('nav-add', 'click', () => showSection('add'));

  on('backup-do-btn', 'click', doBackupFromBanner);
  on('backup-close-btn', 'click', dismissBackupBanner);
  on('app-update-btn', 'click', downloadAppUpdate);
  on('app-update-close-btn', 'click', dismissAppUpdateBanner);
  on('sync-restore-close-btn', 'click', hideSyncRestoreBanner);

  on('mac-update-hint-open-btn', 'click', () => window.electronAPI?.openReleasesPage());
  on('mac-update-hint-close-btn', 'click', dismissMacUpdateHintBanner);

  on('home-srs-card', 'click', () => showSection('flashcard'));
  on('action-flashcard', 'click', () => showSection('flashcard'));
  on('action-quiz', 'click', () => showSection('quiz'));
  on('action-spelling', 'click', () => showSection('spelling'));
  on('action-wordlist', 'click', () => showSection('wordlist'));

  // initFlashcard(shuffle=false) — không dùng tham chiếu hàm trực tiếp vì
  // addEventListener tự truyền Event làm đối số đầu, sẽ đè lên default shuffle=false.
  on('fc-category', 'change', () => initFlashcard());
  on('fc-tag', 'change', () => initFlashcard());
  on('fc-folder', 'change', () => initFlashcard());
  on('fc-shuffle-btn', 'click', shuffleFlashcard);
  on('fc-reset-btn', 'click', () => initFlashcard(false));
  on('flashcard', 'click', flipCard);
  on('fc-speak-btn', 'click', speakWord); // speakWord(e) tự dùng e.stopPropagation()
  on('fc-prev', 'click', prevCard);
  on('fc-next', 'click', nextCard);
  on('fc-mark-no-btn', 'click', () => markCard(false));
  on('fc-mark-yes-btn', 'click', () => markCard(true));

  on('qz-restart-btn', 'click', startQuiz);
  on('qz-speak-btn', 'click', () => speak(document.getElementById('qz-word').textContent));
  on('qz-next', 'click', nextQuiz);
  on('qz-replay-btn', 'click', startQuiz);
  on('qz-view-progress-btn', 'click', () => showSection('progress'));

  on('sp-restart-card', 'click', restartSpelling);
  on('sp-input', 'input', updateBlanks);
  on('sp-hint-btn', 'click', giveHint);
  on('sp-speak-btn', 'click', speakSpelling);
  on('sp-reveal-btn', 'click', revealWord);
  on('sp-check-btn', 'click', checkSpelling);
  on('sp-next', 'click', nextSpelling);

  on('wl-tab-all', 'click', () => switchWlView('all'));
  on('wl-tab-folders', 'click', () => switchWlView('folders'));
  on('wl-tab-trash', 'click', () => switchWlView('trash'));
  on('wl-search', 'input', debouncedRenderWordList);
  on('wl-add-word-btn', 'click', () => showSection('add'));
  on('wl-sort', 'change', () => { wlPage = 1; renderWordList(true); });
  on('wl-showdate-btn', 'click', toggleWlShowDate);
  document.querySelectorAll('.wl-mastered-only-btn').forEach(el => el.addEventListener('click', toggleWlMasteredOnly));
  on('wl-more-btn', 'click', toggleWlMoreMenu); // toggleWlMoreMenu(e) tự dùng e.stopPropagation()
  on('wl-export-json-btn', 'click', () => { exportWords(); closeWlMoreMenu(); });
  on('wl-export-csv-btn', 'click', () => { exportCSV(); closeWlMoreMenu(); });
  on('wl-export-anki-btn', 'click', () => { exportAnkiTxt(); closeWlMoreMenu(); });
  on('import-file', 'change', (e) => { importWords(e); closeWlMoreMenu(); });
  on('wl-delete-all-btn', 'click', () => { confirmDeleteAll(); closeWlMoreMenu(); });
  on('wl-folder-back-btn', 'click', openFolderGrid);
  on('wl-folder-sort', 'change', renderFolderDetail);
  on('wl-trash-empty-btn', 'click', confirmEmptyTrash);

  on('sync-pick-folder-btn', 'click', pickSyncFolder);
  on('sync-disable-btn', 'click', disableSync);

  on('inbox-clear-btn', 'click', clearExtensionInbox);

  on('aw-word', 'input', scheduleAutoLookup);
  on('aw-speak-btn', 'click', playPronunciation);
  on('aw-reroll-example-btn', 'click', rerollExample);
  on('aw-submit-btn', 'click', addWord);
  on('aw-bulk-submit-btn', 'click', bulkAdd);
}

document.addEventListener('DOMContentLoaded', wireStaticEvents);
