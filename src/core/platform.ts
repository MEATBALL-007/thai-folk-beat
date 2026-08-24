/**
 * Runtime host detection. The same bundle ships as a web page and inside the
 * Tauri WebView2 window, and a couple of behaviours differ (spec §5.1's EXIT).
 */

export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

/**
 * Closes the desktop window.
 * @returns false when running on the web, so the caller can show the
 * "ปิดหน้าต่างได้เลย" overlay instead (spec §5.1).
 */
export async function exitApp(): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    // Dynamic import: Rollup code-splits it, so the web build never pays for a
    // module it cannot use.
    const mod = await import('@tauri-apps/api/window');
    await mod.getCurrentWindow().close();
    return true;
  } catch (err) {
    console.warn('[platform] window close failed', err);
    return false;
  }
}

/**
 * F11 fullscreen toggle (spec §7).
 *
 * Prefers Tauri's window API, which resizes the actual OS window; falls back to
 * the DOM Fullscreen API so the same key works in the browser build.
 */
export async function toggleFullscreen(): Promise<void> {
  if (isTauri()) {
    try {
      const mod = await import('@tauri-apps/api/window');
      const win = mod.getCurrentWindow();
      const full = await win.isFullscreen();
      await win.setFullscreen(!full);
      return;
    } catch (err) {
      console.warn('[platform] tauri fullscreen failed, falling back to DOM', err);
    }
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (err) {
    // Some browsers refuse outside a user gesture — not worth interrupting play.
    console.warn('[platform] fullscreen request refused', err);
  }
}
