import { Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { layerSprite } from '../ui/artLayer';

/** Spec §5.6: never flash — hold the screen for at least this long. */
const MIN_DISPLAY_MS = 1200;

/** Instrument icons, cycled while the bar fills. */
const ICON_KEYS = ['load.icon0', 'load.icon1', 'load.icon2', 'load.icon3'] as const;
/** ms each icon is shown. */
const ICON_MS = 320;

/**
 * The progress bar's inner area, measured from the delivered bar frame's alpha
 * bounds (load.bar: centre 931,605.5, size 484x167). The frame is a thick
 * hand-drawn outline, so the fill is inset well inside it.
 */
const BAR_X = 931 - 484 / 2 + 34;
const BAR_Y = 605.5 - 22;
const BAR_W = 484 - 68;
const BAR_H = 44;

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
  private icons: Sprite[] = [];
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

    // The delivered loading art carries the whole background: orange field,
    // teal rule and corner flourishes, and the faint instrument watermarks.
    this.container.addChild(layerSprite('load.bg'));

    // ---- heading ---------------------------------------------------------
    const heading = new Text({
      text: 'กำลังโหลด',
      style: { fontFamily: FONT.display, fontSize: 62, fill: ART.tealDark },
    });
    heading.anchor.set(0.5);
    heading.position.set(DESIGN_W / 2 - 24, 745);

    // Kept separate so the heading does not jitter as dots are added —
    // centring a growing string would shift the whole word.
    this.ellipsis = new Text({
      text: '',
      style: { fontFamily: FONT.display, fontSize: 62, fill: ART.tealDark },
    });
    this.ellipsis.anchor.set(0, 0.5);
    this.ellipsis.position.set(DESIGN_W / 2 + 128, 745);

    // ---- instrument icons -------------------------------------------------
    // One sprite per icon, all stacked; only the active one is visible. Cycling
    // the alpha avoids re-uploading a texture every frame.
    this.icons = ICON_KEYS.map((key) => {
      const sprite = layerSprite(key);
      sprite.alpha = 0;
      this.container.addChild(sprite);
      return sprite;
    });

    // ---- progress bar ----------------------------------------------------
    // Drawn beneath the delivered frame, so the hand-drawn outline stays on top
    // of the fill rather than being covered by it.
    this.bar = new Graphics();
    this.container.addChild(heading, this.ellipsis, this.bar, layerSprite('load.bar'));

    this.percentText = new Text({
      text: '0%',
      style: { fontFamily: FONT.display, fontSize: 30, fill: ART.wood },
    });
    this.percentText.anchor.set(0.5, 0);
    this.percentText.position.set(931, 660);
    this.container.addChild(this.percentText);

    if (this.opts.detail) {
      const detail = new Text({
        text: this.opts.detail,
        style: { fontFamily: FONT.body, fontSize: 30, fill: ART.wood },
      });
      detail.anchor.set(0.5, 0);
      detail.alpha = 0.85;
      detail.position.set(931, 700);
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
    this.cycleIcons();
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

  /** Step through the four instruments while the bar fills. */
  private cycleIcons(): void {
    const active = Math.floor(this.elapsed / ICON_MS) % this.icons.length;
    for (let i = 0; i < this.icons.length; i++) {
      const sprite = this.icons[i];
      if (sprite) sprite.alpha = i === active ? 1 : 0;
    }
  }

  /** Fill only — the delivered frame is a separate layer drawn on top. */
  private drawBar(): void {
    this.bar.clear();
    this.bar.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, BAR_H / 2).fill(C.paper);
    if (this.shown > 0) {
      const fill = Math.max(BAR_H, BAR_W * this.shown);
      this.bar.roundRect(BAR_X, BAR_Y, fill, BAR_H, BAR_H / 2).fill(ART.teal);
      // Soft top highlight, so the fill reads as rounded rather than flat.
      this.bar
        .roundRect(BAR_X + 8, BAR_Y + 8, fill - 16, 11, 6)
        .fill({ color: ART.pale, alpha: 0.3 });
    }
  }
}
