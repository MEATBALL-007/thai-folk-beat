/**
 * Dev tool (not part of the build). Reports chart statistics and flags notes
 * that are too close together for the ±90ms judgement window to separate.
 *
 * Since the charts became derived rather than hand-authored, this is also the
 * gate on the one failure mode the derivation can still produce: a chart that is
 * technically in sync but too dense, too sparse, or missing a lane entirely.
 *
 * Run: npm run chart
 */
import { MOLAM } from '../src/audio/songs/molam';
import { SOENG } from '../src/audio/songs/soeng';
import { buildChart, secondsPerBar, songDuration } from '../src/game/Chart';
import { DIFFICULTIES } from '../src/game/Difficulty';
import type { SongDef } from '../src/audio/types';

const GOOD_WINDOW_MS = 90;
/** Above this a chart stops being readable at a glance. */
const MAX_NOTES_PER_SEC = 6;

let problemCount = 0;

function report(song: SongDef): void {
  const dur = songDuration(song);
  const bar = secondsPerBar(song.bpm);

  console.log(`\n=== ${song.titleTh} (${song.id}) ===`);
  console.log(`  bpm ${song.bpm}   bars ${song.bars}   bar length ${bar.toFixed(3)}s`);
  console.log(`  grid offset ${song.gridOffsetS}s   duration ${dur.toFixed(2)}s`);
  console.log(`  audio ${song.audioUrl ?? '(synth)'}`);

  for (const difficulty of DIFFICULTIES) {
    const chart = buildChart(song, difficulty);
    const events = song.charts[difficulty];

    const perLane = [0, 0, 0, 0];
    for (const n of chart) perLane[n.lane]++;

    // Closest pair within a single lane — below 2x the GOOD window, one press
    // could plausibly be judged against either note.
    let worstLaneGap = Infinity;
    let worstAt = '';
    for (let lane = 0; lane < 4; lane++) {
      const times = chart.filter((n) => n.lane === lane).map((n) => n.time);
      for (let i = 1; i < times.length; i++) {
        const gap = times[i]! - times[i - 1]!;
        if (gap < worstLaneGap) {
          worstLaneGap = gap;
          worstAt = `lane ${lane} @ ${times[i - 1]!.toFixed(3)}s`;
        }
      }
    }

    const first = chart.length ? chart[0]!.time : 0;
    const last = chart.length ? chart[chart.length - 1]!.time : 0;
    const rate = chart.length / dur;
    const maxBar = Math.max(...events.map((e) => e.bar));

    console.log(`\n  -- ${difficulty} --`);
    console.log(`  notes           ${chart.length}   (${rate.toFixed(2)}/s)`);
    console.log(`  first / last    ${first.toFixed(2)}s / ${last.toFixed(2)}s`);
    console.log(
      `  per lane        กลอง ${perLane[0]}  โปงลาง ${perLane[1]}  พิณ ${perLane[2]}  แคน ${perLane[3]}`,
    );
    console.log(`  tightest gap    ${(worstLaneGap * 1000).toFixed(0)}ms  (${worstAt})`);

    const problems: string[] = [];
    if (maxBar >= song.bars) {
      problems.push(`event in bar ${maxBar} but song declares ${song.bars} bars`);
    }
    if (worstLaneGap * 1000 < GOOD_WINDOW_MS * 2) {
      problems.push(
        `same-lane gap ${(worstLaneGap * 1000).toFixed(0)}ms < 2x GOOD window (${GOOD_WINDOW_MS * 2}ms) — ambiguous judgement`,
      );
    }
    if (rate > MAX_NOTES_PER_SEC) {
      problems.push(`${rate.toFixed(2)} notes/s exceeds the ${MAX_NOTES_PER_SEC}/s readability ceiling`);
    }
    if (perLane.some((n) => n === 0)) {
      problems.push('a lane has no notes at all — the band split found nothing there');
    }
    if (first < 2 * bar) {
      problems.push(`first note at ${first.toFixed(2)}s — inside the 2-bar lead-in (${(2 * bar).toFixed(2)}s)`);
    }

    problemCount += problems.length;
    console.log(
      problems.length ? `  PROBLEMS:\n${problems.map((p) => '    - ' + p).join('\n')}` : '  checks: OK',
    );
  }
}

report(MOLAM);
report(SOENG);
console.log(problemCount ? `\n${problemCount} problem(s) found\n` : '\nno problems\n');
if (problemCount > 0) process.exit(1);
