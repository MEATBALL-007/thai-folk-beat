import { grid, ordered } from '../pattern';
import type { SongDef } from '../types';

/**
 * เซิ้ง — 140 BPM, 35 bars (~60s), busier than หมอลำ with a much heavier drum.
 *
 * เซิ้ง is processional dance music, so the drum carries nearly every bar and
 * the melodic lanes ride on top. Bars 0-1 are the lead-in (§3.3).
 *
 * Resolution is eighth notes throughout: at 140 BPM a sixteenth is 107ms, which
 * would put two adjacent notes inside one ±90ms judgement window (§4.2) and make
 * the chart ambiguous rather than hard. See scripts/chart-report.ts.
 */
const events = ordered([
  // --- bars 2-5: drum-led intro, ponglang joins on the last two bars. -------
  grid(2, {
    0: ['x...x...', 'x...x...', 'x.x.x...', 'x.xxx...'],
    1: ['........', '........', '..3.4...', '..5.4...'],
  }),

  // --- bars 6-13: main A. Steady processional groove. -----------------------
  grid(6, {
    0: [
      'x...x..x', 'x.x.x...', 'x...x..x', 'x.x.x.x.',
      'x...x..x', 'x.x.x...', 'x...x..x', 'x.x.x.x.',
    ],
    2: [
      '..4.3...', '........', '..4.5...', '........',
      '..4.3...', '........', '..4.5...', '........',
    ],
    1: [
      '........', '.0...2..', '........', '.5......',
      '........', '.0...2..', '........', '.5...3..',
    ],
    3: [
      'a.......', '........', 'c.......', '........',
      'a.......', '........', 'd.......', '........',
    ],
  }),

  // --- bars 14-21: main B. Melody lifts an octave, drum doubles up. ---------
  grid(14, {
    0: [
      'x..xx.x.', 'x.x.x..x', 'x..xx.x.', 'x.x.x...',
      'x..xx.x.', 'x.x.x..x', 'x..xx.x.', 'x.x.x.x.',
    ],
    1: [
      '0.2.3...', '5.4.3...', '0.2.3...', '5.......',
      '0.2.3...', '5.4.3...', '0.2.3...', '5...4...',
    ],
    2: [
      '....5...', '........', '....5...', '........',
      '....6...', '........', '....5...', '..4.3.2.',
    ],
    3: [
      'a.......', '........', 'c.......', '........',
      'a.......', '........', 'd.......', '........',
    ],
  }),

  // --- bars 22-29: call and response. Phin calls, ponglang + drum answer. ---
  grid(22, {
    2: [
      '..4.5.4.', '3.2.0...', '........', '........',
      '..5.6.5.', '4.3.2...', '........', '........',
    ],
    3: [
      'a.......', '....c...', '........', '........',
      'a.......', '....d...', '........', '........',
    ],
    0: [
      'x...x...', 'x...x...', 'x..xx...', 'x.x.x...',
      'x...x...', 'x...x...', 'x..xx...', 'x.x.x...',
    ],
    1: [
      '........', '........', '..3.2.0.', '2.0.....',
      '........', '........', '..4.3.2.', '5.4.....',
    ],
  }),

  // --- bars 30-33: climax. Both melodic lanes at once over a rolling drum. --
  grid(30, {
    0: ['x.x.x.x.', 'x.xxx..x', 'x.x.x.x.', 'x.xxx..x'],
    1: ['0.2.3...', '5.4.3...', '0.2.3...', '5.4.3...'],
    2: ['....5...', '..6.5...', '....5...', '..6.7...'],
    3: ['a...c...', '........', 'a...d...', '........'],
  }),

  // --- bar 34: final hit. ---------------------------------------------------
  grid(34, {
    0: ['x.......'],
    1: ['0.......'],
    3: ['a.......'],
  }),
].flat());

export const SOENG: SongDef = {
  id: 'soeng',
  titleTh: 'เซิ้ง',
  blurbTh: 'จังหวะเซิ้งเร็ว กลองหนัก',
  bpm: 140,
  bars: 35,
  gridOffsetS: 0,
  charts: { easy: events, normal: events, hard: events },
};
