import type { Lane, PatternEvent, VoiceName } from './types';

/** Isan pentatonic, spec §3.2. Octaves of these are used for range. */
export const PENTATONIC = [60, 62, 64, 67, 69] as const;

export const VOICE_OF_LANE: Record<Lane, VoiceName> = {
  0: 'klong', // กลอง — drum
  1: 'ponglang', // โปงลาง — wooden xylophone
  2: 'phin', // พิณ — plucked lute
  3: 'khaen', // แคน — reed mouth organ
};

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Step character -> MIDI.
 *   '0'-'4' pentatonic degree, base octave
 *   '5'-'9' same degree, +1 octave
 *   'a'-'e' same degree, -1 octave
 *   'x'     unpitched (drum)
 *   '.'     rest
 */
function pitchOf(ch: string): number | null {
  if (ch === '.' || ch === ' ') return null;
  if (ch === 'x') return PENTATONIC[0];

  const code = ch.charCodeAt(0);
  // Each range maps to the same five degrees, shifted by an octave.
  const [lo, shift] =
    code >= 48 && code <= 52
      ? [48, 0] // '0'-'4' base octave
      : code >= 53 && code <= 57
        ? [53, 12] // '5'-'9' one octave up
        : code >= 97 && code <= 101
          ? [97, -12] // 'a'-'e' one octave down
          : [-1, 0];

  if (lo < 0) return null;
  const degree = PENTATONIC[code - lo];
  return degree === undefined ? null : degree + shift;
}

/**
 * Compact bar-grid notation. Each string is one bar; its length sets the
 * resolution (8 chars = eighth notes, 16 = sixteenths). Written this way so the
 * patterns stay legible as *music* rather than as a wall of object literals —
 * and because spec §3.1 requires audio and chart to come from one array.
 *
 *   grid(2, { 0: ['x...x..x'], 2: ['..4.2.0.'] })
 */
export function grid(
  startBar: number,
  rows: Partial<Record<Lane, readonly string[]>>,
): PatternEvent[] {
  const out: PatternEvent[] = [];

  for (const key of Object.keys(rows)) {
    const lane = Number(key) as Lane;
    const bars = rows[lane];
    if (!bars) continue;

    bars.forEach((steps, barOffset) => {
      const res = steps.length;
      for (let s = 0; s < res; s++) {
        const ch = steps[s];
        if (ch === undefined) continue;
        const midi = pitchOf(ch);
        if (midi === null) continue;

        out.push({
          bar: startBar + barOffset,
          beat: (s / res) * 4,
          lane,
          voice: VOICE_OF_LANE[lane],
          midi,
        });
      }
    });
  }

  return out;
}

/** Sort by time so the scheduler and the chart share one ordering. */
export function ordered(events: PatternEvent[]): PatternEvent[] {
  return [...events].sort((a, b) => a.bar * 4 + a.beat - (b.bar * 4 + b.beat) || a.lane - b.lane);
}
