# WordNest — ghi chú cho Claude Code

Ứng dụng Electron học từ vựng tiếng Anh cá nhân (Flashcard SRS, Quiz, Chính
tả, Từ điển). Xem [README.md](README.md) để biết tính năng theo góc nhìn
người dùng. File này chỉ ghi lại **kiến trúc và quy ước** cần biết trước khi
sửa code, để không vi phạm những ràng buộc không hiển nhiên từ việc đọc lướt.

## Kiến trúc — KHÔNG có module system

`js/*.js` là JavaScript thuần, không dùng ES modules/CommonJS/bundler. Mỗi
file nạp qua 1 thẻ `<script>` riêng trong `index.html` (xem thứ tự ở cuối
file đó) và TẤT CẢ cùng chia sẻ 1 global scope trình duyệt — hàm ở file A gọi
thẳng hàm/biến ở file B mà không cần import gì cả.

- **Thứ tự `<script>` chỉ quan trọng cho code chạy NGAY khi file được nạp**
  (vd `let words = loadWords();` ở top-level của `storage.js`). Hàm chỉ được
  gọi sau này từ event handler (tức đa số code trong app) — thứ tự nạp không
  quan trọng, vì lúc đó mọi file đã nạp xong. Codebase đã tận dụng điều này ở
  nhiều chỗ (vd `folders.js`/`trash.js` gọi `closeConfirm()` dù hàm đó định
  nghĩa ở `word-crud.js`, nạp SAU).
- **`eslint.config.js` có `appGlobals`** — liệt kê THỦ CÔNG mọi
  function/const/let top-level trong `js/*.js`, để ESLint không báo `no-undef`
  khi file A dùng identifier định nghĩa ở file B. **Thêm bất kỳ hàm/hằng số
  top-level mới nào cũng phải thêm tên vào danh sách này** (thứ tự trong danh
  sách không nghiêm ngặt, chỉ cần có mặt), nếu không CI (`npm run lint`) sẽ
  fail. Đây là điểm dễ quên nhất khi thêm code mới vào file khác với nơi bạn
  quen sửa.
- `electron/pure.js` là ngoại lệ DUY NHẤT có `module.exports` — chỉ dùng
  `fs`/`path` (không đụng `electron`) để `tests/electron-pure.test.js`
  `require()` được trực tiếp trong Node thường (xem comment đầu file đó).

## Lưu trữ dữ liệu

Không có database. Mỗi "bảng" là 1 biến toàn cục (`words`, `folders`, `trash`,
`streak`...) lưu xuống 1 file JSON riêng trong `userData` của Electron (qua
`storeGet`/`storeSet` ở `js/storage.js` → IPC `store-read`/`store-write` ở
`electron/main.js`), fallback `localStorage` khi chạy web thường (không phải
Electron). Ghi file dùng `atomicWriteFileSync` (`electron/pure.js`) — ghi file
tạm rồi rename đè, KHÔNG bao giờ quay lại `fs.writeFileSync` thẳng vào file dữ
liệu (rủi ro hỏng file nếu crash giữa lúc ghi).

- `words[]`: mỗi từ có `id` ổn định (dùng cho mọi thao tác CRUD, KHÔNG so
  khớp theo chuỗi `word` — chuỗi đó chỉ đảm bảo duy nhất, không ổn định khi
  đổi tên) và `folderIds[]` (1 từ thuộc được NHIỀU thư mục cùng lúc).
- Quy ước rollback khi ghi đĩa lỗi, lặp lại ở khắp `word-crud.js`/`folders.js`/
  `trash.js`: `const backup = X; X = newValue; if (!saveX()) { X = backup;
  showToast('lỗi'); return; }`. Giữ đúng pattern này khi thêm thao tác ghi mới.

## Quy ước UI đã thiết lập — tái dùng thay vì viết lại

- **Escape XSS**: MỌI chuỗi động chèn vào `innerHTML` phải qua `escHtml()`
  (nội dung text) hoặc `escAttr()` (giá trị attribute HTML) — `js/utils.js`.
- **Hộp thoại xác nhận đơn giản** (1 hành động, Hủy/Xác nhận): dùng
  `showConfirmDialog(cfg)` (`js/word-crud.js`, cạnh `closeConfirm()`) thay vì
  tự dựng overlay mới — xem cfg shape trong comment của hàm. Không dùng cho
  dialog nhiều giai đoạn (`confirmBatchFix`) hay có input/checkbox phức tạp
  (`openFolderNameModal`, `openFolderPicker`) — những cái đó cố tình tự quản
  lý overlay riêng.
