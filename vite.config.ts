import { defineConfig } from 'vite';

export default defineConfig({
  // MUST stay './' — Tauri loads the bundle from the filesystem and an
  // absolute '/' base yields a blank white window. See NOTES.md.
  base: './',
  build: {
    target: 'chrome110',
    assetsInlineLimit: 0,
  },
  server: { port: 5173, strictPort: true },
});
