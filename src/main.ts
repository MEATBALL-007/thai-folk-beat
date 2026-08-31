// Fonts are bundled locally (spec §1: zero CDN links, must work offline).
import './ui/fonts.css';

import { App } from './core/App';
import { assetLoader } from './core/AssetLoader';
import { settings } from './core/Settings';
import { audio } from './audio/engine';
import { LoadingScene } from './scenes/Loading';
import { goDevScene, goTitle } from './scenes/nav';

/**
 * A @font-face is only fetched once some glyph needs it. PixiJS rasterises text
 * immediately and would bake the fallback font into its atlas, so force the face
 * in before first render.
 *
 * One of the samples carries a stacked tone mark on purpose: the browser can
 * report a face ready before the mark-positioning tables have been applied, and
 * a Thai UI notices that immediately.
 */
async function loadFonts(): Promise<void> {
  const specs = ['400 64px "Phrikthai Dam"', 'italic 400 64px "Phrikthai Dam"'];
  const samples = ['ก', 'เร็วๆ นี้', 'A0'];

  await Promise.all(
    specs.flatMap((spec) => samples.map((s) => document.fonts.load(spec, s))),
  );
  await document.fonts.ready;
}

async function main(): Promise<void> {
  await loadFonts();

  const app = new App();

  // BOOT (spec §5): load the art manifest behind the loading screen, then Title.
  await app.init(
    () =>
      new LoadingScene({
        detail: 'THAI FOLK BEAT',
        task: async (report) => {
          const result = await assetLoader.loadAll((p) => report(p.loaded / p.total));
          if (result.missing.length) {
            console.info(
              `[boot] ${result.missing.length} placeholder asset(s) in use — see public/assets/README.md`,
            );
          }
        },
        onDone: () => {
          const want = import.meta.env.DEV
            ? new URLSearchParams(location.search).get('scene')
            : null;
          // Marks the end of boot for the screenshot harness. Boot takes ~16s
          // under software rendering, and a fixed delay just photographs the
          // loading screen instead of the scene under test.
          if (import.meta.env.DEV) {
            (window as unknown as { __tfbBooted?: boolean }).__tfbBooted = true;
          }
          if (want && goDevScene(app.scenes, want)) return;
          goTitle(app.scenes);
        },
      }),
  );

  // DEV-only handle so the headless harness can tap the master bus and confirm
  // the game is actually making sound. Stripped from production.
  if (import.meta.env.DEV) {
    (window as unknown as { __tfbAudio?: unknown }).__tfbAudio = audio;
    (window as unknown as { __tfbApp?: unknown }).__tfbApp = app;
  }

  // Apply persisted settings to the live audio graph and renderer.
  audio.setMusicVolume(settings.music);
  audio.setSfxVolume(settings.sound);
  audio.conductor.userOffsetMs = settings.offsetMs;
  app.pixi.renderer.resize(window.innerWidth, window.innerHeight, settings.resolutionScale);
  app.layout.resize(window.innerWidth, window.innerHeight);
}

void main();
