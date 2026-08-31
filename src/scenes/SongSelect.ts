import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { type Dir, triangle } from '../ui/glyphs';
import { layerSprite } from '../ui/artLayer';
import { Button } from '../ui/Button';
import { Carousel } from '../ui/Carousel';
import { MOLAM } from '../audio/songs/molam';
import { SOENG } from '../audio/songs/soeng';
import type { SongDef } from '../audio/types';
import { buildChart } from '../game/Chart';
import { getBest } from '../game/best';
import { settings } from '../core/Settings';
import { DIFFICULTIES, DIFFICULTY_LABELS_TH, type Difficulty } from '../game/Difficulty';
import { goComic, goRegionSelect } from './nav';

/** Add to this array and the carousel handles the rest (spec §5.4). */
const SONGS: SongDef[] = [MOLAM, SOENG];

const CARD_W = 560;
const CARD_H = 540;

export class SongSelectScene extends Scene {
  private carousel!: Carousel;
  private prevBtn!: Container;
  private nextBtn!: Container;
  private readonly chips: { value: Difficulty; face: Graphics; text: Text }[] = [];
  /** The 'โน้ต' value on each card, so difficulty changes can update them. */
  private readonly noteCounts: Text[] = [];

  override onEnter(): void {
    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    const frame = layerSprite('bg.menuFrame');

    const heading = new Text({
      text: 'เลือกเพลง',
      style: { fontFamily: FONT.display, fontSize: 76, fill: ART.tealDark },
    });
    heading.anchor.set(0.5, 0);
    heading.position.set(DESIGN_W / 2, 84);

    this.container.addChild(bg, frame, heading);

    this.carousel = new Carousel({
      items: SONGS.map((s) => this.buildCard(s)),
      itemWidth: CARD_W,
      gap: 60,
      onChange: () => this.refreshArrows(),
    });
    // Track origin sits at the centre of the screen minus half a card, so the
    // active card is centred whatever the carousel offset is.
    this.carousel.position.set((DESIGN_W - CARD_W) / 2, 216);
    this.container.addChild(this.carousel);

    // Clip the peeking neighbour to the inside of the delivered frame — without
    // this the next card slides out over the teal border and corner ornaments.
    const clip = new Graphics().rect(112, 150, DESIGN_W - 224, 700).fill(0xffffff);
    this.container.addChild(clip);
    this.carousel.mask = clip;

    this.prevBtn = this.arrow('left', () => this.carousel.prev());
    this.prevBtn.position.set(DESIGN_W / 2 - 372, 216 + CARD_H / 2);

    this.nextBtn = this.arrow('right', () => this.carousel.next());
    this.nextBtn.position.set(DESIGN_W / 2 + 372, 216 + CARD_H / 2);

    this.container.addChild(this.prevBtn, this.nextBtn);
    this.container.addChild(this.buildDifficultyRow(DESIGN_W / 2, 812));

    const back = new Button({
      label: 'BACK',
      sub: 'กลับ',
      width: 340,
      height: 92,
      fontSize: 40,
      variant: 'wood',
      onClick: () => goRegionSelect(this.ctx.scenes),
    });
    back.position.set(DESIGN_W / 2 - 380, 900);

    const next = new Button({
      label: 'NEXT',
      sub: 'ถัดไป',
      width: 340,
      height: 92,
      fontSize: 40,
      variant: 'wood',
      onClick: () => {
        const song = SONGS[this.carousel.index];
        if (song) goComic(this.ctx.scenes, song);
      },
    });
    next.position.set(DESIGN_W / 2 + 40, 900);

    this.container.addChild(back, next);
    this.refreshArrows();
  }

