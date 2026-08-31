# Design — real recordings, derived charts, and the stage redesign

Date: 2026-08-31
Status: awaiting approval
Supersedes: the in-progress "improved instrument synthesis" direction (see §3)

## 1. What changed

The designer delivered a brief plus an asset drop containing, for the first
time, **real recordings** of the two gameplay songs and a main theme, a complete
visual redesign of the gameplay screen, animated performers, and new loading and
result screens.

This invalidates the assumption the audio engine was built on. Until now the
game *was* its own music: one `PatternEvent[]` compiled to both the synth
schedule and the playable chart, so sync was structural rather than tuned
(NOTES D4). With a recording as the music, that identity no longer holds — the
chart must instead be derived *from* the recording.

The rest of this document is about keeping an equivalent guarantee under the new
arrangement.

## 2. Measurements (already taken, not assumptions)

Tempo was fitted by scanning a fixed (bpm, phase) comb over a 200 Hz onset
envelope, then re-fitting the phase independently in each third of the track to
detect drift.

| song | duration | BPM | downbeat | phase drift across track |
|---|---|---|---|---|
| หมอลำ | 90.65 s | **107.070** | 0.247 s | ≤ 1.2 ms |
| เซิ้ง | 101.10 s | **114.016** | ~0.449 s (see §9) | 0.0 ms |
| main | 143.05 s | ~120 | n/a — menu loop, never charted | n/a |

Both recordings were produced against a click or loop: a single fixed grid
explains the whole track. This is the finding the whole design rests on. Had
either drifted, a fixed-BPM chart would have been impossible and the Conductor
would have needed a per-beat map instead.

For scale: a 0.5% tempo error at 107 BPM accumulates ~450 ms over 90 s, five
times the GOOD window. The measured drift is ~1 ms.

## 3. Where the synthesised instruments go

Decided with the user: **the recording is the music; the synthesised voices
become the hit feedback.**

This keeps the physical-modelling work that was being designed (Karplus–Strong
for พิณ, modal synthesis for โปงลาง) and moves it to the one place the game is
currently silent — `sfxBus` is built and wired to master, but nothing plays
through it during gameplay (Settings previews only). Pressing a lane correctly
makes no sound at all today, which is the single largest game-feel gap.

Rejected: layering melodic synth notes over the recording. The synth would have
to agree with the recording's key and ornamentation, which cannot be verified
mechanically and would sound wrong more often than right.

## 4. Chart derivation

### 4.1 What does not work

Free onset detection per frequency band was tried and **failed**: on this
material only ~42% of detected onsets fell within 70 ms of the eighth grid (a
random time would score 50%), and the distribution across metrical positions was
flat. Isan textures are sustained — the khaen drones, the phin tremolos — so
energy flux fires continuously rather than at note starts.

### 4.2 What does work: grid-first scoring

Invert the question. The grid is already proven stable, so rather than asking
"where are the onsets", ask **"how hard is each grid slot played"**:

1. Split the track into four bands, one per lane
   (กลอง < 180 Hz, โปงลาง 250–900, พิณ 900–2500, แคน > 2500).
2. Compute a log-energy flux envelope per band at 5 ms resolution.
3. For each 16th-note slot on the proven grid, take the peak flux within ±40 ms.
4. Keep the strongest N% of slots per band.

Every note lands exactly on the grid **by construction**, so the sync guarantee
survives the change of music source: notes cannot drift relative to the
recording, because they are defined in terms of the recording's own grid.

Validation on หมอลำ at 20% density reproduced the metrical hierarchy of real
music — beats strongest (56/60/63/54), eighth offbeats next (47/23/32/62),
sixteenths weakest (8–29). A method reading noise cannot produce that shape.

### 4.3 Density is the difficulty dial

Because selection is "take the strongest N%", difficulty falls out of the method
rather than needing separate hand-authored charts:

| | slots kept | approx notes | feel |
|---|---|---|---|
| ง่าย | ~8% | ~110 | beats and strong offbeats only |
| ปกติ | ~20% | ~260 | the groove |
| ยาก | ~32% | ~420 | sixteenth detail |

This also resolves the risk raised earlier in this brainstorm: the teacher will
play this themselves as a complete beginner, and today four consecutive misses
fails the run instantly. ง่าย places notes only where the music is most
obviously accented, which is exactly what a first-time player can hear.

### 4.4 Output, not runtime

Derivation runs **offline as a script**, emitting a chart file that is committed
and reviewed. The game ships fixed charts; it does not analyse audio at runtime.
This keeps load time honest, makes charts hand-editable after generation, and
means a bad chart is a reviewable diff rather than an emergent surprise.

Per slot, keep only the strongest band unless the slot is a downbeat — the raw
selection puts 2+ lanes on 61% of slots, which is unplayable. Chords become
deliberate accents rather than the default.

