// Run: node tests/browser-template-smoke.mjs <directory containing node_modules/@playwright/test>
// Uses synthetic HTML to validate the template, not a real BOK site.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dependencyRoot = path.resolve(process.argv[2]);
const cli = path.join(dependencyRoot, 'node_modules/@playwright/test/cli.js');
assert.ok(fs.existsSync(cli), 'Install @playwright/test in the supplied directory first');
const root = fs.mkdtempSync(path.join(dependencyRoot, 'bok-browser-smoke-'));
const assets = fileURLToPath(new URL('../assets/browser-tests/', import.meta.url));
for (const name of ['report.spec.mjs', 'playwright.config.mjs']) fs.copyFileSync(path.join(assets, name), path.join(root, name));
const fixture = '<!doctype html><meta charset="utf-8"><style>body{margin:0}#panel{position:fixed;top:20px;left:10px;max-width:90vw;background:white;z-index:2}svg{width:100%;height:180px}</style><main id="report"><button id="trigger" onclick="document.querySelector(\'#panel\').hidden=false">1)</button><aside id="panel" hidden><p id="content">인도 총고정자본형성 4.9 → 8.4</p><button id="close" onclick="document.querySelector(\'#panel\').hidden=true">닫기</button></aside><div id="chart"><svg><text x="10" y="20">(%)</text><path d="M 20 50 L 120 100" stroke="blue"/></svg></div></main>';
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const config = { route: '/', readySelector: '#report', notes: [{ id: 'note-1', trigger: '#trigger', panel: '#panel', content: '#content', close: '#close', text: '인도 총고정자본형성 4.9 → 8.4' }], charts: [{ id: 'chart-1', selector: '#chart', readySelector: 'path', labels: [{ selector: 'text', text: '(%)' }] }] };
const write = () => fs.writeFileSync(path.join(root, 'report-cases.json'), JSON.stringify(config));
async function run(extra = []) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', '--config', path.join(root, 'playwright.config.mjs'), '--workers=1', ...extra], {
      env: { ...process.env, BOK_BASE_URL: `http://127.0.0.1:${server.address().port}`, BOK_BROWSER_CHANNEL: process.env.BOK_BROWSER_CHANNEL || 'msedge', BOK_VISUAL_REGRESSION: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = ''; child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, log }));
  });
}
try {
  write();
  const good = await run(); assert.equal(good.code, 0, good.log);
  config.notes[0].text = 'WRONG SOURCE NOTE'; write();
  const bad = await run(['--project=mobile']);
  assert.notEqual(bad.code, 0, 'Wrong source note must fail');
  assert.match(bad.log, /WRONG SOURCE NOTE/);
  config.notes[0].text = '인도 총고정자본형성 4.9 → 8.4'; write();
  const restored = await run(['--project=mobile']); assert.equal(restored.code, 0, restored.log);
  console.log('PASS: four viewport projects, wrong-note rejection, restored passing note. Evidence: ' + root);
} finally { await new Promise(resolve => server.close(resolve)); }
