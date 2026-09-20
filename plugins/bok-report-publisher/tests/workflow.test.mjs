import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepare,applyReview,requireApproved} from '../scripts/workflow.mjs';
const fixture=()=>{
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bok-owner-'));
 fs.mkdirSync(path.join(repo,'evidence'));fs.writeFileSync(path.join(repo,'evidence/cells.json'),'[1,null,3]');
 const unit={slug:'i-1',kind:'chart',title:'I-1',files:['src/I1.vue'],sourceRefs:['Sheet A1:D4'],acceptance:['Actual chart, source values match'],baseline:{commit:'123456',files:['old/I1.vue']},comparison:'same three series',sourceEvidence:['evidence/cells.json'],questions:[]};
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
