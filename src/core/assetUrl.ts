/**
 * Resolves an asset path, redirecting to an embedded copy when there is one.
 *
 * The offline build (scripts/build-offline.mjs) packs the whole game into a
 * single HTML file that people can download and double-click on Windows or
 * macOS with nothing installed. In that file there is no server and no
 * neighbouring `assets/` directory, so every asset is embedded as a data URI
 * and listed in this map.
 *
 * On the web build the map is absent and every path passes through untouched,
 * so this costs the hosted version nothing.
 */
declare global {
  interface Window {
    __TFB_ASSETS?: Record<string, string>;
  }
}

export function assetUrl(path: string): string {
  const map = typeof window === 'undefined' ? undefined : window.__TFB_ASSETS;
  if (!map) return path;
  // Paths reach here as 'assets/x/y.png'; tolerate a leading ./ or / too.
  return map[path] ?? map[path.replace(/^\.?\//, '')] ?? path;
}
