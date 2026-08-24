# Art assets

**Generated from `src/assets/manifest.ts` — do not edit by hand.**
Regenerate with `npm run assets:readme`.

Every file below is **optional**. Anything missing is replaced at runtime by a
generated placeholder labelled with its asset key, so the game always runs. Drop
a real PNG at the listed path and it is picked up on the next reload — no code
change needed.

Sizes are the **4K authoring size**; the game downscales at runtime, so export
at these dimensions from the vector source.

Total assets: **24**

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

## Backgrounds

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `bg/menu.png` | 1920 x 1080 | `bg.menu` | Title backdrop — orange field, teal frame, corner ornaments, instrument silhouettes and the THAI FOLK BEAT logo, all baked in |
| `bg/region.png` | 1920 x 1080 | `bg.region` | Region-select backdrop — same frame plus the wooden panel and the เลือกภูมิภาค heading, baked in |
| `bg/menu_frame.png` | 1920 x 1080 | `bg.menuFrame` | Frame + instrument silhouettes with the panel and heading removed — shared backdrop for Settings / SongSelect / Result (derived from bg/region.png) |
| `bg/gameplay.png` | 3840 x 2160 | `bg.gameplay` | Backdrop behind the note highway (not yet delivered) |

## Characters

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `characters/performer_idle.png` | 1400 x 2400 | `char.performer.idle` | Performer standing, for the Title bob/sway loop (not yet delivered) |
| `characters/performer_play.png` | 1400 x 2400 | `char.performer.play` | Performer mid-play, behind the lanes during gameplay (not yet delivered) |

## Comic panels

| File | Size (px) | Key | Purpose |
|---|---|---|---|
| `comic/molam_1.png` | 2560 x 1440 | `comic.molam.1` | หมอลำ origin comic, panel 1 of 4 (not yet delivered) |
| `comic/soeng_1.png` | 2560 x 1440 | `comic.soeng.1` | เซิ้ง origin comic, panel 1 of 4 (not yet delivered) |
| `comic/molam_2.png` | 2560 x 1440 | `comic.molam.2` | หมอลำ origin comic, panel 2 of 4 (not yet delivered) |
| `comic/soeng_2.png` | 2560 x 1440 | `comic.soeng.2` | เซิ้ง origin comic, panel 2 of 4 (not yet delivered) |
| `comic/molam_3.png` | 2560 x 1440 | `comic.molam.3` | หมอลำ origin comic, panel 3 of 4 (not yet delivered) |
| `comic/soeng_3.png` | 2560 x 1440 | `comic.soeng.3` | เซิ้ง origin comic, panel 3 of 4 (not yet delivered) |
| `comic/molam_4.png` | 2560 x 1440 | `comic.molam.4` | หมอลำ origin comic, panel 4 of 4 (not yet delivered) |
| `comic/soeng_4.png` | 2560 x 1440 | `comic.soeng.4` | เซิ้ง origin comic, panel 4 of 4 (not yet delivered) |

## Notes

- PNG with transparency where the art is cut out (characters, logo).
- Comic panels are 16:9 and are letterboxed into the screen, so keep important
  content away from the extreme edges.
- Filenames are case-sensitive on some systems — match them exactly.
