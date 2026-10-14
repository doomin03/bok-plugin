// 보고서 차트 정적 결함 스캐너 — 축/데이터필드 대조
// 실행: node scan-chart-fidelity.mjs --report-dir <repo>/src/pages/reportYYYYMM [--repo <repo>]
// 규칙: 모든 JSON import 키 union 대조 + 옵션 프로퍼티 화이트리스트로 오탐 제거.
import fs from 'fs';
import path from 'path';
import { need, repoOf, summary } from './lib.mjs';

const root = need('--report-dir');
const SRC = path.join(repoOf(root), 'src') + '/'; // @/ 별칭 해석용
// 장 폴더 이름은 보고서마다 다를 수 있어 graph/ 를 가진 하위 폴더를 모두 본다
const secs = fs.readdirSync(root).filter((s) => fs.existsSync(path.join(root, s, 'graph')));
const comps = [];
for (const s of secs) {
  const g = path.join(root, s, 'graph');
  if (fs.existsSync(g)) for (const f of fs.readdirSync(g)) if (f.endsWith('.vue')) comps.push([s, path.join(g, f)]);
}
// 데이터가 아닌 Highcharts 옵션 키(오탐 원인) — 대조에서 제외
const OPT = new Set(['style', 'marginTop', 'marginBottom', 'distance', 'color', 'name', 'position', 'id', 'type', 'value', 'enabled', 'text', 'x', 'y', 'align', 'rotation', 'offset', 'width', 'dashStyle', 'zIndex', 'key', 'k', 'from', 'to', 'data', 'series', 'yAxis', 'xAxis', 'category', 'length', 'label', 'labels', 'format', 'formatter']);

const rows = [];
for (const [sec, c] of comps) {
  const src = fs.readFileSync(c, 'utf8');
  const name = path.basename(c);
  const imports = [...src.matchAll(/from\s+["'](@\/[^"']+\.json)["']/g)].map((m) => m[1].replace(/^@\//, SRC));
  const keys = new Set();
  let jerr = false;
  for (const j of imports) {
    if (!fs.existsSync(j)) { jerr = true; continue; }
    try { const a = JSON.parse(fs.readFileSync(j, 'utf8')); const first = Array.isArray(a) ? a[0] : a; if (first) Object.keys(first).forEach((k) => keys.add(k)); }
    catch { jerr = true; }
  }
  const refs = new Set();
  for (const m of src.matchAll(/this\.toNumber\(\s*item\.([A-Za-z0-9_]+)/g)) refs.add(m[1]);
  for (const m of src.matchAll(/Number\([^)]*item\.([A-Za-z0-9_]+)/g)) refs.add(m[1]);
  for (const m of src.matchAll(/item\.([A-Za-z0-9_]+)\s*==\s*null/g)) refs.add(m[1]);
  const missing = [...refs].filter((k) => k !== 'date' && !keys.has(k) && !OPT.has(k));
  const hasY = /yAxis\s*:/.test(src);
  const minmax = /\bmin\s*:/.test(src) && /\bmax\s*:/.test(src);
  const issues = [];
  if (jerr) issues.push('JSON_ERR');
  if (missing.length) issues.push('DATA_MISMATCH:' + missing.join(','));
  if (!hasY) issues.push('NO_YAXIS');
  if (!minmax) issues.push('NO_MINMAX');
  if (issues.length) rows.push(`${sec}/${name}\t${issues.join(' | ')}`);
}
console.log('scanned', comps.length, 'issues', rows.length);
console.log(rows.join('\n'));
summary('scan-chart-fidelity', comps.length, rows.length);
