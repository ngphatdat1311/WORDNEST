# WordNest 2.0 — Học Từ Vựng SRS & Nghe Chép Chính Tả YouTube

Ứng dụng học tiếng Anh đa nền tảng kết hợp **Desktop App (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`/`.deb`)** và **Web/PWA** trong cùng 1 repository duy nhất.

## Tính năng nổi bật

- **Studio Nghe Chép Chính Tả YouTube (chuẩn DOL)**:
  - Dán bất kỳ link YouTube nào (chạy trực tiếp trên App máy tính bóc phụ đề 100% không bị chặn IP).
  - Thư viện 18+ video kinh điển (TED, Steve Jobs, MrBeast, Queen...) đầy đủ 100% câu, chia phân đoạn thông minh.
  - 3 chế độ luyện tập: Chạm từ (1 tay), Điền khuyết, Gõ full (ô nhập nhiều dòng tự mở rộng).
  - Tự động dịch song ngữ Việt – Anh, che phụ đề gốc video, tra từ 1-click và luyện nói Shadowing.
  - Hỗ trợ điều hướng Back/Forward (vuốt 2 ngón trên trackpad & nút quay lại trình duyệt).
- **Ôn tập từ vựng thông minh (SM-2 SRS)**:
  - Flashcard SRS, Quiz 4 đáp án, Luyện chính tả điền khuyết.
- **Không Chiến Từ Vựng 2.0**:
  - Màn hình rộng sắc nét, chữ to rõ, có nút Tạm dừng (`Esc`), chọn nguồn từ theo thư mục và tốc độ bay.
- **Đồng bộ đám mây Supabase**: Đồng bộ dữ liệu 2 chiều giữa Máy tính và Điện thoại.

## Chạy ở chế độ phát triển

```bash
npm install
npm run dev
```

## Build & chạy Desktop App (Electron)

```bash
npm run build:electron
npm start
```

Hoặc đóng gói bộ cài đặt cho máy hiện tại:

```bash
npm run dist
```

## Phát hành bản cài đặt tự động (.exe, .dmg, .AppImage, .deb)

Đẩy tag phiên bản mới lên GitHub để GitHub Actions tự động build cho cả Windows, macOS và Linux:

```bash
git tag v2.0.0
git push origin v2.0.0
```
