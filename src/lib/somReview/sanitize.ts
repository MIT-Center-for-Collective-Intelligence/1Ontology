import {
  SomIssueType,
  SomReviewCard,
  SomReviewContext,
} from "../../types/ISomReview";


const CONTROL_QUESTION_PATTERN = /^The agent judged .* proposed no change\./;

const dropQuestion = (view: any): boolean =>
  CONTROL_QUESTION_PATTERN.test(view.question) ||
  view.context?.type === "grouping-outline";

export const toReviewerCard = (record: any): SomReviewCard => {
  const view = record.reviewerView;
  return {
    proposalId: record.proposalId,
    datasetVersion: record.datasetVersion,
    issueType: record.issueType as SomIssueType,
    reviewerView: {
      question: dropQuestion(view) ? "" : view.question,
      currentState: view.currentState,
      proposedState: view.proposedState,
      reasoning: view.reasoning,
      context: sanitizeContext(view.context),
      agreeLabel: view.agreeLabel || "Agree",
      disagreeLabel: view.disagreeLabel || "Disagree",
    },
  };
};

const sanitizeContext = (context: any): SomReviewContext => {
  switch (context.type) {
    case "title-comparison":
      return {
        type: "title-comparison",
        currentTitle: context.currentTitle,
        proposedTitle: context.proposedTitle,
        linkedTasks: context.linkedTasks || [],
      };
    case "grouping-outline":
      return {
        type: "grouping-outline",
        parentTitle: context.parentTitle,
        structure: context.structure,
        proposedGroupTitle: context.proposedGroupTitle,
        proposedChildren: context.proposedChildren,
        unaffectedChildren: context.unaffectedChildren || [],
      };
    case "flat-list":
      return {
        type: "flat-list",
        parentTitle: context.parentTitle,
        currentChildren: context.currentChildren,
      };
    case "duplicate-comparison":
      return {
        type: "duplicate-comparison",
        parentTitle: context.parentTitle,
        canonicalTitle: context.canonicalTitle,
        candidateSynonymTitle: context.candidateSynonymTitle,
      };
    case "placement-comparison":
      return {
        type: "placement-comparison",
        nodeTitle: context.nodeTitle,
        currentParentTitle: context.currentParentTitle,
        currentBucket: context.currentBucket || "",
        candidateHome: context.candidateHome || "",
        placementIssue: context.placementIssue,
      };
    case "overlap-comparison":
      return {
        type: "overlap-comparison",
        parentTitle: context.parentTitle,
        firstCollection: context.firstCollection,
        firstTitle: context.firstTitle,
        secondCollection: context.secondCollection,
        secondTitle: context.secondTitle,
      };
    default:
      throw new Error(`Unknown reviewer context type: ${context?.type}`);
  }
};
