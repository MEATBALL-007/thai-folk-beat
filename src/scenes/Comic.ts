import { Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { C, FONT } from '../ui/theme';
import { Button } from '../ui/Button';
import { assetLoader } from '../core/AssetLoader';
import { audio } from '../audio/engine';
import { panelsFor, type ComicPanel } from '../game/comicContent';
import type { SongDef } from '../audio/types';
import { goLoading } from './nav';

/**
 * Origin comic (spec §5.5).
 *
 * Click or Space advances one panel; Esc or the ข้าม button skips straight to
 * Loading. Panel art falls back to a labelled placeholder like everything else,
 * so the captions carry the content on their own if the art is not in yet.
 */
export class ComicScene extends Scene {
  private readonly song: SongDef;
  private readonly panels: ComicPanel[];

  private index = 0;
  private art!: Sprite;
  private caption!: Text;
  private counter!: Text;
  private dots!: Graphics;
  private fade = 0;

  /** Voice-over element, reused across panels. Null until a panel supplies a URL. */
  private voice: HTMLAudioElement | null = null;

  constructor(song: SongDef) {
    super();
    this.song = song;
    this.panels = panelsFor(song.id);
  }

  override onEnter(): void {
    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(C.ink);
    this.container.addChild(bg);

    // 16:9 exactly (1360/765), sized to leave room for the caption box and the
    // bottom row without any of them colliding.
    const frameW = 1360;
    const frameH = 765;
    const frameX = (DESIGN_W - frameW) / 2;
    const frameY = 46;

    const captionY = frameY + frameH + 20; // 831
    const captionH = 146;
    const bottomRowY = 1008;

    const frame = new Graphics()
      .roundRect(frameX - 8, frameY - 8, frameW + 16, frameH + 16, 20)
      .fill(C.paper);
    this.container.addChild(frame);

    this.art = new Sprite(assetLoader.get(this.panels[0]?.image ?? ''));
    this.art.width = frameW;
    this.art.height = frameH;
    this.art.position.set(frameX, frameY);
    this.container.addChild(this.art);

    const captionBg = new Graphics()
      .roundRect(frameX, captionY, frameW, captionH, 18)
      .fill(C.paper)
      .roundRect(frameX, captionY, frameW, captionH, 18)
      .stroke({ width: 5, color: C.olive, alignment: 0 });
    this.container.addChild(captionBg);

    this.caption = new Text({
      text: '',
      style: {
        fontFamily: FONT.body,
        fontSize: 36,
        fill: C.ink,
        wordWrap: true,
        wordWrapWidth: frameW - 80,
        lineHeight: 50,
        align: 'center',
      },
    });
    this.caption.anchor.set(0.5, 0.5);
    this.caption.position.set(DESIGN_W / 2, captionY + captionH / 2);
    this.container.addChild(this.caption);

    this.counter = new Text({
      text: '',
      style: { fontFamily: FONT.body, fontSize: 28, fill: C.cream },
    });
    this.counter.anchor.set(0, 0.5);
    this.counter.position.set(frameX, bottomRowY);

    this.dots = new Graphics();
    this.dots.position.set(DESIGN_W / 2, bottomRowY);

    const hint = new Text({
      text: 'คลิก หรือกด Space เพื่อไปต่อ',
      style: { fontFamily: FONT.body, fontSize: 28, fill: C.cream },
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(DESIGN_W / 2, 1056);

    this.container.addChild(this.counter, this.dots, hint);

    const skip = new Button({
      label: 'ข้าม',
      width: 200,
      height: 62,
      fontSize: 34,
      variant: 'ghost',
      onClick: () => this.skip(),
    });
    skip.position.set(frameX + frameW - 200, bottomRowY - 31);
    this.container.addChild(skip);

    // Click anywhere (except the skip button) advances.
    bg.eventMode = 'static';
    bg.hitArea = { contains: () => true };
    bg.on('pointertap', () => this.advance());

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

  private showPanel(i: number): void {
    const panel = this.panels[i];
    if (!panel) return;

    this.index = i;
    this.art.texture = assetLoader.get(panel.image);
    this.caption.text = panel.captionTh;
    this.counter.text = `${this.song.titleTh}  ·  ${i + 1} / ${this.panels.length}`;
    this.fade = 1;

    this.drawDots();
    this.playVoice(panel);
  }

  private drawDots(): void {
    this.dots.clear();
    const n = this.panels.length;
    const gap = 34;
    const startX = -((n - 1) * gap) / 2;

    for (let i = 0; i < n; i++) {
      const x = startX + i * gap;
      if (i === this.index) {
        this.dots.circle(x, 0, 10).fill(C.gold);
      } else {
        this.dots.circle(x, 0, 8).fill({ color: C.cream, alpha: 0.5 });
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
    // Short cross-fade as each panel appears.
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dtMS / 260);
      this.art.alpha = 1 - this.fade * 0.85;
      this.caption.alpha = 1 - this.fade;
    }
  }
}
