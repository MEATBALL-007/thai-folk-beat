/**
 * Packs the whole game into ONE HTML file that runs by double-clicking it.
 *
 * Why a single file rather than an installer: the game has to run on Windows
 * 11, Windows 10 and macOS with nothing installed and no build step on the
 * player's side. A Tauri or Electron binary needs a per-platform toolchain
 * (and macOS binaries cannot be produced from Windows at all), while the
 * existing dist/ folder needs a local web server because ES modules refuse to
 * load over file://.
 *
 * Inlining everything sidesteps all of it: one script, no module fetches, and
 * every asset as a data URI. It is the only format that genuinely satisfies
 * "download it and play" on all three systems.
 *
 * Run: npm run offline
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const OUT_DIR = 'dist-offline';
/** Windows Notepad still wants CRLF. */
const CRLF = String.fromCharCode(13, 10);
const OUT_FILE = join(OUT_DIR, 'THAI-FOLK-BEAT.html');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log('building the offline bundle (single JS chunk)...');
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  env: { ...process.env, TFB_OFFLINE: '1' },
  stdio: 'inherit',
});

// ---- the script and stylesheet -------------------------------------------
const built = readdirSync(join(OUT_DIR, 'assets'));
const jsName = built.find((f) => f.endsWith('.js'));
const cssName = built.find((f) => f.endsWith('.css'));
if (!jsName) throw new Error('no bundled script found — did the vite build run?');

const js = readFileSync(join(OUT_DIR, 'assets', jsName), 'utf8');
let css = cssName ? readFileSync(join(OUT_DIR, 'assets', cssName), 'utf8') : '';

// Strip the bundled @font-face rules. They point at ../assets/fonts/, which does
// not exist inside a single file, and leaving them alongside the embedded ones
// is not harmless: document.fonts.load() rejects on the broken face.
const faceCount = (css.match(/@font-face/g) || []).length;
css = css.replace(/@font-face\s*\{[^}]*\}/g, '');
if (faceCount) console.log(`  stripped ${faceCount} @font-face rule(s) pointing at files that will not exist`);

// ---- every asset as a data URI -------------------------------------------
const map = {};
let rawBytes = 0;
for (const file of walk('public/assets')) {
  const ext = extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) continue; // README.md and friends
  const buf = readFileSync(file);
  rawBytes += buf.length;
  // Keys match the paths the game asks for: 'assets/audio/molam.mp3'.
  const key = relative('public', file).split('\\').join('/');
  map[key] = `data:${mime};base64,${buf.toString('base64')}`;
}
console.log(`  embedded ${Object.keys(map).length} assets (${(rawBytes / 1048576).toFixed(1)} MB raw)`);

// The bundled stylesheet points at /assets/fonts/..., which does not exist in a
// single file. A later @font-face for the same family wins, so this overrides
// it with the embedded copy rather than trying to rewrite the bundled CSS.
const fontFace = ['Regular', 'Italic']
  .map((style) => {
    const uri = map[`assets/fonts/PhrikthaiDam-${style}.ttf`];
    if (!uri) return '';
    return `@font-face{font-family:'Phrikthai Dam';src:url(${uri}) format('truetype');font-weight:400;font-style:${
      style === 'Italic' ? 'italic' : 'normal'
    };font-display:block;}`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>THAI FOLK BEAT</title>
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
canvas{display:block}
#tfb-boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  background:#FFC976;color:#995520;font:600 22px system-ui,sans-serif;text-align:center;padding:24px}
</style>
<style>${css}</style>
<style>${fontFace}</style>
</head>
<body>
<div id="tfb-boot">กำลังเตรียมเกม… โปรดรอสักครู่<br><small style="font-weight:400">ครั้งแรกอาจใช้เวลาสักครู่</small></div>
<script>window.__TFB_ASSETS=${JSON.stringify(map)};</script>
<script type="module">
${js}
</script>
<script>
  // The boot notice is only there so the window is not blank while a 20 MB
  // page parses; the game paints over it once its canvas exists.
  const gone = setInterval(() => {
    if (document.querySelector('canvas')) {
      document.getElementById('tfb-boot')?.remove();
      clearInterval(gone);
    }
  }, 200);
</script>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html);
const mb = (Buffer.byteLength(html) / 1048576).toFixed(1);
console.log(`\nwrote ${OUT_FILE}  (${mb} MB)`);
// A short read-me beside it, since the file alone does not explain itself.
writeFileSync(
  join(OUT_DIR, 'วิธีเล่น.txt'),
  [
    'THAI FOLK BEAT',
    '==============',
    '',
    'วิธีเล่น',
    '  ดับเบิลคลิกไฟล์  THAI-FOLK-BEAT.html  ได้เลย',
    '  ไม่ต้องติดตั้งอะไร ไม่ต้องต่อเน็ต',
    '',
    'ใช้ได้กับ',
    '  Windows 11 / Windows 10  (Chrome, Edge)',
    '  macOS                    (Chrome, Safari)',
    '',
    'ปุ่ม',
    '  D  F  J  K   หรือ   ปุ่มลูกศร   หรือคลิกที่วงกลม',
    '  F11 = เต็มจอ  (macOS: Control + Command + F)',
    '',
    'หมายเหตุ',
    '  ไฟล์ใหญ่ ~22 MB เพราะรวมเพลง รูป และฟอนต์ไว้ในไฟล์เดียว',
    '  เปิดครั้งแรกอาจใช้เวลาสัก 5-10 วินาที',
    '  ต้องคลิกบนหน้าจอ 1 ครั้งก่อน เสียงจึงจะเล่น (เบราว์เซอร์บังคับ)',
    '',
    'เล่นออนไลน์ได้ที่',
    '  https://meatball-007.github.io/thai-folk-beat/',
    '',
  ].join(CRLF),
);

console.log('Double-click it on Windows or macOS — no install, no server.');
