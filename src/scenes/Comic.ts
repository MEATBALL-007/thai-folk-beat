import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, C, FONT } from '../ui/theme';
import { Button } from '../ui/Button';
import { layerSprite } from '../ui/artLayer';
import { assetLoader } from '../core/AssetLoader';
import { audio } from '../audio/engine';
import { panelsFor, type ComicPanel } from '../game/comicContent';
import type { SongDef } from '../audio/types';
import { goLoading } from './nav';

/** 16:9 picture, hung inside the frame like a framed panel. */
const ART_W = 1172;
const ART_H = 659;
const ART_X = (DESIGN_W - ART_W) / 2;
const ART_Y = 100; // clear of the frame's top rule (~y 58)
const MAT = 12; // cream mat between picture and wood
const WOOD = 22; // wooden outer frame

const CAPTION_Y = 800;
const CAPTION_H = 104;
const ROW_Y = 952;

/**
 * Origin comic (spec §5.5).
 *
 * Click or Space advances one panel; Esc or the ข้าม button skips straight to
 * Loading. Panel art falls back to a labelled placeholder like everything else,
 * so the captions carry the content on their own if the art is not in yet.
 *
 * Presented as a framed picture on the same orange field as the menus — a wooden
 * frame with a cream mat, and the caption on a plaque beneath it.
 */
export class ComicScene extends Scene {
  private readonly song: SongDef;
  private readonly panels: ComicPanel[];

  private index = 0;
  /** Art + caption move together on a page turn. */
  private page!: Container;
  private art!: Sprite;
  private caption!: Text;
  private counter!: Text;
  private dots!: Graphics;
  private turn = 0;

  /** Voice-over element, reused across panels. Null until a panel supplies one. */
  private voice: HTMLAudioElement | null = null;

  constructor(song: SongDef) {
    super();
    this.song = song;
    this.panels = panelsFor(song.id);
  }

