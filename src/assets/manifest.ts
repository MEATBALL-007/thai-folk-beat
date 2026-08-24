/**
 * Every image the game asks for, by logical key (spec §6).
 *
 * Nothing here is required to exist. AssetLoader generates a labelled
 * placeholder for anything missing, so the build never breaks on an asset the
 * designer has not exported yet.
 *
 * The delivered menu art is exported as FULL-CANVAS 1920x1080 LAYERS rather than
 * cropped sprites — each file holds one element positioned on an otherwise
 * transparent canvas. Those are marked `layer: true` and drawn at (0,0); their
 * `hit` box records where the visible element actually sits, which is what
 * pointer hit-testing uses. Bounds were measured from the PNGs' alpha channels,
 * not eyeballed.
 *
 * public/assets/README.md is generated from this list; keep them in step.
 */

export type AssetKind = 'ui' | 'character' | 'comic' | 'bg';

/** Interactive bounds in design space, for full-canvas layers. */
export interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AssetSpec {
  key: string;
  /** Relative to the bundle root, so it survives Tauri's file:// origin. */
  path: string;
  kind: AssetKind;
  /** Expected exported size in pixels. */
  w: number;
  h: number;
  purpose: string;
  /** Full-canvas layer: draw at (0,0) at design size, do not scale to fit. */
  layer?: boolean;
  /** Where the visible element sits inside a layer (design-space px). */
  hit?: HitBox;
}

/** Centre-based helper — the measured boxes came out as centre + size. */
function box(cx: number, cy: number, w: number, h: number): HitBox {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export const MANIFEST: readonly AssetSpec[] = [
  // ---- backgrounds -----------------------------------------------------
  {
    key: 'bg.menu',
    path: 'assets/bg/menu.png',
    kind: 'bg',
    w: 1920,
    h: 1080,
    layer: true,
    purpose: 'Title backdrop — orange field, teal frame, corner ornaments, instrument silhouettes and the THAI FOLK BEAT logo, all baked in',
  },
  {
    key: 'bg.region',
    path: 'assets/bg/region.png',
    kind: 'bg',
    w: 1920,
    h: 1080,
    layer: true,
    purpose: 'Region-select backdrop — same frame plus the wooden panel and the เลือกภูมิภาค heading, baked in',
  },
  {
    key: 'bg.menuFrame',
    path: 'assets/bg/menu_frame.png',
    kind: 'bg',
    w: 1920,
    h: 1080,
    layer: true,
    purpose: 'Frame + instrument silhouettes with the panel and heading removed — shared backdrop for Settings / SongSelect / Result (derived from bg/region.png)',
  },
  {
    key: 'bg.gameplay',
    path: 'assets/bg/gameplay.png',
    kind: 'bg',
    w: 3840,
    h: 2160,
    purpose: 'Backdrop behind the note highway (not yet delivered)',
  },

  // ---- characters ------------------------------------------------------
  {
    key: 'char.performer.idle',
    path: 'assets/characters/performer_idle.png',
    kind: 'character',
    w: 1400,
    h: 2400,
    purpose: 'Performer standing, for the Title bob/sway loop (not yet delivered)',
  },
  {
    key: 'char.performer.play',
    path: 'assets/characters/performer_play.png',
    kind: 'character',
    w: 1400,
    h: 2400,
    purpose: 'Performer mid-play, behind the lanes during gameplay (not yet delivered)',
  },

  // ---- region select: 2x2 grid of full-canvas layers -------------------
  {
    key: 'ui.region.north',
    path: 'assets/ui/region_north.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(796, 380, 224, 224),
    purpose: 'ภาคเหนือ disc, top-left of the 2x2 grid (disabled in this build)',
  },
  {
    key: 'ui.region.isan',
    path: 'assets/ui/region_isan.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(1119, 378, 224, 224),
    purpose: 'ภาคอีสาน disc (ผีตาโขน mask), top-right — the only enabled region',
  },
  {
    key: 'ui.region.central',
    path: 'assets/ui/region_central.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(798, 626, 224, 224),
    purpose: 'ภาคกลาง disc, bottom-left (disabled in this build)',
  },
  {
    key: 'ui.region.south',
    path: 'assets/ui/region_south.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(1122, 626, 224, 224),
    purpose: 'ภาคใต้ disc, bottom-right (disabled in this build)',
  },

  {
    key: 'ui.region.isanSelected',
    path: 'assets/ui/region_isan_selected.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    purpose: 'อีสาน in its SELECTED state — filled disc plus the อีสาน name plate. Drawn over the unselected disc; this is how the designer indicates selection (not a ring)',
  },

  // ---- Title screen signs, Thai labels baked in ------------------------
  {
    key: 'ui.btn.play',
    path: 'assets/ui/btn_play.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(1437, 238, 498, 231),
    purpose: 'เริ่มเกม sign (Title, top)',
  },
  {
    key: 'ui.btn.setting',
    path: 'assets/ui/btn_setting.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(1438, 541, 501, 231),
    purpose: 'ตั้งค่า sign (Title, middle)',
  },
  {
    key: 'ui.btn.exit',
    path: 'assets/ui/btn_exit.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(1449, 834, 492, 228),
    purpose: 'ออกเกม sign (Title, bottom)',
  },

  // ---- shared nav buttons ---------------------------------------------
  {
    key: 'ui.btn.back',
    path: 'assets/ui/btn_back.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(430, 878, 348, 164),
    purpose: 'Wooden BACK sign, bottom-left',
  },
  {
    key: 'ui.btn.next',
    path: 'assets/ui/btn_next.png',
    kind: 'ui',
    w: 1920,
    h: 1080,
    layer: true,
    hit: box(1491, 884, 350, 164),
    purpose: 'Wooden NEXT sign, bottom-right',
  },

  // ---- comic panels: 4 per song (spec §5.5) ----------------------------
  ...([1, 2, 3, 4] as const).flatMap((n) => [
    {
      key: `comic.molam.${n}`,
      path: `assets/comic/molam_${n}.png`,
      kind: 'comic' as const,
      w: 2560,
      h: 1440,
      purpose: `หมอลำ origin comic, panel ${n} of 4 (not yet delivered)`,
    },
    {
      key: `comic.soeng.${n}`,
      path: `assets/comic/soeng_${n}.png`,
      kind: 'comic' as const,
      w: 2560,
      h: 1440,
      purpose: `เซิ้ง origin comic, panel ${n} of 4 (not yet delivered)`,
    },
  ]),
];

export function specOf(key: string): AssetSpec | undefined {
  return MANIFEST.find((a) => a.key === key);
}

export function specsOfKind(kind: AssetKind): readonly AssetSpec[] {
  return MANIFEST.filter((a) => a.kind === kind);
}
