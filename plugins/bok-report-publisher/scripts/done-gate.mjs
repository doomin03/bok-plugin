// 완료 관문: "완료"라고 보고하기 전에 증거 파일·감사 결과·원본 특징 대조를 한 번에 검사한다.
// usage: node done-gate.mjs --evidence <evidence.md> [--audits <audits.json>] [--figure-check <figure-check.json>]
// 하나라도 실패하면 exit 1 과 사유 목록. 통과해도 오너 수락은 아니다(오너 판단은 별도).
import fs from 'node:fs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const problems = [];
const read = (p, json) => { try { const s = fs.readFileSync(p, 'utf8'); return json ? JSON.parse(s) : s; } catch (e) { problems.push(`${p}: 읽을 수 없음 (${e.message})`); return null; } };

// 1) 증거 파일: 완료 6단계가 모두 적혀 있고, 폭 5개가 모두 나온다
const DOD = [['원본 요소', 'source feature'], ['형제', 'sibling'], ['폭', 'width'], ['기준', 'source of rule'], ['범위', 'scope'], ['착지', 'landing']];
const WIDTHS = ['1440', '1024', '768', '390', '360'];
const evidence = arg('--evidence') ? read(arg('--evidence')) : (problems.push('--evidence 필요'), null);
if (evidence) {
  for (const names of DOD) if (!names.some((n) => evidence.toLowerCase().includes(n.toLowerCase()))) problems.push(`증거에 완료 단계 없음: ${names[0]}`);
  for (const w of WIDTHS) if (!evidence.includes(w)) problems.push(`증거에 폭 ${w} 없음`);
  if (/\b(TODO|TBD)\b|미작성/.test(evidence)) problems.push('증거에 미작성 항목(TODO/TBD/미작성)이 남아 있음');
}

// 2) 감사: 측정 0건은 통과가 아니다
if (arg('--audits')) {
  const a = read(arg('--audits'), true), rows = Array.isArray(a) ? a : a?.audits || [];
  if (a && !rows.length) problems.push('감사 결과가 비어 있음');
  for (const r of rows) {
    const name = r.audit || r.name;
    // run-audits 의 skipped(입력 없음)·error 도 미검증이다
    if (/^(skipped|error)/.test(r.status || '')) problems.push(`감사 ${name}: ${r.status}`);
    else if (!(r.measured > 0)) problems.push(`감사 ${name}: 측정 0건(측정 실패)`);
    if (r.defects > 0) problems.push(`감사 ${name}: 결함 ${r.defects}건`);
  }
}

// 3) 원본 특징 대조: 실패는 고치거나 오너 예외(accepted)로 바꿔야 한다
if (arg('--figure-check')) {
  const rows = read(arg('--figure-check'), true) || [];
  for (const r of rows.filter((x) => x.status === 'fail'))
    problems.push(`특징 불일치 ${r.chart} (${r.width}px): ${r.checks.filter((c) => c.status === 'fail').map((c) => c.feature).join('; ')}`);
}

console.log(JSON.stringify({ pass: !problems.length, problems }, null, 1));
if (problems.length) process.exitCode = 1;
