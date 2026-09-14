import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { Input } from '../core/Input';
import { Particles } from '../ui/Particles';
import { BULLET, arrowKeyRow } from '../ui/glyphs';
import { layerHit, layerSprite, signButton } from '../ui/artLayer';
import { Performers } from './gameplay/Performers';
import { settings } from '../core/Settings';
import { audio } from '../audio/engine';
import type { LoadedSong } from '../audio/AudioEngine';
import type { Lane, SongDef } from '../audio/types';
import { songDuration } from '../game/Chart';
import { GOOD_MS, Judge, type JudgeEvent, type Verdict } from '../game/Judge';
import { goSettings } from './nav';
import { ScoreSystem, type GameResult } from '../game/ScoreSystem';
import {
  HIGHWAY_W,
  HIGHWAY_X,
  NoteHighway,
  RECEPTOR_Y,
  laneCenterX,
  laneColor,
} from '../game/NoteHighway';

const VERDICT_COLOR: Record<Verdict, number> = {
  PERFECT: C.green,
  GOOD: C.gold,
  MISS: C.red,
};

/**
 * Centre of the คะแนน plaque painted into the stage art, measured off
 * stage.png. The score number sits under its label rather than on a plaque of
 * its own.
 */
const SCORE_PLAQUE_X = 1672;
const SCORE_PLAQUE_Y = 112;

const VERDICT_TEXT: Record<Verdict, string> = {
  PERFECT: 'PERFECT',
  GOOD: 'GOOD',
  MISS: 'MISS',
};

export interface GameplayTelemetry {
  state: string;
  songTime: number;
  score: number;
  combo: number;
  multiplier: number;
  perfect: number;
  good: number;
  miss: number;
  consecutiveMisses: number;
  judged: number;
  total: number;
}

declare global {
  interface Window {
    __tfbGame?: GameplayTelemetry;
    /** DEV only: live song clock, for headless verification. */
    __tfbNow?: () => number;
    /** DEV only: the chart, so a harness can press at real note times. */
    __tfbChart?: { t: number; lane: Lane }[];
    /** DEV only: live (not frame-bound) game state. */
    __tfbState?: () => Record<string, unknown>;
  }
}

/**
 * The gameplay screen (spec §4, §5.7).
 *
 * Flow: build everything -> wait for a gesture (AudioContext needs one) -> play.
 * Every frame reads Conductor.songTime and nothing else.
 */
export class GameplayScene extends Scene {
  private readonly def: SongDef;
  private readonly onFinish: (result: GameResult) => void;

  private loaded: LoadedSong | null = null;
  private highway!: NoteHighway;
  private judge!: Judge;
  private score = new ScoreSystem();
  private input!: Input;
  private particles = new Particles();

  private running = false;
  private finished = false;
  private duration = 0;

  private scoreText!: Text;
  private accBar!: Graphics;
  private accLabel!: Text;
  private verdictText!: Text;
  private progressBar!: Graphics;
  private startOverlay!: Container;

  private firstNoteTime = 0;
  private dbgPressIn = 0;
  private dbgPressJudged = 0;

  private laneLit: Sprite[] = [];
  private readonly laneLitLife = [0, 0, 0, 0];
  private performers!: Performers;

  private verdictLife = 0;
  private shake = 0;

  constructor(def: SongDef, onFinish: (result: GameResult) => void) {
    super();
    this.def = def;
    this.onFinish = onFinish;
  }

