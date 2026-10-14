// 각주 번호별 대조: 화면의 각주 표시 N 을 눌렀을 때 뜨는 팝업 내용이 DOCX 각주 N 원문과 같은지,
// 그리고 어느 표시에서도 열리지 않는 팝업(이전 보고서 잔재)이 있는지.
// usage: node footnote-map.mjs --url <report url> --units <source-units.json> [--out dir] [--chrome path]
import fs from "node:fs";
import { need, launch, outFile as out, summary } from "./lib.mjs";

const url = need("--url"), outFile = out("footnote-map.json");
const UNITS = need("--units");
const norm = (s) => s.replace(/\s+/g, "").replace(/[∙‧·ㆍᆞ・]/g, "·").replace(/[∼～]/g, "~")
    .replace(/[“”]/g, "\"").replace(/[‘’]/g, "'").replace(/[｢「]/g, "「").replace(/[｣」]/g, "」")
    .replace(/Ⅳ/g, "IV").replace(/Ⅲ/g, "III").replace(/Ⅱ/g, "II").replace(/Ⅰ/g, "I");

// DOCX 각주: 블록 FN<id> 의 문단들을 이어 붙인 것
const src = {};
for (const u of JSON.parse(fs.readFileSync(UNITS, "utf8"))) {
    if (u.block.startsWith("FN")) (src[u.block.slice(2)] ||= []).push(u.text);
}

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
await page.waitForSelector(".report-area", { timeout: 60000 });
const { markers, tips } = await page.evaluate(() => ({
    markers: [...document.querySelectorAll(".report-area .tooltip-btn")].map((a) => ({ id: a.textContent.trim(), target: a.getAttribute("data-toggle-btn") })),
    tips: Object.fromEntries([...document.querySelectorAll("[data-toggle-content]")].map((t) => [t.getAttribute("data-toggle-content"), t.querySelector(".tooltip-body")?.textContent || t.textContent])),
}));
await browser.close();

const wrong = [];
const byId = {};
for (const m of markers) (byId[m.id] ||= new Set()).add(m.target);
for (const [id, parts] of Object.entries(src)) {
    const want = norm(parts.join(""));
    for (const target of byId[id] || []) {
        const got = norm(tips[target] || "");
        if (got !== want) wrong.push({ id, target, want: parts.join(" ").slice(0, 120), got: (tips[target] || "").replace(/\s+/g, " ").trim().slice(0, 120) });
    }
    if (!byId[id]) wrong.push({ id, target: null, want: parts.join(" ").slice(0, 120), got: "표시 없음" });
}
const used = new Set(markers.map((m) => m.target));
const orphan = Object.keys(tips).filter((k) => !used.has(k)).map((k) => ({ target: k, text: tips[k].replace(/\s+/g, " ").trim().slice(0, 100) }));
fs.writeFileSync(outFile, JSON.stringify({ sourceFootnotes: Object.keys(src).length, markers: markers.length, wrong, orphan }, null, 1));
console.log(`source footnotes ${Object.keys(src).length} | markers ${markers.length} | wrong popup ${wrong.length} | orphan popups ${orphan.length}`);
wrong.slice(0, 30).forEach((w) => console.log(` WRONG ${w.id}→${w.target}\n   want: ${w.want}\n   got : ${w.got}`));
orphan.slice(0, 30).forEach((o) => console.log(` ORPHAN ${o.target}: ${o.text}`));
// 측정 = 원문 각주 수(화면 표시 0개여도 원문 각주마다 '표시 없음'으로 잡힌다)
summary("footnote-map", Object.keys(src).length, wrong.length + orphan.length, { markers: markers.length, wrong: wrong.length, orphan: orphan.length });
