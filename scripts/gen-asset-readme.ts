/**
 * Generates public/assets/README.md from src/assets/manifest.ts so the two can
 * never drift. Run: npm run assets:readme
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MANIFEST, type AssetKind } from '../src/assets/manifest';

const OUT = join(process.cwd(), 'public', 'assets', 'README.md');

const KIND_TITLE: Record<AssetKind, string> = {
  ui: 'UI',
  bg: 'Backgrounds',
  character: 'Characters',
  comic: 'Comic panels',
};

const order: AssetKind[] = ['ui', 'bg', 'character', 'comic'];

const lines: string[] = [
  '# Art assets',
  '',
  '**Generated from `src/assets/manifest.ts` — do not edit by hand.**',
  'Regenerate with `npm run assets:readme`.',
  '',
  'Every file below is **optional**. Anything missing is replaced at runtime by a',
  'generated placeholder labelled with its asset key, so the game always runs. Drop',
  'a real PNG at the listed path and it is picked up on the next reload — no code',
  'change needed.',
  '',
  'Sizes are the **4K authoring size**; the game downscales at runtime, so export',
  'at these dimensions from the vector source.',
  '',
  `Total assets: **${MANIFEST.length}**`,
  '',
];

for (const kind of order) {
  const group = MANIFEST.filter((a) => a.kind === kind);
  if (!group.length) continue;

  lines.push(`## ${KIND_TITLE[kind]}`, '');
  lines.push('| File | Size (px) | Key | Purpose |');
  lines.push('|---|---|---|---|');
  for (const a of group) {
    lines.push(`| \`${a.path.replace('assets/', '')}\` | ${a.w} x ${a.h} | \`${a.key}\` | ${a.purpose} |`);
  }
  lines.push('');
}

lines.push(
  '## Notes',
  '',
  '- PNG with transparency where the art is cut out (characters, logo).',
  '- Comic panels are 16:9 and are letterboxed into the screen, so keep important',
  '  content away from the extreme edges.',
  '- Filenames are case-sensitive on some systems — match them exactly.',
  '',
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`wrote ${OUT} (${MANIFEST.length} assets)`);
