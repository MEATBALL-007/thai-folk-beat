import { Container, Graphics, Text } from 'pixi.js';
import { DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import type { Lane } from '../audio/types';
import type { ChartNote } from './Chart';

/** Spec §4.1 geometry, in design-space pixels. */
export const LANE_COUNT = 4;
export const LANE_W = 180;
export const LANE_GAP = 24;
export const HIGHWAY_W = LANE_COUNT * LANE_W + (LANE_COUNT - 1) * LANE_GAP; // 792
export const HIGHWAY_X = (DESIGN_W - HIGHWAY_W) / 2; // 564
export const RECEPTOR_Y = 880;
export const RECEPTOR_R = 62;
export const NOTE_R = 54;

/** The wooden board the lanes sit on, inside the frame's inner edge. */
const BOARD_PAD = 34;
const BOARD_X = HIGHWAY_X - BOARD_PAD;
const BOARD_W = HIGHWAY_W + BOARD_PAD * 2;
const BOARD_Y = 74;
const BOARD_H = 934; // stops just above the frame's bottom rule (~y 1010)
/** Wood margin at the top of the board, where the progress track lives. */
const LANE_TOP = BOARD_Y + 38;

/** Notes enter from above the top edge so they never "pop" into view. */
const SPAWN_Y = -NOTE_R * 2;

/** Spec §3.2 lane -> instrument. Shown under each receptor. */
const LANE_INSTRUMENT: readonly string[] = ['กลอง', 'โปงลาง', 'พิณ', 'แคน'];

export function laneLeft(lane: Lane): number {
  return HIGHWAY_X + lane * (LANE_W + LANE_GAP);
}

export function laneCenterX(lane: Lane): number {
  return laneLeft(lane) + LANE_W / 2;
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

  /** Wooden board + cream lanes, in the language of the menu panels. */
  private buildBoard(): void {
    const g = new Graphics();

    // Drop shadow, so the board sits on the field rather than floating.
    g.roundRect(BOARD_X + 6, BOARD_Y + 8, BOARD_W, BOARD_H, 30).fill({
      color: ART.wood,
      alpha: 0.18,
    });

    g.roundRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 30).fill(ART.woodFill);

    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      // Lanes run the full board height; the rounded board corners clip them
      // visually because the border is stroked on top.
      g.roundRect(laneLeft(lane), LANE_TOP, LANE_W, BOARD_H - 52, 16).fill({
        color: C.paper,
        alpha: 0.92,
      });
    }

    g.roundRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 30).stroke({
      width: 9,
      color: ART.wood,
      alignment: 0,
    });

    this.container.addChild(g);
  }

  /** The judgement line, with a small ornament cap at each end. */
  private buildHitLine(): void {
    const g = new Graphics();
    const y = RECEPTOR_Y;

    g.rect(BOARD_X + 18, y - 3, BOARD_W - 36, 6).fill({ color: ART.wood, alpha: 0.5 });

    for (const x of [BOARD_X + 18, BOARD_X + BOARD_W - 18]) {
      g.circle(x, y, 11).fill(ART.wood);
      g.circle(x, y, 4).fill(ART.woodFill);
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
      .roundRect(HIGHWAY_X, BOARD_Y + 14, HIGHWAY_W, 12, 6)
      .fill({ color: ART.wood, alpha: 0.22 });
    this.container.addChild(g);
  }

  /** Thai instrument name under each lane — the game is about these four. */
  private buildInstrumentLabels(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = i as Lane;
      const name = LANE_INSTRUMENT[i] ?? '';

      const plate = new Graphics();
      const w = 128;
      const h = 42;
      const cx = laneCenterX(lane);
      const cy = RECEPTOR_Y + 95;
      plate
        .roundRect(cx - w / 2, cy - h / 2, w, h, 14)
        .fill(ART.woodFill)
        .roundRect(cx - w / 2, cy - h / 2, w, h, 14)
        .stroke({ width: 4, color: laneColor(lane), alignment: 0 });

      const text = new Text({
        text: name,
        style: { fontFamily: FONT.body, fontSize: 24, fill: ART.wood },
      });
      text.anchor.set(0.5);
      text.position.set(cx, cy);

      this.container.addChild(plate, text);
    }
  }

  private buildNotes(): void {
    // Clip to the board interior: notes spawn above the top edge, and without a
    // mask they were visible floating over the frame before entering the lanes.
    const clip = new Graphics()
      .roundRect(BOARD_X + 10, LANE_TOP, BOARD_W - 20, BOARD_H - 48, 20)
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

      // Idle: a cream disc with a coloured ring — the same visual language as
      // the region-select buttons (spec §4.1: outlined, filled on hit).
      g.circle(0, 0, RECEPTOR_R).fill({ color: ART.discFill, alpha: 0.85 });

      if (flash > 0) {
        g.circle(0, 0, RECEPTOR_R).fill({ color: colour, alpha: flash });
        // Expanding shockwave on a hit.
        g.circle(0, 0, RECEPTOR_R + (1 - flash) * 34).stroke({
          width: 5 * flash,
          color: colour,
          alpha: flash * 0.8,
        });
      }

      g.circle(0, 0, RECEPTOR_R).stroke({
        width: 7 + 4 * flash,
        color: colour,
        alignment: 0,
      });
      // Inner hairline keeps the target readable against a bright flash.
      g.circle(0, 0, RECEPTOR_R - 13).stroke({
        width: 3,
        color: ART.wood,
        alpha: 0.35,
      });
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
