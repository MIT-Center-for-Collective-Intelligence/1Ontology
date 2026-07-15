import {
  SomDeliberationAggregate,
  SomDeliberationRecommendation,
  SomReviewDecision,
  SomReviewerRole,
} from "../../types/ISomReview";
import { reviewerRoleLabel, reviewerRoleWeights } from "./access";

export interface DeliberationVote {
  reviewerId: string;
  role: SomReviewerRole;
  weight: number;
  decision: SomReviewDecision;
}

const weightedSupport = (votes: DeliberationVote[]): number | null => {
  const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
  if (totalWeight === 0) return null;
  const agreeWeight = votes.reduce(
    (sum, vote) => sum + (vote.decision === "agree" ? vote.weight : 0),
    0,
  );
  return agreeWeight / totalWeight;
};

const recommendationFor = ({
  coreResponses,
  allSupport,
  coreSupport,
  stewardSplit,
  stewardAgree,
  stewardDisagree,
}: {
  coreResponses: number;
  allSupport: number | null;
  coreSupport: number | null;
  stewardSplit: boolean;
  stewardAgree: boolean;
  stewardDisagree: boolean;
}): SomDeliberationRecommendation => {
  if (coreResponses < 2 || allSupport === null || coreSupport === null) {
    return "awaiting-core-review";
  }
  if (stewardSplit) return "needs-deliberation";

  // Contributors are useful evidence, but cannot override the core team by
  // volume. A ready recommendation requires both aggregates to align.
  if (coreSupport >= 2 / 3 && allSupport >= 0.55 && !stewardDisagree) {
    return "ready-to-accept";
  }
  if (coreSupport <= 1 / 3 && allSupport <= 0.45 && !stewardAgree) {
    return "ready-to-reject";
  }
  return "needs-deliberation";
};

export const aggregateDeliberationVotes = (
  votes: DeliberationVote[],
): SomDeliberationAggregate => {
  const coreVotes = votes.filter((vote) => vote.role !== "contributor");
  const stewardVotes = votes.filter((vote) => vote.role === "steward");
  const allWeightedSupport = weightedSupport(votes);
  const coreWeightedSupport = weightedSupport(coreVotes);
  const stewardAgree = stewardVotes.some((vote) => vote.decision === "agree");
  const stewardDisagree = stewardVotes.some(
    (vote) => vote.decision === "disagree",
  );
  const stewardSplit = stewardAgree && stewardDisagree;
  const emergingDirection =
    coreWeightedSupport !== null &&
    allWeightedSupport !== null &&
    coreWeightedSupport >= 2 / 3 &&
    allWeightedSupport >= 0.55
      ? "agree"
      : coreWeightedSupport !== null &&
          allWeightedSupport !== null &&
          coreWeightedSupport <= 1 / 3 &&
          allWeightedSupport <= 0.45
        ? "disagree"
        : null;
  const stewardDissent =
    emergingDirection !== null &&
    stewardVotes.some((vote) => vote.decision !== emergingDirection);
  const recommendation = recommendationFor({
    coreResponses: coreVotes.length,
    allSupport: allWeightedSupport,
    coreSupport: coreWeightedSupport,
    stewardSplit,
    stewardAgree,
    stewardDisagree,
  });

  const roles: SomReviewerRole[] = ["steward", "researcher", "contributor"];
  const weights = reviewerRoleWeights();
  const roleSummaries = roles.map((role) => {
    const roleVotes = votes.filter((vote) => vote.role === role);
    return {
      role,
      label: reviewerRoleLabel(role),
      weight: weights[role],
      responses: roleVotes.length,
      agree: roleVotes.filter((vote) => vote.decision === "agree").length,
      disagree: roleVotes.filter((vote) => vote.decision === "disagree").length,
    };
  });

  return {
    recommendation,
    quorumMet: coreVotes.length >= 2,
    totalResponses: votes.length,
    coreResponses: coreVotes.length,
    allWeightedSupport,
    coreWeightedSupport,
    stewardSplit,
    stewardDissent,
    roleSummaries,
  };
};
