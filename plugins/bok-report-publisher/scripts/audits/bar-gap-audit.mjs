// 막대 간격 감사: 폭을 줄여 가며 모든 막대(column) 계열의 이웃 막대 간격(px)을 잰다. 간격 < 1px = 겹침/붙음.
// 누적(stacking) 막대는 같은 칸이 한 막대. 화면 밖 차트 비노출(sectionChartPause)은 풀고 강제 reflow 후 잰다.
// 막대 폭/칸 비율(barRatio·groupRatio)도 남긴다: <out>/bar-ratio.json 을 원본 그림의 막대 비율과 대조.
// usage: node bar-gap-audit.mjs --url <report url> [--widths 1440,...] [--out dir] [--chrome path]
import fs from "node:fs";
import { need, widths as widthArg, launch, outFile, summary } from "./lib.mjs";

const url = need("--url");
const widths = widthArg().sort((a, b) => b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let measured = 0, defects = 0;
const browser = await launch({ protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: widths[0], height: 900 });
for (let i = 0; i < 3; i += 1) {
    try { await page.goto(url, { waitUntil: "load", timeout: 120000 }); await page.waitForSelector(".report-area", { timeout: 60000 }); break; } catch { /* HMR 재로드 재시도 */ }
}
const mounted = () => page.evaluate(() => Highcharts.charts.filter((c) => c?.renderTo?.isConnected).length);
// 아직 svg 가 없는 차트 칸 수(보고서마다 차트 수가 달라 고정 개수 대신 남은 칸으로 판단)
const pending = () => page.evaluate(() => [...document.querySelectorAll(".report-area .chart-area")].filter((a) => !a.querySelector("svg")).length);
for (let round = 0; round < 4 && (await pending()) > 0; round += 1) { // LazyChart 전부 마운트(HMR 재로드되면 다시)
    await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await wait(250); }
    });
    await sleep(15000);
}
console.log("mounted charts", await mounted());
const result = {};
for (const w of widths) {
    await page.setViewport({ width: w, height: 900 });
    await sleep(800);
    const rows = await page.evaluate(async () => {
        document.querySelectorAll(".chart-section-paused").forEach((el) => el.classList.remove("chart-section-paused"));
        Highcharts.charts.forEach((c) => c?.renderTo?.isConnected && c.reflow());
        await new Promise((r) => setTimeout(r, 1500));
        const caption = (c) => c.renderTo.closest(".chart-inner, .chart-wrap, article")?.querySelector(".chart-info span, .img-info span")?.textContent.replace(/\s+/g, " ").trim().slice(0, 40) || "";
        return Highcharts.charts.filter((c) => c?.renderTo?.isConnected).map((c) => {
            // 묶음 = 같은 x 값의 막대들(누적·나란히). 묶음 사이 간격(gap)과, 나란히 막대(grouping≠false) 묶음 안 겹침(inner)을 따로 잰다.
            const cols = c.series.filter((s) => s.visible && /column|bar/.test(s.type) && !s.options.isInternal);
            const groups = new Map();
            let inner = Infinity;
            cols.forEach((s) => s.points.filter((p) => p.shapeArgs && p.y !== null).forEach((p) => {
                const b = { x0: p.shapeArgs.x, x1: p.shapeArgs.x + p.shapeArgs.width, stack: s.options.stacking ? s.options.stack ?? "s" : s.index, overlay: s.options.grouping === false };
                (groups.get(p.x) || groups.set(p.x, []).get(p.x)).push(b);
            }));
            const ext = [...groups.values()].map((bs) => {
                const slots = [...new Map(bs.filter((b) => !b.overlay).map((b) => [b.stack, b])).values()].sort((a, b) => a.x0 - b.x0);
                for (let i = 1; i < slots.length; i += 1) inner = Math.min(inner, slots[i].x0 - slots[i - 1].x1);
                return { x0: Math.min(...bs.map((b) => b.x0)), x1: Math.max(...bs.map((b) => b.x1)), w: Math.min(...bs.map((b) => b.x1 - b.x0)) };
            }).sort((a, b) => a.x0 - b.x0);
            if (ext.length < 2) return null;
            let minGap = Infinity;
            for (let i = 1; i < ext.length; i += 1) minGap = Math.min(minGap, ext[i].x0 - ext[i - 1].x1);
            // 간격만 보면 공통 훅이 막대를 칸의 21%로 줄여도(원본 ~64%) 통과한다 → 막대 폭/칸 비율을 원본 그림과 대조하도록 남긴다
            const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
            const slot = med(ext.slice(1).map((b, i) => (b.x0 + b.x1 - ext[i].x0 - ext[i].x1) / 2)); // 칸 = 이웃 묶음 중심 간격(중앙값)
            const barW = Math.min(...ext.map((b) => b.w));
            return { id: c.renderTo.id, caption: caption(c), bars: ext.length, barW: +barW.toFixed(1), minGap: +minGap.toFixed(1),
                inner: inner === Infinity ? null : +inner.toFixed(1), plotW: Math.round(c.plotWidth), slot: +slot.toFixed(1),
                barRatio: +(barW / slot).toFixed(2), groupRatio: +(med(ext.map((b) => b.x1 - b.x0)) / slot).toFixed(2) };
        }).filter(Boolean);
    });
    result[w] = rows;
    // 막대 칸이 3px 미만(수백 개 월별 막대)이면 간격을 둘 수 없으므로 겹침(<0)만 본다
    const bad = rows.filter((r) => (r.plotW / r.bars >= 3 ? r.minGap < 1 : r.minGap < 0) || (r.inner !== null && r.inner < -0.5));
    measured += rows.length; defects += bad.length;
    console.log(w, `(${rows.length}개)`, "겹침/붙음:", bad.map((r) => `${r.id}(${r.minGap}${r.inner !== null && r.inner < -0.5 ? `,안${r.inner}` : ""})`).join(" ") || "없음");
}
fs.writeFileSync(outFile("bar-gap-audit.json"), JSON.stringify(result, null, 1));
await browser.close();
// 폭별 차트별 막대 폭/칸 비율: 원본 그림의 비율과 사람이 대조(판정 기준 없음, 증거만)
const ratios = Object.fromEntries(Object.entries(result).map(([w, rows]) => [w, Object.fromEntries(rows.map((r) => [r.id, [r.barRatio, r.groupRatio]]))]));
fs.writeFileSync(outFile("bar-ratio.json"), JSON.stringify(ratios, null, 1));
summary("bar-gap-audit", measured, defects, { unit: "chart×width", barRatio: "bar-ratio.json ([막대/칸, 묶음/칸])" });
