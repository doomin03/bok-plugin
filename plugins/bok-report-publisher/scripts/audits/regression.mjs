// 보고서 누락 회귀 검증: DOCX 원문 단위(source-units.json)가 실제 렌더 화면에 빠짐없이 있는지.
// usage: node regression.mjs --url <report url> --units <source-units.json> --chapters <시작블록:장id,...>
//        [--report-dir src/pages/reportYYYYMM] [--out dir] [--chrome path]
// --report-dir 를 주면 그 보고서의 main/reportTocData.js 로 사이드 메뉴 앵커도 확인한다.
import fs from "node:fs";
import path from "node:path";
import { arg, need, launch, outFile as out, summary as report } from "./lib.mjs";

const url = need("--url"), outFile = out("regression.json");
const UNITS = need("--units");
const CH = need("--chapters").split(",").map((s) => s.split(":")).map(([n, id]) => [Number(n), id]);
const TOC = arg("--report-dir") ? `/src/pages/${path.basename(path.resolve(arg("--report-dir")))}/main/reportTocData.js` : null;

// 비교용 정규화: 공백 제거, 로마숫자·가운뎃점·물결 표기 통일(렌더러가 I→Ⅰ 로 바꾸는 등 표기만 다른 경우 허용)
const norm = (s) => s.replace(/\s+/g, "").replace(/￭/g, "") // 요약 글머리표 ￭ 는 목록(li) 표시로 바뀐다
    .replace(/Ⅳ/g, "IV").replace(/Ⅲ/g, "III").replace(/Ⅱ/g, "II").replace(/Ⅰ/g, "I")
    .replace(/[∙‧·ㆍᆞ・]/g, "·").replace(/[∼～]/g, "~").replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");

