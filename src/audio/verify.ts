import { playVoice } from './voices';
import { buildChart, songDuration } from '../game/Chart';
import type { Lane, SongDef } from './types';
import { MASTER_HEADROOM } from './AudioEngine';

/**
 * Dev-only verification (spec §8 Phase 2 gate). Not referenced by the shipped
 * scenes; tree-shaken out of the production bundle.
 *
 * The spec asks us to "confirm by ear that it sounds like music and the clock is
 * stable". Two of those three claims can be checked objectively instead:
 *
 *   - Renders the song through an OfflineAudioContext, which runs as fast as the
 *     CPU allows and is completely immune to rAF/tab throttling.
 *   - Detects note onsets in the drum lane (sharpest transients) and compares
 *     them against the chart times the note highway will use. If audio and chart
 *     ever drift apart, this is where it shows up — and since both come from one
 *     PatternEvent array (§3.1), they should agree to the sample.
 *   - Reports the full-mix peak so clipping is caught before a projector's
 *     speakers do it for us.
 *
 * What it cannot check is whether the result is *musical*. That still needs ears.
 */

export interface OnsetReport {
  song: string;
  durationSec: number;
  totalNotes: number;
  /** Drum-lane notes, which is what onset matching runs against. */
  drumNotes: number;
  detectedOnsets: number;
  matched: number;
  meanAbsErrorMs: number;
  maxAbsErrorMs: number;
  /** Peak of the raw summed voices, before any headroom is applied. */
  rawPeak: number;
  /** Peak through the real master chain at 100% volume. >1.0 means clipping. */
  fullMixPeak: number;
  fullMixRms: number;
  silentSpanSec: number;
}

function renderLane(
  def: SongDef,
  lane: Lane | null,
  sampleRate: number,
  applyMasterChain = false,
): Promise<AudioBuffer> {
  const chart = buildChart(def, 'normal');
  const dur = songDuration(def);
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * dur), sampleRate);

  // Mirror AudioEngine's chain so the reported peak answers the real question:
  // "does this clip on the way out?" Onset detection uses the raw path instead,
  // because a limiter would smear the transients it is trying to measure.
  let dest: AudioNode = ctx.destination;
  if (applyMasterChain) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = MASTER_HEADROOM;
    master.connect(limiter);

    dest = master;
  }

  const notes = lane === null ? chart : chart.filter((n) => n.lane === lane);
  for (const n of notes) {
    // OfflineAudioContext time starts at 0, and chart times are song-relative,
    // so the chart time IS the schedule time. No offset, nothing to get wrong.
    playVoice(n.voice, ctx, dest, n.time, n.midi);
  }

  return ctx.startRendering();
}

/** Simple energy-derivative onset detector. Adequate for sharp drum transients. */
function detectOnsets(buf: AudioBuffer, minGapSec = 0.05): number[] {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const hop = 64;
  const win = 256;

  const energy: number[] = [];
  for (let i = 0; i + win < data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < win; j++) {
      const v = data[i + j] ?? 0;
      sum += v * v;
    }
    energy.push(sum / win);
  }

  let peak = 0;
  for (const e of energy) if (e > peak) peak = e;
  const floor = peak * 0.02;

  const onsets: number[] = [];
  let lastOnset = -Infinity;

  for (let i = 1; i < energy.length; i++) {
    const cur = energy[i] ?? 0;
    const prev = energy[i - 1] ?? 0;
    if (cur < floor) continue;
    // Sharp rise relative to the previous frame.
    if (cur > prev * 4 || (prev === 0 && cur > floor)) {
      const t = (i * hop) / sr;
      if (t - lastOnset >= minGapSec) {
        onsets.push(t);
        lastOnset = t;
      }
    }
  }

  return onsets;
}

function longestSilentSpan(buf: AudioBuffer, thresh = 0.001): number {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const hop = 512;

  let worst = 0;
  let runStart = 0;
  let inRun = false;

  for (let i = 0; i + hop < data.length; i += hop) {
    let loud = false;
    for (let j = 0; j < hop; j += 8) {
      if (Math.abs(data[i + j] ?? 0) > thresh) {
        loud = true;
        break;
      }
    }
    if (!loud) {
      if (!inRun) {
        inRun = true;
        runStart = i;
      }
    } else if (inRun) {
      inRun = false;
      worst = Math.max(worst, (i - runStart) / sr);
    }
  }

  return worst;
}

export async function verifySongAudio(def: SongDef, sampleRate = 44100): Promise<OnsetReport> {
  const chart = buildChart(def, 'normal');
  const drumTimes = chart.filter((n) => n.lane === 0).map((n) => n.time);

  const drumBuf = await renderLane(def, 0, sampleRate);
  const onsets = detectOnsets(drumBuf);

  // Match each drum note to the nearest detected onset.
  let matched = 0;
  let sumErr = 0;
  let maxErr = 0;

  for (const t of drumTimes) {
    let best = Infinity;
    for (const o of onsets) {
      const d = Math.abs(o - t);
      if (d < best) best = d;
      if (o > t + 0.1) break;
    }
    if (best <= 0.02) {
      matched++;
      sumErr += best;
      if (best > maxErr) maxErr = best;
    }
  }

  const rawBuf = await renderLane(def, null, sampleRate, false);
  const raw = rawBuf.getChannelData(0);
  let rawPeak = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = Math.abs(raw[i] ?? 0);
    if (v > rawPeak) rawPeak = v;
  }

  const fullBuf = await renderLane(def, null, sampleRate, true);
  const full = fullBuf.getChannelData(0);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < full.length; i++) {
    const v = Math.abs(full[i] ?? 0);
    if (v > peak) peak = v;
    sumSq += v * v;
  }

  return {
    song: def.id,
    durationSec: songDuration(def),
    totalNotes: chart.length,
    drumNotes: drumTimes.length,
    detectedOnsets: onsets.length,
    matched,
    meanAbsErrorMs: matched ? (sumErr / matched) * 1000 : NaN,
    maxAbsErrorMs: maxErr * 1000,
    rawPeak,
    fullMixPeak: peak,
    fullMixRms: Math.sqrt(sumSq / full.length),
    silentSpanSec: longestSilentSpan(fullBuf),
  };
}
