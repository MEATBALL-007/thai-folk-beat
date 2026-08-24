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
  bpm: number;
  bars: number;
  events: PatternEvent[];
  /**
   * Spec §3.4 swap-in path. When set, the engine plays this file through an
   * AudioBufferSourceNode instead of the synth, using the identical chart.
   * Drop an .mp3/.wav into public/assets/audio/ and set this — no other change.
   */
  audioUrl?: string;
}
