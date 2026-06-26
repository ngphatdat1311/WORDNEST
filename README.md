# WordNest — Học Tiếng Anh

App học từ vựng tiếng Anh cá nhân: Flashcard (SRS kiểu SM-2), Quiz trắc nghiệm, Luyện chính tả, Từ điển cá nhân, theo dõi tiến độ (heatmap kiểu GitHub). Chạy hoàn toàn phía trình duyệt, dữ liệu lưu trong `localStorage` — không cần server.

🔗 **Demo:** https://ngphatdat1311.github.io/WORDNEST/

## Cấu trúc dự án

```
index.html        Markup chính
css/style.css      Toàn bộ giao diện (sáng/tối, responsive)
js/                Logic chia theo tính năng (storage, flashcard, quiz, spelling, wordlist, progress, lookup...)
extension/         Tiện ích Chrome "WordNest Capture" — bôi đen từ trên web khác, gửi vào hộp thư app
```

## Chạy thử local

Mở trực tiếp `index.html` bằng trình duyệt, hoặc dùng server tĩnh bất kỳ, ví dụ:

```
python -m http.server 8080
```

rồi vào `http://localhost:8080`.

## Tiện ích Chrome

Xem hướng dẫn cài đặt trong [extension/README.md](extension/README.md).

## Lưu ý

Dữ liệu lưu trong `localStorage` của từng trình duyệt — xóa cache trình duyệt sẽ mất dữ liệu. Hãy dùng nút **Xuất JSON** ở tab Từ điển để sao lưu định kỳ.
