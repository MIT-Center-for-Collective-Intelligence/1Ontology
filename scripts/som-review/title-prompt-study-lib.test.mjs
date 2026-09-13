import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {inspectTitleAnswer} from './title-prompt-study-lib.mjs';
const input={title:'Stock Area',descriptions:[{number:1,text:'Stock serving and dining areas.'},{number:2,text:'Stock supplies.'}]};
const group=(title,descriptionNumbers)=>({title,descriptionNumbers,reason:'Source-supported rationale.'});
const inspect=groups=>inspectTitleAnswer(input,JSON.stringify({groups,reason:'Overall rationale.'}),'completed');
test('retains complete proposals without claiming semantic accuracy',()=>{
 const result=inspect([group('Stock Area',[1,2])]);
 assert.deepEqual(result.observations,[]); assert.equal(result.groups[0].title,'Stock Area');
 assert.equal(result.accuracy,undefined);
});
test('shows overlap as a policy issue, preserving both memberships and missing evidence',()=>{
 const result=inspect([group('Stock Serving Areas',[1]),group('Stock Dining Areas',[1])]);
 assert.equal(result.groups.length,2);
 assert.equal(result.observations.length,2);
 assert.match(result.observations.join(' '),/representation policy/);
 assert.match(result.observations.join(' '),/#2 is missing/);
});
test('flags changed verbs, unknown numbers, duplicate numbers and empty groups',()=>{
 const result=inspect([group('Fill Areas',[1,1,999]),group('Stock Supplies',[])]);
 for(const expected of [/changes the leading verb/,/unknown description #999/,/repeats a description/,/no supporting/]) assert.match(result.observations.join(' '),expected);
});
test('rejects malformed output for rendering but retains raw output at the caller',()=>{
 assert.equal(inspectTitleAnswer(input,'not json','completed').status,'format-invalid');
 assert.equal(inspectTitleAnswer(input,'{"groups":[null],"reason":"x"}','completed').status,'format-invalid');
});
test('flags inconsistent assignments of identical source descriptions without moving them',()=>{
 const duplicateInput={...input,descriptions:[{number:1,text:'Same source.'},{number:2,text:'Same source.'}]};
 const groups=[group('Stock Serving Areas',[1]),group('Stock Dining Areas',[2])];
 const result=inspectTitleAnswer(duplicateInput,JSON.stringify({groups,reason:'Rationale.'}),'completed');
 assert.deepEqual(result.groups,groups);
 assert.match(result.observations.join(' '),/Identical descriptions #1 and #2/);
});
test('never renders a partial or failed result as a proposal',()=>{
 const result=inspectTitleAnswer(input,JSON.stringify({groups:[group('Stock Area',[1,2])],reason:'Partial'}),'failed');
 assert.deepEqual(result.groups,[]);assert.equal(result.status,'failed');
});
test('reproduces the frozen packet, source mapping, hashes and software observations',()=>{
 const dir='Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/';
 const data=JSON.parse(fs.readFileSync(dir+'bundle.json','utf8'));
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 assert.equal(data.prompt,fs.readFileSync(dir+'rob-prompt.txt','utf8'));
 assert.equal(data.promptSha256,sha(data.prompt));
 assert.equal(data.cases.length,18);
 assert.equal(new Set(data.cases.map(c=>c.id)).size,18);
 assert.equal(data.cases.reduce((s,c)=>s+c.descriptions.length,0),240);
 for(const c of data.cases){
  assert.equal(c.input,`Current title: ${c.title}\n\nO*NET descriptions:\n${c.descriptions.map(s=>`${s.number}. ${s.text}`).join('\n\n')}`);
  assert.equal(c.inputSha256,sha(c.input));
  assert.equal(c.outputSha256,sha(c.rawOutput));
  if(c.status==='pending')continue;
  const result=inspectTitleAnswer(c,c.rawOutput,c.status);
  assert.deepEqual(result.groups,c.groups);
  assert.deepEqual(result.observations,c.observations);
 }
});
