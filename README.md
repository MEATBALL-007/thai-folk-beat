# THAI FOLK BEAT — ดนตรีพื้นบ้านอีสาน

A 4-lane note-highway rhythm game about Isan (northeastern Thai) folk music.
Two songs — **หมอลำ** and **เซิ้ง** — with procedurally synthesised music, so the
game is playable before a single audio file exists.

**▶ เล่นได้เลยที่ https://meatball-007.github.io/thai-folk-beat/**

Built as a school-project demo. See `NOTES.md` for every decision and shortcut,
and `public/assets/README.md` for the art drop-in list.

---

## Show it to someone

| What | Where |
|---|---|
| Play online | <https://meatball-007.github.io/thai-folk-beat/> |
| Play locally, no terminal | double-click **`เปิดเกม.bat`** |
| Progress report (Thai) | `report/progress-report.pdf` |

At the Title screen **click once before expecting sound** — browsers block audio
until the user interacts.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Then click once on the Title screen — browsers block audio until a user gesture.

### Build the web version (this is the shippable demo)

```bash
npm run build        # typechecks, then bundles to dist/
npm run preview      # serve dist/ at http://localhost:4173
```

`dist/` is fully self-contained and works offline: fonts are bundled, there are
no CDN links, and all audio is generated at runtime. Double-clicking
`dist/index.html` will **not** work (ES modules need a server) — serve the folder,
or use the desktop build below.

### Build the Windows .exe

> **Blocked on this machine.** Rust 1.98 and WebView2 are installed, but the
> **MSVC linker is missing**, so `cargo` cannot link any binary at all.
> `npx tauri info` reports:
> `Couldn't detect any Visual Studio or VS Build Tools instance with MSVC and SDK components.`

To unblock, install the **"Desktop development with C++"** workload. `winget` is
already on this machine, so it is one command in an **Administrator** terminal:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

(Several GB, so it takes a while. The manual equivalent is
<https://aka.ms/vs/17/release/vs_BuildTools.exe> → tick **Desktop development with C++**.)

Then, in a **fresh** terminal so the new PATH is picked up:

```bash
npx tauri info      # the Environment block should now be all ✔
npm run tauri:build
```

This was deliberately not installed for you: it is multi-gigabyte system
tooling, which is a change to authorise rather than something a build script
should do unattended.

Output lands in `src-tauri/target/release/bundle/nsis/`. Everything else Tauri
needs is already scaffolded and its config validated: window 1280x720, resizable,
titled `THAI FOLK BEAT`, icons generated, and the permissions the EXIT button and
F11 need are declared in `src-tauri/capabilities/default.json`.

---

## Controls

| Action | Keys |
|---|---|
| Lanes 0–3 | `D` `F` `J` `K` — or `←` `↓` `↑` `→` |
| Hit a note | also **click or tap the receptor circle** |
| Advance comic | click or `Space` · skip with `Esc` or the ข้าม button |
| Fullscreen | `F11` |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit` **then** `vite build` — the typecheck is the gate |
| `npm run preview` | Serve the production build |
| `npm run check` | Verify judgement windows, combo/multiplier and the fail rule (29 checks) |
| `npm run chart` | Chart statistics — note counts, density, tightest same-lane gap |
| `npm run assets:readme` | Regenerate `public/assets/README.md` from the manifest |
| `npm run demo` | Serve the built demo and open a browser (no terminal needed via `เปิดเกม.bat`) |
| `npm run report` | Rebuild the Thai progress report — HTML + PDF into `report/` |
| `npm run deploy` | Build and publish to GitHub Pages (`gh-pages` branch) |
| `npm run tauri:build` | Windows installer (needs MSVC Build Tools, see above) |

---

## How it works

### The clock

Everything is timed from `AudioContext.currentTime` through `audio/Conductor.ts`.
Nothing reads `requestAnimationFrame` deltas or `performance.now()` for song
timing — those drift against the audio hardware and desync within seconds. The
debug scene measured a frame-accumulated clock losing **6.8 seconds in 7.6** under
load, which is exactly the failure this avoids.

Key presses are timestamped **inside the event handler**, not on the next frame.
At 60fps a frame is ~16.7ms — a third of the entire ±45ms PERFECT window.

### The music

There are no audio files. `audio/songs/*.ts` hold the songs as readable bar-grids:

```ts
grid(6, {
  0: ['x...x...', 'x...x..x'],   // กลอง  drum
  2: ['..4.3.2.', '0.2.3...'],   // พิณ   plucked lute
})
```

That one array is scheduled as synth voices **and** compiled into the playable
chart, so audio and notes cannot disagree — they are the same data. An offline
render confirms it: every drum onset lands on its chart time to within **1ms**.

To swap in real recordings later, set `audioUrl` on a `SongDef`. The engine then
plays the file and uses the identical chart. Nothing else changes.

### Art

Missing art never breaks the build. `core/AssetLoader.ts` tries each file in
`assets/manifest.ts` and, on failure, generates a labelled placeholder showing the
asset key and expected size — so a screenshot tells the designer exactly what to
export. `public/assets/README.md` lists every expected file.

The delivered menu art is exported as **full-canvas 1920×1080 layers** (one element
per file on a transparent canvas), so they stack at (0,0) and reproduce the
designer's composition exactly. Their interactive bounds are measured from the
alpha channel and recorded in the manifest.

---

## Project layout

```
src/
  core/     App, Layout (16:9 letterbox), SceneManager, Scene,
            Input, Settings, Storage, AssetLoader, platform
  audio/    AudioEngine, Conductor, voices, pattern DSL, songs/
  game/     Chart, Judge, ScoreSystem, NoteHighway, best, comicContent
  scenes/   Title, Settings, RegionSelect, SongSelect, Comic,
            Loading, Gameplay, Result, nav
  ui/       Button, Slider, Carousel, Particles, artLayer, theme
scripts/          dev tools (chart report, gameplay checks, asset README,
                  demo server, progress report, Pages deploy)
report/           generated progress report (PDF for submission)
src-tauri/        desktop shell
design-reference/ the designer's layout mockup + one screenshot per screen
```

`Layout.ts` fixes a 1920×1080 design space and letterboxes it, so every scene uses
absolute coordinates and never reads the window size.

---

## Status

Phases 1–6 and 8 are complete and verified; the delivered menu art is integrated.
Phase 7 (Tauri) is scaffolded and config-validated but cannot be **built** here —
the MSVC linker is missing, see above.

All 11 items of the spec's §9 acceptance checklist pass. The evidence, including
a full 62-second playthrough that reaches CLEARED with all 150 notes accounted
for, is tabulated in `NOTES.md`.

One thing no automated check can settle: **whether the synthesised music actually
sounds good.** Timing, levels and audibility are all proven; taste needs your ears
once.

**Not built** (explicit non-goals): regions other than อีสาน, songs beyond the two,
the instrument-select screen, the record-your-performance ending, macOS, online
features, a chart editor.

---

## Publishing

The live site is served from the `gh-pages` branch, rebuilt from scratch on each
deploy so stale assets never linger:

```bash
npm run deploy      # builds, then force-pushes dist/ to gh-pages
```

Deploying via a branch rather than a GitHub Actions workflow is deliberate: a
workflow file requires the `workflow` OAuth scope, which the CLI token here does
not have. The branch route needs only `repo` and produces the same result.

**A custom domain** can be pointed at it later by adding a `CNAME` file to the
`gh-pages` branch and a DNS record — that only needs a domain you own; the Pages
site itself is already live.
