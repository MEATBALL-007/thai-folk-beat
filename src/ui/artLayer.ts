import { Circle, Container, Rectangle, Sprite } from 'pixi.js';
import { assetLoader } from '../core/AssetLoader';
import { specOf, type HitBox } from '../assets/manifest';
import { DESIGN_H, DESIGN_W } from '../core/Layout';

/**
 * Helpers for the designer's full-canvas layer exports.
 *
 * Each PNG is 1920x1080 with one element on an otherwise transparent canvas, so
 * stacking them at (0,0) reproduces the designer's composition exactly — no
 * hand-placed offsets to drift out of sync with the art.
 */

/** A layer drawn at (0,0), stretched to the design space. */
export function layerSprite(key: string): Sprite {
  const sprite = new Sprite(assetLoader.get(key));
  sprite.position.set(0, 0);
  sprite.width = DESIGN_W;
  sprite.height = DESIGN_H;
  return sprite;
}

/** Where the visible element sits inside a layer, from the manifest. */
export function layerHit(key: string): HitBox | undefined {
  return specOf(key)?.hit;
}

/**
 * Makes a layer clickable over just its element, not the whole canvas.
 *
 * Returns a transparent Container placed over the hit box — kept separate from
 * the sprite so several full-canvas layers can overlap without the topmost one
 * swallowing every pointer event.
 */
export function hitTarget(
  key: string,
  onTap: () => void,
  opts: { circle?: boolean; enabled?: boolean } = {},
): Container | null {
  const hit = layerHit(key);
  if (!hit) return null;

  const enabled = opts.enabled ?? true;
  const target = new Container();
  // Named so it is identifiable in Pixi devtools and in hit-test probes.
  target.label = `hit:${key}`;
  target.position.set(hit.x, hit.y);

  /*
   * An explicit hitArea, NOT an invisible Graphics.
   *
   * A childless Container is hit-tested only via its hitArea; an alpha-0
   * Graphics child is hit-tested through its geometry, which proved unreliable
   * here — identical targets built the same way responded or not depending on
   * where they sat in the display list. A hitArea is also cheaper: it is a
   * plain contains() call with no geometry walk.
   */
  target.hitArea = opts.circle
    ? new Circle(hit.w / 2, hit.h / 2, Math.max(hit.w, hit.h) / 2)
    : new Rectangle(0, 0, hit.w, hit.h);

  if (enabled) {
    target.eventMode = 'static';
    target.cursor = 'pointer';
    target.on('pointertap', onTap);
  }

  return target;
}

/** Centre of a layer's element, for drawing rings/labels relative to the art. */
export function layerCenter(key: string): { x: number; y: number } | null {
  const hit = layerHit(key);
  if (!hit) return null;
  return { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 };
}

/**
 * A sign that IS its artwork: the delivered PNG already carries the Thai label,
 * so nothing is drawn on top.
 *
 * Hover/press scale the layer about the sign's own centre. Because the rest of
 * the canvas is transparent, only the sign appears to move — which avoids
 * cutting the art out into a sprite just to animate it.
 */
export function signButton(key: string, onTap: () => void): Container {
  const group = new Container();
  const sprite = layerSprite(key);
  group.addChild(sprite);

  const hit = layerHit(key);
  if (!hit) return group;

  /*
   * The group MUST declare its own hitArea.
   *
   * Each group holds a full-canvas 1920x1080 sprite, so its bounds cover the
   * whole screen. Without a hitArea, Pixi's hit test descends into the topmost
   * such group and never reaches the ones below it — only the last sign added
   * would be clickable. (Proven: promoting the play group made play work and
   * broke exit.) A hitArea lets hitPruneFn discard this group when the pointer
   * is outside its sign, so the walk continues to the next one.
   */
  group.eventMode = 'passive';
  group.hitArea = new Rectangle(hit.x, hit.y, hit.w, hit.h);

  const cx = hit.x + hit.w / 2;
  const cy = hit.y + hit.h / 2;

  // layerSprite() sets width/height, which sets scale — capture it rather than
  // assuming 1, so a re-export at another size still animates correctly.
  const baseX = sprite.scale.x;
  const baseY = sprite.scale.y;

  sprite.pivot.set(cx, cy);
  sprite.position.set(cx, cy);

  const setScale = (k: number): void => {
    sprite.scale.set(baseX * k, baseY * k);
  };

  const target = hitTarget(key, onTap);
  if (target) {
    target.on('pointerover', () => setScale(1.04));
    target.on('pointerout', () => setScale(1));
    target.on('pointerdown', () => setScale(0.97));
    target.on('pointerup', () => setScale(1.04));
    target.on('pointerupoutside', () => setScale(1));
    group.addChild(target);
  }

  return group;
}