  private buildCard(song: SongDef): Container {
    const card = new Container();

    const face = new Graphics()
      .roundRect(0, 0, CARD_W, CARD_H, 30)
      .fill(ART.woodFill)
      .roundRect(0, 0, CARD_W, CARD_H, 30)
      .stroke({ width: 8, color: ART.wood, alignment: 0 });
    card.addChild(face);

    const title = new Text({
      text: song.titleTh,
      style: { fontFamily: FONT.display, fontSize: 92, fill: ART.tealDark },
    });
    title.anchor.set(0.5, 0);
    title.position.set(CARD_W / 2, 54);

    const blurb = new Text({
      text: song.blurbTh,
      style: { fontFamily: FONT.body, fontSize: 30, fill: ART.wood },
    });
    blurb.anchor.set(0.5, 0);
    blurb.position.set(CARD_W / 2, 176);

    const rule = new Graphics()
      .rect(70, 240, CARD_W - 140, 4)
      .fill({ color: ART.wood, alpha: 0.35 });

    card.addChild(title, blurb, rule);

    // Spec §5.4: Thai name, BPM and note count.
    const noteCount = buildChart(song, settings.difficulty).length;
    const stats: [string, string][] = [
      ['BPM', String(song.bpm)],
      ['โน้ต', String(noteCount)],
      ['BEST', getBest(song.id).toLocaleString('en-US')],
    ];

    stats.forEach(([label, value], i) => {
      const cx = CARD_W / 2 + (i - 1) * 165;

      const l = new Text({
        text: label,
        style: { fontFamily: FONT.body, fontSize: 26, fill: ART.wood },
      });
      l.anchor.set(0.5, 0);
      l.position.set(cx, 290);

      const v = new Text({
        text: value,
        style: { fontFamily: FONT.display, fontSize: 54, fill: ART.tealDark },
      });
      v.anchor.set(0.5, 0);
      v.position.set(cx, 322);
      if (label === 'โน้ต') this.noteCounts.push(v);

      card.addChild(l, v);
    });

    // A tiny lane-colour motif so the two cards are distinguishable at a glance.
    const swatch = new Graphics();
    for (let i = 0; i < 4; i++) {
      swatch
        .roundRect(70 + i * ((CARD_W - 140) / 4), 436, (CARD_W - 140) / 4 - 12, 44, 10)
        .fill(i % 2 === 0 ? C.green : C.gold);
    }
    card.addChild(swatch);

    return card;
  }

  /**
   * ง่าย / ปกติ / ยาก. Difficulty is note density over the same recording, so
   * the note count on the card has to move with it — otherwise the card claims a
   * figure for a chart the player is not about to hear.
   */
  private buildDifficultyRow(cx: number, cy: number): Container {
    const row = new Container();

    const label = new Text({
      text: 'ระดับความยาก',
      style: { fontFamily: FONT.body, fontSize: 30, fill: ART.wood },
    });
    label.anchor.set(0.5, 1);
    label.position.set(cx, cy - 36);
    row.addChild(label);

    const w = 168;
    const gap = 16;
    const x0 = cx - ((DIFFICULTIES.length - 1) * (w + gap)) / 2;

    DIFFICULTIES.forEach((d, i) => {
      const chip = new Container();
      chip.position.set(x0 + i * (w + gap), cy);

      const face = new Graphics();
      const text = new Text({
        text: DIFFICULTY_LABELS_TH[d],
        style: { fontFamily: FONT.display, fontSize: 40, fill: ART.wood },
      });
      text.anchor.set(0.5);

      chip.addChild(face, text);
      chip.eventMode = 'static';
      chip.cursor = 'pointer';
      chip.on('pointertap', () => this.pickDifficulty(d));

      this.chips.push({ value: d, face, text });
      row.addChild(chip);
    });

    this.paintChips();
    return row;
  }

  private pickDifficulty(d: Difficulty): void {
    settings.setDifficulty(d);
    this.paintChips();
    this.refreshNoteCounts();
  }

  /** The active chip is filled; the rest are outlined. */
  private paintChips(): void {
    for (const chip of this.chips) {
      const on = chip.value === settings.difficulty;
      chip.face
        .clear()
        .roundRect(-84, -34, 168, 68, 18)
        .fill(on ? C.green : ART.woodFill)
        .roundRect(-84, -34, 168, 68, 18)
        .stroke({ width: 5, color: ART.wood, alignment: 0 });
      chip.text.style.fill = on ? ART.pale : ART.wood;
    }
  }

  private refreshNoteCounts(): void {
    this.noteCounts.forEach((t, i) => {
      const song = SONGS[i];
      if (song) t.text = String(buildChart(song, settings.difficulty).length);
    });
  }

  private arrow(dir: Dir, onTap: () => void): Container {
    const c = new Container();

    const g = new Graphics()
      .circle(0, 0, 52)
      .fill(ART.woodFill)
      .circle(0, 0, 52)
      .stroke({ width: 6, color: ART.wood, alignment: 0 });

    c.addChild(g, triangle(dir, 42, ART.wood));
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', onTap);

    return c;
  }

  private refreshArrows(): void {
    this.prevBtn.alpha = this.carousel.canPrev ? 1 : 0.3;
    this.nextBtn.alpha = this.carousel.canNext ? 1 : 0.3;
  }

  override update(dtMS: number): void {
    this.carousel.update(dtMS);
  }
}
