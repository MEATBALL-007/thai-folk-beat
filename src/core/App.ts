import { Application, Ticker } from 'pixi.js';
import { Layout } from './Layout';
import { SceneManager } from './SceneManager';
import type { Scene } from './Scene';
import { assetLoader } from './AssetLoader';
import { toggleFullscreen } from './platform';

/**
 * Owns the PixiJS Application, the letterbox Layout and the SceneManager,
 * and wires the frame loop and window resize to them.
 */
export class App {
  readonly pixi = new Application();
  readonly layout = new Layout();
  scenes!: SceneManager;

  async init(makeInitialScene: () => Scene): Promise<void> {
    await this.pixi.init({
      background: 0x000000, // the letterbox bars
      antialias: true,
      resolution: 1, // Settings' Resolution selector overrides this in Phase 5
      autoDensity: true,
      preference: 'webgl',
    });

    document.body.appendChild(this.pixi.canvas);

    // AssetLoader needs the renderer to rasterise placeholders (spec §6).
    assetLoader.setRenderer(this.pixi.renderer);
    this.pixi.stage.eventMode = 'static';
    this.pixi.stage.addChild(this.layout.root);

    this.scenes = new SceneManager(this.pixi, this.layout);

    // Drive resize ourselves rather than via `resizeTo`, so renderer and Layout
    // are guaranteed to update in that order within one event.
    const resize = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.pixi.renderer.resize(w, h);
      this.layout.resize(w, h);
    };
    window.addEventListener('resize', resize);
    resize();

    // F11 fullscreen (spec §7). Registered here rather than per-scene so it
    // works on every screen, including mid-song.
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code !== 'F11' || e.repeat) return;
      e.preventDefault();
      void toggleFullscreen();
    });

    this.pixi.ticker.add((ticker: Ticker) => {
      this.scenes.update(ticker.deltaMS);
    });

    await this.scenes.replace(makeInitialScene());
  }
}
