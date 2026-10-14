// scan-clip.mjs — flag charts whose yAxis range clips actual data.
// Catches the "mapped image was wrong, axis capped below data" trap (e.g. SHEET115).
// Heuristic (multi-axis safe): flag when data max > max(all axis max) or
// data min < min(all axis min). Gross clipping only -> no multi-axis false positives.
// Usage: node scan-clip.mjs --report-dir <repo>/src/pages/reportYYYYMM
import fs from "fs";
import path from "path";
import { need, summary } from "./lib.mjs";
const ROOT = need("--report-dir");
const nums = (s) => [...s.matchAll(/\b(min|max):\s*(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]);
function dataRange(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  let mn = Infinity, mx = -Infinity;
  const scan = (a) => a.forEach((it) => it && typeof it === "object" &&
    Object.entries(it).forEach(([k, v]) => {
      if (k === "date" || k === "isForecast") return;
      const n = Number(String(v).replace(/,/g, ""));
      if (Number.isFinite(n)) { mn = Math.min(mn, n); mx = Math.max(mx, n); }
    }));
  if (Array.isArray(j)) scan(j);
  else Object.values(j).forEach((v) => { if (Array.isArray(v)) scan(v); else if (v && typeof v === "object") Object.values(v).forEach((w) => Array.isArray(w) && scan(w)); });
  return [mn, mx];
}
const comps = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (/SHEET\d+Component\.vue$/.test(e.name)) comps.push(p);
} })(ROOT);
let flags = 0, compared = 0;
for (const c of comps) {
  const m = path.basename(c).match(/SHEET(\d+)/); if (!m) continue;
  const src = fs.readFileSync(c, "utf8");
  const pairs = nums(src);
  const mins = pairs.filter((p) => p[0] === "min").map((p) => p[1]);
  const maxs = pairs.filter((p) => p[0] === "max").map((p) => p[1]);
  if (!mins.length || !maxs.length) continue; // auto-scale: never clips
  const dir = path.dirname(c).replace(/graph$/, "graphData");
  const df = path.join(dir, `sheet${Number(m[1])}Data.json`);
  if (!fs.existsSync(df)) continue;
  let dr; try { dr = dataRange(df); } catch { continue; }
  const [dmn, dmx] = dr;
  if (!Number.isFinite(dmn)) continue;
  const axisMin = Math.min(...mins), axisMax = Math.max(...maxs);
  const eps = 1e-9;
  compared++; // 축 고정값과 데이터 파일이 둘 다 있어 실제로 대조한 차트
  if (dmx > axisMax + eps || dmn < axisMin - eps) {
    flags++;
    console.log(`CLIP  SHEET${m[1]}  data[${dmn},${dmx}] outside axis[${axisMin},${axisMax}]  ${c}`);
  }
}
console.log(`\nscanned ${comps.length} charts, compared ${compared}, clipping flags: ${flags}`);
summary("scan-clip", compared, flags, { scanned: comps.length });
process.exit(flags ? 1 : 0);
