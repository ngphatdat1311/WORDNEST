# WordNest Capture (tiện ích Chrome)

Bôi đen một từ tiếng Anh trên bất kỳ trang web nào → nút "+ WordNest" hiện lên cạnh vùng chọn (hoặc chuột phải → "Thêm ... vào WordNest") → từ đó được lưu vào hàng đợi. Mở app WordNest lên, từ sẽ tự xuất hiện trong khung "📥 Từ vừa bôi đen" ở tab **Thêm từ**, bấm vào để tự tra nghĩa và thêm vào kho.

## Cài đặt (chế độ Developer / unpacked)

1. Mở Chrome, vào `chrome://extensions`.
2. Bật **Developer mode** (góc trên phải).
3. Bấm **Load unpacked**, chọn thư mục `extension` này.
4. Vì WordNest hiện là 1 file `index.html` mở trực tiếp từ máy (`file://...`), hãy bật thêm:
   - Vào `chrome://extensions`, mở thẻ **WordNest Capture** → bật **"Allow access to file URLs"**.
   - Không có bước này, tiện ích sẽ không đọc được trang WordNest khi mở bằng file cục bộ.

## Cách dùng

- **Trên trang web khác:** bôi đen một từ/cụm từ ngắn (≤ 4 từ, ký tự Latin) → bấm nút nhỏ "+ WordNest" hiện cạnh đó. Hoặc chuột phải vào phần đã chọn → "Thêm '...' vào WordNest".
- Icon tiện ích sẽ hiện số đếm các từ đang chờ; bấm vào icon để xem/xóa nhanh hàng đợi.
- **Trên trang WordNest:** mở tab "➕ Thêm từ" — nếu có từ đang chờ, một khung màu sẽ hiện phía trên form với các từ dạng "chip". Bấm vào 1 từ để tự điền vào ô nhập + kích hoạt tra từ điển tự động; bấm "✕" trên chip để bỏ qua.

## Giới hạn

- Chỉ hoạt động khi cả tiện ích **và** tab WordNest đang mở trên máy (đây là app tĩnh dùng `localStorage`, không có server để đồng bộ qua nhiều máy).
- Nếu sau này bạn host WordNest qua `http://localhost` hay một domain thật, tiện ích vẫn hoạt động bình thường — không cần sửa gì thêm.
