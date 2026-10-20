import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const digest = x => crypto.createHash('sha256').update(x).digest('hex');
const canonical = x => digest(JSON.stringify(x));
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = x => [...x].sort();
const sets = (a,b) => eq(sorted(a),sorted(b)) && new Set(a).size === a.length && new Set(b).size === b.length;
const need = (ok,message) => { if (!ok) throw Error('Execution proof: '+message); };
// Nanodollars; round supplied decimal money upward, never binary-float multiply.
const usd = value => {
  const s = String(value);
  need(/^[0-9]+(?:\.[0-9]+)?$/.test(s), 'invalid decimal money');
  const [whole,fraction=''] = s.split('.');
  return BigInt(whole)*1000000000n + BigInt((fraction+'000000000').slice(0,9)) + (/[1-9]/.test(fraction.slice(9)) ? 1n : 0n);
};
const money = n => `${n/1000000000n}.${String(n%1000000000n).padStart(9,'0')}`;
const token = n => { need(Number.isSafeInteger(n) && n>=0, 'unsafe token count'); return BigInt(n); };
export function tokenCost(u, upper=true) {
  const i=token(u.input_tokens),o=token(u.output_tokens),t=token(u.total_tokens);
  const c=token(u.input_tokens_details?.cached_tokens ?? 0),w=token(u.input_tokens_details?.cache_write_tokens ?? 0);
  const r=token(u.output_tokens_details?.reasoning_tokens ?? 0);
  need(c+w<=i && r<=o && i+o===t, 'inconsistent token details');
  return upper ? (i-c-w)*5000n+c*200n+w*5000n+o*20000n : (i-c-w)*2000n+c*100n+w*2500n+o*10000n;
}
export function journalLines(bytes) {
  const text=bytes.toString('utf8');
  need(Buffer.from(text).equals(bytes), 'non-UTF8 journal');
  return text.split('\n').flatMap((line,i)=>line.trim() ? [{line:i+1,sha256:digest(line),event:JSON.parse(line)}] : []);
}

export function verifyRequestJobId(result,body,fileStem) {
  const sha=canonical(body);
  need(typeof fileStem==='string' && /^[A-Za-z0-9_-]+$/.test(fileStem),'unsafe result file stem');
  need(result.requestSha256===sha && result.jobId===`${fileStem}-${sha.slice(0,16)}`,'request hash/job ID mismatch');
  need(Array.isArray(result.attempts) && result.attempts.length>0,'missing role attempts');
  for (const a of result.attempts) {
    need(a.jobId===result.jobId && a.requestSha256===sha &&
      a.attemptId.startsWith(result.jobId+'-attempt-') &&
      /^[1-9][0-9]*$/.test(a.attemptId.slice((result.jobId+'-attempt-').length)),'role attempt identity mismatch');
  }
  return result.jobId;
}

export const recoveryOutputContract='Each output consideredSourceIds must equal exactly that case requiredConsideredSourceIds, no duplicates or IDs belonging only to other cases. This is serialization clarification; semantic rules and supplied evidence are unchanged.';

