import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { assetLoader } from '../../core/AssetLoader';

/** One frame of each strip, in the source PNG. Both keep the gif's own rate. */
const DANCER = { w: 214, h: 331, frames: 10, fps: 4 };
const COUPLE = { w: 396, h: 383, frames: 8, fps: 5 };

/**
 * Where the six dancers stand, in design-space pixels.
 *
 * Measured off the stage art: the wooden floor runs from about x 580 to x 1340,
 * and its front edge — where a performer's feet would be — sits at about y 500.
 * Sprites are anchored at the bottom centre so they stand ON that line rather
 * than being centred across it.
 */
const FLOOR_Y = 502;
const FLOOR_X0 = 622;
const FLOOR_X1 = 1300;
const COUNT = 6;
const SCALE = 0.42;

/**
 * The dancing couple, placed UPSTAGE of the six — higher on the floor and
 * smaller, which is what reads as further away on a flat backdrop. Added to the
 * container first so they draw behind.
 */
const COUPLE_Y = 424;
const COUPLE_X = 960;
const COUPLE_SCALE = 0.27;

/**
 * The performers dancing at the back of the stage.
 *
 * The designer asked for six ("ตัวละครผู้หญิงที่ร้ายอยู่จะมีหกคน นายก็อปวางเอานะ"), so
 * this is one sprite instanced six times. The important detail is the PHASE
 * OFFSET: without it all six land on the same frame at the same moment and the
 * row reads as one drawing pasted six times, which is exactly what it is. Spread
 * across the loop, it reads as a troupe.
 *
 * Animation is driven by SONG TIME, not by frame deltas, so the dancing keeps
 * time with the music and does not speed up or slow down with the frame rate.
 */
/** Wraps negative song time (the lead-in) back into the loop. */
function frameAt(songTime: number, fps: number, count: number, phase: number): number {
  const n = Math.floor(songTime * fps + phase) % count;
  return n < 0 ? n + count : n;
}

export class Performers extends Container {
  private readonly frames: Texture[] = [];
  private readonly dancers: Sprite[] = [];
  private readonly phases: number[] = [];

  private readonly coupleFrames: Texture[] = [];
  private readonly couple: Sprite;

  /** Slices a horizontal strip into its frames. */
  private static slice(key: string, w: number, h: number, count: number): Texture[] {
    const sheet = assetLoader.get(key);
    const out: Texture[] = [];
    for (let i = 0; i < count; i++) {
      out.push(new Texture({ source: sheet.source, frame: new Rectangle(i * w, 0, w, h) }));
    }
    return out;
  }

  constructor() {
    super();

    // Upstage first, so the six dancers draw in front of them.
    this.coupleFrames = Performers.slice('gp.couple', COUPLE.w, COUPLE.h, COUPLE.frames);
    this.couple = new Sprite(this.coupleFrames[0]);
    this.couple.anchor.set(0.5, 1);
    this.couple.scale.set(COUPLE_SCALE);
    this.couple.position.set(COUPLE_X, COUPLE_Y);
    this.couple.alpha = 0.78;
    this.addChild(this.couple);

    this.frames.push(...Performers.slice('gp.dancer', DANCER.w, DANCER.h, DANCER.frames));

    const gap = (FLOOR_X1 - FLOOR_X0) / (COUNT - 1);
    for (let i = 0; i < COUNT; i++) {
      const s = new Sprite(this.frames[0]);
      s.anchor.set(0.5, 1);
      s.scale.set(SCALE);
      s.position.set(FLOOR_X0 + i * gap, FLOOR_Y);
      // Slightly translucent so the notes crossing in front stay the brightest
      // thing on screen — the dancers are scenery, not the playfield.
      s.alpha = 0.9;
      this.addChild(s);
      this.dancers.push(s);
      this.phases.push((i / COUNT) * DANCER.frames);
    }
  }

  update(songTime: number): void {
    for (let i = 0; i < this.dancers.length; i++) {
      const s = this.dancers[i];
      if (!s) continue;
      const n = frameAt(songTime, DANCER.fps, DANCER.frames, this.phases[i] ?? 0);
      const tex = this.frames[n];
      if (tex) s.texture = tex;
    }

    const c = this.coupleFrames[frameAt(songTime, COUPLE.fps, COUPLE.frames, 0)];
    if (c) this.couple.texture = c;
  }
}
