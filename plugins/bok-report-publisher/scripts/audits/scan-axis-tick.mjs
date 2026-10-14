// 축 min/max ↔ tickPositions 정합 검사 (역전·클리핑·끝값·불균등간격 검출)
// 실행: node scan-axis-tick.mjs --report-dir <repo>/src/pages/reportYYYYMM
import fs from 'fs';import path from 'path';
import { need, summary } from './lib.mjs';
const DIR=need('--report-dir');
// 장 폴더 이름은 보고서마다 다를 수 있어 graph/ 를 가진 하위 폴더를 모두 본다
const secs=fs.readdirSync(DIR).filter(s=>fs.existsSync(path.join(DIR,s,'graph')));
const rows=[];let axes=0;
for(const s of secs){const g=path.join(DIR,s,'graph');if(!fs.existsSync(g))continue;
 for(const f of fs.readdirSync(g)){if(!f.endsWith('.vue'))continue;
  const src=fs.readFileSync(path.join(g,f),'utf8');
  const re=/min:\s*(-?[\d.]+)[\s\S]{0,200}?max:\s*(-?[\d.]+)[\s\S]{0,320}?tickPositions:\s*\[([^\]]+)\]/g;
  let m;
  while((m=re.exec(src))){
    const mn=parseFloat(m[1]), mx=parseFloat(m[2]);
    const ticks=m[3].split(',').map(t=>parseFloat(t.trim())).filter(t=>!isNaN(t));
    if(ticks.length<2)continue;
    axes++;
    const probs=[];
    if(ticks[0]!==mn)probs.push(`첫틱${ticks[0]}≠min${mn}`);
    if(ticks[ticks.length-1]!==mx)probs.push(`끝틱${ticks[ticks.length-1]}≠max${mx}`);
    if(mn>=mx)probs.push(`min≥max`);
    // 불균등 간격 검사
    const diffs=ticks.slice(1).map((t,i)=>+(t-ticks[i]).toFixed(6));
    const uniq=[...new Set(diffs)];
    if(uniq.length>1)probs.push(`불균등간격 diffs=[${diffs.join(',')}]`);
    if(probs.length)rows.push(`${s}/${f.replace('Component.vue','')}: [${ticks.join(',')}] min${mn}/max${mx} — ${probs.join(' | ')}`);
  }
 }
}
console.log("축-틱 이상:",rows.length);rows.forEach(r=>console.log("  "+r));
summary('scan-axis-tick',axes,rows.length,{unit:'tickPositions 가 있는 축'});
