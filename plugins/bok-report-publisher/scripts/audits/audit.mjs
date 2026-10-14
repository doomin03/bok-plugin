// 보고서 전면 감사: DOCX 원문 기준으로 그림(차트·사진)·표(셀 행렬·병합)·각주 위치·장별 텍스트를
// 실제 렌더 화면과 위치 단위로 대조한다. (regression.mjs 는 전역 문자열 대조, 이 스크립트는 구조·위치 대조)
// usage: node audit.mjs --url <report url> --docx-json <docxContent.json> --units <source-units.json>
//        --chapters <시작블록:장id,...> [--stray-blocks B0501] [--out dir] [--chrome path]
import fs from "node:fs";
import { need, launch, outFile, summary } from "./lib.mjs";
import { collect } from "./audit-collect.mjs";
import { compare } from "./audit-compare.mjs";

const url = need("--url");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
await page.waitForSelector(".report-area", { timeout: 60000 });

// 지연 로딩 차트·이미지를 모두 그리게 한다: 천천히 끝까지 스크롤 → 남은 것은 하나씩 화면에 띄워 대기
await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await wait(140); }
});
const pending = () => page.evaluate(() => [...document.querySelectorAll(".report-area .chart-area")]
    .filter((a) => !a.querySelector("svg")).length);
for (let round = 0; round < 3 && (await pending()); round += 1) {
    const n = await page.evaluate(() => [...document.querySelectorAll(".report-area .chart-area")].filter((a) => !a.querySelector("svg")).length);
    for (let i = 0; i < n; i += 1) {
        await page.evaluate((k) => {
            const left = [...document.querySelectorAll(".report-area .chart-area")].filter((a) => !a.querySelector("svg"));
            left[Math.min(k, left.length - 1)]?.scrollIntoView({ block: "center" });
        }, 0);
        await sleep(900);
    }
}
await page.evaluate(() => document.querySelectorAll("img.lazy-image").forEach((img) => { if (!img.src && img.dataset.src) img.src = img.dataset.src; }));
await sleep(2000);

const rendered = await page.evaluate(collect);
await browser.close();
const report = compare(rendered);
fs.writeFileSync(outFile("audit.json"), JSON.stringify(report, null, 1));
const parts = Object.values(report.summary);
summary("audit", parts.reduce((n, s) => n + s.total, 0), parts.reduce((n, s) => n + s.problems, 0), report.summary);
