import type {
  RelationshipCase,
  RelationshipDataset,
  RelationshipPresentation,
} from "../../types/IRelationshipReview";
export function generalizationChanges(item: RelationshipCase) {
  const current = item.currentParents.map((n) => n.id);
  const proposed = item.analysis.proposedParents.map((n) => n.nodeId);
  return {
    added: proposed.filter((id) => !current.includes(id)),
    removed: current.filter((id) => !proposed.includes(id)),
    retained: proposed.filter((id) => current.includes(id)),
  };
}
export function selectedReviewCases(
  dataset: RelationshipDataset,
  presentation?: RelationshipPresentation,
) {
  if (!presentation || presentation.datasetVersion !== dataset.version)
    return [];
  const byId = new Map(dataset.cases.map((c) => [c.id, c]));
  return presentation.selectedCaseIds
    .map((id) => byId.get(id))
    .filter((c): c is RelationshipCase => {
      if (!c) return false;
      const card = presentation.cards.find((x) => x.caseId === c.id);
      const delta = generalizationChanges(c);
      return (
        !!card?.eligible &&
        !card.remainingMaterialObjections.length &&
        c.analysis.judgment !== "keep" &&
        !!(delta.added.length || delta.removed.length) &&
        !c.mechanicalIssues.length &&
        !c.interProposalIssues?.length
      );
    });
}
