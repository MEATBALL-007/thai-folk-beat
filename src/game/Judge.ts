import type { Lane } from '../audio/types';
import type { ChartNote } from './Chart';

/** Spec §4.2. */
export const PERFECT_MS = 45;
export const GOOD_MS = 90;

export type Verdict = 'PERFECT' | 'GOOD' | 'MISS';

export interface JudgeEvent {
  verdict: Verdict;
  note: ChartNote;
  /** Signed error in ms. Positive = pressed late. */
  deltaMs: number;
}

type NoteState = 'pending' | 'judged';

/**
 * Timing judgement (spec §4.2).
 *
 * Notes are bucketed per lane and each lane keeps a cursor, so a press is O(1)
 * amortised rather than a scan of all 212 notes every keystroke.
 */
export class Judge {
  private readonly byLane: ChartNote[][] = [[], [], [], []];
  private readonly cursor = [0, 0, 0, 0];
  private readonly state: NoteState[];

  constructor(chart: ChartNote[]) {
    this.state = new Array<NoteState>(chart.length).fill('pending');
    for (const note of chart) {
      this.byLane[note.lane]?.push(note);
    }
    // Chart is already time-ordered, but never rely on an upstream invariant
    // that a future edit could break silently.
    for (const lane of this.byLane) lane.sort((a, b) => a.time - b.time);
  }

  /**
   * Judge a press in a lane.
   *
   * Returns null when no note sits inside ±GOOD_MS. Spec §4.2 is explicit that
   * this is *ignored*, not penalised — it keeps a nervous player mashing during
   * the demo from destroying their own score.
   */
  press(lane: Lane, songTime: number): JudgeEvent | null {
    const notes = this.byLane[lane];
    if (!notes) return null;

    let best: ChartNote | null = null;
    let bestDelta = 0;
    let bestAbs = Infinity;

    for (let i = this.cursor[lane] ?? 0; i < notes.length; i++) {
      const note = notes[i];
      if (!note) break;
      if (this.state[note.index] === 'judged') continue;

      const deltaMs = (songTime - note.time) * 1000;
      // Already past the window — collectMisses() owns it.
      if (deltaMs > GOOD_MS) continue;
      // Everything further ahead is further away still.
      if (deltaMs < -GOOD_MS) break;

      const abs = Math.abs(deltaMs);
      if (abs < bestAbs) {
        bestAbs = abs;
        bestDelta = deltaMs;
        best = note;
      }
    }

    if (!best) return null;

    this.state[best.index] = 'judged';
    return {
      verdict: bestAbs <= PERFECT_MS ? 'PERFECT' : 'GOOD',
      note: best,
      deltaMs: bestDelta,
    };
  }

  /** Notes that fell past the GOOD window unhit. Call once per frame. */
  collectMisses(songTime: number): JudgeEvent[] {
    const out: JudgeEvent[] = [];

    for (let lane = 0; lane < 4; lane++) {
      const notes = this.byLane[lane];
      if (!notes) continue;

      let i = this.cursor[lane] ?? 0;
      while (i < notes.length) {
        const note = notes[i];
        if (!note) break;

        if (this.state[note.index] === 'judged') {
          i++;
          continue;
        }

        const deltaMs = (songTime - note.time) * 1000;
        if (deltaMs <= GOOD_MS) break; // still catchable

        this.state[note.index] = 'judged';
        out.push({ verdict: 'MISS', note, deltaMs });
        i++;
      }
      this.cursor[lane] = i;
    }

    return out;
  }

  isJudged(noteIndex: number): boolean {
    return this.state[noteIndex] === 'judged';
  }
}
