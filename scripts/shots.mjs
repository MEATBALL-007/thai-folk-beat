/**
 * Screenshots every scene, over CDP.
 *
 * Unlike scripts/playthrough.mjs this works fine on a machine without a GPU:
 * software rendering is slow but correct, and a still frame needs no timing
 * precision. It is the only way to actually look at a scene from here.
 *
 * Run: node scripts/shots.mjs [outDir]
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9555;
const ORIGIN = 'http://localhost:5173';

/**
 * Deep links from goDevScene. `wait` is time to settle AFTER the app has booted
 * — boot itself takes ~16s under software rendering and is waited for
 * separately, because a fixed delay just photographs the boot loader.
 */
const SCENES = [
  { name: 'title', wait: 1500 },
  { name: 'region', wait: 1500 },
  { name: 'song', wait: 1500 },
  { name: 'comic', wait: 1500 },
  { name: 'game', wait: 1000, click: true },
  { name: 'game-soeng', link: 'game:soeng', wait: 1000, click: true },
  { name: 'result', wait: 2500 },
  { name: 'loading', wait: 3000 },
  { name: 'settings', wait: 1500 },
];

/** Boot is done once the app has replaced its own loading screen. */
const BOOTED = `new Promise((r, x) => {
  let n = 0;
  const w = () => window.__tfbBooted ? r(1)
    : (++n > 1400 ? x(new Error('app never finished booting')) : setTimeout(w, 150));
  w();
})`;

const only = process.env.TFB_SCENES?.split(',').map((s) => s.trim()).filter(Boolean);
const wanted = only ? SCENES.filter((s) => only.includes(s.name)) : SCENES;

const outDir = process.argv[2] ?? 'tmp/shots';
mkdirSync(outDir, { recursive: true });

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

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'ignore' });
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}/tfb-shots-${process.pid}`,
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--hide-scrollbars',
    '--no-first-run',
    '--window-size=1280,720',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

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
      const targets = (await (await fetch(`http://localhost:${PORT}/json/list`)).json()).filter(
        (t) => t.type === 'page',
      );
      if (targets.length) {
        wsUrl = targets[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      /* not up */
    }
    await sleep(250);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  const problems = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') {
      problems.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? ''));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      problems.push('ERR ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');

  for (const scene of wanted) {
    await send(ws, 'Page.navigate', { url: `${ORIGIN}/?scene=${scene.link ?? scene.name}` });
    const booted = await send(ws, 'Runtime.evaluate', {
      expression: BOOTED,
      awaitPromise: true,
      returnByValue: true,
    });
    if (booted.exceptionDetails) {
      console.log(`  ${scene.name}: SKIPPED — ${booted.exceptionDetails.exception?.description}`);
      continue;
    }
    await sleep(scene.wait);

    if (scene.click) {
      // GameplayScene.onEnter awaits a ~2MB mp3 decode, so the start overlay
      // does not exist yet when boot finishes. Clicking before it is there hits
      // nothing and the shot comes back showing the overlay.
      await send(ws, 'Runtime.evaluate', {
        expression: `new Promise((r) => { const w = () => window.__tfbState ? r(1) : setTimeout(w, 200); w(); })`,
        awaitPromise: true,
        returnByValue: true,
      });
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send(ws, 'Input.dispatchMouseEvent', {
          type,
          x: 640,
          y: 360,
          button: 'left',
          clickCount: 1,
        });
      }
      // Long enough for notes to be falling, short enough that the four
      // consecutive misses that end an unplayed run have not landed yet — the
      // first note is at ~4.7s and nothing here presses any keys.
      await sleep(3200);
    }

    const { data } = await send(ws, 'Page.captureScreenshot', { format: 'png' });
    const file = join(outDir, `${scene.name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`  ${file}`);
  }

  console.log(problems.length ? `\n${problems.length} console problem(s):` : '\nno console errors');
  for (const p of problems.slice(0, 10)) console.log('    ' + p);
} finally {
  for (const p of [vite, chrome]) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  }
}
