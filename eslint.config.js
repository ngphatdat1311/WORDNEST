'use strict';
const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

// js/*.js không dùng module system — mỗi file được nạp qua 1 thẻ <script>
// riêng trong index.html và tất cả cùng chia sẻ 1 global scope trình duyệt.
// Danh sách dưới đây liệt kê mọi function/const/let khai báo ở top-level
// trong js/*.js, để ESLint coi chúng là tham chiếu hợp lệ tới file khác
// (thay vì báo no-undef hàng loạt) trong khi vẫn bắt được lỗi gõ nhầm tên
// biến không tồn tại ở đâu cả (vd "wrods" thay vì "words").
const appGlobals = Object.fromEntries(
  [
    'BACKUP_DISMISS_DAYS', 'BACKUP_DISMISS_KEY', 'BACKUP_KEY', 'BACKUP_REMINDER_DAYS',
    'CEFR_EASY', 'CEFR_HARD', 'DAILY_ACTIVITY_KEY', 'DAILY_ACTIVITY_MAX_DAYS', 'DEFAULT_WORDS',
    'FOLDERS_KEY', 'LOOKUP_CACHE_KEY', 'LOOKUP_CACHE_MAX', 'LOOKUP_CACHE_TTL_MS', 'POS_LABEL_VI',
    'QUIZ_SESSION_KEY', 'QUIZ_STATS_KEY', 'SPELLING_SESSION_KEY', 'STORAGE_KEY', 'STREAK_KEY',
    'SYNC_FOLDER_KEY', 'SYNC_LAST_TS_KEY', 'PRE_SYNC_BACKUP_KEY', 'THEME_KEY', 'TRASH_KEY', 'TRASH_TTL_MS', 'VI_HINTS',
    'WL_MASTERED_ONLY_KEY', 'WL_PAGE_SIZE', 'WL_SHOWDATE_KEY', '_undoTimer', 'activeWords',
    'addWord', 'answerQuiz', 'applyLookupResult', 'applyTheme', 'assignWordFolders',
    'autoLookupTimer', 'autoSyncWrite', 'awAbortController', 'awAudioUrl', 'awAutoFilledValues',
    'awCurrentAudio', 'awSpeakWord', 'bulkAdd', 'bumpDailyActivity', 'checkSpelling',
    'checkSyncOnStartup', 'clampStr', 'classifyBulkLines', 'clearExtensionInbox', 'clearQuizSession',
    'clearSpellingSession', 'closeBulkDupConfirm', 'closeConfirm', 'closeDuplicateWordConfirm', 'closeEditModal', 'closeFolderBulkModal',
    'closeFolderNameModal', 'closeFolderPicker', 'closeImportConfirm', 'closeWlMoreMenu',
    'commitBulkAdd', 'confirmBulkDuplicates', 'confirmDelete', 'confirmDeleteAll', 'confirmDuplicateWordAdd', 'confirmEmptyTrash', 'confirmReclassifyUnclearWords', 'createFolderPrompt',
    'currentLookupWord', 'daysSince', 'debouncedRenderWordList', 'deleteAllWords', 'deleteFolder',
    'deleteFolderConfirm', 'deleteTrashEntry', 'deleteTrashEntryConfirm', 'deleteWord',
    'disableSync', 'dismissAppUpdateBanner', 'dismissBackupBanner', 'doAutoLookup',
    'doBackupFromBanner', 'doRestoreFromSync', 'doSentenceLookup', 'doShowSection', 'downloadAppUpdate',
    'emptyTrash', 'ensureWordIds', 'ensureWordFolderIds', 'escAttr', 'escHtml', 'estimateLevel',
    'exportAnkiTxt', 'exportCSV', 'exportWords', 'extensionInboxWords', 'fcWords', 'fcIndex',
    'fcSeenThisSession', 'fillField',
    'fetchWordType', 'fetchWordTypeWithRetry', 'filterByFolderSel', 'flipCard', 'folderOptionsHtml',
    'FOLDER_ICON_SVG', 'FOLDER_ICON_SVG_MAC', 'FOLDER_ICON_SVG_WIN', 'folders', 'formatAddedAt', 'formatDuration',
    'genFolderId', 'genTrashId', 'genWordId', 'getAllCategories', 'getAllExamples', 'getCachedLookup',
    'getSrsDueWords', 'getSyncFolder', 'giveHint', 'guessCategory', 'hasUnsavedChanges',
    'hideBackupBanner', 'hideSyncRestoreBanner', 'importWords', 'initFlashcard', 'initSpelling',
    'initSync', 'isStale', 'isTrashEntryExpired', 'lastLookupAllExamples', 'lastLookupDominantPos', 'lastLookupEntry',
    'lastLookupExampleVi', 'lastLookupUsedExamples', 'loadDailyActivity', 'loadFolders',
    'loadLookupCacheRaw', 'loadMoreExamplesFromTatoeba', 'loadQuizStats', 'loadSpellingWord', 'loadStreak', 'loadTrash',
    'loadWords', 'localDateKey', 'looksLikeSentence', 'lookupGen', 'mapPartOfSpeech',
    'markBackedUpNow', 'markCard', 'markSeenCurrent', 'mergeWordFolder', 'migrateKeyIfNeeded', 'nextCard',
    'nextQuiz', 'nextSpelling', 'qzIndex', 'qzScore', 'qzAnswered',
    'spIndex', 'spCorrect', 'spWrong', 'spStreak', 'spHintLevel', 'spRevealed',
    'openAddWordsToFolderModal', 'openEditModal', 'openFolder',
    'openFolderGrid', 'openFolderNameModal', 'openFolderPicker', 'openResetProgressModal', 'confirmResetProgress', 'resetWordMastery', 'RESET_PROGRESS_OPTIONS', 'parseBulkLine', 'parseBulkType', 'BULK_TYPE_ALIASES', 'pickAudio', 'pickDominantPos',
    'pickRandomExample', 'pickSyncFolder', 'playPronunciation', 'populateAwFolderSelects', 'populateCategorySelect',
    'populateFolderSelect', 'prevCard', 'purgeExpiredTrash', 'qzOptions', 'qzWords', 'qzWrongWords',
    'confirmBatchFix', 'startBatchFixProgress', 'runBatchFixLoop', 'showBatchFixResult', 'batchFixRunSeq', 'isBatchFixDialogActive',
    'confirmAutoPhonetic', 'fetchPhoneticForWord', 'fetchPhoneticWithRetry',
    'recordLearningActivity', 'refreshRerollVisibility', 'refreshWlView', 'removeInboxWord',
    'renameFolderPrompt', 'renderActivityHeatmap', 'renderBlanks', 'renderDifficultWords',
    'renderExtensionInbox', 'renderFlashcard', 'renderFolderDetail', 'renderFolderGrid',
    'renderHome', 'renderProgress', 'renderQuizQ', 'renderQuizStats', 'renderSyncStatus',
    'renderTrash', 'renderVocabBreakdown', 'renderWlTableHead', 'renderWordList', 'rerollExample',
    'resetFlipInstant',
    'resetAwExtras', 'resetAddWordForm', 'resetUnsavedAddWordState', 'restartSpelling', 'restoreTrashFolder', 'restoreTrashWord', 'revealWord',
    'saveDailyActivity', 'saveEditWord', 'saveFolders', 'saveLookupCacheRaw', 'saveQuizSession',
    'saveQuizStats', 'saveSpellingSession', 'saveStreak', 'saveTrash', 'saveWords',
    'scheduleAutoLookup', 'setCachedLookup', 'setStatus', 'setSyncFolder', 'setWlFilter',
    'shouldRemindBackup', 'shouldShowSyncBanner', 'showBackupBannerIfNeeded', 'showConfirmDialog', 'showQuizResult',
    'showMacUpdateHintIfNeeded', 'dismissMacUpdateHintBanner', 'MAC_UPDATE_HINT_DISMISSED_KEY',
    'showSection', 'showSyncRestoreBanner', 'showSyncUndoBanner', 'showToast', 'showUndoToast', 'shuffleArr',
    'savePreSyncSnapshot', 'undoSyncRestore',
    'shuffleFlashcard', 'spSessionStarted', 'spWords', 'speak', 'speakSpelling',
    'speakWithBrowserTTS', 'speakWord', 'spellingPool', 'srsDueCount', 'srsInit', 'srsUpdate',
    'startQuiz', 'statusBadge', 'storeGet', 'storeSet', 'streak', 'switchWlView', 'toastTimer',
    'toggleFullscreen', 'toggleSuspend', 'toggleTheme', 'toggleWlMasteredOnly',
    'toggleWlMoreMenu', 'toggleWlShowDate', 'translateText', 'translateWordLikeGoogle', 'trash', 'trashEntryHtml', 'triggerConfetti',
    'tryRestoreQuizSession', 'tryRestoreSpellingSession', 'typeLabel', 'typeAbbr', 'updateBlanks',
    'updateRerollButtonLabel', 'updateSpScore', 'useInboxWord', 'wlActiveFolder', 'wlFolderPage', 'wlComparator',
    'wlFilter', 'wlPage', 'wlRowHtml', 'wlSearchDebounceTimer', 'wlShowDate', 'wlShowMasteredOnly',
    'wireWlRowActions', 'wireStaticEvents', 'on',
    'wlView', 'wordFolders', 'words',
  ].map((name) => [name, 'writable'])
);

