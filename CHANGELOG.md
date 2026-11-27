# Changelog

Lịch sử thay đổi giữa các bản release của WordNest. Định dạng dựa theo
[Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) (rút gọn cho phù hợp
dự án cá nhân — không tách nhóm Added/Changed/Fixed, chỉ liệt kê theo thứ tự
thời gian). Số phiên bản khớp tag Git (`vX.Y.Z`) và `package.json`.

## [Unreleased]

_(Chưa có gì — các thay đổi mới sẽ liệt kê ở đây trước khi bump version cho
bản release tiếp theo.)_

## [2.4.0] - 2026-11-27

- **Két Sao Lưu Tự Động Liên Tục Chống Xóa Bằng Mật Khẩu (Protected Auto-Backup Vault — `.wnbak`)**:
  - Cho phép chọn bất kỳ thư mục nào trên máy (mặc định `Documents/WordNest-Backup`) để **tự động sao lưu liên tục** sau mỗi 1,5 giây khi học và khi thoát ứng dụng.
  - Định dạng `.wnbak` nén **Gzip cấp độ 9** siêu nhẹ (giảm >75% dung lượng, chỉ vài chục KB, tự xoay vòng 7 ngày) kết hợp **mã hóa AES-256-GCM** kèm khóa bọc bằng mật khẩu (`scrypt`) — mang sang máy mới vẫn khôi phục được chỉ bằng mật khẩu.
  - **Khóa chống xóa ở cấp hệ điều hành** trên cả 3 OS (`icacls /deny (D,DC)` + `attrib +R` trên Windows, `chflags uchg` trên macOS, khóa quyền thư mục `0555` + file `0444` trên Linux) — ngăn xóa nhầm file backup nếu không nhập đúng mật khẩu mở khóa trong tab **Tiến Độ & Đồng Bộ**.

## [2.3.0] - 2026-11-27

- **Tự động gõ tiếng Anh không cần tắt Unikey / EVKey / macOS Telex (`EN Auto`)**: Xây dựng engine phục hồi ký tự tiếng Anh theo thời gian thực ([`src/lib/vietnamese-ime-guard.ts`](src/lib/vietnamese-ime-guard.ts)) trên toàn bộ ô luyện tiếng Anh (*Nghe chép toàn bộ*, *Điền khuyết*, *Luyện Chính Tả*, *Không Chiến*, ô *Từ tiếng Anh*) — tự khôi phục chính xác `thí → this`, `hỉ → hir`, `wỏ → wor`, `frê → free`, `ă → aw`, `ađ → add` ngay cả khi bộ gõ tiếng Việt đang bật.
- **Kiến trúc ô gạch độc lập từng từ (Per-Word Inline Editable Slots)**:
  - Triệt tiêu hoàn toàn lỗi nhân đôi ký tự thừa cuối câu (`[h ] [h ]`).
  - Cho phép **bấm thẳng vào bất kỳ từ sai nào để sửa trực tiếp tại chỗ** (vd: gõ `one bag` chỉ cần bấm vào `one` sửa thành `on` mà không bao giờ phải xóa `bag`!).
  - Điều hướng mượt như gõ văn bản liền mạch: `Space` nhảy sang gạch tiếp theo, `Backspace`/`←`/`→` trượt mượt qua các từ, dán cả câu tự điền vào từng gạch, `Tab` nghe lại ngay mà không rời tay khỏi bàn phím.
- **Nâng cấp sư phạm & khoa học trí nhớ (Tâm lý học nhận thức + Ngôn ngữ học ứng dụng)**:
  - **Gợi ý phân tầng (Vygotsky Scaffolding / Desirable Difficulty)**: Nút *Gợi ý* hé mở theo 3 nấc (chữ cái đầu → nửa từ → cả từ) giúp não chủ động truy xuất ký ức thay vì lộ hết đáp án ngay.
  - **Khép kín vòng lặp Nghe → SRS (Testing Effect)**: Tự gom các từ vừa cần gợi ý ở cuối câu để chạm 1 lần lưu thẳng vào kho Flashcard FSRS.
  - **Sắp xếp ưu tiên khẩn cấp FSRS v5**: Phiên *Đến hạn SRS* tự ưu tiên cứu các thẻ có xác suất nhớ $R(t, S)$ thấp nhất trước khi bị quên.
  - **Chấm nghe linh hoạt chuẩn Ngôn ngữ học**: Chấp nhận cả chính tả Anh–Mỹ (`color/colour`, `realize/realise`...) và chữ số nói (`20` ↔ `twenty`).

