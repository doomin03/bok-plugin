import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSelection, selectUnits, validatePlan, register } from '../scripts/tickets.mjs';
import { createHash } from 'node:crypto';
const unit={slug:'world-i-1',kind:'chart',title:'그림 I-1 구현·검증',section:'세계경제',files:['src/Graph.vue'],sourceRefs:['DOCX 그림 I-1','XLSX I-1 A9:D52'],acceptance:['원본 값 일치']};
const plan={report:'2026-09',units:[unit]};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('explicit ticket lists normalize, deduplicate and bound ranges',()=>{
  assert.deepEqual(parseSelection('bok-123,BOK-124,bok-123').keys,['BOK-123','BOK-124']);
  assert.deepEqual(parseSelection('BOK-3~bok-1'),{keys:['BOK-1','BOK-2','BOK-3'],reversed:true});
  for(const x of ['', 'BOK-1~OTHER-3','BOK-1~BOK-999','../BOK-1']) assert.throws(()=>parseSelection(x));
});
test('selection skips unrelated keys and rejects stale or reversed scope',()=>{
  const registry={report:'2026-09',links:[{key:'BOK-123',slug:unit.slug,state:'registered',unitHash:hash(unit)}]};
  const selection=selectUnits(plan,registry,'BOK-122~BOK-124');
  assert.equal(selection.selected.length,1);
  assert.deepEqual(selection.skipped,['BOK-122','BOK-124']);
  assert.throws(()=>selectUnits(plan,registry,'BOK-124~BOK-123'),/Reversed/);
  assert.throws(()=>selectUnits({...plan,units:[{...unit,title:'changed'}]},registry,'BOK-123'),/stale/);
  assert.throws(()=>validatePlan({...plan,units:[{...unit,files:['../outside']}]}),/Unsafe/);
});
test('registration journals uncertain POST and does not retry it',async()=>{
  const state={report:plan.report,links:[]};let posts=0,saved=[];
  const request=async(method,route)=>{
    if(route.startsWith('issue/createmeta'))return {fields:[{fieldId:'summary',required:true}],isLast:true};
    if(route.startsWith('search/jql'))return {issues:[]};
    if(method==='POST'){posts++;throw Error('connection lost');}
    throw Error('unexpected request');
  };
  const config={approved:true,project:'BOK',issueTypeId:'10001'};
  await assert.rejects(register(plan,state,config,request,s=>saved.push(JSON.parse(JSON.stringify(s)))),/connection lost/);
  assert.equal(saved[0].links[0].state,'creating');
  assert.equal(state.links[0].state,'uncertain');
  await assert.rejects(register(plan,state,config,request,()=>{}),/Uncertain/);
  assert.equal(posts,1);
});
test('successful registration resumes without duplicate POST and required fields block writes',async()=>{
  const state={report:plan.report,links:[]};let posts=0;
  const request=async(method,route)=>{
    if(route.startsWith('issue/createmeta'))return {fields:[{fieldId:'summary',required:true}],isLast:true};
    if(route.startsWith('search/jql'))return {issues:[]};
    if(method==='POST'){posts++;return {key:'BOK-123'};}
  };
  const config={approved:true,project:'BOK',issueTypeId:'10001'};
  await register(plan,state,config,request,()=>{});
  await register(plan,state,config,request,()=>{});
  assert.equal(posts,1);
  await assert.rejects(register(plan,{report:plan.report,links:[]},config,async()=>({fields:[{fieldId:'customfield_9',required:true}]}),()=>{}),/Required Jira field/);
});
