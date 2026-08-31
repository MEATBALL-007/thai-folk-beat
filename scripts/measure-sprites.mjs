/**
 * Alpha bounding boxes for full-canvas art layers.
 *
 * Every delivered PNG is a 1920x1080 canvas with the visible element somewhere
 * inside it and transparency everywhere else. The manifest needs to know where
 * that element actually sits — for pointer hit-testing, and so scenes can place
 * things relative to painted artwork rather than to guessed coordinates.
 *
 * Measuring beats eyeballing: a hit box that is a few pixels off is invisible
 * until someone reports that a button "sometimes" does not respond.
 *
 * Run: node scripts/measure-sprites.mjs [dir...]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Alpha at or below this counts as empty — antialiased edges fade to near zero. */
const ALPHA_FLOOR = 8;

function bounds(file) {
  const meta = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file],
    { encoding: 'utf8' },
  ).trim();
  const [w, h] = meta.split('x').map(Number);

  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 1 << 28 },
  );

  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (raw[row + x * 4 + 3] > ALPHA_FLOOR) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { w, h, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
}

const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['public/assets/gameplay', 'public/assets/loading', 'public/assets/result'];

for (const dir of dirs) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (!statSync(file).isFile() || !name.endsWith('.png')) continue;
    const b = bounds(file);
    if (!b) {
      console.log(`${dir}/${name}: EMPTY (fully transparent)`);
      continue;
    }
    const cx = b.x0 + b.bw / 2;
    const cy = b.y0 + b.bh / 2;
    console.log(
      `${(dir + '/' + name).padEnd(38)} ${b.w}x${b.h}  box(${cx}, ${cy}, ${b.bw}, ${b.bh})`,
    );
  }
}
