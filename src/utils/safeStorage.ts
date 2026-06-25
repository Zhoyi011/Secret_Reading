/**
 * Safe Storage Utilities
 * Wraps localStorage and sessionStorage with try-catch blocks to prevent SecurityError
 * crashes in sandboxed iframe environments where browser cookies or storage permissions may be blocked.
 */

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to getItem for key "${key}":`, e);
    }
    return null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to setItem for key "${key}":`, e);
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to removeItem for key "${key}":`, e);
    }
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (e) {
      console.warn('[SafeStorage] Failed to clear localStorage:', e);
    }
  }
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to get sessionStorage item for key "${key}":`, e);
    }
    return null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to set sessionStorage item for key "${key}":`, e);
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Failed to remove sessionStorage item for key "${key}":`, e);
    }
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch (e) {
      console.warn('[SafeStorage] Failed to clear sessionStorage:', e);
    }
  }
};
