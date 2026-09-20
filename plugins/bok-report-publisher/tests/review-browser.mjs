// Usage: node tests/review-browser.mjs <playwright module file> <review URL>
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await page.goto(process.argv[3], { waitUntil: 'domcontentloaded', timeout: 60000 });
  const button = page.locator('[data-bok-review]').first();
  await button.waitFor({ state: 'visible', timeout: 30000 });
  const id = await button.getAttribute('data-bok-review');
  await button.click();
  await page.getByLabel('수정할 내용').fill('검증용 피드백: 라벨 표시 확인');
  await page.getByLabel('확인할 테스트 조건 (한 줄에 하나씩)').fill('375px에서 입력창이 화면 밖으로 넘치지 않음\n번호와 피드백이 보존됨');
  await page.setViewportSize({ width: 375, height: 812 });
  const box = await page.locator('.bok-review-dialog').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 376, 'mobile dialog fits viewport');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '피드백 파일 저장' }).click();
  const download = await pending;
  const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(payload.id, id);
  assert.equal(payload.tests.length, 2);
  assert.equal(payload.context.viewport.width, 375);
  assert.equal(payload.sourceHash.length, 64);
  console.log('PASS: static review build, number button, mobile dialog, download payload', id);
} finally { await browser.close(); }
