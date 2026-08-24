import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { DESIGN_H, DESIGN_W } from '../core/Layout';
import { ART, FONT } from '../ui/theme';
import { hitTarget, layerCenter, layerSprite, signButton } from '../ui/artLayer';
import { goSongSelect, goTitle } from './nav';

interface RegionDef {
  id: string;
  labelTh: string;
  key: string;
  /** Layer drawn on top when this region is the current selection, if supplied. */
  selectedKey?: string;
  enabled: boolean;
}

/**
 * Region select (spec §5.3) — only อีสาน is playable in this build.
 *
 * The whole screen is the designer's art: `bg.region` already contains the
 * wooden panel and the เลือกภูมิภาค heading, and the four discs are full-canvas
 * layers arranged in a 2x2 grid, so they simply stack at (0,0).
 *
 * Selection is shown the designer's way — swapping in a FILLED disc plus that
 * region's name plate (`ui.region.isanSelected`) — rather than a ring of our
 * own. Reference: design-reference/region_composed{,_selected}.png.
 */
const REGIONS: RegionDef[] = [
  { id: 'north', labelTh: 'ภาคเหนือ', key: 'ui.region.north', enabled: false },
  {
    id: 'isan',
    labelTh: 'ภาคอีสาน',
    key: 'ui.region.isan',
    selectedKey: 'ui.region.isanSelected',
    enabled: true,
  },
  { id: 'central', labelTh: 'ภาคกลาง', key: 'ui.region.central', enabled: false },
  { id: 'south', labelTh: 'ภาคใต้', key: 'ui.region.south', enabled: false },
];

const DISC_R = 112;

export class RegionSelectScene extends Scene {
  private selected = 'isan';
  private readonly selectedLayers = new Map<string, Sprite>();

  override onEnter(): void {
    const field = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill(ART.field);
    // Backdrop already carries the panel and the heading.
    this.container.addChild(field, layerSprite('bg.region'));

    // Three passes so z-order is explicit: all unselected discs, then the
    // selected overlay above them, then tags and hit targets on top.
    for (const region of REGIONS) this.addDisc(region);
    for (const region of REGIONS) this.addSelectedLayer(region);
    for (const region of REGIONS) this.addTagAndHit(region);

    this.addNav();
    this.refreshSelection();
  }

  private addDisc(region: RegionDef): void {
    const sprite = layerSprite(region.key);
    // Dimming a layer only affects its own visible pixels — the rest of the
    // canvas is transparent, so this cannot wash out the screen.
    sprite.alpha = region.enabled ? 1 : 0.45;
    this.container.addChild(sprite);
  }

  private addSelectedLayer(region: RegionDef): void {
    if (!region.selectedKey) return;
    const sprite = layerSprite(region.selectedKey);
    sprite.visible = false;
    this.selectedLayers.set(region.id, sprite);
    this.container.addChild(sprite);
  }

  private addTagAndHit(region: RegionDef): void {
    const centre = layerCenter(region.key);
    if (!centre) return;

    if (!region.enabled) {
      // Spec §5.3 requires the "เร็วๆ นี้" tag; the designer's comp has none, so
      // it sits inside the disc where it cannot disturb the panel layout.
      this.container.addChild(this.comingSoonTag(centre.x, centre.y + DISC_R - 34));
      return; // no hit target: the disc is inert
    }

    const target = hitTarget(
      region.key,
      () => {
        this.selected = region.id;
        this.refreshSelection();
      },
      { circle: true },
    );
    if (target) this.container.addChild(target);
  }

  private comingSoonTag(cx: number, cy: number): Container {
    const w = 168;
    const h = 46;
    const tag = new Container();
    tag.position.set(cx, cy);

    const bg = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, 13)
      .fill(ART.discRing)
      .roundRect(-w / 2, -h / 2, w, h, 13)
      .stroke({ width: 4, color: ART.pale, alignment: 0 });

    const text = new Text({
      text: 'เร็วๆ นี้',
      style: { fontFamily: FONT.body, fontSize: 24, fill: ART.pale },
    });
    text.anchor.set(0.5);

    tag.addChild(bg, text);
    return tag;
  }

  private addNav(): void {
    // Signs only, no captions — the artwork stands on its own.
    this.container.addChild(
      signButton('ui.btn.back', () => goTitle(this.ctx.scenes)),
      signButton('ui.btn.next', () => goSongSelect(this.ctx.scenes)),
    );
  }

  private refreshSelection(): void {
    for (const [id, sprite] of this.selectedLayers) {
      sprite.visible = id === this.selected;
    }
  }
}
