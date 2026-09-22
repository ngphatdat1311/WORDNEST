'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/sandbox');

// shouldAbandonLookup() gọi setStatus() -> document.getElementById('aw-autofill-status')
// .innerHTML — mock document mặc định của sandbox.js trả null cho mọi id (sẽ
// throw nếu set .innerHTML lên đó), nên tự cấp 1 phần tử giả có .innerHTML ghi
// được, chỉ cho đúng id này.
function load() {
  const el = { innerHTML: '' };
  const document = {
    getElementById: (id) => (id === 'aw-autofill-status' ? el : null),
    addEventListener: () => {},
    querySelectorAll: () => [],
  };
  // lookup.js khai báo `let lookupGen = 0;` ngay trong chính file này -> đây là
  // biến lexical top-level THẬT SỰ (không giống `words` ở word-crud.test.js,
  // vốn không khai báo trong file được nạp) nên KHÔNG gán đè được từ ngoài qua
  // ctx.lookupGen — mỗi loadScripts() ở đây luôn khởi tạo lại lookupGen = 0
  // trong 1 context vm hoàn toàn mới, dùng đúng giá trị cố định đó (0) làm mốc
  // so sánh myGen thay vì cố ghi đè nó.
  const ctx = loadScripts(['lookup.js'], { document });
  return { ctx, el };
}

test('shouldAbandonLookup returns true and does NOT touch status when a newer lookup has already started (myGen stale)', () => {
  const { ctx, el } = load();
  const result = ctx.shouldAbandonLookup(1 /* != lookupGen nội bộ (0) */, { aborted: false }, false, 'không nên hiện');
  assert.equal(result, true);
  assert.equal(el.innerHTML, '');
});

test('shouldAbandonLookup returns true and does NOT touch status when the input field content is now stale', () => {
  const { ctx, el } = load();
  const result = ctx.shouldAbandonLookup(0, { aborted: false }, true /* isStaleNow */, 'không nên hiện');
  assert.equal(result, true);
  assert.equal(el.innerHTML, '');
});

test('shouldAbandonLookup returns false (tiếp tục lượt tra) khi vẫn là lượt hiện tại, chưa hết giờ, chưa đổi input', () => {
  const { ctx, el } = load();
  const result = ctx.shouldAbandonLookup(0, { aborted: false }, false, 'không nên hiện');
  assert.equal(result, false);
  assert.equal(el.innerHTML, '');
});

test('shouldAbandonLookup shows the timeout error badge and returns true when the request genuinely timed out (still current, not stale)', () => {
  const { ctx, el } = load();
  const result = ctx.shouldAbandonLookup(0, { aborted: true }, false, '❌ Tra từ điển quá lâu, có thể do mất mạng — nhập tay nhé');
  assert.equal(result, true);
  assert.match(el.innerHTML, /Tra từ điển quá lâu/);
  assert.match(el.innerHTML, /class="autofill-badge"/); // dùng statusBadge(), không set text thô
});

test('shouldAbandonLookup: bị lượt MỚI HƠN thay thế vẫn ưu tiên hơn "hết giờ" — không được đè lên status của lượt mới đang hiển thị', () => {
  const { ctx, el } = load();
  const result = ctx.shouldAbandonLookup(99 /* != lookupGen (0) */, { aborted: true }, false, 'không nên hiện');
  assert.equal(result, true);
  assert.equal(el.innerHTML, '');
});

test('shouldAbandonLookup: input đã đổi (stale) cũng ưu tiên hơn "hết giờ" — không hiện lỗi cho 1 lượt tra không còn khớp ô nhập', () => {
  const { ctx, el } = load();
  const result = ctx.shouldAbandonLookup(0, { aborted: true }, true /* isStaleNow */, 'không nên hiện');
  assert.equal(result, true);
  assert.equal(el.innerHTML, '');
});
