/**
 * Dev tool (not part of the build). Reports chart statistics and flags notes
 * that are too close together for the ±90ms judgement window to separate.
 * Run: npm run chart
 */
import { MOLAM } from '../src/audio/songs/molam';
import { SOENG } from '../src/audio/songs/soeng';
import { buildChart, secondsPerBar, songDuration } from '../src/game/Chart';
import type { SongDef } from '../src/audio/types';

const GOOD_WINDOW_MS = 90;

function report(song: SongDef): void {
  const chart = buildChart(song);
  const dur = songDuration(song);
  const bar = secondsPerBar(song.bpm);

  const perLane = [0, 0, 0, 0];
  for (const n of chart) perLane[n.lane]++;

  // Closest pair within a single lane — below 2x the GOOD window, one press
  // could plausibly be judged against either note.
  let worstLaneGap = Infinity;
  let worstAt = '';
  for (let lane = 0; lane < 4; lane++) {
    const times = chart.filter((n) => n.lane === lane).map((n) => n.time);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap < worstLaneGap) {
        worstLaneGap = gap;
        worstAt = `lane ${lane} @ ${times[i - 1].toFixed(3)}s`;
      }
    }
  }

  const lastNote = chart.length ? chart[chart.length - 1].time : 0;
  const maxBar = Math.max(...song.events.map((e) => e.bar));

  console.log(`\n=== ${song.titleTh} (${song.id}) ===`);
  console.log(`  bpm ${song.bpm}   bars ${song.bars}   bar length ${bar.toFixed(3)}s`);
  console.log(`  duration        ${dur.toFixed(2)}s  (last note ${lastNote.toFixed(2)}s)`);
  console.log(`  notes           ${chart.length}   (${(chart.length / dur).toFixed(2)}/s)`);
  console.log(`  per lane        กลอง ${perLane[0]}  โปงลาง ${perLane[1]}  พิณ ${perLane[2]}  แคน ${perLane[3]}`);
  console.log(`  tightest same-lane gap  ${(worstLaneGap * 1000).toFixed(0)}ms  (${worstAt})`);

  const problems: string[] = [];
  if (maxBar >= song.bars) problems.push(`event in bar ${maxBar} but song declares ${song.bars} bars`);
  if (worstLaneGap * 1000 < GOOD_WINDOW_MS * 2)
    problems.push(`same-lane gap ${(worstLaneGap * 1000).toFixed(0)}ms < 2x GOOD window (${GOOD_WINDOW_MS * 2}ms) — ambiguous judgement`);
  if (song.events.some((e) => e.bar < 2)) problems.push('note before bar 2 — violates the 2-bar lead-in');

  console.log(problems.length ? `  PROBLEMS:\n${problems.map((p) => '    - ' + p).join('\n')}` : '  checks: OK');
}

report(MOLAM);
report(SOENG);
console.log('');
