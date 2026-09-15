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

/**
 * Hit-feedback gain per verdict. GOOD is quieter so the sound carries
 * information about how well the note was hit, not just that it was.
 *
 * Raised on 2026-09-15 after measuring the live graph: the delivered samples
 * arrived at wildly different levels (bass peaked at 0.16 where the drum hit
 * 1.00, a six-fold difference) and the quiet ones were inaudible under the
 * song. The files are now normalised to a common 0.9 peak, and this sits the
 * feedback alongside the music instead of 20 dB beneath it.
 */
export const HIT_GAIN = { PERFECT: 0.5, GOOD: 0.34 } as const;

/** Every delivered one-shot is normalised to this peak. */
export const SFX_PEAK = 0.9;

/** UI clicks are confirmation, not performance — well under a played note. */
const UI_GAIN = 0.3;

/**
 * Worst case the master bus must survive: the loudest sample of the recording
 * landing on the same sample as four simultaneous PERFECT hits, with both
 * volume sliders at 100.
 */
const WORST_CASE_SUM = RECORDING_PEAK + 4 * SFX_PEAK * HIT_GAIN.PERFECT;

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
// 0.98 rather than 1.0: landing exactly on unity leaves nothing for the
// inter-sample peaks an mp3 decoder can produce above its own stated maximum.
export const MASTER_HEADROOM = Math.min(0.5, 0.98 / WORST_CASE_SUM);

/**
 * The menu theme sits under the interface rather than in front of it, so it
 * plays below the level a gameplay track would.
 */
