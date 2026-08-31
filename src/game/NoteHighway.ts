import { Container, Graphics, Text } from 'pixi.js';
import { ART, C, FONT } from '../ui/theme';
import type { Lane } from '../audio/types';
import type { ChartNote } from './Chart';

/**
 * Geometry, in design-space pixels.
 *
 * These are MEASURED from the delivered stage art rather than chosen (see
 * scripts/measure-sprites.mjs and the gp.lane* entries in the manifest). The
 * receptors are painted into the artwork, so the notes have to line up with
 * where the designer put them — deriving the lanes from an even spread would
 * leave every note landing slightly off its target.
 */
export const LANE_COUNT = 4;
/** Centre of each painted receptor disc, left to right. */
export const LANE_CENTERS = [671.5, 863.5, 1054.5, 1244.5] as const;
export const LANE_W = 168;
export const HIGHWAY_X = LANE_CENTERS[0] - LANE_W / 2;
export const HIGHWAY_W = LANE_CENTERS[3] - LANE_CENTERS[0] + LANE_W;
export const RECEPTOR_Y = 946.5;
export const RECEPTOR_R = 79;
export const NOTE_R = 58;

/** Notes are clipped to this band so they never overlap the proscenium. */
const LANE_TOP = 96;

/** Notes enter from above the top edge so they never "pop" into view. */
const SPAWN_Y = -NOTE_R * 2;

/** Spec §3.2 lane -> instrument. Shown under each receptor. */
const LANE_INSTRUMENT: readonly string[] = ['กลอง', 'โปงลาง', 'พิณ', 'แคน'];

export function laneCenterX(lane: Lane): number {
  return LANE_CENTERS[lane];
}

export function laneLeft(lane: Lane): number {
  return laneCenterX(lane) - LANE_W / 2;
}

/**
 * Lanes 0/2 read green, lanes 1/3 gold (spec §6).
 *
 * These stay exactly as specified even though the menus moved to the delivered
 * art palette: the colours are semantic here (green = PERFECT, gold = GOOD,
 * red = MISS) and changing them would desync the notes from the verdict popups.
 * Only the surrounding field was restyled. See NOTES.md D24.
 */
export function laneColor(lane: Lane): number {
  return lane % 2 === 0 ? C.green : C.gold;
}

/**
 * The falling-note view.
 *
 * Position is a pure function of songTime — no per-note velocity is integrated
 * frame to frame. That matters: an integrated position would accumulate the same
 * drift spec §2 bans from the clock, and a single long frame would visibly shift
 * every note. Here a stalled frame simply draws the correct position late.
 *
 * Visually the board is built to match the delivered menu art: a wooden panel
 * with a brown border, cream lanes, and discs styled like the region buttons.
 */
export class NoteHighway {
  readonly container = new Container();
  /** Receptors are exposed so Gameplay can attach pointer hit-testing (§4.5). */
  readonly receptors: Graphics[] = [];

  private readonly laneGlowGfx = new Graphics();
  /** Notes live in their own layer so they can be clipped to the board. */
  private readonly notesLayer = new Container();
  private readonly noteGfx: Graphics[] = [];
  private readonly chart: ChartNote[];
  private readonly hidden: boolean[];
  private readonly receptorFlash = [0, 0, 0, 0];
  private readonly laneGlow = [0, 0, 0, 0];

  constructor(chart: ChartNote[]) {
    this.chart = chart;
    this.hidden = new Array<boolean>(chart.length).fill(false);

    this.buildBoard();
    this.container.addChild(this.laneGlowGfx);
    this.buildHitLine();
    this.buildReceptors();
    this.buildNotes();
    this.buildInstrumentLabels();
    this.buildProgressTrack();
  }

