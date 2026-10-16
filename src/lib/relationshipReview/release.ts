import { getRelationshipDataset } from "./dataset";
import { getRelationshipPresentation } from "./presentation";
export function relationshipReviewRelease() {
  const { dataset, sha256 } = getRelationshipDataset();
  if (dataset.cases.length !== 68)
    throw Error("Relationship proposal set is incomplete");
  const { presentation, sha256: presentationSha256 } =
    getRelationshipPresentation(dataset, sha256);
  return {
    version: dataset.version,
    cases: dataset.cases.length,
    model: dataset.model,
    reasoning: dataset.reasoning,
    bundleSha256: sha256,
    sourceSha256: dataset.sourceSha256,
    presentationVersion: presentation.version,
    selectedProposals: presentation.selectedCaseIds.length,
    presentationSha256,
  };
}
