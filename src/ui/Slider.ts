import { Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';
import { ART, FONT } from './theme';

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  /** Snap increment. Omit for continuous. */
  step?: number;
  width?: number;
  /** Renders the current value, e.g. v => `${v}%`. */
  format?: (v: number) => string;
  onChange: (value: number) => void;
}

const TRACK_H = 16;
const KNOB_R = 26;

/**
 * Horizontal slider.
 *
 * Dragging uses Pixi's `globalpointermove`, which fires regardless of hit
 * testing — without it the knob stops following as soon as the cursor leaves
 * its own bounds, which is most of any real drag.
 */
export class Slider extends Container {
  private readonly track = new Graphics();
  private readonly knob = new Graphics();
  private readonly valueText: Text;
  private readonly opts: Required<Pick<SliderOptions, 'min' | 'max' | 'width'>> & SliderOptions;

  private value: number;
  private dragging = false;

  constructor(options: SliderOptions) {
    super();
    this.opts = { width: 620, ...options };
    this.value = this.clampSnap(options.value);

    const label = new Text({
      text: options.label,
      style: { fontFamily: FONT.body, fontSize: 36, fill: ART.wood },
    });
    label.anchor.set(0, 0.5);
    label.position.set(0, -46);

    this.valueText = new Text({
      text: this.formatted(),
      style: { fontFamily: FONT.display, fontSize: 34, fill: ART.tealDark },
    });
    this.valueText.anchor.set(1, 0.5);
    this.valueText.position.set(this.opts.width, -46);

    this.addChild(label, this.valueText, this.track, this.knob);

    this.track.eventMode = 'static';
    this.track.cursor = 'pointer';
    this.knob.eventMode = 'static';
    this.knob.cursor = 'grab';

    // Clicking anywhere on the track jumps the knob there and starts a drag,
    // which is what people expect from a volume slider.
    this.track.on('pointerdown', (e: FederatedPointerEvent) => this.startDrag(e));
    this.knob.on('pointerdown', (e: FederatedPointerEvent) => this.startDrag(e));

    this.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (this.dragging) this.moveTo(e);
    });

    const end = (): void => {
      this.dragging = false;
      this.knob.cursor = 'grab';
    };
    this.on('pointerup', end);
    this.on('pointerupoutside', end);
    // A pointerup that lands outside the app entirely still has to end the drag.
    window.addEventListener('pointerup', end);
    this.once('destroyed', () => window.removeEventListener('pointerup', end));

    this.eventMode = 'static';
    this.redraw();
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number, notify = false): void {
    const next = this.clampSnap(v);
    if (next === this.value) return;
    this.value = next;
    this.redraw();
    if (notify) this.opts.onChange(this.value);
  }

  private startDrag(e: FederatedPointerEvent): void {
    this.dragging = true;
    this.knob.cursor = 'grabbing';
    this.moveTo(e);
  }

  private moveTo(e: FederatedPointerEvent): void {
    const local = this.toLocal(e.global);
    const t = Math.max(0, Math.min(1, local.x / this.opts.width));
    const raw = this.opts.min + t * (this.opts.max - this.opts.min);
    const next = this.clampSnap(raw);

    if (next !== this.value) {
      this.value = next;
      this.redraw();
      this.opts.onChange(this.value);
    }
  }

  private clampSnap(v: number): number {
    const { min, max, step } = this.opts;
    let out = Math.max(min, Math.min(max, v));
    if (step && step > 0) out = Math.round(out / step) * step;
    // Kill float dust from the snap (0.7000000000000001 -> 0.7).
    return Math.round(out * 1000) / 1000;
  }

  private formatted(): string {
    return this.opts.format ? this.opts.format(this.value) : String(Math.round(this.value));
  }

  private get ratio(): number {
    const span = this.opts.max - this.opts.min;
    return span === 0 ? 0 : (this.value - this.opts.min) / span;
  }

  private redraw(): void {
    const w = this.opts.width;
    const x = w * this.ratio;

    this.track.clear();
    // Generous invisible hit band — a 16px track is hard to hit on a trackpad.
    this.track.rect(0, -KNOB_R, w, KNOB_R * 2).fill({ color: ART.wood, alpha: 0 });
    this.track.roundRect(0, -TRACK_H / 2, w, TRACK_H, TRACK_H / 2).fill(ART.woodFill);
    this.track.roundRect(0, -TRACK_H / 2, x, TRACK_H, TRACK_H / 2).fill(ART.teal);
    this.track
      .roundRect(0, -TRACK_H / 2, w, TRACK_H, TRACK_H / 2)
      .stroke({ width: 4, color: ART.wood, alignment: 0 });

    this.knob.clear();
    this.knob.position.set(x, 0);
    this.knob.circle(0, 0, KNOB_R).fill(ART.discRing);
    this.knob.circle(0, 0, KNOB_R).stroke({ width: 5, color: ART.wood, alignment: 0 });

    this.valueText.text = this.formatted();
  }
}
