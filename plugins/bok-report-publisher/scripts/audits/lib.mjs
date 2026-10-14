// 감사 스크립트 공통: 인자·브라우저 실행·요약 출력. 보고서(YYYYMM)마다 고치지 않도록 경로·URL 은 모두 인자로 받는다.
import fs from "node:fs";
import path from "node:path";

export const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
export const need = (k) => arg(k) ?? (console.error(`missing ${k}`), process.exit(2));
export const widths = () => arg("--widths", "1440,1024,768,390,360").split(",").map(Number);
export const outDir = () => { const d = arg("--out", "audit-out"); fs.mkdirSync(d, { recursive: true }); return d; };
export const outFile = (name) => path.join(outDir(), name);
// src/pages/reportYYYYMM → 저장소 루트(@/ 경로 해석·src 전체 검색용)
export const repoOf = (reportDir) => arg("--repo", path.resolve(reportDir, "../../.."));

// 측정 0건은 통과가 아니다: run-audits 가 마지막 줄 JSON 의 measured·defects 로 판정한다
export function summary(audit, measured, defects, extra = {}) {
    console.log(JSON.stringify({ audit, measured, defects, ...extra }));
}

// playwright 가 있으면 쓰고 없으면 puppeteer-core(verify-figure-features.mjs 와 같은 방식).
// playwright 페이지에 setViewport·networkidle0 을 맞춰 원래 puppeteer 코드를 그대로 돌린다.
export async function launch(opts = {}) {
    const executablePath = arg("--chrome", process.env.CHROME_PATH);
    try {
        const { chromium } = await import("playwright");
        const b = await chromium.launch(executablePath ? { executablePath } : {});
        const open = b.newPage.bind(b);
        b.newPage = async () => shim(await open());
        return b;
    } catch {
        const p = (await import("puppeteer-core")).default;
        return p.launch({ executablePath, headless: true, ...opts });
    }
}

function shim(page) {
    page.setViewport = ({ width, height }) => page.setViewportSize({ width, height });
    const goto = page.goto.bind(page);
    page.goto = (url, o = {}) => goto(url, { ...o, waitUntil: /^networkidle/.test(o.waitUntil || "") ? "networkidle" : o.waitUntil });
    return page;
}
