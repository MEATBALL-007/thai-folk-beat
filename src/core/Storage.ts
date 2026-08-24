/**
 * localStorage with the sharp edges filed off.
 *
 * Access can throw outright — private browsing, disabled site data, and (the one
 * that matters here) a Tauri WebView2 window with an unusual origin. A demo must
 * never fail to start because a saved setting could not be read.
 */

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota or blocked storage — losing a high score is not worth a crash */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    safeSet(key, JSON.stringify(value));
  } catch {
    /* circular or non-serialisable — never our data, but never crash either */
  }
}

export function readNumber(key: string, fallback: number): number {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function writeNumber(key: string, value: number): void {
  safeSet(key, String(value));
}
