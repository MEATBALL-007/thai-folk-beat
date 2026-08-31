# Real Songs and Stage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synthesised music with the designer's real recordings, derive playable charts from those recordings, move the synth voices to hit feedback, and integrate the delivered stage art, animated performers, new loading/result screens, and Thai font.

**Architecture:** The recordings sit on a proven fixed beat grid (measured, §2 of the spec), so charts are derived **offline** by a Node script that scores every 16th-note slot per frequency band and emits `PatternEvent[]` in the existing bar/beat DSL. Nothing in the runtime changes shape: `buildChart()` still derives the chart from events, so the "one source of truth" property survives in a new form. `SongDef.audioUrl` and the `AudioBufferSourceNode` branch of `AudioEngine.play()` already exist and are reused as-is.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`), Vite 5, PixiJS v8, Web Audio API, ffmpeg (CLI, for the offline derivation script only).

**Spec:** `docs/superpowers/specs/2026-08-31-real-songs-and-stage-design.md`

## Scope note

This plan covers two subsystems that would normally be split. They are kept
together because they are genuinely coupled: the loading screen's progress bar
is driven by the audio decode introduced in Phase A, and `Gameplay.ts` is
rewritten by both phases. **Phase A ends with working, shippable software** (the
game plays the real recordings with derived charts); Phase B is the visual
redesign on top. Stop after Task 10 and you have a coherent release.

## Global Constraints

- **All song timing derives from `AudioContext.currentTime`** via `Conductor`. Never `performance.now()`, never ticker deltas, never `setInterval` for anything that sounds. (spec §2 / NOTES D1)
- **`userOffsetMs` shifts the chart only, never the audio.** `Conductor.rawTime` schedules audio; `Conductor.songTime` drives visuals and judgement. (NOTES D18)
- **UI timing (scene fades, minimum display times) uses `performance.now()`**, because Pixi clamps `deltaMS` at 100 ms and a frame-accumulated timer stretches on slow frames. (NOTES D29)
- **Every full-canvas art layer is drawn at (0,0) at 1920×1080** and must set `group.hitArea` explicitly, or it swallows clicks meant for layers beneath it. (NOTES D33)
- **No unit-test framework.** Verification lives in `scripts/gameplay-check.ts` (`npm run check`) and `scripts/chart-report.ts` (`npm run chart`). Follow that pattern; do not add vitest/jest.
- **Never guess an audio gain.** `MASTER_HEADROOM` is a measured value. If the mix changes, re-measure it.
- Measured constants, to be used verbatim:
  - หมอลำ — **107.070 BPM**, grid offset **0.247 s**, duration 90.65 s
  - เซิ้ง — **114.016 BPM**, grid offset **0.449 s**, duration 101.10 s
- Asset filenames must be **ASCII**. The drop uses Thai filenames; they are renamed on install so URLs need no percent-encoding under both Vite and Tauri's `file://` origin.
- Source drop lives at `C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\C--Users-Administrator\dc576d36-e73a-4181-9279-3d60d4d2043f\scratchpad\brief\THAI_FOLK_BEAT\`. Referred to below as `$DROP`.

## File Structure

**Created:**
- `public/assets/audio/{molam,soeng,main}.mp3` — the recordings
- `public/assets/fonts/PhrikthaiDam-{Regular,Italic}.ttf` — the delivered face
- `src/ui/fonts.css` — `@font-face` declarations
- `src/ui/glyphs.ts` — arrows and triangles drawn as `Graphics`, replacing the 8 unmapped characters
- `scripts/derive-chart.mjs` — offline chart derivation from a recording
- `scripts/measure-sprites.mjs` — alpha bounding boxes for the performer gif frames
- `src/audio/songs/molam.events.ts`, `soeng.events.ts` — generated, committed, reviewable
- `src/audio/pluck.ts` — Karplus–Strong and modal synthesis, pre-rendered to `AudioBuffer`
- `src/game/Difficulty.ts` — the difficulty enum and density labels
- `src/scenes/gameplay/Performers.ts` — the animated dancer instances

**Modified:**
- `src/audio/types.ts` — `SongDef` gains `gridOffsetS`, `events` becomes per-difficulty
- `src/game/Chart.ts` — `buildChart(song, difficulty)` applies the grid offset
- `src/audio/AudioEngine.ts` — decode progress reporting, hit SFX playback, re-measured headroom
- `src/audio/songs/{molam,soeng}.ts` — real BPM/bars/audioUrl, import generated events
- `src/ui/theme.ts` — font family
- `src/main.ts` — font preload
- `src/scenes/{Gameplay,Loading,Result,Title,Settings,SongSelect}.ts` — art, fonts, glyphs
- `src/assets/manifest.ts` — the new art layers
- `scripts/gameplay-check.ts` — new assertions

---

# Phase A — real songs and derived charts

## Task 1: Install the audio and font assets

**Files:**
- Create: `public/assets/audio/molam.mp3`, `soeng.mp3`, `main.mp3`
- Create: `public/assets/fonts/PhrikthaiDam-Regular.ttf`, `PhrikthaiDam-Italic.ttf`

**Interfaces:**
- Consumes: nothing
- Produces: the four asset paths above, referenced by Tasks 2, 6, 7

- [ ] **Step 1: Create the directories and copy the files with ASCII names**

```bash
cd "C:/Users/Administrator/Desktop/thai-folk-beat"
DROP="C:/Users/ADMINI~1/AppData/Local/Temp/1/claude/C--Users-Administrator/dc576d36-e73a-4181-9279-3d60d4d2043f/scratchpad"
mkdir -p public/assets/audio public/assets/fonts

cp "$DROP/brief/THAI_FOLK_BEAT/Song/หมอลำ.mp3" public/assets/audio/molam.mp3
cp "$DROP/brief/THAI_FOLK_BEAT/Song/เซิ้ง.mp3" public/assets/audio/soeng.mp3
cp "$DROP/brief/THAI_FOLK_BEAT/Song/main.mp3"  public/assets/audio/main.mp3