  override async onEnter(): Promise<void> {
    this.duration = songDuration(this.def);

    this.loaded = await audio.load(this.def, settings.difficulty);
    this.highway = new NoteHighway(this.loaded.chart);
    this.judge = new Judge(this.loaded.chart);
    this.firstNoteTime = this.loaded.chart[0]?.time ?? 0;

    // Each song has its own stage set. Layer order: backdrop, the panel the
    // receptors stand on, the performers, then the receptors themselves. The
    // note highway draws on top of all of it.
    const art = `gp.${this.def.id}`;
    this.container.addChild(layerSprite(`${art}.stage`), layerSprite(`${art}.panel`));
    this.performers = new Performers(this.def);
    this.container.addChild(this.performers);

    // The four lane sprites ARE the idle receptors — they are the delivered row
    // split into four files, not lit variants of it, so they are drawn fully
    // opaque. The hit highlight is a tint-and-swell applied to the same sprite;
    // cross-fading to a second image would have shown nothing at all, since the
    // two images are byte-identical.
    this.laneLit = ([0, 1, 2, 3] as Lane[]).map((lane) => {
      const s = layerSprite(`${art}.lane${lane}`);
      this.container.addChild(s);
      return s;
    });

    this.container.addChild(this.highway.container, this.particles.container);

    this.buildHud();
    this.bindPointer();

    this.input = new Input(
      // Spec §2: the press timestamp is the audio clock, read here in the
      // handler — not sampled on the next frame.
      () => audio.ctx.currentTime,
      (lane, ctxTime) => this.handlePress(lane, ctxTime),
    );
    this.input.attach();

    this.startOverlay = this.buildStartOverlay();
    this.container.addChild(this.startOverlay);

    // The gear ornament in the stage's top-left corner is a settings button.
    // Added LAST so it is the topmost hit-test candidate — as the bottom-most
    // child it was covered by the start overlay before the song begins, and by
    // the lane layers after. signButton gives the group its own hitArea,
    // without which this full-canvas layer would in turn swallow every click
    // meant for the layers beneath it (NOTES D33).
    this.container.addChild(
      signButton('gp.sun', () => {
        audio.stop();
        goSettings(this.ctx.scenes, 'songs');
      }),
    );

    audio.setMusicVolume(settings.music);
    audio.setSfxVolume(settings.sound);
    audio.conductor.userOffsetMs = settings.offsetMs;

    // Verification hooks. import.meta.env.DEV is statically false in a
    // production build, so Rollup drops this block from the shipped bundle.
    if (import.meta.env.DEV) {
      window.__tfbNow = () => audio.conductor.songTime;
      window.__tfbChart = this.loaded.chart.map((n) => ({ t: n.time, lane: n.lane }));
      window.__tfbState = () => ({
        running: this.running,
        finished: this.finished,
        songTime: +audio.conductor.songTime.toFixed(3),
        pressesReceived: this.dbgPressIn,
        pressesJudged: this.dbgPressJudged,
        score: this.score.score,
        combo: this.score.combo,
        perfect: this.score.perfect,
        good: this.score.good,
        miss: this.score.miss,
        strays: this.score.strays,
        strayDebt: this.score.strayDebt,
        consecutiveMisses: this.score.consecutiveMisses,
      });
    }
  }

  override onExit(): void {
    this.particles.clear();
    this.input.detach();
    audio.stop();
    this.running = false;
  }

  // ---------------------------------------------------------------- ui build

