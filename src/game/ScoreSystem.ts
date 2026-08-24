import type { Verdict } from './Judge';

/** Spec §4.2 base points. */
export const BASE_POINTS: Record<Verdict, number> = {
  PERFECT: 100,
  GOOD: 50,
  MISS: 0,
};

/** Spec §4.4. */
export const FAIL_CONSECUTIVE_MISSES = 4;

export type RunState = 'PLAYING' | 'CLEARED' | 'FAILED';

export interface GameResult {
  songId: string;
  state: Exclude<RunState, 'PLAYING'>;
  score: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  /** 0..1, weighting GOOD at half a PERFECT. */
  accuracy: number;
}

/**
 * Score, combo and the fail condition (spec §4.3, §4.4).
 */
export class ScoreSystem {
  score = 0;
  combo = 0;
  maxCombo = 0;
  perfect = 0;
  good = 0;
  miss = 0;
  consecutiveMisses = 0;
  failed = false;

  /**
   * Spec §4.3: `1 + min(floor(combo / 10), 7)`, capping at x8.
   *
   * Read BEFORE the combo is incremented, so the very first note scores at x1
   * rather than the multiplier it is about to earn. The spec does not pin the
   * order down; this is the osu-style convention it cites. See NOTES.md D18.
   */
  get multiplier(): number {
    return 1 + Math.min(Math.floor(this.combo / 10), 7);
  }

  get judgedCount(): number {
    return this.perfect + this.good + this.miss;
  }

  get accuracy(): number {
    const total = this.judgedCount;
    if (total === 0) return 1;
    return (this.perfect + this.good * 0.5) / total;
  }

  apply(verdict: Verdict): void {
    if (verdict === 'MISS') {
      this.miss++;
      // Spec §4.3: the multiplier is lost entirely. Intentional, and explicitly
      // agreed in the design meeting — do not "soften" this.
      this.combo = 0;
      this.consecutiveMisses++;
      if (this.consecutiveMisses >= FAIL_CONSECUTIVE_MISSES) this.failed = true;
      return;
    }

    this.score += BASE_POINTS[verdict] * this.multiplier;

    if (verdict === 'PERFECT') this.perfect++;
    else this.good++;

    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.consecutiveMisses = 0;
  }

  result(songId: string, state: Exclude<RunState, 'PLAYING'>): GameResult {
    return {
      songId,
      state,
      score: this.score,
      maxCombo: this.maxCombo,
      perfect: this.perfect,
      good: this.good,
      miss: this.miss,
      accuracy: this.accuracy,
    };
  }
}
