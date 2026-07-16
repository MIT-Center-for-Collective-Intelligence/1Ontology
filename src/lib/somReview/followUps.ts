import { SomIssueType, SomLinkedFollowUp } from "../../types/ISomReview";
import {
  isIssueTypeEnabled,
  proposalAvailability,
  SomDataset,
} from "./dataset";
import { toReviewerCard } from "./sanitize";

type ReviewerDecisions = Map<string, "agree" | "disagree">;

const orderedProposalIds = (dataset: SomDataset): string[] =>
  (dataset.manifest.issueTypes || []).flatMap(
    (issue: any) =>
      dataset.orderedIdsByIssue.get(issue.id as SomIssueType) || [],
  );

/**
 * Finds unanswered dependent proposals whose prerequisites are all approved.
 * A source ID narrows the result to actions directly unlocked by that answer.
 */
export const readyDependentRecords = (
  dataset: SomDataset,
  decisions: ReviewerDecisions,
  sourceProposalId?: string,
): any[] =>
  orderedProposalIds(dataset).flatMap((proposalId) => {
    if (decisions.has(proposalId)) return [];
    const record = dataset.recordsById.get(proposalId);
    const dependencies: string[] = record?.workflow?.dependsOnProposalIds || [];
    if (dependencies.length === 0) return [];
    if (sourceProposalId && !dependencies.includes(sourceProposalId)) return [];
    if (!isIssueTypeEnabled(record.issueType)) return [];
    return proposalAvailability(record, decisions) === "ready" ? [record] : [];
  });

export const toLinkedFollowUps = (
  dataset: SomDataset,
  records: any[],
): SomLinkedFollowUp[] =>
  records.map((record) => ({
    proposalId: record.proposalId,
    issueType: record.issueType,
    issueLabel:
      dataset.issueLabels.get(record.issueType) || "Related follow-up",
    question: toReviewerCard(record).reviewerView.question,
    sources: (record.workflow.dependsOnProposalIds || []).flatMap(
      (sourceProposalId: string) => {
        const source = dataset.recordsById.get(sourceProposalId);
        if (!source) return [];
        return [
          {
            proposalId: source.proposalId,
            issueType: source.issueType,
            issueLabel:
              dataset.issueLabels.get(source.issueType) || "Earlier review",
            question: toReviewerCard(source).reviewerView.question,
          },
        ];
      },
    ),
  }));