  override onEnter(): void {
    const field = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    this.container.addChild(field, layerSprite('bg.menuFrame'));

    // Click anywhere advances. Added before the furniture so the ข้าม button,
    // which sits on top, still receives its own taps.
    const hit = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0xffffff, alpha: 0 });
    hit.eventMode = 'static';
    hit.on('pointertap', () => this.advance());
    this.container.addChild(hit);

    this.page = new Container();

    this.buildFrame();
    this.buildCaption();
    // Page content sits above the frame and plaque, below the bottom row.
    this.container.addChild(this.page);
    this.buildBottomRow();

    window.addEventListener('keydown', this.onKey);

    this.showPanel(0);
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.stopVoice();
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.advance();
    } else if (e.code === 'Escape') {
      this.skip();
    }
  };

  /** Wooden picture frame with a cream mat, then the art inside it. */
  private buildFrame(): void {
    const frame = new Graphics()
      .roundRect(ART_X - WOOD + 6, ART_Y - WOOD + 9, ART_W + WOOD * 2, ART_H + WOOD * 2, 22)
      .fill({ color: ART.wood, alpha: 0.2 })
      .roundRect(ART_X - WOOD, ART_Y - WOOD, ART_W + WOOD * 2, ART_H + WOOD * 2, 22)
      .fill(ART.wood)
      .roundRect(ART_X - MAT, ART_Y - MAT, ART_W + MAT * 2, ART_H + MAT * 2, 10)
      .fill(C.paper);

    this.art = new Sprite(assetLoader.get(this.panels[0]?.image ?? ''));
    this.art.width = ART_W;
    this.art.height = ART_H;
    this.art.position.set(ART_X, ART_Y);

    this.container.addChild(frame);
    this.page.addChild(this.art);
  }

  private buildCaption(): void {
    const plaque = new Graphics()
      .roundRect(ART_X - WOOD + 5, CAPTION_Y + 7, ART_W + WOOD * 2, CAPTION_H, 18)
      .fill({ color: ART.wood, alpha: 0.16 })
      .roundRect(ART_X - WOOD, CAPTION_Y, ART_W + WOOD * 2, CAPTION_H, 18)
      .fill(ART.woodFill)
      .roundRect(ART_X - WOOD, CAPTION_Y, ART_W + WOOD * 2, CAPTION_H, 18)
      .stroke({ width: 6, color: ART.wood, alignment: 0 });

    this.caption = new Text({
      text: '',
      style: {
        fontFamily: FONT.body,
        fontSize: 32,
        fill: ART.wood,
        wordWrap: true,
        wordWrapWidth: ART_W - 40,
        lineHeight: 44,
        align: 'center',
      },
    });
    this.caption.anchor.set(0.5);
    this.caption.position.set(DESIGN_W / 2, CAPTION_Y + CAPTION_H / 2);

    this.container.addChild(plaque);
    this.page.addChild(this.caption);
  }

  private buildBottomRow(): void {
    this.counter = new Text({
      text: '',
      style: { fontFamily: FONT.display, fontSize: 30, fill: ART.wood },
    });
    this.counter.anchor.set(0, 0.5);
    this.counter.position.set(ART_X - WOOD, ROW_Y);

    this.dots = new Graphics();
    this.dots.position.set(DESIGN_W / 2, ROW_Y);

    const hint = new Text({
      text: 'คลิก หรือกด Space เพื่อไปต่อ',
      style: { fontFamily: FONT.body, fontSize: 26, fill: ART.wood },
    });
    hint.anchor.set(0.5, 0);
    hint.alpha = 0.75;
    hint.position.set(DESIGN_W / 2, ROW_Y + 26);

    const skip = new Button({
      label: 'ข้าม',
      width: 190,
      height: 56,
      fontSize: 34,
      variant: 'wood',
      onClick: () => this.skip(),
    });
    skip.position.set(ART_X + ART_W + WOOD - 190, ROW_Y - 28);

    this.container.addChild(this.counter, this.dots, hint, skip);
  }

  private showPanel(i: number): void {
    const panel = this.panels[i];
    if (!panel) return;

    this.index = i;
    this.art.texture = assetLoader.get(panel.image);
    this.caption.text = panel.captionTh;
    this.counter.text = `${this.song.titleTh}  ·  ${i + 1} / ${this.panels.length}`;
    this.turn = 1;

    this.drawDots();
    this.playVoice(panel);
  }

  /** Page markers as small discs, the active one filled in the lane green. */
  private drawDots(): void {
    this.dots.clear();
    const n = this.panels.length;
    const gap = 38;
    const x0 = -((n - 1) * gap) / 2;

    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap;
      if (i === this.index) {
        this.dots.circle(x, 0, 11).fill(C.green);
        this.dots.circle(x, 0, 11).stroke({ width: 3, color: ART.wood, alignment: 0 });
      } else {
        this.dots.circle(x, 0, 8).fill({ color: ART.wood, alpha: 0.3 });
      }
    }
  }

  /**
   * Spec §5.5: no voice-over is recorded yet. The call is wired and guarded, so
   * adding `voiceUrl` to a panel is the only change needed later.
   */
  private playVoice(panel: ComicPanel): void {
    this.stopVoice();
    if (!panel.voiceUrl) return;

    try {
      const el = new Audio(panel.voiceUrl);
      el.volume = 1;
      this.voice = el;
      void el.play().catch(() => {
        /* autoplay refused — the caption still carries the content */
      });
    } catch (err) {
      console.warn('[comic] voice-over failed', err);
    }
  }

  private stopVoice(): void {
    if (!this.voice) return;
    this.voice.pause();
    this.voice = null;
  }

  private advance(): void {
    void audio.resume();
    if (this.index + 1 >= this.panels.length) {
      this.skip();
      return;
    }
    this.showPanel(this.index + 1);
  }

  private skip(): void {
    void audio.resume();
    goLoading(this.ctx.scenes, this.song);
  }

  override update(dtMS: number): void {
    // Page turn: the new panel slides in from the right as it fades up.
    if (this.turn > 0) {
      this.turn = Math.max(0, this.turn - dtMS / 260);
      const k = this.turn;
      this.page.alpha = 1 - k;
      this.page.position.x = k * 54;
    } else if (this.page.position.x !== 0) {
      this.page.position.x = 0;
      this.page.alpha = 1;
    }
  }
}
