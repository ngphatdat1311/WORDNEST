# WordNest — Học Tiếng Anh

App học từ vựng tiếng Anh cá nhân: Flashcard (SRS kiểu SM-2), Quiz trắc nghiệm, Luyện chính tả, Từ điển cá nhân, theo dõi tiến độ (heatmap kiểu GitHub).

## 📥 Tải app desktop

| Hệ điều hành | Tải về |
|---|---|
| Windows | [WordNest.Setup.1.0.0.exe](https://github.com/ngphatdat1311/WORDNEST/releases/download/v1.0.0/WordNest.Setup.1.0.0.exe) |
| macOS (Intel & Apple Silicon) | [WordNest-1.0.0-universal.dmg](https://github.com/ngphatdat1311/WORDNEST/releases/download/v1.0.0/WordNest-1.0.0-universal.dmg) |

Xem tất cả bản phát hành tại [Releases](https://github.com/ngphatdat1311/WORDNEST/releases).

App chưa có chữ ký số (tốn phí, không cần thiết cho dùng cá nhân) nên lần đầu mở:
- **Windows:** SmartScreen báo "Unknown publisher" → bấm **More info → Run anyway**.
- **macOS:** Gatekeeper báo "không xác định được nhà phát triển" → chuột phải (hoặc Control-click) vào app → **Open**.

## 🧩 Tiện ích Chrome — bôi đen từ trên web khác, gửi thẳng vào app

Cài riêng theo hướng dẫn trong [extension/README.md](extension/README.md). Khi app desktop đang mở, bôi đen 1 từ tiếng Anh trên bất kỳ trang web nào → bấm nút nhỏ hiện lên (hoặc chuột phải) → từ đó vào ngay hộp thư "Thêm từ" trong app.

## Cấu trúc dự án

```
index.html         Markup chính (dùng chung cho app desktop)
css/style.css       Toàn bộ giao diện (sáng/tối, responsive)
js/                 Logic chia theo tính năng (storage, flashcard, quiz, spelling, wordlist, progress, lookup...)
electron/           Lớp bọc desktop (Electron) + server cầu nối cho tiện ích Chrome
extension/          Tiện ích Chrome "WordNest Capture"
.github/workflows/  CI tự build .exe/.dmg mỗi khi đẩy tag vX.Y.Z
```

## Tự build từ source

```
npm install
npm start        # chạy thử ở chế độ dev
npm run dist      # build installer cho hệ điều hành hiện tại, ra trong dist/
```

Bản macOS chỉ build được trên máy Mac (hoặc qua CI) — xem `.github/workflows/build.yml`.

## Lưu ý

Dữ liệu lưu cục bộ trên từng máy — không đồng bộ giữa các máy. Dùng nút **Xuất JSON** ở tab Từ điển để sao lưu định kỳ.