## [2.2.4] - 2026-11-27

- **Sửa lỗi chí mạng mở app Desktop (`.exe` / `.dmg` / `.deb` / `.AppImage`) không hiện cửa sổ trên cả 3 hệ điều hành**:
  - `electron-builder` mặc định tự loại bỏ thư mục `node_modules` bên trong `extraResources`, khiến server nội bộ Next.js trong bộ cài đóng gói bị thiếu `next` và thoát âm thầm khi mở app.
  - Thêm hook [`scripts/after-pack.cjs`](scripts/after-pack.cjs) tự động sao chép & kiểm chứng `.next/standalone/node_modules` vào đúng thư mục `resources/standalone/node_modules` cho cả Windows, macOS Universal và Linux (đồng thời lọc sạch file `.env*` cục bộ để không bao giờ rò rỉ khóa bí mật vào bộ cài).
  - Bổ sung `windowsHide: true`, phát hiện lỗi server sớm và hộp thoại báo lỗi rõ ràng trong `electron/main.js` thay vì thoát âm thầm.

## [2.2.3] - 2026-11-27

- **Căn chỉnh pixel tuyệt đối (`0.0px` lệch dòng) cho mọi chế độ điền từ & giao diện**:
  - **Nghe chép toàn bộ (`Gõ full`)**: Cố định cùng chiều cao `36px` (`h-9`) cho mọi trạng thái gạch trống / đang gõ / sai / đúng / con trỏ nhấp nháy — loại bỏ hoàn toàn hiện tượng gạch bị nhảy trồi lên 4–5px khi bắt đầu gõ.
  - **Điền khuyết (`Điền khuyết`)**: Đồng bộ font serif, cỡ chữ và chiều cao `36px` giữa chữ câu gốc và ô gạch điền — triệt tiêu hoàn toàn lỗi ô nhập bị trồi lên lệch 6px so với câu.
  - **Luyện Chính Tả**: Căn giữa dọc chuẩn xác con trỏ nhấp nháy (`.wn-caret`) ngang tầm chữ cái trong từng ô gạch.
  - **Từ Điển Cá Nhân & Thêm Từ Mới**: Chống xuống dòng xấu cho badge chủ đề (`Phrasal Verbs`) và căn chuẩn góc trên bên phải cho badge bộ từ vựng mẫu (Starter Packs).

## [2.2.2] - 2026-11-27

- **Sửa lỗi đóng gói macOS Universal (`.dmg` + `.zip`) & giảm dung lượng bộ cài**: Loại bỏ các gói native thừa (`@img/sharp`) và các thư viện Web trùng lặp khỏi `app.asar` (vốn đã nằm sẵn trong `.next/standalone` và dùng `images.unoptimized = true`), giúp build macOS Universal xanh 100% và giảm mạnh dung lượng file cài cho cả 3 hệ điều hành.

## [2.2.1] - 2026-11-27

- **Tự động cập nhật Desktop App trên cả 3 hệ điều hành (Windows / macOS / Linux)**:
  - Bổ sung target `.zip` cho macOS trong `package.json` và CI workflow để xuất đủ `latest-mac.yml` + `.zip` + `.dmg`.
  - Nâng cấp `electron/main.js` với hộp thoại tiếng Việt thông báo tải xong & khởi động lại để cập nhật ngay (`Windows .exe` & `Linux .AppImage`), tự động dự phòng kiểm tra GitHub Release và mở link tải trực tiếp 1 chạm cho `macOS` chưa ký chứng chỉ & `Linux .deb` (giữ nguyên 100% dữ liệu học trong `userData/storage/`).
  - Bổ sung nút **"Kiểm tra cập nhật"** trong thanh Menu Desktop & tab **Tiến độ**.
- **Gõ trực tiếp lên gạch (Inline Underline Typing)**: Gộp gọn 2 khung thành 1 khung gạch duy nhất có con trỏ nhấp nháy ở cả *Nghe chép toàn bộ* lẫn *Luyện Chính Tả*; tự nhảy ô tiếp theo khi gõ ở chế độ *Điền khuyết*.
- **AI Coach Gemini mới nhất**: Nâng cấp chuỗi model nhanh `gemini-flash-lite-latest` (~1,2s phản hồi) và thêm nút **"Kiểm tra kết nối AI"** ngay trong tab Tiến độ.
- **Tinh chỉnh UX**: Tự động cuộn lên đầu trang khi chuyển tab/bài nghe và đồng bộ toàn bộ nhãn hiển thị `FSRS v5`.

