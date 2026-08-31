/**
 * Headless end-to-end playthrough, over the Chrome DevTools Protocol.
 *
 * This is the one check that cannot be faked by reasoning about the code: it
 * plays a whole song in a real browser, with the real AudioContext clock, and
 * presses every note at a FIXED lead. Because the lead never adapts, any
 * accumulating drift between the chart and the audio clock pushes later presses
 * outside the +-90ms GOOD window — so a clean run across 90 seconds is positive
 * evidence of sync, not just an absence of errors.
 *
 * Node's global WebSocket drives CDP directly; there is no browser-automation
 * dependency to install.
 *
 * REQUIRES A HOST WITH A GPU. Measured on this build machine (no GPU, Chrome
 * falling back to SwiftShader): Pixi spends ~150ms software-rasterising each
 * 1920x1080 frame, which starves the page's timers -- a setInterval(5) actually
 * fires every 267ms (median). A harness cannot place a press inside the +-90ms
 * GOOD window when it only gets the CPU every quarter second, so a run here
 * reports misses that say nothing about the game. The game itself behaves
 * correctly under those conditions: it judges the late presses as misses.
 *
 * So: a FAILING run on a GPU-less host is not evidence of a defect. Check the
 * reported press delta first -- if its median is tens of ms, the accuracy figure
 * is meaningful; if it is hundreds, the harness is the bottleneck and the run
 * should be repeated somewhere with hardware acceleration.
 *
 * Run: npm run playthrough            (both songs)
 *      npm run playthrough -- molam   (one song)
 */
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9222;
const ORIGIN = 'http://localhost:5173';
/**
 * Offset applied to every press, in ms. The value matters less than the fact
 * that it is FIXED: it never adapts to what the game reports, so any drift
 * between the chart and the audio clock walks the presses out of the +-90ms
 * window and the accuracy figure collapses.
 *
 * Zero rather than a deliberate lead, because this runs under software
 * rendering where timer jitter is tens of ms; aiming at the centre of the
 * window leaves that jitter room to be absorbed, so what the run measures is
 * drift rather than the harness's own scheduling noise.
 */
const LEAD_MS = 0;

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
    setTimeout(() => reject(new Error(`${method} timed out`)), 120000);
  });
}

async function evaluate(ws, expression, awaitPromise = true) {
  const r = await send(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate threw');
  }
  return r.result.value;
}

async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/list`);
      const pages = (await res.json()).filter((t) => t.type === 'page');
      if (pages.length) return pages[0].webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging target');
}

async function waitForServer() {
  for (let i = 0; i < 160; i++) {
    try {
      const r = await fetch(ORIGIN);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('vite dev server did not start');
}

/**
 * Runs inside the page: presses every charted note at a fixed lead, driven by
 * the game's own song clock rather than by wall time.
 */
const AUTOPLAY = (leadMs) => `
new Promise((resolve) => {
  const chart = window.__tfbChart.slice().sort((a, b) => a.t - b.t);
  const CODES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  let i = 0;
  const deltas = [];
  const lead = ${leadMs} / 1000;

  // A 5ms interval, not requestAnimationFrame: rAF is throttled when the page
  // is treated as backgrounded, and a press arriving a frame late would be
  // judged late. The judge timestamps at dispatch, so this granularity is what
  // the accuracy figure actually measures.
  const tick = () => {
    const now = window.__tfbNow();
    while (i < chart.length && chart[i].t + lead <= now) {
      const code = CODES[chart[i].lane];
      const at = window.__tfbNow();
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      deltas.push(Math.round((at - chart[i].t) * 1000));
      i++;
    }
    const s = window.__tfbState();
    if (s.finished || (i >= chart.length && now > chart[chart.length - 1].t + 2)) {
      clearInterval(h);
      resolve({ ...window.__tfbState(), pressed: i, charted: chart.length, deltas });
    }
  };
  const h = setInterval(tick, 5);
})`;

async function playthrough(ws, song) {
  const errors = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.text ?? 'exception');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  const url = `${ORIGIN}/?scene=game${song === 'soeng' ? ':soeng' : ''}`;
  await send(ws, 'Page.navigate', { url });

  // Boot takes ~15s under software rendering, so wait for the scene's own DEV
  // hooks rather than for a fixed delay.
  await evaluate(
    ws,
    `new Promise((r, x) => {
       let n = 0;
       const w = () => window.__tfbState ? r(1)
         : (++n > 300 ? x(new Error('gameplay scene never mounted')) : setTimeout(w, 200));
       w();
     })`,
  );

  // The scene waits for a gesture before starting, because an AudioContext must
  // be resumed from one.
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
    `new Promise((r) => {
       const w = () => (window.__tfbChart && window.__tfbState && window.__tfbState().running)
         ? r(1) : setTimeout(w, 200);
       w();
     })`,
  );

  const t0 = Date.now();
  const result = await evaluate(ws, AUTOPLAY(LEAD_MS));
  const wall = ((Date.now() - t0) / 1000).toFixed(1);

  const hit = result.perfect + result.good;
  const rate = ((hit / result.charted) * 100).toFixed(1);

  console.log(`\n=== ${song} ===`);
  console.log(`  wall clock      ${wall}s   song time ${result.songTime}s`);
  console.log(`  notes           ${result.charted} charted, ${result.pressed} pressed`);
  console.log(`  judged          ${hit} hit (${rate}%)  perfect ${result.perfect}  good ${result.good}  miss ${result.miss}`);
  console.log(`  score           ${result.score}`);
  const d = result.deltas ?? [];
  if (d.length) {
    const sorted = [...d].sort((a, b) => a - b);
    const mean = (d.reduce((a, b) => a + b, 0) / d.length).toFixed(1);
    console.log(`  press delta     mean ${mean}ms  min ${sorted[0]}  median ${sorted[Math.floor(sorted.length / 2)]}  max ${sorted[sorted.length - 1]}`);
  }
  console.log(`  presses seen by game  ${result.pressesReceived} received, ${result.pressesJudged} judged`);
  console.log(`  console errors  ${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 5).map((e) => `    - ${e}`).join('\n'));

  return { song, rate: +rate, errors: errors.length, result };
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const songs = wanted.length ? wanted : ['molam', 'soeng'];

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
  stdio: 'ignore',
});
const profile = `${process.env.TEMP}/tfb-cdp-${process.pid}`;
const chrome = spawn(
  CHROME,
  [
    ...(process.env.TFB_HEADED ? ['--window-position=-2400,-2400'] : ['--headless=new']),
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required',
    // Software WebGL: there is no GPU on this host, and Pixi needs a context.
    '--enable-unsafe-swiftshader',
    // Headless Chrome treats the page as backgrounded and throttles timers and
    // rAF, which stalls the scene ticker and would make this look like a hang.
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
    '--no-first-run',
    '--window-size=1280,720',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let failed = 0;
try {
  await waitForServer();
  const wsUrl = await cdpTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');

  for (const song of songs) {
    const r = await playthrough(ws, song);
    // A fixed lead cannot absorb drift, so anything below 90% means the chart
    // and the audio clock are pulling apart.
    if (r.rate < 90 || r.errors > 0) failed++;
  }
} finally {
  chrome.kill();
  // /T kills the whole tree. Without it a stray vite keeps the port and every
  // later run fails to start with no obvious cause.
  for (const p of [vite, chrome]) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  }
}

console.log(failed ? `\n${failed} song(s) FAILED\n` : '\nplaythrough OK\n');
process.exit(failed ? 1 : 0);
