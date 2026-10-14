// 새 보고서 ↔ 기존 보고서 페이지 표기 대조: 블록 사이 간격·요소 스타일·구조·표기.
// usage: node style-parity-audit.mjs --base-url <기존 보고서 url> --url <새 보고서 url> [--widths ...] [--out dir] [--chrome path]
import fs from "node:fs";
import { need, widths as widthArg, launch, outFile, summary } from "./lib.mjs";

const out = outFile("style-parity-audit.json");
const widths = widthArg();
const PAGES = { old: need("--base-url"), new: need("--url") };
const browser = await launch({ protocolTimeout: 600000 });
const page = await browser.newPage();
const result = {};

function collect() {
    const DROP = /^(source-|desc$|report-subtitle$|data-v)/;
    const sig = (e) => `${e.tagName.toLowerCase()}${[...e.classList].filter((c) => !DROP.test(c)).sort().map((c) => `.${c}`).join("")}`;
    const visible = (e) => e.getBoundingClientRect().height > 0;
    // 구역(.report-section) 안 블록 목록: 클래스 없는 래퍼·DOCX 블록 상자는 펼친다
    const flat = (el) => [...el.children].flatMap((c) => (c.matches(".source-document-blocks, div:not([class]), .report-section") ? flat(c) : [c])).filter(visible);
    const K = ["fontSize", "lineHeight", "fontWeight", "color", "textAlign", "marginTop", "marginBottom", "paddingTop", "paddingLeft", "backgroundColor", "borderTopWidth", "borderTopColor", "borderBottomWidth"];
    const gaps = {}; const styles = {}; const counts = {};
    document.querySelectorAll(".report-area > .report-section, .report-area > div > .report-section, .report-area .report-section").forEach((sec) => {
        if (sec.parentElement.closest(".report-section")) return; // 최상위 구역만(중첩은 flat 이 펼침)
        const items = flat(sec);
        items.forEach((e, i) => {
            const s = sig(e); counts[s] = (counts[s] || 0) + 1;
            if (!styles[s]) { const cs = getComputedStyle(e); styles[s] = { style: K.map((k) => cs[k]).join(" | "), sample: e.textContent.trim().slice(0, 30) }; }
            if (!i) return;
            const a = items[i - 1]; const g = Math.round(e.getBoundingClientRect().top - a.getBoundingClientRect().bottom);
            const k = `${sig(a)} → ${s}`; ((gaps[k] ||= {})[g] ||= []).push(e.textContent.trim().slice(0, 24));
        });
    });
    const tables = [...document.querySelectorAll(".report-area article.table-wrap")].map((a) => {
        const t = a.querySelector("table"); const cols = t ? Math.max(...[...t.rows].map((r) => [...r.cells].reduce((n, c) => n + c.colSpan, 0))) : 0;
        return { caption: a.querySelector(".table-info span")?.textContent.trim().slice(0, 30) || "", cols, rows: t ? t.rows.length : 0, text: a.textContent.trim().slice(0, 40) };
    });
    const heads = [...document.querySelectorAll(".report-area h2, .report-area h3, .report-area h4, .report-area .chart-info > span:first-child, .report-area .img-info > span:first-child, .report-area .table-info > span:first-child")]
        .map((e) => e.textContent.trim().replace(/\s+/g, " ")).filter((t) => /(참고|그림|표)\s*(I{1,3}|IV)\s*-|[∙]/.test(t));
    return { gaps, styles, counts, tables, heads };
}

for (const w of widths) {
    for (const [name, url] of Object.entries(PAGES)) {
        await page.setViewport({ width: w, height: 900 });
        for (let i = 0; i < 3; i += 1) { try { await page.goto(url, { waitUntil: "load", timeout: 120000 }); await page.waitForSelector(".report-area p", { timeout: 60000 }); break; } catch { /* HMR 재시도 */ } }
        await new Promise((r) => setTimeout(r, 2500));
        result[`${name}${w}`] = await page.evaluate(collect);
        console.log(name, w, "blocks", Object.values(result[`${name}${w}`].counts).reduce((a, b) => a + b, 0));
    }
}
// 판정: 같은 요소 종류(태그+클래스)가 두 보고서에 다 있는데 계산 스타일이 다르면 편차
const diffs = widths.flatMap((w) => Object.entries(result[`new${w}`].styles)
    .filter(([s, v]) => result[`old${w}`].styles[s] && result[`old${w}`].styles[s].style !== v.style)
    .map(([s, v]) => ({ width: w, sig: s, old: result[`old${w}`].styles[s].style, new: v.style, sample: v.sample })));
result.diffs = diffs;
fs.writeFileSync(out, JSON.stringify(result));
await browser.close();
diffs.slice(0, 30).forEach((d) => console.log(` ${d.width} ${d.sig}\n   old: ${d.old}\n   new: ${d.new}`));
const shared = widths.reduce((n, w) => n + Object.keys(result[`new${w}`].styles).filter((s) => result[`old${w}`].styles[s]).length, 0);
summary("style-parity-audit", shared, diffs.length, { unit: "공통 요소 종류×width" });
