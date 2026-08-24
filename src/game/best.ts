import { readNumber, writeNumber } from '../core/Storage';

/** Spec §5.8: one key per song. */
export function bestKey(songId: string): string {
  return `tfb.best.${songId}`;
}

export function getBest(songId: string): number {
  return Math.max(0, Math.floor(readNumber(bestKey(songId), 0)));
}

/**
 * Records a score if it beats the stored best.
 * @returns true when this run set a new record (drives the NEW RECORD! flourish).
 */
export function submitBest(songId: string, score: number): boolean {
  const prev = getBest(songId);
  if (score <= prev) return false;
  writeNumber(bestKey(songId), score);
  return true;
}

/** Best across every song — what the Title screen shows (spec §5.1). */
export function getOverallBest(songIds: readonly string[]): number {
  return songIds.reduce((max, id) => Math.max(max, getBest(id)), 0);
}
