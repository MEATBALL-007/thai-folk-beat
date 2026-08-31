import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { C, FONT } from '../ui/theme';
import { type LoadedSong } from '../audio/AudioEngine';
import { audio } from '../audio/engine';
import { MOLAM } from '../audio/songs/molam';
import { SOENG } from '../audio/songs/soeng';
import { secondsPerBar, songDuration } from '../game/Chart';
import type { SongDef } from '../audio/types';
import { verifySongAudio, type OnsetReport } from '../audio/verify';

/**
 * Phase 2 verification scene. Not shipped — deleted in Phase 5.
 *
 * Exists to answer the two questions the spec insists on before Phase 3:
 *   1. does it sound like music?  (by ear — the level meter only proves signal)
 *   2. is the clock stable?       (drift readout vs. an rAF-accumulated clock)
 *
 * The START button sits dead centre of the design space on purpose, so headless
 * verification can click the canvas centre and get a *trusted* user gesture,
 * which is what AudioContext.resume() requires.
 */

interface Telemetry {
  started: boolean;
  songTime: number;
  rawTime: number;
  driftMs: number;
  scheduled: number;
  total: number;
  rms: number;
  peakRms: number;
  ctxState: string;
  sampleRate: number;
  baseLatencyMs: number;
  song: string;
}

declare global {
  interface Window {
    __tfb?: Telemetry;
    /** Dev hook: offline-render both songs and check onsets land on chart times. */
    __tfbVerify?: () => Promise<OnsetReport[]>;
  }
}

const LANE_NAMES = ['กลอง klong', 'โปงลาง ponglang', 'พิณ phin', 'แคน khaen'];

export class AudioDebugScene extends Scene {
  // Shared singleton: a second AudioContext would mean a second, unrelated clock.
  private engine = audio;
  private analyser: AnalyserNode | null = null;
  private analyserBuf = new Float32Array(1024);

  private loaded: LoadedSong | null = null;
  private def: SongDef = MOLAM;

  private rafClockMs = 0;
  private started = false;
  private peakRms = 0;
  private recent: string[] = [];

  private readout!: Text;
  private noteLog!: Text;
  private meter!: Graphics;
  private startBtn!: Container;
  private laneBlips: Graphics[] = [];
  private laneFlash = [0, 0, 0, 0];

  override onEnter(): void {
    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(C.cream);

    const title = new Text({
      text: 'PHASE 2 — AUDIO DEBUG',
      style: { fontFamily: FONT.display, fontSize: 60, fill: C.ink },
    });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN_W / 2, 50);

    const hint = new Text({
      text: 'คลิกเพื่อเริ่ม  •  [1] หมอลำ   [2] เซิ้ง   [S] หยุด',
      style: { fontFamily: FONT.body, fontSize: 32, fill: C.olive },
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(DESIGN_W / 2, 130);

    this.readout = new Text({
      text: '',
      style: { fontFamily: FONT.body, fontSize: 30, fill: C.ink, lineHeight: 42 },
    });
    this.readout.position.set(140, 210);

    this.noteLog = new Text({
      text: '',
      style: { fontFamily: FONT.body, fontSize: 26, fill: C.olive, lineHeight: 36 },
    });
    this.noteLog.position.set(1180, 210);

    this.meter = new Graphics();
    this.meter.position.set(140, 960);

    this.container.addChild(bg, title, hint, this.readout, this.noteLog, this.meter);

    // One blip per lane, flashing as that lane's voice is scheduled — makes the
    // call-and-response structure visible without having to hear it.
    for (let lane = 0; lane < 4; lane++) {
      const g = new Graphics().circle(0, 0, 44).fill(C.olive);
      g.position.set(300 + lane * 200, 830);
      this.laneBlips.push(g);
      this.container.addChild(g);

      const label = new Text({
        text: LANE_NAMES[lane] ?? '',
        style: { fontFamily: FONT.body, fontSize: 22, fill: C.ink },
      });
      label.anchor.set(0.5, 0);
      label.position.set(300 + lane * 200, 886);
      this.container.addChild(label);
    }

    this.startBtn = this.makeStartButton();
    this.container.addChild(this.startBtn);

    this.engine.setMusicVolume(80);
    this.engine.setSfxVolume(80);
    this.engine.onNoteScheduled = (note) => {
      this.laneFlash[note.lane] = 1;
      this.recent.unshift(`${note.time.toFixed(2)}s  L${note.lane}  ${note.voice}`);
      if (this.recent.length > 10) this.recent.pop();
    };

    window.addEventListener('keydown', this.onKey);

    window.__tfbVerify = async () => [await verifySongAudio(MOLAM), await verifySongAudio(SOENG)];
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.engine.stop();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.key === '1') void this.startSong(MOLAM);
    if (e.key === '2') void this.startSong(SOENG);
    if (e.key.toLowerCase() === 's') {
      this.engine.stop();
      this.started = false;
    }
  };

