/**
 * Publishes dist/ to the `gh-pages` branch, which GitHub Pages serves.
 *
 * Run: npm run deploy
 *
 * Why a branch rather than a GitHub Actions workflow: pushing a file under
 * .github/workflows/ requires the `workflow` OAuth scope, which the CLI token on
 * this machine does not have. Deploying the built output directly needs only
 * `repo`, and gives the same result.
 *
 * The branch is rebuilt from scratch each time (orphan commit) so old assets
 * never linger and the published tree always matches dist/ exactly.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const BRANCH = 'gh-pages';

function git(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing — run `npm run build` first.');
  process.exit(1);
}

const worktree = mkdtempSync(join(tmpdir(), 'tfb-pages-'));

try {
  console.log(`preparing ${BRANCH} in ${worktree}`);
  git(['worktree', 'add', '--detach', worktree, 'HEAD']);

  // Orphan: the published branch shares no history with main, so the repo does
  // not carry a second copy of every source file.
  git(['checkout', '--orphan', BRANCH], worktree);
  git(['rm', '-rf', '--quiet', '.'], worktree);

  cpSync(DIST, worktree, { recursive: true });

  // Stops GitHub running Jekyll over the output, which would drop any path
  // beginning with an underscore.
  writeFileSync(join(worktree, '.nojekyll'), '');

  git(['add', '-A'], worktree);

  const stamp = git(['log', '-1', '--format=%h %s']);
  git(['commit', '--quiet', '-m', `deploy: ${stamp}`], worktree);
  git(['push', '--force', '--quiet', 'origin', `${BRANCH}:${BRANCH}`], worktree);

  const url = git(['remote', 'get-url', 'origin'])
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '');
  const [owner, repo] = url.split('/');
  console.log(`\npublished to ${BRANCH}`);
  console.log(`https://${owner.toLowerCase()}.github.io/${repo}/`);
} finally {
  try {
    git(['worktree', 'remove', '--force', worktree]);
  } catch {
    rmSync(worktree, { recursive: true, force: true });
  }
}
