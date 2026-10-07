// Land an agent branch: agent/* -> feature -> develop, with conflict dry-run, build and dirty-worktree audit.
// usage: node land.mjs --repo <repo> --branch agent/x [--feature feature] [--develop develop] [--build "npm run build"] [--dry-run]
// Never pushes develop directly from an agent branch, never force-pushes, never touches other worktrees' files.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const repo = path.resolve(arg('--repo', '.')), branch = arg('--branch');
const feature = arg('--feature', 'feature'), develop = arg('--develop', 'develop'), build = arg('--build');
const dry = process.argv.includes('--dry-run');
if (!branch) throw Error('--branch is required');
class Done extends Error {}
process.on('uncaughtException', (e) => { if (!(e instanceof Done)) { console.error(e.stderr?.toString() || e.message); process.exitCode = 1; } });
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const ok = (args, cwd) => { try { git(args, cwd); return true; } catch { return false; } };
const report = { branch, feature, develop, steps: [] }, step = (name, detail) => { report.steps.push({ name, ...detail }); console.error(`- ${name}`); };

git(['fetch', '-q', 'origin']);
if (!branch.startsWith('agent/')) step('warning', { note: 'branch is not agent/*; landing order is agent -> feature -> develop' });
const start = { feature: git(['rev-parse', `origin/${feature}`]), develop: git(['rev-parse', `origin/${develop}`]) };
const incoming = git(['log', '--oneline', `origin/${feature}..origin/${branch}`]).split('\n').filter(Boolean);
step('incoming commits', { count: incoming.length, commits: incoming });
// Uncommitted changes anywhere in the fleet are reported, never silently left behind or swept in.
const dirty = git(['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9))
  .map((w) => ({ worktree: w, changes: ok(['status', '--porcelain'], w) ? git(['status', '--porcelain'], w).split('\n').filter(Boolean).length : null }))
  .filter((w) => w.changes);
step('uncommitted changes in worktrees', { dirty });
const conflict = (a, b) => !ok(['merge-tree', '--write-tree', a, b]);
if (conflict(`origin/${feature}`, `origin/${branch}`)) { step('conflict', { between: [feature, branch] }); finish(2); }
if (!ok(['merge-base', '--is-ancestor', `origin/${feature}`, `origin/${develop}`])) step('warning', { note: `${feature} is not contained in ${develop}; develop has extra history` });
if (dry) { step('dry-run', { note: 'no merge, no push' }); finish(0); }

// Merge in a throw-away worktree so no session's checkout is switched or overwritten.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bok-land-'));
const modules = path.join(repo, 'node_modules');
try {
  git(['worktree', 'add', '-q', '--detach', tmp, `origin/${feature}`]);
  if (build && fs.existsSync(modules)) fs.symlinkSync(modules, path.join(tmp, 'node_modules'), 'junction');
  const run = (label) => { if (!build) return; execFileSync(build, { cwd: tmp, shell: true, stdio: 'ignore' }); step(`build ${label}`, { command: build, result: 'pass' }); };
  git(['merge', '-q', '--no-ff', `origin/${branch}`, '-m', `Merge branch '${branch}' into ${feature}`], tmp);
  run(feature);
  git(['fetch', '-q', 'origin']);
  if (git(['rev-parse', `origin/${feature}`]) !== start.feature) { step('stopped', { note: `${feature} moved during landing; re-run` }); finish(3); }
  git(['push', '-q', 'origin', `HEAD:${feature}`], tmp);
  step('pushed feature', { commit: git(['rev-parse', '--short', 'HEAD'], tmp) });
  git(['fetch', '-q', 'origin']);
  if (conflict(`origin/${develop}`, `origin/${feature}`)) { step('conflict', { between: [develop, feature] }); finish(2); }
  git(['checkout', '-q', '--detach', `origin/${develop}`], tmp);
  git(['merge', '-q', '--no-ff', `origin/${feature}`, '-m', `Merge branch '${feature}' into ${develop}`], tmp);
  run(develop);
  if (git(['rev-parse', `origin/${develop}`]) !== start.develop) { step('stopped', { note: `${develop} moved during landing; re-run` }); finish(3); }
  git(['push', '-q', 'origin', `HEAD:${develop}`], tmp);
  git(['fetch', '-q', 'origin']);
  step('pushed develop', { commit: git(['rev-parse', '--short', `origin/${develop}`]),
    featureContained: ok(['merge-base', '--is-ancestor', `origin/${feature}`, `origin/${develop}`]) });
  finish(0);
} finally {
  // Unlink the junction first: removing the worktree recursively must never delete the repo's node_modules.
  const link = path.join(tmp, 'node_modules');
  if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
  if (ok(['worktree', 'remove', '--force', tmp])) step('cleanup', { removed: tmp });
}

// finish() throws instead of process.exit so the finally block above always cleans up.
function finish(code) {
  console.log(JSON.stringify(report, null, 1));
  process.exitCode = code;
  throw new Done();
}
