import {children,phrase,annotationKey,annotationState} from './model.mjs';
const $=id=>document.getElementById(id);const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const {capture,captureHash,review,warnings=[]}=await fetch('/api/capture').then(r=>{if(!r.ok)throw Error('Capture unavailable');return r.json();});
const nodes=new Map(capture.nodes.map(n=>[n.id,n]));let selected;
function dump(value){const p=element('pre',JSON.stringify(value,null,2));return p;}
function disclosure(title,value){const d=element('details');d.append(element('summary',title),dump(value));return d;}
function button(title,fn){const b=element('button',title);b.type='button';b.onclick=fn;return b;}
function bullets(items){const ul=element('ul');for(const t of items)ul.append(element('li',t));return ul;}
function findings(title,items){const d=element('details');d.append(element('summary',title),bullets(items));return d;}
$('status').replaceChildren(element('p',`Captured ${capture.algorithms.length} source-current algorithms as of capture. This public projection cannot revalidate full source, native receipts or new-node absence claims.`),disclosure('Coverage and capture provenance',{coverage:capture.coverage,provenance:capture.provenance,captureHash}));
if(review){const d=element('details');d.append(element('summary',`Review findings (${review.reviewedAt}, ${review.status})`),element('p',review.reviewer));for(const g of review.general){d.append(element('h3',g.title),element('p',g.finding));}$('status').append(d);}
const captureWarnings=warnings.filter(w=>w.key==='capture').map(w=>w.message);if(captureWarnings.length)$('status').append(findings('Validator findings across the capture',captureWarnings));
function list(){const q=$('search').value.toLowerCase();$('list').replaceChildren();for(const n of capture.nodes.filter(n=>n.title.toLowerCase().includes(q)))$('list').append(button(n.title+ (capture.algorithms.some(a=>a.nodeId===n.id)?' · captured algorithm':''),()=>select(n.id)));}
$('search').oninput=list;list();
function tree(id){$('tree').replaceChildren();const n=nodes.get(id);const roots=n.parents?.length?n.parents:[id];let count=0;
 function row(current,path,depth){const n=nodes.get(current);if(!n)return element('p','Omitted node context');if(count++>700)return element('p','Additional branches omitted: browse another node to inspect.');
 const wrap=element('div');wrap.className='tree-node';const b=button(n.title,()=>select(current));if(current===id)b.className='selected';wrap.append(b);
 if(path.includes(current)){wrap.append(element('p','Taxonomy cycle: affected derivations blocked.'));return wrap;}
 if(depth>=12){wrap.append(element('p','Deeper recorded context omitted from this view.'));return wrap;}
 if(n.children?.length){const d=element('details');d.open=true;d.append(element('summary',`${n.children.length} captured children`));for(const child of n.children)d.append(row(child,[...path,current],depth+1));wrap.append(d);}
 if(!n.contextComplete)wrap.append(element('small','Additional source context may be omitted.'));return wrap;
 }if(!n.parents?.length&&!n.contextComplete)$('tree').append(element('p','Parent not captured in this projection; this activity is not a root.'));for(const root of roots)$('tree').append(row(root,[],0));}
function inspect(label,value,algorithm){$('inspector').replaceChildren(element('h2',label),element('p','Captured rationale and support. Hypotheses remain unproven.'),dump(value),disclosure('Source claims',algorithm.procedure.sourceClaims||[]),disclosure('Hypotheses',algorithm.procedure.hypotheses||[]));}
function flow(f,a,path='flow',depth=0){const div=element('div');div.className='flow '+(f?.type||'unknown');if(!f||depth>60){div.append(element('p','Flow unavailable or deeper flow omitted'));return div;}
 const s=a.procedure.steps?.find(s=>s.stepId===f.stepId);const label=f.type==='step'?(s?.role||s?.label||'Unbound step'):f.type;
 div.append(button(label,()=>inspect(path,{flow:f,step:s},a)));
 if(s){const n=nodes.get(s.activityNodeId);div.append(element('p',n?.title||'Unbound activity'));if(n)div.append(button('Open existing activity',()=>select(n.id)));}
 if(f.type==='conditional')div.append(element('p','Choose the applicable guard path; uncovered states remain unresolved.'));
 if(f.type==='parallel')div.append(element('p','Split into independent branches; join: '+phrase(f.join?.completionCondition)));
 if(f.type==='loop')div.append(element('p','↻ Repeat while '+phrase(f.guard)+' · stop: '+phrase(f.termination)));
 if(f.type==='recursion')div.append(element('p','↶ Base case or call on a smaller input. Algorithm recursion is distinct from taxonomy cycles.'));
 if(['unordered','unknown','atomic','unsupported'].includes(f.type)){const p=element('p','Incomplete control relation: '+phrase(f.reason));p.className='warning';div.append(p);}
 const branches=element('div');branches.className='branches';for(const [name,v]of children(f)){const child=flow(v,a,path+'.'+name,depth+1);child.prepend(element('strong',name));branches.append(child);}div.append(branches);
 if(f.type==='parallel')div.append(button('Join details',()=>inspect(path+'.join',f.join,a)));
 if(f.type==='loop'||f.type==='recursion')div.append(button('Progress and termination',()=>inspect(path,{progress:f.progressMeasure||f.decreaseMeasure,termination:f.termination,subproblem:f.subproblemMapping},a)));
 return div;}
