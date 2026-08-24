/**
 * The song clock. Spec §2: ALL timing derives from AudioContext.currentTime.
 *
 * Never drive this from requestAnimationFrame deltas, performance.now(),
 * setInterval or a PixiJS ticker accumulator — those drift against the audio
 * hardware clock and the game desyncs within ~20s.
 */
export class Conductor {
  private readonly ctx: AudioContext;
  private startTime = 0;
  private running = false;

  /** Calibration from Settings, −200..+200ms. */
  userOffsetMs = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /**
   * @param atCtxTime absolute AudioContext time the song begins. Pass a value
   * slightly in the future so the first notes can be scheduled before they play.
   */
  start(atCtxTime?: number): void {
    this.startTime = atCtxTime ?? this.ctx.currentTime;
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Seconds since song start, audio-accurate, INCLUDING the user's calibration
   * offset. This is the clock the renderer and the judge both read, so a player
   * whose display lags shifts notes and judgement together.
   */
  get songTime(): number {
    return this.ctx.currentTime - this.startTime + this.userOffsetMs / 1000;
  }

  /**
   * Song time with NO calibration applied. Audio is the ground truth and must be
   * scheduled against this, otherwise moving the offset slider would retune the
   * music instead of compensating for the display.
   */
  get rawTime(): number {
    return this.ctx.currentTime - this.startTime;
  }

  /** Uncalibrated song time -> absolute AudioContext time, for scheduling. */
  toCtxTime(rawSongTime: number): number {
    return this.startTime + rawSongTime;
  }

  /**
   * Convert an event timestamp captured at DOM-event dispatch into song time.
   * Spec §2/§4.5: judgement must use this, never the frame time.
   */
  ctxTimeToSongTime(ctxTime: number): number {
    return ctxTime - this.startTime + this.userOffsetMs / 1000;
  }
}
