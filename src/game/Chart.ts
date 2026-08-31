import type { Lane, SongDef, VoiceName } from '../audio/types';
import type { Difficulty } from './Difficulty';

/** One playable note. Derived from the SongDef's events — never authored separately (spec §3.1). */
export interface ChartNote {
  index: number;
  /** Seconds from song start. */
  time: number;
  lane: Lane;
  midi: number;
  voice: VoiceName;
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

export function secondsPerBar(bpm: number): number {
  return (60 / bpm) * 4;
}

/**
 * The single derivation step. The note highway and the judge both consume this,
 * so visuals and judgement cannot disagree about when a note happens.
 *
 * `gridOffsetS` shifts every note by the distance from the start of the audio
 * file to its first downbeat. Song time 0 is the instant the file starts
 * playing, so without this the whole chart runs early by that amount.
 */
export function buildChart(song: SongDef, difficulty: Difficulty): ChartNote[] {
  const spb = secondsPerBeat(song.bpm);

  return song.charts[difficulty].map((e, index) => ({
    index,
    time: song.gridOffsetS + (e.bar * 4 + e.beat) * spb,
    lane: e.lane,
    midi: e.midi,
    voice: e.voice,
  }));
}

/** Total song length including a short tail so the last note can ring out. */
export function songDuration(song: SongDef): number {
  return song.gridOffsetS + song.bars * secondsPerBar(song.bpm) + 1.5;
}
