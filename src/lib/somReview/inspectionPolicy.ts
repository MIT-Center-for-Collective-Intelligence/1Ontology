import { SomInspectionRecordSource } from "../../types/ISomReview";

export const inspectableReviewerCounts = (
  rounds: Array<{
    proposalIds: ReadonlySet<string>;
    responses: Array<{ proposalId: string; reviewerId: string }>;
  }>,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const { proposalIds, responses } of rounds) {
    for (const response of responses) {
      if (!proposalIds.has(response.proposalId)) continue;
      counts.set(
        response.reviewerId,
        (counts.get(response.reviewerId) || 0) + 1,
      );
    }
  }
  return counts;
};

export const inspectionRecordSource = (
  record: Record<string, unknown>,
): SomInspectionRecordSource => {
  if (record.reviewMode === "status-quo-audit") return "status-quo-audit";
  if (record.reviewMode === "manual-check") return "manual-check";
  return "proposed-change";
};

/**
 * Confidence is retained for research analysis but can never authorize an
 * ontology mutation. Application scripts require reviewed proposal IDs and a
 * snapshot-bound plan instead.
 */
export const confidenceAuthorizesOntologyMutation = (
  _detectorConfidence: unknown,
  _judgeConfidence: unknown,
): false => false;
