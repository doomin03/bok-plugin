// 전 차트 브라우저 감사: 축 라벨 잘림(clipL/R)·linkedTo 미러축 눈금 불일치·둥근 막대(path). 0건이 통과.
// 사용: node audit-axis-clip.mjs --url <report url> [--widths 1440,768,375] [--chrome path] (폭마다 새로 연다)
import { need, widths, launch, summary } from './lib.mjs';
const url = need('--url');
const b = await launch({ args: ['--no-sandbox'] });
let measured = 0, defects = 0;
for (const w of widths()) {
const p = await b.newPage();
await p.setViewport({ width: w, height: 900 });
await p.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } });
await new Promise(r => setTimeout(r, 2500));
measured += await p.evaluate(() => Highcharts.charts.filter(c => c && c.renderTo).length);
const out = await p.evaluate(() => Highcharts.charts.filter(c => c && c.renderTo).map(c => {
  const id = c.renderTo.id, base = c.container.getBoundingClientRect(), issues = [];
  c.container.querySelectorAll('.highcharts-yaxis-labels text, .highcharts-yaxis-labels span, .highcharts-xaxis-labels text, .highcharts-xaxis-labels span').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    if (r.left < base.left - 1) issues.push(`clipL(${Math.round(base.left-r.left)}px)`); if (r.right > base.right + 1) issues.push(`clipR(${Math.round(r.right-base.right)}px)`);
  });
  const ys = c.yAxis.filter(a => !a.options.isInternal && a.visible !== false);
  ys.forEach(a => { if (a.options.linkedTo != null) { const m = c.yAxis[a.options.linkedTo]; const t1 = (a.tickPositions||[]).join(), t0 = (m?.tickPositions||[]).join(); if (t1 !== t0) issues.push(`linkedTicks:${t0}|${t1}`); } });
  c.series.filter(s => s.type === 'column' && s.visible).forEach(s => { const br = s.options.borderRadius; if (br !== 0 && br !== undefined ? true : (br === undefined)) { const pt = s.points.find(pp => pp.graphic); if (pt && pt.graphic.element.tagName === 'path') issues.push(`radius:${s.name}`); } });
  return issues.length ? `${id} [mL=${c.options.chart.marginLeft} mR=${c.options.chart.marginRight} w=${c.chartWidth}]: ${[...new Set(issues)].slice(0, 6).join(' ; ')}` : null;
}).filter(Boolean));
defects += out.length;
console.log(`width ${w}: ${out.length} charts with issues`); out.forEach(x => console.log(x));
await p.close();
}
await b.close();
summary('audit-axis-clip', measured, defects, { unit: 'chart×width' });
