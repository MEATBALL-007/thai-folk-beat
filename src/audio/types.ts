import type { Difficulty } from '../game/Difficulty';
export type Lane = 0 | 1 | 2 | 3;

/** Isan instrument approximations, one per lane (spec §3.2). */
export type VoiceName = 'klong' | 'ponglang' | 'phin' | 'khaen';

export interface PatternEvent {
  bar: number; // 0-indexed
  beat: number; // 0..3, fractional allowed (1.5 = the "and")
  lane: Lane;
  voice: VoiceName;
  /** MIDI note. Ignored by the drum voice. */
  midi: number;
}

export interface SongDef {
  id: 'molam' | 'soeng';
  titleTh: string;
  /** Short Thai blurb shown on the song-select card. */
  blurbTh: string;
  /**
   * MEASURED from the recording, not chosen: a fixed (bpm, phase) comb was
   * fitted over the onset envelope and the phase re-fitted in each third of the
   * track to check for drift. See NOTES D35.
   */
  bpm: number;
  bars: number;
  /**
   * Seconds from the start of the audio file to its first downbeat. The
   * recordings do not begin exactly on beat 1, so without this every note in the
   * chart sits a fixed distance from where the music actually plays.
   */
  gridOffsetS: number;
  /**
   * Derived offline from the recording by scripts/derive-chart.mjs, then
   * committed. Difficulty is density over the same performance, so all three
   * charts describe one recording.
   */
  charts: Record<Difficulty, PatternEvent[]>;
  /**
   * Spec §3.4 swap-in path. When set, the engine plays this file through an
   * AudioBufferSourceNode instead of the synth. Every shipped song has had one
   * since 2026-08-31; the synth path remains as the fallback if a decode fails.
   */
  audioUrl?: string;
}
