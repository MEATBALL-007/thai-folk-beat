import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { Input } from '../core/Input';
import { Particles } from '../ui/Particles';
import { BULLET, arrowKeyRow } from '../ui/glyphs';
import { layerSprite } from '../ui/artLayer';
import { settings } from '../core/Settings';
import { audio } from '../audio/engine';
import type { LoadedSong } from '../audio/AudioEngine';
import type { Lane, SongDef } from '../audio/types';
import { songDuration } from '../game/Chart';
import { Judge, type JudgeEvent, type Verdict } from '../game/Judge';
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

  private comboText!: Text;
  private multText!: Text;
  private scoreText!: Text;
  private accBar!: Graphics;
  private accLabel!: Text;
  private verdictText!: Text;
  private titleText!: Text;
  private progressBar!: Graphics;
  private startOverlay!: Container;

  private dbgPressIn = 0;
  private dbgPressJudged = 0;

  private comboPunch = 0;
  private verdictLife = 0;
  private shake = 0;

  constructor(def: SongDef, onFinish: (result: GameResult) => void) {
    super();
    this.def = def;
    this.onFinish = onFinish;
  }

  override async onEnter(): Promise<void> {
    this.duration = songDuration(this.def);

    this.loaded = await audio.load(this.def, 'normal');
    this.highway = new NoteHighway(this.loaded.chart);
    this.judge = new Judge(this.loaded.chart);

    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    // Same frame + instrument silhouettes as every menu screen, so gameplay no
    // longer reads as a different game.
    this.container.addChild(bg, layerSprite('bg.menuFrame'));
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

  /** A wooden plaque in the style of the menu panels. */
  private plaque(cx: number, cy: number, w: number, h: number): Graphics {
    return new Graphics()
      .roundRect(cx - w / 2 + 5, cy - h / 2 + 6, w, h, 22)
      .fill({ color: ART.wood, alpha: 0.16 })
      .roundRect(cx - w / 2, cy - h / 2, w, h, 22)
      .fill(ART.woodFill)
      .roundRect(cx - w / 2, cy - h / 2, w, h, 22)
      .stroke({ width: 7, color: ART.wood, alignment: 0 });
  }

  /**
   * HUD lives in the two side gutters left empty by the note board, on wooden
   * plaques matching the menus. Nothing overlaps the lanes, so the playfield
   * stays readable at speed.
   */
  private buildHud(): void {
    const LEFT = 322;
    const RIGHT = DESIGN_W - 322;

    // ---- song name -------------------------------------------------------
    const titlePlate = this.plaque(LEFT, 168, 350, 104);
    this.titleText = new Text({
      text: this.def.titleTh,
      style: { fontFamily: FONT.display, fontSize: 52, fill: ART.tealDark },
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(LEFT, 168);

    // ---- combo + multiplier ---------------------------------------------
    const comboPlate = this.plaque(LEFT, 420, 350, 250);

    const comboLabel = new Text({
      text: 'COMBO',
      style: { fontFamily: FONT.display, fontSize: 28, fill: ART.wood },
    });
    comboLabel.anchor.set(0.5, 0);
    comboLabel.position.set(LEFT, 326);

    this.comboText = new Text({
      text: '0',
      style: { fontFamily: FONT.display, fontSize: 96, fill: ART.wood },
    });
    this.comboText.anchor.set(0.5);
    this.comboText.position.set(LEFT, 412);

    this.multText = new Text({
      text: 'x1',
      style: { fontFamily: FONT.display, fontSize: 46, fill: ART.tealDark },
    });
    this.multText.anchor.set(0.5);
    this.multText.position.set(LEFT, 496);

    // ---- score + accuracy ------------------------------------------------
    const scorePlate = this.plaque(RIGHT, 300, 350, 210);

    const scoreLabel = new Text({
      text: 'SCORE',
      style: { fontFamily: FONT.display, fontSize: 28, fill: ART.wood },
    });
    scoreLabel.anchor.set(0.5, 0);
    scoreLabel.position.set(RIGHT, 218);

    this.scoreText = new Text({
      text: '0',
      style: { fontFamily: FONT.display, fontSize: 68, fill: ART.wood },
    });
    this.scoreText.anchor.set(0.5);
    this.scoreText.position.set(RIGHT, 292);

    this.accBar = new Graphics();
    this.accBar.position.set(RIGHT - 130, 356);

    this.accLabel = new Text({
      text: '100%',
      style: { fontFamily: FONT.body, fontSize: 26, fill: ART.wood },
    });
    this.accLabel.anchor.set(0.5, 0);
    this.accLabel.position.set(RIGHT, 382);

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
      titlePlate,
      this.titleText,
      comboPlate,
      comboLabel,
      this.comboText,
      this.multText,
      scorePlate,
      scoreLabel,
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

    this.startOverlay.visible = false;
    this.running = true;
  }

  private handlePress(lane: Lane, ctxTime: number): void {
    this.dbgPressIn++;
    if (!this.running || this.finished) return;

    const songTime = audio.conductor.ctxTimeToSongTime(ctxTime);
    const event = this.judge.press(lane, songTime);

    // Spec §4.2: a press with no note in range is ignored outright.
    if (!event) return;

    this.dbgPressJudged++;
    this.applyJudgement(event);
  }

  private applyJudgement(event: JudgeEvent): void {
    this.score.apply(event.verdict);
    this.highway.markJudged(event.note.index);

    if (event.verdict === 'MISS') {
      this.shake = 1;
    } else {
      this.highway.flashReceptor(event.note.lane, 1);
      this.comboPunch = 1;

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

  private updateHud(songTime: number, _dtMS: number): void {
    this.comboText.text = String(this.score.combo);
    this.multText.text = `x${this.score.multiplier}`;
    this.multText.style.fill = this.score.multiplier >= 8 ? C.green : ART.tealDark;
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
    if (this.comboPunch > 0) {
      this.comboPunch = Math.max(0, this.comboPunch - dtMS / 160);
      this.comboText.scale.set(1 + 0.35 * this.comboPunch);
    } else {
      this.comboText.scale.set(1);
    }

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
