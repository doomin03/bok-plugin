// 보고서 반응형 감사: 창을 넓은 폭에서 좁은 폭으로 줄여 가며(실사용 리사이즈) 폭별로
// 페이지 가로 넘침·요소 화면 밖 넘침·글자 잘림·차트 글자 겹침/잘림·모바일 차트 글자 크기·
// 제목/자료 줄 겹침·한 글자씩 꺾이는 글자를 잰다. 폭별 새로고침(모바일 첫 진입)도 일부 폭에서 잰다.
// usage: node responsive-audit.mjs --url <report url> [--widths ...] [--fresh 768,375,320] [--out dir] [--chrome path]
import fs from "node:fs";
import path from "node:path";
import { arg, need, widths as widthArg, launch, outDir as out, summary } from "./lib.mjs";
import { check } from "./responsive-check.mjs";

const url = need("--url"), outDir = out();
const widths = widthArg().sort((a, b) => b - a);
const FRESH = arg("--fresh", process.env.FRESH || "768,375,320").split(",").filter(Boolean).map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.join(outDir, "shots"), { recursive: true });

const browser = await launch();

async function open(width) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 180000 });
    await page.waitForSelector(".report-area", { timeout: 60000 });
    // LazyChart 는 화면에 들어와야 그려지므로 끝까지 훑는다(모든 chart-area 에 svg/img 가 생길 때까지)
    for (let round = 0; round < 6; round += 1) {
        const left = await page.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await wait(40); }
            const empty = [...document.querySelectorAll(".report-area .chart-area")].filter((a) => !a.querySelector("svg, img"));
            for (const a of empty) { a.scrollIntoView({ block: "center" }); await wait(200); }
            return empty.length;
        });
        if (!left) break;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    return page;
}

const shot = async (page, key, where) => {
    const file = path.join(outDir, "shots", `${key}-${where}.png`.replace(/[^\w.-]+/g, "_"));
    const handle = await page.evaluateHandle((where) => {
        const el = document.getElementById(where) || document.querySelector(where);
        return el?.closest(".chart-wrap, .table-wrap, article") || el;
    }, where);
    const el = handle.asElement();
    if (!el) return null;
    await (el.scrollIntoViewIfNeeded ? el.scrollIntoViewIfNeeded() : el.scrollIntoView()); // playwright·puppeteer 이름 차이
    await sleep(300);
    try { await el.screenshot({ path: file }); return path.basename(file); } catch { return null; }
};

const results = {};
const shotted = new Set();
async function measure(page, key) {
    await sleep(1800);
    const issues = await page.evaluate(check);
    for (const it of issues) {
        const id = `${it.type}|${it.shotTarget}|${key}`;
        if (shotted.has(id) || !it.shotTarget) continue;
        shotted.add(id);
        it.shot = await shot(page, key, it.shotTarget);
    }
    results[key] = issues;
    // 측정 대상 수: 그려진 차트·표·이미지(0이면 페이지가 안 떴거나 선택자가 바뀐 것)
    measured += await page.evaluate(() => (window.Highcharts?.charts || []).filter((c) => c?.renderTo?.isConnected).length
        + document.querySelectorAll(".report-area table, .report-area img").length);
    console.log(key, issues.length);
}
let measured = 0;

// ① 한 창을 계속 줄이기
const page = await open(widths[0]);
for (const w of widths) {
    await page.setViewport({ width: w, height: 900 });
    await measure(page, `resize-${w}`);
}
await page.close();
// ② 그 폭으로 처음 여는 경우(모바일·태블릿 첫 진입)
for (const w of FRESH) {
    const p = await open(w);
    await measure(p, `fresh-${w}`);
    await p.close();
}
await browser.close();

// 같은 결함(type+where)은 한 줄로 묶어 나온 폭을 나열
const merged = new Map();
for (const [key, issues] of Object.entries(results)) {
    for (const it of issues) {
        const id = `${it.type}|${it.where}|${it.detail.replace(/\d+(\.\d+)?/g, "N")}`;
        const m = merged.get(id) || { ...it, at: [] };
        m.at.push(key);
        m.shot ||= it.shot;
        merged.set(id, m);
    }
}
const list = [...merged.values()].sort((a, b) => a.type.localeCompare(b.type) || a.where.localeCompare(b.where));
fs.writeFileSync(path.join(outDir, "responsive-audit.json"), JSON.stringify({ url, widths, fresh: FRESH, results, merged: list }, null, 1));
const counts = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.length]));
console.log(JSON.stringify(counts));
console.log(`unique ${list.length}`);
summary("responsive-audit", measured, list.length, { unit: "chart+table+img × pass; defect = 묶은 고유 결함", raw: Object.values(counts).reduce((a, b) => a + b, 0) });
