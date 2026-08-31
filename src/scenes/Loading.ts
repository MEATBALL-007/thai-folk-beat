import { Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { layerSprite } from '../ui/artLayer';

/** Spec §5.6: never flash — hold the screen for at least this long. */
const MIN_DISPLAY_MS = 1200;

/** Lane colours, reused so the loader reads as part of the same game. */
const DOT_COLOURS = [C.green, C.gold, C.green, C.gold];

export interface LoadingOptions {
  /** The real work. Call `report(0..1)` as it progresses. */
  task: (report: (fraction: number) => void) => Promise<void>;
  onDone: () => void;
  /** Optional line under the bar, e.g. the song name. */
  detail?: string;
}

/**
 * Loading screen (spec §5.6).
 *
 * The bar is driven by genuine progress but eased toward the reported value, so
 * it reads as loading rather than snapping between 0 and 1. In this build the
 * real work is fast — audio is synthesised, and missing art becomes a generated
 * placeholder — so the 1.2s floor is usually what you are watching. That is
 * deliberate: a bar that blinks past looks broken.
 *
 * Styled to match the menus: the shared frame, a wooden panel, and four bouncing
 * discs in the lane colours so even the wait belongs to this game.
 */
export class LoadingScene extends Scene {
  private readonly opts: LoadingOptions;

  private bar!: Graphics;
  private dots!: Graphics;
  private percentText!: Text;
  private ellipsis!: Text;

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

    const field = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    this.container.addChild(field, layerSprite('bg.menuFrame'));

    // ---- wooden panel ----------------------------------------------------
    const pw = 900;
    const ph = 430;
    const px = (DESIGN_W - pw) / 2;
    const py = (DESIGN_H - ph) / 2;

    const panel = new Graphics()
      .roundRect(px + 6, py + 8, pw, ph, 28)
      .fill({ color: ART.wood, alpha: 0.16 })
      .roundRect(px, py, pw, ph, 28)
      .fill(ART.woodFill)
      .roundRect(px, py, pw, ph, 28)
      .stroke({ width: 8, color: ART.wood, alignment: 0 });

    // ---- heading ---------------------------------------------------------
    const heading = new Text({
      text: 'กำลังโหลด',
      style: { fontFamily: FONT.display, fontSize: 66, fill: ART.tealDark },
    });
    heading.anchor.set(0.5);
    heading.position.set(DESIGN_W / 2 - 26, py + 76);

    // Kept separate so the heading does not jitter as dots are added —
    // centring a growing string would shift the whole word.
    this.ellipsis = new Text({
      text: '',
      style: { fontFamily: FONT.display, fontSize: 66, fill: ART.tealDark },
    });
    this.ellipsis.anchor.set(0, 0.5);
    this.ellipsis.position.set(DESIGN_W / 2 + 136, py + 76);

    // ---- bouncing lane discs --------------------------------------------
    this.dots = new Graphics();
    this.dots.position.set(DESIGN_W / 2, py + 186);

    // ---- progress bar ----------------------------------------------------
    this.bar = new Graphics();
    this.bar.position.set(px + 100, py + 262);

    this.percentText = new Text({
      text: '0%',
      style: { fontFamily: FONT.display, fontSize: 32, fill: ART.wood },
    });
    this.percentText.anchor.set(0.5, 0);
    this.percentText.position.set(DESIGN_W / 2, py + 310);

    this.container.addChild(panel, heading, this.ellipsis, this.dots, this.bar, this.percentText);

    if (this.opts.detail) {
      const detail = new Text({
        text: this.opts.detail,
        style: { fontFamily: FONT.body, fontSize: 32, fill: ART.wood },
      });
      detail.anchor.set(0.5, 0);
      detail.alpha = 0.85;
      detail.position.set(DESIGN_W / 2, py + 358);
      this.container.addChild(detail);
    }

    this.drawBar();
    this.drawDots();

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
    this.drawDots();
    this.percentText.text = `${Math.round(this.shown * 100)}%`;

    const count = 1 + (Math.floor(this.elapsed / 320) % 3);
    this.ellipsis.text = '.'.repeat(count);

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

  /** Four discs bouncing in sequence — the game's four lanes, keeping time. */
  private drawDots(): void {
    this.dots.clear();
    const gap = 92;
    const x0 = -((DOT_COLOURS.length - 1) * gap) / 2;

    for (let i = 0; i < DOT_COLOURS.length; i++) {
      // Each disc lags the one before it, so the row reads left to right.
      const phase = this.elapsed / 300 - i * 0.55;
      const lift = Math.max(0, Math.sin(phase)) ** 2;
      const x = x0 + i * gap;
      const y = -lift * 26;
      const r = 22 + lift * 5;

      this.dots.circle(x, 12, 19).fill({ color: ART.wood, alpha: 0.18 * (1 - lift) + 0.05 });
      this.dots.circle(x, y, r).fill(DOT_COLOURS[i] ?? C.green);
      this.dots.circle(x, y, r).stroke({ width: 4, color: ART.pale, alignment: 0 });
    }
  }

  private drawBar(): void {
    const w = 700;
    const h = 34;
    this.bar.clear();
    this.bar.roundRect(0, 0, w, h, 17).fill(C.paper);
    if (this.shown > 0) {
      const fill = Math.max(h, w * this.shown);
      this.bar.roundRect(0, 0, fill, h, 17).fill(ART.teal);
      // Soft top highlight, so the fill reads as rounded rather than flat.
      this.bar.roundRect(7, 7, fill - 14, 9, 5).fill({ color: ART.pale, alpha: 0.3 });
    }
    this.bar.roundRect(0, 0, w, h, 17).stroke({ width: 6, color: ART.wood, alignment: 0 });
  }
}