FDIR="$DROP/font/สเต๊กหมูพริกไทยดำ ชุดพิเศษ"
cp "$FDIR/MN Steak Mu Phrikthai Dam.ttf"        public/assets/fonts/PhrikthaiDam-Regular.ttf
cp "$FDIR/MN Steak Mu Phrikthai Dam Italic.ttf" public/assets/fonts/PhrikthaiDam-Italic.ttf
```

- [ ] **Step 2: Verify the copies decode and are the expected sizes**

```bash
for f in public/assets/audio/*.mp3; do
  printf "%-34s " "$f"
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
done
ls -la public/assets/fonts/
```

Expected: `molam.mp3` ≈ 90.65, `soeng.mp3` ≈ 101.10, `main.mp3` ≈ 143.05; two .ttf files ≈ 83 KB and 76 KB.

- [ ] **Step 3: Commit**

```bash
git add public/assets/audio public/assets/fonts
git commit -m "assets: add the delivered recordings and Thai display face

Renamed to ASCII on install so the URLs need no percent-encoding under
either Vite or Tauri's file:// origin."
```

---

## Task 2: Swap the font family and drop the fake bold

**Files:**
- Create: `src/ui/fonts.css`
- Modify: `src/main.ts:2-5` (the `@fontsource` imports and the preload list)
- Modify: `src/ui/theme.ts:15-19` (the `FONT` constant)
- Modify: 31 call sites passing `fontWeight: '700'`
- Modify: `package.json` (drop the two `@fontsource` dependencies)

**Interfaces:**
- Consumes: `public/assets/fonts/PhrikthaiDam-*.ttf` from Task 1
- Produces: `FONT.display` and `FONT.body` both equal to `'Phrikthai Dam'`

- [ ] **Step 1: Write the font-face declarations**

Create `src/ui/fonts.css`:

```css
/*
 * The delivered face: MN Steak Mu Phrikthai Dam (สเต๊กหมูพริกไทยดำ ชุดพิเศษ).
 *
 * Regular and Italic only — there is no bold cut. No `font-weight: 700` rule is
 * declared here on purpose: declaring one would let the browser synthesise bold
 * by smearing glyphs horizontally, which on a Thai face pushes tone marks into
 * the consonant beneath them. The face is already a heavy display weight.
 */
