# THAI FOLK BEAT — build notes

Running log of shortcuts taken, decisions made, and TODOs. Per spec §11, reasonable
implementation choices were made without asking; every one of them is recorded here.

---

## Status

| Phase | State | Build |
|---|---|---|
| 1 — Skeleton | **done, verified in browser** | pass |
| 2 — Audio core | **done, verified offline-render** | pass |
| 3 — Gameplay | **done, verified live** | pass |
| 4 — Result | **done, verified** | pass |
| 5 — Menu chain | **done, full flow walked** | pass |
| 6 — Asset manifest | **done** (built before 5 — see D25) | pass |
| 7 — Tauri | **scaffolded + config validated; cannot build here** (D28) | pass |
| 8 — Polish | **done** — lane glow, PERFECT burst, screen shake | pass |

---

## Decisions

### D1 — Scaffolded by hand instead of `npm create vite`
The official template ships a counter demo, `style.css`, `public/vite.svg` and a
`main.ts` that all had to be deleted anyway, and it prompts interactively. Writing
`package.json` / `tsconfig.json` / `vite.config.ts` directly was faster and left no
dead files.

### D2 — `npm run build` is `tsc --noEmit && vite build`
Spec §1 says "no TypeScript errors" and §8 gates each phase on the build. Vite alone
does **not** typecheck — it strips types with esbuild and would happily ship broken
code. Chaining `tsc --noEmit` first makes the gate mean what the spec intends.

### D3 — Strict TS is stricter than just `"strict": true`
Also enabled `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noUnusedLocals`, `noUnusedParameters`. Costs a few extra guards, but on a
same-night build the compiler catching an off-by-one in the chart indexing is
worth more than the keystrokes.

### D4 — Resize handled manually, not via Pixi's `resizeTo: window`
`resizeTo` and our own `Layout.resize()` both react to the window resize event,
and their relative order is not guaranteed — a frame rendered between the two is
stretched. `App` now owns one resize handler that resizes the renderer and then
the Layout, in that order.

### D5 — `Layout.root` is masked to the design rect
Without the mask, any scene drawing beyond 1920x1080 paints over the letterbox
bars and breaks the 16:9 guarantee. The mask makes the bars structural rather
than something every scene has to remember not to violate.

### D6 — SceneManager crossfade uses ticker deltaMS, not the Conductor
This does **not** violate spec §2. §2 governs the *song* clock, which must be
audio-derived. UI easing has no relationship to audio and has to keep running when
no song is playing (Title, Settings, Result). The Conductor is used for note
timing and nothing else.

### D7 — A scene fading out during `replace()` is frozen
`replace()` pops the outgoing scene before the fade, so it stops receiving
`update()` and renders as a still image for those 250ms. This is intentional: it
prevents a scene from running game logic after it has logically exited. If a
fading-out animation is ever wanted, keep it in a `fading` list that `update()`
also walks. Not needed for the demo.

### D8 — Re-entrant navigation is dropped, not queued
`SceneManager` ignores `push/replace/pop` while a transition is in flight, and
`isTransitioning` is exposed so callers can gate too. A double-tap on a menu
button therefore does nothing rather than queuing a second navigation.

### D9 — Full font subsets bundled (not just Thai)
Imported `@fontsource/{kanit,sarabun}/{400,700}.css` rather than the `thai-*.css`
subsets, because the UI mixes Thai with Latin (`PLAY`, `BEST SCORE`, `SCORE`).
Costs ~450KB of woff/woff2 in `dist/`, which is irrelevant for an offline `.exe`
and removes any risk of a missing-glyph box on the projector.

### D10 — Fonts force-loaded before first render
`@fontsource` declares `@font-face` lazily, so a face is only fetched once a glyph
needs it. PixiJS rasterises text into an atlas immediately and would bake in the
fallback font. `main.ts` therefore awaits `document.fonts.load()` for all four
faces — with both a Thai and a Latin sample glyph, to force both subsets — before
constructing the App.

### D11 — Inline SVG favicon
Purely to keep the devtools console clean; a `favicon.ico` 404 in front of a
teacher looks like a broken build. Data-URI, so it stays offline-safe (§1).

---

## TODO / carried forward

**Blocking the .exe (one step):**
- [ ] Install VS Build Tools "Desktop development with C++" → `npm run tauri:build`.
      Everything else for Tauri is already in place. See README.

**Art still to drop in** (each falls back to a labelled placeholder today —
paths and pixel sizes in `public/assets/README.md`):
- [ ] `characters/performer_idle.png` + `performer_play.png` — the Title character
      is *hidden* until the real file exists, so the screen looks finished rather
      than unfinished. Drop the file in and the bob/sway animation appears.
