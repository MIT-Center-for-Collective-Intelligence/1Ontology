import { getRelationshipDataset } from "./dataset";
export function relationshipReviewRelease() {
  const { dataset, sha256 } = getRelationshipDataset();
  if (dataset.cases.length !== 68)
    throw Error("Relationship proposal set is incomplete");
  return {
    version: dataset.version,
    cases: dataset.cases.length,
    model: dataset.model,
    reasoning: dataset.reasoning,
    bundleSha256: sha256,
    sourceSha256: dataset.sourceSha256,
  };
}
