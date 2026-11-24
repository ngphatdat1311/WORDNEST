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

function getDesktopStorage(): WordNestDesktopBridge['storage'] | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { wordnestDesktop?: WordNestDesktopBridge };
  return w.wordnestDesktop?.storage;
}

/**
 * Storage adapter resilient to:
 * 1) Electron dynamic localhost port changes (persists durably in app userData JSON file)
 * 2) Browser localStorage 5MB QuotaExceededError (fails gracefully without crashing app)
 * 3) First-time migration from legacy Electron localStorage to userData file storage
 */
export const wordNestStateStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;

    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      try {
        const diskVal = desktopStorage.getItemSync(name);
        if (diskVal !== null) return diskVal;
      } catch {
        // Fallback to localStorage below
      }

      // Seamless one-time migration from legacy Electron localStorage -> userData file
      try {
        const legacyVal = window.localStorage.getItem(name);
        if (legacyVal !== null) {
          void desktopStorage.setItem(name, legacyVal);
          return legacyVal;
        }
      } catch {
        // Ignore storage read errors
      }
      return null;
    }

    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;

    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      void desktopStorage.setItem(name, value);
      // Mirror best-effort to localStorage so the pre-hydration theme script stays in sync
      try {
        window.localStorage.setItem(name, value);
      } catch {
        // Ignore localStorage quota limits when disk storage is the source of truth
      }
      return;
    }

    try {
      window.localStorage.setItem(name, value);
    } catch (err) {
      console.error('[WordNest Storage] Failed to persist state (quota exceeded?):', err);
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('wordnest:storage-quota-error'));
      }
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;

    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      void desktopStorage.removeItem(name);
    }

    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore cleanup errors
    }
  },
};