- [ ] `comic/molam_1..4.png`, `comic/soeng_1..4.png` — captions are already
      written and accurate, so the panels read fine meanwhile.
- [ ] `bg/gameplay.png` — optional backdrop behind the highway.

**Ask the designer:**
- [ ] Menu art arrived in a palette that does not match spec §6 (D24). Gameplay
      still uses §6's semantic colours. If gameplay art is coming, confirm which
      palette it will use so the notes and verdicts stay consistent with it.
- [x] BACK/NEXT captions — **resolved 24 Aug**: removed at the user's request.
      The signs are the artwork, uncaptioned, matching the composed reference.
- [ ] No art was supplied for the Title's PLAY/SETTING/EXIT signs; they are drawn
      to match the mockup. Real sign PNGs would drop straight in.

**Nice to have, not needed for the demo:**
- [ ] Voice-over: `ComicPanel.voiceUrl` is wired and null-guarded — set the field
      and it plays, no code change (spec §5.5).
- [ ] Real recordings: set `SongDef.audioUrl` and the engine plays the file with
      the identical chart (spec §3.4).
- [ ] `scenes/AudioDebug.ts` and `audio/verify.ts` are dev-only and unreferenced
      by the shipped scenes, so they are tree-shaken out. Kept because they are
      how audio/chart sync gets re-proven after any change to the songs.
- [ ] Re-check the headless miss rate by hand once (D22) — believed to be a test
      harness artefact, not a game bug.

### D32 — Second art drop: finished screens replaced hand-drawn UI
A second delivery (24 Aug) supplied composed screens rather than loose elements:

| File | What it is | Where it went |
|---|---|---|
| IMG_3423 | Title backdrop + logo + instrument silhouettes | `bg/menu.png` |
| IMG_3422 | Same, with the three signs — reference only | `design-reference/title_composed.png` |
| IMG_3425/3426/3424 | เริ่มเกม / ตั้งค่า / ออกเกม signs, Thai lettered in | `ui/btn_play|setting|exit.png` |
| IMG_3427 | Region backdrop + wooden panel + เลือกภูมิภาค heading | `bg/region.png` |
| IMG_3428 | อีสาน SELECTED — filled disc + name plate | `ui/region_isan_selected.png` |
| IMG_3429/3430 | Composed region screens — reference only | `design-reference/region_composed*.png` |

The six region/nav files in that drop were byte-identical to the ones already in
the project, so nothing was re-imported.

Consequences:
- The Title's drawn `Button`s are gone — the signs ARE the artwork now, and the
  labels are Thai (เริ่มเกม, not PLAY). Only the subtitle and BEST SCORE are still
  live text, because the art cannot contain a changing number.
- Selection on the region screen is now the designer's: the disc fills and a name
  plate appears. The teal ring I had invented is gone.
- The region heading is baked into the backdrop, and reads **เลือกภูมิภาค** — my
  hand-drawn heading said เลือกภาค. The art wins.
- `bg/menu_frame.png` was re-derived from the new region backdrop (panel and
  heading cleared), so Settings / SongSelect / Result inherit the instrument
  silhouettes too.

**My measured sign positions were right.** The separately-exported buttons landed
at (1437,238) / (1438,541) / (1449,834); the positions I had derived by diffing
the first mockup were (1436,239) / (1438,541) / (1449,833) — within a pixel.

### D33 — Only the topmost art layer was clickable (real bug, subtle)
After wiring the signs, only ONE responded — whichever was added last. Play and
ตั้งค่า were dead while ออกเกม worked; promoting the play group in the live scene
graph inverted it exactly.

Cause: each sign is a group holding a **full-canvas 1920x1080 sprite**, so every
group's bounds cover the entire screen. Pixi descends into the topmost group that
claims the point and never tests the ones beneath, so lower signs were
unreachable no matter where you clicked.

Fix: each group declares `hitArea = Rectangle(sign box)`. `hitPruneFn` then
discards a group when the pointer is outside its own sign and the walk continues
downward. The individual targets also moved from an alpha-0 Graphics to an
explicit `hitArea` — cheaper, and a childless Container is hit-tested only via
its hitArea anyway.

**This is a trap for any full-canvas layer workflow.** Stacking layer exports is
otherwise ideal — it reproduces the designer's composition exactly — but every
interactive layer group needs a hitArea or it will swallow everything below it.

---

## §9 acceptance checklist — final run

