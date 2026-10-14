// DOCX(docxContent.json·source-units.json) 기준 대조. 결과: summary + 항목별 문제 목록.
import fs from "node:fs";
import { arg, need } from "./lib.mjs";

const DOCX = JSON.parse(fs.readFileSync(need("--docx-json"), "utf8"));
const UNITS = JSON.parse(fs.readFileSync(need("--units"), "utf8"));
// --chapters "14:overview,55:policy-conditions,…" = 장 시작 블록 번호:장 h2 id. 첫 번호 앞(표지·발간사 등)은 게재 결정 대기라 뺀다
const CH = need("--chapters").split(",").map((s) => s.split(":")).map(([n, id]) => [Number(n), id]);
const FIRST = CH[0][0];
// 원문 잔재 표가 든 블록(extract 의 _review 대상): 그 블록 문구는 화면에 없어도 통과
const STRAY_BLOCKS = new Set(arg("--stray-blocks", "").split(",").filter(Boolean));
export const norm = (s = "") => String(s).replace(/\s+/g, "").replace(/￭/g, "")
    .replace(/Ⅳ/g, "IV").replace(/Ⅲ/g, "III").replace(/Ⅱ/g, "II").replace(/Ⅰ/g, "I")
    .replace(/[∙‧·ㆍᆞ・]/g, "·").replace(/[∼～]/g, "~").replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
const text = (parts = []) => parts.map((p) => (p.t === "note" ? "" : p.v)).join("");
const num = (id) => Number(String(id).slice(1));
const blocks = Object.entries(DOCX).filter(([id]) => id.startsWith("B") && num(id) >= FIRST); // 앞부분은 게재 결정 대기
const STRAY = new Set((DOCX._review || []).map((r) => norm(r.title)));
export const chapterOf = (n) => CH.filter(([s]) => n >= s).pop()?.[1] ?? CH[0][1];

// 그림: 제목·자료·주가 그 그림에 원문대로 붙어 있고 차트/이미지가 실제로 그려졌는지
function figures(rendered) {
    const out = { total: 0, ok: 0, problems: [] };
    blocks.forEach(([id, e]) => (e.items || []).filter((it) => it.kind === "figure").forEach((fig) => {
        out.total += 1;
        const cap = norm(text(fig.caption));
        const same = (r) => !r.matched && (norm(r.title).endsWith(cap) || norm(r.title).includes(cap));
        const hit = rendered.figures.find((r) => same(r) && r.chapter === chapterOf(num(id))) || rendered.figures.find(same);
        if (!hit) { out.problems.push({ block: id, figure: text(fig.caption), issue: "그림 없음" }); return; }
        hit.matched = true;
        let notes = norm(fig.notes.map(text).join(" "));
        let source = norm(fig.source);
        const glued = notes.indexOf("자료:"); // "주: 1) … 자료: …" 가 한 문단에 붙은 원문
        if (glued >= 0) { source = source || notes.slice(glued); notes = notes.slice(0, glued); }
        const issues = [];
        if (norm(hit.source) !== source) issues.push(`자료 불일치: 화면「${hit.source}」 원문「${fig.source || source}」`);
        if (norm(hit.notes) !== notes) issues.push(`주 불일치: 화면「${hit.notes.slice(0, 80)}」 원문「${fig.notes.map(text).join(" ").slice(0, 80)}」`);
        const drawnOk = hit.charts ? hit.drawn >= hit.charts : hit.images.length > 0 && hit.images.every((i) => i.ok);
        if (!drawnOk) issues.push(`표시 안 됨(차트 ${hit.drawn}/${hit.charts}, 이미지 ${hit.images.filter((i) => i.ok).length}/${hit.images.length})`);
        if (issues.length) out.problems.push({ block: id, figure: text(fig.caption), issue: issues.join(" / ") });
        else out.ok += 1;
    }));
    rendered.figures.filter((r) => !r.matched).forEach((r) => out.problems.push({ figure: r.title, issue: "원문에 없는 그림(사이트에만 있음)" }));
    return out;
}

