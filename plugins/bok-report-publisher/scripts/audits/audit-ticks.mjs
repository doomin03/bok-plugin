import fs from "fs";
import path from "path";
import { need, repoOf, summary } from "./lib.mjs";
// Replicate every tick helper + its required format, run on each chart's real data.
// 사용: node audit-ticks.mjs --report-dir <repo>/src/pages/reportYYYYMM [--repo <repo>]
const DIR = need("--report-dir"), SRC_PAGES = path.join(repoOf(DIR), "src/pages");
const R = {
  getMonthStartTicks: { fmt: "YYYY-MM-DD|YYYYMxx", fn: (a, k, mo = [1, 7]) => { const m = new Map(); a.forEach(it => { const s = String(it[k]); const y = +s.slice(0, 4), mm = +s.slice(5, 7), d = +s.slice(8, 10) || 1; if (!mo.includes(mm)) return; const kk = y + "-" + mm; if (!m.has(kk)) m.set(kk, Date.UTC(y, mm - 1, d)); }); return [...m.values()]; } },
  getMonthTicksFromMonthlyData: { fmt: "YYYYMxx", fn: (a, k, mo = [1, 7]) => { const m = new Map(); a.forEach(it => { const x = String(it[k]).match(/^(\d{4})M(\d{2})$/); if (!x) return; const y = +x[1], mm = +x[2]; if (!mo.includes(mm)) return; const kk = y + "-" + mm; if (!m.has(kk)) m.set(kk, Date.UTC(y, mm - 1, 1)); }); return [...m.values()]; } },
  getHalfYearTicksFromHalfYearData: { fmt: "YYYYHx", fn: (a, k, hv = [1]) => { const m = new Map(); a.forEach(it => { const x = String(it[k] ?? "").match(/^(\d{4})H([1-2])$/); if (!x) return; const h = +x[2]; if (!hv.includes(h)) return; const kk = x[1] + "-H" + h; if (!m.has(kk)) m.set(kk, Date.UTC(+x[1], (h === 1 ? 1 : 7) - 1, 1)); }); return [...m.values()]; } },
  getQuarterTicks: { fmt: "YYYYQx", fn: (a, k) => a.filter(it => /^(\d{4})Q([1-4])$/.test(String(it[k]))).map(() => 1) },
  getYearTicksFromDateString: { fmt: "^\\d{4}", fn: (a, k, iv = 1) => { const ys = []; const seen = new Set(); a.forEach(it => { const x = String(it[k] ?? "").match(/^(\d{4})/); if (!x) return; const y = +x[1]; if (seen.has(y)) return; seen.add(y); ys.push(y); }); return ys.filter((_, i) => i % iv === 0); } },
  getYearTicks: { fmt: "^\\d{4}", fn: (a, k, iv = 1) => { const ys = []; const seen = new Set(); a.forEach(it => { const y = Number(String(it[k] ?? "").slice(0, 4)); if (!y || seen.has(y)) return; seen.add(y); ys.push(y); }); return ys.filter((_, i) => i % iv === 0); } },
};
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = d + "/" + e.name; if (e.isDirectory()) walk(p); else if (/SHEET[\d_]+Component\.vue$/.test(e.name)) files.push(p); } })(DIR);
const loadArr = (src, v) => { const im = src.match(new RegExp("import " + v + " from [\"']([^\"']+)[\"']")); if (!im) return null; const p = im[1].replace("@/pages", SRC_PAGES); if (!fs.existsSync(p)) return null; const d = JSON.parse(fs.readFileSync(p, "utf8")); return Array.isArray(d) ? d : (d.main || Object.values(d).find(Array.isArray) || []); };
const problems = []; const custom = [];
for (const f of files.sort()) {
  const src = fs.readFileSync(f, "utf8"); const name = f.match(/SHEET[\d_]+/)[0];
  let hit = null;
  for (const fn of Object.keys(R)) { const m = src.match(new RegExp(fn + "\\((\\w+)")); if (m) { hit = { fn, dataVar: m[1] }; break; } }
  if (!hit) { custom.push(name); continue; }
  const arr = loadArr(src, hit.dataVar);
  if (!arr) { console.log(name, hit.fn, "DATA-NOT-FOUND"); problems.push(name); continue; }
  const dkey = (src.match(new RegExp(hit.fn + "\\(\\w+,\\s*[\"'](\\w+)[\"']")) || [])[1] || "date";
  const fmt = String(arr[0]?.[dkey] ?? arr[0]?.date);
  const ticks = R[hit.fn].fn(arr, dkey);
  const ok = ticks.length > 0;
  console.log(name.padEnd(13), "fmt=" + JSON.stringify(fmt).padEnd(14), hit.fn.padEnd(30), "expect=" + R[hit.fn].fmt.padEnd(16), "ticks=" + ticks.length, ok ? "OK" : "*** BLANK ***");
  if (!ok) problems.push(name);
}
console.log("\n=== tick-helper charts: problems =", problems.length, problems.join(","));
console.log("=== custom x-axis (toUTC/axis/categories, verified separately):", custom.length, "\n  " + custom.join(", "));
summary("audit-ticks", files.length - custom.length, problems.length, { custom: custom.length });
