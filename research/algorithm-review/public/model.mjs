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
  const p=a.procedure;const steps=new Map((p.steps||[]).map(s=>[s.stepId,s]));
  if(!Array.isArray(p.steps)||!p.steps.length||steps.size!==p.steps.length)errors.push('Missing/duplicate steps '+key);
  for(const s of p.steps||[])if(!nodes.get(s.activityNodeId)?.activityEligible)errors.push('Unbound/ineligible step '+s.stepId);
  function visit(f,depth=0){if(!f||depth>100||!kinds.has(f.type)){errors.push('Unknown/malformed flow '+key);return;}
   if(['sequence','unordered'].includes(f.type)&&(!Array.isArray(f.items)||!f.items.length))errors.push('Missing flow items '+key);
   if(f.type==='parallel'&&(!Array.isArray(f.branches)||!f.branches.length||!f.join))errors.push('Missing branches/join '+key);
   if(f.type==='conditional'&&(!Array.isArray(f.cases)||!f.cases.length||f.cases.some(v=>!v.condition||!v.flow)))errors.push('Missing conditional cases '+key);
   if(f.type==='loop'&&(!f.guard||!f.body||!f.progressMeasure||!f.termination))errors.push('Missing loop semantics '+key);
   if(f.type==='recursion'&&(!f.baseCase?.condition||!f.baseCase?.flow||!f.recursiveCase?.condition||!f.recursiveCase?.flow||!f.decreaseMeasure||!f.termination))errors.push('Missing recursion semantics '+key);
   if(f.type==='recur'&&!f.subproblemMapping)errors.push('Missing smaller input mapping '+key);
   if(f.type==='step'&&!steps.has(f.stepId))errors.push('Unbound flow step '+f.stepId);
   for(const [,v] of children(f))visit(v,depth+1);
  }visit(p.flow);
 }
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
