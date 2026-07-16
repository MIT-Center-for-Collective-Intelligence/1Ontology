import { SomReviewDecision } from "../../types/ISomReview";
import { proposalAvailability, SomDataset } from "./dataset";

export interface WorkflowResponseRecord {
  proposalId: string;
  reviewerId: string;
  response: {
    decision: SomReviewDecision;
  };
}

const decisionsByReviewer = <T extends WorkflowResponseRecord>(
  responses: T[],
): Map<string, Map<string, SomReviewDecision>> => {
  const result = new Map<string, Map<string, SomReviewDecision>>();
  for (const response of responses) {
    const decisions = result.get(response.reviewerId) || new Map();
    decisions.set(response.proposalId, response.response.decision);
    result.set(response.reviewerId, decisions);
  }
  return result;
};

/**
 * Removes stale downstream answers whose prerequisite is no longer agreed to.
 * The dataset currently has one dependency level and validates that graph on load.
 */
export const applicableReviewResponses = <T extends WorkflowResponseRecord>(
  dataset: SomDataset,
  responses: T[],
): T[] => {
  const reviewerDecisions = decisionsByReviewer(responses);
  return responses.filter((response) => {
    const record = dataset.recordsById.get(response.proposalId);
    if (!record) return false;
    return (
      proposalAvailability(
        record,
        reviewerDecisions.get(response.reviewerId) || new Map(),
      ) === "ready"
    );
  });
};

export const remainingIndependentReviewCount = <
  T extends WorkflowResponseRecord,
>(
  dataset: SomDataset,
  reviewerId: string,
  responses: T[],
): number => {
  const reviewerResponses = responses.filter(
    (response) => response.reviewerId === reviewerId,
  );
  const decisions = new Map(
    reviewerResponses.map((response) => [
      response.proposalId,
      response.response.decision,
    ]),
  );
  const applicableResponseIds = new Set(
    applicableReviewResponses(dataset, reviewerResponses).map(
      (response) => response.proposalId,
    ),
  );

  return [...dataset.recordsById.values()].filter((record) => {
    if (applicableResponseIds.has(record.proposalId)) return false;
    return proposalAvailability(record, decisions) !== "not-applicable";
  }).length;
};
