// node tests/comparison-browser.mjs <directory containing node_modules/@playwright/test>
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseCsv, csvText } from '../assets/comparison-review.mjs';

const dependencies = path.resolve(process.argv[2]);
const { chromium } = await import(pathToFileURL(path.join(dependencies, 'node_modules/playwright/index.mjs')).href);
const root = fs.mkdtempSync(path.join(dependencies, 'csv-review-'));
fs.writeFileSync(path.join(root, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XkAAAAASUVORK5CYII=', 'base64'));
fs.writeFileSync(path.join(root, 'input.json'), JSON.stringify({ items: [
  { id: 'one', title: '차트 하나', reference: 'pixel.png', candidate: 'pixel.png' },
  { id: 'two', title: '추가 차트', reference: 'pixel.png' }
] }));
const generated = spawnSync('python', [fileURLToPath(new URL('../scripts/compare-images.py', import.meta.url)), '--input', path.join(root, 'input.json'), '--out', path.join(root, 'output')], { encoding: 'utf8' });
assert.equal(generated.status, 0, generated.stderr);
const browser = await chromium.launch({ headless: true, channel: process.env.BOK_BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1024, height: 768 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.showOpenFilePicker = undefined; window.showSaveFilePicker = undefined; });
  const url = pathToFileURL(path.join(root, 'output/comparison.html')).href;
  await page.goto(url);
  const review = '차트 1개 → 2개로 증가, "신규" 검토\n추가 계열 확인';
  await page.locator('#review-0').fill(review);
  const downloading = page.waitForEvent('download');
  await page.locator('#apply-review-0').click();
  const download = await downloading;
  const csvPath = path.join(root, 'saved.csv'); await download.saveAs(csvPath);
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  assert.equal(rows[1][2], '100'); assert.equal(rows[1][8], review);
  assert.equal(rows[2][2], ''); assert.equal(rows[2][4], 'pending');
  await page.reload(); assert.equal(await page.locator('#review-0').inputValue(), review);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  assert.equal(await page.locator('#review-0').inputValue(), '');
  await page.locator('#review-csv-file').setInputFiles(csvPath);
  await page.waitForFunction(() => document.getElementById('review-0').value.includes('증가'));
  assert.equal(await page.locator('#review-0').inputValue(), review);
  rows[1][5] = 'different-evidence';
  const badPath = path.join(root, 'wrong.csv'); fs.writeFileSync(badPath, csvText(rows));
  await page.locator('#review-csv-file').setInputFiles(badPath);
  await page.waitForFunction(() => document.getElementById('review-message').textContent.includes('불러오기 실패'));
  assert.equal(await page.locator('#review-0').inputValue(), review);
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  // Mock only the OS picker/file handle to exercise write, overwrite protection and UI outcomes.
  await page.evaluate(() => {
    window.testCsv = '';
    window.showSaveFilePicker = async () => ({
      getFile: async () => new File([window.testCsv], 'review.csv'),
      createWritable: async () => ({ write: async text => { window.testCsv = text; }, close: async () => {}, abort: async () => {} })
    });
  });
  await page.locator('#save-review-csv').click();
  await page.waitForFunction(() => document.getElementById('review-message').textContent.includes('저장하고 연결'));
  await page.locator('#review-1').fill('두 번째 차트 리뷰');
  await page.locator('#apply-review-1').click();
  await page.waitForFunction(() => document.getElementById('review-message').textContent.includes('연결된 CSV에 저장'));
  assert.equal(parseCsv(await page.evaluate(() => window.testCsv))[2][8], '두 번째 차트 리뷰');
  await page.evaluate(() => { window.testCsv = 'externally modified'; });
  await page.locator('#review-1').fill('덮어쓰면 안 됨');
  await page.locator('#apply-review-1').click();
  await page.waitForFunction(() => document.getElementById('review-message').textContent.includes('다른 창이나 프로그램'));
  assert.equal(await page.evaluate(() => window.testCsv), 'externally modified');
  assert.deepEqual(errors, []);
  console.log('PASS: file HTML download, scores, CSV reload, cache recovery, mismatched evidence rejection, mobile layout; mocked file-handle save/conflict. Evidence: ' + root);
} finally { await browser.close(); }
