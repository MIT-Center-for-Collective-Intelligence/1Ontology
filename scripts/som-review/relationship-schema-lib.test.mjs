import {test} from "node:test";
import assert from "node:assert/strict";
import {bindRelationshipCase, assertFreeRelationshipExplanations} from "./relationship-schema-lib.mjs";
const object = (properties) => ({type:"object",properties});
test("author ID binding leaves shared prose definitions unrestricted", () => {
  const text={type:"string"};
  const schema=object({cases:{type:"array",items:object({analysis:object({nodeId:text,summary:text,meaning:text}),card:object({caseId:text,headline:text})})}});
  const before=JSON.stringify(schema), bound=bindRelationshipCase(schema,"source-id","author");
  assert.deepEqual(bound.properties.cases.items.properties.analysis.properties.nodeId.enum,["source-id"]);
  assert.deepEqual(bound.properties.cases.items.properties.card.properties.caseId.enum,["source-id"]);
  assert.equal(bound.properties.cases.items.properties.analysis.properties.summary.enum,undefined);
  assert.equal(bound.properties.cases.items.properties.card.properties.headline.enum,undefined);
  assert.equal(bound.properties.cases.minItems,1);
  assert.equal(bound.properties.cases.maxItems,1);
  assert.equal(JSON.stringify(schema),before);
});
test("critic ID binding does not restrict reasons or objection strings", () => {
  const text={type:"string"};
  const schema=object({assessments:{type:"array",items:object({caseId:text,reason:text,materialObjections:{type:"array",items:text}})}});
  const bound=bindRelationshipCase(schema,"source-id","critic");
  assert.deepEqual(bound.properties.assessments.items.properties.caseId.enum,["source-id"]);
  assert.equal(bound.properties.assessments.items.properties.reason.enum,undefined);
  assert.equal(bound.properties.assessments.items.properties.materialObjections.items.enum,undefined);
});
test("the shared-reference failure is rejected before inference or release", () => {
  const text={type:"string"};
  const schema=object({assessments:{type:"array",items:object({caseId:text,reason:text,materialObjections:{type:"array",items:text}})}});
  const aliased=structuredClone(schema);
  aliased.properties.assessments.items.properties.caseId.enum=["source-id"];
  assert.throws(()=>assertFreeRelationshipExplanations(aliased),/explanation field is constrained/);
  assert.throws(()=>assertFreeRelationshipExplanations(object({materialObjections:{type:"array",items:{type:"string",const:"source-id"}}})),/objection text is constrained/);
});
