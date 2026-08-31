import { Container, Graphics } from 'pixi.js';

/**
 * The delivered face maps 299 codepoints and does not include `·`, the four
 * arrows, or the two pointing triangles the UI was drawing as text. Rather than
 * depend on any font's symbol coverage, the shapes are drawn.
 *
 * `•` (U+2022) IS in the face and replaces `·` directly, so it stays text.
 *
 * Coverage was checked by parsing the font's cmap before the swap, not by
 * looking at the screen afterwards — a missing glyph renders as a blank box that
 * is easy to mistake for a layout gap.
 */
export const BULLET = '•';

export type Dir = 'left' | 'right' | 'up' | 'down';

/** An equilateral pointer, centred on (0,0), `size` across. */
export function triangle(dir: Dir, size: number, colour: number): Graphics {
  const h = size / 2;
  const pts: Record<Dir, number[]> = {
    right: [-h, -h, h, 0, -h, h],
    left: [h, -h, -h, 0, h, h],
    up: [-h, h, 0, -h, h, h],
    down: [-h, -h, 0, h, h, -h],
  };
  return new Graphics().poly(pts[dir]).fill(colour);
}

/**
 * The ← ↓ ↑ → hint, as four keycap squares with a triangle inside each.
 * Laid out left to right, centred on (0,0).
 */
export function arrowKeyRow(size: number, colour: number): Container {
  const row = new Container();
  const dirs: Dir[] = ['left', 'down', 'up', 'right'];
  const gap = size * 1.25;
  const x0 = -((dirs.length - 1) * gap) / 2;

  dirs.forEach((dir, i) => {
    const cell = new Container();
    cell.addChild(
      new Graphics()
        .roundRect(-size / 2, -size / 2, size, size, size * 0.22)
        .stroke({ width: Math.max(2, size * 0.09), color: colour, alignment: 0 }),
      triangle(dir, size * 0.42, colour),
    );
    cell.position.set(x0 + i * gap, 0);
    row.addChild(cell);
  });

  return row;
}
