'use strict';
// Chạy các file js/*.js (viết cho trình duyệt, không dùng module) trong 1
// vm context riêng, mô phỏng tối thiểu các global mà chúng đụng tới lúc load
// (window, document, localStorage) — để test được các hàm thuần mà không phải
// sửa cách các file này được nạp bằng <script> trong index.html.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function createMockLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

// Store độc lập với localStorage thật, dùng để test cache/streak logic mà
// không phụ thuộc window.electronAPI hay localStorage của jsdom.
function createMemoryStore() {
  const map = new Map();
  return {
    storeGet: (k) => (map.has(k) ? map.get(k) : null),
    storeSet: (k, v) => { map.set(k, v); return true; },
    migrateKeyIfNeeded: () => {},
  };
}

function createMockDocument() {
  return { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [] };
}

// Nạp lần lượt các file trong js/ (theo đúng thứ tự truyền vào, giống thứ tự
// <script> trong index.html) vào chung 1 context, trả về context đó — mọi
// function/const khai báo ở top-level trong các file sẽ là property của nó.
function loadScripts(fileNames, extraGlobals = {}) {
  const sandbox = {
    window: {},
    document: createMockDocument(),
    localStorage: createMockLocalStorage(),
    showToast: () => {},
    console,
    ...extraGlobals,
  };
  vm.createContext(sandbox);
  for (const name of fileNames) {
    const filePath = path.join(__dirname, '..', '..', 'js', name);
    const code = fs.readFileSync(filePath, 'utf8');
    new vm.Script(code, { filename: name }).runInContext(sandbox);
  }
  return sandbox;
}

module.exports = { loadScripts, createMockLocalStorage, createMemoryStore, createMockDocument };
