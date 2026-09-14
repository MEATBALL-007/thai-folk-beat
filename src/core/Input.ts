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
 *
 * Held state is tracked per KEY CODE, not per lane. It used to be per lane, and
 * that was a real bug: two codes share each lane (D and ArrowLeft are both lane
 * 0), so a single swallowed `keyup` — which the OS does during a stall or a
 * focus change — left the lane marked held and killed BOTH of its keys for the
 * rest of the song. That is the "some keys just stop working" report.
 *
 * Keyed by code, a lost keyup can only affect the one key it belongs to, and the
 * safety net below clears even that.
 */
export class Input {
  private attached = false;
  /** Key codes currently down, so key-repeat cannot retrigger a hit. */
  private held = new Set<string>();

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
    // Alt-tab and lock-screen can deliver a visibility change without a blur.
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.held.clear();
  }

  /** Shared entry point so pointer taps on the receptors judge identically. */
  press(lane: Lane, ctxTime: number): void {
    this.onPress(lane, ctxTime);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Spec §4.5: key repeat must never generate a hit. This alone stops a held
    // key machine-gunning; the held set exists for release tracking.
    if (e.repeat) return;

    const lane = LANE_BY_CODE[e.code];
    if (lane === undefined) return;

    // Arrow keys scroll the page in a browser; a rhythm game must not.
    e.preventDefault();

    if (this.held.has(e.code)) return;
    this.held.add(e.code);

    this.onPress(lane, this.getCtxTime());
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const lane = LANE_BY_CODE[e.code];
    if (lane === undefined) return;
    this.held.delete(e.code);
    this.onRelease?.(lane);
  };

  private onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  /** Losing focus can swallow the keyup, leaving a key stuck down. */
  private releaseAll = (): void => {
    for (const code of this.held) {
      const lane = LANE_BY_CODE[code];
      if (lane !== undefined) this.onRelease?.(lane);
    }
    this.held.clear();
  };
}
