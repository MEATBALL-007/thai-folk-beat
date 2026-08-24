import { Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, FONT } from '../ui/theme';

/** Spec §5.6: never flash — hold the screen for at least this long. */
const MIN_DISPLAY_MS = 1200;

export interface LoadingOptions {
  /** The real work. Call `report(0..1)` as it progresses. */
  task: (report: (fraction: number) => void) => Promise<void>;
  onDone: () => void;
  /** Optional line under the spinner, e.g. the song name. */
  detail?: string;
}

/**
 * Loading screen (spec §5.6).
 *
 * The bar is driven by genuine progress, but eased toward the reported value so
 * it reads as loading rather than snapping between 0 and 1. In this build the
 * real work is fast — audio is synthesised, and missing art becomes a generated
 * placeholder — so the 1.2s floor is usually what you are watching. That is
 * deliberate: a bar that blinks past looks broken. See NOTES.md.
 */
export class LoadingScene extends Scene {
  private readonly opts: LoadingOptions;

  private bar!: Graphics;
  private percentText!: Text;
  private dotsText!: Text;

  private target = 0;
  private shown = 0;
  /**
   * Wall clock, not accumulated frame deltas. Pixi clamps deltaMS (100ms max),
   * so a frame-accumulated timer stretches the 1.2s floor into many real
   * seconds whenever frames are slow — the loader would appear to hang.
   * This is UI timing with no relation to audio, so performance.now() is right.
   */
  private startedAt = 0;
  private elapsed = 0;
  private taskDone = false;
  private handedOff = false;

  constructor(opts: LoadingOptions) {
    super();
    this.opts = opts;
  }

  override onEnter(): void {
    this.startedAt = performance.now();

    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);

    const heading = new Text({
      text: 'กำลังโหลด',
      style: { fontFamily: FONT.display, fontSize: 84, fontWeight: '700', fill: ART.tealDark },
    });
    heading.anchor.set(0.5);
    heading.position.set(DESIGN_W / 2 - 40, DESIGN_H / 2 - 90);

    // Animated ellipsis kept separate so the heading does not jitter as dots are
    // added — centring a growing string would shift the whole word.
    this.dotsText = new Text({
      text: '',
      style: { fontFamily: FONT.display, fontSize: 84, fontWeight: '700', fill: ART.tealDark },
    });
    this.dotsText.anchor.set(0, 0.5);
    this.dotsText.position.set(DESIGN_W / 2 + 100, DESIGN_H / 2 - 90);

    this.bar = new Graphics();
    this.bar.position.set((DESIGN_W - 900) / 2, DESIGN_H / 2 + 20);

    this.percentText = new Text({
      text: '0%',
      style: { fontFamily: FONT.body, fontSize: 34, fill: ART.wood },
    });
    this.percentText.anchor.set(0.5, 0);
    this.percentText.position.set(DESIGN_W / 2, DESIGN_H / 2 + 80);

    this.container.addChild(bg, heading, this.dotsText, this.bar, this.percentText);

    if (this.opts.detail) {
      const detail = new Text({
        text: this.opts.detail,
        style: { fontFamily: FONT.body, fontSize: 36, fill: ART.wood },
      });
      detail.anchor.set(0.5);
      detail.position.set(DESIGN_W / 2, DESIGN_H / 2 + 170);
      this.container.addChild(detail);
    }

    this.drawBar();

    void this.opts
      .task((f) => {
        this.target = Math.max(this.target, Math.max(0, Math.min(1, f)));
      })
      .catch((err: unknown) => {
        // A failed load must not strand the player on this screen.
        console.error('[loading] task failed, continuing anyway', err);
      })
      .finally(() => {
        this.target = 1;
        this.taskDone = true;
      });
  }

  override update(dtMS: number): void {
    this.elapsed = performance.now() - this.startedAt;

    // Ease toward the reported value.
    this.shown += (this.target - this.shown) * Math.min(1, dtMS / 220);
    if (this.taskDone && this.elapsed >= MIN_DISPLAY_MS) this.shown = 1;

    this.drawBar();
    this.percentText.text = `${Math.round(this.shown * 100)}%`;

    const dots = 1 + (Math.floor(this.elapsed / 320) % 3);
    this.dotsText.text = '.'.repeat(dots);

    if (
      !this.handedOff &&
      this.taskDone &&
      this.elapsed >= MIN_DISPLAY_MS &&
      this.shown > 0.999
    ) {
      this.handedOff = true;
      this.opts.onDone();
    }
  }

  private drawBar(): void {
    const w = 900;
    const h = 40;
    this.bar.clear();
    this.bar.roundRect(0, 0, w, h, 12).fill(ART.woodFill);
    if (this.shown > 0) {
      this.bar.roundRect(0, 0, Math.max(12, w * this.shown), h, 12).fill(ART.teal);
    }
    this.bar.roundRect(0, 0, w, h, 12).stroke({ width: 6, color: ART.wood, alignment: 0 });
  }
}
