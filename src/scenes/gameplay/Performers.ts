import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { assetLoader } from '../../core/AssetLoader';
import type { SongDef } from '../../audio/types';

/** One frame of each strip, in the source PNG. Both keep the gif's own rate. */
const DANCER = { w: 214, h: 331, frames: 10, fps: 4 };
const COUPLE = { w: 396, h: 383, frames: 8, fps: 5 };
/** เซิ้ง ships its troupe already composed as a row, in two poses. */
const SOENG_CAST = { w: 1137, h: 354, frames: 2 };

/**
 * Everyone is drawn at the same world scale, because they are all standing on
 * the same stage — depth is read from where their feet land, not from size.
 */
const SCALE = 0.72;

/**
 * Stand positions for หมอลำ, traced from the designer's mock-up (2026-08-31).
 *
 * The arrangement is a symmetric trio either side of the singers, and it is NOT
 * a single row: the middle dancer of each trio stands upstage on the wooden
 * floor, while the other four stand downstage on the red apron. That staggering
 * is what stops six copies of one sprite reading as a row of clones.
 *
 * `y` is where the feet land; sprites are anchored bottom-centre so they stand
 * on that line rather than straddling it. The whole cast was moved 55px further
 * downstage on 2026-09-14 at the designer's request.
 */
const APRON_Y = 630;
const FLOOR_Y = 495;

const DANCER_SPOTS: { x: number; y: number }[] = [
  { x: 405, y: APRON_Y },
  { x: 530, y: FLOOR_Y },
  { x: 660, y: APRON_Y },
  { x: 1260, y: APRON_Y },
  { x: 1390, y: FLOOR_Y },
  { x: 1515, y: APRON_Y },
];

/** The singers: centre stage, downstage of everyone, and the same size. */
const COUPLE_SPOT = { x: 960, y: 635 };

/**
 * Where the เซิ้ง row sits, taken from its own position inside the delivered
 * 1920x1080 frame rather than chosen — the designer composed it in place.
 */
const SOENG_SPOT = { x: 944.5, y: 710 };

/** Wraps negative song time (the lead-in) back into the loop. */
function frameAt(songTime: number, fps: number, count: number, phase: number): number {
  const n = Math.floor(songTime * fps + phase) % count;
  return n < 0 ? n + count : n;
}

/** Slices a horizontal strip into its frames. */
function slice(key: string, w: number, h: number, count: number): Texture[] {
  const sheet = assetLoader.get(key);
  const out: Texture[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Texture({ source: sheet.source, frame: new Rectangle(i * w, 0, w, h) }));
  }
  return out;
}

/** One animated sprite plus the clock that drives it. */
interface Actor {
  sprite: Sprite;
  frames: Texture[];
  /** Frames per second, or `'beat'` to advance once per musical beat. */
  rate: number | 'beat';
  phase: number;
  y: number;
}

/**
 * The performers on stage.
 *
 * Each song ships a different cast, so this builds from the song rather than
 * assuming one layout:
 *
 * - หมอลำ: one dancer sprite instanced six times plus a singing couple. Because
 *   the six are copies, each gets its own PHASE OFFSET — without it all six land
 *   on the same frame at the same moment and the troupe reads as one drawing
 *   pasted six times, which is exactly what it is.
 * - เซิ้ง: the troupe arrives already composed as a row, in two poses. Those
 *   alternate ON THE BEAT rather than at a fixed frame rate: two poses cycling
 *   at some unrelated speed reads as a flicker, while two poses on the beat read
 *   as choreography.
 *
 * Everything is driven by SONG TIME, never by frame deltas, so the dancing keeps
 * time with the music rather than with the frame rate.
 */
export class Performers extends Container {
  private readonly actors: Actor[] = [];
  private readonly secondsPerBeat: number;

  constructor(song: SongDef) {
    super();
    this.secondsPerBeat = 60 / song.bpm;

    if (song.id === 'soeng') {
      const frames = slice('gp.soeng.cast', SOENG_CAST.w, SOENG_CAST.h, SOENG_CAST.frames);
      this.actors.push(this.add(frames, SOENG_SPOT.x, SOENG_SPOT.y, 1, 'beat', 0));
    } else {
      const dancer = slice('gp.molam.dancer', DANCER.w, DANCER.h, DANCER.frames);
      const couple = slice('gp.molam.couple', COUPLE.w, COUPLE.h, COUPLE.frames);

      this.actors.push(
        this.add(couple, COUPLE_SPOT.x, COUPLE_SPOT.y, SCALE, COUPLE.fps, 0),
        ...DANCER_SPOTS.map((spot, i) =>
          this.add(
            dancer,
            spot.x,
            spot.y,
            SCALE,
            DANCER.fps,
            (i / DANCER_SPOTS.length) * DANCER.frames,
          ),
        ),
      );
    }

    // Painter's order: whoever stands furthest upstage is added first, so the
    // downstage performers overlap them and not the other way round.
    for (const actor of [...this.actors].sort((a, b) => a.y - b.y)) this.addChild(actor.sprite);
  }

  private add(
    frames: Texture[],
    x: number,
    y: number,
    scale: number,
    rate: number | 'beat',
    phase: number,
  ): Actor {
    const sprite = new Sprite(frames[0]);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(scale);
    sprite.position.set(x, y);
    return { sprite, frames, rate, phase, y };
  }

  update(songTime: number): void {
    for (const actor of this.actors) {
      const fps = actor.rate === 'beat' ? 1 / this.secondsPerBeat : actor.rate;
      const tex = actor.frames[frameAt(songTime, fps, actor.frames.length, actor.phase)];
      if (tex) actor.sprite.texture = tex;
    }
  }
}
