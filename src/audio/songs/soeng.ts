import type { SongDef } from '../types';
import { bars, charts } from './soeng.events';

/**
 * เซิ้ง — the delivered recording.
 *
 * Measured the same way as หมอลำ, and this one is even steadier: the phase did
 * not move at all across the three thirds of the track.
 *
 * Its metrical histogram is flatter than หมอลำ's, which is musically right for a
 * processional eighth-driven groove rather than a sign of a bad fit — but it
 * does leave two candidate downbeats an eighth apart. 0.449 s is the one in use;
 * the alternative is 0.712 s, and switching costs one number here. Note
 * placement is identical either way; only which slots count as downbeats (and so
 * where chord accents fall) changes.
 */
export const SOENG: SongDef = {
  id: 'soeng',
  titleTh: 'เซิ้ง',
  blurbTh: 'จังหวะเซิ้งเร็ว กลองหนัก',
  bpm: 114.016,
  bars,
  gridOffsetS: 0.449,
  charts,
  audioUrl: 'assets/audio/soeng.mp3',
};
