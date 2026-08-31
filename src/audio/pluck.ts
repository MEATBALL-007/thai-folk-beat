/**
 * Physical models for the pitched Isan instruments, rendered to AudioBuffers
 * once at load and replayed per hit.
 *
 * Why this exists: pressing a lane correctly used to make no sound at all.
 * `sfxBus` was built and wired to master, but nothing played through it during
 * gameplay — only the Settings previews used it. A rhythm game where a correct
 * hit is silent gives the player no confirmation except a number changing at the
 * edge of the screen.
 *
 * Why models rather than samples: no CC0 recording of a พิณ could be found at
 * all, and modelling the instrument is both licence-free and closer to what the
 * instrument actually does than the sawtooth-through-a-filter it replaces.
 *
 * Pre-rendering is possible because the chart uses five known pitches per
 * instrument, so a hit costs one buffer playback instead of building an
 * oscillator graph mid-frame.
 */

function hzOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Karplus–Strong: a plucked string.
 *
 * A burst of noise is written into a delay line one period long and fed back
 * through a two-point average. The noise is the pluck, the delay length is the
 * string length, and the averaging is the energy lost at the bridge on every
 * round trip — which is why the tone darkens as it decays, exactly as a real
 * string does. Roughly twenty lines of arithmetic gets far closer to พิณ than
 * a filtered sawtooth ever did.
 */
function karplusStrong(
  out: Float32Array,
  sampleRate: number,
  freq: number,
  damping: number,
): void {
  const n = Math.max(2, Math.round(sampleRate / freq));
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.random() * 2 - 1;

  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = buf[idx] ?? 0;
    const next = buf[(idx + 1) % n] ?? 0;
    buf[idx] = (cur + next) * 0.5 * damping;
    out[i] = cur;
    idx = (idx + 1) % n;
  }
}

/**
 * Modal synthesis: a struck wooden bar.
 *
 * A free–free bar's overtones are inharmonic — roughly 1 : 2.76 : 5.40 — which
 * is precisely why โปงลาง sounds wooden rather than like a tuned pipe. Summing
 * decaying sines at those ratios models the physics directly; higher modes are
 * quieter and die sooner, as they do in the real bar.
 */
function modalBar(out: Float32Array, sampleRate: number, freq: number): void {
  const modes = [
    { ratio: 1.0, gain: 1.0, decay: 3.2 },
    { ratio: 2.76, gain: 0.45, decay: 5.5 },
    { ratio: 5.4, gain: 0.2, decay: 9.0 },
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const m of modes) {
      v += m.gain * Math.exp(-m.decay * t) * Math.sin(2 * Math.PI * freq * m.ratio * t);
    }
    out[i] = v * 0.5;
  }
}

export type PluckKind = 'phin' | 'ponglang';

/** One rendered note, ~0.9 s, mono. */
export function renderPluck(
  ctx: BaseAudioContext,
  midi: number,
  kind: PluckKind,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.9);
  const buffer = ctx.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);
  const f = hzOf(midi);

  if (kind === 'phin') karplusStrong(data, sr, f, 0.996);
  else modalBar(data, sr, f);

  // Fade the tail, so a buffer that is still ringing when it runs out does not
  // end on a step discontinuity — which is audible as a click.
  // Divide by fade-1, not fade, so the final sample is multiplied by exactly
  // zero. Dividing by fade leaves it at 1/fade of full amplitude — inaudible on
  // its own, but it is still a step back to silence at the buffer boundary.
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) {
    const k = i / (fade - 1);
    const at = len - fade + i;
    data[at] = (data[at] ?? 0) * (1 - k);
  }

  return buffer;
}
