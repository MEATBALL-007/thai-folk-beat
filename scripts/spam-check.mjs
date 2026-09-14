/**
 * Proves that mashing the keys does NOT beat the game.
 *
 * Unlike scripts/playthrough.mjs this runs fine on a host with no GPU: mashing
 * needs no timing precision, so the throttled timers that make an accurate
 * playthrough impossible here do not matter. It is the one end-to-end check
 * this machine can actually run.
 *
 * Two runs, same song:
 *   SPAM    — hold nothing back, press all four lanes as fast as the page will
 *             let it. Must FAIL, and must report a poor accuracy.
 *   HONEST  — press each note once, at its charted time. Must NOT fail, and
 *             must report far better accuracy than the spammer.
 *
 * The honest run is the important half: a rule that stops spam by being harsh
 * enough to stop everyone is not a fix.
 *
 * It cannot be judged on whether it SURVIVES, though — this host's timers fire
 * every ~267 ms (see the note in playthrough.mjs), so even perfectly-intended
 * presses land outside the ±90 ms window and the run dies to the pre-existing
 * four-consecutive-miss rule. What is measurable here, and what actually
 * matters, is WHY each run ends: mashing must die to the stray-debt rule this
 * check exists for, and honest play must never come close to it.
 *
 * Run: npm run spam-check
 */
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9777;
const ORIGIN = 'http://localhost:5173';
/** Must stay in step with FAIL_STRAY_DEBT in src/game/ScoreSystem.ts. */
const FAIL_STRAY_DEBT = 30;

let msgId = 0;
function send(ws, method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (m.error) reject(new Error(`${method}: ${m.error.message}`));
      else resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    setTimeout(() => reject(new Error(`${method} timed out`)), 240000);
  });
}

async function evaluate(ws, expression) {
  const r = await send(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'threw');
  return r.result.value;
}

/** Mash every lane as fast as the page allows, for `seconds`. */
const SPAM = (seconds) => `
new Promise((resolve) => {
  const CODES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  const end = performance.now() + ${seconds} * 1000;
  const h = setInterval(() => {
    for (const code of CODES) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    }
    if (performance.now() > end || window.__tfbState().finished) {
      clearInterval(h);
      resolve(window.__tfbState());
    }
  }, 1);
})`;

/** Press each charted note once, at its own time. */
const HONEST = (seconds) => `
new Promise((resolve) => {
  const chart = window.__tfbChart.slice().sort((a, b) => a.t - b.t);
  const CODES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  let i = 0;
  const end = performance.now() + ${seconds} * 1000;
  const h = setInterval(() => {
    const now = window.__tfbNow();
    while (i < chart.length && chart[i].t <= now) {
      const code = CODES[chart[i].lane];
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      i++;
    }
    if (performance.now() > end || window.__tfbState().finished) {
      clearInterval(h);
      resolve(window.__tfbState());
    }
  }, 5);
})`;

async function run(ws, label, script, seconds) {
  await send(ws, 'Page.navigate', { url: `${ORIGIN}/?scene=game` });
  await evaluate(
    ws,
    `new Promise((r, x) => { let n = 0; const w = () =>
       window.__tfbState ? r(1) : (++n > 1400 ? x(new Error('scene never mounted')) : setTimeout(w, 150)); w(); })`,
  );
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send(ws, 'Input.dispatchMouseEvent', {
      type,
      x: 640,
      y: 360,
      button: 'left',
      clickCount: 1,
    });
  }
  await evaluate(
    ws,
    `new Promise((r) => { const w = () => window.__tfbState().running ? r(1) : setTimeout(w, 100); w(); })`,
  );

  const st = await evaluate(ws, script(seconds));
  const hits = st.perfect + st.good;
  const acc = hits + st.strays > 0 ? (hits / (hits + st.strays)) * 100 : 0;

  console.log(`\n=== ${label} ===`);
  console.log(`  hits ${hits}   strays ${st.strays}   miss ${st.miss}`);
  console.log(`  accuracy ${acc.toFixed(1)}%   score ${st.score}   ended: ${st.finished}`);
  console.log(`  stray debt ${st.strayDebt} / ${FAIL_STRAY_DEBT}   consecutive misses ${st.consecutiveMisses}`);
  return { ...st, hits, acc };
}

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'ignore' });
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}/tfb-spam-${process.pid}`,
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--no-first-run',
    '--window-size=1280,720',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let failures = 0;
try {
  for (let i = 0; i < 160; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) break;
    } catch {
      /* not up */
    }
    await sleep(250);
  }
  let wsUrl;
  for (let i = 0; i < 60; i++) {
    try {
      const t = (await (await fetch(`http://localhost:${PORT}/json/list`)).json()).filter(
        (x) => x.type === 'page',
      );
      if (t.length) {
        wsUrl = t[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      /* not up */
    }
    await sleep(250);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');

  const spam = await run(ws, 'SPAM', SPAM, 25);
  const honest = await run(ws, 'HONEST', HONEST, 25);

  const expect = (label, ok) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) failures++;
  };

  console.log('\n[verdict]');
  expect('mashing ends the run', spam.finished === true);
  expect('mashing reports poor accuracy (<60%)', spam.acc < 60);
  expect('mashing dies to the stray-debt rule', spam.strayDebt >= FAIL_STRAY_DEBT);
  // The honest run cannot be asked to survive on this host (see the header),
  // but it must never be the stray rule that ends it.
  expect('honest play never approaches the stray debt', honest.strayDebt < FAIL_STRAY_DEBT / 3);
  expect('honest play wastes far fewer presses', honest.strays < spam.strays / 3);
} finally {
  for (const p of [vite, chrome]) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  }
}

console.log(failures ? `\n${failures} check(s) FAILED\n` : '\nspam is not a winning strategy\n');
process.exit(failures ? 1 : 0);
