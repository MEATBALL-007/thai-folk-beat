import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { assetLoader } from '../../core/AssetLoader';

/** One frame of the dancer strip, in the source PNG. */
const DANCER_FRAME_W = 214;
const DANCER_FRAME_H = 331;
const DANCER_FRAMES = 10;
/** The delivered gif's own rate. */
const DANCER_FPS = 4;

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
export class Performers extends Container {
  private readonly frames: Texture[] = [];
  private readonly dancers: Sprite[] = [];
  private readonly phases: number[] = [];

  constructor() {
    super();

    const sheet = assetLoader.get('gp.dancer');
    for (let i = 0; i < DANCER_FRAMES; i++) {
      this.frames.push(
        new Texture({
          source: sheet.source,
          frame: new Rectangle(i * DANCER_FRAME_W, 0, DANCER_FRAME_W, DANCER_FRAME_H),
        }),
      );
    }

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
      this.phases.push((i / COUNT) * DANCER_FRAMES);
    }
  }

  update(songTime: number): void {
    for (let i = 0; i < this.dancers.length; i++) {
      const s = this.dancers[i];
      if (!s) continue;
      const n = Math.floor(songTime * DANCER_FPS + (this.phases[i] ?? 0)) % DANCER_FRAMES;
      const tex = this.frames[n < 0 ? n + DANCER_FRAMES : n];
      if (tex) s.texture = tex;
    }
  }
}