  /**
   * What is left of the HUD after the plaques came off: the score, which sits
   * inside the คะแนน plaque the stage art already paints, plus the accuracy bar
   * and the verdict popup. Nothing covers the stage.
   */
  private buildHud(): void {

    // The song name and combo panels used to live here on wooden plaques. They
    // were removed at the designer's request: they sat on top of the stage art
    // and read as pasted on, which is what a HUD designed against a plain field
    // looks like once real artwork arrives behind it.

    // ---- score ------------------------------------------------------------
    // The stage art already paints a คะแนน plaque in the top-right corner, so
    // the score goes INSIDE it. Drawing a second plaque over the top was the
    // clearest sign the HUD had been designed against different artwork.
    // หมอลำ's backdrop paints a คะแนน plaque in this corner; เซิ้ง's does not, and
    // the score would sit unreadable on its patterned curtain. Supply one only
    // when the artwork has not.
    if (this.def.id !== 'molam') {
      this.container.addChild(
        new Graphics()
          .roundRect(SCORE_PLAQUE_X - 176, 34, 352, 116, 20)
          .fill(ART.woodFill)
          .roundRect(SCORE_PLAQUE_X - 176, 34, 352, 116, 20)
          .stroke({ width: 6, color: ART.wood, alignment: 0 }),
      );
      const label = new Text({
        text: 'คะแนน',
        style: { fontFamily: FONT.display, fontSize: 30, fill: ART.tealDark },
      });
      label.anchor.set(0.5, 0);
      label.position.set(SCORE_PLAQUE_X, 44);
      this.container.addChild(label);
    }

    this.scoreText = new Text({
      text: '0',
      style: { fontFamily: FONT.display, fontSize: 52, fill: ART.wood },
    });
    this.scoreText.anchor.set(0.5);
    this.scoreText.position.set(SCORE_PLAQUE_X, SCORE_PLAQUE_Y);

    // ---- accuracy, tucked under the painted คะแนน plaque -------------------
    // It used to hang off the combo panel; with that gone it would have floated
    // in the middle of the stage. Keeping it with the score puts every number
    // in one corner instead of scattering them over the artwork.
    this.accBar = new Graphics();
    this.accBar.position.set(SCORE_PLAQUE_X - 130, 168);

    this.accLabel = new Text({
      text: '100%',
      style: { fontFamily: FONT.body, fontSize: 26, fill: ART.pale },
    });
    this.accLabel.anchor.set(0.5, 0);
    this.accLabel.position.set(SCORE_PLAQUE_X, 194);

    // ---- verdict + progress ---------------------------------------------
    this.verdictText = new Text({
      text: '',
      style: { fontFamily: FONT.display, fontSize: 76, fill: C.green },
    });
    this.verdictText.anchor.set(0.5);
    this.verdictText.position.set(DESIGN_W / 2, RECEPTOR_Y - 330);
    this.verdictText.visible = false;

    this.progressBar = new Graphics();
    this.progressBar.position.set(HIGHWAY_X, 88);

    this.container.addChild(
      this.scoreText,
      this.accBar,
      this.accLabel,
      this.verdictText,
      this.progressBar,
    );
  }

