# Art assets

**Generated from `src/assets/manifest.ts` — do not edit by hand.**
Regenerate with `npm run assets:readme`.

Every file below is **optional**. Anything missing is replaced at runtime by a
generated placeholder labelled with its asset key, so the game always runs. Drop
a real PNG at the listed path and it is picked up on the next reload — no code
change needed.

Sizes are the **4K authoring size**; the game downscales at runtime, so export
at these dimensions from the vector source.

Total assets: **45**

## UI

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `ui/region_north.png` | 1920 x 1080 | `ui.region.north` | ภาคเหนือ disc, top-left of the 2x2 grid (disabled in this build) |
| `ui/region_isan.png` | 1920 x 1080 | `ui.region.isan` | ภาคอีสาน disc (ผีตาโขน mask), top-right — the only enabled region |
| `ui/region_central.png` | 1920 x 1080 | `ui.region.central` | ภาคกลาง disc, bottom-left (disabled in this build) |
| `ui/region_south.png` | 1920 x 1080 | `ui.region.south` | ภาคใต้ disc, bottom-right (disabled in this build) |
| `ui/region_isan_selected.png` | 1920 x 1080 | `ui.region.isanSelected` | อีสาน in its SELECTED state — filled disc plus the อีสาน name plate. Drawn over the unselected disc; this is how the designer indicates selection (not a ring) |
| `ui/btn_play.png` | 1920 x 1080 | `ui.btn.play` | เริ่มเกม sign (Title, top) |
| `ui/btn_setting.png` | 1920 x 1080 | `ui.btn.setting` | ตั้งค่า sign (Title, middle) |
| `ui/btn_exit.png` | 1920 x 1080 | `ui.btn.exit` | ออกเกม sign (Title, bottom) |
| `ui/btn_back.png` | 1920 x 1080 | `ui.btn.back` | Wooden BACK sign, bottom-left |
| `ui/btn_next.png` | 1920 x 1080 | `ui.btn.next` | Wooden NEXT sign, bottom-right |
| `gameplay/molam/panel.png` | 1920 x 1080 | `gp.molam.panel` | molam receptor panel, instrument names printed in (แคน / พิณ / เบส / กลองชุด) |
| `gameplay/molam/lane0.png` | 1920 x 1080 | `gp.molam.lane0` | molam lane 0 receptor (แคน) |
| `gameplay/molam/lane1.png` | 1920 x 1080 | `gp.molam.lane1` | molam lane 1 receptor (พิณ) |
| `gameplay/molam/lane2.png` | 1920 x 1080 | `gp.molam.lane2` | molam lane 2 receptor (เบส) |
| `gameplay/molam/lane3.png` | 1920 x 1080 | `gp.molam.lane3` | molam lane 3 receptor (กลองชุด) |
| `gameplay/soeng/panel.png` | 1920 x 1080 | `gp.soeng.panel` | soeng receptor panel, instrument names printed in (แคน / พิณ / ซอ / กลองกิ่ง) |
| `gameplay/soeng/lane0.png` | 1920 x 1080 | `gp.soeng.lane0` | soeng lane 0 receptor (แคน) |
| `gameplay/soeng/lane1.png` | 1920 x 1080 | `gp.soeng.lane1` | soeng lane 1 receptor (พิณ) |
| `gameplay/soeng/lane2.png` | 1920 x 1080 | `gp.soeng.lane2` | soeng lane 2 receptor (ซอ) |
| `gameplay/soeng/lane3.png` | 1920 x 1080 | `gp.soeng.lane3` | soeng lane 3 receptor (กลองกิ่ง) |
| `gameplay/sun.png` | 1920 x 1080 | `gp.sun` | Gear ornament, top-left — opens Settings |
| `loading/bar.png` | 1920 x 1080 | `load.bar` | Progress bar frame; the fill is drawn inside this box |
| `loading/icon0.png` | 1920 x 1080 | `load.icon0` | Loading spinner frame 1 — กลอง |
| `loading/icon1.png` | 1920 x 1080 | `load.icon1` | Loading spinner frame 2 — โหม่ง |
| `loading/icon2.png` | 1920 x 1080 | `load.icon2` | Loading spinner frame 3 — พิณ |
| `loading/icon3.png` | 1920 x 1080 | `load.icon3` | Loading spinner frame 4 — แคน |
| `result/pass.png` | 1920 x 1080 | `result.pass` | Cleared panel, with "ผ่าน!" baked in |
| `result/fail.png` | 1920 x 1080 | `result.fail` | Failed panel, with "พลาด!" baked in |
| `result/home.png` | 1920 x 1080 | `result.home` | Return-to-menu button |
| `result/retry.png` | 1920 x 1080 | `result.retry` | Play-again button |

## Backgrounds

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `bg/menu.png` | 1920 x 1080 | `bg.menu` | Title backdrop — orange field, teal frame, corner ornaments, instrument silhouettes and the THAI FOLK BEAT logo, all baked in |
| `bg/region.png` | 1920 x 1080 | `bg.region` | Region-select backdrop — same frame plus the wooden panel and the เลือกภูมิภาค heading, baked in |
| `bg/menu_frame.png` | 1920 x 1080 | `bg.menuFrame` | Frame + instrument silhouettes with the panel and heading removed — shared backdrop for Settings / SongSelect / Result (derived from bg/region.png) |
| `gameplay/molam/stage.png` | 1920 x 1080 | `gp.molam.stage` | molam stage backdrop |
| `gameplay/soeng/stage.png` | 1920 x 1080 | `gp.soeng.stage` | soeng stage backdrop |
| `loading/bg.png` | 1920 x 1080 | `load.bg` | Loading backdrop: orange field, teal rule and corner flourishes |

## Characters

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `characters/performer_idle.png` | 1400 x 2400 | `char.performer.idle` | Performer standing, for the Title bob/sway loop (not yet delivered) |
| `characters/performer_play.png` | 1400 x 2400 | `char.performer.play` | Performer mid-play, behind the lanes during gameplay (not yet delivered) |
| `gameplay/dancer_strip.png` | 2140 x 331 | `gp.molam.dancer` | 10-frame dancer loop as a horizontal strip, sliced at runtime |
| `gameplay/couple_strip.png` | 3168 x 383 | `gp.molam.couple` | 8-frame singing-couple loop as a horizontal strip |
| `gameplay/soeng/cast_strip.png` | 2274 x 354 | `gp.soeng.cast` | เซิ้ง troupe, already composed as a row; two poses alternating on the beat |

## Comic panels

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `comic/molam_1.png` | 1920 x 1080 | `comic.molam.1` | หมอลำ origin comic, panel 1 of 2 |
| `comic/molam_2.png` | 1920 x 1080 | `comic.molam.2` | หมอลำ origin comic, panel 2 of 2 |
| `comic/soeng_1.png` | 1920 x 1080 | `comic.soeng.1` | เซิ้ง origin comic, panel 1 of 2 |
| `comic/soeng_2.png` | 1920 x 1080 | `comic.soeng.2` | เซิ้ง origin comic, panel 2 of 2 |

## Notes

- PNG with transparency where the art is cut out (characters, logo).
- Comic panels are 16:9 and are letterboxed into the screen, so keep important
  content away from the extreme edges.
- Filenames are case-sensitive on some systems — match them exactly.