## [2.2.0] - 2026-11-27

- **Thuật toán ôn tập FSRS v5 (chuẩn Anki thế hệ mới)**: Thay thế SM-2 bằng mô hình đường cong quên lũy thừa **FSRS v5** (`srsStability`, `srsDifficulty`, `srsLastReview`), tự động di trú mượt dữ liệu SM-2 cũ mà không mất tiến độ và hiển thị trực tiếp xác suất nhớ & độ bền trí nhớ trên thẻ Flashcard.
- **Hướng dẫn Onboarding Wizard lần đầu**: Trải nghiệm 3 bước cho người mới (chọn trình độ CEFR `A1–C2`, mục tiêu hàng ngày và nạp nhanh bộ từ vựng mẫu chuẩn CEFR chỉ bằng 1 chạm; có thể mở lại bất cứ lúc nào trong tab Tiến Độ).
- **Tái cấu trúc kiến trúc mô-đun**: Tách gọn các màn hình lớn thành mô-đun chuyên biệt (`DictationPlayerStudio` tải lười qua `next/dynamic`, `WordlistModals`, `air-combat-renderer`), giảm 65% độ lớn file `DictationView.tsx` và nâng cao khả năng bảo trì.
- **Kiểm thử E2E tự động bằng Playwright + Chrome thực**: Thêm bộ kiểm thử `npm run test:e2e` kiểm tra tự động toàn bộ luồng Onboarding, Flashcard FSRS, 9 tab điều hướng, Command Palette `Ctrl+K`, Dictation tải lười và bố cục Mobile 390px với 0 lỗi console.

## [2.1.0] - 2026-11-26

- **Bảo vệ dữ liệu & Desktop Electron**: Chuyển lưu trữ Desktop sang file JSON nguyên tử trong `userData/storage/` kèm tự động sao lưu xoay vòng 5 ngày (miễn nhiễm lỗi đổi port localhost & giới hạn 5 MB), tái sử dụng embedded server khi `activate` trên macOS, sửa đúng chiều vuốt 2 ngón macOS và khôi phục cầu nối Chrome Extension (`127.0.0.1:51789` + Web `postMessage`).
- **Hiệu năng & Lưu trữ Web/PWA**: Tách 597 KB dữ liệu 18 bài nghe sang file JSON tải lười (`public/lessons/*.json`), áp dụng Code Splitting (`next/dynamic`) cho 8 tab phụ, nâng cấp lưu trữ Web sang **IndexedDB**, xóa 700 KB font cũ thừa, bổ sung Error Boundary và tìm kiếm nhanh toàn cục `Ctrl+K` / `⌘K`.
- **Sư phạm EdTech**: Sửa lỗi bỏ qua 50% thẻ SRS ở chế độ "Đến hạn SRS" + thêm vòng lặp ôn lại ngay trong phiên cho nút Quên, bổ sung Flashcard 3 chiều (*Anh → Việt*, *Việt → Anh*, *Chỉ nghe âm thanh*), cảnh báo Từ hay quên (Leech), Khiên Đóng Băng Streak, bộ phân loại trình độ **CEFR (`A1–C2`)**, 4 Bộ từ vựng mẫu (Starter Packs — 75 từ IELTS/TOEIC/Giao tiếp/Phrasal Verbs), **Shadowing 2.0** (ghi âm & so sánh giọng mẫu chạy mượt trên cả Desktop Electron) và chế độ Học Tập Trung (Focus Mode).
- **Backend, Bảo mật & AI Coach**: Thêm LRU TTL Cache + Rate Limiter + Lemmatizer cho `/api/lookup`, `/api/translate`, `/api/youtube/transcript` (sửa lỗi chọn nhầm phụ đề ngoại ngữ khác), nâng cấp **Đồng bộ Cloud 2 chiều hợp nhất không ghi đè** + đăng nhập tài khoản **Supabase Auth (RLS chặt theo `auth.uid()`)**, và thêm **AI Coach** đặt câu thực hành & giải thích ngữ cảnh trong khung tra từ.

## [1.0.26] - 2026-09-22

- Thêm bản build Linux (AppImage + `.deb`) — `package.json`/CI giờ build cho
  cả 3 hệ điều hành, auto-update hoạt động trên cả AppImage lẫn `.deb`.
- Thêm popup quảng cáo game mini "Không Chiến Từ Vựng" (gõ từ tiếng Anh để
  bắn máy bay) đang phát triển — hiện khi mở app, đóng được bằng ✕/Escape/bấm
  ra ngoài.

## [1.0.25] - 2026-08-19