  private makeStartButton(): Container {
    const w = 460;
    const h = 150;
    const btn = new Container();
    // Dead centre — see class comment.
    btn.position.set((DESIGN_W - w) / 2, (DESIGN_H - h) / 2);

    const face = new Graphics()
      .roundRect(0, 0, w, h, 24)
      .fill(C.green)
      .roundRect(0, 0, w, h, 24)
      .stroke({ width: 6, color: C.ink, alignment: 0 });

    const label = new Text({
      text: '▶  START',
      style: { fontFamily: FONT.display, fontSize: 56, fill: C.ink },
    });
    label.anchor.set(0.5);
    label.position.set(w / 2, h / 2);

    btn.addChild(face, label);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => void this.startSong(this.def));

    return btn;
  }

  private async startSong(def: SongDef): Promise<void> {
    this.def = def;
    this.recent = [];
    this.peakRms = 0;

    // Must happen inside the gesture handler chain.
    await this.engine.resume();

    if (!this.analyser) {
      this.analyser = this.engine.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.engine.master.connect(this.analyser);
    }

    this.loaded = await this.engine.load(def);
    this.engine.play(this.loaded);

    this.rafClockMs = 0;
    this.started = true;
    this.startBtn.visible = false;
  }

  override update(dtMS: number): void {
    for (let i = 0; i < 4; i++) {
      const blip = this.laneBlips[i];
      if (!blip) continue;
      const f = this.laneFlash[i] ?? 0;
      if (f > 0) {
        this.laneFlash[i] = Math.max(0, f - dtMS / 220);
        blip.tint = i % 2 === 0 ? C.green : C.gold;
        blip.scale.set(1 + 0.35 * (this.laneFlash[i] ?? 0));
      } else {
        blip.tint = 0xffffff;
        blip.scale.set(1);
      }
    }

    const conductor = this.engine.conductor;
    const ctx = this.engine.ctx;

    if (this.started && conductor.isRunning) {
      this.rafClockMs += dtMS;
    }

    const songTime = conductor.isRunning ? conductor.songTime : 0;
    const rawTime = conductor.isRunning ? conductor.rawTime : 0;
    // Positive = the frame-accumulated clock has run AHEAD of the audio clock.
    const driftMs = this.started ? this.rafClockMs - rawTime * 1000 : 0;

    let rms = 0;
    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(this.analyserBuf);
      let sum = 0;
      for (let i = 0; i < this.analyserBuf.length; i++) {
        const v = this.analyserBuf[i] ?? 0;
        sum += v * v;
      }
      rms = Math.sqrt(sum / this.analyserBuf.length);
      if (rms > this.peakRms) this.peakRms = rms;
    }

    const spBar = secondsPerBar(this.def.bpm);
    const bar = Math.floor(rawTime / spBar);
    const beat = (rawTime / (spBar / 4)) % 4;
    const total = this.loaded?.chart.length ?? 0;
    const dur = songDuration(this.def);

    this.readout.text = [
      `song           ${this.def.titleTh}  (${this.def.id})  ${this.def.bpm} BPM`,
      `songTime       ${songTime.toFixed(3)} s   / ${dur.toFixed(2)} s`,
      `rawTime        ${rawTime.toFixed(3)} s   (no calibration)`,
      `bar : beat     ${Math.max(0, bar)} : ${(Math.max(0, beat) + 1).toFixed(2)}`,
      `scheduled      ${this.engine.scheduledCount} / ${total} notes`,
      ``,
      `rAF clock      ${(this.rafClockMs / 1000).toFixed(3)} s`,
      `DRIFT          ${driftMs >= 0 ? '+' : ''}${driftMs.toFixed(1)} ms  (rAF vs AudioContext)`,
      ``,
      `ctx.state      ${ctx.state}`,
      `sampleRate     ${ctx.sampleRate} Hz`,
      `baseLatency    ${(ctx.baseLatency * 1000).toFixed(2)} ms`,
      `RMS            ${rms.toFixed(4)}   peak ${this.peakRms.toFixed(4)}`,
    ].join('\n');

    this.noteLog.text = ['recent notes scheduled', '──────────────────────', ...this.recent].join('\n');

    const meterW = 900;
    const level = Math.min(1, rms * 6);
    this.meter.clear();
    this.meter.rect(0, 0, meterW, 40).fill(C.paper);
    this.meter.rect(0, 0, meterW * level, 40).fill(level > 0.85 ? C.red : C.green);
    this.meter.rect(0, 0, meterW, 40).stroke({ width: 4, color: C.ink, alignment: 0 });

    window.__tfb = {
      started: this.started,
      songTime,
      rawTime,
      driftMs,
      scheduled: this.engine.scheduledCount,
      total,
      rms,
      peakRms: this.peakRms,
      ctxState: ctx.state,
      sampleRate: ctx.sampleRate,
      baseLatencyMs: ctx.baseLatency * 1000,
      song: this.def.id,
    };
  }
}