module.exports = [
  // tmp-*.mjs/.js ở thư mục gốc: script Playwright dùng tạm để test app thật rồi
  // xóa ngay sau — không phải code của dự án, không cần lint.
  { ignores: ['node_modules/**', 'assets/**', 'css/**', 'docs/**', 'tmp-*.mjs', 'tmp-*.js'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...appGlobals },
    },
    rules: {
      // vars:'local' — không báo "unused" cho function/const/let Ở TOP-LEVEL (đó
      // là scope global thật sự trong sourceType:'script'), vì rất nhiều được gọi
      // từ onclick="..." trong index.html hoặc từ file js/ khác, ESLint chỉ phân
      // tích từng file riêng lẻ nên không thấy được các lượt gọi đó. Vẫn bắt biến
      // cục bộ THẬT SỰ thừa bên trong hàm.
      'no-unused-vars': ['warn', { vars: 'local', args: 'none', varsIgnorePattern: '^_' }],
      // Mỗi file khai báo lại chính các identifier đã liệt kê trong appGlobals ở
      // trên (đó là mục đích của appGlobals — cho các FILE KHÁC tham chiếu tới).
      // Tắt no-redeclare ở đây vì nó luôn báo lỗi cho chính file khai báo gốc.
      'no-redeclare': 'off',
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: ['extension/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  prettierConfig,
];
