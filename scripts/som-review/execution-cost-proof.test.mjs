import {test} from 'node:test';
import assert from 'node:assert/strict';
import {digest,journalLines,validateExecutionProof} from './execution-cost-proof.mjs';
function fixture(reservations=['0.49112']) {
  const files=new Map(),put=(name,x)=>{files.set(name,Buffer.from(JSON.stringify(x)));return name;};
  // Sanitized request content gets a fresh hash, not the unavailable full request's hash.
  // Limits/admitted tokens and reservation overrides are test-only; usage and ledger
  // fields follow the supplied recovery critic sample, including its recorded cost.
  const body={model:'gpt-6-1-sol-society-of-mind',reasoning:{effort:'high'},input:'{}',background:true,max_output_tokens:20000};
  const usage={input_tokens:12913,input_tokens_details:{cache_write_tokens:0,cached_tokens:12910},output_tokens:7219,output_tokens_details:{reasoning_tokens:4660},total_tokens:20132};
  const ledger={schemaVersion:'ontology-direct-inference-budget-ledger-v1',ceilingUsd:20,attempts:{},reservations:{}};
  const starts=[],finishes=[],attempts=[],rows=[];
  reservations.forEach((reservedUsd,i)=>{
    const requestSha256=digest(JSON.stringify(body)),jobId=`expanded-critic-06-recovery-1-${i+1}-${requestSha256.slice(0,16)}`,attemptId=jobId+'-attempt-1',phase=`expanded-critic-${i+1}`;
    const dispatch={attemptId,jobId,phase,requestSha256,requestedAt:'2026-10-20T01:52:36.645Z',reservedUsd,usage:null,background:true};
    const a={...dispatch,usage,httpStatus:200,responseId:`resp_sanitized_${i+1}`,responseStatus:'completed'};
    starts.push({journaledAt:a.requestedAt,attemptId,state:'started',jobId,phase,admittedTokens:38224,attempt:dispatch,requestSha256,reservedUsd});
    finishes.push({journaledAt:'2026-10-20T01:56:56.021Z',attemptId,state:'finished',jobId,phase,attempt:a});
    ledger.attempts[attemptId]={id:attemptId,source:'durable-journal',usage,actualUsd:0.146977,reservedUsd,requestedAt:a.requestedAt,responseId:a.responseId,jobId,phase,background:true};
    ledger.reservations[attemptId]={attemptId,status:'settled',reservedUsd,reservedAt:a.requestedAt,jobId,phase,requestSha256,fundingRoute:'ACCESS CIS261400 Azure',background:true,settledAt:finishes[i].journaledAt};
    rows.push({attemptId,journalLineIndexes:[i+1,reservations.length+i+1],requestFile:put(`execution/request-${i}.json`,body),responseFile:put(`execution/response-${i}.json`,{id:a.responseId,status:a.responseStatus,model:body.model,usage})});
    attempts.push(a);
  });
  // Synthetic balances preserve the real record shape without publishing allocation telemetry.
  put('execution/funding.json',{schemaVersion:'ontology-access-pre-request-reconciliation-v1',accessProject:'CIS261400',admitted:true,checkedAt:'2026-10-20T00:38:35.711491+00:00',awardUsd:5000,postedUsageUsd:1000,cloudbankRemainingUsd:4000,kionReportedSpendUsd:1000,azureBudgetCurrentSpendUsd:1000,newTaskConservativeCeilingUsd:20,protectedReserveUsd:500,billingLagReserveUsd:200,recentTokensConservativeReserveUsd:0,carriedUnknownUsageReserveUsd:0,earlierTokenGapReserveUsd:0,otherCloudReserveUsd:0,priorActiveReservationsUsd:0,unreservedHeadroomAfterTaskUsd:3280});
  const p={schemaVersion:'execution-cost-proof-v1',ratesVersion:'sol-short-context-conservative-v1',journalFile:'execution/journal.jsonl',ledgerFile:'execution/ledger.json',fundingFile:'execution/funding.json',attempts:rows};
  const trace={authors:[],critiques:attempts.map(a=>({jobId:a.jobId,model:body.model,attempts:[a]})),allInferenceAttempts:attempts},entry={semanticAttemptsSha256:digest(JSON.stringify(attempts))},lock={};
  function validate() {
    entry.semanticAttemptsSha256=digest(JSON.stringify(attempts));
    files.set(p.journalFile,Buffer.from([...starts,...finishes].map(e=>JSON.stringify(e)+'\n').join('')));
    put(p.ledgerFile,ledger);
    p.journalLines=journalLines(files.get(p.journalFile)).map(({line,sha256})=>({line,sha256}));
    p.files=[...files].filter(([name])=>name!=='execution-proof.json').map(([name,b])=>({name,bytes:b.length,sha256:digest(b)}));
    entry.executionProofFileCount=p.files.length;
    put('execution-proof.json',p);entry.executionProofSha256=lock.executionProofSha256=digest(files.get('execution-proof.json'));
    return validateExecutionProof(entry,lock,trace,name=>files.get(name));
  }
  function reserve(i,value) {
    const id=attempts[i].attemptId;
    for(const object of [starts[i],starts[i].attempt,attempts[i],ledger.attempts[id],ledger.reservations[id]])object.reservedUsd=value;
  }
  return {p,validate,reserve,ledger};
}
test('accepts sanitized actual ledger/journal shapes',()=>{
  const result=fixture().validate();
  assert.equal(result.attempts,1);
  assert.equal(result.semanticAttempts,1);
  assert.equal(result.committedUsd,'0.146977000');
  assert.equal(result.activeRequests,0);
});
test('accepts ledger admission 1ms before journal HTTP dispatch',()=>{
  const f=fixture(),id=f.p.attempts[0].attemptId;
  f.ledger.reservations[id].reservedAt='2026-10-20T01:52:36.644Z';
  f.ledger.attempts[id].requestedAt='2026-10-20T01:52:36.644Z';
  assert.equal(f.validate().committedUsd,'0.146977000');
});
test('rejects ledger admission after journal dispatch for timestamp ordering',()=>{
  const f=fixture(),id=f.p.attempts[0].attemptId;
  assert.equal(f.validate().attempts,1);
  f.ledger.attempts[id].requestedAt='2026-10-20T01:52:36.646Z';
  assert.throws(f.validate,/missing actual pre-dispatch admission\/settlement/);
});
test('rejects an omitted dispatched journal attempt after repinning',()=>{
  const f=fixture();assert.equal(f.validate().attempts,1);
  f.p.attempts=[];assert.throws(f.validate,/omitted journal attempt in proof/);
});
test('rejects overlapping pre-dispatch reservations despite tiny settled costs',()=>{
  const f=fixture(['10','10']);
  assert.equal(f.validate().committedUsd,'0.293954000');
  // Both starts precede either finish: $10 + $10.01 exceeds $20 at dispatch,
  // although final usage costs total only $0.293954. Do not use tokenCost here.
  f.reserve(1,'10.01');
  assert.throws(f.validate,/pre-dispatch task budget overrun/);
});