  /**
   * Lane tracks, drawn straight onto the stage.
   *
   * The old opaque wooden board is gone: the delivered art IS the backdrop, and
   * covering it with a panel would hide the stage the designer drew. These are
   * translucent so the boards of the stage floor read through them, while still
   * giving the notes enough contrast to be followed at speed.
   */
  private buildBoard(): void {
    const g = new Graphics();

    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      g.roundRect(laneLeft(lane), LANE_TOP, LANE_W, RECEPTOR_Y - LANE_TOP, 18).fill({
        color: C.paper,
        alpha: 0.17,
      });
      g.roundRect(laneLeft(lane), LANE_TOP, LANE_W, RECEPTOR_Y - LANE_TOP, 18).stroke({
        width: 3,
        color: ART.pale,
        alpha: 0.3,
        alignment: 0,
      });
    }

    this.container.addChild(g);
  }

  /** The judgement line, with a small ornament cap at each end. */
  private buildHitLine(): void {
    const g = new Graphics();
    const y = RECEPTOR_Y;

    g.rect(HIGHWAY_X - 14, y - 2, HIGHWAY_W + 28, 4).fill({ color: ART.pale, alpha: 0.45 });

    for (const x of [HIGHWAY_X - 14, HIGHWAY_X + HIGHWAY_W + 14]) {
      g.circle(x, y, 9).fill({ color: ART.pale, alpha: 0.75 });
    }

    this.container.addChild(g);
  }

  private buildReceptors(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      const g = new Graphics();
      g.position.set(laneCenterX(lane), RECEPTOR_Y);
      this.receptors.push(g);
      this.container.addChild(g);
    }
    this.drawReceptors();
  }

  /**
   * Song progress, drawn along the TOP of the board. It used to sit at the
   * bottom, where it ran straight through the instrument name plates.
   */
  private buildProgressTrack(): void {
    const g = new Graphics()
      .roundRect(HIGHWAY_X, 58, HIGHWAY_W, 10, 5)
      .fill({ color: ART.pale, alpha: 0.28 });
    this.container.addChild(g);
  }

  /** Thai instrument name under each lane — the game is about these four. */
  private buildInstrumentLabels(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      const name = LANE_INSTRUMENT[i] ?? '';

      const cx = laneCenterX(lane);
      const cy = RECEPTOR_Y + 84;

      const text = new Text({
        text: name,
        style: { fontFamily: FONT.body, fontSize: 26, fill: ART.pale },
      });
      text.anchor.set(0.5);
      text.position.set(cx, cy);

      this.container.addChild(text);
    }
  }

  private buildNotes(): void {
    // Clip to the board interior: notes spawn above the top edge, and without a
    // mask they were visible floating over the frame before entering the lanes.
    const clip = new Graphics()
      .roundRect(HIGHWAY_X - 8, LANE_TOP, HIGHWAY_W + 16, RECEPTOR_Y + 40 - LANE_TOP, 20)
      .fill(0xffffff);
    this.container.addChild(this.notesLayer, clip);
    this.notesLayer.mask = clip;

    for (const note of this.chart) {
      const colour = laneColor(note.lane);
      const g = new Graphics()
        // Soft shadow under the disc.
        .circle(0, 4, NOTE_R)
        .fill({ color: ART.wood, alpha: 0.22 })
        // Body.
        .circle(0, 0, NOTE_R)
        .fill(colour)
        // Pale rim, matching the region discs' cream ring.
        .circle(0, 0, NOTE_R)
        .stroke({ width: 6, color: ART.pale, alignment: 0 })
        // Highlight arc, top-left, for a little dimension.
        .circle(-NOTE_R * 0.3, -NOTE_R * 0.32, NOTE_R * 0.42)
        .fill({ color: ART.pale, alpha: 0.3 });

      g.visible = false;
      g.position.set(laneCenterX(note.lane), SPAWN_Y);
      this.noteGfx.push(g);
      this.notesLayer.addChild(g);
    }
  }

  private drawReceptors(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      const g = this.receptors[i];
      if (!g) continue;

      const flash = this.receptorFlash[i] ?? 0;
      const colour = laneColor(lane);
      g.clear();

      // No idle disc: the delivered art paints the receptor, and filling over
      // it would hide the instrument icon the designer drew inside. Only the
      // hit feedback is drawn here, on top of the artwork.
      if (flash > 0) {
        g.circle(0, 0, RECEPTOR_R).fill({ color: colour, alpha: flash });
        // Expanding shockwave on a hit.
        g.circle(0, 0, RECEPTOR_R + (1 - flash) * 34).stroke({
          width: 5 * flash,
          color: colour,
          alpha: flash * 0.8,
        });
      }

      if (flash > 0) {
        g.circle(0, 0, RECEPTOR_R).stroke({
          width: 4 + 5 * flash,
          color: colour,
          alignment: 0,
        });
      }
    }
  }

  /** Hide a note once it has been judged, hit or missed. */
  markJudged(noteIndex: number): void {
    this.hidden[noteIndex] = true;
    const g = this.noteGfx[noteIndex];
    if (g) g.visible = false;
  }

  flashReceptor(lane: Lane, strength = 1): void {
    this.receptorFlash[lane] = strength;
    this.laneGlow[lane] = strength;
  }

  /**
   * @param songTime the Conductor's clock — the ONLY input to note position.
   * @param scrollSec how long a note is visible before its hit time (§4.1).
   */
  update(songTime: number, scrollSec: number, dtMS: number): void {
    const travel = RECEPTOR_Y - SPAWN_Y;

    for (let i = 0; i < this.chart.length; i++) {
      const note = this.chart[i];
      const g = this.noteGfx[i];
      if (!note || !g) continue;

      if (this.hidden[i]) {
        g.visible = false;
        continue;
      }

      const remaining = note.time - songTime;

      // Off-screen above, or fallen well past the receptor.
      if (remaining > scrollSec || remaining < -0.35) {
        g.visible = false;
        continue;
      }

      // progress 0 at spawn -> 1 at the receptor. Overshoots past 1 for the
      // brief window where a late hit is still legal.
      const progress = 1 - remaining / scrollSec;
      g.visible = true;
      g.position.y = SPAWN_Y + travel * progress;

      // Ease up in scale over the last stretch so notes "arrive" rather than
      // simply passing a line.
      const near = Math.max(0, Math.min(1, (progress - 0.75) / 0.25));
      g.scale.set(0.9 + 0.1 * near);
    }

    for (let i = 0; i < LANE_COUNT; i++) {
      const f = this.receptorFlash[i] ?? 0;
      if (f > 0) this.receptorFlash[i] = Math.max(0, f - dtMS / 180);
      const glow = this.laneGlow[i] ?? 0;
      if (glow > 0) this.laneGlow[i] = Math.max(0, glow - dtMS / 260);
    }

    this.drawLaneGlow();
    this.drawReceptors();
  }

  /**
   * Lane light column on a hit (spec §8 polish). Drawn as a few stacked bands
   * fading upward — cheaper than a real gradient and reads the same at speed.
   */
  private drawLaneGlow(): void {
    this.laneGlowGfx.clear();

    for (let i = 0; i < LANE_COUNT; i++) {
      const glow = this.laneGlow[i] ?? 0;
      if (glow <= 0) continue;

      const lane = i as Lane;
      const x = laneLeft(lane);
      const bands = 7;
      const top0 = LANE_TOP;
      const span = RECEPTOR_Y - top0;

      for (let b = 0; b < bands; b++) {
        const h = span / bands;
        const top = RECEPTOR_Y - h * (b + 1);
        // Strongest at the receptor, vanishing toward the top of the lane.
        const alpha = glow * 0.3 * (1 - b / bands);
        this.laneGlowGfx.rect(x, top, LANE_W, h).fill({ color: laneColor(lane), alpha });
      }
    }
  }

  /** Design-space hit test for pointer/touch input (spec §4.5). */
  laneAtPoint(x: number, y: number): Lane | null {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      const cx = laneCenterX(lane);
      const dx = x - cx;
      const dy = y - RECEPTOR_Y;
      // Generous vertical band: a finger on a laptop trackpad is not precise,
      // and the teacher will be tapping this (§4.5).
      if (Math.abs(dx) <= LANE_W / 2 && Math.abs(dy) <= RECEPTOR_R * 2.2) return lane;
    }
    return null;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
