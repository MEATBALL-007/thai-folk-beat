import { Container, Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, FONT } from '../ui/theme';
import { layerSprite } from '../ui/artLayer';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { audio } from '../audio/engine';
import { playVoice } from '../audio/voices';
import {
  OFFSET_MAX,
  OFFSET_MIN,
  RESOLUTION_LABELS_TH,
  RESOLUTION_SCALES,
  SCROLL_MAX,
  SCROLL_MIN,
  settings,
} from '../core/Settings';
import { goTitle } from './nav';

/** Don't retrigger the preview note on every pixel of a drag. */
const PREVIEW_THROTTLE_MS = 140;

/**
 * Settings (spec §5.2). Everything is live-wired: moving a slider changes the
 * running audio graph immediately, and every value persists to localStorage.
 *
 * The two volume sliders play a short preview note on change. Without it the
 * Music slider does nothing audible while sitting in a menu with no song
 * playing, which reads as a broken control (and §9 requires every slider to
 * audibly or visibly do something).
 */
export class SettingsScene extends Scene {
  private lastPreview = 0;
  private resLabel!: Text;

  override onEnter(): void {
    const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    const frame = layerSprite('bg.menuFrame');

    const heading = new Text({
      text: 'ตั้งค่า',
      style: { fontFamily: FONT.display, fontSize: 76, fill: ART.tealDark },
    });
    heading.anchor.set(0.5, 0);
    heading.position.set(DESIGN_W / 2, 86);

    const panelW = 1180;
    const panelX = (DESIGN_W - panelW) / 2;
    const panel = new Graphics()
      .roundRect(panelX, 196, panelW, 700, 28)
      .fill({ color: ART.woodFill, alpha: 0.75 })
      .roundRect(panelX, 196, panelW, 700, 28)
      .stroke({ width: 7, color: ART.wood, alignment: 0 });

    this.container.addChild(bg, frame, heading, panel);

    const left = panelX + 90;
    const sliderW = panelW - 180;
    let y = 316;
    const rowGap = 130;

    // ---- Sound (SFX bus) -------------------------------------------------
    const sound = new Slider({
      label: 'Sound',
      min: 0,
      max: 100,
      step: 1,
      value: settings.sound,
      width: sliderW,
      format: (v) => `${Math.round(v)}`,
      onChange: (v) => {
        settings.setSound(v);
        audio.setSfxVolume(v);
        this.preview('klong', audio.sfxBus);
      },
    });
    sound.position.set(left, y);
    y += rowGap;

    // ---- Music bus -------------------------------------------------------
    const music = new Slider({
      label: 'Music',
      min: 0,
      max: 100,
      step: 1,
      value: settings.music,
      width: sliderW,
      format: (v) => `${Math.round(v)}`,
      onChange: (v) => {
        settings.setMusic(v);
        audio.setMusicVolume(v);
        this.preview('ponglang', audio.musicBus);
      },
    });
    music.position.set(left, y);
    y += rowGap;

    // ---- Resolution stepper ---------------------------------------------
    this.container.addChild(this.buildResolutionRow(left, y, sliderW));
    y += rowGap;

    // ---- Audio calibration ----------------------------------------------
    const offset = new Slider({
      label: 'ปรับดีเลย์เสียง',
      min: OFFSET_MIN,
      max: OFFSET_MAX,
      step: 5,
      value: settings.offsetMs,
      width: sliderW,
      format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)} ms`,
      onChange: (v) => {
        settings.setOffsetMs(v);
        // Live-wired: the Conductor picks this up on its very next read.
        audio.conductor.userOffsetMs = v;
      },
    });
    offset.position.set(left, y);
    y += rowGap;

    // ---- Scroll speed ----------------------------------------------------
    const scroll = new Slider({
      label: 'ความเร็วโน้ต',
      min: SCROLL_MIN,
      max: SCROLL_MAX,
      step: 0.1,
      value: settings.scrollSec,
      width: sliderW,
      format: (v) => `${v.toFixed(1)} วิ`,
      onChange: (v) => settings.setScrollSec(v),
    });
    scroll.position.set(left, y);

    this.container.addChild(sound, music, offset, scroll);

    const back = new Button({
      label: 'BACK',
      sub: 'กลับ',
      width: 380,
      height: 92,
      fontSize: 40,
      variant: 'wood',
      onClick: () => goTitle(this.ctx.scenes),
    });
    back.position.set((DESIGN_W - 380) / 2, 906);
    this.container.addChild(back);
  }

  /** `◁ ต่ำ / กลาง / สูง ▷` (spec §5.2). */
  private buildResolutionRow(x: number, y: number, width: number): Container {
    const row = new Container();
    row.position.set(x, y);

    const label = new Text({
      text: 'Resolution',
      style: { fontFamily: FONT.body, fontSize: 36, fill: ART.wood },
    });
    label.anchor.set(0, 0.5);
    label.position.set(0, -46);

    this.resLabel = new Text({
      text: this.resolutionCaption(),
      style: { fontFamily: FONT.display, fontSize: 40, fill: ART.tealDark },
    });
    this.resLabel.anchor.set(0.5, 0.5);
    this.resLabel.position.set(width / 2, 0);

    const prev = this.arrowButton('◁', () => this.stepResolution(-1));
    prev.position.set(width / 2 - 230, 0);

    const next = this.arrowButton('▷', () => this.stepResolution(1));
    next.position.set(width / 2 + 230, 0);

    row.addChild(label, this.resLabel, prev, next);
    return row;
  }

  private arrowButton(glyph: string, onTap: () => void): Container {
    const c = new Container();

    const g = new Graphics()
      .circle(0, 0, 34)
      .fill(ART.woodFill)
      .circle(0, 0, 34)
      .stroke({ width: 5, color: ART.wood, alignment: 0 });

    const t = new Text({
      text: glyph,
      style: { fontFamily: FONT.display, fontSize: 34, fill: ART.wood },
    });
    t.anchor.set(0.5);

    c.addChild(g, t);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointerover', () => (g.tint = 0xffe3b4));
    c.on('pointerout', () => (g.tint = 0xffffff));
    c.on('pointertap', onTap);

    return c;
  }

  private resolutionCaption(): string {
    const step = settings.resolutionStep;
    const th = RESOLUTION_LABELS_TH[step] ?? '';
    const scale = RESOLUTION_SCALES[step] ?? 1;
    return `${th}   (${scale.toFixed(2)}x)`;
  }

  private stepResolution(delta: number): void {
    const next = settings.resolutionStep + delta;
    if (next < 0 || next >= RESOLUTION_SCALES.length) return;

    settings.setResolutionStep(next);
    this.resLabel.text = this.resolutionCaption();
    this.applyResolution();
  }

  /**
   * Pixi needs an explicit resize to rebuild its render targets at the new
   * resolution — setting the property alone leaves the old backing store.
   */
  private applyResolution(): void {
    const { app, layout } = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    app.renderer.resize(w, h, settings.resolutionScale);
    layout.resize(w, h);
  }

  private preview(voice: 'klong' | 'ponglang', bus: AudioNode): void {
    const now = performance.now();
    if (now - this.lastPreview < PREVIEW_THROTTLE_MS) return;
    this.lastPreview = now;

    void audio.resume();
    // Slight lead so the note is scheduled, not fired late.
    playVoice(voice, audio.ctx, bus, audio.ctx.currentTime + 0.01, 67);
  }
}
