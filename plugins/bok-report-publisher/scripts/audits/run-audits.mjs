// 감사 일괄 실행: 브라우저 감사·소스 스캔을 같은 인자로 돌려 <out>/audits.json·audits.md 를 쓴다.
// 결함이 있거나(defects>0) 잰 것이 0건(measured==0)이면 exit 1. 필요한 입력이 없는 감사는 skipped 로 표에 남긴다.
// usage: node run-audits.mjs --url <report url> --report-dir <repo>/src/pages/reportYYYYMM [--widths 1440,1024,768,390,360]
//        [--out dir] [--chrome path] [--units source-units.json] [--docx-json docxContent.json]
//        [--chapters 14:overview,...] [--stray-blocks B0501] [--base-url <기존 보고서 url>] [--document document.json]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { arg, outDir } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = outDir();
// [파일, 필수 인자, 선택 인자]
const AUDITS = [
    ["audit.mjs", ["--url", "--docx-json", "--units", "--chapters"], ["--stray-blocks"]],
    ["regression.mjs", ["--url", "--units", "--chapters"], ["--report-dir"]],
    ["footnote-map.mjs", ["--url", "--units"]], ["reverse-text.mjs", ["--url", "--units"]],
    ...["axis-title-audit", "axis-title-overlap", "bar-gap-audit", "legend-overlap", "responsive-audit", "audit-axis-clip", "audit-band-edge"]
        .map((n) => [`${n}.mjs`, ["--url"]]),
    ["font-audit.mjs", ["--url", "--base-url"]], ["style-parity-audit.mjs", ["--url", "--base-url"]],
    ...["audit-ticks", "scan-axis-tick", "scan-chart-fidelity", "scan-clip", "scan-dualaxis-zeroline", "scan-orphan-charts"]
        .map((n) => [`${n}.mjs`, ["--report-dir"]]),
    ["notes_audit.py", ["--report-dir"]], ["scan-source-tables.mjs", ["--document"]],
];
const pass = (ks) => ks.flatMap((k) => (arg(k) ? [k, arg(k)] : []));
fs.mkdirSync(path.join(out, "logs"), { recursive: true });
const rows = AUDITS.map(([file, req, opt = []]) => {
    const audit = file.replace(/\.(mjs|py)$/, ""), lack = req.filter((k) => !arg(k));
    if (lack.length) return { audit, measured: null, defects: null, status: `skipped (${lack.join(" ")} 없음)` };
    const py = file.endsWith(".py"), bin = py ? (process.platform === "win32" ? "python" : "python3") : process.execPath;
    const args = [path.join(here, file), ...pass([...req, ...opt]), ...(py ? [] : pass(["--widths", "--out", "--chrome", "--repo"]))];
    console.error(`> ${audit}`);
    const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 256 << 20, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    fs.writeFileSync(path.join(out, "logs", `${audit}.log`), `${r.stdout}\n${r.stderr}`);
    const last = (r.stdout || "").trim().split("\n").reverse().find((l) => l.startsWith("{"));
    const s = last ? JSON.parse(last) : null;
    if (!s) return { audit, measured: null, defects: null, status: `error (exit ${r.status}, logs/${audit}.log)` };
    const status = s.measured === 0 ? "fail (측정 0건)" : s.defects > 0 ? "fail" : "pass";
    return { audit, measured: s.measured, defects: s.defects, status };
});
fs.writeFileSync(path.join(out, "audits.json"), JSON.stringify(rows, null, 1));
const md = ["| audit | measured | defects | status |", "|---|---|---|---|", ...rows.map((r) => `| ${r.audit} | ${r.measured ?? "-"} | ${r.defects ?? "-"} | ${r.status} |`)];
fs.writeFileSync(path.join(out, "audits.md"), md.join("\n") + "\n");
console.log(md.join("\n"));
process.exit(rows.some((r) => /^(fail|error)/.test(r.status)) ? 1 : 0);
