import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');};
const safe=(root,p)=>{
 if(typeof p!=='string'||!p||p.includes('\\')||p.split('/').includes('..')||path.isAbsolute(p))throw Error('Unsafe workflow path');
 const target=path.resolve(root,p),base=fs.realpathSync(root);
 let ancestor=target;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
 if(!fs.realpathSync(ancestor).startsWith(base+path.sep)&&fs.realpathSync(ancestor)!==base)throw Error('Escaped workflow root');
 return target;
};
const directory=(repo,report)=>{
 if(!/^[a-z0-9-]+$/.test(report))throw Error('Invalid report');
 return safe(repo,'openspec/changes/bok-owner-review-'+report);
};
function checkPlan(plan){
 if(!Array.isArray(plan.units)||!plan.units.length)throw Error('Nonempty plan required');
 const slugs=new Set();
 for(const u of plan.units){
  if(!/^[a-z0-9][a-z0-9-]*$/.test(u.slug)||slugs.has(u.slug))throw Error('Invalid/duplicate unit');slugs.add(u.slug);
  if(!u.title||!u.files?.length||!u.sourceRefs?.length||!u.acceptance?.length)throw Error('Incomplete unit');
 }
}
export function prepare(repo,plan,{revise=false}={}){
 checkPlan(plan);const dir=directory(repo,plan.report),file=path.join(dir,'review.json');
 // Re-running start must never erase owner edits or prior approval.
 if(fs.existsSync(file)){
  const saved=read(file);
  if(saved.planHash===hash(plan))return saved;
  if(!revise)throw Error('Plan changed: use prepare --revise to preserve and supersede the prior draft');
  const archived=path.join(dir,'drafts',saved.planHash);fs.mkdirSync(archived,{recursive:true});
  for(const name of ['review.json','owner-review.md'])fs.copyFileSync(path.join(dir,name),path.join(archived,name),fs.constants.COPYFILE_EXCL);
 }
 const draft={report:plan.report,planHash:hash(plan),units:plan.units.map(u=>({
  slug:u.slug,title:u.title,unitHash:hash(u),kind:u.kind,sourceRefs:u.sourceRefs,
  proposed:u.strategy||'undecided',baseline:u.baseline||null,comparison:u.comparison||'Not compared',
  similarity:u.similarity||'AI 유사성 판단 미기록 (bok-start가 채워야 함)',
  questions:u.questions||[],decision:'pending',ownerComment:'',acceptance:u.acceptance
 }))};
 write(file,draft);
 fs.writeFileSync(path.join(dir,'owner-review.md'),'# 오너 비교 리뷰\n\n아직 구현 승인이 아닙니다. AI가 먼저 각 단위의 유사성을 판단해 아래 "AI 유사성 판단"과 "AI 제안"에 기록했습니다. 그림별 원본 비교 이미지, 이전 분기 소스/커밋, 계열·축·단위 차이와 함께 이를 검토한 뒤 "오너 결정"(reuse / new / hold)과 "오너 의견"을 직접 작성하세요. 원본 이미지는 개발 증거이며 사이트에 표시하지 않습니다.\n\n'+draft.units.map(u=>'## '+u.slug+' — '+u.title+'\n\nAI 제안: '+u.proposed+'\n\nAI 유사성 판단: '+u.similarity+'\n\n비교: '+u.comparison+'\n\n근거: '+u.sourceRefs.join(', ')+'\n\n질문: '+u.questions.join('; ')+'\n\n오너 결정: 미작성\n\n오너 의견: \n').join('\n'));
 return draft;
}
export function applyReview(repo,plan,decisions,authorization){
 checkPlan(plan);
 if(!authorization?.trim())throw Error('Explicit owner review authorization required');
 const dir=directory(repo,plan.report),draft=read(path.join(dir,'review.json'));
 if(draft.planHash!==hash(plan))throw Error('Stale plan; re-review required');
 if(decisions.planHash!==draft.planHash||!decisions.owner?.trim()||!decisions.decisions?.length)throw Error('Owner and reviewed planHash required');
 const currentFile=path.join(dir,'approved.json');
 let current=fs.existsSync(currentFile)?read(currentFile):{report:plan.report,planHash:draft.planHash,units:{}};
 if(current.planHash!==draft.planHash)current={report:plan.report,planHash:draft.planHash,units:{}};
 delete current.revision;
 const seen=new Set();
 for(const d of decisions.decisions){
  if(seen.has(d.slug))throw Error('Duplicate decision');seen.add(d.slug);
  const u=plan.units.find(u=>u.slug===d.slug);if(!u)throw Error('Unknown unit');
  if(!['reuse','new','hold'].includes(d.decision)||!d.comment?.trim())throw Error('Decision and owner comment required');
  if(d.decision!=='hold'){
   if(u.kind==='chart'&&(!u.baseline?.commit||!u.baseline?.files?.length||!u.comparison||!u.sourceEvidence?.length))throw Error('Chart comparison, baseline and source evidence required');
   if(u.questions?.length)throw Error('Resolve outstanding questions in plan, then request review again');
  }
  const evidence={};
  for(const file of u.sourceEvidence||[]){const p=safe(repo,file);evidence[file]=createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
  current.units[d.slug]={unitHash:hash(u),decision:d.decision,owner:decisions.owner,comment:d.comment,authorization,acceptance:u.acceptance,evidence,baseline:u.baseline||null};
 }
 const revision=hash(current),revDir=path.join(dir,'revisions',revision);
 if(fs.existsSync(path.join(revDir,'decisions.json'))){
  if(hash(read(path.join(revDir,'decisions.json')))!==revision)throw Error('Existing review revision was modified');
  write(currentFile,{...current,revision});
  return {revision,approved:Object.entries(current.units).filter(([,v])=>v.decision!=='hold').map(([s])=>s)};
 }
 fs.mkdirSync(path.join(revDir,'specs/owner-decisions'),{recursive:true});
 write(path.join(revDir,'decisions.json'),current);
 const approved=Object.entries(current.units).filter(([,v])=>v.decision!=='hold');
 if(!fs.existsSync(path.join(revDir,'tasks.md')))fs.writeFileSync(path.join(revDir,'tasks.md'),'# Reviewed scope\n\n'+approved.map(([s])=>'- [ ] Implement and verify only when selected: '+s).join('\n')+'\n');
 fs.writeFileSync(path.join(revDir,'proposal.md'),'# Owner-reviewed report units\n\nImplement only an explicitly selected approved unit. Jira registration remains a separate command.\n');
 fs.writeFileSync(path.join(revDir,'design.md'),'# Design decisions\n\n'+Object.entries(current.units).map(([s,d])=>'## '+s+'\n\nStrategy: '+d.decision+'\n\nOwner: '+d.owner+'\n\n'+d.comment+'\n\n'+JSON.stringify(d.baseline)).join('\n\n'));
 fs.writeFileSync(path.join(revDir,'specs/owner-decisions/spec.md'),'# Owner decisions\n\n## ADDED Requirements\n\n'+approved.map(([s,d])=>'### Requirement: '+s+'\nThe implementation SHALL use the approved '+d.decision+' strategy and preserve established UI.\n\n'+d.acceptance.map((a,i)=>'#### Scenario: '+s+'-'+i+'\n- **WHEN** the selected chart is verified\n- **THEN** '+a).join('\n\n')).join('\n\n'));
 write(currentFile,{...current,revision});return {revision,approved:approved.map(([s])=>s)};
}
export function requireApproved(repo,plan,slugs){
 if(!slugs?.length)throw Error('Explicit selection required');
 const file=path.join(directory(repo,plan.report),'approved.json');
 if(!fs.existsSync(file))throw Error('Owner review required: run bok-spec before implementation');
 const approval=read(file);
 if(approval.planHash!==hash(plan))throw Error('Plan changed after owner review');
 for(const slug of slugs){
  const unit=plan.units.find(u=>u.slug===slug),d=approval.units[slug];
  if(!unit||!d||d.decision==='hold'||d.unitHash!==hash(unit))throw Error('Unapproved, held or stale unit: '+slug);
  for(const [f,h] of Object.entries(d.evidence))if(createHash('sha256').update(fs.readFileSync(safe(repo,f))).digest('hex')!==h)throw Error('Source evidence changed: '+f);
 }
 return {revision:approval.revision,selected:slugs,strategies:Object.fromEntries(slugs.map(s=>[s,approval.units[s].decision]))};
}
async function main(){
 const [cmd,...args]=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
 if(!arg('--repo')||!arg('--plan'))throw Error('--repo and --plan required');
 const repo=path.resolve(arg('--repo')),plan=read(arg('--plan'));
 let result;
 if(cmd==='prepare')result=prepare(repo,plan,{revise:args.includes('--revise')});
 else if(cmd==='apply')result=applyReview(repo,plan,read(arg('--decisions')),arg('--authorization'));
 else if(cmd==='gate')result=requireApproved(repo,plan,(arg('--units')||'').split(',').filter(Boolean));
 else throw Error('Usage: workflow.mjs prepare|apply|gate --repo <repo> --plan <plan> [--decisions <json> --authorization <owner request>] [--units slug1,slug2]');
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
