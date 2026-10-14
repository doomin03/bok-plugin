import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const land = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../scripts/land.mjs');
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' }).trim();

function sandbox(agentLine, featureLine) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bok-land-test-'));
  git(root, 'init', '-q', '--bare', 'remote.git'); git(root, 'clone', '-q', 'remote.git', 'work');
  const work = path.join(root, 'work');
  fs.writeFileSync(path.join(work, 'a.txt'), 'base\n'); git(work, 'add', 'a.txt'); git(work, 'commit', '-q', '-m', 'base');
  git(work, 'push', '-q', 'origin', 'HEAD:develop', 'HEAD:feature');
  git(work, 'checkout', '-q', '-b', 'agent/x'); fs.writeFileSync(path.join(work, 'a.txt'), agentLine);
  git(work, 'commit', '-q', '-am', 'agent'); git(work, 'push', '-q', 'origin', 'agent/x');
  if (featureLine) {  // someone else changed the same line on feature -> conflict
    git(work, 'checkout', '-q', '--detach', 'origin/feature'); fs.writeFileSync(path.join(work, 'a.txt'), featureLine);
    git(work, 'commit', '-q', '-am', 'feature edit'); git(work, 'push', '-q', 'origin', 'HEAD:feature'); git(work, 'checkout', '-q', 'agent/x');
  }
  return work;
}
const run = (work, ...extra) => spawnSync('node', [land, '--repo', work, '--branch', 'agent/x', ...extra], { encoding: 'utf8' });

test('dry-run reports incoming commits and does not push', () => {
  const work = sandbox('agent\n');
  const r = run(work, '--dry-run');
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).steps.find((s) => s.name === 'incoming commits').count, 1);
  assert.equal(git(work, 'rev-parse', 'origin/feature'), git(work, 'rev-parse', 'origin/develop'));
});

test('lands agent -> feature -> develop and cleans the temporary worktree', () => {
  const work = sandbox('agent\n');
  const r = run(work, '--build', 'node -e 0');
  assert.equal(r.status, 0, r.stderr);
  git(work, 'fetch', '-q');
  assert.doesNotThrow(() => git(work, 'merge-base', '--is-ancestor', 'origin/agent/x', 'origin/feature'));
  assert.doesNotThrow(() => git(work, 'merge-base', '--is-ancestor', 'origin/feature', 'origin/develop'));
  assert.equal(git(work, 'worktree', 'list').split('\n').length, 1);
});

test('stops on conflict without pushing', () => {
  const work = sandbox('agent\n', 'other\n');
  const before = git(work, 'rev-parse', 'origin/feature');
  const r = run(work);
  assert.equal(r.status, 2);
  git(work, 'fetch', '-q');
  assert.equal(git(work, 'rev-parse', 'origin/feature'), before);
});
