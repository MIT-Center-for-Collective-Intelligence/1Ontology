/** Bind source identifiers without constraining the model's explanations.
 * JSON roundtripping deliberately breaks shared object aliases in schema
 * builders; structuredClone preserves those aliases. */
export function bindRelationshipCase(schema, sourceId, kind) {
  const copy = JSON.parse(JSON.stringify(schema));
  if (kind === "author") {
    const cases = copy.properties.cases;
    cases.minItems = cases.maxItems = 1;
    cases.items.properties.analysis.properties.nodeId.enum = [sourceId];
    cases.items.properties.card.properties.caseId.enum = [sourceId];
  } else if (kind === "critic") {
    const assessments = copy.properties.assessments;
    assessments.minItems = assessments.maxItems = 1;
    assessments.items.properties.caseId.enum = [sourceId];
  } else throw Error("Unknown relationship review schema kind");
  assertFreeRelationshipExplanations(copy);
  return copy;
}
const prose = new Set([
  "summary", "meaning", "reason", "counterexample", "whyCloser",
  "whyNotPreferred", "example", "caution", "definitionConflict",
  "headline", "whyChange", "quote", "alternativeAssessment",
  "erroneousCriterion", "correction", "remainingSubstantiveObjection",
]);
const objectionArrays = new Set(["materialObjections", "remainingMaterialObjections"]);
export function assertFreeRelationshipExplanations(schema) {
  if (!schema || typeof schema !== "object") throw Error("Missing relationship output schema");
  const unrestricted = (field) => field && field.enum === undefined && field.const === undefined;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, field] of Object.entries(node.properties || {})) {
      if (prose.has(key) && !unrestricted(field))
        throw Error("Relationship explanation field is constrained: " + key);
      if (objectionArrays.has(key) && !unrestricted(field.items))
        throw Error("Relationship objection text is constrained: " + key);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  };
  walk(schema);
}
