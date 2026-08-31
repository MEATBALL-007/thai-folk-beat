/**
 * Palette from the designer's animation reference (spec §6).
 * Every colour in the game comes from here — no ad-hoc hex literals in scenes.
 */
export const C = {
  cream: 0xf2e6c8, // background
  ink: 0x2a241c, // text, outlines
  olive: 0x8a8459, // idle receptor fill
  green: 0x37c24b, // lane 0/2 active, PERFECT
  gold: 0xd4a72c, // lane 1/3 active, GOOD
  red: 0xc0392b, // MISS, fail
  paper: 0xfff8e7, // panels
} as const;

/**
 * One family for the whole game (designer brief, 2026-08-31): MN Steak Mu
 * Phrikthai Dam. Display and body differ by size, not by family, because the
 * face ships Regular and Italic only.
 *
 * Coverage was verified against every Thai string the game renders before the
 * swap — the cmap was parsed directly rather than trusted. Thai is complete;
 * eight decorative characters are NOT in the face and are drawn as Graphics
 * instead (src/ui/glyphs.ts).
 */
export const FONT = {
  display: 'Phrikthai Dam',
  body: 'Phrikthai Dam',
} as const;

/**
 * The delivered art direction (added 2026-08-24 when the designer's real PNGs
 * arrived). Sampled directly out of Menu/พื้นหลัง.png rather than eyeballed.
 *
 * NOTE: this does NOT match the palette in spec §6, which was taken from an
 * earlier animation reference. The shipped art wins for menu screens; gameplay
 * still uses `C` because no gameplay art has been delivered. See NOTES.md D24.
 */
export const ART = {
  field: 0xffc976, // dominant orange background
  fieldWarm: 0xf4b262, // darker orange, halos/shadow
  teal: 0x2dad9c, // frame line + logo
  tealLight: 0x4ab594,
  tealDark: 0x289b8c,
  pale: 0xf6fbc7, // logo edge / highlight
  wood: 0x995520, // wooden sign outline + label text
  woodFill: 0xffd08a, // sign face, a touch lighter than the field
  discFill: 0xffdda8, // region button disc
  discRing: 0xf16436, // region button ring + mask ink
} as const;