function annotations(a,container){const key=annotationKey(captureHash,a);const storage='algorithm-review:'+key;let note;try{note=JSON.parse(localStorage.getItem(storage)||'null');}catch{}
 container.append(element('h3','Your local critique'),element('p','Stored only in this browser, bound to this exact capture, node, version and procedure. It does not alter captured reviews or grant acceptance.'));
 const text=element('textarea');text.setAttribute('aria-label','Your critique');text.value=note?.text||'';container.append(text);const state=element('p',note?annotationState(note,captureHash,a):'No local annotation');container.append(state);
 container.append(button('Save local critique',()=>{const value={binding:key,text:text.value,recordedAt:new Date().toISOString(),kind:'independent-human-annotation'};try{localStorage.setItem(storage,JSON.stringify(value));state.textContent='Saved locally for this exact version';}catch{state.textContent='Browser storage unavailable; export your critique instead.';}}));
 container.append(button('Export critique',()=>{const data={binding:key,text:text.value,kind:'independent-human-annotation',recordedAt:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=element('a');link.href=url;link.download='algorithm-critique.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
}
function select(id){selected=id;const n=nodes.get(id);if(!n)return;tree(id);const target=$('detail');target.replaceChildren(element('h2',n.title));$('inspector').replaceChildren(element('h2','Flow inspector'),element('p','Select a step or control relation.'));
 for(const p of (review?.structureProposals||[]).filter(p=>[...(p.nodeIds||[]),...(p.groups||[]).flatMap(g=>g.nodeIds)].includes(id))){const s=element('section');s.className='proposal';s.append(element('h3','Structure proposal (not accepted)'),element('p',p.summary));for(const g of p.groups||[]){s.append(element('h4',g.title));for(const k of g.nodeIds)s.append(button(nodes.get(k)?.title||k,()=>select(k)));}if(p.notes)s.append(element('p',p.notes));target.append(s);}
 const algorithms=capture.algorithms.filter(a=>a.nodeId===id).sort((a,b)=>b.version-a.version);
 if(!algorithms.length){target.append(element('p','No algorithm captured for this activity. Captured taxonomy context contributes zero algorithm coverage.'));return;}
 for(const a of algorithms){const key=a.nodeId+':'+a.version;const entry=review?.algorithms?.find(e=>e.nodeId===a.nodeId&&e.version===a.version);const own=warnings.filter(w=>w.key===key).map(w=>w.message);
  target.append(element('h3',`Captured version ${a.version}`),element('p',a.rationale||'See captured procedure rationale.'),element('p',`Captured pipeline research status: ${a.pipelineReviewStatus||'unverified'} · captured human review: ${a.capturedReviewStatus||'unverified'} · source support: ${a.sourceSupportStatus||'unverified'}`),flow(a.procedure.flow,a));
  const critiques=element('section');critiques.append(element('h4','Captured independent critiques'));for(const c of a.critiques||[])critiques.append(element('p',`${c.role} · ${c.verdict}${c.objections?.length?` · ${c.objections.length} objections`:' · no objections'}: ${c.finding}`));target.append(critiques);
  if(own.length){const w=element('section');w.className='warning';w.append(element('h4','Validator findings'),bullets(own));target.append(w);}
  if(entry){const r=element('section');r.className='proposal';r.append(element('h4',`Review ${review.reviewedAt}: ${entry.verdict}`));if(entry.procedureHash!==a.procedureHash)r.append(element('p','This review was written against a different procedure and is stale.'));r.append(bullets(entry.findings));
   if(entry.proposedFlow){r.append(element('h4','Proposed revised flow (not captured, not accepted)'),element('p',entry.proposedRationale||''),flow(entry.proposedFlow,a,'proposedFlow'));}target.append(r);}
  target.append(disclosure('Captured research reviews',a.reviews||[]),disclosure('Captured independent critiques (raw)',a.critiques||[]),disclosure('Objection dispositions',a.procedure.objectionDispositions||[]),disclosure('Version history and lineage',a.history||a.versionHistory||{note:'Full history not included in public projection.'}),disclosure('Separate ontology change proposals',a.procedure.changeProposals||[]),disclosure('Full captured procedure and digest',a));annotations(a,target);}}
const first=capture.algorithms[0]?.nodeId||capture.nodes[0]?.id;if(first)select(first);
