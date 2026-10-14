// 음영 끝 여백 감사: 데이터 끝(처음)에 닿는 음영이 오른쪽(왼쪽) 플롯 끝까지 가는지. 0건이 통과.
// 사용: node audit-band-edge.mjs --url <report url> [--widths 1440,768,375,320] [--chrome path] (폭마다 새로 연다)
import { need, widths, launch, summary } from "./lib.mjs";
const url = need("--url");
const b = await launch({ args: ["--no-sandbox"] });
let measured = 0, defects = 0;
for (const W of widths()) {
const p = await b.newPage(); await p.setViewport({ width: Number(W), height: 900 });
await p.goto(url, { waitUntil: "networkidle2", timeout: 180000 });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
await new Promise((r) => setTimeout(r, 3000)); await p.addStyleTag({ content: ".chart-section-paused > * { visibility: visible !important; }" });
const r = await p.evaluate(() => Highcharts.charts.filter((c) => c?.renderTo && document.body.contains(c.renderTo)).map((c) => {
    const ax = c.xAxis[0]; if (!ax) return null;
    const bands = ax.plotLinesAndBands.filter((pb) => pb.options.from !== undefined && pb.svgElem?.element && String(pb.options.color) !== "transparent");
    if (!bands.length) return null;
    const right = (pb) => { const bb = pb.svgElem.element.getBBox(); return bb.x + bb.width; };
    const leftOf = (pb) => pb.svgElem.element.getBBox().x;
    const last = bands.reduce((a, pb) => (right(pb) > right(a) ? pb : a));
    const first = bands.reduce((a, pb) => (leftOf(pb) < leftOf(a) ? pb : a));
    const plotR = c.plotLeft + c.plotWidth;
    const dMax = ax.toPixels(ax.dataMax ?? ax.max, false), dMin = ax.toPixels(ax.dataMin ?? ax.min, false);
    const issues = [];
    const gapR = plotR - right(last); if (gapR > 1 && right(last) >= dMax - 2) issues.push(`right gap ${gapR.toFixed(1)}px`);
    const gapL = leftOf(first) - c.plotLeft; if (gapL > 1 && leftOf(first) <= dMin + 2) issues.push(`left gap ${gapL.toFixed(1)}px`);
    return issues.length ? { id: c.renderTo.id, title: c.renderTo.closest(".chart-wrap")?.querySelector(".chart-info span")?.textContent.trim().slice(0, 24), issues } : { ok: 1 };
}).filter(Boolean));
console.log(`w=${W}`); r.filter((x) => x.issues).forEach((x) => console.log("  " + JSON.stringify(x)));
console.log("charts with bands:", r.length);
measured += r.length; defects += r.filter((x) => x.issues).length;
await p.close();
}
await b.close();
summary("audit-band-edge", measured, defects, { unit: "음영 있는 chart×width" });
