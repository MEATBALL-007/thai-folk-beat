import type { Lane, SongDef, VoiceName } from '../audio/types';

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
 * The single derivation step. The synth scheduler and the note highway both
 * consume this, so audio and visuals cannot disagree about when a note happens.
 */
export function buildChart(song: SongDef): ChartNote[] {
  const spb = secondsPerBeat(song.bpm);

  return song.events.map((e, index) => ({
    index,
    time: (e.bar * 4 + e.beat) * spb,
    lane: e.lane,
    midi: e.midi,
    voice: e.voice,
  }));
}

/** Total song length including a short tail so the last note can ring out. */
export function songDuration(song: SongDef): number {
  return song.bars * secondsPerBar(song.bpm) + 1.5;
}
