import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { assetLoader } from '../../core/AssetLoader';

/** One frame of each strip, in the source PNG. Both keep the gif's own rate. */
const DANCER = { w: 214, h: 331, frames: 10, fps: 4 };
const COUPLE = { w: 396, h: 383, frames: 8, fps: 5 };

/**
 * Everyone is drawn at the same world scale, because they are all standing on
 * the same stage — depth is read from where their feet land, not from size.
 */
const SCALE = 0.72;

/**
 * Stand positions, traced from the designer's mock-up (2026-08-31).
 *
 * The arrangement is a symmetric trio either side of the singers, and it is NOT
 * a single row: the middle dancer of each trio stands upstage on the wooden
 * floor, while the other four stand downstage on the red apron. That staggering
 * is what stops six copies of one sprite reading as a row of clones.
 *
 * `y` is where the feet land; sprites are anchored bottom-centre so they stand
 * on that line rather than straddling it.
 */
const APRON_Y = 575;
const FLOOR_Y = 440;

const DANCER_SPOTS: { x: number; y: number }[] = [
  { x: 405, y: APRON_Y },
  { x: 530, y: FLOOR_Y },
  { x: 660, y: APRON_Y },
  { x: 1260, y: APRON_Y },
  { x: 1390, y: FLOOR_Y },
  { x: 1515, y: APRON_Y },
];

/** The singers: centre stage, downstage of everyone, and the same size. */
const COUPLE_SPOT = { x: 960, y: 580 };

/** Wraps negative song time (the lead-in) back into the loop. */
function frameAt(songTime: number, fps: number, count: number, phase: number): number {
  const n = Math.floor(songTime * fps + phase) % count;
  return n < 0 ? n + count : n;
}

/**
 * The performers on stage: six dancers and the singing couple.
 *
 * The six come from one sprite instanced six times, so each gets its own PHASE
 * OFFSET. Without it all six land on the same frame at the same moment and the
 * troupe reads as one drawing pasted six times, which is exactly what it is.
 *
 * Animation is driven by SONG TIME, not by frame deltas, so the dancing keeps
 * time with the music rather than with the frame rate.
 */
export class Performers extends Container {
  private readonly frames: Texture[];
  private readonly coupleFrames: Texture[];
  private readonly dancers: Sprite[] = [];
  private readonly phases: number[] = [];
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

    this.frames = Performers.slice('gp.dancer', DANCER.w, DANCER.h, DANCER.frames);
    this.coupleFrames = Performers.slice('gp.couple', COUPLE.w, COUPLE.h, COUPLE.frames);

    this.couple = new Sprite(this.coupleFrames[0]);
    this.couple.anchor.set(0.5, 1);
    this.couple.scale.set(SCALE);
    this.couple.position.set(COUPLE_SPOT.x, COUPLE_SPOT.y);

    const cast: { sprite: Sprite; y: number }[] = [{ sprite: this.couple, y: COUPLE_SPOT.y }];

    DANCER_SPOTS.forEach((spot, i) => {
      const s = new Sprite(this.frames[0]);
      s.anchor.set(0.5, 1);
      s.scale.set(SCALE);
      s.position.set(spot.x, spot.y);
      this.dancers.push(s);
      this.phases.push((i / DANCER_SPOTS.length) * DANCER.frames);
      cast.push({ sprite: s, y: spot.y });
    });

    // Painter's order: whoever stands furthest upstage is added first, so the
    // downstage performers overlap them and not the other way round.
    for (const { sprite } of cast.sort((a, b) => a.y - b.y)) this.addChild(sprite);
  }

  update(songTime: number): void {
    for (let i = 0; i < this.dancers.length; i++) {
      const s = this.dancers[i];
      if (!s) continue;
      const tex = this.frames[frameAt(songTime, DANCER.fps, DANCER.frames, this.phases[i] ?? 0)];
      if (tex) s.texture = tex;
    }

    const c = this.coupleFrames[frameAt(songTime, COUPLE.fps, COUPLE.frames, 0)];
    if (c) this.couple.texture = c;
  }
}
