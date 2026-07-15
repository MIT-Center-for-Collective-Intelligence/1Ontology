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
      return `Should the new grouping "${context.proposedGroupTitle}" be created under "${context.parentTitle}" with the highlighted children under it?`;
    case "flat-list":
      return `Is it reasonable to leave these activities directly under "${context.parentTitle}"?`;
    case "duplicate-comparison":
      return `Do "${context.canonicalTitle}" and "${context.candidateSynonymTitle}" name the same activity?`;
    case "placement-comparison":
      return context.placementIssue === "wrong-verb"
        ? `Does "${context.nodeTitle}" use a different main action than "Sell"?`
        : `Is "${context.nodeTitle}" misplaced under "${context.currentParentTitle}"?`;
    case "overlap-comparison":
      return `Could "${context.firstTitle}" and "${context.secondTitle}" represent the same concept?`;
    case "merge-action":
      return `Should "${context.absorbedTitle}" be merged into "${context.canonicalTitle}"?`;
    case "relocation-action":
      return `Should "${context.nodeTitle}" move from "${context.currentParentTitle}" to "${context.proposedParentTitle}"?`;
    case "addition-action":
      return `Should the missing activity "${context.proposedTitle}" be added under "${context.parentTitle}"?`;
    case "merge-up-action":
      return `Should the redundant wrapper "${context.nodeTitle}" be removed and its children moved directly under "${context.parentTitle}"?`;
  }
};

const placementReviewerText = (
  context: Extract<SomReviewContext, { type: "placement-comparison" }>,
) => {
  const category = cleanText(context.currentBucket);
  return {
    currentState: `"${context.nodeTitle}" is currently under "${
      context.currentParentTitle
    }"${category ? ` in the "${category}" category` : ""}.`,
    proposedState:
      context.placementIssue === "wrong-verb"
        ? `"${context.nodeTitle}" is not a kind of selling and does not belong under "${context.currentParentTitle}".`
        : `"${context.nodeTitle}" does not belong under "${context.currentParentTitle}".`,
    agreeLabel:
      context.placementIssue === "wrong-verb"
        ? "Yes, different action"
        : "Yes, misplaced",
    disagreeLabel:
      context.placementIssue === "wrong-verb"
        ? "No, it belongs under Sell"
        : "No, keep here",
  };
};

const duplicateReviewerText = (
  context: Extract<SomReviewContext, { type: "duplicate-comparison" }>,
) => ({
  proposedState:
    'Record "' +
    context.candidateSynonymTitle +
    '" as a synonym of "' +
    context.canonicalTitle +
    '".',
});

export const toReviewerCard = (record: any): SomReviewCard => {
  const view = record.reviewerView;
  const context = sanitizeContext(view.context);
  const placementText =
    context.type === "placement-comparison"
      ? placementReviewerText(context)
      : null;
  const duplicateText =
    context.type === "duplicate-comparison"
      ? duplicateReviewerText(context)
      : null;
  return {
    proposalId: record.proposalId,
    datasetVersion: record.datasetVersion,
    issueType: record.issueType as SomIssueType,
    reviewerView: {
      question: reviewerQuestion(context),
      currentState: placementText?.currentState || cleanText(view.currentState),
      proposedState:
        placementText?.proposedState ||
        duplicateText?.proposedState ||
        cleanText(view.proposedState),
      reasoning: sanitizeReasoning(view.reasoning),
      context,
      agreeLabel:
        placementText?.agreeLabel || cleanText(view.agreeLabel) || "Agree",
      disagreeLabel:
        placementText?.disagreeLabel ||
        cleanText(view.disagreeLabel) ||
        "Disagree",
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
    case "merge-action":
      return {
        type: "merge-action",
        parentTitle: context.parentTitle,
        canonicalTitle: context.canonicalTitle,
        canonicalCollection: context.canonicalCollection || "main",
        canonicalChildren: context.canonicalChildren || [],
        absorbedTitle: context.absorbedTitle,
        absorbedCollection: context.absorbedCollection || "main",
        absorbedChildren: context.absorbedChildren || [],
        resultingChildren: context.resultingChildren || [],
        absorbedBecomesSynonym: Boolean(context.absorbedBecomesSynonym),
      };
    case "relocation-action":
      return {
        type: "relocation-action",
        nodeTitle: context.nodeTitle,
        currentParentTitle: context.currentParentTitle,
        currentCollection: context.currentCollection || "main",
        proposedParentTitle: context.proposedParentTitle,
        proposedCollection: context.proposedCollection || "main",
        childTitles: context.childTitles || [],
      };
    case "addition-action":
      return {
        type: "addition-action",
        parentTitle: context.parentTitle,
        proposedTitle: context.proposedTitle,
        description: context.description,
        examples: context.examples || [],
      };
    case "merge-up-action":
      return {
        type: "merge-up-action",
        parentTitle: context.parentTitle,
        parentCollection: context.parentCollection || "main",
        nodeTitle: context.nodeTitle,
        childTitles: context.childTitles || [],
      };
    default:
      throw new Error(`Unknown reviewer context type: ${context?.type}`);
  }
};
