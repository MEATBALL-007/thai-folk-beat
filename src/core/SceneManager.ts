import { Container, type Application } from 'pixi.js';
import type { Layout } from './Layout';
import { Scene } from './Scene';

export interface SceneContext {
  app: Application;
  layout: Layout;
  scenes: SceneManager;
}

/** Crossfade duration, spec §5. */
export const FADE_MS = 250;

/**
 * Stack-based screen manager with a 250ms crossfade.
 *
 * Timing note: this uses ticker deltaMS, NOT the Conductor. That is deliberate
 * and does not violate spec §2 — §2 governs the *song* clock. UI easing has no
 * relationship to audio and must keep running when no song is playing.
 *
 * Only the top scene receives update(). A scene fading out during replace() is
 * already popped, so it renders frozen for those 250ms. See NOTES.md.
 */
export class SceneManager {
  private readonly layer = new Container();
  private readonly stack: Scene[] = [];
  private readonly ctx: SceneContext;
  private busy = false;

  constructor(app: Application, layout: Layout) {
    this.ctx = { app, layout, scenes: this };
    layout.root.addChild(this.layer);
  }

  /** True while a crossfade is running. Input must be gated on this. */
  get isTransitioning(): boolean {
    return this.busy;
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Swap the top scene out and destroy it. The normal forward navigation. */
  async replace(next: Scene): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    const prev = this.stack.pop();
    await this.mount(next);

    await Promise.all([
      this.fade(next.container, 0, 1),
      prev ? this.fade(prev.container, 1, 0) : Promise.resolve(),
    ]);

    if (prev) this.unmount(prev);
    this.busy = false;
  }

  /** Layer a scene on top, keeping the one below alive (e.g. Settings over Title). */
  async push(next: Scene): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    await this.mount(next);
    await this.fade(next.container, 0, 1);

    this.busy = false;
  }

  /** Discard the top scene, revealing the one beneath. */
  async pop(): Promise<void> {
    if (this.busy || this.stack.length < 2) return;
    this.busy = true;

    const leaving = this.stack.pop();
    if (leaving) {
      await this.fade(leaving.container, 1, 0);
      this.unmount(leaving);
    }

    this.busy = false;
  }

  update(dtMS: number): void {
    this.top?.update(dtMS);
  }

  private async mount(scene: Scene): Promise<void> {
    scene._attach(this.ctx);
    scene.container.alpha = 0;
    this.layer.addChild(scene.container);
    await scene.onEnter();
    this.stack.push(scene);
  }

  private unmount(scene: Scene): void {
    scene.onExit();
    this.layer.removeChild(scene.container);
    scene.destroy();
  }

  /**
   * Crossfade one container.
   *
   * Progress is measured against the wall clock, not accumulated ticker deltas.
   * Pixi clamps deltaMS (100ms max), so a frame-accumulated fade never finishes
   * while frames are slow — the outgoing scene stays visible and, because
   * `busy` is held for the whole fade, navigation appears to stop responding.
   * With the wall clock a stalled frame just resolves the fade in one step.
   *
   * This is UI easing with no relation to the song clock, so performance.now()
   * is the right source here (spec §2 governs the Conductor, not transitions).
   */
  private fade(target: Container, from: number, to: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const startedAt = performance.now();
      target.alpha = from;

      const step = (): void => {
        const k = Math.min((performance.now() - startedAt) / FADE_MS, 1);
        target.alpha = from + (to - from) * k;
        if (k >= 1) {
          this.ctx.app.ticker.remove(step);
          resolve();
        }
      };

      this.ctx.app.ticker.add(step);
    });
  }
}