- **KHÔNG dùng `confirm()`/`alert()`/`prompt()` gốc trình duyệt** — mọi xác
  nhận phải qua modal tự vẽ (nhất quán giao diện, dịch được, không chặn cứng
  main thread). Xem `showSection()` ở `js/navigation.js` làm ví dụ chuyển từ
  `confirm()` sang `showConfirmDialog()` bất đồng bộ.
- **Toast hoàn tác**: sửa/xóa có thể hoàn tác trong 5s dùng `showUndoToast(msg,
  onUndo)` (`js/word-crud.js`).
- **Không có onclick/oninput inline trong HTML** — CSP `script-src 'self'`
  không cho `unsafe-inline`. Mọi wiring qua `addEventListener`: phần tử TĨNH
  trong `index.html` nối ở `js/event-wiring.js`; phần tử render ĐỘNG (dòng
  bảng, thẻ thư mục...) tự nối listener ngay trong hàm render của chúng.

## Testing

`node --test` (không cần framework ngoài) trên `tests/`. Hai kiểu:

1. **Test file `electron/pure.js`**: `require()` thẳng, không cần sandbox gì
   (file đó chỉ dùng `fs`/`path`). Dùng `fs.mkdtempSync` cho test cần
   filesystem thật, dọn dẹp bằng `fs.rmSync(dir, {recursive:true,force:true})`.
2. **Test file `js/*.js`** (viết cho trình duyệt): dùng `tests/helpers/
   sandbox.js` → `loadScripts(['a.js','b.js'])` chạy các file trong 1 `vm`
   context giả lập tối thiểu `window`/`document`/`localStorage`. Biến toàn cục
   không khai báo `let`/`const` trong các file được nạp (vd `words` nếu không
   nạp `storage.js`) gán trực tiếp qua `ctx.words = [...]` sau khi load — xem
   ví dụ trong `tests/word-crud.test.js`.

**Hàm nhiều DOM (render/event handler) hầu như không test trực tiếp được** —
mock `document.getElementById` trong sandbox chỉ trả `null`. Quy ước đã dùng
xuyên suốt: TÁCH phần logic thuần (nhận input, trả về giá trị/HTML string,
không đụng DOM/side-effect) ra hàm riêng, hàm render/handler gọi hàm thuần đó
rồi mới gán vào DOM. Ví dụ: `wlComparator`, `isTrashEntryExpired`,
`trashEntryHtml`, `resetWordMastery`, `parseBulkLine`, `quizScoreTier`,
`buildBlanksHtml`, `csvCell`, `ankiRowFor`, `partitionImportWords`. Khi thêm
tính năng mới có logic đáng test, làm theo đúng pattern này thay vì cố mock
DOM sâu hơn.

Nhớ thêm hàm mới vào `appGlobals` trong `eslint.config.js` (xem mục Kiến trúc)
— rất dễ quên vì bước này tách biệt hẳn với việc viết code/test.

## Lệnh thường dùng

```bash
npm install
npm start        # chạy app ở chế độ dev (electron .)
npm test         # node --test trên tests/
npm run lint     # ESLint (appGlobals phải cập nhật nếu thêm global mới)
npm run format   # Prettier --write
npm run dist     # build installer cho hệ điều hành hiện tại, ra dist/
```

CI (`.github/workflows/ci.yml`) chạy lint+test trên mọi push/PR (trừ tag
release, đã có gate riêng trong `build.yml`). Build installer thật (`.exe`/
`.dmg`) chỉ chạy khi đẩy tag `vX.Y.Z` hoặc bấm tay `workflow_dispatch`.

## Rủi ro đã biết, cố tình chưa xử lý (xem trước khi động vào)

- **Không có module system** (xem mục Kiến trúc) — cân nhắc chuyển dần sang
  ES modules là việc LỚN, RỦI RO CAO, cần làm riêng từng file một cách cẩn
  thận, không nên làm xen giữa 1 thay đổi tính năng khác.
- **Tra từ điển/dịch tự động phụ thuộc API không chính thức**
  (`translate.googleapis.com/translate_a/single`, endpoint nội bộ của Google
  Translate) — có thể ngừng hoạt động/đổi định dạng bất kỳ lúc nào không báo
  trước, không phải lỗi trong code.
- **Đồng bộ nhiều máy qua sync folder là last-write-wins** (snapshot đè lên
  nhau, không merge thật) — nếu sửa cùng lúc trên 2 máy rồi đồng bộ, 1 bên có
  thể bị ghi đè (có banner cảnh báo + nút Hoàn tác 5s để giảm rủi ro, nhưng
  không phải merge thật sự).