@font-face {
  font-family: 'Phrikthai Dam';
  src: url('/assets/fonts/PhrikthaiDam-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'Phrikthai Dam';
  src: url('/assets/fonts/PhrikthaiDam-Italic.ttf') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: block;
}
```

- [ ] **Step 2: Point the theme at the new family**

In `src/ui/theme.ts`, replace the `FONT` block:

```ts
/**
 * One family for the whole game (designer brief, 2026-08-31): MN Steak Mu
 * Phrikthai Dam. Display and body differ by size, not by family, because the
 * face ships Regular and Italic only.
 *
 * Coverage was verified against every Thai string the game renders before the
 * swap — see the spec §7. Eight decorative characters are NOT in the face; they
 * are drawn as Graphics instead (src/ui/glyphs.ts).
 */
export const FONT = {
  display: 'Phrikthai Dam',
  body: 'Phrikthai Dam',
} as const;
```

- [ ] **Step 3: Replace the font imports and preload**

In `src/main.ts`, replace lines 2–5 with:

```ts
import './ui/fonts.css';
```

Then find the preload block (around line 24) and change the specs it loads to the single family at one weight. The samples must include Thai text with a stacked tone mark, or the browser can report the face ready before the marks are rasterised:

```ts
const specs = ['400 64px "Phrikthai Dam"', 'italic 400 64px "Phrikthai Dam"'];
const samples = ['ก', 'เร็วๆ นี้', 'A0'];
```

- [ ] **Step 4: Strip every `fontWeight: '700'`**

```bash
cd "C:/Users/Administrator/Desktop/thai-folk-beat"
grep -rn "fontWeight: '700'," src/ | wc -l   # expect 31
# Remove the property and its trailing comma+space, whether inline or on its own line.
find src -name '*.ts' -exec sed -i "s/ fontWeight: '700',//g; /^\s*fontWeight: '700',$/d" {} +
grep -rn "fontWeight" src/ | wc -l           # expect 0
```

- [ ] **Step 5: Verify the build is clean**

Run: `npm run build`
Expected: `tsc --noEmit` passes and Vite emits `dist/`. If `noUnusedLocals` complains about a now-unused import in a file sed touched, remove that import.

- [ ] **Step 6: Commit**

```bash
git add -A src package.json
git commit -m "feat: swap to the delivered Thai display face

One family throughout; display and body now differ by size, since the face
ships Regular and Italic only. The 31 fontWeight:'700' call sites are dropped
rather than left to synthetic bold, which smears glyphs sideways and on a Thai
face pushes tone marks into the consonant beneath."
```

---

## Task 3: Draw the eight characters the face does not carry

**Files:**
- Create: `src/ui/glyphs.ts`
- Modify: every site using `·`, `←`, `↑`, `→`, `↓`, `◁`, `▷`

**Interfaces:**
- Consumes: `ART` from `src/ui/theme.ts`
- Produces:
  - `triangle(dir: 'left' | 'right' | 'up' | 'down', size: number, colour: number): Graphics`
  - `arrowKeyRow(size: number, colour: number): Container`
  - `BULLET = '•'`

- [ ] **Step 1: Write the glyph helpers**

Create `src/ui/glyphs.ts`:

```ts
import { Container, Graphics } from 'pixi.js';

/**
 * The delivered face maps 299 codepoints and does not include `·`, the four
 * arrows, or the two pointing triangles the UI was drawing as text. Rather than
 * depend on any font's symbol coverage, the shapes are drawn.
 *
 * `•` (U+2022) IS in the face and replaces `·` directly, so it stays text.
 */
export const BULLET = '•';

/** An equilateral pointer, centred on (0,0), `size` across. */
export function triangle(
  dir: 'left' | 'right' | 'up' | 'down',
  size: number,
  colour: number,
): Graphics {
  const h = size / 2;
  const pts: Record<typeof dir, number[]> = {
    right: [-h, -h, h, 0, -h, h],
    left: [h, -h, -h, 0, h, h],
    up: [-h, h, 0, -h, h, h],
    down: [-h, -h, 0, h, h, -h],
  };
  return new Graphics().poly(pts[dir]).fill(colour);
}

/**
 * The ← ↓ ↑ → hint on the gameplay and title screens, as four keycap squares
 * with a triangle inside each. Laid out left to right, centred on (0,0).
 */
export function arrowKeyRow(size: number, colour: number): Container {
  const row = new Container();
  const dirs = ['left', 'down', 'up', 'right'] as const;
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
```

- [ ] **Step 2: Find every site that uses an unmapped character**

```bash
cd "C:/Users/Administrator/Desktop/thai-folk-beat"
grep -rn "·\|←\|↑\|→\|↓\|◁\|▷" src/ --include=*.ts
```

Expected hits: the `·` separators in `Gameplay.ts`, `Comic.ts` and `Result.ts`; the arrow hint line in `Gameplay.ts`; the `◁ ต่ำ / กลาง / สูง ▷` label in `Settings.ts`.

- [ ] **Step 3: Replace them**

For every `·` in a template literal or string, substitute `•`. For the arrow hint, replace the text that reads

```ts
'D  F  J  K   หรือ   ←  ↓  ↑  →   ·  แตะที่วงกลมก็ได้'
```

with a `Text` reading `'D  F  J  K   หรือ'`, an `arrowKeyRow(30, ART.wood)` positioned after it, and a second `Text` reading `'•  แตะที่วงกลมก็ได้'`. In `Settings.ts`, replace the `◁`/`▷` in the resolution label with `triangle('left', 22, ART.wood)` and `triangle('right', 22, ART.wood)` placed either side of the value text.

- [ ] **Step 4: Verify nothing unmapped remains**

```bash
grep -rn "·\|←\|↑\|→\|↓\|◁\|▷" src/ --include=*.ts   # expect no output
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "fix: draw the symbols the display face does not carry

Eight characters the UI typed as text are unmapped in the delivered face and
would have rendered as blank boxes. The arrows and triangles become Graphics,
which is sturdier than relying on any font's symbol coverage and closer to the
hand-drawn art; the middle dot becomes a bullet, which the face does map."
```

---

## Task 4: Teach `SongDef` about the recording's grid offset and difficulty

**Files:**
- Modify: `src/audio/types.ts` (`SongDef`)
- Create: `src/game/Difficulty.ts`
- Modify: `src/game/Chart.ts` (`buildChart`, `songDuration`)
- Modify: `scripts/gameplay-check.ts` (new assertions)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Difficulty = 'easy' | 'normal' | 'hard'`
  - `DIFFICULTIES: readonly Difficulty[]`, `DIFFICULTY_LABELS_TH: Record<Difficulty, string>`
  - `SongDef.gridOffsetS: number`
  - `SongDef.charts: Record<Difficulty, PatternEvent[]>` (replaces `events`)
  - `buildChart(song: SongDef, difficulty: Difficulty): ChartNote[]`

- [ ] **Step 1: Write the difficulty module**

Create `src/game/Difficulty.ts`:

```ts
/**
 * Difficulty is note density, not speed. The derivation script keeps the
 * strongest N% of grid slots (see the spec §4.3), so every difficulty charts the
 * same performance — a harder chart just includes quieter detail. Scroll speed
 * stays under the player's control in Settings.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

export const DIFFICULTY_LABELS_TH: Record<Difficulty, string> = {
  easy: 'ง่าย',
  normal: 'ปกติ',
  hard: 'ยาก',
};

/** Fraction of 16th-note slots the derivation keeps, per difficulty. */
export const DIFFICULTY_DENSITY: Record<Difficulty, number> = {
  easy: 0.08,
  normal: 0.2,
  hard: 0.32,
};
```

- [ ] **Step 2: Change `SongDef`**

In `src/audio/types.ts`, replace the `events` field and add the offset:

```ts
export interface SongDef {
  id: 'molam' | 'soeng';
  titleTh: string;
  blurbTh: string;
  /** Measured from the recording, not chosen. See NOTES D35. */
  bpm: number;
  bars: number;
  /**
   * Seconds from the start of the audio file to the first downbeat. The
   * recordings do not begin exactly on beat 1, so without this every note in
   * the chart sits a fixed distance from where the music actually plays.
   */
  gridOffsetS: number;
  /** Derived offline from the recording (scripts/derive-chart.mjs), then committed. */
  charts: Record<Difficulty, PatternEvent[]>;
  /** The recording. Present for every shipped song since 2026-08-31. */
  audioUrl?: string;
}
```

Add `import type { Difficulty } from '../game/Difficulty';` at the top.

- [ ] **Step 3: Apply the offset in `buildChart`**

In `src/game/Chart.ts`:

```ts
/**
 * The single derivation step. The note highway and the judge both consume this,
 * so visuals and judgement cannot disagree about when a note happens.
 *
 * `gridOffsetS` shifts every note by the distance from the start of the audio
 * file to its first downbeat. Song time 0 is the instant the file starts, so
 * without this the whole chart plays early by that amount.
 */
export function buildChart(song: SongDef, difficulty: Difficulty): ChartNote[] {
  const spb = secondsPerBeat(song.bpm);
  const events = song.charts[difficulty];

  return events.map((e, index) => ({
    index,
    time: song.gridOffsetS + (e.bar * 4 + e.beat) * spb,
    lane: e.lane,
    midi: e.midi,
    voice: e.voice,
  }));
}

export function songDuration(song: SongDef): number {
  return song.gridOffsetS + song.bars * secondsPerBar(song.bpm) + 1.5;
}
```

- [ ] **Step 4: Write the failing assertions**

Append to `scripts/gameplay-check.ts`, before the final summary lines:

```ts
console.log('\n[chart derivation] spec §4');
{
  const fake: SongDef = {
    id: 'molam',
    titleTh: 'x',
    blurbTh: 'x',
    bpm: 120,
    bars: 2,
    gridOffsetS: 0.25,
    charts: {
      easy: [{ bar: 0, beat: 0, lane: 0, voice: 'klong', midi: 60 }],
      normal: [
        { bar: 0, beat: 0, lane: 0, voice: 'klong', midi: 60 },
        { bar: 1, beat: 2, lane: 1, voice: 'phin', midi: 62 },
      ],
      hard: [],
    },
  };

  check('grid offset shifts the first note', buildChart(fake, 'easy')[0]?.time, 0.25);
  check(
    'bar 1 beat 2 at 120bpm = offset + 3s',
    buildChart(fake, 'normal')[1]?.time,
    0.25 + 3,
  );
  check('difficulty selects its own chart', buildChart(fake, 'normal').length, 2);
  check('songDuration includes the offset', songDuration(fake), 0.25 + 4 + 1.5);
}
```

Add the imports `buildChart`, `songDuration` from `../src/game/Chart` and `SongDef` from `../src/audio/types` at the top of the file.

- [ ] **Step 5: Run the checks and watch them fail, then pass**

Run: `npm run check`
Expected first: FAIL — `molam.ts`/`soeng.ts` still use `events`, so the build errors. Update both song files to wrap their existing arrays as `charts: { easy: [], normal: events, hard: [] }` and add `gridOffsetS: 0` **as a temporary bridge** (Task 6 replaces both with real data). Re-run.
Expected then: all assertions pass, including the previous 29.

- [ ] **Step 6: Commit**

```bash
git add -A src scripts
git commit -m "feat: SongDef carries a grid offset and per-difficulty charts

The recordings do not start on beat 1, so a chart authored from bar 0 plays
early by a fixed amount unless the offset is applied at derivation time.
Difficulty is note density over the same performance, so it lives alongside
the events rather than as separate songs."
```

---

## Task 5: Write the offline chart derivation script

**Files:**
- Create: `scripts/derive-chart.mjs`
- Modify: `package.json` (add the `derive` script)

**Interfaces:**
- Consumes: an mp3 path, bpm, offset
- Produces: a TypeScript module exporting `charts: Record<Difficulty, PatternEvent[]>`

- [ ] **Step 1: Write the script**

Create `scripts/derive-chart.mjs`:

```js
/**
 * Derives a playable chart from a recording, offline.
 *
 * Why not detect onsets: it was tried and it fails on this material. Isan
 * textures are sustained -- the khaen drones, the phin tremolos -- so energy
 * flux fires continuously rather than at note starts. Only ~42% of detected
 * onsets landed within 70ms of the eighth grid (chance is 50%) and the metrical
 * distribution came out flat.
 *
 * What works is the inverse. The beat grid is already known to be stable
 * (measured: under 1.2ms of phase drift across 90s), so instead of asking where
 * the onsets are, ask how hard each grid slot is played. Every note then lands
 * exactly on the grid by construction, and note density becomes a dial rather
 * than an artefact of a threshold.
 *
 * Run: npm run derive
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SR = 22050;
const HOP = 110; // 5 ms
const WIN = 441; // 20 ms

/** One band per lane. Ranges follow each instrument's register. */
const BANDS = [
  { lane: 0, voice: 'klong', filter: 'lowpass=f=180' },
  { lane: 1, voice: 'ponglang', filter: 'highpass=f=250,lowpass=f=900' },
  { lane: 2, voice: 'phin', filter: 'highpass=f=900,lowpass=f=2500' },
  { lane: 3, voice: 'khaen', filter: 'highpass=f=2500' },
];

const DENSITY = { easy: 0.08, normal: 0.2, hard: 0.32 };
/** Pentatonic, matching src/audio/pattern.ts. */
const PENTATONIC = [60, 62, 64, 67, 69];

function decode(file, filter) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'],
    { maxBuffer: 1 << 28 },
  );
  return new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
}

/** Half-wave-rectified log-energy flux: rises where the band gets louder. */
function flux(pcm) {
  const lg = [];
  for (let i = 0; i + WIN < pcm.length; i += HOP) {
    let s = 0;
    for (let j = i; j < i + WIN; j += 4) s += pcm[j] * pcm[j];
    lg.push(Math.log1p(Math.sqrt(s / (WIN / 4))));
  }
  const out = new Float64Array(lg.length - 1);
  for (let i = 1; i < lg.length; i++) out[i - 1] = Math.max(0, lg[i] - lg[i - 1]);
  return out;
}

/** Peak flux within +-40ms of each 16th-note slot. */
function slotStrengths(env, bpm, offsetS, slots) {
  const step = 15.0 / bpm;
  const vals = new Float64Array(slots);
  for (let n = 0; n < slots; n++) {
    const centre = Math.round((offsetS + n * step) / 0.005);
    let best = 0;
    for (let k = Math.max(0, centre - 8); k <= Math.min(env.length - 1, centre + 8); k++) {
      if (env[k] > best) best = env[k];
    }
    vals[n] = best;
  }
  return vals;
}

function derive(file, bpm, offsetS, durationS) {
  const step = 15.0 / bpm;
  const slots = Math.floor((durationS - offsetS) / step);
  const perBand = BANDS.map((b) => ({
    ...b,
    strength: slotStrengths(flux(decode(file, b.filter)), bpm, offsetS, slots),
  }));

  const charts = {};
  for (const [name, take] of Object.entries(DENSITY)) {
    /** slot -> the single strongest band, so chords stay deliberate. */
    const claimed = new Map();

    for (const band of perBand) {
      const order = [...band.strength.keys()].sort((a, b) => band.strength[b] - band.strength[a]);
      for (const n of order.slice(0, Math.floor(slots * take))) {
        const prev = claimed.get(n);
        // A slot goes to whichever band is loudest there, EXCEPT on a downbeat,
        // where a second lane is allowed as an accent.
        if (!prev) {
          claimed.set(n, [{ band, v: band.strength[n] }]);
        } else if (n % 16 === 0 && prev.length < 2) {
          prev.push({ band, v: band.strength[n] });
        } else if (band.strength[n] > prev[0].v) {
          prev[0] = { band, v: band.strength[n] };
        }
      }
    }

    const events = [];
    for (const [n, picks] of [...claimed.entries()].sort((a, b) => a[0] - b[0])) {
      for (const { band } of picks) {
        events.push({
          bar: Math.floor(n / 16),
          beat: (n % 16) / 4,
          lane: band.lane,
          voice: band.voice,
          // Pitch is only used by the hit SFX now; step through the scale so
          // repeated notes in a lane do not all sound identical.
          midi: PENTATONIC[n % PENTATONIC.length],
        });
      }
    }
    charts[name] = events;
  }

  return { charts, bars: Math.ceil(slots / 16) };
}

const SONGS = [
  { id: 'molam', file: 'public/assets/audio/molam.mp3', bpm: 107.07, offset: 0.247, dur: 90.65 },
  { id: 'soeng', file: 'public/assets/audio/soeng.mp3', bpm: 114.016, offset: 0.449, dur: 101.1 },
];

for (const s of SONGS) {
  const { charts, bars } = derive(s.file, s.bpm, s.offset, s.dur);
  const counts = Object.entries(charts)
    .map(([k, v]) => `${k} ${v.length}`)
    .join(', ');
  console.log(`${s.id}: ${bars} bars, ${counts}`);

  const body = `// GENERATED by scripts/derive-chart.mjs -- do not edit by hand.
// Source: ${s.file} at ${s.bpm} BPM, first downbeat ${s.offset}s.
// Re-run: npm run derive
import type { PatternEvent } from '../types';
import type { Difficulty } from '../../game/Difficulty';

export const bars = ${bars};

export const charts: Record<Difficulty, PatternEvent[]> = ${JSON.stringify(charts, null, 2)};
`;
  writeFileSync(`src/audio/songs/${s.id}.events.ts`, body);
}
```

- [ ] **Step 2: Register the npm script**

Add to `package.json` `"scripts"`:

```json
"derive": "node scripts/derive-chart.mjs",
```

- [ ] **Step 3: Run it**

Run: `npm run derive`
Expected: two lines like `molam: 41 bars, easy 51, normal 128, hard 205` and two new files under `src/audio/songs/`. Note the counts — they are checked in Task 6.

- [ ] **Step 4: Commit the script only**

```bash
git add scripts/derive-chart.mjs package.json
git commit -m "feat: derive charts from the recordings offline

Grid-first slot scoring rather than onset detection, which was tried and
failed on this material (~42% grid alignment, flat metrical distribution --
sustained Isan textures make energy flux fire continuously). Scoring each
16th-note slot on the measured grid puts every note on the grid by
construction and turns density into a difficulty dial."
```

---

## Task 6: Wire the real songs and review the generated charts

**Files:**
- Modify: `src/audio/songs/molam.ts`, `src/audio/songs/soeng.ts`
- Modify: `scripts/chart-report.ts`

**Interfaces:**
- Consumes: `charts` and `bars` from `*.events.ts` (Task 5), `SongDef` (Task 4)
- Produces: two `SongDef`s with `audioUrl` set

- [ ] **Step 1: Rewrite `molam.ts`**

```ts
import type { SongDef } from '../types';
import { bars, charts } from './molam.events';

/**
 * หมอลำ — the delivered recording.
 *
 * BPM and the first downbeat were MEASURED from the file, not chosen: a fixed
 * (bpm, phase) comb was fitted over the onset envelope and the phase re-fitted
 * in each third of the track to check for drift. It came out under 1.2 ms across
 * the whole 90 s, which is what makes a fixed-grid chart viable here.
 *
 * Events are generated — see molam.events.ts and scripts/derive-chart.mjs.
 */
export const molam: SongDef = {
  id: 'molam',
  titleTh: 'หมอลำ',
  blurbTh: 'ลำกลอนอีสาน จังหวะปานกลาง',
  bpm: 107.07,
  bars,
  gridOffsetS: 0.247,
  charts,
  audioUrl: 'assets/audio/molam.mp3',
};
```

- [ ] **Step 2: Rewrite `soeng.ts` the same way**

Identical shape with `id: 'soeng'`, `titleTh: 'เซิ้ง'`, `blurbTh: 'จังหวะเซิ้งเร็ว กลองหนัก'`, `bpm: 114.016`, `gridOffsetS: 0.449`, `audioUrl: 'assets/audio/soeng.mp3'`, importing from `./soeng.events`.

- [ ] **Step 3: Make the chart report cover all three difficulties**

In `scripts/chart-report.ts`, loop over `DIFFICULTIES` and print, per song and difficulty: note count, notes per second, longest gap, and the per-lane distribution. Then run it.

Run: `npm run chart`
Expected: for each song, `easy` under ~1.5 notes/sec, `normal` around 2–3, `hard` under ~5. All four lanes used in every difficulty. **If any lane is empty or a difficulty exceeds 6 notes/sec, stop and adjust `DIFFICULTY_DENSITY` before continuing** — an unplayable chart is the one failure mode this method can still produce.

- [ ] **Step 4: Verify the build and existing checks**

```bash
npm run build && npm run check
```
Expected: build clean, all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add -A src scripts
git commit -m "feat: play the real recordings with derived charts

BPM and downbeat are measured values, not chosen ones. The synth path stays in
AudioEngine as the fallback when a recording fails to decode."
```

---

## Task 7: Choose difficulty at song select

**Files:**
- Modify: `src/core/Settings.ts` (persist the choice)
- Modify: `src/scenes/SongSelect.ts` (the control)
- Modify: `src/scenes/Gameplay.ts` (pass it to `buildChart`)
- Modify: `src/audio/AudioEngine.ts` (`load` takes a difficulty)

**Interfaces:**
- Consumes: `Difficulty`, `DIFFICULTY_LABELS_TH` (Task 4)
- Produces: `settings.data.difficulty: Difficulty`; `AudioEngine.load(def, difficulty)`

- [ ] **Step 1: Add the setting**

In `src/core/Settings.ts`, add `difficulty: Difficulty` to `SettingsData` with default `'easy'`, and include it in the load/save round-trip alongside the existing fields.

Default `'easy'` on purpose: the first person to play this build is a teacher who has never seen it, and four consecutive misses ends a run.

- [ ] **Step 2: Thread it through `load`**

In `src/audio/AudioEngine.ts`:

```ts
async load(def: SongDef, difficulty: Difficulty): Promise<LoadedSong> {
  // ... existing decode ...
  const song: LoadedSong = { def, chart: buildChart(def, difficulty), buffer };
  this.loaded = song;
  return song;
}
```

- [ ] **Step 3: Add the control to song select**

Add a three-way selector beneath the song card using the existing `Button` component, one per difficulty, labelled from `DIFFICULTY_LABELS_TH`, with the active one drawn in `C.green`. Write the choice to `settings` on tap.

- [ ] **Step 4: Verify by playing**

Run: `npm run dev`, open the game, pick each difficulty and start หมอลำ.
Expected: visibly fewer notes on ง่าย than ยาก; the choice survives a page reload.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: pick difficulty at song select, defaulting to easy

Defaulting to easy is deliberate: the first player of this build is a teacher
seeing it cold, and four consecutive misses ends the run."
```

---

## Task 8: Make a hit make a sound

**Files:**
- Create: `src/audio/pluck.ts`
- Modify: `src/audio/AudioEngine.ts` (render the bank, expose `playHit`)
- Modify: `src/scenes/Gameplay.ts:339-370` (call it)

**Interfaces:**
- Consumes: `VoiceName`, `audio.sfxBus`
- Produces:
  - `renderPluck(ctx: BaseAudioContext, midi: number, kind: 'phin' | 'ponglang'): AudioBuffer`
  - `AudioEngine.playHit(voice: VoiceName, midi: number, verdict: 'PERFECT' | 'GOOD'): void`

- [ ] **Step 1: Write the physical models**

Create `src/audio/pluck.ts`:

```ts
/**
 * Physical models for the two pitched Isan instruments, rendered to AudioBuffers
 * once at load and replayed per hit.
 *
 * Pressing a lane correctly currently makes no sound at all -- sfxBus is wired to
 * master but nothing plays through it during gameplay. These fill that gap.
 *
 * Pre-rendering is possible because the chart only uses five pitches per
 * instrument, all known ahead of time, and it means a hit costs one buffer
 * playback rather than building an oscillator graph mid-frame.
 */

const SR_ASSUMED = 44100;

function hzOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Karplus-Strong: a plucked string.
 *
 * A burst of noise is written into a delay line one period long and fed back
 * through a two-point average. The noise is the pluck, the delay length is the
 * string length, and the averaging is the energy lost at the bridge on each
 * round trip -- which is why the tone darkens as it decays, exactly as a real
 * string does. Twenty lines of arithmetic gets far closer to พิณ than the
 * sawtooth-through-a-filter it replaces.
 */
function karplusStrong(out: Float32Array, sampleRate: number, freq: number, damping: number): void {
  const n = Math.max(2, Math.round(sampleRate / freq));
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.random() * 2 - 1;

  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = buf[idx] ?? 0;
    const next = buf[(idx + 1) % n] ?? 0;
    const v = (cur + next) * 0.5 * damping;
    buf[idx] = v;
    out[i] = cur;
    idx = (idx + 1) % n;
  }
}

/**
 * Modal synthesis: a struck wooden bar.
 *
 * A free-free bar's overtones are inharmonic -- roughly 1 : 2.76 : 5.40 -- which
 * is precisely why โปงลาง sounds wooden rather than like a tuned pipe. Summing
 * decaying sines at those ratios models the physics directly; higher modes are
 * quieter and die sooner, as they do in the real bar.
 */
function modalBar(out: Float32Array, sampleRate: number, freq: number): void {
  const modes = [
    { ratio: 1.0, gain: 1.0, decay: 3.2 },
    { ratio: 2.76, gain: 0.45, decay: 5.5 },
    { ratio: 5.4, gain: 0.2, decay: 9.0 },
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const m of modes) {
      v += m.gain * Math.exp(-m.decay * t) * Math.sin(2 * Math.PI * freq * m.ratio * t);
    }
    out[i] = v * 0.5;
  }
}

/** One rendered note, ~0.9s, mono. */
export function renderPluck(
  ctx: BaseAudioContext,
  midi: number,
  kind: 'phin' | 'ponglang',
): AudioBuffer {
  const sr = ctx.sampleRate || SR_ASSUMED;
  const len = Math.floor(sr * 0.9);
  const buffer = ctx.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);
  const f = hzOf(midi);

  if (kind === 'phin') karplusStrong(data, sr, f, 0.996);
  else modalBar(data, sr, f);

  // Fade the tail so a truncated buffer never clicks.
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    data[len - fade + i] = (data[len - fade + i] ?? 0) * (1 - k);
  }
  return buffer;
}
```

- [ ] **Step 2: Render the bank and expose playback**

In `AudioEngine`, add a `Map<string, AudioBuffer>` filled during `load()` for the five pentatonic pitches × two kinds, and:

```ts
/**
 * Feedback for a successful hit. Routed through sfxBus so the player's SFX
 * slider governs it and it never fights the recording on musicBus.
 *
 * GOOD is quieter than PERFECT: the sound is information, not just decoration.
 */
playHit(voice: VoiceName, midi: number, verdict: 'PERFECT' | 'GOOD'): void {
  const kind = voice === 'klong' || voice === 'khaen' ? 'ponglang' : 'phin';
  const buf = this.hitBank.get(`${kind}:${midi}`);
  if (!buf) return;

  const src = this.ctx.createBufferSource();
  src.buffer = buf;
  const g = this.ctx.createGain();
  g.gain.value = verdict === 'PERFECT' ? 0.5 : 0.3;
  src.connect(g);
  g.connect(this.sfxBus);
  src.start();
}
```

- [ ] **Step 3: Call it from the press handler**

In `src/scenes/Gameplay.ts`, immediately after `this.showVerdict(event.verdict, event.note.lane)` (around line 369), add:

```ts
if (event.verdict !== 'MISS') {
  audio.playHit(event.note.voice, event.note.midi, event.verdict);
}
```

- [ ] **Step 4: Verify by ear and by level**

Run: `npm run dev` and play a few bars.
Expected: every successful hit is audible over the recording, and the four lanes are distinguishable from one another.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: hits make a sound, using physical models

sfxBus was wired to master but silent during play -- pressing a lane correctly
produced nothing, which was the largest game-feel gap. Karplus-Strong models
the plucked string for phin and modal synthesis the wooden bar for ponglang,
both pre-rendered at load since the chart uses five known pitches."
```

---

## Task 9: Re-measure the master headroom

**Files:**
- Modify: `src/audio/AudioEngine.ts` (`MASTER_HEADROOM`)
- Modify: `NOTES.md` (D14 supersession)

**Interfaces:**
- Consumes: the recordings and the hit bank
- Produces: a measured `MASTER_HEADROOM`

- [ ] **Step 1: Measure the recordings' true peak**

```bash
cd "C:/Users/Administrator/Desktop/thai-folk-beat"
for f in public/assets/audio/*.mp3; do
  printf "%-34s " "$f"
  ffmpeg -v error -i "$f" -af astats=measure_overall=Peak_level -f null - 2>&1 | grep -m1 "Peak level"
done
```

- [ ] **Step 2: Compute the worst case and set the constant**

The recordings are mastered near 0 dBFS, far louder than the synth mix `MASTER_HEADROOM = 0.5` was measured against. Worst case is one recording at full scale plus four simultaneous hits at 0.5 gain. Set `MASTER_HEADROOM` so that sum stays under 1.0, and replace the comment with the new measured figures — never leave the old numbers describing a new mix.

- [ ] **Step 3: Confirm no clipping in a real run**

Play 30 seconds of เซิ้ง on ยาก while holding all four lanes. Expected: no audible distortion, and the limiter idles rather than pumping.

- [ ] **Step 4: Record the decision and commit**

Append a numbered decision to `NOTES.md` explaining that D14's figure applied to the synth mix and no longer does, with the new measurement.

```bash
git add -A src NOTES.md
git commit -m "fix: re-measure master headroom for the recordings

The old 0.5 was measured against the synth mix. Mastered recordings sit far
closer to full scale, so the figure that protected the synth would clip here."
```

---

## Task 10: Prove the chart still agrees with the audio

**Files:**
- Modify: `scripts/gameplay-check.ts`

**Interfaces:**
- Consumes: the generated charts and the recordings
- Produces: assertions that fail if a chart drifts from its recording

- [ ] **Step 1: Add the alignment assertion**

Add a section that, for each song and `normal` difficulty, verifies the derivation is self-consistent: every note time must sit within 1 ms of `gridOffsetS + k * (15/bpm)` for some integer `k`. This is cheap and catches the class of bug that matters — a note that is not on the grid cannot be in sync with the recording.

```ts
console.log('\n[chart-audio alignment] spec §8');
for (const song of [molam, soeng]) {
  const step = 15 / song.bpm;
  const chart = buildChart(song, 'normal');
  const worst = Math.max(
    ...chart.map((n) => {
      const k = Math.round((n.time - song.gridOffsetS) / step);
      return Math.abs(n.time - (song.gridOffsetS + k * step));
    }),
  );
  check(`${song.id}: every note sits on the 16th grid`, worst < 0.001, true);
  check(`${song.id}: last note is inside the recording`, chart[chart.length - 1]!.time < 102, true);
}
```

- [ ] **Step 2: Run it**

Run: `npm run check`
Expected: all assertions pass.

- [ ] **Step 3: Play both songs end to end**

Play หมอลำ and เซิ้ง to completion on ปกติ. Expected: notes land with the music from the first bar to the last. Any accumulating drift shows as notes arriving progressively early or late — watch the final 20 seconds specifically, since that is where drift is largest.

- [ ] **Step 4: Commit**

```bash
git add scripts
git commit -m "test: assert every derived note sits on the recording's grid"
```

**Phase A is complete and shippable here.**

---

# Phase B — the stage redesign

## Task 11: Install the new art and register it

**Files:**
- Create: `public/assets/gameplay/*.png`, `public/assets/loading/*.png`, `public/assets/result/*.png`
- Modify: `src/assets/manifest.ts`
- Create: `scripts/measure-sprites.mjs`

**Interfaces:**
- Consumes: `$DROP`
- Produces: manifest keys `gp.stage`, `gp.receptors`, `gp.lane0..3`, `gp.panel`, `gp.sun`, `load.bg`, `load.bar`, `load.icon0..3`, `result.pass`, `result.fail`, `result.home`, `result.retry`

- [ ] **Step 1: Copy the art with meaningful names**

```bash
cd "C:/Users/Administrator/Desktop/thai-folk-beat"
DROP="C:/Users/ADMINI~1/AppData/Local/Temp/1/claude/C--Users-Administrator/dc576d36-e73a-4181-9279-3d60d4d2043f/scratchpad/brief/THAI_FOLK_BEAT"
mkdir -p public/assets/gameplay public/assets/loading public/assets/result

cp "$DROP/Gameplay/IMG_3492.png" public/assets/gameplay/stage.png
cp "$DROP/Gameplay/IMG_3490.png" public/assets/gameplay/sun.png
cp "$DROP/Gameplay/IMG_3497.png" public/assets/gameplay/receptors.png
cp "$DROP/Gameplay/IMG_3498.png" public/assets/gameplay/lane0.png
cp "$DROP/Gameplay/IMG_3499.png" public/assets/gameplay/lane1.png
cp "$DROP/Gameplay/IMG_3500.png" public/assets/gameplay/lane2.png
cp "$DROP/Gameplay/IMG_3501.png" public/assets/gameplay/lane3.png
cp "$DROP/Gameplay/IMG_3502.png" public/assets/gameplay/panel.png

cp "$DROP/หน้าโลหด/IMG_3516.png" public/assets/loading/bg.png
cp "$DROP/หน้าโลหด/IMG_3515.png" public/assets/loading/bar.png
cp "$DROP/หน้าโลหด/IMG_3511.png" public/assets/loading/icon0.png
cp "$DROP/หน้าโลหด/IMG_3512.png" public/assets/loading/icon1.png
cp "$DROP/หน้าโลหด/IMG_3513.png" public/assets/loading/icon2.png
cp "$DROP/หน้าโลหด/IMG_3514.png" public/assets/loading/icon3.png

cp "$DROP/หน้าคะเเนน/IMG_3510.png" public/assets/result/pass.png
cp "$DROP/หน้าคะเเนน/IMG_3509.png" public/assets/result/fail.png
cp "$DROP/หน้าคะเเนน/IMG_3507.png" public/assets/result/home.png
cp "$DROP/หน้าคะเเนน/IMG_3508.png" public/assets/result/retry.png
```

- [ ] **Step 2: Write the bounding-box measuring script**

Create `scripts/measure-sprites.mjs`. Every one of these files is a full-canvas 1920×1080 layer with the visible element somewhere inside it, so the manifest's `hit` boxes must be **measured from the alpha channel**, never eyeballed. Decode each PNG to raw RGBA with ffmpeg, scan for the min/max x and y where alpha exceeds 8, and print a ready-to-paste `box(cx, cy, w, h)` call per file.

```js
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const W = 1920, H = 1080;

function bounds(file) {
  const raw = execFileSync('ffmpeg',
    ['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgba','-'],
    { maxBuffer: 1 << 28 });
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (raw[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

for (const dir of ['gameplay', 'loading', 'result']) {
  for (const f of readdirSync(`public/assets/${dir}`)) {
    const b = bounds(`public/assets/${dir}/${f}`);
    if (!b) { console.log(`${dir}/${f}: EMPTY`); continue; }
    console.log(`${dir}/${f}: box(${b.x0 + b.w / 2}, ${b.y0 + b.h / 2}, ${b.w}, ${b.h})`);
  }
}
```

- [ ] **Step 3: Run it and add the manifest entries**

Run: `node scripts/measure-sprites.mjs`

Paste the measured boxes into `src/assets/manifest.ts` as new `AssetSpec` entries, each with `layer: true`, `w: 1920`, `h: 1080`, a `purpose` string, and the measured `hit`.

- [ ] **Step 4: Regenerate the asset README and commit**

```bash
npm run assets:readme
git add -A public/assets src/assets scripts
git commit -m "assets: add the stage, loading and result art

Hit boxes are measured from each PNG's alpha channel, not eyeballed --
every file is a full-canvas 1920x1080 layer with the element somewhere inside."
```

---

## Task 12: Rebuild the gameplay screen on the stage art

**Files:**
- Modify: `src/game/NoteHighway.ts`
- Modify: `src/scenes/Gameplay.ts`

**Interfaces:**
- Consumes: `gp.*` manifest keys (Task 11)
- Produces: a gameplay scene drawn on the delivered stage

- [ ] **Step 1: Replace the drawn board with the stage layer**

In `Gameplay.ts`'s `onEnter`, draw `layerSprite('gp.stage')` as the backdrop in place of the current `Graphics` field, keeping the note highway above it.

- [ ] **Step 2: Re-derive the lane geometry from the measured receptor boxes**

The four receptor positions now come from the manifest's measured `hit` boxes for `gp.lane0..3`, not from the constants currently in `NoteHighway.ts`. Replace `LANE_TOP`, `BOARD_Y`, `BOARD_H` and the lane x positions with values read from those boxes, so the notes land exactly on the painted receptors.

- [ ] **Step 3: Light lanes individually**

Add `gp.lane0..3` as sprites with `alpha = 0`, and set the matching one to `1` for ~90 ms on a hit. This is why the designer supplied them separately.

- [ ] **Step 4: Verify**

Run `npm run dev`, play both songs. Expected: notes arrive precisely on the painted receptors; pressing a key lights only that lane.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: rebuild the gameplay screen on the delivered stage art

Lane geometry is derived from the receptors' measured alpha bounds rather than
the old hand-tuned constants, so notes land on the painted targets."
```

---

## Task 13: Put the performers on the stage

**Files:**
- Create: `src/scenes/gameplay/Performers.ts`
- Create: `public/assets/gameplay/dancer/*.png`, `couple/*.png`
- Modify: `src/scenes/Gameplay.ts`

**Interfaces:**
- Consumes: the two gifs from `$DROP/Gameplay/`
- Produces: `class Performers extends Container { update(songTime: number): void }`

- [ ] **Step 1: Extract and crop the frames**

The performers translate across the canvas inside their loops, so a full-canvas copy cannot be instanced — six copies would all slide identically. Crop each frame to the figure's own bounds first:

```bash
cd "C:/Users/Administrator/Desktop/thai-folk-beat"
DROP="C:/Users/ADMINI~1/AppData/Local/Temp/1/claude/C--Users-Administrator/dc576d36-e73a-4181-9279-3d60d4d2043f/scratchpad/brief/THAI_FOLK_BEAT"
mkdir -p public/assets/gameplay/dancer public/assets/gameplay/couple
ffmpeg -v error -y -i "$DROP/Gameplay/IMG_3488.gif" -vf "crop=iw:ih:0:0" public/assets/gameplay/dancer/%02d.png
ffmpeg -v error -y -i "$DROP/Gameplay/IMG_3489.gif" -vf "crop=iw:ih:0:0" public/assets/gameplay/couple/%02d.png
```

Then run `scripts/measure-sprites.mjs` over those two directories to get each frame's alpha bounds, and crop each to the **union** of its own frames' boxes — a per-frame crop would make the figure jitter, since the bounding box changes as the arms move.

- [ ] **Step 2: Write the performer container**

```ts
import { Container, Sprite, Texture } from 'pixi.js';

/**
 * Six dancers across the back of the stage (designer's note: "ตัวละครผู้หญิงที่
 * ร้ายอยู่จะมีหกคน นายก็อปวางเอานะ").
 *
 * Each instance is given its own phase offset. Without that all six hit the same
 * pose on the same frame and the row reads as one object copied, which is
 * exactly what it is -- the stagger is what hides it.
 */
export class Performers extends Container {
  private readonly frames: Texture[];
  private readonly dancers: Sprite[] = [];
  private readonly phases: number[] = [];
  private readonly fps: number;

  constructor(frames: Texture[], fps: number, positions: { x: number; y: number; s: number }[]) {
    super();
    this.frames = frames;
    this.fps = fps;

    positions.forEach((p, i) => {
      const s = new Sprite(frames[0]);
      s.anchor.set(0.5, 1);
      s.position.set(p.x, p.y);
      s.scale.set(p.s);
      this.addChild(s);
      this.dancers.push(s);
      this.phases.push((i / positions.length) * frames.length);
    });
  }

  /**
   * Driven by song time, not by frame deltas, so the dancing stays with the
   * music rather than with the frame rate.
   */
  update(songTime: number): void {
    this.dancers.forEach((s, i) => {
      const n = Math.floor(songTime * this.fps + (this.phases[i] ?? 0)) % this.frames.length;
      const tex = this.frames[n];
      if (tex) s.texture = tex;
    });
  }
}
```

- [ ] **Step 3: Add them to the scene**

Instantiate with six positions spread across the stage floor, behind the note highway and in front of the stage backdrop, and call `update(this.conductor.songTime)` from the scene's `update`.

- [ ] **Step 4: Verify**

Expected: six dancers animating out of step with one another, none overlapping the note lanes, all behind the notes.

- [ ] **Step 5: Commit**

```bash
git add -A public/assets src
git commit -m "feat: six dancing performers on the stage

Frames are cropped to the union of their own alpha bounds so the figure does
not jitter as the arms move, and each instance carries a phase offset so the
row does not read as one sprite copied six times."
```

---

## Task 14: Rebuild the loading screen on its art, driven by the decode

**Files:**
- Modify: `src/scenes/Loading.ts`
- Modify: `src/audio/AudioEngine.ts` (report decode progress)
- Modify: `src/scenes/nav.ts` (pass the real task)

**Interfaces:**
- Consumes: `load.*` manifest keys; `LoadingOptions.task` (already exists)
- Produces: a loading screen whose bar reflects real work

- [ ] **Step 1: Report real progress from the decode**

`AudioEngine.load` currently fetches and decodes with no progress signal, and `Loading.ts` says so in its own comment: the 1.2 s floor is usually all you are watching. Change `load` to accept an optional `onProgress: (f: number) => void`, read the fetch response as a stream, and report bytes received against `Content-Length`, then report 1.0 after `decodeAudioData` resolves.

- [ ] **Step 2: Draw the delivered art**

Replace the drawn panel in `Loading.ts` with `layerSprite('load.bg')` and `layerSprite('load.bar')`, filling the bar within the measured `hit` box of `load.bar` using a masked `Graphics`. Keep the `performance.now()` timing — the clamped-ticker bug it guards against (NOTES D29) is unrelated to this change.

- [ ] **Step 3: Cycle the instrument icons**

Show `load.icon0..3` in turn, one every ~320 ms, in place of the four bouncing discs.

- [ ] **Step 4: Verify**

Expected: the bar tracks the actual mp3 download and no longer jumps from 0 to 100; the screen still holds for at least 1.2 s on a fast connection.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: loading screen art, with the bar driven by the real decode

The bar previously had almost nothing to measure -- the 1.2s floor was most of
what you watched. Streaming the mp3 gives it genuine work to report."
```

---

## Task 15: Rebuild the result screen on its panels

**Files:**
- Modify: `src/scenes/Result.ts`

**Interfaces:**
- Consumes: `result.pass`, `result.fail`, `result.home`, `result.retry`

- [ ] **Step 1: Swap the panel and buttons**

Draw `result.pass` or `result.fail` according to the outcome, and use `result.home` / `result.retry` as the two buttons via `signButton`. **Each button group must set `group.hitArea`** to its measured box — every group holds a full-canvas sprite, so without an explicit `hitArea` only the topmost one is clickable (NOTES D33).

- [ ] **Step 2: Remove the now-duplicated heading**

"ผ่าน!" and "พลาด!" are painted into the art. Delete the `Text` that draws those words, or the screen shows each twice.

- [ ] **Step 3: Verify both outcomes**

Clear a song on ง่าย, then deliberately fail one by not playing. Expected: the correct panel each time, no duplicated heading, and both buttons respond.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat: result screen on the delivered panels

The pass/fail wording is painted into the art, so the scene stops drawing its
own heading. Both button groups set an explicit hitArea, without which only the
topmost full-canvas layer receives clicks."
```

---

## Task 16: Full pass and deploy

- [ ] **Step 1: Run everything**

```bash
npm run build && npm run check && npm run chart
```
Expected: all clean.

- [ ] **Step 2: Play both songs at all three difficulties, start to finish**

Expected: no desync in the final 20 s of either song; no clipping on ยาก; every screen uses the new font with no blank boxes.

- [ ] **Step 3: Update the notes**

Add the decisions from this plan to `NOTES.md` (measured BPMs, the failed onset-detection approach and why, the headroom re-measurement, the font's missing glyphs) and update the §9 acceptance table.

- [ ] **Step 4: Deploy**

```bash
npm run deploy
```
Expected: the live site at https://meatball-007.github.io/thai-folk-beat/ serves the new build.

- [ ] **Step 5: Commit**

```bash
git add -A NOTES.md
git commit -m "docs: record the decisions from the real-recording rebuild"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §2 measurements | Task 6 (constants), Task 10 (assertions) |
| §3 synth → hit SFX | Task 8 |
| §4.1–4.2 derivation | Task 5 |
| §4.3 difficulty as density | Tasks 4, 7 |
| §4.4 offline, committed | Tasks 5, 6 |
| §5 playback, Conductor unchanged | Task 6 (reuses the existing buffer branch) |
| §6 art | Tasks 11–15 |
| §7 fonts | Tasks 2, 3 |
| §8 verification | Tasks 9, 10, 16 |

**Open items carried from the spec:** the เซิ้ง downbeat (§9.1) is set to the 0.449 s candidate in Task 6; if playtesting in Task 10 shows the accents falling in the wrong place, the alternative is 0.712 s and only `gridOffsetS` changes. The loading icon colours (§9.2) follow the delivered art in Task 14.

**Known risk:** Task 6 Step 3 is the one place a generated chart could be unplayable. The step states explicit thresholds and says to stop rather than continue past them.
