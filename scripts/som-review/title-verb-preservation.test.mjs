import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTitleVerbPreservation} from './title-verb-preservation.mjs';

const input={title:'Conduct Research',descriptions:[{number:1,text:'Source description.'}]};
const output=title=>JSON.stringify({groups:[{title,descriptionNumbers:[1],reason:'Rationale.'}],reason:'Rationale.'});
const check=(title,overrides={})=>checkTitleVerbPreservation({input,rawOutput:output(title),requestStatus:'completed',originalVerb:'Conduct',...overrides});

test('preserves the verb while permitting title clarification and capitalization',()=>{
  assert.equal(check('Conduct Biological Research').passesVerbCheck,true);
  assert.equal(check('  conduct   research ').passesVerbCheck,true);
});
test('rejects replacement, changed inflection and misleading string prefixes',()=>{
  for(const title of ['Research Topics','Perform Research','Conducted Research','Conductor Research']) {
    const result=check(title);
    assert.equal(result.passesVerbCheck,false,title);
    assert.deepEqual(result.violations,[{groupNumber:1,title}]);
  }
});
test('preserves a supplied multiword verb without guessing or dropping its particle',()=>{
  const overrides={input:{...input,title:'Take Care of Patients'},originalVerb:'Take care'};
  assert.equal(check('Take Care of Children',overrides).passesVerbCheck,true);
  assert.equal(check('Take Patient Notes',overrides).passesVerbCheck,false);
});
test('requires an explicit verb anchored to the original title',()=>{
  for(const originalVerb of ['',undefined,'Research']) assert.throws(()=>check('Conduct Research',{originalVerb}),/explicit original verb/);
});
test('does not pass pending, failed, unreadable or empty answers',()=>{
  for(const requestStatus of ['pending','failed','incomplete']) {
    const result=check('Conduct Research',{requestStatus});
    assert.equal(result.checked,false);assert.equal(result.passesVerbCheck,false);
  }
  for(const rawOutput of ['invalid','{"groups":[],"reason":"Empty"}']) {
    const result=check('Conduct Research',{rawOutput});
    assert.equal(result.checked,false);assert.equal(result.passesVerbCheck,false);
  }
});
test('reports changed groups without altering the original input or output',()=>{
  const rawOutput=output('Research Topics');
  const request={input,rawOutput,requestStatus:'completed',originalVerb:'Conduct'};
  const before=JSON.stringify(request);
  checkTitleVerbPreservation(request);
  assert.equal(JSON.stringify(request),before);
});
test('reproduces the 22 changed-verb groups across six frozen development cases',()=>{
  const file='Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/bundle.json';
  const before=fs.readFileSync(file);
  const bundle=JSON.parse(before);
  // These 18 regression cases use the leading word as the recorded verb.
  // Future callers must supply their source's verb, including any particles.
  const results=bundle.cases.map(c=>checkTitleVerbPreservation({input:c,rawOutput:c.rawOutput,requestStatus:c.status,originalVerb:c.title.split(/\s+/)[0]}));
  assert.equal(results.filter(r=>r.violations.length).length,6);
  assert.equal(results.reduce((n,r)=>n+r.violations.length,0),22);
  assert.equal(results.filter(r=>r.passesVerbCheck).length,12);
  assert.deepEqual(fs.readFileSync(file),before);
});