const MENU_MUSIC_GAIN = 0.55;

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

  /** Real instrument one-shots, decoded once and kept for the session. */
  private readonly sfx = new Map<string, AudioBuffer>();

  /** The looping menu theme. Decoded once and kept for the session. */
  private menuBuffer: AudioBuffer | null = null;
  private menuSource: AudioBufferSourceNode | null = null;
  private menuGain: GainNode | null = null;
  /**
   * Whether the menu theme is currently WANTED, as opposed to currently
   * playing. startMenuMusic has an await in it, so without this a stop issued
   * while a start is in flight is simply overtaken: the comic's last click both
   * starts the theme and navigates to the loader that stops it, and the start
   * lands afterwards. That is the menu and gameplay tracks playing together.
   */
  private menuWanted = false;

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
    void this.prepareSfx();
    const kinds: PluckKind[] = ['phin', 'ponglang'];
    for (const kind of kinds) {
      for (const midi of PENTATONIC) {
        this.hitBank.set(`${kind}:${midi}`, renderPluck(this.ctx, midi, kind));
      }
    }
  }

  /**
   * A short click for pressing something in the interface.
   *
   * Uses the sixth delivered one-shot, which is not one of the four lane
   * instruments. Quieter than a hit, and hard-cut at 0.2s so rattling through a
   * menu does not stack into a drone.
   */
  playUi(): void {
    const buf = this.sfx.get('extra');
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const g = this.ctx.createGain();
    g.gain.value = UI_GAIN;

    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
  }

  /**
   * Feedback for a successful hit. Routed through sfxBus, so the player's SFX
   * slider governs it and it is mixed independently of the recording.
   *
   * GOOD is quieter than PERFECT: the sound carries information about how well
   * the note was hit, not just that it was.
   */
  playHit(
    voice: VoiceName,
    midi: number,
    verdict: 'PERFECT' | 'GOOD',
    songId: 'molam' | 'soeng' = 'molam',
  ): void {
    // Lane roles follow the panel art, which names a เบส on หมอลำ's stage and a
    // ซอ on เซิ้ง's in the same position.
    const byVoice: Record<VoiceName, string> = {
      khaen: 'khaen',
      phin: 'phin',
      ponglang: songId === 'soeng' ? 'saw' : 'bass',
      klong: 'drum',
    };

    const real = this.sfx.get(byVoice[voice]);
    const src = this.ctx.createBufferSource();

    if (real) {
      src.buffer = real;
    } else {
      // Fallback to the synthesised voice, so a failed download costs fidelity
      // rather than all feedback.
      const kind: PluckKind = voice === 'phin' ? 'phin' : 'ponglang';
      const buf = this.hitBank.get(`${kind}:${midi}`);
      if (!buf) return;
      src.buffer = buf;
      src.playbackRate.value = voice === 'klong' ? 0.62 : voice === 'khaen' ? 1.18 : 1;
    }

    const g = this.ctx.createGain();
    g.gain.value = HIT_GAIN[verdict];

    // No envelope here: the delivered sustains ran three seconds and would have
    // piled into a drone at a few notes per second, so they are trimmed to
    // ~0.55s with a fade at source — and crucially normalised AFTER that trim.
    // Normalising the whole file first put the loudest moment in the part that
    // never played, leaving the audible attack five times quieter than the
    // level that had been set for it.
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
  }

  /**
   * The menu theme, looping from the title screen through the comic.
   *
   * Deliberately NOT routed through songBus or the Conductor: this is ambience
   * with no chart behind it, and giving it the song clock would mean a second
   * thing claiming to be "the song". It joins at musicBus so the music slider
   * governs it, and gameplay never overlaps because goLoading stops it first.
   *
   * Idempotent — every menu scene calls it on entry, so returning from a song
   * or arriving via a dev deep link both pick the music back up.
   */
  /**
   * Decodes the delivered instrument one-shots.
   *
   * These replace the synthesised hit sounds now that the designer has supplied
   * real recordings. The synthesis in pluck.ts stays as the fallback: if a file
   * fails to decode, a hit still makes a sound rather than silently doing
   * nothing, which is the failure the whole feature exists to avoid.
   */
  async prepareSfx(): Promise<void> {
    const names = ['khaen', 'phin', 'bass', 'saw', 'drum', 'extra'];
    await Promise.all(
      names.map(async (name) => {
        if (this.sfx.has(name)) return;
        try {
          const res = await fetch(`assets/sfx/${name}.mp3`);
          this.sfx.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
        } catch (err) {
          console.warn(`[audio] sfx "${name}" failed to load`, err);
        }
      }),
    );
  }

  /**
   * Fetches and decodes the menu theme without playing it.
   *
   * Called during boot, because the decode is the slow part: main.mp3 is 143
   * seconds of audio, and decoding it only when the player first clicks left
   * the title screen silent for several seconds. The boot loader already exists
   * and already waits — this is real work for it to report.
   */
  async prepareMenuMusic(url = 'assets/audio/main.mp3'): Promise<void> {
    if (this.menuBuffer) return;
    try {
      const res = await fetch(url);
      this.menuBuffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      console.warn('[audio] menu theme failed to load', err);
    }
  }

  async startMenuMusic(url = 'assets/audio/main.mp3'): Promise<void> {
    // Only the idempotence guard. There used to be a `ctx.state === 'running'`
    // check here and it was wrong: a caller can legitimately reach this while
    // the context is still waking, and a buffer source built on a suspended
    // context simply plays when the context resumes. The guard turned that into
    // silence — the method ran, returned on its first line, and nothing played.
    if (this.menuSource) return;
    this.menuWanted = true;

    try {
      if (!this.menuBuffer) await this.prepareMenuMusic(url);
      if (!this.menuBuffer) return;
      // A second call may have won the race while that was decoding — or a stop
      // may have been issued, in which case this start is stale and must not
      // resurrect the theme over a song that has already begun.
      if (this.menuSource || !this.menuWanted) return;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.musicBus);

      const src = this.ctx.createBufferSource();
      src.buffer = this.menuBuffer;
      src.loop = true;
      src.connect(gain);
      src.start();

      // Fade in, so arriving at the title screen is not a jump cut.
      gain.gain.setTargetAtTime(MENU_MUSIC_GAIN, this.ctx.currentTime, 0.4);

      this.menuSource = src;
      this.menuGain = gain;
    } catch (err) {
      console.warn('[audio] menu theme failed to load', err);
    }
  }

  /** Whether the menu theme is currently running. Used by the headless checks. */
  get menuMusicPlaying(): boolean {
    return this.menuSource !== null;
  }

  /** Fades the menu theme out and drops it. Safe to call when nothing is playing. */
  stopMenuMusic(fadeS = 0.35): void {
    this.menuWanted = false;

    const src = this.menuSource;
    const gain = this.menuGain;
    this.menuSource = null;
    this.menuGain = null;
    if (!src || !gain) return;

    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeS);
    window.setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      gain.disconnect();
    }, fadeS * 1000 + 120);
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
  async load(
    def: SongDef,
    difficulty: Difficulty,
    onProgress?: (fraction: number) => void,
  ): Promise<LoadedSong> {
    this.buildHitBank();
    let buffer: AudioBuffer | null = null;

    if (def.audioUrl) {
      try {
        const res = await fetch(def.audioUrl);
        // Read the body as a stream so the loading bar can report real
        // progress. Without this the bar has nothing to measure: the decode is
        // one opaque await, and the screen just sits at 0 and then jumps.
        const total = Number(res.headers.get('content-length')) || 0;
        const reader = res.body?.getReader();

        let bytes: Uint8Array;
        if (reader && total > 0) {
          const chunks: Uint8Array[] = [];
          let received = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            // Leave the last 15% for the decode, which is not instant.
            onProgress?.(Math.min(0.85, (received / total) * 0.85));
          }
          bytes = new Uint8Array(received);
          let at = 0;
          for (const c of chunks) {
            bytes.set(c, at);
            at += c.length;
          }
        } else {
          bytes = new Uint8Array(await res.arrayBuffer());
        }

        onProgress?.(0.85);
        buffer = await this.ctx.decodeAudioData(bytes.buffer as ArrayBuffer);
        onProgress?.(1);
      } catch (err) {
        console.warn(`[audio] "${def.audioUrl}" failed to load, falling back to synth`, err);
        buffer = null;
        onProgress?.(1);
      }
    } else {
      onProgress?.(1);
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