// Permit only the recorded serialization clarification and exact author replacement.
export function validateRecovery(trace) {
  const batch=trace.batches.find(b=>b.id==='batch-06');
  const stems=['expanded-author-06-recovery-1','expanded-critic-06-recovery-1-1','expanded-critic-06-recovery-1-2'];
  const oldStems=['expanded-author-06','expanded-critic-06-1','expanded-critic-06-2'];
  const phases=['expanded-author','expanded-critic-1','expanded-critic-2'];
  const ids=trace.recovery?.newJobIds;
  need(batch && trace.recovery?.batchId==='batch-06' && Array.isArray(ids) && ids.length===3 && eq(batch.reviewJobIds,ids), 'wrong batch06 recovery roles');
  const old=trace.supersededSemanticEvidence;
  need(Array.isArray(old) && old.length===3, 'missing complete superseded batch06 roles');
  need(eq(old.map(r=>r.result.jobId),trace.recovery?.originalJobIds), 'superseded role inventory mismatch');
  const roles=[...trace.authors,...trace.critiques];
  const fresh=ids.map((id,i)=>{
    const results=(i?trace.critiques:trace.authors).filter(r=>r.jobId===id);
    const requests=trace.exactRequests.filter(r=>r.jobId===id),responses=trace.rawResponses.filter(r=>r.jobId===id);
    need(results.length===1 && roles.filter(r=>r.jobId===id).length===1 && requests.length===1 && responses.length===1,'missing/duplicate recovery role');
    need(requests[0].requestSha256===results[0].requestSha256,'recovery request index mismatch');
    return {result:results[0],body:requests[0].body,response:responses[0].response};
  });
  for (let i=0;i<3;i++) for (const [r,stem] of [[old[i],oldStems[i]],[fresh[i],stems[i]]]) {
    verifyRequestJobId(r.result,r.body,stem);
    need(r.result.model===r.body.model && r.result.attempts.every(a=>a.phase===phases[i]),'wrong original/recovery role');
    const last=r.result.attempts.at(-1);
    need(r.response && r.response.id===r.result.responseId && r.response.id===last.responseId &&
      r.response.status===last.responseStatus && eq(r.response.usage ?? null,last.usage ?? null),'role/raw response mismatch');
  }
  need(old.every(r=>!roles.some(a=>a.jobId===r.result.jobId) &&
    !trace.exactRequests.some(a=>a.jobId===r.result.jobId) && !trace.rawResponses.some(a=>a.jobId===r.result.jobId)),'superseded role still active');
  const source=JSON.parse(old[0].body.input), subjects=source.cases.map(c=>c.subjectId);
  const considered=c=>[...new Set([...c.supportingSourceIds,...c.candidateEvidence.flatMap(e=>e.supportingSourceIds)])];
  const clarified=JSON.parse(fresh[0].body.input);
  need(!Object.hasOwn(source,'outputContract') && clarified.outputContract===recoveryOutputContract,'wrong recovery outputContract');
  need(Array.isArray(clarified.cases) && clarified.cases.length===source.cases.length,'changed recovery case inventory');
  const stripped={...clarified,cases:clarified.cases.map((c,i)=>{
    need(!Object.hasOwn(source.cases[i],'requiredConsideredSourceIds') && Array.isArray(c.requiredConsideredSourceIds) &&
      sets(c.requiredConsideredSourceIds,considered(source.cases[i])),'incorrect requiredConsideredSourceIds');
    const copy={...c};delete copy.requiredConsideredSourceIds;return copy;
  })};
  delete stripped.outputContract;
  need(eq(stripped,source),'changed input evidence');
  for (let i=0;i<3;i++) {
    const a={...old[i].body},b={...fresh[i].body};
    const oldInput=JSON.parse(a.input),newInput=JSON.parse(b.input);
    delete a.input; delete b.input;
    need(eq(a,b),'recovery changed semantic prompt or model settings');
    if (i) {
      need(eq(oldInput.source,source) && oldInput.exactAuthorPrompt===old[0].body.instructions &&
        eq(oldInput.proposals,old[0].result.value),'wrong original critic inputs');
      need(eq(newInput,{...oldInput,source:clarified,proposals:fresh[0].result.value}),'critic does not review exact corresponding author output/source');
    }
    const output=fresh[i].result.value?.cases;
    need(Array.isArray(output) && sets(output.map(c=>c.subjectId),subjects),'recovery output case coverage mismatch');
    for (const c of source.cases) {
      const v=output.find(v=>v.subjectId===c.subjectId);
      need(Array.isArray(v.consideredSourceIds) && sets(v.consideredSourceIds,considered(c)),'recovery output source coverage mismatch');
    }
  }
}

