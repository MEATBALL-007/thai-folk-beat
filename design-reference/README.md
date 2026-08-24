# Design reference

`menu_layout_reference.png` — the designer's Title layout mockup
(`Menu/จัดหน้าlayoutเเบบนี้.png`). The PLAY / SETTING / EXIT sign positions used in
`scenes/Title.ts` were measured by diffing this against the plain backdrop, so
they sit exactly where they were drawn.

`verification/` — one screenshot per screen, captured from the running build.
These are the evidence behind the acceptance table in `NOTES.md`.

| File | Screen |
|---|---|
| `01-title.png` | Title, using the delivered backdrop + logo |
| `02-region-select.png` | Region select — 2x2 grid, only อีสาน enabled |
| `03-song-select.png` | Song carousel, masked to the frame |
| `04-comic.png` | Comic reader with a placeholder panel + real Thai caption |
| `05-settings.png` | All five settings controls |
| `06-gameplay.png` | Gameplay with particle burst and lane glow |
| `07-result.png` | Result screen, CLEARED |
| `08-letterbox-ultrawide.png` | 1900x620 — pillarboxed, not stretched |
| `09-audio-debug-scene.png` | Phase 2 audio debug readout (dev scene) |
