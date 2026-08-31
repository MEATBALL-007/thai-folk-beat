/**
 * Derives a playable chart from a recording, offline.
 *
 * Why not detect onsets: it was tried and it fails on this material. Isan
 * textures are sustained -- the khaen drones, the phin tremolos -- so energy
 * flux fires continuously rather than at note starts. Only ~42% of detected
 * onsets landed within 70ms of the eighth grid (chance alone scores 50%) and the
 * distribution across metrical positions came out flat, which is the signature
 * of a detector reading noise.
 *
 * What works is the inverse. The beat grid is already known to be stable
 * (measured: under 1.2ms of phase drift across 90s), so instead of asking where
 * the onsets are, ask how hard each grid slot is played. Every note then lands
 * exactly on the grid by construction, and note density becomes a dial rather
 * than an artefact of a threshold.
 *
 * Validation: on หมอลำ at 20% density this reproduces the metrical hierarchy of
 * real music -- beats strongest, eighth offbeats next, sixteenths weakest.
 *
 * Run: npm run derive
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SR = 22050;
const HOP = 110; // 5 ms
const WIN = 441; // 20 ms

/** One band per lane. Ranges follow each instrument's register. */
const BANDS = [
  { lane: 0, voice: 'klong', filter: 'lowpass=f=180' },
  { lane: 1, voice: 'ponglang', filter: 'highpass=f=250,lowpass=f=900' },
  { lane: 2, voice: 'phin', filter: 'highpass=f=900,lowpass=f=2500' },
  { lane: 3, voice: 'khaen', filter: 'highpass=f=2500' },
];

/** Must stay in step with DIFFICULTY_DENSITY in src/game/Difficulty.ts. */
const DENSITY = { easy: 0.08, normal: 0.2, hard: 0.32 };

/**
 * Two notes in the SAME lane closer than twice the GOOD window (2 x 90ms) are
 * ambiguous: one press falls inside both, and the judge cannot tell which note
 * the player meant. One 16th is only 140ms at these tempos, so consecutive
 * 16ths in one lane must be thinned -- effectively a minimum of an eighth per
 * lane, which is also how the music is actually played.
 */
const MIN_SAME_LANE_S = 0.19;

/**
 * Bars of music before the first note, so the player hears the pulse and can
 * find the beat before anything needs hitting (spec §3.3). The recordings start
 * immediately, which makes this MORE important than it was for the synth build,
 * not less -- and better, since there is now real music playing underneath it.
 */
const LEAD_IN_BARS = 2;

/** Pentatonic, matching PENTATONIC in src/audio/pattern.ts. */
const PENTATONIC = [60, 62, 64, 67, 69];

function decode(file, filter) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'],
    { maxBuffer: 1 << 28 },
  );
  const n = Math.floor(raw.length / 2);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(i * 2);
  return out;
}

/** Half-wave-rectified log-energy flux: rises where the band gets louder. */
function flux(pcm) {
  const lg = [];
  for (let i = 0; i + WIN < pcm.length; i += HOP) {
    let s = 0;
    for (let j = i; j < i + WIN; j += 4) s += pcm[j] * pcm[j];
    lg.push(Math.log1p(Math.sqrt(s / (WIN / 4))));
  }
  const out = new Float64Array(Math.max(0, lg.length - 1));
  for (let i = 1; i < lg.length; i++) out[i - 1] = Math.max(0, lg[i] - lg[i - 1]);
  return out;
}

/** Peak flux within +-40ms of each 16th-note slot. */
function slotStrengths(env, bpm, offsetS, slots) {
  const step = 15.0 / bpm;
  const vals = new Float64Array(slots);
  for (let n = 0; n < slots; n++) {
    const centre = Math.round((offsetS + n * step) / 0.005);
    let best = 0;
    for (let k = Math.max(0, centre - 8); k <= Math.min(env.length - 1, centre + 8); k++) {
      if (env[k] > best) best = env[k];
    }
    vals[n] = best;
  }
  return vals;
}

