import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { layerSprite } from '../ui/artLayer';
import { Button } from '../ui/Button';
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

    // ---- banner ----------------------------------------------------------
    const bannerColor = cleared ? C.green : C.red;
    // Inset, not full-bleed: the delivered frame has a teal border and corner
    // ornaments, and a full-width banner cut straight across them.
    // Clear of the frame's corner ornaments, which reach x~250 / x~1670.
    const bannerX = 285;
    const bannerW = DESIGN_W - bannerX * 2;
    const banner = new Graphics()
      .roundRect(bannerX, 100, bannerW, 164, 22)
      .fill({ color: bannerColor, alpha: 0.18 })
      .roundRect(bannerX, 100, bannerW, 164, 22)
      .stroke({ width: 6, color: bannerColor, alignment: 0 });

    const bannerText = new Text({
      text: cleared ? 'CLEARED' : 'FAILED',
      style: { fontFamily: FONT.display, fontSize: 104, fontWeight: '700', fill: bannerColor },
    });
    bannerText.anchor.set(0.5);
    bannerText.position.set(DESIGN_W / 2, 166);

    const bannerTh = new Text({
      text: cleared ? 'เล่นจบเพลง' : 'พลาดติดกัน 4 ครั้ง',
      style: { fontFamily: FONT.body, fontSize: 32, fill: ART.wood },
    });
    bannerTh.anchor.set(0.5);
    bannerTh.position.set(DESIGN_W / 2, 230);

    this.container.addChild(banner, bannerText, bannerTh);

    // ---- score panel -----------------------------------------------------
    const panelW = 900;
    const panelH = 420;
    const panelX = (DESIGN_W - panelW) / 2;
    const panelY = 312;

    const panel = new Graphics()
      .roundRect(panelX, panelY, panelW, panelH, 26)
      .fill({ color: ART.woodFill, alpha: 0.92 })
      .roundRect(panelX, panelY, panelW, panelH, 26)
      .stroke({ width: 8, color: ART.wood, alignment: 0 });
    this.container.addChild(panel);

    const scoreLabel = new Text({
      text: 'SCORE',
      style: { fontFamily: FONT.display, fontSize: 34, fontWeight: '700', fill: ART.wood },
    });
    scoreLabel.anchor.set(0.5, 0);
    scoreLabel.position.set(DESIGN_W / 2, panelY + 34);

    this.scoreText = new Text({
      text: '0',
      style: { fontFamily: FONT.display, fontSize: 120, fontWeight: '700', fill: ART.tealDark },
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.position.set(DESIGN_W / 2, panelY + 74);

    const bestText = new Text({
      text: `BEST  ${this.best.toLocaleString('en-US')}`,
      style: { fontFamily: FONT.body, fontSize: 34, fill: ART.wood },
    });
    bestText.anchor.set(0.5, 0);
    bestText.position.set(DESIGN_W / 2, panelY + 212);

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
      this.container.addChild(this.tallyColumn(cx, panelY + 288, label, value, color));
    });

    const comboCx = panelX + colW * 3.5;
    this.container.addChild(
      this.tallyColumn(comboCx, panelY + 288, 'MAX COMBO', this.result.maxCombo, ART.wood),
    );

    // ---- new record ------------------------------------------------------
    if (this.isNewRecord) {
      this.recordText = new Text({
        text: 'NEW RECORD!',
        style: { fontFamily: FONT.display, fontSize: 56, fontWeight: '700', fill: C.gold },
      });
      this.recordText.anchor.set(0.5);
      this.recordText.position.set(DESIGN_W / 2, panelY + panelH + 52);
      this.container.addChild(this.recordText);
    } else {
      this.recordText = null;
    }

    // ---- buttons ---------------------------------------------------------
    const replay = new Button({
      label: 'REPLAY',
      sub: 'เล่นอีกครั้ง',
      width: 380,
      height: 118,
      variant: 'wood',
      onClick: () => this.onReplay(),
    });
    replay.position.set(DESIGN_W / 2 - 400, 872);

    const menu = new Button({
      label: 'MENU',
      sub: 'กลับเมนู',
      width: 380,
      height: 118,
      variant: 'wood',
      onClick: () => this.onMenu(),
    });
    menu.position.set(DESIGN_W / 2 + 20, 872);

    this.container.addChild(replay, menu);
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
      style: { fontFamily: FONT.display, fontSize: 60, fontWeight: '700', fill: color },
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