| # | Item | Result |
|---|---|---|
| 1 | `npm run build` — zero TS errors | **pass** — strict TS + 4 extra strictness flags |
| 2 | Full flow Title → Region → Song → Comic → Loading → Gameplay → Result → Menu | **pass** — walked end to end, on both the dev server and the production bundle |
| 3 | หมอลำ plays 60s without desync | **pass, twice over** — (a) offline render: 59/59 drum onsets match the chart, mean error 0.96ms, max 2.0ms across the full 62s; (b) a complete 62.6s playthrough pressed every note at a *fixed* -70ms lead and still landed 147/150 inside the ±90ms window. Any accumulating drift would have pushed the later presses out — see "Full playthrough" below |
| 4 | PERFECT / GOOD / MISS all trigger, visually distinct | **pass** — 67 PERFECT on-time; 50 GOOD / 0 PERFECT at a deliberate +70ms; MISS via the fail run. Green / gold / red |
| 5 | Combo multiplier climbs to x8 and resets to x1 on miss | **pass** — `npm run check`: x2 at combo 10, x8 at 70, capped, reset to x1 on miss. Also reached in real play: maxCombo **88** in the full playthrough |
| 6 | Miss 4 in a row -> fail screen | **pass** — halted at exactly 4, `state: FAILED` |
| 7 | Best score survives a full page reload | **pass** — `tfb.best.molam` persisted; both songs now hold records |
| 8 | Every Settings slider audibly/visibly does something | **pass** — Sound/Music retune the live buses and fire a preview note; Resolution resizes the renderer; offset feeds the Conductor live; note-speed visibly changes on-screen density (8 notes at 2.5s vs 5 at 1.5s) |
| 9 | Both mouse and keyboard register hits | **pass** — keys: 67 PERFECT. Pointer taps on receptors: 2 PERFECT + 1 GOOD |
| 10 | Window resize keeps 16:9 letterbox, no stretching | **pass** — verified at 1600x900, 1600x1000 and 1900x620 (pillarbox) |
| 11 | NOTES.md lists every shortcut and TODO | **pass** — this file |

### Full playthrough — the song reaching its natural end

Every earlier run ended in FAILED or was cut short, so CLEARED had only ever been
asserted from the code. One complete run of หมอลำ, autoplayed end to end:

```
state       CLEARED
score       32,350      maxCombo 88
PERFECT 15  GOOD 132  MISS 3      = 150  (every chart note, exactly once)
songTime    62.75s -> duration 62.59s reached, no early exit
```

Three things this proves that nothing else did:
1. The song runs its full length and reports **CLEARED** (spec §4.4).
2. All 150 notes are consumed exactly once — none lost, none double-judged.
3. **No clock drift.** The harness pressed every note at a fixed -70ms lead for
   62 seconds. Drift would accumulate and push later presses outside the ±90ms
   window; 147/150 landed. (The GOOD-heavy split is just the deliberate -70ms
   lead, which sits outside ±45ms.)

### Audio confirmed audible in the real flow

Separately from the offline render, the master bus was tapped with an
AnalyserNode during an ordinary gameplay session (not the debug scene):

```
ctx.state       running
peak amplitude  0.1998      <- healthy, and safely under clipping
frames w/ sound 22 / 343    <- matches หมอลำ's deliberately sparse intro
```

So the game demonstrably makes sound on the normal path, at a sensible level.

Not verifiable headlessly, still needs your ears once: **whether the synthesised
music actually sounds good.** Sync, levels and audibility are proven; taste is not.

---

## Known spec ambiguities (resolved without asking, per §11)

1. **§5.6 "a real progress bar driven by actual asset decode/preload progress"** —
   audio is synthesised (§3, nothing to decode) and missing art falls back to
   generated placeholders (§6), so genuine progress completes in ~0ms. The 1.2s
   minimum display time will be doing essentially all of the work. Plan: drive the
   bar off the real AssetLoader counter, but ease it across the 1.2s floor so it
   reads as a load rather than a flash.
2. **§3.3 song length** — 110 BPM x 28 bars is ~61s, and §3.3 also asks for 2 bars
   of lead-in, putting หมอลำ at ~65s total. "60-second song" is treated as
   approximate; the chart is authored in bars, not seconds.
3. **§4.4 fail vs. natural end** — not contradictory: 4 consecutive misses ends the
   song early with FAILED; otherwise there is no health drain and the song always
   reaches its end and reports CLEARED.

---

## Swap-in: replacing synthesised audio with real recordings

(Written in Phase 2 — see `src/audio/`.)
