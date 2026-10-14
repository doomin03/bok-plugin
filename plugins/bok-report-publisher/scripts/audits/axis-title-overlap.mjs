// 보고서 전 차트: y축 제목끼리(좌·우, 다중 우축) 1px 라도 겹치는지 폭별로 잰다. 숨긴 제목(visibility hidden)은 제외.
// usage: node axis-title-overlap.mjs --url <report url> [--widths 1440,768,...] [--chrome path]
import { need, widths as widthArg, launch, summary } from "./lib.mjs";

const url = need("--url");
const widths = widthArg();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEAR = 8; // 이보다 가까우면 실기기 폰트(더 넓음)에서 겹칠 수 있어 따로 보고
const browser = await launch();
const page = await browser.newPage();
let bad = 0, scanned = 0;
for (const w of widths) {
    // 폭마다 새로 연다: 1440 에서 연 뒤 줄이면 실기기(처음부터 그 폭)와 결과가 달랐다(겹침 0건으로 잘못 나옴)
    await page.setViewport({ width: w, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForSelector(".report-area", { timeout: 60000 });
    for (let round = 0; round < 4; round += 1) {
        await page.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            for (const a of document.querySelectorAll(".report-area .chart-area")) if (!a.querySelector("svg")) { a.scrollIntoView({ block: "center" }); await wait(250); }
        });
    }
    await sleep(1500);
    const res = await page.evaluate((NEAR) => {
        const out = [];
        let hidden = 0;
        let scanned = 0;
        const near = [];
        const gaps = [];
        const oneSide = [];
        document.querySelectorAll(".report-area .highcharts-container").forEach((c) => {
            scanned += 1;
            const titles = [...c.querySelectorAll(".highcharts-yaxis-title, .highcharts-axis-title")]
                .filter((el) => !el.closest(".highcharts-xaxis") && el.textContent.trim());
            const shown = titles.filter((el) => getComputedStyle(el).visibility !== "hidden" && el.getAttribute("visibility") !== "hidden");
            hidden += titles.length - shown.length;
            // axisTitleAlign 모바일 규칙이 숨긴 우축 제목(인라인 style) — 겹침 목록과 1:1 이어야 한다
            titles.filter((el) => el.tagName === "SPAN" && el.style.visibility === "hidden").forEach((el) => {
                oneSide.push(`${c.parentElement?.id} ${c.closest(".chart-inner")?.querySelector(".chart-info span")?.textContent.trim().slice(0, 40) || ""}: 우축 "${el.textContent.trim()}" 숨김`);
            });
            const boxes = shown.map((el) => [el.textContent.trim(), el.getBoundingClientRect()]).filter(([, b]) => b.width);
            for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
                const [ta, a] = boxes[i], [tb, b] = boxes[j];
                const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                const caption = c.closest(".chart-inner")?.querySelector(".chart-info span")?.textContent.trim().slice(0, 40) || "";
                const label = `${c.parentElement?.id} ${caption} (차트 ${Math.round(c.getBoundingClientRect().width)}px): "${ta}" × "${tb}"`;
                if (x > 0 && y > 0) out.push(`${label} 겹침 ${Math.round(x)}px`);
                else if (y > 0 && x > -NEAR) near.push(`${label} 간격 ${Math.round(-x)}px`);
                if (y > 0) gaps.push([Math.round(-x), label]);
            }
        });
        return { out, hidden, scanned, near, oneSide, closest: gaps.sort((a, b) => a[0] - b[0]).slice(0, 10) };
    }, NEAR);
    bad += res.out.length;
    scanned += res.scanned;
    console.log(`${w}px: 차트 ${res.scanned}개, 겹침 ${res.out.length}건, 간격<${NEAR}px ${res.near.length}건, 숨긴 제목(useHTML SVG 사본 포함) ${res.hidden}개`);
    res.out.forEach((line) => console.log(`  ${line}`));
    res.near.forEach((line) => console.log(`  ~ ${line}`));
    res.oneSide.forEach((line) => console.log(`  - ${line}`));
    if (process.env.CLOSEST) res.closest.forEach(([g, label]) => console.log(`    [가까운 순] ${g}px ${label}`));
}
await browser.close();
summary("axis-title-overlap", scanned, bad, { unit: "chart×width" });
process.exit(bad ? 1 : 0);
