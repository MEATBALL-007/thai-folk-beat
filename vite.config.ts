import { defineConfig } from 'vite';

/**
 * The offline build packs everything into one HTML file, which means one script
 * with no dynamic imports — a `file://` page cannot fetch sibling chunks, and
 * Pixi code-splits its renderers by default.
 */
const offline = process.env.TFB_OFFLINE === '1';

export default defineConfig({
  // MUST stay './' — Tauri loads the bundle from the filesystem and an
  // absolute '/' base yields a blank white window. See NOTES.md.
  base: './',
  build: {
    target: 'chrome110',
    assetsInlineLimit: 0,
    ...(offline
      ? {
          outDir: 'dist-offline',
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {}),
  },
  server: { port: 5173, strictPort: true },
});
