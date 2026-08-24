/**
 * Minimal static server for the built demo, so the game can be shown without
 * anyone touching a terminal.
 *
 * Node's standard library only — no dependency to install, and it keeps working
 * even if node_modules is deleted. Started by เปิดเกม.bat.
 *
 * A server is required (rather than opening dist/index.html directly) because
 * the bundle is ES modules, which browsers refuse to load over file://.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const START_PORT = Number(process.env.PORT) || 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

    // Contain every request inside dist/ — a static server should never be
    // talked into serving files above its root.
    const filePath = normalize(join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');

    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
});

function listen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error('ไม่สามารถเปิดเซิร์ฟเวอร์ได้:', err.message);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/`;
    console.log('');
    console.log('  THAI FOLK BEAT — เดโม');
    console.log('  ---------------------------------------------');
    console.log(`  เปิดที่ : ${url}`);
    console.log('  ปิดเกม  : ปิดหน้าต่างนี้ หรือกด Ctrl+C');
    console.log('');
    console.log('  * ที่หน้าแรกให้คลิก 1 ครั้งก่อน เสียงจึงจะเล่น');
    console.log('  * ปุ่มเล่น: D F J K หรือปุ่มลูกศร / คลิกที่วงกลมก็ได้');
    console.log('  * กด F11 เพื่อเต็มจอ');
    console.log('');

    // Open the default browser. `start` is a cmd builtin, hence the shell.
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  });
}

listen(START_PORT, 20);
