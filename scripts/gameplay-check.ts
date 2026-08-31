/**
 * Dev tool (not part of the build, and not a unit-test suite — spec §10 rules
 * those out). This exists to verify the §9 acceptance items that are impossible
 * to hit reliably by hand: exact judgement boundaries, the combo multiplier
 * curve, and the 4-consecutive-miss fail.
 *
 * Run: npm run check
 */
import { Judge, GOOD_MS, PERFECT_MS } from '../src/game/Judge';
import { ScoreSystem, FAIL_CONSECUTIVE_MISSES } from '../src/game/ScoreSystem';
import { buildChart, songDuration, type ChartNote } from '../src/game/Chart';
import type { Lane, SongDef } from '../src/audio/types';

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}\n          expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function note(index: number, time: number, lane: Lane): ChartNote {
  return { index, time, lane, midi: 60, voice: 'klong' };
}

// ---------------------------------------------------------------- judgement

console.log('\n[judgement windows] spec §4.2');
{
  // One note per lane at t=10s, so each sub-case gets a fresh note.
  const chart: ChartNote[] = [
    note(0, 10, 0),
    note(1, 10, 1),
    note(2, 10, 2),
    note(3, 10, 3),
  ];
  const j = new Judge(chart);

  check('dead on -> PERFECT', j.press(0, 10)?.verdict, 'PERFECT');
  check(`+${PERFECT_MS}ms (edge) -> PERFECT`, j.press(1, 10 + PERFECT_MS / 1000)?.verdict, 'PERFECT');
  check(`-${GOOD_MS}ms (edge) -> GOOD`, j.press(2, 10 - GOOD_MS / 1000)?.verdict, 'GOOD');
  check('beyond GOOD -> no note matched', j.press(3, 10 + (GOOD_MS + 5) / 1000), null);
}

{
  const j = new Judge([note(0, 10, 0)]);
  check('press in an empty lane is ignored (no penalty)', j.press(2, 10), null);
  check('press far from any note is ignored', j.press(0, 3), null);
}

{
  // A note may only be judged once.
  const j = new Judge([note(0, 10, 0)]);
  check('first press consumes the note', j.press(0, 10)?.verdict, 'PERFECT');
  check('second press finds nothing', j.press(0, 10), null);
}

{
  // Two notes in one lane: the nearer one must win.
  const j = new Judge([note(0, 10.0, 0), note(1, 10.15, 0)]);
  const hit = j.press(0, 10.13);
  check('nearest note wins when two are in range', hit?.note.index, 1);
}

console.log('\n[auto-miss] spec §4.2');
{
  const j = new Judge([note(0, 10, 0), note(1, 20, 0)]);
  check('nothing missed while still catchable', j.collectMisses(10 + GOOD_MS / 1000).length, 0);
  const misses = j.collectMisses(10 + (GOOD_MS + 1) / 1000);
  check('note past the window is missed', misses.map((m) => m.note.index), [0]);
  check('and is not reported twice', j.collectMisses(15).length, 0);
}

// ------------------------------------------------------------------ scoring

console.log('\n[combo multiplier] spec §4.3');
{
  const s = new ScoreSystem();
  check('starts at x1', s.multiplier, 1);

  for (let i = 0; i < 10; i++) s.apply('PERFECT');
  check('combo 10 -> x2', s.multiplier, 2);

  for (let i = 0; i < 60; i++) s.apply('PERFECT');
  check('combo 70 -> x8', s.multiplier, 8);

  for (let i = 0; i < 50; i++) s.apply('PERFECT');
  check('caps at x8', s.multiplier, 8);

  s.apply('MISS');
  check('miss resets combo to 0', s.combo, 0);
  check('miss resets multiplier to x1', s.multiplier, 1);
  check('max combo is retained', s.maxCombo, 120);
}

console.log('\n[score maths] spec §4.3');
{
  const s = new ScoreSystem();
  // First 10 notes score at x1 (multiplier read before the increment).
  for (let i = 0; i < 10; i++) s.apply('PERFECT');
  check('10 PERFECT at x1 = 1000', s.score, 1000);

  s.apply('PERFECT'); // 11th, now at x2
  check('11th PERFECT scores at x2', s.score, 1200);

  const g = new ScoreSystem();
  g.apply('GOOD');
  check('GOOD is worth 50 at x1', g.score, 50);

  const m = new ScoreSystem();
  m.apply('MISS');
  check('MISS scores nothing', m.score, 0);
}

console.log('\n[fail condition] spec §4.4');
{
  const s = new ScoreSystem();
  for (let i = 0; i < FAIL_CONSECUTIVE_MISSES - 1; i++) s.apply('MISS');
  check(`${FAIL_CONSECUTIVE_MISSES - 1} misses -> still alive`, s.failed, false);
  s.apply('MISS');
  check(`${FAIL_CONSECUTIVE_MISSES} consecutive misses -> failed`, s.failed, true);
}

{
  const s = new ScoreSystem();
  s.apply('MISS');
  s.apply('MISS');
  s.apply('MISS');
  s.apply('GOOD'); // any successful hit resets the counter
  check('a hit resets the consecutive-miss counter', s.consecutiveMisses, 0);
  s.apply('MISS');
  s.apply('MISS');
  s.apply('MISS');
  check('3 more misses after a hit -> still alive', s.failed, false);
}

console.log('\n[accuracy]');
{
  const s = new ScoreSystem();
  s.apply('PERFECT');
  s.apply('GOOD');
  check('1 perfect + 1 good = 75%', Math.round(s.accuracy * 100), 75);
  s.apply('MISS');
  s.apply('MISS');
  check('+2 miss = 37.5%', +(s.accuracy * 100).toFixed(1), 37.5);
}


console.log('');
console.log('[chart derivation] design doc §4');
{
  const fake: SongDef = {
    id: 'molam',
    titleTh: 'x',
    blurbTh: 'x',
    bpm: 120,
    bars: 2,
    gridOffsetS: 0.25,
    charts: {
      easy: [{ bar: 0, beat: 0, lane: 0, voice: 'klong', midi: 60 }],
      normal: [
        { bar: 0, beat: 0, lane: 0, voice: 'klong', midi: 60 },
        { bar: 1, beat: 2, lane: 1, voice: 'phin', midi: 62 },
      ],
      hard: [],
    },
  };

  // The offset is what keeps a chart aligned to a recording that does not
  // begin exactly on beat 1.
  check('grid offset shifts the first note', buildChart(fake, 'easy')[0]?.time, 0.25);
  check('bar 1 beat 2 at 120bpm = offset + 3s', buildChart(fake, 'normal')[1]?.time, 3.25);
  check('difficulty selects its own chart', buildChart(fake, 'normal').length, 2);
  check('songDuration includes the offset', songDuration(fake), 5.75);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
