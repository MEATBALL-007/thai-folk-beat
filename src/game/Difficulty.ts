/**
 * Difficulty is note density, not speed. The derivation script keeps the
 * strongest N% of grid slots (see the design doc §4.3), so every difficulty
 * charts the same performance — a harder chart just includes quieter detail.
 * Scroll speed stays under the player's control in Settings.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

export const DIFFICULTY_LABELS_TH: Record<Difficulty, string> = {
  easy: 'ง่าย',
  normal: 'ปกติ',
  hard: 'ยาก',
};

/** Fraction of 16th-note slots the derivation keeps, per difficulty. */
export const DIFFICULTY_DENSITY: Record<Difficulty, number> = {
  easy: 0.08,
  normal: 0.2,
  hard: 0.32,
};
