import { midiToFreq } from './pattern';
import type { VoiceName } from './types';

/**
 * Four synthesised voices, one per lane (spec §3.2). These are deliberately
 * *distinguishable* rather than realistic — a placeholder palette so the demo
 * has music tonight. Real recordings swap in via SongDef.audioUrl (§3.4).
 *
 * Every voice takes an absolute AudioContext time `when`. Nothing here reads
 * currentTime to decide *when* to sound, so playback is sample-accurate.
 */

let noiseBuffer: AudioBuffer | null = null;

/** One shared 1s mono noise buffer, reused by every drum hit. */
function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;

  const len = Math.floor(ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  noiseBuffer = buf;
  return buf;
}

/** กลอง — sine 120Hz->50Hz pitch drop + short filtered noise transient. */
function klong(ctx: BaseAudioContext, dest: AudioNode, when: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, when);
  osc.frequency.exponentialRampToValueAtTime(50, when + 0.12);

  const body = ctx.createGain();
  body.gain.setValueAtTime(0.0001, when);
  body.gain.exponentialRampToValueAtTime(0.9, when + 0.004);
  body.gain.exponentialRampToValueAtTime(0.0001, when + 0.19);

  osc.connect(body).connect(dest);
  osc.start(when);
  osc.stop(when + 0.22);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoise(ctx);
  noise.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, when);

  const slap = ctx.createGain();
  slap.gain.setValueAtTime(0.35, when);
  slap.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);

  noise.connect(lp).connect(slap).connect(dest);
  noise.start(when);
  noise.stop(when + 0.07);
}

/** โปงลาง — triangle, fast attack, 250ms exponential decay, wooden octave partial. */
function ponglang(ctx: BaseAudioContext, dest: AudioNode, when: number, midi: number): void {
  const f = midiToFreq(midi);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.exponentialRampToValueAtTime(0.55, when + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
  out.connect(dest);

  const fundamental = ctx.createOscillator();
  fundamental.type = 'triangle';
  fundamental.frequency.setValueAtTime(f, when);
  fundamental.connect(out);
  fundamental.start(when);
  fundamental.stop(when + 0.28);

  // Octave-up partial decaying faster — reads as "struck wood".
  const partial = ctx.createOscillator();
  partial.type = 'triangle';
  partial.frequency.setValueAtTime(f * 2, when);

  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0.3, when);
  pg.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);

  partial.connect(pg).connect(out);
  partial.start(when);
  partial.stop(when + 0.11);
}

/** พิณ — sawtooth through a lowpass with a decaying filter envelope, 400ms. */
function phin(ctx: BaseAudioContext, dest: AudioNode, when: number, midi: number): void {
  const f = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f, when);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.setValueAtTime(6, when);
  lp.frequency.setValueAtTime(Math.min(f * 9, 7000), when);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 220), when + 0.4);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.42, when + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);

  osc.connect(lp).connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + 0.42);
}

/** แคน — two detuned squares + vibrato LFO, soft attack, 500ms. */
function khaen(ctx: BaseAudioContext, dest: AudioNode, when: number, midi: number): void {
  const f = midiToFreq(midi);
  const end = when + 0.5;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.3, when + 0.045); // soft reed attack
  g.gain.setValueAtTime(0.3, end - 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  // Squares are harsh raw; tame the top end so it reads as a reed, not a buzzer.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, when);
  lp.connect(g).connect(dest);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(5.4, when);

  const lfoDepth = ctx.createGain();
  lfoDepth.gain.setValueAtTime(7, when); // cents
  lfo.connect(lfoDepth);
  lfo.start(when);
  lfo.stop(end + 0.02);

  for (const detune of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, when);
    osc.detune.setValueAtTime(detune, when);
    lfoDepth.connect(osc.detune);
    osc.connect(lp);
    osc.start(when);
    osc.stop(end + 0.02);
  }
}

export function playVoice(
  voice: VoiceName,
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  midi: number,
): void {
  switch (voice) {
    case 'klong':
      klong(ctx, dest, when);
      break;
    case 'ponglang':
      ponglang(ctx, dest, when, midi);
      break;
    case 'phin':
      phin(ctx, dest, when, midi);
      break;
    case 'khaen':
      khaen(ctx, dest, when, midi);
      break;
  }
}
