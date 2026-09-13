// These observations are mechanical checks, never semantic corrections.
export const softwareChecks = 'Ordinary code checks whether the answer can be read, whether description numbers exist, and whether any description is missing or repeated. It flags empty groups, repeated titles, inconsistent grouping of identical descriptions, titles outside 2–5 words, and changes to the leading verb. A description supporting more than one group is shown as a representation-policy question. The code does not change the model answer, assign missing descriptions, decide semantic correctness, approve a grouping, or write to the ontology.';

export function inspectTitleAnswer(input, rawOutput, status) {
  const observations = [];
  let answer;
  try { answer = JSON.parse(rawOutput); } catch { return { groups: [], reason: '', observations: ['The answer could not be read in the requested output format.'], status: status === 'completed' ? 'format-invalid' : status }; }
  if (!answer || !Array.isArray(answer.groups) || typeof answer.reason !== 'string' || answer.groups.some(g =>
    !g || typeof g.title !== 'string' || typeof g.reason !== 'string' || !Array.isArray(g.descriptionNumbers) || g.descriptionNumbers.some(n => !Number.isInteger(n)))) {
    return {groups:[],reason:'',observations:['The answer does not have the requested output fields. Inspect the original answer.'],status:'format-invalid'};
  }
  if (status !== 'completed') return {groups:[],reason:'',observations:['The request did not complete; its partial answer is retained only for inspection.'],status};
  const ids = new Set(input.descriptions.map(s=>s.number));
  const membership = new Map();
  const titles = new Set();
  const verb = input.title.split(/\s+/)[0].toLowerCase();
  if (!answer.groups.length) observations.push('No proposed groups were returned.');
  for (const g of answer.groups) {
    const normalized = g.title.trim().toLowerCase();
    if (titles.has(normalized)) observations.push(`The title “${g.title}” appears in more than one group.`);
    titles.add(normalized);
    if (!g.descriptionNumbers.length) observations.push(`“${g.title}” has no supporting description numbers.`);
    const words = g.title.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) observations.push(`“${g.title}” is outside the requested 2–5 word length.`);
    if (words[0]?.toLowerCase() !== verb) observations.push(`“${g.title}” changes the leading verb. Verb changes remain a later decision.`);
    if (!g.reason.trim()) observations.push(`“${g.title}” has no rationale.`);
    if (new Set(g.descriptionNumbers).size !== g.descriptionNumbers.length) observations.push(`“${g.title}” repeats a description number within the same group.`);
    for (const n of new Set(g.descriptionNumbers)) {
      if (!ids.has(n)) observations.push(`“${g.title}” refers to unknown description #${n}.`);
      membership.set(n,(membership.get(n)||0)+1);
    }
  }
  if (!answer.reason.trim()) observations.push('The overall rationale is empty.');
  for (const n of ids) {
    if (!membership.has(n)) observations.push(`Description #${n} is missing from the proposed groups.`);
    if (membership.get(n)>1) observations.push(`Description #${n} supports more than one proposed group. Discuss the representation policy before accepting this arrangement.`);
  }
  const duplicateTexts = new Map();
  for (const source of input.descriptions) {
    const assigned = answer.groups.map((g,i)=>g.descriptionNumbers.includes(source.number)?i:null).filter(i=>i!==null).join(',');
    const previous = duplicateTexts.get(source.text);
    if (previous && previous.assigned !== assigned) observations.push(`Identical descriptions #${previous.number} and #${source.number} have different group assignments.`);
    else duplicateTexts.set(source.text,{number:source.number,assigned});
  }
  return {groups:answer.groups,reason:answer.reason,observations,status};
}
