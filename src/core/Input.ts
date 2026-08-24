import type { Lane } from '../audio/types';

/**
 * Lane bindings (spec §4.5). `event.code` is used rather than `event.key` so the
 * bindings survive a Thai keyboard layout — on a Thai layout the D key produces
 * "ก", but its code is still "KeyD".
 */
export const LANE_BY_CODE: Readonly<Record<string, Lane>> = {
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowUp: 2,
  ArrowRight: 3,
};

export type LanePressHandler = (lane: Lane, ctxTime: number) => void;

/**
 * Keyboard lane input.
 *
 * The critical detail (spec §2, §4.5): the timestamp is read INSIDE the event
 * handler, not on the next frame. At 60fps a frame is ~16.7ms — a third of the
 * entire ±45ms PERFECT window — so sampling the clock at render time would make
 * every hit feel mushy and bias judgement by up to a full frame.
 */
export class Input {
  private attached = false;
  /** Lanes currently held, so key-repeat and stuck keys cannot retrigger. */
  private held = new Set<Lane>();

  constructor(
    private readonly getCtxTime: () => number,
    private readonly onPress: LanePressHandler,
    private readonly onRelease?: (lane: Lane) => void,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    this.held.clear();
  }

  /** Shared entry point so pointer taps on the receptors judge identically. */
  press(lane: Lane, ctxTime: number): void {
    this.onPress(lane, ctxTime);
  }

  isHeld(lane: Lane): boolean {
    return this.held.has(lane);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Spec §4.5: key repeat must never generate a hit.
    if (e.repeat) return;

    const lane = LANE_BY_CODE[e.code];
    if (lane === undefined) return;

    // Arrow keys scroll the page in a browser; a rhythm game must not.
    e.preventDefault();

    if (this.held.has(lane)) return;
    this.held.add(lane);

    this.onPress(lane, this.getCtxTime());
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const lane = LANE_BY_CODE[e.code];
    if (lane === undefined) return;
    this.held.delete(lane);
    this.onRelease?.(lane);
  };

  /** Alt-tabbing away can swallow the keyup, leaving a lane stuck down. */
  private releaseAll = (): void => {
    for (const lane of this.held) this.onRelease?.(lane);
    this.held.clear();
  };
}