// 표: DOCX 데이터 표마다 화면 표를 찾아 행별 셀 텍스트와 병합(colspan/rowspan)까지 비교
function tables(rendered) {
    const out = { total: 0, ok: 0, structureOnly: 0, problems: [] };
    const docxTables = [];
    blocks.forEach(([id, e]) => (e.items || []).forEach((it) => {
        if (it.kind === "table" && it.rows?.length && !STRAY.has(norm(it.title))) docxTables.push({ id, it });
    }));
    Object.entries(DOCX._footnotes).forEach(([fid, f]) => (f.items || []).forEach((it) => it.rows && docxTables.push({ id: `FN${fid}`, it })));
    const cellsOf = (rows) => rows.map((r) => r.map((c) => norm(c.t ?? text(c.parts))).filter(Boolean).join("|"));
    const spansOf = (rows) => rows.map((r) => r.map((c) => `${c.cs ?? c.colspan}/${c.rs ?? c.rowspan}`).join(","));
    docxTables.forEach(({ id, it }) => {
        // 장 표지 절 목차(각 장 시작 블록)는 표가 아니라 목록으로 싣는다
        if (CH.slice(1).some(([s]) => num(id) === s)) return;
        out.total += 1;
        if (it.rows.length === 1 && it.rows[0].length === 1) { // 1칸 상자(부록 제목 상자·판권 등): 표가 아니라 문구로 확인
            const words = norm(text(it.rows[0][0].parts));
            const ch = id.startsWith("FN") ? rendered.tips : rendered.chapters[chapterOf(num(id))] || "";
            if (norm(ch).includes(words)) out.ok += 1;
            else out.problems.push({ block: id, table: words.slice(0, 40), issue: "상자 문구 없음" });
            return;
        }
        const want = cellsOf(it.rows).filter(Boolean);
        const cap = norm(text(it.caption || []) || it.title || "");
        const cands = rendered.tables.filter((t) => !t.used);
        const hit = cands.find((t) => cap && norm(t.caption).includes(cap) && norm(t.caption).length <= cap.length + 40)
            || cands.find((t) => cellsOf(t.rows).filter(Boolean).slice(0, 2).join() === want.slice(0, 2).join());
        if (!hit) { out.problems.push({ block: id, table: text(it.caption || []) || it.title || want[0], issue: "표 없음" }); return; }
        hit.used = true;
        const got = cellsOf(hit.rows).filter(Boolean);
        const lost = want.filter((row) => !got.includes(row));
        if (lost.length) out.problems.push({ block: id, table: text(it.caption || []) || it.title, issue: `행 불일치 ${lost.length}건`, sample: lost.slice(0, 3) });
        else if (spansOf(hit.rows).join(";") !== spansOf(it.rows).join(";")) out.structureOnly += 1;
        else out.ok += 1;
    });
    return out;
}

// 각주 위치: 원문에서 각주 앞 10자 + 번호가 화면의 같은 문맥에 있는지
function footnotes(rendered) {
    const out = { total: 0, ok: 0, problems: [] };
    const corpus = norm(rendered.markedCorpus);
    const visit = (id, parts) => {
        let before = "";
        (parts || []).forEach((p) => {
            if (p.t !== "note") { before += norm(p.v); return; }
            out.total += 1;
            const ctx = `${before.slice(-10)}⟦${p.id}⟧`;
            if (corpus.includes(ctx)) out.ok += 1;
            else out.problems.push({ block: id, note: p.id, expectedAfter: before.slice(-20) });
            before += `⟦${p.id}⟧`; // 연달아 붙은 각주(⟦36⟧ 등으로 MMF⟦37⟧)도 문맥에 포함
        });
    };
    const walk = (id, node) => {
        if (Array.isArray(node) && node[0]?.t) return visit(id, node); // 캡션·제목처럼 조각 배열 자체
        if (Array.isArray(node)) return node.forEach((x) => walk(id, x));
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node.parts)) return visit(id, node.parts);
        Object.values(node).forEach((v) => walk(id, v));
    };
    blocks.forEach(([id, e]) => { visit(id, e.main); walk(id, e.items); });
    return out;
}

// 장별 텍스트: 원문 단위가 '자기 장' 안에서 원문 횟수만큼 나오는지(다른 장에 같은 문구가 있어 통과하는 허점 차단)
function chapterText(rendered) {
    const out = { total: 0, ok: 0, problems: [] };
    const count = (hay, t) => (t ? hay.split(t).length - 1 : 0);
    const byChapter = {};
    UNITS.forEach((u) => {
        if (u.block.startsWith("FN")) return;
        const n = num(u.block);
        if (n < FIRST) return;
        (byChapter[chapterOf(n)] ||= []).push(u);
    });
    Object.entries(byChapter).forEach(([ch, units]) => {
        const src = units.map((u) => norm(u.text)).join("\u0001");
        const shown = norm(rendered.chapters[ch] || "");
        [...new Set(units.map((u) => norm(u.text)).filter((t) => t.length >= 2))].forEach((t) => {
            out.total += 1;
            if (STRAY.has(t) || [...STRAY].some((s) => units.some((u) => STRAY_BLOCKS.has(u.block) && norm(u.text) === t))) { out.ok += 1; return; }
            const want = count(src, t), got = count(shown, t);
            if (got >= want) out.ok += 1;
            else out.problems.push({ chapter: ch, text: t.slice(0, 60), want, got, blocks: [...new Set(units.filter((u) => norm(u.text) === t).map((u) => u.block))].slice(0, 4) });
        });
    });
    // 각주 내용: 각주 문단이 팝업 안에 있는지
    const tips = norm(rendered.tips);
    UNITS.filter((u) => u.block.startsWith("FN")).forEach((u) => {
        out.total += 1;
        if (tips.includes(norm(u.text))) out.ok += 1;
        else out.problems.push({ chapter: "각주", text: u.text.slice(0, 60), blocks: [u.block] });
    });
    return out;
}

export function compare(rendered) {
    const result = { figures: figures(rendered), tables: tables(rendered), footnotes: footnotes(rendered), text: chapterText(rendered) };
    const summary = Object.fromEntries(Object.entries(result).map(([k, v]) => [k, { total: v.total, ok: v.ok, problems: v.problems.length, ...(v.structureOnly ? { structureOnly: v.structureOnly } : {}) }]));
    return { summary, ...result };
}