- Thêm từ trùng giờ gắn thêm thư mục thay vì chặn cứng, kèm dialog xác nhận
  rõ ràng (hiện rõ từ đó đang thuộc thư mục nào trước khi hỏi có gắn thêm
  không) — thay vì gắn thầm hoặc chặn thẳng như trước.
- Cập nhật README: hướng dẫn mở macOS mới, danh sách file `js/` đầy đủ.

## [1.0.24] - 2026-08-18

- Cho phép 1 từ gắn được **nhiều thư mục cùng lúc** (`folderId` đơn →
  `folderIds` mảng) — thay đổi lớn nhất bản này, đặt nền cho tính năng ở
  1.0.25.
- Sửa 3 lỗi phát hiện qua audit: Hoàn tác/rollback bị âm thầm bỏ qua khi ghi
  đĩa lỗi, 2 dialog quét-sửa hàng loạt (phân loại lại / tự điền phiên âm) có
  thể chồng lên nhau nếu mở tool này rồi mở tool kia giữa chừng.
- Vá 5 lỗ hổng `npm audit` (dev-dependency của `electron-builder`/
  `electron-updater`, không ảnh hưởng runtime của app).
- Sửa lỗi "seen" (số lần xem) của 1 từ ngẫu nhiên bị cộng thừa +1 mỗi lần mở
  app (do lượt tiền tải Flashcard lúc khởi động bị tính nhầm là user đã xem).

## [1.0.23] - 2026-07-12

- Thêm mục **Đặt lại tiến độ học tập** (chọn lọc: mastery/SRS, thống kê Quiz,
  streak, heatmap) trong tab Tiến độ, có Hoàn tác 5 giây.
- Thêm tool **tự động điền phiên âm còn thiếu** (tương tự tool phân loại lại
  từ chưa rõ, dùng chung hạ tầng quét tuần tự + progress bar).
- Icon thư mục đổi màu theo hệ điều hành (xanh dương kiểu Finder trên macOS,
  vàng kiểu Windows) thay vì emoji cố định.

## [1.0.22] - 2026-07-12

- Sửa lỗi ký hiệu loại từ (n/v/adj/adv) bị xuống dòng xấu, tách rời khỏi tên
  từ trong bảng Từ điển.

## [1.0.21] - 2026-07-12

- Thêm bộ lọc theo **loại từ** (danh/động/tính/trạng từ...) trong tab Từ điển.

## [1.0.20] - 2026-07-12

- Sửa thứ tự font fallback cho icon trên macOS (icon hiện sai font trong vài
  trường hợp).

## [1.0.19] - 2026-07-12

- Thêm **`id` ổn định** cho mỗi từ vựng — mọi thao tác CRUD (sửa/xóa/ẩn/gán
  thư mục) chuyển từ so khớp theo chuỗi `word` (vỡ khi đổi tên) sang so khớp
  theo `id`.
- Thùng rác **tự dọn** mục quá hạn 30 ngày.
- Thêm phân trang cho danh sách từ trong 1 thư mục.
- Sửa lỗi icon sai trên macOS.

## [1.0.18] - 2026-07-12

- Thay toast nhấp nháy liên tục bằng **thanh tiến độ ngay trong hộp thoại**
  cho tool "Phân loại lại từ chưa rõ" — trải nghiệm mượt hơn khi quét hàng
  loạt từ.

## [1.0.17] - 2026-07-12

- Tool phân loại lại từ chưa rõ: tra **tuần tự** (không song song) + **tự thử
  lại** khi bị giới hạn tốc độ (rate-limit) từ dictionaryapi.dev, thay vì bỏ
  cuộc ngay. _(Bump version trong lịch sử commit, không có tag Git tương ứng —
  có thể do lượt build CI cho tag này đã lỗi/không được tạo.)_

## [1.0.16] - 2026-07-12

- Thêm tool **"Phân loại lại từ chưa rõ"** — tự quét các từ có `type: 'other'`
  (thường do Thêm hàng loạt không ghi loại từ) và tra dictionaryapi.dev để
  xác định đúng danh/động/tính/trạng từ. _(Cùng ghi chú về tag Git như
  1.0.17 ở trên.)_

## [1.0.15] - 2026-07-12

- Thêm ký hiệu loại từ ngắn gọn (n/v/adj/adv/phr) cạnh tên từ trong Từ điển.
- Thêm hàng loạt nhận diện thêm nhiều cách viết tắt loại từ (`(n)`, `v.`,
  nhãn tiếng Việt...).

