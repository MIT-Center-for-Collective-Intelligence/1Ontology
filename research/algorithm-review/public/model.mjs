export const kinds = new Set(['step','sequence','parallel','conditional','loop','recursion','recur','skip','unordered','unknown','unsupported','atomic']);
export function children(f) {
 if (!f || typeof f !== 'object') return [];
 switch(f.type) {
 case 'sequence': case 'unordered': return (Array.isArray(f.items)?f.items:[]).map((v,i)=>[`items[${i}]`,v]);
 case 'parallel': return (Array.isArray(f.branches)?f.branches:[]).map((v,i)=>[`branches[${i}]`,v.flow||v]);
 case 'conditional': return [...(Array.isArray(f.cases)?f.cases:[]).map((v,i)=>[`cases[${i}] ${phrase(v.condition)}`,v.flow]), ...(f.else?[['otherwise',f.else]]:[])];
 case 'loop': return [['body',f.body],...(f.fallback?[['fallback',f.fallback]]:[])];
 case 'recursion': return [['base case '+phrase(f.baseCase?.condition),f.baseCase?.flow],['recursive case '+phrase(f.recursiveCase?.condition),f.recursiveCase?.flow]];
 default:return [];
 }
}
export function phrase(v) { return typeof v==='string'?v:v?.description||v?.predicate||v?.claim||v?.observable||'Condition unspecified'; }
export function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export function inspectCapture(c) {
 const errors=[]; const nodes=new Map();
 if (!Array.isArray(c.nodes)||!Array.isArray(c.algorithms)) return ['Missing nodes or algorithms'];
 for(const n of c.nodes){if(nodes.has(n.id))errors.push('Duplicate node '+n.id);nodes.set(n.id,n);}
 for(const n of c.nodes)for(const id of n.children||[])if(!nodes.has(id))errors.push('Unbound captured taxonomy edge '+id);
 const keys=new Set();
 for(const a of c.algorithms){
  const key=a.nodeId+':'+a.version;if(keys.has(key))errors.push('Duplicate algorithm version '+key);keys.add(key);
  if(!nodes.get(a.nodeId)?.activityEligible)errors.push('Ineligible subject '+a.nodeId);
  if(!a.procedureHash||!a.procedure)errors.push('Missing procedure provenance '+key);
  const p=a.procedure;
  if(p.nodeId!==undefined&&p.nodeId!==a.nodeId)errors.push('Procedure bound to another node '+key);
  if(!Array.isArray(p.steps)||!p.steps.length)errors.push('Missing/duplicate steps '+key);
  for(const s of p.steps||[]){if(!nodes.get(s.activityNodeId)?.activityEligible)errors.push('Unbound/ineligible step '+s.stepId);if(s.activityNodeId===a.nodeId)errors.push('Step binds to its own subject '+key+' '+s.stepId);}
  errors.push(...inspectFlow(p.flow,p.steps,key));
 }
 return errors;
}
export function inspectFlow(flow,stepList,key){
 const errors=[];const steps=new Map((stepList||[]).map(s=>[s.stepId,s]));const used=new Set();
 if(Array.isArray(stepList)&&steps.size!==stepList.length)errors.push('Missing/duplicate steps '+key);
 function visit(f,depth=0){if(!f||depth>100||!kinds.has(f.type)){errors.push('Unknown/malformed flow '+key);return;}
  if(['sequence','unordered'].includes(f.type)&&(!Array.isArray(f.items)||!f.items.length))errors.push('Missing flow items '+key);
  if(f.type==='parallel'&&(!Array.isArray(f.branches)||!f.branches.length||!f.join))errors.push('Missing branches/join '+key);
  if(f.type==='conditional'&&(!Array.isArray(f.cases)||!f.cases.length||f.cases.some(v=>!v.condition||!v.flow)))errors.push('Missing conditional cases '+key);
  if(f.type==='loop'&&(!f.guard||!f.body||!f.progressMeasure||!f.termination))errors.push('Missing loop semantics '+key);
  if(f.type==='recursion'&&(!f.baseCase?.condition||!f.baseCase?.flow||!f.recursiveCase?.condition||!f.recursiveCase?.flow||!f.decreaseMeasure||!f.termination))errors.push('Missing recursion semantics '+key);
  if(f.type==='recur'&&!f.subproblemMapping)errors.push('Missing smaller input mapping '+key);
  if(f.type==='step'){if(!steps.has(f.stepId))errors.push('Unbound flow step '+f.stepId);used.add(f.stepId);}
  for(const [,v] of children(f))visit(v,depth+1);
 }visit(flow);
 for(const id of steps.keys())if(!used.has(id))errors.push('Declared step never used in flow '+key+' '+id);
 return errors;
}
export function flowTypes(f,out=new Set()){if(f?.type){out.add(f.type);for(const [,v] of children(f))flowTypes(v,out);}return out;}
export function ancestors(c,id){const nodes=new Map(c.nodes.map(n=>[n.id,n]));const seen=new Set();const stack=[...(nodes.get(id)?.parents||[])];while(stack.length){const p=stack.pop();if(seen.has(p))continue;seen.add(p);stack.push(...(nodes.get(p)?.parents||[]));}return seen;}
export function reviewWarnings(c){
 const nodes=new Map(c.nodes.map(n=>[n.id,n]));const warnings=[];
 for(const a of c.algorithms){const key=a.nodeId+':'+a.version;const up=ancestors(c,a.nodeId);const subject=nodes.get(a.nodeId);
  for(const s of a.procedure.steps||[])if(up.has(s.activityNodeId))warnings.push({key,code:'step-is-ancestor',message:`Step ${s.stepId} uses “${nodes.get(s.activityNodeId)?.title}”, which is also a recorded taxonomy ancestor of this activity. Deriving that ancestor's algorithm from its children would then depend on itself.`});
  if(!subject?.parents?.length&&!subject?.contextComplete)warnings.push({key,code:'parents-not-captured',message:'No parent is recorded in this projection; the subject is not a root, its placement context was simply not captured.'});
  (function visit(f){if(!f)return;if(f.type==='conditional'&&!f.else)warnings.push({key,code:'conditional-without-otherwise',message:'Conditional has no otherwise branch; uncovered states remain unresolved.'});if(['unordered','unknown','unsupported','atomic'].includes(f.type))warnings.push({key,code:'incomplete-control',message:`Flow contains an incomplete “${f.type}” relation.`});for(const [,v] of children(f))visit(v);})(a.procedure.flow);
 }
 const types=new Set(c.algorithms.flatMap(a=>[...flowTypes(a.procedure.flow)]));
 for(const t of ['parallel','conditional','loop','recursion'])if(!types.has(t))warnings.push({key:'capture',code:'construct-unexercised',message:`No captured algorithm uses “${t}”; that construct's validation has only been exercised by synthetic tests.`});
 return warnings;
}
export function inspectReview(r,c){
 const errors=[];const byKey=new Map(c.algorithms.map(a=>[a.nodeId+':'+a.version,a]));const nodes=new Set(c.nodes.map(n=>n.id));
 for(const e of r.algorithms||[]){const key=e.nodeId+':'+e.version;const a=byKey.get(key);
  if(!a){errors.push('Review entry for uncaptured algorithm '+key);continue;}
  if(e.procedureHash!==a.procedureHash)errors.push('Review entry bound to a different procedure '+key);
  if(e.proposedFlow)errors.push(...inspectFlow(e.proposedFlow,a.procedure.steps,'proposal '+key));
 }
 for(const p of r.structureProposals||[])for(const id of [...(p.nodeIds||[]),...(p.groups||[]).flatMap(g=>g.nodeIds)])if(!nodes.has(id))errors.push('Structure proposal references uncaptured node '+id);
 return errors;
}
export function treePaths(c,start,maxDepth=12,maxRows=500){
 const nodes=new Map(c.nodes.map(n=>[n.id,n]));const rows=[];
 function visit(id,ancestors){if(rows.length>=maxRows)return;const n=nodes.get(id);if(!n)return;
 const cycle=ancestors.includes(id);rows.push({id,title:n.title,depth:ancestors.length,cycle,omitted:!n.contextComplete});
 if(cycle||ancestors.length>=maxDepth){rows.at(-1).truncated=!cycle;return;}
 for(const child of n.children||[])visit(child,[...ancestors,id]);
 }visit(start,[]);return rows;
}
export function annotationKey(captureHash,a){return `${captureHash}:${a.nodeId}:${a.version}:${a.procedureHash}`;}
export function annotationState(note,captureHash,a){return note?.binding===annotationKey(captureHash,a)?'current':'stale or unknown';}
