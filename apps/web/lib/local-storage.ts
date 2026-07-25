/**
 * Safe browser localStorage accessors shared by client preferences
 * (dashboard layout, board defaults, etc.).
 */

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getLocalStorageItem(key: string): string | null {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function setLocalStorageItem(key: string, value: string): boolean {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorageItem(key: string): boolean {
  const storage = getBrowserLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getLocalStorageJson<T>(key: string): T | null {
  const raw = getLocalStorageItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setLocalStorageJson(key: string, value: unknown): boolean {
  try {
    return setLocalStorageItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
