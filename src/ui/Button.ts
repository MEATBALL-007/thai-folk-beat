import { Container, Graphics, Text } from 'pixi.js';
import { ART, C, FONT } from './theme';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'wood';

export interface ButtonOptions {
  label: string;
  onClick: () => void;
  width?: number;
  height?: number;
  fontSize?: number;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Optional small caption under the label, e.g. "เร็วๆ นี้". */
  sub?: string;
}

const FILL: Record<ButtonVariant, number> = {
  primary: C.green,
  ghost: C.paper,
  danger: C.red,
  // 'wood' matches the delivered menu art: a sign only a shade lighter than the
  // orange field, carried by its heavy brown outline rather than by contrast.
  wood: ART.woodFill,
};

const STROKE: Record<ButtonVariant, number> = {
  primary: C.ink,
  ghost: C.ink,
  danger: C.ink,
  wood: ART.wood,
};

const LABEL: Record<ButtonVariant, number> = {
  primary: C.ink,
  ghost: C.ink,
  danger: C.ink,
  wood: ART.wood,
};

const HOVER: Record<ButtonVariant, number> = {
  primary: C.gold,
  ghost: C.gold,
  danger: C.gold,
  wood: 0xffe3b4,
};

/**
 * The one button used by every menu screen.
 *
 * Hover/press states are drawn rather than tinted so the ink outline keeps its
 * weight — tinting a Graphics also tints its stroke, which makes the outline
 * fade on hover and look like a rendering bug.
 */
export class Button extends Container {
  private readonly face = new Graphics();
  private readonly labelText: Text;
  private readonly subText: Text | null = null;

  private readonly w: number;
  private readonly h: number;
  private readonly variant: ButtonVariant;

  private hovered = false;
  private pressing = false;
  private _disabled: boolean;

  constructor(opts: ButtonOptions) {
    super();

    this.w = opts.width ?? 460;
    this.h = opts.height ?? 108;
    this.variant = opts.variant ?? 'primary';
    this._disabled = opts.disabled ?? false;

    this.addChild(this.face);

    this.labelText = new Text({
      text: opts.label,
      style: {
        fontFamily: FONT.display,
        fontSize: opts.fontSize ?? 46,
       
        fill: LABEL[this.variant],
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.position.set(this.w / 2, opts.sub ? this.h / 2 - 12 : this.h / 2);
    this.addChild(this.labelText);

    if (opts.sub) {
      this.subText = new Text({
        text: opts.sub,
        // Ink at reduced alpha reads on both the paper and the green fills;
        // olive vanished against primary.
        style: { fontFamily: FONT.body, fontSize: 24, fill: LABEL[this.variant] },
      });
      this.subText.anchor.set(0.5);
      this.subText.alpha = 0.72;
      this.subText.position.set(this.w / 2, this.h / 2 + 28);
      this.addChild(this.subText);
    }

    this.eventMode = 'static';
    this.cursor = this._disabled ? 'default' : 'pointer';

    this.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.pressing = false;
      this.redraw();
    });
    this.on('pointerdown', () => {
      this.pressing = true;
      this.redraw();
    });
    this.on('pointerup', () => {
      this.pressing = false;
      this.redraw();
    });
    this.on('pointertap', () => {
      if (this._disabled) return;
      opts.onClick();
    });

    this.redraw();
  }

  get disabled(): boolean {
    return this._disabled;
  }

  setDisabled(v: boolean): void {
    this._disabled = v;
    this.cursor = v ? 'default' : 'pointer';
    this.redraw();
  }

  private redraw(): void {
    const r = this.variant === 'wood' ? 26 : 20;
    const base = FILL[this.variant];
    const stroke = STROKE[this.variant];
    const strokeW = this.variant === 'wood' ? 9 : 5;
    const active = !this._disabled && this.hovered;

    this.face.clear();

    if (this._disabled) {
      this.face.roundRect(0, 0, this.w, this.h, r).fill({ color: C.olive, alpha: 0.25 });
      this.face.roundRect(0, 0, this.w, this.h, r).stroke({
        width: strokeW,
        color: stroke,
        alpha: 0.3,
        alignment: 0,
      });
      this.labelText.alpha = 0.4;
      if (this.subText) this.subText.alpha = 0.4;
      return;
    }

    this.labelText.alpha = 1;
    if (this.subText) this.subText.alpha = 0.72;

    // A small downward nudge on press reads as a physical button.
    const dy = this.pressing ? 3 : 0;
    this.face.position.y = dy;
    this.labelText.position.y = (this.subText ? this.h / 2 - 12 : this.h / 2) + dy;
    if (this.subText) this.subText.position.y = this.h / 2 + 28 + dy;

    if (!this.pressing) {
      // Drop shadow, so the press nudge has something to move against.
      this.face.roundRect(0, 6, this.w, this.h, r).fill({ color: stroke, alpha: 0.22 });
    }

    this.face.roundRect(0, 0, this.w, this.h, r).fill(active ? HOVER[this.variant] : base);
    this.face
      .roundRect(0, 0, this.w, this.h, r)
      .stroke({ width: strokeW, color: stroke, alignment: 0 });
  }
}
