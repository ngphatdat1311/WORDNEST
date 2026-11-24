import type { StateStorage } from 'zustand/middleware';

interface WordNestDesktopBridge {
  isDesktop?: boolean;
  platform?: string;
  storage?: {
    getItemSync: (key: string) => string | null;
    setItem: (key: string, value: string) => Promise<boolean>;
    removeItem: (key: string) => Promise<boolean>;
  };
}

const IDB_NAME = 'wordnest-idb';
const IDB_STORE = 'kv';
const THEME_MIRROR_KEY = 'wordnest-theme';

let idbPromise: Promise<IDBDatabase | null> | null = null;

function openWordNestIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (idbPromise) return idbPromise;

  idbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        idbPromise = null;
        resolve(null);
      };
    } catch {
      idbPromise = null;
      resolve(null);
    }
  });

  return idbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openWordNestIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<boolean> {
  const db = await openWordNestIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbRemove(key: string): Promise<boolean> {
  const db = await openWordNestIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function mirrorThemeToLocalStorage(rawJson: string): void {
  try {
    const parsed = JSON.parse(rawJson) as { state?: { theme?: string } };
    const t = parsed?.state?.theme;
    if (t === 'dark' || t === 'light') {
      window.localStorage.setItem(THEME_MIRROR_KEY, t);
    }
  } catch {
    // Ignore parse/storage errors
  }
}

function getDesktopStorage(): WordNestDesktopBridge['storage'] | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { wordnestDesktop?: WordNestDesktopBridge };
  return w.wordnestDesktop?.storage;
}

/**
 * Multi-tier persistent storage adapter:
 * 1) Electron Desktop: atomic JSON file in app.getPath('userData') + 5-day auto backups
 * 2) Web / Mobile PWA: IndexedDB (hundreds of MB quota, no 5MB localStorage wall!)
 * 3) Fallback: safe localStorage with graceful QuotaExceededError event notification
 * Automatically migrates legacy localStorage data on first load without data loss.
 */
export const wordNestStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    // 1. Electron durable disk storage
    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      try {
        const diskVal = desktopStorage.getItemSync(name);
        if (diskVal !== null) return diskVal;
      } catch {
        // Fallback below
      }
      try {
        const legacyVal = window.localStorage.getItem(name);
        if (legacyVal !== null) {
          void desktopStorage.setItem(name, legacyVal);
          return legacyVal;
        }
      } catch {
        // Ignore
      }
      return null;
    }

    // 2. Web / PWA IndexedDB (high-capacity async storage)
    const idbVal = await idbGet(name);
    if (idbVal !== null) return idbVal;

    // Seamless one-time migration from legacy localStorage -> IndexedDB
    try {
      const legacyVal = window.localStorage.getItem(name);
      if (legacyVal !== null) {
        await idbSet(name, legacyVal);
        mirrorThemeToLocalStorage(legacyVal);
        return legacyVal;
      }
    } catch {
      // Ignore storage read errors
    }

    return null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;

    mirrorThemeToLocalStorage(value);

    // 1. Electron durable disk storage
    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      await desktopStorage.setItem(name, value);
      return;
    }

    // 2. Web / PWA IndexedDB
    const savedIdb = await idbSet(name, value);
    if (savedIdb) return;

    // 3. Fallback to localStorage if IndexedDB is blocked (e.g. private mode)
    try {
      window.localStorage.setItem(name, value);
    } catch (err) {
      console.error('[WordNest Storage] Failed to persist state (quota exceeded?):', err);
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('wordnest:storage-quota-error'));
      }
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return;

    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      await desktopStorage.removeItem(name);
    }

    await idbRemove(name);

    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore cleanup errors
    }
  },
};
