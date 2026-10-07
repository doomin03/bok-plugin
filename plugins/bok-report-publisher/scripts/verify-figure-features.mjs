// usage: node verify-figure-features.mjs --features <features.json> --url <report url> --out <dir>
//        [--map <figure→containerId json>] [--exceptions <json>] [--widths 1440,390] [--chrome <chrome.exe>]
// --exceptions: [{"chart":"sheet068_graph","feature":"x축 라벨","reason":"오너 지시로 25 삭제","ticket":"#94"}]
//   owner-approved deviations become 'accepted' (shown, never silently dropped).
// Without --map, each figure panel is matched to the rendered chart whose legend shares the most text.
// Writes figure-check.json and figure-check.md. Evidence only: it never approves a chart.
import fs from 'node:fs'; import path from 'node:path';
import { collectRuntime } from './figure-runtime.mjs';
import { compareFigure } from './figure-compare.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const norm = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\d+\)/g, '').replace(/[\s()（）·,]/g, '');
const features = JSON.parse(fs.readFileSync(arg('--features'), 'utf8')).figures;
const map = arg('--map') ? JSON.parse(fs.readFileSync(arg('--map'), 'utf8')) : null;
const out = arg('--out'); fs.mkdirSync(out, { recursive: true });
const exceptions = arg('--exceptions') ? JSON.parse(fs.readFileSync(arg('--exceptions'), 'utf8')) : [];
const accept = (chart, checks) => checks.map((c) => {
  const e = exceptions.find((x) => x.chart === chart && c.feature.includes(x.feature));
  return e && c.status === 'fail' ? { ...c, status: 'accepted', note: `${e.reason} (${e.ticket || '오너'})` } : c;
});

async function browser() {
  try { const { chromium } = await import('playwright'); return { b: await chromium.launch(), pw: true }; }
  catch { const p = (await import('puppeteer-core')).default; return { b: await p.launch({ executablePath: arg('--chrome', process.env.CHROME_PATH), headless: true }), pw: false }; }
}

const { b, pw } = await browser(), results = [];
for (const width of arg('--widths', '1440,390').split(',').map(Number)) {
  const page = await b.newPage();
  await (pw ? page.setViewportSize({ width, height: 1000 }) : page.setViewport({ width, height: 1000 }));
  await page.goto(arg('--url'), { waitUntil: pw ? 'networkidle' : 'networkidle0', timeout: 180000 });
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await new Promise((r) => setTimeout(r, 50)); }
  await page.addScriptTag({ content: `window.__collect = ${collectRuntime.toString()};` });
  const ids = await page.evaluate(() => window.Highcharts.charts.filter((c) => c?.renderTo?.id).map((c) => c.renderTo.id));
  const runtime = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await page.evaluate((i) => window.__collect(i), id)])));
  const cand = [];
  for (const [figure, f] of Object.entries(features)) {
    if (f.status !== 'extracted') continue;
    f.panels.forEach((panel, k) => {
      if (map) { const id = map[figure]?.[k] ?? map[figure]; return cand.push({ figure, k, panel, id: typeof id === 'string' ? id : null, score: 1 }); }
      const want = new Set(panel.legend.filter((l) => l.mark).map((l) => norm(l.text)));
      // 범례 문구 일치 60% + 축 눈금 일치 40%: 범례만 같은 다른 그림(개요·본문 중복 등)과 구분
      const ticks = new Set(panel.yAxes.flatMap((a) => a.ticks.map(String)));
      const score = (r) => r ? 0.6 * r.legend.filter((l) => want.has(norm(l.text))).length / Math.max(want.size, 1)
        + 0.4 * r.yAxes.flatMap((a) => a.ticks.map(String)).filter((t) => ticks.has(t)).length / Math.max(ticks.size, 1) : 0;
      const best = ids.map((i) => ({ i, s: score(runtime[i]) })).sort((x, y) => y.s - x.s)[0];
      cand.push({ figure, k, panel, id: want.size && best && best.s >= 0.6 ? best.i : null, score: best?.s ?? 0 });
    });
  }
  // 차트 하나에는 점수가 가장 높은 그림 패널 하나만 연결한다(개요·본문 중복 그림은 남는 쪽이 unmapped)
  const taken = new Set();
  for (const c of cand.sort((x, y) => y.score - x.score)) {
    if (!c.id || !runtime[c.id] || (!map && taken.has(c.id))) { results.push({ figure: c.figure, panel: c.k, width, chart: null, checks: [], status: 'unmapped' }); continue; }
    taken.add(c.id);
    const checks = accept(c.id, compareFigure(c.panel, runtime[c.id]));
    results.push({ figure: c.figure, panel: c.k, width, chart: c.id, score: +c.score.toFixed(2), status: checks.some((x) => x.status === 'fail') ? 'fail' : 'pass', checks });
  }
  await page.close();
}
await b.close();
fs.writeFileSync(path.join(out, 'figure-check.json'), JSON.stringify(results, null, 1));
const lines = ['# 원본 그림 특징 대조', '', '| 그림 | 패널 | 폭 | 차트 | 결과 | 실패 항목 |', '|---|---|---|---|---|---|'];
for (const r of results) lines.push(`| ${r.figure} | ${r.panel + 1} | ${r.width} | ${r.chart ?? '-'} | ${r.status} | ${r.checks.filter((c) => c.status === 'fail').map((c) => c.feature).join('; ')} |`);
fs.writeFileSync(path.join(out, 'figure-check.md'), lines.join('\n') + '\n');
const count = (s) => results.filter((r) => r.status === s).length;
console.log(JSON.stringify({ pass: count('pass'), fail: count('fail'), unmapped: count('unmapped') }));
