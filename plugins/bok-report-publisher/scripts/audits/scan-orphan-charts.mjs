// 미연결(고아) 차트 컴포넌트 검출기
// 실행: node scan-orphan-charts.mjs --report-dir <repo>/src/pages/reportYYYYMM [--repo <repo>]
// 정의: 자기 파일 외 어디서도 import/참조되지 않는 차트 컴포넌트 = 고아(렌더 안 됨).
import fs from 'fs';
import path from 'path';
import { need, repoOf, summary } from './lib.mjs';

const root = need('--report-dir');
// 장 폴더 이름은 보고서마다 다를 수 있어 graph/ 를 가진 하위 폴더를 모두 본다
const secs = fs.readdirSync(root).filter((s) => fs.existsSync(path.join(root, s, 'graph')));
const comps = [];
for (const s of secs) {
  const g = path.join(root, s, 'graph');
  if (fs.existsSync(g)) for (const f of fs.readdirSync(g)) if (f.endsWith('.vue')) comps.push(f.replace('.vue', ''));
}

// grep 대신 src 의 .vue/.js 를 한 번 읽어 둔다(Windows 셸에 grep 이 없을 수 있음)
const files = fs.readdirSync(path.join(repoOf(root), 'src'), { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.(vue|js)$/.test(e.name)).map((e) => [e.name, fs.readFileSync(path.join(e.parentPath ?? e.path, e.name), 'utf8')]);
const orphan = [];
const used = [];
for (const c of comps) {
  const others = files.filter(([name, text]) => name !== c + '.vue' && text.includes(c));
  if (others.length === 0) orphan.push(c); else used.push(c);
}
console.log('chart comps:', comps.length, ' used:', used.length, ' ORPHAN:', orphan.length);
if (orphan.length) console.log('ORPHANS:', orphan.join(', '));
summary('scan-orphan-charts', comps.length, orphan.length);
