import {
  SomInspectionItem,
  SomInspectionRecordSource,
  SomInspectionReviewer,
  SomInspectionTask,
  SomIssueType,
} from "../../types/ISomReview";
import { SOM_REVIEW_PATH } from "./reviewDependencies";

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

const INSPECTION_ISSUE_LABELS: Record<SomIssueType, string> = {
  "cross-branch-recall": "Potentially missing nodes for this sub-branch",
  "evidence-specialization": "Specific activities supported by O*NET",
  "title-clarity": "Unclear activity titles",
  "synonym-enrichment": "Missing recorded synonyms",
  "description-enrichment": "Missing descriptions",
  "misc-facet-duplicate": "Possible repeated concepts",
  "mistaken-synonym": "Incorrectly recorded synonyms",
  "duplicate-synonym": "Possible duplicate activities",
  polysemy: "Titles with multiple meanings",
  "flat-list-grouping": "Groups for long sibling lists",
  "compound-object-grouping": "Groups for compound objects",
  "collection-design": "Collections of existing activities",
  placement: "Activities under an incorrect parent",
  "wrong-verb": "Activities using a different main action",
  "node-merge": "Exact node consolidations",
  relocation: "Historical exact node moves",
  "sense-relocation": "Separate and move one meaning",
  "missing-activity": "Potentially missing activities",
  "redundant-node": "Potentially redundant nodes",
  "empty-node": "Empty-node cleanup",
  "empty-collection": "Empty-collection cleanup",
};

const INSPECTION_ISSUE_ORDER = SOM_REVIEW_PATH.flatMap(
  (step) => step.issueTypes,
);

export const inspectionIssueLabel = (issueType: SomIssueType): string =>
  INSPECTION_ISSUE_LABELS[issueType];

export const inspectionTaskKey = (issueType: string): string =>
  `issue::${issueType}`;

/** Accepts both canonical keys and links created by the older round-specific UI. */
export const inspectionIssueTypeFromTaskKey = (
  taskKey: string | undefined,
): SomIssueType | undefined => {
  const candidate = String(taskKey || "")
    .split("::")
    .at(-1) as SomIssueType;
  return INSPECTION_ISSUE_ORDER.includes(candidate) ? candidate : undefined;
};

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
    const key = inspectionTaskKey(item.card.issueType);
    const existing = tasks.get(key);
    if (existing) {
      existing.responseCount += 1;
      existing.agreeCount += item.subjectResponse.decision === "agree" ? 1 : 0;
      existing.disagreeCount +=
        item.subjectResponse.decision === "disagree" ? 1 : 0;
      existing.exceptionCount += item.exception ? 1 : 0;
      existing.currentlyApplicableCount += item.currentlyApplicable ? 1 : 0;
      if (!existing.datasetIds.includes(item.datasetId)) {
        existing.datasetIds.push(item.datasetId);
        existing.datasetLabels.push(item.datasetLabel);
        existing.roundCount += 1;
      }
      if (item.currentRound && !existing.currentRound) {
        existing.datasetId = item.datasetId;
        existing.datasetLabel = item.datasetLabel;
      }
      existing.currentRound ||= item.currentRound;
      continue;
    }
    tasks.set(key, {
      key,
      datasetId: item.datasetId,
      datasetLabel: item.datasetLabel,
      datasetIds: [item.datasetId],
      datasetLabels: [item.datasetLabel],
      roundCount: 1,
      currentRound: item.currentRound,
      issueType: item.card.issueType,
      issueLabel: inspectionIssueLabel(item.card.issueType),
      responseCount: 1,
      agreeCount: item.subjectResponse.decision === "agree" ? 1 : 0,
      disagreeCount: item.subjectResponse.decision === "disagree" ? 1 : 0,
      exceptionCount: item.exception ? 1 : 0,
      currentlyApplicableCount: item.currentlyApplicable ? 1 : 0,
    });
  }
  return [...tasks.values()].sort(
    (left, right) =>
      INSPECTION_ISSUE_ORDER.indexOf(left.issueType) -
      INSPECTION_ISSUE_ORDER.indexOf(right.issueType),
  );
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
