// 이중축 0선 불일치("구분선 짝짝이") 검출기
// 실행: node scan-dualaxis-zeroline.mjs --report-dir <repo>/src/pages/reportYYYYMM
import fs from 'fs';import path from 'path';
import { need, summary } from './lib.mjs';
// 장 폴더 이름은 보고서마다 다를 수 있어 graph/ 를 가진 하위 폴더를 모두 본다
const ROOT=need('--report-dir');const secs=fs.readdirSync(ROOT).filter(s=>fs.existsSync(path.join(ROOT,s,'graph')));
let compared=0;
// extract yAxis min/max pairs from a component's PRIMARY (non-responsive) yAxis array
function axes(src){
 // grab first yAxis: [ ... ] block
 const i=src.search(/yAxis\s*:\s*\[/); if(i<0)return [];
 // naive brace matching from the '['
 let j=src.indexOf('[',i), depth=0, k=j;
 for(;k<src.length;k++){if(src[k]==='[')depth++;else if(src[k]===']'){depth--;if(depth===0)break;}}
 const block=src.slice(j,k+1);
 // split into axis objects by top-level {...}
 const objs=[]; let d=0,st=-1;
 for(let p=0;p<block.length;p++){if(block[p]==='{'){if(d===0)st=p;d++;}else if(block[p]==='}'){d--;if(d===0)objs.push(block.slice(st,p+1));}}
 return objs.map(o=>{
  const mn=o.match(/\bmin\s*:\s*(-?[\d.]+)/), mx=o.match(/\bmax\s*:\s*(-?[\d.]+)/);
  return {min:mn?parseFloat(mn[1]):null,max:mx?parseFloat(mx[1]):null,opposite:/opposite\s*:\s*true/.test(o)};
 });
}
const hits=[];
for(const s of secs){const g=path.join(ROOT,s,'graph');if(!fs.existsSync(g))continue;
 for(const f of fs.readdirSync(g)){if(!f.endsWith('.vue'))continue;
  const src=fs.readFileSync(path.join(g,f),'utf8');
  const ax=axes(src);
  if(ax.length<2)continue;                       // dual-axis only
  const a=ax[0],b=ax[1];
  if(a.min==null||a.max==null||b.min==null||b.max==null)continue;
  // 0 within both ranges?
  const in0a=a.min<=0&&a.max>=0, in0b=b.min<=0&&b.max>=0;
  if(!in0a||!in0b)continue;                       // no shared 0-line to align
  compared++;
  const ra=(0-a.min)/(a.max-a.min), rb=(0-b.min)/(b.max-b.min);
  if(Math.abs(ra-rb)>0.001) hits.push(`${s}/${f.replace('Component.vue','')}: L[${a.min},${a.max}] 0@${(ra*100).toFixed(1)}%  R[${b.min},${b.max}] 0@${(rb*100).toFixed(1)}%  MISALIGNED`);
 }
}
console.log('이중축 0선 불일치(짝짝이):',hits.length);
hits.forEach(h=>console.log('  '+h));
summary('scan-dualaxis-zeroline',compared,hits.length,{unit:'0을 함께 지나는 이중축 차트'});
