#!/usr/bin/env node
// 표 정합 가드: start-report 의 document.json 에서 "표 X-N" 캡션마다 렌더 가능한 그리드가 있는지 검증.
// 원인: DOCX 추출이 표를 nestedTables(정상)와 paragraphs 평탄화본(중복) 두 벌로 저장 → 렌더는 nestedTables 로 함.
// 캡션마다 dataTables(행>=3, 열>=2) 그리드 또는 rows 가 같은 블록에 있는지 확인한다.
// 사용: node scan-source-tables.mjs --document <openspec/changes/<start>/sources/document.json>
import fs from "node:fs";
import { need, summary } from "./lib.mjs";

const path = need("--document");
const doc = JSON.parse(fs.readFileSync(path, "utf8"));
const blocks = doc.blocks || [];

const N = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const dataTables = (b) =>
  (b.nestedTables || []).filter((rows) => {
    const w = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 1), 0);
    return rows.length >= 3 && w >= 2;
  });
const realRows = (b) =>
  Array.isArray(b.rows) && b.rows.some((r) => Array.isArray(r) && r.length >= 2);
const labelOf = (p) => {
  const m = N(p).match(/^표\s*([ⅠⅡⅢⅣI]+V?)\s*-\s*(\d+)/);
  if (!m) return null;
  return `${m[1].replace(/Ⅰ/g, "I").replace(/Ⅱ/g, "II").replace(/Ⅲ/g, "III").replace(/Ⅳ/g, "IV")}-${m[2]}`;
};

// 기대 목록은 보고서마다 다르므로 원문 캡션에서 모은다(같은 번호는 한 번)
const EXPECTED = [...new Set(blocks.flatMap((b) => (b.paragraphs || []).map(labelOf).filter(Boolean)))];
const missing = [];
for (const label of EXPECTED) {
  const block = blocks.find((b) => (b.paragraphs || []).some((p) => labelOf(p) === label));
  const ok = block && (realRows(block) || dataTables(block).length > 0);
  if (!ok) missing.push(label);
}

if (missing.length) console.error(`표 누락/렌더불가 ${missing.length}건: ${missing.map((l) => "표 " + l).join(", ")}`);
else console.log(`통계표 ${EXPECTED.length}개 전부 렌더 가능(누락 0). source: ${path}`);
summary("scan-source-tables", EXPECTED.length, missing.length);
process.exit(missing.length ? 1 : 0);
