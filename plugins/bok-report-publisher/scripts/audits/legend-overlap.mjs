// 보고서 전 차트: 범례 항목(글자·기호)이 다른 글자(축 제목·눈금·라벨)와 1px 라도 겹치는지 폭별로 잰다.
// usage: node legend-overlap.mjs --url <report url> [--widths ...] [--chrome path]
import { need, widths as widthArg, launch, summary } from "./lib.mjs";

const url = need("--url");
const widths = widthArg();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
await page.waitForSelector(".report-area", { timeout: 60000 });
for (let round = 0; round < 4; round += 1) {
    await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (const a of document.querySelectorAll(".report-area .chart-area")) if (!a.querySelector("svg")) { a.scrollIntoView({ block: "center" }); await wait(250); }
    });
}
let bad = 0, measured = 0;
for (const w of widths) {
    await page.setViewport({ width: w, height: 900 });
    await sleep(1500);
    const hits = await page.evaluate(() => {
        const r = (el) => { const b = el.getBoundingClientRect(); return b.width && b.height ? b : null; };
        const ov = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
        const out = [];
        let scanned = 0;
        document.querySelectorAll(".report-area .highcharts-container").forEach((c) => {
            const legend = c.querySelector(".highcharts-legend");
            if (!legend) return;
            scanned += 1;
            const items = [...legend.querySelectorAll(".highcharts-legend-item text, .highcharts-legend-item span, .highcharts-legend-item .highcharts-point, .highcharts-legend-item .highcharts-graph")].map(r).filter(Boolean);
            const others = [...c.querySelectorAll("text, span")].filter((el) => !el.closest(".highcharts-legend, .highcharts-tooltip")
                && !(el.tagName === "SPAN" && el.querySelector("span")) && getComputedStyle(el).visibility !== "hidden" && el.textContent.trim())
                .map((el) => [el, r(el)]).filter(([, b]) => b);
            const found = new Set();
            items.forEach((i) => others.forEach(([el, b]) => { if (ov(i, b)) found.add(el.textContent.trim().slice(0, 30)); }));
            if (found.size) {
                const id = c.parentElement?.id || c.closest("[id]")?.id;
                const title = c.closest(".chart-wrap")?.querySelector(".chart-info span")?.textContent.trim().slice(0, 40);
                out.push(`${id} | ${title} | ${[...found].join(" / ")}`);
            }
        });
        return { out, scanned };
    });
    bad += hits.out.length;
    measured += hits.scanned;
    console.log(`\n# ${w}px: ${hits.out.length} (범례 있는 차트 ${hits.scanned})`);
    hits.out.forEach((h) => console.log("  " + h));
}
await browser.close();
summary("legend-overlap", measured, bad, { unit: "legend-chart×width" });
process.exit(bad ? 1 : 0);
