// 역방향 텍스트 대조: 화면 본문의 글 단위(문단·목록·표 칸·제목·그림/표 제목·주·자료)가 DOCX 원문에 그대로 있는지.
// regression.mjs(원문→화면, 누락) 의 반대 방향 — 원문과 다르게 바뀐 글자·원문에 없는 글(이전 보고서 잔재)을 찾는다.
// usage: node reverse-text.mjs --url <report url> --units <source-units.json> [--width 1440] [--out dir] [--chrome path]
import fs from "node:fs";
import { arg, need, launch, outFile as out, summary } from "./lib.mjs";

const url = need("--url"), outFile = out("reverse-text.json"), width = arg("--width", "1440");
// regression.mjs 와 같은 정규화. 원문은 문단 경계 없이 잇는다(표 칸 "2.3"↵"(0.1)" 이 화면에선 한 칸)
const norm = (s) => s.replace(/\s+/g, "").replace(/￭/g, "")
    .replace(/Ⅳ/g, "IV").replace(/Ⅲ/g, "III").replace(/Ⅱ/g, "II").replace(/Ⅰ/g, "I")
    .replace(/[∙‧·ㆍᆞ・]/g, "·").replace(/[∼～]/g, "~").replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
const SRC = norm(JSON.parse(fs.readFileSync(need("--units"), "utf8")).map((u) => u.text).join(""));
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: 900 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 180000 });
await page.waitForSelector(".report-area", { timeout: 60000 });
const blocks = await page.evaluate(() => {
    const SEL = "p, li, td, th, h1, h2, h3, h4, h5, h6, dt, dd, caption, .chart-info > span, .table-info > span, .chart-footnote, .table-footnote, .img-info > span";
    const area = document.querySelector(".report-area");
    const els = [...area.querySelectorAll(SEL)].filter((el) => !el.closest(".highcharts-container, svg"));
    const set = new Set(els);
    const leafs = els.filter((el) => ![...el.querySelectorAll(SEL)].some((d) => set.has(d)));
    const text = (el) => {
        const c = el.cloneNode(true);
        c.querySelectorAll(".footnote-marker").forEach((m) => m.remove());
        return c.textContent;
    };
    const anchor = (el) => el.closest("[id]")?.id || "";
    // parts: 자식 조각별 글(자료+단위 span, 번호+문단처럼 화면에서만 붙는 조각을 따로 대조)
    const parts = (el) => [...el.childNodes].filter((n) => !n.classList?.contains("footnote-marker")).map((n) => n.textContent).filter((t) => t.trim());
    return leafs.map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").split(" ")[0], where: anchor(el), text: text(el), parts: parts(el) }))
        .filter((b) => b.text.trim());
});
await browser.close();
// 원문에 없는 화면 글 = 바뀐 글자·이전 보고서 잔재 후보
const foreign = blocks.filter((b) => !SRC.includes(norm(b.text)) && !b.parts.every((p) => SRC.includes(norm(p))));
fs.writeFileSync(outFile, JSON.stringify({ blocks, foreign }, null, 1));
console.log(`blocks ${blocks.length} → ${outFile}`);
foreign.slice(0, 30).forEach((b) => console.log(` NOT IN SOURCE ${b.where} <${b.tag}> ${b.text.replace(/\s+/g, " ").trim().slice(0, 80)}`));
summary("reverse-text", blocks.length, foreign.length);
