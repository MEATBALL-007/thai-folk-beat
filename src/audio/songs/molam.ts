import type { SongDef } from '../types';
import { bars, charts } from './molam.events';

/**
 * หมอลำ — the delivered recording.
 *
 * BPM and the first downbeat were MEASURED from the file, not chosen: a fixed
 * (bpm, phase) comb was fitted over the onset envelope, then the phase re-fitted
 * independently in each third of the track to check for drift. It came out under
 * 1.2 ms across the whole 90 s, which is what makes a fixed-grid chart viable
 * here at all. For scale, a 0.5% tempo error would accumulate ~450 ms over the
 * song — five times the GOOD window.
 *
 * The charts are generated. See molam.events.ts and scripts/derive-chart.mjs;
 * edit those rather than pasting notes in here.
 */
export const MOLAM: SongDef = {
  id: 'molam',
  titleTh: 'หมอลำ',
  blurbTh: 'ลำกลอนอีสาน จังหวะปานกลาง',
  bpm: 107.07,
  bars,
  gridOffsetS: 0.247,
  charts,
  audioUrl: 'assets/audio/molam.mp3',
};
