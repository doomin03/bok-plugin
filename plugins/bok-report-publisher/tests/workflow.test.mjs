import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepare,applyReview,requireApproved} from '../scripts/workflow.mjs';
const fixture=()=>{
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bok-owner-'));
 fs.mkdirSync(path.join(repo,'evidence'));fs.writeFileSync(path.join(repo,'evidence/cells.json'),'[1,null,3]');
 const unit={slug:'i-1',kind:'chart',title:'I-1',files:['src/I1.vue'],sourceRefs:['Sheet A1:D4'],acceptance:['Actual chart, source values match'],baseline:{commit:'123456',files:['old/I1.vue']},comparison:'same three series',sourceEvidence:['evidence/cells.json'],questions:[],figureLink:{status:'confirmed',media:'word/media/image1.wmf'},featureSummary:['panel1: left 0~10']};
 return {repo,plan:{report:'test',units:[unit]}};
};
test('start preserves review edits and cannot implicitly approve',()=>{
 const {repo,plan}=fixture();const a=prepare(repo,plan);
 const f=path.join(repo,'openspec/changes/bok-owner-review-test/owner-review.md');fs.appendFileSync(f,'OWNER NOTE');
 assert.throws(()=>requireApproved(repo,plan,['i-1']),/Owner review/);
 prepare(repo,plan);assert.ok(fs.readFileSync(f,'utf8').endsWith('OWNER NOTE'));
 assert.throws(()=>prepare(repo,{...plan,units:[{...plan.units[0],title:'changed'}]}),/Plan changed/);
 assert.equal(a.units[0].decision,'pending');
});
test('reuse/new decisions produce revisioned specs and selected gates',()=>{
 for(const strategy of ['reuse','new']){
 const {repo,plan}=fixture(),draft=prepare(repo,plan);
 const decisions={planHash:draft.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:strategy,comment:'Approved this strategy'}]};
 assert.throws(()=>applyReview(repo,plan,decisions,''),/authorization/);
 const one=applyReview(repo,plan,decisions,'Owner message');
 const again=applyReview(repo,plan,decisions,'Owner message');assert.equal(one.revision,again.revision);
 assert.equal(requireApproved(repo,plan,['i-1']).strategies['i-1'],strategy);
 assert.throws(()=>requireApproved(repo,plan,['i-2']),/Unapproved/);
 fs.writeFileSync(path.join(repo,'evidence/cells.json'),'[9]');
 assert.throws(()=>requireApproved(repo,plan,['i-1']),/Source evidence changed/);
 }
});
test('held, changed and unresolved units cannot implement',()=>{
 const {repo,plan}=fixture(),draft=prepare(repo,plan);
 applyReview(repo,plan,{planHash:draft.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:'hold',comment:'Need source check'}]},'Owner message');
 assert.throws(()=>requireApproved(repo,plan,['i-1']),/held/);
 assert.throws(()=>requireApproved(repo,{...plan,units:[{...plan.units[0],comparison:'different'}]},['i-1']),/Plan changed/);
 const other=fixture();other.plan.units[0].questions=['What is the unit?'];const d=prepare(other.repo,other.plan);
 assert.throws(()=>applyReview(other.repo,other.plan,{planHash:d.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:'reuse',comment:'approve'}]},'Owner message'),/questions/);
});
test('explicit plan revision preserves old owner notes and invalidates old approval',()=>{
 const {repo,plan}=fixture(),draft=prepare(repo,plan);
 applyReview(repo,plan,{planHash:draft.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:'reuse',comment:'Approved'}]},'Owner message');
 const md=path.join(repo,'openspec/changes/bok-owner-review-test/owner-review.md');fs.appendFileSync(md,'OWNER COMMENT');
 const next={...plan,units:[{...plan.units[0],comparison:'Changed axes require new chart'}]};
 prepare(repo,next,{revise:true});
 assert.ok(fs.readFileSync(path.join(repo,'openspec/changes/bok-owner-review-test/drafts',draft.planHash,'owner-review.md'),'utf8').includes('OWNER COMMENT'));
 assert.throws(()=>requireApproved(repo,next,['i-1']),/Plan changed/);
});
test('source features come before the owner decision and reach the approved spec',()=>{
 const {repo,plan}=fixture(),draft=prepare(repo,plan),dir=path.join(repo,'openspec/changes/bok-owner-review-test');
 const md=fs.readFileSync(path.join(dir,'owner-review.md'),'utf8');
 assert.ok(md.indexOf('panel1: left 0~10')>0&&md.indexOf('panel1: left 0~10')<md.indexOf('AI 제안: '),'features precede the AI similarity note');
 const r=applyReview(repo,plan,{planHash:draft.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:'reuse',comment:'ok'}]},'Owner message');
 assert.match(fs.readFileSync(path.join(dir,'revisions',r.revision,'specs/owner-decisions/spec.md'),'utf8'),/source-features[\s\S]*panel1: left 0~10/);
 const bare=fixture();delete bare.plan.units[0].featureSummary;const d=prepare(bare.repo,bare.plan);
 assert.throws(()=>applyReview(bare.repo,bare.plan,{planHash:d.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:'new',comment:'ok'}]},'Owner message'),/features required/);
});
test('an auto-extraction notice alone is not a feature list',()=>{
 const {repo,plan}=fixture();plan.units[0].featureSummary=['자동 추출 없음: 원본 그림에서 축을 찾지 못함'];const d=prepare(repo,plan);
 assert.throws(()=>applyReview(repo,plan,{planHash:d.planHash,owner:'Owner',decisions:[{slug:'i-1',decision:'reuse',comment:'ok'}]},'Owner message'),/features required/);
});
