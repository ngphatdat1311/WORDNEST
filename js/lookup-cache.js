// ════════════════════════════════════════════════════════
// LOOKUP CACHE — cache kết quả tra từ điển + dịch theo từ, để (1) không gọi
// lại API dictionaryapi.dev/Google Translate mỗi lần tra cùng một từ (giảm
// rủi ro bị rate-limit/block), và (2) kết quả trả về nhất quán giữa các lần
// tra (trước đây pickRandomExample() chọn ví dụ ngẫu nhiên mỗi lần, nay từ
// đã cache sẽ giữ nguyên ví dụ/nghĩa đã chọn).
// ════════════════════════════════════════════════════════
const LOOKUP_CACHE_KEY = 'wordnest_lookup_cache';
const LOOKUP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const LOOKUP_CACHE_MAX = 300; // giới hạn số từ cache để tránh đầy localStorage

function loadLookupCacheRaw() {
  try { return JSON.parse(storeGet(LOOKUP_CACHE_KEY)) || {}; }
  catch { return {}; }
}
function saveLookupCacheRaw(cache) {
  migrateKeyIfNeeded(LOOKUP_CACHE_KEY); // migration 1 lần rồi thôi
  storeSet(LOOKUP_CACHE_KEY, JSON.stringify(cache));
}
function getCachedLookup(word) {
  const cache = loadLookupCacheRaw();
  const entry = cache[word.toLowerCase()];
  if (!entry) return null;
  const ttl = entry.partialTtl ? 24 * 60 * 60 * 1000 : LOOKUP_CACHE_TTL_MS;
  if (Date.now() - entry.ts > ttl) return null; // hết hạn (thông thường 30 ngày, kết quả thiếu thì 1 ngày)
  return entry.result;
}
function setCachedLookup(word, result) {
  // Không cache nếu thiếu cả phonetic lẫn example — quá thiếu, để retry lần sau
  if (!result.phonetic && !result.exampleEn) return;
  const cache = loadLookupCacheRaw();
  const key = word.toLowerCase();
  // Kết quả thiếu phonetic HOẶC thiếu example → đánh dấu partialTtl để hết hạn sớm hơn (1 ngày)
  const isPartial = !result.phonetic || !result.exampleEn;
  cache[key] = { ts: Date.now(), result, ...(isPartial ? { partialTtl: true } : {}) };
  const keys = Object.keys(cache);
  if (keys.length > LOOKUP_CACHE_MAX) {
    keys.sort((a, b) => cache[a].ts - cache[b].ts); // cũ nhất trước
    const removeCount = keys.length - LOOKUP_CACHE_MAX;
    for (let i = 0; i < removeCount; i++) delete cache[keys[i]];
  }
  saveLookupCacheRaw(cache);
}
