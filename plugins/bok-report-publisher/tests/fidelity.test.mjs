import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verify, hash } from '../scripts/verify-fidelity.mjs';

test('fidelity rejects changed shared styles and changed chart unit labels', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bok-fidelity-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repo, 'style.css'), 'color: blue');
  fs.writeFileSync(path.join(repo, 'chart.vue'), '<div>단위 (%)</div>');
  const contract = { frozen: { 'style.css': hash('color: blue') },
    components: [{ target: 'chart.vue', sha256: hash('<div>단위 (%)</div>') }] };
  assert.equal(verify(repo, contract).result, 'PASS');
  fs.writeFileSync(path.join(repo, 'chart.vue'), '<div></div>');
  assert.throws(() => verify(repo, contract), /Unreviewed/);
  fs.writeFileSync(path.join(repo, 'style.css'), 'color: red');
  assert.throws(() => verify(repo, contract), /Frozen source changed/);
  assert.throws(() => verify(repo, { frozen: { '../outside': 'x' } }), /Unsafe path/);
});