## 5. Audio playback

`main.mp3` plays from the menu through the comic (looped). Gameplay swaps to the
song's own recording.

The Conductor's contract is unchanged and is what makes this safe: song time is
read from the audio clock, never accumulated from frames. With a recording, the
clock source becomes the `AudioBufferSourceNode`'s start time plus
`AudioContext.currentTime`, which is the same quantity it already uses.

`userOffsetMs` continues to shift the chart only, never the audio (NOTES D18), so
calibration still cannot retune the music.

## 6. Art integration

All new art is full-canvas 1920×1080 RGBA, the format `artLayer.ts` already
composites at (0,0) with measured alpha bounds — no new pipeline.

- **Gameplay** — replaced entirely: a stage (teal proscenium, curtains, wooden
  floor, red apron with Isan motifs) instead of the current wooden board. Four
  lane receptors ship as one combined layer plus four individual lit states, so
  lanes can light independently.
- **Motion** — two loops (solo dancer, 10 frames @ 4 fps; dancing couple, 8
  frames @ 5 fps). Already transparent PNG frames, so **no green-screen keying
  is needed** despite the brief describing them that way. The performers
  translate across the canvas within the loop, so each will be cropped to a tight
  sprite and instanced six times (per the designer's note) at chosen stage
  positions with staggered phase, so they do not dance in lockstep.
- **Loading** — new background, bar, and four instrument icons.
- **Result** — "ผ่าน!" and "พลาด!" panels with the Thai text baked into the art;
  the scene must therefore stop drawing its own heading for those states.
- Menu and region art in the drop is byte-identical to what is already
  installed; seven additional files are new.

## 7. Fonts

Delivered 2026-08-31: **MN Steak Mu Phrikthai Dam** (สเต๊กหมูพริกไทยดำ ชุดพิเศษ),
Regular + Italic, replacing Kanit (display) and Sarabun (body) everywhere.

The cmap and name tables were parsed directly to check coverage before
committing to the swap, because the entire UI is Thai and a display face often
ships an incomplete mark set. Results:

- **Thai coverage is complete** for everything the game renders — consonants,
  base vowels, leading vowels, tone marks, Thai digits. The only unmapped Thai
  codepoint is U+0E4E ยามักการ, which is archaic and unused in modern Thai.
- `GPOS`/`GSUB`/`GDEF` are present, so vowel and tone-mark stacking is properly
  positioned rather than left to fallback.
- ASCII letters and digits are complete, so scores and key labels are safe.

Two consequences that require code changes, not just a family swap:

**7.1 Eight decorative characters are missing** and would render as blank boxes:
`·` (U+00B7) and the arrows and triangles `← ↑ → ↓ ◁ ▷`. These appear in the key
hint line, the settings carousel, and several separators.

`•` (U+2022) *is* mapped and replaces `·` directly. The arrows and triangles will
be **drawn as `Graphics` instead of typed as text** — more robust than depending
on any font's symbol coverage, and a better match for the hand-drawn art than a
glyph would be.

**7.2 There is no bold weight.** The face ships Regular and Italic only, while 31
call sites currently pass `fontWeight: '700'`. That would trigger synthetic bold,
which smears glyphs horizontally and can push tone marks into the consonant
beneath them. The face is already a heavy display weight by design, so
`fontWeight: '700'` is dropped rather than faked.

## 8. Verification

The existing offline-render harness measures exactly the right things and is
reused rather than replaced:

- Chart-to-audio alignment: for each charted note, confirm the recording's band
  energy actually rises there — the inverse of the derivation, so a chart that
  drifted from the music would fail.
- Peak level: `MASTER_HEADROOM` was measured, not guessed (0.5, after the
  limiter-ordering fix). Recordings are already mastered and far louder than the
  synth was, so the summed peak must be re-measured and the headroom re-derived.
- Autoplay playthrough at a fixed lead across the full 90 s and 101 s, as was
  done for the synth build (147/150 at ±90 ms). Any accumulating drift pushes
  later presses outside the window, so a clean run is proof of sync.
- Hit SFX must not mask the music: check the summed peak with a worst-case burst
  of simultaneous hits.

## 9. Open questions

1. **เซิ้ง downbeat.** The metrical histogram is much flatter than หมอลำ's, which
   is musically correct for a processional eighth-driven groove but leaves two
   candidate downbeats one eighth apart (0.449 s / 0.712 s). Settle by ear and by
   isolating the bass band. Does not affect note placement, only bar labelling
   and therefore where chord accents fall.
2. **Loading icon colours.** The brief says the order is เขียว/แดง/เหลือง/ฟ้า, but
   the delivered icons are orange/green/yellow-green/orange-red. Follow the
   delivered art, or tint to the stated order?

Resolved: fonts (§7) — delivered and verified 2026-08-31.
