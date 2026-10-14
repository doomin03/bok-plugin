// 글꼴 전수 대조: 기존 리포트(기준)와 새 보고서의 글자 종류별 글꼴(패밀리·크기·굵기·색)을 폭별로 잰다.
// 기준 = 기존 리포트에서 종류별 다수값. 새 보고서에서 다수값과 다른 글자를 차트별로 보고한다.
// usage: node font-audit.mjs --base-url <기존 보고서 url> --url <새 보고서 url> [--widths ...] [--chrome path]
import { need, widths as widthArg, launch, summary } from "./lib.mjs";

const baseUrl = need("--base-url"), newUrl = need("--url");
const widths = widthArg();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(page, url, width) {
    await page.setViewport({ width, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 180000 });
    await sleep(1500);
    // 지연 로딩 차트: 안 그려진 칸마다 가운데로 스크롤(axis-title-overlap.mjs 와 같은 방식, 4바퀴)
    for (let round = 0; round < 4; round += 1) {
        await page.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            for (const a of document.querySelectorAll(".chart-area")) if (!a.querySelector("svg")) { a.scrollIntoView({ block: "center" }); await wait(250); }
        });
    }
    await sleep(1500);
    const mounted = await page.evaluate(() => [document.querySelectorAll(".chart-area").length, [...document.querySelectorAll(".chart-area")].filter((a) => !a.querySelector("svg")).length]);
    console.log(`  [${url} ${width}px] 차트 칸 ${mounted[0]}개, 안 그려진 칸 ${mounted[1]}개`);
    return page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const kindOf = (el) => {
            if (el.closest(".highcharts-legend")) return "범례";
            if (el.closest(".highcharts-axis-title")) return "축제목";
            if (el.closest(".highcharts-xaxis-labels")) return "x축라벨";
            if (el.closest(".highcharts-yaxis-labels")) return "y축라벨";
            if (el.closest(".highcharts-data-label, .highcharts-data-labels, .highcharts-stack-labels")) return "데이터라벨";
            if (el.closest(".highcharts-plot-band-label, .highcharts-plot-line-label")) return "음영·기준선라벨";
            if (el.closest(".highcharts-tooltip, .highcharts-credits, .highcharts-title, .highcharts-subtitle")) return null;
            return "커스텀글자";
        };
        const styleOf = (el) => {
            const s = getComputedStyle(el);
            const color = el instanceof SVGElement ? (el.getAttribute("fill") || s.fill) : s.color;
            return `${s.fontSize}/${s.fontWeight}/${s.fontFamily.split(",")[0].replace(/["']/g, "").trim()}/${color}`;
        };
        const leaf = (el) => el.textContent.trim() && ![...el.children].some((c) => c.textContent.trim());
        const out = [];
        // 화면 밖 섹션 차트는 숨겨 둘 수 있어(sectionChartPause) 칸마다 화면으로 가져온 뒤 그 칸만 잰다
        const containers = [];
        for (const area of document.querySelectorAll(".chart-area")) {
            area.scrollIntoView({ block: "center" });
            await wait(350);
            area.querySelectorAll(".highcharts-container").forEach((c) => containers.push([c, collectOne(c)]));
        }
        containers.forEach(([, rows]) => out.push(...rows));
        function collectOne(c) {
            const rows = [];
            const r = c.getBoundingClientRect();
            if (!r.width) return rows;
            const id = c.parentElement?.id || "";
            const caption = c.closest(".chart-inner, .chart-wrap")?.querySelector(".chart-info span")?.textContent.trim().slice(0, 30) || "";
            c.querySelectorAll("text, tspan, span").forEach((el) => {
                if (!leaf(el) || el.closest("defs")) return;
                const s = getComputedStyle(el);
                if (s.visibility === "hidden" || s.display === "none" || el.getAttribute("visibility") === "hidden") return;
                if (el.tagName.toLowerCase() === "text" && el.querySelector("tspan")) return;
                const kind = kindOf(el);
                if (kind) rows.push({ id, caption, kind, style: styleOf(el), text: el.textContent.trim().slice(0, 20) });
            });
            return rows;
        }
        // 차트 밖: 그림 제목·자료·주
        document.querySelectorAll(".chart-info span, .chart-footnote span, .img-info span").forEach((el) => {
            if (!leaf(el) && !el.closest(".chart-footnote")) return;
            const kind = el.closest(".chart-footnote") ? "그림주" : (el.matches(".chart-info span:first-child, .img-info span:first-child") ? "그림제목" : "그림자료");
            const s = getComputedStyle(el);
            if (!el.textContent.trim() || s.display === "none") return;
            out.push({ id: "", caption: el.closest(".chart-inner, .img-inner")?.querySelector(".chart-info span, .img-info span")?.textContent.trim().slice(0, 30) || "", kind, style: `${s.fontSize}/${s.fontWeight}/${s.fontFamily.split(",")[0].replace(/["']/g, "").trim()}/${s.color}`, text: el.textContent.trim().slice(0, 20) });
        });
        return out;
    });
}

const browser = await launch({ args: ["--disable-gpu"] });
const page = await browser.newPage();
let bad = 0, measured = 0;
for (const w of widths) {
    const base = await measure(page, baseUrl, w);
    if (process.env.DIST) {
        // 커스텀·데이터·음영 라벨: 기존 리포트 글자별 예시(어떤 글자가 어떤 스타일인지)
        const ex = {};
        base.filter((t) => ["커스텀글자", "데이터라벨", "음영·기준선라벨"].includes(t.kind)).forEach((t) => { const k = `${t.kind} ${t.style}`; (ex[k] ||= new Set()).add(`${t.caption.slice(0, 14)}:${t.text}`); });
        Object.entries(ex).forEach(([k, v]) => console.log(`      기존 예 ${k} → ${[...v].slice(0, 4).join(" | ")}`));
    }
    const cur = await measure(page, newUrl, w);
    // 종류별 기준 다수값
    const major = {};
    const count = {};
    base.forEach(({ kind, style }) => { (count[kind] ||= {})[style] = (count[kind][style] || 0) + 1; });
    Object.entries(count).forEach(([k, m]) => { major[k] = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; });
    measured += cur.length;
    console.log(`\n===== ${w}px  기존 ${base.length}글자 / 새 보고서 ${cur.length}글자`);
    Object.entries(count).forEach(([k, m]) => {
        const total = Object.values(m).reduce((a, b) => a + b, 0);
        console.log(`  기준 ${k}: ${major[k]} (${m[major[k]]}/${total})`);
        // 다수값이 약한 종류(커스텀·데이터라벨 등)는 기존 분포를 전부 보여 판단 근거로 쓴다
        if (process.env.DIST) Object.entries(m).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`      기존 분포 ${k} ${s} ×${n}`));
    });
    const diffs = {};
    cur.forEach((t) => {
        const want = major[t.kind];
        if (!want || t.style === want) return;
        const key = `${t.kind} | ${t.id} ${t.caption}`;
        (diffs[key] ||= new Map()).set(t.style, [...((diffs[key].get(t.style)) || []), t.text]);
    });
    const keys = Object.keys(diffs).sort();
    bad += keys.length;
    console.log(`  새 보고서 편차: ${keys.length}건`);
    keys.forEach((k) => diffs[k].forEach((texts, style) => console.log(`    ${k} → ${style} (기준 ${major[k.split(" | ")[0]]}) ×${texts.length} 예: ${[...new Set(texts)].slice(0, 3).join(" / ")}`)));
}
await browser.close();
summary("font-audit", measured, bad, { unit: "text×width (defect = 종류·차트별 편차)" });
process.exit(bad ? 1 : 0);
