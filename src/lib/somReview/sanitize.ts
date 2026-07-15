import {
  SomIssueType,
  SomReviewCard,
  SomReviewContext,
} from "../../types/ISomReview";

const cleanText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Some source reasoning ends with internal critic output such as "H6: other"
 * or "H2 not run". The reviewer must never see those control identities.
 */
export const sanitizeReasoning = (value: unknown): string => {
  const reasoning = cleanText(value);
  const internalMarker = reasoning.search(/(?:^|\s)H\d+\s*(?::|not\s+run\b)/i);
  return (internalMarker >= 0 ? reasoning.slice(0, internalMarker) : reasoning)
    .trim()
    .replace(/\s+/g, " ");
};

export const reviewerQuestion = (context: SomReviewContext): string => {
  switch (context.type) {
    case "title-comparison":
      return context.proposedTitle &&
        context.proposedTitle !== context.currentTitle
        ? `Is "${context.proposedTitle}" clearer than "${context.currentTitle}"?`
        : `Is "${context.currentTitle}" clear enough as the title of this activity?`;
    case "grouping-outline":
      return `Should "${context.proposedGroupTitle}" group the highlighted activities under "${context.parentTitle}"?`;
    case "flat-list":
      return `Is it reasonable to leave these activities directly under "${context.parentTitle}"?`;
    case "duplicate-comparison":
      return `Do "${context.canonicalTitle}" and "${context.candidateSynonymTitle}" name the same activity?`;
    case "placement-comparison":
      return `Is "${context.nodeTitle}" misplaced under "${context.currentParentTitle}"?`;
    case "overlap-comparison":
      return `Could "${context.firstTitle}" and "${context.secondTitle}" represent the same concept?`;
  }
};

export const toReviewerCard = (record: any): SomReviewCard => {
  const view = record.reviewerView;
  const context = sanitizeContext(view.context);
  return {
    proposalId: record.proposalId,
    datasetVersion: record.datasetVersion,
    issueType: record.issueType as SomIssueType,
    reviewerView: {
      question: reviewerQuestion(context),
      currentState: cleanText(view.currentState),
      proposedState: cleanText(view.proposedState),
      reasoning: sanitizeReasoning(view.reasoning),
      context,
      agreeLabel: cleanText(view.agreeLabel) || "Agree",
      disagreeLabel: cleanText(view.disagreeLabel) || "Disagree",
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