  private buildStartOverlay(): Container {
    const overlay = new Container();

    // Neutral dark scrim. Tinting it brown turned the whole screen to mud
    // against the orange field.
    const veil = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: C.ink, alpha: 0.74 });

    const prompt = new Text({
      text: 'คลิกเพื่อเริ่ม',
      style: { fontFamily: FONT.display, fontSize: 92, fill: ART.pale },
    });
    prompt.anchor.set(0.5);
    prompt.position.set(DESIGN_W / 2, DESIGN_H / 2 - 40);

    // The four arrows are drawn, not typed: the display face does not map them
    // and they would render as blank boxes. Laid out left to right, then the
    // whole row is centred by its measured width.
    const keys = new Container();
    const style = { fontFamily: FONT.body, fontSize: 38, fill: ART.field };

    const lead = new Text({ text: 'D  F  J  K   หรือ', style });
    lead.anchor.set(0, 0.5);

    const arrows = arrowKeyRow(34, ART.field);
    arrows.position.set(lead.width + 24 + arrows.width / 2, 0);

    const tail = new Text({ text: `${BULLET}  แตะที่วงกลมก็ได้`, style });
    tail.anchor.set(0, 0.5);
    tail.position.set(lead.width + 48 + arrows.width, 0);

    keys.addChild(lead, arrows, tail);
    keys.position.set((DESIGN_W - keys.width) / 2, DESIGN_H / 2 + 70);

    overlay.addChild(veil, prompt, keys);
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.on('pointertap', () => void this.begin());

    return overlay;
  }

  /** Pointer/touch taps on the receptors (spec §4.5). */
  private bindPointer(): void {
    for (let i = 0; i < this.highway.receptors.length; i++) {
      const lane = i as Lane;
      const g = this.highway.receptors[i];
      if (!g) continue;
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.hitArea = {
        contains: (x: number, y: number) => Math.hypot(x, y) <= 96,
      };
      g.on('pointerdown', () => {
        if (!this.running) return;
        this.handlePress(lane, audio.ctx.currentTime);
      });
    }
  }

  // ------------------------------------------------------------------ play

  private async begin(): Promise<void> {
    if (this.running || this.finished || !this.loaded) return;

    await audio.resume();
    audio.play(this.loaded);

    // `visible = false` alone is not enough: the overlay is the last child and
    // therefore the topmost hit-test candidate, and it covers the whole screen.
    // Leaving it interactive swallowed every click meant for the gear.
    this.startOverlay.visible = false;
    this.startOverlay.eventMode = 'none';
    this.running = true;
  }

  private handlePress(lane: Lane, ctxTime: number): void {
    this.dbgPressIn++;
    if (!this.running || this.finished) return;

    const songTime = audio.conductor.ctxTimeToSongTime(ctxTime);
    const event = this.judge.press(lane, songTime);

    // A press with no note in range no longer costs nothing: it breaks the
    // combo. Ignoring it entirely made mashing all four keys the optimal
    // strategy, which is what "มันโกงไปหน่อย" was describing.
    if (!event) {
      // Before the first note there is nothing to be early for, so taps during
      // the lead-in are free. A nervous player warming up must not build a
      // stray debt against a song that has not started asking for anything.
      if (songTime >= this.firstNoteTime - GOOD_MS / 1000) {
        this.score.applyStray();
        this.shake = 0.45;
        if (this.score.failed) this.finish('FAILED');
      }
      return;
    }

    this.dbgPressJudged++;
    this.applyJudgement(event);
  }

  private applyJudgement(event: JudgeEvent): void {
    this.score.apply(event.verdict);
    this.highway.markJudged(event.note.index);

    if (event.verdict === 'MISS') {
      this.shake = 1;
    } else {
      // Audible confirmation. Fired here rather than on key-down so a press
      // that matched no note stays silent — the sound means "you hit it".
      audio.playHit(event.note.voice, event.note.midi, event.verdict);
      this.laneLitLife[event.note.lane] = 1;
      this.highway.flashReceptor(event.note.lane, 1);

      // Spec §8: burst on PERFECT only, so it stays a reward rather than noise.
      if (event.verdict === 'PERFECT') {
        this.particles.burst(
          laneCenterX(event.note.lane),
          RECEPTOR_Y,
          laneColor(event.note.lane),
          14,
        );
      }
    }

    this.showVerdict(event.verdict, event.note.lane);

    if (this.score.failed) this.finish('FAILED');
  }

  private showVerdict(verdict: Verdict, lane: Lane): void {
    this.verdictText.text = VERDICT_TEXT[verdict];
    this.verdictText.style.fill = VERDICT_COLOR[verdict];
    this.verdictText.position.x = laneCenterX(lane);
    this.verdictText.visible = true;
    this.verdictLife = 1;
  }

  private finish(state: 'CLEARED' | 'FAILED'): void {
    if (this.finished) return;
    this.finished = true;
    this.running = false;

    audio.stop();
    this.onFinish(this.score.result(this.def.id, state));
  }

  // ----------------------------------------------------------------- frame

  override update(dtMS: number): void {
    const conductor = audio.conductor;
    const songTime = this.running ? conductor.songTime : 0;

    if (this.running && !this.finished) {
      for (const miss of this.judge.collectMisses(songTime)) {
        this.applyJudgement(miss);
        if (this.finished) break;
      }

      // Spec §4.4: with no health drain, the song otherwise always runs to its
      // natural end.
      if (!this.finished && songTime >= this.duration) this.finish('CLEARED');
    }

    this.highway.update(songTime, settings.scrollSec, dtMS);
    this.particles.update(dtMS);
    // Driven by song time so the troupe keeps time with the music rather than
    // with the frame rate. Kept moving before the song starts, using the wall
    // clock, so the stage is not frozen while the start overlay is up.
    this.performers.update(this.running ? songTime : performance.now() / 1000);
    this.updateLaneLights(dtMS);
    this.updateHud(songTime, dtMS);
    this.updateEffects(dtMS);

    window.__tfbGame = {
      state: this.finished ? 'FINISHED' : this.running ? 'PLAYING' : 'READY',
      songTime,
      score: this.score.score,
      combo: this.score.combo,
      multiplier: this.score.multiplier,
      perfect: this.score.perfect,
      good: this.score.good,
      miss: this.score.miss,
      consecutiveMisses: this.score.consecutiveMisses,
      judged: this.score.judgedCount,
      total: this.loaded?.chart.length ?? 0,
    };
  }

  /**
   * Hit highlight on a receptor: a brief white tint and swell, decaying over
   * ~140ms. Done in code because the delivered "lit" files turned out to be
   * byte-identical to the idle ones — fading between them showed nothing.
   */
  private updateLaneLights(dtMS: number): void {
    for (let i = 0; i < this.laneLit.length; i++) {
      const life = this.laneLitLife[i] ?? 0;
      const s = this.laneLit[i];
      if (!s || life <= 0) continue;

      const next = Math.max(0, life - dtMS / 140);
      this.laneLitLife[i] = next;

      // Lighten toward white, and swell about the receptor's own centre.
      const k = Math.round(255 * (1 - 0.45 * next));
      s.tint = (255 << 16) | (k << 8) | k;
      const grow = 1 + 0.07 * next;
      s.scale.set(grow);
      // layerSprite draws at (0,0) full-canvas, so scaling about the origin
      // would slide the whole layer; re-anchor the growth on the disc itself.
      const hit = layerHit(`gp.${this.def.id}.lane${i}`);
      if (hit) {
        s.position.set(
          -(hit.x + hit.w / 2) * (grow - 1),
          -(hit.y + hit.h / 2) * (grow - 1),
        );
      }
    }
  }

  private updateHud(songTime: number, _dtMS: number): void {
    this.scoreText.text = this.score.score.toLocaleString('en-US');

    const acc = this.score.accuracy;
    this.accLabel.text = `${Math.round(acc * 100)}%`;

    const w = 260;
    this.accBar.clear();
    this.accBar.roundRect(0, 0, w, 22, 11).fill(C.paper);
    this.accBar
      .roundRect(0, 0, Math.max(6, w * acc), 22, 11)
      .fill(acc > 0.7 ? C.green : acc > 0.4 ? C.gold : C.red);
    this.accBar.roundRect(0, 0, w, 22, 11).stroke({ width: 4, color: ART.wood, alignment: 0 });

    const p = this.duration > 0 ? Math.max(0, Math.min(1, songTime / this.duration)) : 0;
    this.progressBar.clear();
    if (p > 0) this.progressBar.roundRect(0, 0, Math.max(8, HIGHWAY_W * p), 12, 6).fill(ART.tealDark);
  }

  private updateEffects(dtMS: number): void {

    if (this.verdictLife > 0) {
      this.verdictLife = Math.max(0, this.verdictLife - dtMS / 420);
      this.verdictText.alpha = Math.min(1, this.verdictLife * 1.6);
      this.verdictText.scale.set(0.9 + 0.25 * (1 - this.verdictLife));
      this.verdictText.visible = this.verdictLife > 0;
    } else {
      this.verdictText.visible = false;
    }

    // Screen shake on miss. Applied to the highway only, so the HUD stays legible.
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dtMS / 220);
      const amp = 14 * this.shake;
      this.highway.container.position.set(
        (Math.random() * 2 - 1) * amp,
        (Math.random() * 2 - 1) * amp * 0.5,
      );
    } else {
      this.highway.container.position.set(0, 0);
    }
  }
}

/** Re-exported so scenes importing Gameplay do not also need the game module. */
export type { GameResult };
export { laneColor };
