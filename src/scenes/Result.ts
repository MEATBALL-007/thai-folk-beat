import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { layerSprite, signButton } from '../ui/artLayer';
import { getBest, submitBest } from '../game/best';
import type { GameResult } from '../game/ScoreSystem';

const COUNT_UP_MS = 800;

/**
 * Result screen (spec §5.8).
 *
 * The best score is submitted once, in onEnter — not in the update loop, and not
 * in the caller — so a retry cannot double-submit and the "NEW RECORD" state is
 * decided before the first frame draws.
 */
/**
 * The delivered panel's alpha bounds (result.pass / result.fail), measured by
 * scripts/measure-sprites.mjs. Everything the scene draws is positioned inside
 * this box so it stays on the artwork.
 */
const PANEL = { x: 497, y: 111, w: 913, h: 677 };

export class ResultScene extends Scene {
  private readonly result: GameResult;
  private readonly onReplay: () => void;
  private readonly onMenu: () => void;

  private best = 0;
  private isNewRecord = false;

  private scoreText!: Text;
  private recordText!: Text | null;
  private elapsed = 0;

  constructor(result: GameResult, onReplay: () => void, onMenu: () => void) {
    super();
    this.result = result;
    this.onReplay = onReplay;
    this.onMenu = onMenu;
  }

  override onEnter(): void {
    this.isNewRecord = submitBest(this.result.songId, this.result.score);
    this.best = getBest(this.result.songId);

    const cleared = this.result.state === 'CLEARED';

    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    this.container.addChild(bg, layerSprite('bg.menuFrame'));

    // ---- panel -----------------------------------------------------------
    // The delivered panels carry "ผ่าน!" / "พลาด!" painted in, so the scene
    // must NOT draw a heading of its own — it would print the outcome twice.
    this.container.addChild(layerSprite(cleared ? 'result.pass' : 'result.fail'));

    const panelX = PANEL.x;
    const panelW = PANEL.w;
    const panelY = PANEL.y;

    const bannerTh = new Text({
      text: cleared ? 'เล่นจบเพลง' : 'พลาดติดกัน 4 ครั้ง',
      style: { fontFamily: FONT.body, fontSize: 32, fill: ART.wood },
    });
    bannerTh.anchor.set(0.5);
    bannerTh.position.set(DESIGN_W / 2, panelY + 206);
    this.container.addChild(bannerTh);

    const scoreLabel = new Text({
      text: 'SCORE',
      style: { fontFamily: FONT.display, fontSize: 34, fill: ART.wood },
    });
    scoreLabel.anchor.set(0.5, 0);
    scoreLabel.position.set(DESIGN_W / 2, panelY + 244);

    this.scoreText = new Text({
      text: '0',
      style: { fontFamily: FONT.display, fontSize: 112, fill: ART.tealDark },
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.position.set(DESIGN_W / 2, panelY + 282);

    const bestText = new Text({
      text: `BEST  ${this.best.toLocaleString('en-US')}`,
      style: { fontFamily: FONT.body, fontSize: 34, fill: ART.wood },
    });
    bestText.anchor.set(0.5, 0);
    bestText.position.set(DESIGN_W / 2, panelY + 412);

    this.container.addChild(scoreLabel, this.scoreText, bestText);

    // ---- tallies ---------------------------------------------------------
    const tallies: [string, number, number][] = [
      ['PERFECT', this.result.perfect, C.green],
      ['GOOD', this.result.good, C.gold],
      ['MISS', this.result.miss, C.red],
    ];

    const colW = panelW / 4;
    tallies.forEach(([label, value, color], i) => {
      const cx = panelX + colW * (i + 0.5);
      this.container.addChild(this.tallyColumn(cx, panelY + 476, label, value, color));
    });

    const comboCx = panelX + colW * 3.5;
    this.container.addChild(
      this.tallyColumn(comboCx, panelY + 476, 'MAX COMBO', this.result.maxCombo, ART.wood),
    );

    // ---- new record ------------------------------------------------------
    if (this.isNewRecord) {
      this.recordText = new Text({
        text: 'NEW RECORD!',
        style: { fontFamily: FONT.display, fontSize: 56, fill: C.gold },
      });
      this.recordText.anchor.set(0.5);
      // Inside the panel, not below it: the delivered buttons start at y~796.
      this.recordText.position.set(DESIGN_W / 2, panelY + 592);
      this.container.addChild(this.recordText);
    } else {
      this.recordText = null;
    }

    // ---- buttons ---------------------------------------------------------
    // The delivered sign art, with the icon painted in. signButton sets each
    // group's hitArea, without which only the topmost full-canvas layer would
    // receive clicks (NOTES D33).
    this.container.addChild(
      signButton('result.retry', () => this.onReplay()),
      signButton('result.home', () => this.onMenu()),
    );

    // Thai captions under the painted icons, since the signs carry no words.
    const captions: [string, number][] = [
      ['เล่นอีกครั้ง', 431],
      ['กลับเมนู', 1491],
    ];
    for (const [text, cx] of captions) {
      const t = new Text({
        text,
        style: { fontFamily: FONT.body, fontSize: 30, fill: ART.wood },
      });
      t.anchor.set(0.5, 0);
      t.position.set(cx, 976);
      this.container.addChild(t);
    }
  }

  private tallyColumn(cx: number, y: number, label: string, value: number, color: number): Container {
    const col = new Container();

    const l = new Text({
      text: label,
      style: { fontFamily: FONT.body, fontSize: 26, fill: ART.wood },
    });
    l.anchor.set(0.5, 0);
    l.position.set(cx, y);

    const v = new Text({
      text: String(value),
      style: { fontFamily: FONT.display, fontSize: 60, fill: color },
    });
    v.anchor.set(0.5, 0);
    v.position.set(cx, y + 30);

    col.addChild(l, v);
    return col;
  }

  override update(dtMS: number): void {
    this.elapsed += dtMS;

    // Count-up, ease-out so it decelerates into the final number (spec §5.8).
    const t = Math.min(1, this.elapsed / COUNT_UP_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    const shown = Math.round(this.result.score * eased);
    this.scoreText.text = shown.toLocaleString('en-US');

    if (this.recordText) {
      const pulse = 1 + 0.06 * Math.sin(this.elapsed / 180);
      this.recordText.scale.set(pulse);
    }
  }
}
