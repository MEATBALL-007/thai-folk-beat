import { grid, ordered } from '../pattern';
import type { SongDef } from '../types';

/**
 * หมอลำ — 110 BPM, 28 bars (~61s), moderate density.
 *
 * Lane roles (spec §3.2):
 *   0 กลอง klong     — pulse
 *   1 โปงลาง ponglang — the answer
 *   2 พิณ phin        — the call
 *   3 แคน khaen       — sustained harmony underneath
 *
 * Bars 0-1 are the lead-in (§3.3): no notes, so the player hears the pulse
 * before anything arrives at the receptors.
 */
const events = ordered([
  // --- bars 2-5: intro. Call only (phin over khaen), no drum yet. -----------
  grid(2, {
    3: ['a.......', '....c...', 'a.......', '....d...'],
    2: ['....0.2.', '3.2.0...', '....2.3.', '4.3.2.0.'],
  }),

  // --- bars 6-9: the answer enters — drum lays the pulse, ponglang replies. -
  grid(6, {
    0: ['x...x...', 'x...x..x', 'x...x...', 'x..xx...'],
    1: ['..3.2...', '..0.....', '..3.4...', '..2.0...'],
    2: ['0.......', '........', '2.......', '........'],
    3: ['a.......', '........', 'c.......', '........'],
  }),

  // --- bars 10-17: main call-and-response. -----------------------------------
  // Call on lanes 2/3 (bars 10,11,14,15), answered on lanes 0/1 (12,13,16,17).
  grid(10, {
    0: [
      'x...x...', 'x...x...', 'x..xx..x', 'x.x.x...',
      'x...x...', 'x...x...', 'x..xx..x', 'x.x.x...',
    ],
    2: [
      '..4.3.2.', '0.2.3...', '........', '........',
      '..4.5.4.', '3.2.0...', '........', '........',
    ],
    3: [
      'a.......', '....c...', '........', '........',
      'a.......', '....d...', '........', '........',
    ],
    1: [
      '........', '........', '..3.2.0.', '2.0.....',
      '........', '........', '..3.4.5.', '4.3.2.0.',
    ],
  }),

  // --- bars 18-21: variation, ponglang takes the lead. ----------------------
  grid(18, {
    0: ['x.x.x.x.', 'x.x.x...', 'x.x.x.x.', 'x..xx...'],
    1: ['0.2.3...', '5.4.3...', '0.2.3...', '5...3...'],
    2: ['....5...', '....2...', '....5...', '..4.3.2.'],
    3: ['a.......', '........', 'c.......', '....a...'],
  }),

  // --- bars 22-25: reprise of the opening call, thinner. --------------------
  grid(22, {
    0: ['x...x...', 'x...x..x', 'x...x...', 'x..xx...'],
    2: ['..4.3.2.', '........', '..2.3.4.', '........'],
    1: ['........', '..2.0...', '........', '..3.2...'],
    3: ['a.......', '........', 'c.......', '........'],
  }),

  // --- bars 26-27: outro, resolving down to the tonic. ----------------------
  grid(26, {
    0: ['x...x...', 'x.......'],
    2: ['..3.2...', '0.......'],
    3: ['a.......', 'a.......'],
  }),
].flat());

export const MOLAM: SongDef = {
  id: 'molam',
  titleTh: 'หมอลำ',
  blurbTh: 'ลำกลอนอีสาน จังหวะปานกลาง',
  bpm: 110,
  bars: 28,
  gridOffsetS: 0,
  charts: { easy: events, normal: events, hard: events },
};
