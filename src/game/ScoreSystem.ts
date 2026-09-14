import type { Verdict } from './Judge';

/** Spec §4.2 base points. */
export const BASE_POINTS: Record<Verdict, number> = {
  PERFECT: 100,
  GOOD: 50,
  MISS: 0,
};

/** Spec §4.4. */
export const FAIL_CONSECUTIVE_MISSES = 4;

/**
 * How far stray presses may outrun real hits before the run fails.
 *
 * This is the rule that makes mashing lose. Breaking the combo was not enough:
 * a masher still hit every note, so the result screen showed 100% accuracy and
 * a clear, and only the multiplier suffered — which nobody reads.
 *
 * The margin is a DEBT, not a streak, because a masher hits notes constantly
 * (that is the whole point of mashing) and so would keep resetting any streak.
 * Debt works because hits are capped by the chart while strays are not: at
 * ~3.4 notes/s, someone mashing four keys at 8 Hz runs up ~28 debt per second
 * and fails in about a second, while a player pressing roughly once per note
 * can never get here — if they were missing that often, the four-consecutive-
 * miss rule would have ended the run long before.
 */
export const FAIL_STRAY_DEBT = 30;

export type RunState = 'PLAYING' | 'CLEARED' | 'FAILED';

export interface GameResult {
  songId: string;
  state: Exclude<RunState, 'PLAYING'>;
  score: number;
  maxCombo: number;
  perfect: number;
  good: number;
  miss: number;
  /** Presses that matched no note. */
  strays: number;
  /** 0..1, weighting GOOD at half a PERFECT, and counting strays against you. */
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
  /** Presses that matched no note. Diagnostic, and shown on the result screen. */
  strays = 0;
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

  /**
   * Accuracy counts stray presses in the denominator.
   *
   * Without them a masher scores 100%: they hit every note, so every judged
   * note was a hit. Counting the wasted presses is what makes the number
   * describe how well the song was actually played rather than how many notes
   * happened to be covered.
   */
  get accuracy(): number {
    const total = this.judgedCount + this.strays;
    if (total === 0) return 1;
    return (this.perfect + this.good * 0.5) / total;
  }

  /** How far stray presses are ahead of real hits. Negative means comfortable. */
  get strayDebt(): number {
    return this.strays - (this.perfect + this.good);
  }

  /**
   * A press that matched no note at all.
   *
   * Costs the combo, counts against accuracy, and adds to the stray debt that
   * ends a run of pure mashing. It is still NOT a miss: it cannot trip the
   * four-consecutive-miss rule, so one mistimed tap never ends a beginner's
   * song.
   */
  applyStray(): void {
    this.combo = 0;
    this.strays++;
    if (this.strayDebt >= FAIL_STRAY_DEBT) this.failed = true;
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
      strays: this.strays,
      accuracy: this.accuracy,
    };
  }
}