export function validateExecutionProof(entry,lock,trace,read) {
  const bytes=read('execution-proof.json');
  need(digest(bytes)===entry.executionProofSha256 && lock.executionProofSha256===entry.executionProofSha256,'unpinned proof');
  const p=JSON.parse(bytes);
  need(p.schemaVersion==='execution-cost-proof-v1' && p.ratesVersion==='sol-short-context-conservative-v1','unrecognized proof/rates');
  need(Array.isArray(p.files) && p.files.length===entry.executionProofFileCount && p.files.length<=512,'inventory bound');
  const names=new Set();
  for (const f of p.files) {
    need(/^execution\/[A-Za-z0-9_-]+\.jsonl?$/.test(f.name) && !names.has(f.name),'unsafe inventory'); names.add(f.name);
    const b=read(f.name); need(Number.isSafeInteger(f.bytes) && b.length===f.bytes && b.length<=4194304 && digest(b)===f.sha256,'file hash/size mismatch');
  }
  const get=name=>{ need(names.has(name),'uninventoried proof reference'); return read(name); };
  const json=name=>JSON.parse(get(name));
  const lines=journalLines(get(p.journalFile)), ledger=json(p.ledgerFile), funding=json(p.fundingFile);
  need(eq(lines.map(({line,sha256})=>({line,sha256})),p.journalLines),'journal byte/line index mismatch');
  need(ledger.schemaVersion==='ontology-direct-inference-budget-ledger-v1' && usd(ledger.ceilingUsd)===usd(20),'wrong ledger cap');
  need(funding.schemaVersion==='ontology-access-pre-request-reconciliation-v1' && funding.accessProject==='CIS261400' && funding.admitted===true,'wrong funding snapshot');
  need(usd(funding.newTaskConservativeCeilingUsd)===usd(20) && usd(funding.protectedReserveUsd)===usd(500),'wrong cap/reserve');
  const available=[usd(funding.awardUsd)-usd(funding.postedUsageUsd),usd(funding.cloudbankRemainingUsd),usd(funding.awardUsd)-usd(funding.kionReportedSpendUsd),usd(funding.awardUsd)-usd(funding.azureBudgetCurrentSpendUsd)].reduce((a,b)=>a<b?a:b);
  const reserves=['protectedReserveUsd','billingLagReserveUsd','recentTokensConservativeReserveUsd','carriedUnknownUsageReserveUsd','earlierTokenGapReserveUsd','otherCloudReserveUsd','priorActiveReservationsUsd'].reduce((sum,k)=>sum+usd(funding[k]),0n);
  const headroom=available-reserves-usd(20);
  need(headroom>=0n,'funding headroom/reserve overrun');
  need(usd(funding.unreservedHeadroomAfterTaskUsd)<=headroom+10n,'snapshot overstates funding headroom');
  const states=new Map();
  for (const {line,event:e} of lines) {
    need(e && typeof e.attemptId==='string' && ['started','polling','finished'].includes(e.state),'unknown journal request state');
    if (e.state==='started') { need(!states.has(e.attemptId),'duplicate dispatch'); states.set(e.attemptId,{start:e,startLine:line,events:[line]}); }
    else {
      const s=states.get(e.attemptId); need(s && !s.finish,'event without live dispatch'); s.events.push(line);
      if (e.state==='finished') { s.finish=e; s.finishLine=line; }
    }
  }
  const ids=[...states.keys()];
  need(ids.length>0 && ids.length<=256 && sets(ids,Object.keys(ledger.attempts)) && sets(ids,Object.keys(ledger.reservations)),'omitted journal attempt or ledger reservation');
  need(Array.isArray(p.attempts) && sets(ids,p.attempts.map(a=>a.attemptId)),'omitted journal attempt in proof');
  const semantic=[...(trace.supersededSemanticEvidence||[]).flatMap(r=>r.result.attempts),...(trace.discovery?.roles||[]).flatMap(r=>r.result.attempts),...[...trace.authors,...trace.critiques].flatMap(r=>r.attempts)];
  need(eq(semantic,trace.allInferenceAttempts) && canonical(semantic)===entry.semanticAttemptsSha256,'semantic lineage mismatch');
  const sem=new Map(semantic.map(a=>[a.attemptId,a])); need(sem.size===semantic.length,'duplicate semantic attempt');
  let reference=0n,upper=0n,unknown=0n;
  const costs=new Map(),responses=new Set(),requestFiles=new Set();
  for (const row of p.attempts) {
    const s=states.get(row.attemptId),a=s.finish?.attempt,r=ledger.reservations[row.attemptId],l=ledger.attempts[row.attemptId];
    need(a && eq(row.journalLineIndexes,s.events),'unfinished/unknown request or wrong attempt lines');
    need(r.status==='settled' && r.jobId===a.jobId && r.phase===a.phase && l.jobId===a.jobId && l.phase===a.phase,'active or mismatched ledger request');
    need(a.attemptId===row.attemptId && l.id===row.attemptId && r.attemptId===row.attemptId && l.source==='durable-journal' && s.start.jobId===a.jobId && s.start.phase===a.phase && s.finish.jobId===a.jobId,'attempt identity mismatch');
    for (const k of ['attemptId','jobId','phase','requestSha256','requestedAt','reservedUsd','background']) need(eq(s.start.attempt[k] ?? null,a[k] ?? null),'dispatch/terminal attempt mismatch');
    for (const k of ['jobId','phase','reservedUsd','responseId','background']) need(eq(l[k] ?? null,a[k] ?? null),'ledger attempt mismatch');
    const time=x=>{ const t=Date.parse(x); need(Number.isFinite(t),'missing timestamp'); return t; };
    need(r.fundingRoute==='ACCESS CIS261400 Azure' && time(funding.checkedAt)<=time(r.reservedAt) && time(r.reservedAt)<=time(l.requestedAt) && time(l.requestedAt)<=time(a.requestedAt) && time(a.requestedAt)<=time(s.start.journaledAt) && time(s.start.journaledAt)<=time(r.settledAt) && time(r.settledAt)<=time(s.finish.journaledAt),'missing actual pre-dispatch admission/settlement');
    const reservation=usd(r.reservedUsd);
    need(reservation===usd(s.start.reservedUsd) && reservation===usd(s.start.attempt.reservedUsd) && reservation===usd(a.reservedUsd) && reservation===usd(l.reservedUsd),'reservation mismatch');
    const body=json(row.requestFile); requestFiles.add(row.requestFile);
    const sha=canonical(body);
    need(sha===s.start.requestSha256 && sha===a.requestSha256 && sha===r.requestSha256,'exact request mismatch');
    need(/^[A-Za-z0-9_-]+$/.test(a.jobId) && a.jobId.endsWith('-'+sha.slice(0,16)) && a.attemptId.startsWith(a.jobId+'-attempt-') && /^[1-9][0-9]*$/.test(a.attemptId.slice((a.jobId+'-attempt-').length)),'dispatched hash-suffixed ID mismatch');
    need(body.model==='gpt-6-1-sol-society-of-mind' && body.reasoning?.effort==='high','unrecognized dispatched model');
    const admitted=token(s.start.admittedTokens),maximum=token(body.max_output_tokens);
    need(maximum>0n && admitted>=maximum && reservation>=(admitted-maximum)*5000n+maximum*20000n,'under-reserved pre-dispatch token guard');
    let raw=null;
    if (row.responseFile) {
      raw=json(row.responseFile);
      need(raw.id===a.responseId && raw.status===a.responseStatus && raw.model===body.model,'raw response identity mismatch');
      need(['completed','incomplete','failed','cancelled'].includes(raw.status),'nonterminal response');
      need(!responses.has(raw.id),'reused response ID'); responses.add(raw.id);
      need(eq(raw.usage ?? null,a.usage ?? null),'raw usage mismatch');
    } else need(!a.responseId && !a.usage && (a.errorClass || a.error || a.httpStatus>=400),'missing raw terminal response');
    need(eq(l.usage ?? null,a.usage ?? null),'ledger usage mismatch');
    let cost;
    if (a.usage) {
      cost=tokenCost(a.usage); reference+=tokenCost(a.usage,false); upper+=cost;
      const recorded=usd(l.actualUsd); need(recorded<=cost+2n && recorded+2n>=cost,'ledger estimated cost mismatch');
    } else { cost=reservation; unknown+=reservation; }
    need(cost<=reservation,'under-reserved dispatch'); costs.set(row.attemptId,cost);
    const software=/^expanded-software-(?:audit|repair)$/.test(a.phase);
    need(software ? !sem.has(row.attemptId) : sem.has(row.attemptId),'omitted semantic role or software included in semantic lineage');
    if (!software) {
      const role=sem.get(row.attemptId);
      for (const k of ['jobId','phase','requestSha256','responseId','responseStatus','usage']) need(eq(role[k] ?? null,a[k] ?? null),'semantic attempt differs from journal');
    }
  }
  need([...sem.keys()].every(id=>states.has(id)),'semantic attempt absent from journal');
  let committed=0n,active=0n;
  for (const {event:e} of lines) {
    const reservation=usd(ledger.reservations[e.attemptId].reservedUsd);
    if (e.state==='started') active+=reservation;
    if (e.state==='finished') { active-=reservation; committed+=costs.get(e.attemptId); }
    need(active>=0n && active+committed<=usd(20),'pre-dispatch task budget overrun');
  }
  need(active===0n && committed===upper+unknown,'unsettled cost proof');
  if (p.pollsFile) {
    for (const {event} of journalLines(get(p.pollsFile))) need(states.has(event.attemptId),'poll for unjournaled request');
  }
  if (entry.version==='atomic-generalizations-20261019-v3') validateRecovery(trace);
  return {attempts:ids.length,semanticAttempts:sem.size,referenceEstimatedUsd:money(reference),conservativeEstimatedUsd:money(upper),unknownUsageReservationUsd:money(unknown),committedUsd:money(committed),headroomAfterTaskUsd:money(headroom),activeRequests:0};
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const entry=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(process.argv[2]);
  const read=name=>fs.readFileSync(path.join(dir,name));
  const result=validateExecutionProof(entry,JSON.parse(read('release-lock.json')),JSON.parse(read('presentation-trace.json')),read);
  process.stdout.write(JSON.stringify(result)+'\n');
}
