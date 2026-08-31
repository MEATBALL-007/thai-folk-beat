import { Conductor } from './Conductor';
import { playVoice } from './voices';
import { renderPluck, type PluckKind } from './pluck';
import type { SongDef, VoiceName } from './types';
import { PENTATONIC } from './pattern';
import type { Difficulty } from '../game/Difficulty';
import { buildChart, type ChartNote } from '../game/Chart';

/** How far ahead of the playhead notes are handed to Web Audio. */
const SCHEDULE_AHEAD_S = 0.25;
/** How often the look-ahead runs. */
const PUMP_MS = 25;
/** Gap between play() and the song actually starting, so bar 0 can be scheduled. */
const START_DELAY_S = 0.15;

/**
 * Peak sample value of the loudest delivered recording, measured with ffmpeg
 * astats: molam 0.972, soeng 0.996, main 1.022. They are mastered hard against
 * full scale, and mp3 decoding overshoots slightly past it.
 */
export const RECORDING_PEAK = 1.022;

/** Hit-feedback gain per verdict. GOOD is quieter so the sound carries information. */
export const HIT_GAIN = { PERFECT: 0.35, GOOD: 0.22 } as const;

/**
 * Worst case the master bus must survive: the loudest sample of the recording
 * landing on the same sample as four simultaneous PERFECT hits, with both
 * volume sliders at 100.
 */
const WORST_CASE_SUM = RECORDING_PEAK + 4 * HIT_GAIN.PERFECT;

/**
 * Master headroom. NOT a guess, and re-derived on 2026-08-31.
 *
 * The previous value of 0.5 was measured against the SYNTH mix, whose raw
 * summed peak was 1.58 (หมอลำ) and 1.74 (เซิ้ง). The game no longer plays that
 * mix: it plays mastered recordings that sit at ~1.0 on their own, plus hit
 * feedback on top. A figure sized for the old mix would clip the new one.
 *
 * See NOTES.md D14 (superseded) and D36.
 */
export const MASTER_HEADROOM = Math.min(0.5, 1 / WORST_CASE_SUM);

export interface LoadedSong {
  def: SongDef;
  chart: ChartNote[];
  buffer: AudioBuffer | null;
}

