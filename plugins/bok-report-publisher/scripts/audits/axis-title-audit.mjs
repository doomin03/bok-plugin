// 가로형 y축 제목(rotation 0, align high) 정렬 감사: 넓은 폭에서 좁은 폭으로 줄여 가며(실사용 리사이즈)
// 각 제목의 끝이 자기 축의 축선(좌축=축선 왼쪽 끝, 우축=오른쪽 끝)과 몇 px 어긋나는지 잰다(+ 안쪽, - 바깥).
// 같은 쪽에 축이 둘 이상(우축②)인 안쪽 제목은 축선 대신 "바깥 제목과 겹치지 않고 6px 옆"인지 본다.
// usage: node axis-title-audit.mjs --url <report url> [--widths 1440,1024,...] [--out dir] [--chrome path]
//        (촘촘히 보려면 --widths 에 1440 부터 280 까지 20px 간격을 준다)
import fs from "node:fs";
import { need, widths, launch, outFile, summary } from "./lib.mjs";

const url = need("--url");
const WIDTHS = widths().sort((a, b) => b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch({ protocolTimeout: 1800000 });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: WIDTHS[0], height: 900 });
for (let i = 0; i < 3; i += 1) { try { await page.goto(url, { waitUntil: "load", timeout: 120000 }); await page.waitForSelector(".report-area p", { timeout: 60000 }); break; } catch { /* HMR 재시도 */ } }
const mounted = () => page.evaluate(() => Highcharts.charts.filter((c) => c?.renderTo?.isConnected).length);
// 아직 svg 가 없는 차트 칸 수(보고서마다 차트 수가 달라 고정 개수 대신 남은 칸으로 판단)
const pending = () => page.evaluate(() => [...document.querySelectorAll(".report-area .chart-area")].filter((a) => !a.querySelector("svg")).length);
for (let r = 0; r < 4 && (await pending()) > 0; r += 1) {
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 200)); } });
    await sleep(12000);
}
const result = { mounted: await mounted(), widths: {} };
let measured = 0, defects = 0;
for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900 });
    await sleep(600);
    // NOREFLOW=1: 강제 재정렬 없이 차트를 하나씩 화면에 스크롤해 들어오게만 하고 잰다(사용자가 보는 그대로)
    result.widths[w] = await page.evaluate(async (noReflow) => {
        if (noReflow) {
            for (const c of Highcharts.charts.filter((x) => x?.renderTo?.isConnected)) { c.renderTo.scrollIntoView({ block: "center" }); await new Promise((s) => setTimeout(s, 120)); }
        } else {
            document.querySelectorAll(".chart-section-paused").forEach((el) => el.classList.remove("chart-section-paused"));
            Highcharts.charts.forEach((c) => c?.renderTo?.isConnected && c.reflow());
        }
        await new Promise((s) => setTimeout(s, 900));
        const rows = [];
        Highcharts.charts.filter((c) => c?.renderTo?.isConnected).forEach((c) => {
            const titled = c.yAxis.filter((a) => a.visible && a.axisTitle?.element && a.options.title?.rotation === 0 && a.options.title?.align === "high"
                && a.axisTitle.element.style.visibility !== "hidden" && a.axisTitle.element.getBoundingClientRect().width);
            ["L", "R"].forEach((side) => {
                const list = titled.filter((a) => !!a.opposite === (side === "R")).sort((a, b) => (b.offset || 0) - (a.offset || 0)); // 바깥 축부터
                let prev = null;
                list.forEach((a, i) => {
                    const t = a.axisTitle.element.getBoundingClientRect();
                    const line = a.axisLine?.element?.getBoundingClientRect();
                    const box = c.container.getBoundingClientRect();
                    const lineX = line && line.height ? (side === "R" ? line.right : line.left)
                        : (side === "R" ? box.left + c.plotLeft + c.plotWidth + (a.offset || 0) : box.left + c.plotLeft - (a.offset || 0));
                    const delta = Math.round((side === "R" ? lineX - t.right : t.left - lineX) * 10) / 10;
                    const pushed = i > 0 && prev && (side === "R" ? t.right <= prev.left - 5 : t.left >= prev.right + 5); // 바깥 제목 옆으로 밀림
                    const overlap = prev && t.left < prev.right && prev.left < t.right && t.top < prev.bottom && prev.top < t.bottom;
                    const outside = t.left < box.left - 0.5 || t.right > box.right + 0.5;
                    rows.push({ id: c.renderTo.id, side, text: a.axisTitle.textStr?.slice(0, 18), delta, inner: i > 0, pushed: Boolean(pushed), overlap: Boolean(overlap), outside, cw: c.chartWidth });
                    prev = t;
                });
            });
        });
        return rows;
    }, Boolean(process.env.NOREFLOW));
    const rows = result.widths[w];
    const bad = rows.filter((r) => (Math.abs(r.delta) > 1 && !(r.inner && r.pushed && !r.overlap)) || r.overlap || r.outside);
    measured += rows.length; defects += bad.length;
    console.log(w, `제목 ${rows.length}`, bad.length ? `문제 ${bad.length}: ${bad.slice(0, 6).map((r) => `${r.id}${r.side}(${r.delta}${r.overlap ? ",겹침" : ""}${r.outside ? ",밖" : ""})`).join(" ")}` : "문제 0");
}
result.errors = errors.filter((e) => !/activateMenuLink|'top'|#13/.test(e));
fs.writeFileSync(outFile("axis-title-audit.json"), JSON.stringify(result));
await browser.close();
summary("axis-title-audit", measured, defects, { mounted: result.mounted, pageErrors: result.errors.length });