async function pageText() {
    const browser = await launch();
    const page = await browser.newPage();
    // WIDTH=375 로 모바일 폭, VISIBLE=1 이면 CSS 로 숨겨진 글자는 없는 것으로 친다(innerText)
    await page.setViewport({ width: Number(process.env.WIDTH) || 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
    await page.waitForSelector(".report-area", { timeout: 60000 });
    const text = await page.evaluate(async ({ visible, toc }) => {
        const take = (el) => { const c = el.cloneNode(true); c.querySelectorAll(".footnote-marker").forEach((m) => m.remove()); return c.textContent; };
        const shownText = (el) => {
            const marks = [...el.querySelectorAll(".footnote-marker")];
            marks.forEach((m) => { m.dataset.d = m.style.display; m.style.display = "none"; });
            const t = el.innerText;
            marks.forEach((m) => { m.style.display = m.dataset.d; });
            return t;
        };
        const body = visible ? shownText(document.querySelector(".report-area")) : take(document.querySelector(".report-area"));
        const tips = [...document.querySelectorAll("[data-toggle-content]")].map((t) => take(t)).join("\n");
        // 사이드 메뉴 앵커: TOC 의 모든 id 가 페이지에 있어야 클릭 시 이동한다
        const ids = []; const walk = (items) => items.forEach((it) => { ids.push(`${it.id} ${it.title}`); if (it.children) walk(it.children); });
        if (toc) walk((await import(toc)).reportTocData);
        const tocMissing = ids.filter((s) => !document.getElementById(s.split(" ")[0]));
        // 각주 표시: 번호별 표시 존재 + 표시가 가리키는 팝업 내용이 실제로 있는지
        const contents = new Set([...document.querySelectorAll("[data-toggle-content]")].map((t) => t.getAttribute("data-toggle-content")));
        const markers = [...document.querySelectorAll(".report-area .tooltip-btn")].map((a) => ({
            id: a.textContent.trim(), target: a.getAttribute("data-toggle-btn"),
        }));
        const brokenMarkers = markers.filter((m) => !contents.has(m.target)).map((m) => `${m.id}→${m.target}`);
        return { body, tips, tocTotal: ids.length, tocMissing, markerIds: [...new Set(markers.map((m) => m.id))], brokenMarkers };
    }, { visible: Boolean(process.env.VISIBLE), toc: TOC });
    await browser.close();
    return text;
}

const section = (u) => {
    if (u.block.startsWith("FN")) return "각주";
    const n = +u.block.slice(1);
    // 집계 구분은 --chapters 의 장 단위(보고서마다 절 경계가 달라 고정 번호를 두지 않는다)
    return n < CH[0][0] ? "표지·발간사·목차" : CH.filter(([s]) => n >= s).pop()[1];
};

const { body, tips, tocTotal, tocMissing, markerIds, brokenMarkers } = await pageText();
const fnIds = [...new Set(JSON.parse(fs.readFileSync(UNITS, "utf8")).filter((u) => u.block.startsWith("FN")).map((u) => u.block.slice(2)))];
const noMarker = fnIds.filter((id) => !markerIds.includes(id));
console.log(`FOOTNOTE markers: ${fnIds.length - noMarker.length}/${fnIds.length}`, noMarker.length ? `NO MARKER: ${noMarker.join(",")}` : "all present",
    `| broken links: ${brokenMarkers.length}`, brokenMarkers.slice(0, 10).join(" "));
console.log(`TOC anchors: ${tocTotal - tocMissing.length}/${tocTotal}`, tocMissing.length ? `MISSING: ${tocMissing.join(" | ")}` : "all present");
const hay = { body: norm(body), tips: norm(tips) };
const units = JSON.parse(fs.readFileSync(UNITS, "utf8"));
const result = units.map((u) => {
    const t = norm(u.text);
    const where = u.block.startsWith("FN") ? hay.tips : hay.body;
    if (where.includes(t)) return { ...u, status: "ok" };
    // 앞에서부터 화면에 이어서 존재하는 길이(12자 창) → 잘림 여부 판정
    let lo = 0, hi = t.length;
    while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (where.includes(t.slice(Math.max(0, m - 12), m))) lo = m; else hi = m - 1; }
    const kept = where.includes(t.slice(0, Math.min(12, t.length))) ? lo / t.length : 0;
    return { ...u, status: t.length <= 2 ? "short" : kept >= 0.3 ? "partial" : "missing", kept: Math.round(kept * 100) };
});
const summary = {};
for (const r of result) {
    const s = (summary[section(r)] ||= { units: 0, ok: 0, partial: 0, missing: 0, short: 0 });
    s.units++; s[r.status]++;
}
// 중복 검사: 원문에 k번 나오는 25자 이상 문장이 화면에 k번보다 많이 나오면 중복 렌더
const count = (hayText, t) => hayText.split(t).length - 1;
// 원문 쪽 횟수도 '부분 문자열' 기준(다른 긴 문단 속에 같은 문장이 들어 있는 경우 포함)
// 앞부분(표지·발간사·운영체계·전체 목차, --chapters 첫 블록 앞)은 웹 게재 여부 결정 대기 → 중복·횟수 기준에서 제외(별도 집계)
const onWeb = (u) => !u.block.startsWith("FN") && +u.block.slice(1) >= CH[0][0];
const srcText = units.filter(onWeb).map((u) => norm(u.text)).join("\u0001");
const targets = [...new Set(units.filter(onWeb).map((u) => norm(u.text)).filter((t) => t.length >= 25))];
const dups = targets.map((t) => ({ t, n: count(srcText, t), shown: count(hay.body, t) })).filter((x) => x.shown > x.n);
// 횟수 부족 검사: 원문에 N번 나오는 문구가 화면엔 N번보다 적으면 일부 위치에서 누락(예: 장 표지 목차 '1. 세계경제'
// 가 본문 제목으로 한 번 있다고 통과되던 허점). 3자 이상 모든 단위 대상.
const under = [...new Set(units.filter(onWeb).map((u) => norm(u.text)).filter((t) => t.length >= 3))]
    .map((t) => ({ t, n: count(srcText, t), shown: count(hay.body, t),
        blocks: [...new Set(units.filter((u) => norm(u.text) === t).map((u) => u.block))] }))
    .filter((x) => x.shown < x.n);
console.log(`UNDER-RENDERED (shown fewer times than in source): ${under.length}`);
console.log(`DUPLICATES (shown more than in source): ${dups.length}`, dups.slice(0, 8).map((x) => `${x.shown}/${x.n} ${x.t.slice(0, 30)}`).join(" | "));
fs.writeFileSync(outFile, JSON.stringify({ url, summary, dups, under, problems: result.filter((r) => r.status === "partial" || r.status === "missing") }, null, 1));
console.table(summary);
const bad = result.filter((r) => r.status === "partial" || r.status === "missing").length;
console.log(`TOTAL units=${result.length} problems=${bad}`);
const parts = { problems: bad, under: under.length, dups: dups.length, noMarker: noMarker.length, brokenMarkers: brokenMarkers.length, tocMissing: tocMissing.length, tocTotal };
report("regression", result.length, Object.values(parts).reduce((a, b) => a + b, 0) - tocTotal, parts);