/**
 * Owns the AudioContext and the bus layout:
 *
 *     voices ─┐
 *             ├─> songBus ─> musicBus ─┐
 *   (per song)                          ├─> master ─> destination
 *                          sfxBus ─────┘
 *
 * songBus exists so stopping a song can hard-mute notes that were already
 * handed to the hardware inside the look-ahead window (spec §4.4 wants the audio
 * to stop *immediately* on fail).
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly musicBus: GainNode;
  readonly sfxBus: GainNode;
  readonly conductor: Conductor;

  private songBus: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loaded: LoadedSong | null = null;
  private nextIndex = 0;
  private pumpId: number | null = null;

  /**
   * Pre-rendered hit sounds, keyed `kind:midi`. Built once on first load; the
   * chart only uses five pitches per instrument, so the whole bank is ten
   * short buffers.
   */
  private readonly hitBank = new Map<string, AudioBuffer>();

  /** Debug/telemetry hook — fires as each note is handed to the hardware. */
  onNoteScheduled: ((note: ChartNote) => void) | null = null;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });

    // Chain order matters: headroom FIRST, then the limiter. If the limiter sees
    // the raw summed signal it squashes the whole mix instead of idling.
    //
    //   buses -> master (headroom) -> limiter -> destination
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    this.limiter.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_HEADROOM;
    this.master.connect(this.limiter);

    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);

    this.conductor = new Conductor(this.ctx);
  }

  /**
   * Renders the hit-feedback bank. Idempotent, and cheap enough to sit inside
   * load(): ten 0.9s mono buffers.
   */
  private buildHitBank(): void {
    if (this.hitBank.size > 0) return;
    const kinds: PluckKind[] = ['phin', 'ponglang'];
    for (const kind of kinds) {
      for (const midi of PENTATONIC) {
        this.hitBank.set(`${kind}:${midi}`, renderPluck(this.ctx, midi, kind));
      }
    }
  }

  /**
   * Feedback for a successful hit. Routed through sfxBus, so the player's SFX
   * slider governs it and it is mixed independently of the recording.
   *
   * GOOD is quieter than PERFECT: the sound carries information about how well
   * the note was hit, not just that it was.
   */
  playHit(voice: VoiceName, midi: number, verdict: 'PERFECT' | 'GOOD'): void {
    // The two drum-like lanes borrow the wooden bar, which has a sharper attack
    // than the string and reads better as a percussive confirmation.
    const kind: PluckKind = voice === 'phin' ? 'phin' : 'ponglang';
    const buf = this.hitBank.get(`${kind}:${midi}`);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // Slight detune per hit so a run of notes in one lane does not sound like
    // the same sample retriggering.
    src.playbackRate.value = voice === 'klong' ? 0.62 : voice === 'khaen' ? 1.18 : 1;

    const g = this.ctx.createGain();
    g.gain.value = HIT_GAIN[verdict];

    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
  }

  /** Browsers block audio until a gesture — call from the first Title click (§5.1). */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /**
   * Slider 0..100 -> gain. Squared because loudness is perceptual: a linear
   * slider spends most of its travel in a range that sounds "already loud".
   */
  setMusicVolume(v0to100: number): void {
    const v = Math.max(0, Math.min(100, v0to100)) / 100;
    this.musicBus.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.01);
  }

  setSfxVolume(v0to100: number): void {
    const v = Math.max(0, Math.min(100, v0to100)) / 100;
    this.sfxBus.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.01);
  }

  /**
   * Spec §3.4 swap-in path. With no audioUrl this only builds the chart; with
   * one it also decodes the file, and play() takes the buffer branch instead.
   */
  async load(def: SongDef, difficulty: Difficulty): Promise<LoadedSong> {
    this.buildHitBank();
    let buffer: AudioBuffer | null = null;

    if (def.audioUrl) {
      try {
        const res = await fetch(def.audioUrl);
        buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn(`[audio] "${def.audioUrl}" failed to load, falling back to synth`, err);
        buffer = null;
      }
    }

    const song: LoadedSong = { def, chart: buildChart(def, difficulty), buffer };
    this.loaded = song;
    return song;
  }

  /** Starts the Conductor and the audio together. Returns the loaded song. */
  play(song: LoadedSong): LoadedSong {
    this.stop();
    this.loaded = song;

    this.songBus = this.ctx.createGain();
    this.songBus.connect(this.musicBus);

    const startAt = this.ctx.currentTime + START_DELAY_S;
    this.conductor.start(startAt);

    if (song.buffer) {
      // Real recording: one node, the hardware keeps it in sync for us.
      const src = this.ctx.createBufferSource();
      src.buffer = song.buffer;
      src.connect(this.songBus);
      src.start(startAt);
      this.source = src;
    } else {
      // Synth: look-ahead scheduling.
      this.nextIndex = 0;
      this.pumpId = window.setInterval(() => this.pump(), PUMP_MS);
      this.pump();
    }

    return song;
  }

  /**
   * Hands every note whose time falls inside the look-ahead window to Web Audio
   * with an ABSOLUTE start time.
   *
   * setInterval is used only as a pump — it decides *when we think about*
   * scheduling, never when a note sounds. Jitter here is invisible because the
   * times passed to the voices come from the Conductor. This does not violate
   * spec §2.
   */
  private pump(): void {
    const song = this.loaded;
    const bus = this.songBus;
    if (!song || !bus || !this.conductor.isRunning) return;

    const horizon = this.conductor.rawTime + SCHEDULE_AHEAD_S;

    while (this.nextIndex < song.chart.length) {
      const note = song.chart[this.nextIndex];
      if (!note || note.time > horizon) break;

      // Skip anything already in the past (e.g. after a tab stall).
      const when = this.conductor.toCtxTime(note.time);
      if (when >= this.ctx.currentTime) {
        playVoice(note.voice, this.ctx, bus, when, note.midi);
        this.onNoteScheduled?.(note);
      }
      this.nextIndex++;
    }
  }

  /** Number of notes handed to the hardware so far — for the Phase 2 debug readout. */
  get scheduledCount(): number {
    return this.nextIndex;
  }

  stop(): void {
    if (this.pumpId !== null) {
      clearInterval(this.pumpId);
      this.pumpId = null;
    }

    this.conductor.stop();

    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source = null;
    }

    if (this.songBus) {
      // Kill notes already inside the look-ahead window, then drop the node.
      const bus = this.songBus;
      const now = this.ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + 0.02);
      window.setTimeout(() => bus.disconnect(), 400);
      this.songBus = null;
    }
  }
}
