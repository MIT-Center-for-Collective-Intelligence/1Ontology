import {
  SomInspectionItem,
  SomInspectionRecordSource,
  SomInspectionReviewer,
  SomInspectionTask,
} from "../../types/ISomReview";

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

export const inspectionTaskKey = (
  datasetId: string,
  issueType: string,
): string => `${datasetId}::${issueType}`;

export const selectInspectionReviewer = (
  reviewers: SomInspectionReviewer[],
  requestedReviewerId: string | undefined,
  inspectorId: string,
): string | undefined => {
  if (
    requestedReviewerId &&
    reviewers.some((reviewer) => reviewer.reviewerId === requestedReviewerId)
  ) {
    return requestedReviewerId;
  }
  return (
    reviewers.find((reviewer) => reviewer.reviewerId === inspectorId)
      ?.reviewerId || reviewers[0]?.reviewerId
  );
};

export const inspectionTasks = (
  items: SomInspectionItem[],
): SomInspectionTask[] => {
  const tasks = new Map<string, SomInspectionTask>();
  for (const item of items) {
    const key = inspectionTaskKey(item.datasetId, item.card.issueType);
    const existing = tasks.get(key);
    if (existing) {
      existing.responseCount += 1;
      existing.agreeCount += item.subjectResponse.decision === "agree" ? 1 : 0;
      existing.disagreeCount +=
        item.subjectResponse.decision === "disagree" ? 1 : 0;
      existing.exceptionCount += item.exception ? 1 : 0;
      existing.currentlyApplicableCount += item.currentlyApplicable ? 1 : 0;
      continue;
    }
    tasks.set(key, {
      key,
      datasetId: item.datasetId,
      datasetLabel: item.datasetLabel,
      currentRound: item.currentRound,
      issueType: item.card.issueType,
      issueLabel: item.issueLabel,
      responseCount: 1,
      agreeCount: item.subjectResponse.decision === "agree" ? 1 : 0,
      disagreeCount: item.subjectResponse.decision === "disagree" ? 1 : 0,
      exceptionCount: item.exception ? 1 : 0,
      currentlyApplicableCount: item.currentlyApplicable ? 1 : 0,
    });
  }
  return [...tasks.values()];
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
