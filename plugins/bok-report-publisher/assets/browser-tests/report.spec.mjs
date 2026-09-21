import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const cases = JSON.parse(fs.readFileSync(new URL('./report-cases.json', import.meta.url), 'utf8'));
const notes = cases.notes || [], charts = cases.charts || [];
if (!cases.route || !cases.readySelector || !Array.isArray(notes) || !Array.isArray(charts) || !notes.length && !charts.length)
  throw Error('Configure actual route, readySelector and at least one note/chart');
const ids = new Set();
for (const item of [...notes, ...charts]) {
  if (!/^[a-zA-Z0-9_-]+$/.test(item.id) || ids.has(item.id)) throw Error('Use unique safe case IDs');
  ids.add(item.id);
}
const normalize = text => text.replace(/\s+/gu, ' ').trim();

test('selected report behavior and responsive evidence', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(cases.route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(cases.readySelector)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const note of notes) {
    if (!note.trigger || !note.panel || !note.content || !note.close || !note.text?.trim()) throw Error('Incomplete note case: ' + note.id);
    await page.locator(note.trigger).click();
    const panel = page.locator(note.panel);
    await expect(panel).toBeVisible();
    await expect.poll(async () => normalize(await page.locator(note.content).innerText())).toBe(normalize(note.text));
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    await panel.screenshot({ path: testInfo.outputPath(note.id + '.png'), animations: 'disabled' });
    await page.locator(note.close).click();
    await expect(panel).toBeHidden();
  }
  for (const chart of charts) {
    if (!chart.selector || !chart.readySelector || !Array.isArray(chart.labels) || !chart.labels.length) throw Error('Incomplete chart case: ' + chart.id);
    const root = page.locator(chart.selector);
    await root.scrollIntoViewIfNeeded();
    await expect(root).toBeVisible();
    await expect(root.locator(chart.readySelector).first()).toBeVisible();
    for (const label of chart.labels) {
      if (!label.selector || !label.text?.trim()) throw Error('Empty expected chart label');
      await expect(root.locator(label.selector).filter({ hasText: label.text }).first()).toBeVisible();
    }
    await root.screenshot({ path: testInfo.outputPath(chart.id + '.png'), animations: 'disabled' });
    if (process.env.BOK_VISUAL_REGRESSION === '1') await expect(root).toHaveScreenshot(chart.id + '.png', { animations: 'disabled' });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
