import { Container } from 'pixi.js';
import type { SceneContext } from './SceneManager';

/**
 * Base class for every screen. A scene owns exactly one PIXI.Container
 * (spec §5) and is fully responsible for what goes in it.
 *
 * Lifecycle: construct -> _attach -> onEnter -> update* -> onExit -> destroy
 */
export abstract class Scene {
  readonly container = new Container();

  /** Injected by SceneManager immediately after construction. */
  protected ctx!: SceneContext;

  /** @internal */
  _attach(ctx: SceneContext): void {
    this.ctx = ctx;
  }

  /** Build the display list. May be async (asset loads in later phases). */
  onEnter(): void | Promise<void> {}

  /** Called once per frame while this scene is on top of the stack. */
  update(_dtMS: number): void {}

  /** Detach listeners here — the container is torn down separately. */
  onExit(): void {}

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
