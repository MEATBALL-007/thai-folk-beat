import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, FONT } from '../ui/theme';
import { layerSprite, signButton } from '../ui/artLayer';
import { assetLoader } from '../core/AssetLoader';
import { audio } from '../audio/engine';
import { getOverallBest } from '../game/best';
import { exitApp } from '../core/platform';
import { goRegionSelect, goSettings } from './nav';

const SONG_IDS = ['molam', 'soeng'] as const;

/**
 * Title screen (spec §5.1).
 *
 * Everything visible here is the designer's artwork: the backdrop carries the
 * field, frame, ornaments, instrument silhouettes and the logo, and each of the
 * three signs is its own layer with the Thai label already lettered in
 * (เริ่มเกม / ตั้งค่า / ออกเกม). This scene only positions them, adds the two
 * pieces of live text the art cannot contain (subtitle, BEST SCORE), and wires
 * the taps. Reference: design-reference/title_composed.png.
 *
 * This is also where the AudioContext is unblocked: browsers refuse to start
 * audio until a real user gesture, so the first interaction anywhere here
 * resumes it. Doing it later would leave a keyboard-only player in silence.
 */
export class TitleScene extends Scene {
  private character: Sprite | null = null;
  private elapsed = 0;
  private exitNotice: Container | null = null;

  override onEnter(): void {
    // Flat field behind the layer, so the letterbox never shows through.
    const field = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    this.container.addChild(field, layerSprite('bg.menu'));

    this.buildSubtitle();
    this.buildBest();
    this.buildCharacter();
    this.buildSigns();

    // Any first interaction counts as the gesture.
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', () => void audio.resume());
    window.addEventListener('keydown', this.onKey);
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private onKey = (): void => {
    void audio.resume();
  };

  /** The logo art carries no Thai subtitle; spec §5.1 asks for one. */
  private buildSubtitle(): void {
    const subtitle = new Text({
      text: 'ดนตรีพื้นบ้านอีสาน',
      style: { fontFamily: FONT.body, fontSize: 50, fill: ART.tealDark },
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.position.set(650, 726);
    this.container.addChild(subtitle);
  }

  private buildBest(): void {
    const best = getOverallBest(SONG_IDS);

    const label = new Text({
      text: 'BEST SCORE',
      style: { fontFamily: FONT.display, fontSize: 30, fill: ART.wood },
    });
    label.anchor.set(1, 0.5);
    label.position.set(635, 812);

    const value = new Text({
      text: best.toLocaleString('en-US'),
      style: { fontFamily: FONT.display, fontSize: 46, fill: ART.wood },
    });
    value.anchor.set(0, 0.5);
    value.position.set(663, 812);

    this.container.addChild(label, value);
  }

  /**
   * Only shown once real art exists — a labelled placeholder box on top of a
   * finished title screen would look like a bug rather than a to-do.
   */
  private buildCharacter(): void {
    if (!assetLoader.isReal('char.performer.idle')) return;

    const sprite = new Sprite(assetLoader.get('char.performer.idle'));
    const targetH = 560;
    const ratio = sprite.texture.height > 0 ? sprite.texture.width / sprite.texture.height : 0.6;
    sprite.height = targetH;
    sprite.width = targetH * ratio;
    sprite.anchor.set(0.5, 1);
    sprite.position.set(300, DESIGN_H - 110);

    this.character = sprite;
    this.container.addChild(sprite);
  }

  private buildSigns(): void {
    this.container.addChild(
      signButton('ui.btn.play', () => {
        void audio.resume();
        goRegionSelect(this.ctx.scenes);
      }),
      signButton('ui.btn.setting', () => {
        void audio.resume();
        goSettings(this.ctx.scenes);
      }),
      signButton('ui.btn.exit', () => void this.handleExit()),
    );
  }

  /** Spec §5.1: close the window under Tauri, show a notice on the web. */
  private async handleExit(): Promise<void> {
    const closed = await exitApp();
    if (closed || this.exitNotice) return;

    const notice = new Container();

    const veil = new Graphics()
      .rect(0, 0, DESIGN_W, DESIGN_H)
      .fill({ color: ART.wood, alpha: 0.86 });

    const msg = new Text({
      text: 'ปิดหน้าต่างได้เลย',
      style: { fontFamily: FONT.display, fontSize: 96, fill: ART.pale },
    });
    msg.anchor.set(0.5);
    msg.position.set(DESIGN_W / 2, DESIGN_H / 2 - 30);

    const hint = new Text({
      text: 'ขอบคุณที่เล่น  ·  กดที่ใดก็ได้เพื่อกลับ',
      style: { fontFamily: FONT.body, fontSize: 36, fill: ART.field },
    });
    hint.anchor.set(0.5);
    hint.position.set(DESIGN_W / 2, DESIGN_H / 2 + 80);

    notice.addChild(veil, msg, hint);
    notice.eventMode = 'static';
    notice.cursor = 'pointer';
    notice.on('pointertap', () => {
      notice.destroy({ children: true });
      this.exitNotice = null;
    });

    this.exitNotice = notice;
    this.container.addChild(notice);
  }

  override update(dtMS: number): void {
    this.elapsed += dtMS;

    if (this.character) {
      this.character.y = DESIGN_H - 110 + Math.sin(this.elapsed / 620) * 14;
      this.character.rotation = Math.sin(this.elapsed / 900) * 0.02;
    }
  }
}