## [1.0.14] - 2026-07-11

- Thêm trường loại từ vào form Thêm hàng loạt.
- Sửa lỗi flash/nhấp nháy sai khi chuyển flashcard nhanh (thấy thoáng nghĩa
  của thẻ kế tiếp trước khi thẻ xoay xong).
- Đồng bộ menu ứng dụng giữa macOS/Windows, sửa crash ở tab Thùng rác.

## [1.0.13] - 2026-07-02

- Thêm gợi ý kiểm tra bản cập nhật thủ công cho macOS (do chưa có chữ ký số
  nên auto-update chưa hoạt động đầy đủ trên nền tảng này).
- Chụp lại toàn bộ screenshot README cho khớp giao diện hiện tại.

## [1.0.12] - 2026-07-02

- Icon ứng dụng mới, vẽ từ logo SVG.
- Bổ sung bộ test (`node --test`) + ESLint, tách `lookup.js` thành các module
  nhỏ hơn (`lookup-cache.js`/`lookup-classify.js`/`lookup-providers.js`),
  siết `Content-Security-Policy`, nâng Electron lên bản 43.

## [1.0.11] - 2026-07-01

- Bổ sung 6 tính năng lớn cùng nhiều cải tiến (gộp nhiều đợt phát triển thành
  1 bản release) + sửa 4 lỗi phát hiện qua đợt review thứ 2.

## [1.0.10] - 2026-06-28

- Sửa hiển thị sai mức độ thuộc (mastery) ở 1 vài trường hợp.

## [1.0.7] .. [1.0.9] - 2026-06-28

- 3 bản vá liên tiếp, chủ yếu cập nhật link tải trong README theo từng bản
  release ngay trước đó — không có thay đổi chức năng đáng kể.

## [1.0.6] - 2026-06-27

- Sửa nút "Đổi ví dụ khác" hiện ra nhưng bấm không đổi gì.
- Thay icon emoji ở menu bằng SVG line-art đồng bộ với logo.
- Thêm hiệu ứng confetti khi đạt điểm cao ở Quiz / học hết bộ Flashcard.

## [1.0.5] - 2026-06-27

- Thiết kế lại logo WordNest (biểu tượng sách mở + lá non).
- Thêm nút "Đổi ví dụ khác" ở form Thêm từ; tăng tốc dịch bằng cách gọi song
  song 2 nguồn dịch thay vì nối tiếp.
- Sửa lỗi badge "Đã tra xong" đè lên ô input khi nội dung dài.

## [1.0.4] - 2026-06-27

- Sửa lỗi từ vựng bị ép xuống dòng từng ký tự trong bảng Từ điển trên màn
  hẹp.
- Sửa lỗi vòng tròn đáp án A/B/C/D trong Quiz bị lệch khi đáp án dài xuống
  dòng.

## [1.0.3] - 2026-06-27

- Thêm **auto-update trong app** — không cần gỡ cài đặt/tải lại thủ công.
- Thêm phiên âm vào form Thêm hàng loạt + tự nhận diện cụm từ/từ đơn theo
  khoảng trắng.
- Sửa lỗi làm Chính tả sai không ghi nhận tiến độ (streak/heatmap không tăng
  dù đã thực sự học).
- Tối ưu hiệu năng: tự host font (bỏ phụ thuộc CDN ngoài), cửa sổ không nhấp
  nháy lúc mở app, hoãn kiểm tra cập nhật để không tranh CPU lúc khởi động.
- Viết hướng dẫn sử dụng chi tiết kèm screenshot trong README.

## [1.0.2] - 2026-06-27

- Vá các lỗi phát hiện qua đợt báo cáo QA toàn diện: SRS tính ra `NaN` trong
  vài trường hợp, mất dữ liệu âm thầm khi ghi đĩa lỗi, vỡ layout ở màn hẹp,
  và một số vấn đề CSP.

## [1.0.1] - 2026-06-27

- Vá lỗi tiện ích Chrome "WordNest Capture" im lặng không hoạt động khi mở
  app desktop 2 lần cùng lúc (single-instance lock cho server cầu nối).

## [1.0.0] - 2026-06-27

- Bản phát hành đầu tiên: Flashcard (SRS kiểu SM-2), Quiz trắc nghiệm, Luyện
  chính tả, Từ điển cá nhân, theo dõi tiến độ (heatmap kiểu GitHub), tự động
  tra từ điển + dịch nghĩa, đồng bộ qua thư mục cloud, tiện ích Chrome capture
  từ vựng, auto-update qua GitHub Releases.
