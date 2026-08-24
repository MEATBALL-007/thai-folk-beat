import { Container, Graphics } from 'pixi.js';

/** Fixed design space. Every scene positions in these coordinates and never
 *  reads window dimensions directly. */
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

/**
 * 16:9 letterboxing.
 *
 * The renderer fills the window; `root` is scaled by the largest factor that
 * still fits 1920x1080 inside it, then centred. The leftover margin stays the
 * canvas's black background, producing bars on whichever axis is over-long.
 *
 * `root` is masked to the design rect so a scene that draws outside its bounds
 * cannot bleed into the bars.
 */
export class Layout {
  readonly root = new Container();
  private readonly frame = new Graphics();

  scale = 1;
  offsetX = 0;
  offsetY = 0;

  constructor() {
    this.frame.rect(0, 0, DESIGN_W, DESIGN_H).fill(0xffffff);
    this.root.addChild(this.frame);
    this.root.mask = this.frame;
  }

  resize(windowW: number, windowH: number): void {
    this.scale = Math.min(windowW / DESIGN_W, windowH / DESIGN_H);
    this.offsetX = Math.round((windowW - DESIGN_W * this.scale) / 2);
    this.offsetY = Math.round((windowH - DESIGN_H * this.scale) / 2);
    this.root.scale.set(this.scale);
    this.root.position.set(this.offsetX, this.offsetY);
  }

  /**
   * Screen (CSS pixel) -> design space. Needed in Phase 3 so pointer taps on the
   * receptors resolve to lane coordinates regardless of window size.
   */
  toDesign(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: (clientX - this.offsetX) / this.scale,
      y: (clientY - this.offsetY) / this.scale,
    };
  }
}