function derive(file, bpm, offsetS, durationS) {
  const step = 15.0 / bpm;
  const slots = Math.floor((durationS - offsetS) / step);
  const perBand = BANDS.map((b) => ({
    ...b,
    strength: slotStrengths(flux(decode(file, b.filter)), bpm, offsetS, slots),
  }));

  const charts = {};
  for (const [name, take] of Object.entries(DENSITY)) {
    /**
     * slot -> the lanes playing it. Raw selection puts two or more bands on ~61%
     * of slots, which is unplayable, so a slot goes to whichever band is loudest
     * there. A downbeat may carry a second lane, which makes chords read as
     * deliberate accents rather than as the default texture.
     */
    const claimed = new Map();
    const keep = Math.floor(slots * take);
    const firstSlot = LEAD_IN_BARS * 16;

    for (const band of perBand) {
      const order = [...band.strength.keys()]
        .filter((n) => n >= firstSlot)
        .sort((a, b) => band.strength[b] - band.strength[a]);
      for (const n of order.slice(0, keep)) {
        if (band.strength[n] <= 0) continue;
        const prev = claimed.get(n);
        if (!prev) {
          claimed.set(n, [{ band, v: band.strength[n] }]);
        } else if (n % 16 === 0 && prev.length < 2) {
          prev.push({ band, v: band.strength[n] });
        } else if (band.strength[n] > prev[0].v) {
          prev[0] = { band, v: band.strength[n] };
        }
      }
    }

    // Thin each lane so no two of its notes fall inside one judgement window.
    // Walking in time order and keeping whichever of a colliding pair is louder
    // preserves the accent the music actually plays.
    const minSlots = MIN_SAME_LANE_S / step;
    const lastKept = new Map(); // lane -> { slot, v }
    for (const n of [...claimed.keys()].sort((a, b) => a - b)) {
      const picks = claimed.get(n);
      const survivors = [];
      for (const pick of picks) {
        const prev = lastKept.get(pick.band.lane);
        if (prev && n - prev.slot < minSlots) {
          if (pick.v <= prev.v) continue; // quieter of the pair: drop it
          // Louder: retract the earlier note and take this slot instead.
          const old = claimed.get(prev.slot);
          const at = old.indexOf(prev.pick);
          if (at >= 0) old.splice(at, 1);
          if (old.length === 0) claimed.delete(prev.slot);
        }
        survivors.push(pick);
        lastKept.set(pick.band.lane, { slot: n, v: pick.v, pick });
      }
      if (survivors.length === 0) claimed.delete(n);
      else claimed.set(n, survivors);
    }

    const events = [];
    for (const [n, picks] of [...claimed.entries()].sort((a, b) => a[0] - b[0])) {
      for (const { band } of picks) {
        events.push({
          bar: Math.floor(n / 16),
          beat: (n % 16) / 4,
          lane: band.lane,
          voice: band.voice,
          // Pitch drives only the hit SFX now that the recording is the music.
          // Stepping through the scale keeps repeated notes in a lane from all
          // sounding identical.
          midi: PENTATONIC[n % PENTATONIC.length],
        });
      }
    }
    charts[name] = events;
  }

  return { charts, bars: Math.ceil(slots / 16) };
}

const SONGS = [
  { id: 'molam', file: 'public/assets/audio/molam.mp3', bpm: 107.07, offset: 0.247, dur: 90.65 },
  { id: 'soeng', file: 'public/assets/audio/soeng.mp3', bpm: 114.016, offset: 0.449, dur: 101.1 },
];

for (const s of SONGS) {
  const { charts, bars } = derive(s.file, s.bpm, s.offset, s.dur);
  const counts = Object.entries(charts)
    .map(([k, v]) => `${k} ${v.length}`)
    .join(', ');
  console.log(`${s.id}: ${bars} bars, ${counts}`);

  const body = `// GENERATED by scripts/derive-chart.mjs -- do not edit by hand.
// Source: ${s.file} at ${s.bpm} BPM, first downbeat ${s.offset}s.
// Re-run: npm run derive
import type { PatternEvent } from '../types';
import type { Difficulty } from '../../game/Difficulty';

export const bars = ${bars};

export const charts: Record<Difficulty, PatternEvent[]> = ${JSON.stringify(charts, null, 2)};
`;
  writeFileSync(`src/audio/songs/${s.id}.events.ts`, body);
}
