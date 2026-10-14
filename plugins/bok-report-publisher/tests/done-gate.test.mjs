import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const gate = path.join(path.dirname(fileURLToPath(import.meta.url)), '../scripts/done-gate.mjs');
const run = (files, args) => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bok-gate-'));
 for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
 const r = spawnSync(process.execPath, [gate, ...args.flatMap(([k, f]) => [k, path.join(dir, f)])], {encoding: 'utf8'});
 return {code: r.status, out: JSON.parse(r.stdout)};
};
const full = '원본 요소 대조 ok\n형제 전수 0건\n폭 1440 1024 768 390 360\n기준 출처 3월 실측\n범위 develop abc\n착지 feature→develop\n';
test('complete evidence, measured audits and no feature failures pass', () => {
 const r = run({'e.md': full, 'a.json': [{audit: 'bar-gap', measured: 40, defects: 0}], 'f.json': [{status: 'pass', chart: 'c', width: 1440, checks: []}]},
  [['--evidence', 'e.md'], ['--audits', 'a.json'], ['--figure-check', 'f.json']]);
 assert.equal(r.code, 0, JSON.stringify(r.out));
});
test('missing width, zero-measured audit and feature failure each block "done"', () => {
 const r = run({'e.md': full.replace(' 360', ''), 'a.json': {audits: [{audit: 'legend', measured: 0, defects: 0}]},
  'f.json': [{status: 'fail', chart: 'c', width: 390, checks: [{feature: 'y축 눈금', status: 'fail'}]}]},
  [['--evidence', 'e.md'], ['--audits', 'a.json'], ['--figure-check', 'f.json']]);
 assert.equal(r.code, 1);
 const text = r.out.problems.join('\n');
 assert.match(text, /폭 360/); assert.match(text, /측정 0건/); assert.match(text, /y축 눈금/);
});
