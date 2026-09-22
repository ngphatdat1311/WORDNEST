'use strict';
// ════════════════════════════════════════════════════════
// PURE HELPERS cho main process — tách khỏi main.js vì các hàm này CHỈ dùng
// 'fs'/'path' (module Node lõi), KHÔNG đụng tới module 'electron' — main.js
// gọi app.requestSingleInstanceLock() ngay ở top-level nên không thể require()
// được trong Node thường (ngoài tiến trình Electron thật) để unit test; tách
// ra file riêng này cho phép tests/electron-pure.test.js require() trực tiếp,
// không cần mock cả Electron.
// ════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

// key luôn phải là hằng số cố định do chính app định nghĩa (vd 'wordnest_data',
// 'wordnest_streak'...) — chặn ký tự lạ (., /, \...) ở biên IPC để dù renderer
// có bị chiếm quyền kiểu nào cũng không thể biến key thành đường dẫn ra ngoài
// thư mục userData (path traversal), dù path.join phía dưới không tự chặn việc đó.
function isValidStoreKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(key);
}

// folderPath do renderer gửi lên mỗi lần ghi/đọc (lưu lại từ lần chọn qua dialog
// trước đó) — xác nhận lại đây thực sự là 1 thư mục CÓ TỒN TẠI trên máy trước
// khi ghi/đọc file, để không lỡ ghi/đọc vào 1 đường dẫn bất kỳ nếu giá trị lưu
// trong store bị hỏng hoặc bị can thiệp.
function isValidSyncFolder(folderPath) {
  if (typeof folderPath !== 'string' || !folderPath || !path.isAbsolute(folderPath)) return false;
  try { return fs.statSync(folderPath).isDirectory(); } catch { return false; }
}

// Ghi file "atomic": ghi ra 1 file tạm trong CÙNG thư mục đích rồi rename đè
// lên file thật. rename() trên cùng 1 filesystem là 1 thao tác nguyên tử ở tầng
// hệ điều hành (cả POSIX lẫn Windows) — tiến trình khác/lần đọc sau chỉ thấy
// HOẶC file cũ nguyên vẹn, HOẶC file mới nguyên vẹn, không bao giờ thấy trạng
// thái ghi dở. Trước đây dùng fs.writeFileSync() thẳng vào file đích — nếu app
// bị kill/crash/mất điện đúng lúc đang ghi (vd giữa lúc ghi store_wordnest_data.json,
// file chứa TOÀN BỘ từ vựng), file có thể bị cắt cụt thành JSON hỏng, mất sạch
// dữ liệu không có gì khôi phục ngoài sync folder (nếu có bật).
function atomicWriteFileSync(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, data, 'utf8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // rename() lỗi (hiếm — vd hết quyền, hết dung lượng đúng lúc đó) -> dọn file
    // tạm để không rác lại thư mục userData/sync qua thời gian, rồi ném lại lỗi
    // để caller (ipcMain handler) biết ghi thất bại và báo cho renderer.
    try { fs.unlinkSync(tmpPath); } catch { /* best-effort cleanup, không có gì thêm để làm nếu lỗi */ }
    throw err;
  }
}

// Bảng quy đổi ARPAbet (CMU Pronouncing Dictionary, Datamuse trả về dạng này)
// sang IPA — dùng làm phiên âm dự phòng khi dictionaryapi.dev không có.
const ARPABET_TO_IPA = {
  AA: 'ɑ', AE: 'æ', AH: 'ə', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð',
  EH: 'ɛ', ER: 'ɚ', EY: 'eɪ',
  F: 'f', G: 'g', HH: 'h',
  IH: 'ɪ', IY: 'i',
  JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ',
  OW: 'oʊ', OY: 'ɔɪ',
  P: 'p', R: 'r', S: 's', SH: 'ʃ',
  T: 't', TH: 'θ',
  UH: 'ʊ', UW: 'u',
  V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
function arpabetToIpa(pronTag) {
  const phones = pronTag.trim().split(/\s+/);
  let ipa = '';
  for (const ph of phones) {
    const m = ph.match(/^([A-Z]+)([0-2])?$/);
    if (!m) continue;
    const base = m[1], stress = m[2];
    let sym = ARPABET_TO_IPA[base];
    if (sym === undefined) continue;
    if (base === 'AH' && stress && stress !== '0') sym = 'ʌ'; // AH có trọng âm đọc /ʌ/, không phải schwa
    if (stress === '1') ipa += 'ˈ' + sym;
    else if (stress === '2') ipa += 'ˌ' + sym;
    else ipa += sym;
  }
  return ipa;
}

module.exports = { isValidStoreKey, isValidSyncFolder, atomicWriteFileSync, ARPABET_TO_IPA, arpabetToIpa };
