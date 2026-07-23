import {
  SomIssueType,
  SomReviewCard,
  SomReviewContext,
} from "../../types/ISomReview";

const cleanText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Some source reasoning ends with internal critic output such as "J6: other"
 * or "H2 not run". The reviewer must never see those control identities.
 */
export const sanitizeReasoning = (value: unknown): string => {
  const reasoning = cleanText(value);
  const internalMarker = reasoning.search(
    /(?:^|\s)[HJ]\d+\s*(?::|not\s+run\b)/i,
  );
  return (internalMarker >= 0 ? reasoning.slice(0, internalMarker) : reasoning)
    .trim()
    .replace(/\s+/g, " ");
};

const firstSentence = (value: string): string => {
  const match = value.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] || value).trim();
};

export const reviewerQuestion = (context: SomReviewContext): string => {
  switch (context.type) {
    case "title-comparison":
      return context.proposedTitle &&
        context.proposedTitle !== context.currentTitle
        ? `Is "${context.proposedTitle}" clearer than "${context.currentTitle}"?`
        : `Is "${context.currentTitle}" clear enough as the title of this activity?`;
    case "title-split":
      return `Should the evidence currently grouped under "${context.currentTitle}" be represented by the activity nodes shown below?`;
    case "grouping-outline":
      return `Should the new grouping "${context.proposedGroupTitle}" be created under "${context.parentTitle}" with the highlighted children under it?`;
    case "flat-list":
      return `Is it reasonable to leave these activities directly under "${context.parentTitle}"?`;
    case "duplicate-comparison":
      return `Should "${context.candidateSynonymTitle}" be recorded as a synonym of "${context.canonicalTitle}"?`;
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
    case "metadata-edit":
      if (
        context.field === "synonyms" &&
        context.synonymScope === "all-recorded"
      ) {
        const removed = (context.currentValues || []).filter(
          (value) => !(context.proposedValues || []).includes(value),
        );
        if (removed.length > 0) {
          return `Should ${removed
            .map((value) => `"${value}"`)
            .join(" and ")} be removed as ${
            removed.length === 1 ? "a synonym" : "synonyms"
          } of "${context.nodeTitle}"?`;
        }
      }
      return context.field === "synonyms"
        ? `Should the proposed synonym change be made for "${context.nodeTitle}"?`
        : `Is the proposed description useful for "${context.nodeTitle}"?`;
    case "polysemy-review":
      return `Does "${context.nodeTitle}" combine meanings that should be represented separately?`;
    case "collection-design":
      return `Should "${context.parentTitle}" use the proposed "${context.proposedCollectionName}" collection?`;
    case "sense-relocation-action":
      return `Should the non-selling sense of "${context.nodeTitle}" move to "${context.proposedParentTitle}"?`;
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
        ? "No, it belongs here"
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
      reasoning:
        context.type === "placement-comparison"
          ? firstSentence(sanitizeReasoning(view.reasoning))
          : sanitizeReasoning(view.reasoning),
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
    case "title-split":
      return {
        type: "title-split",
        currentTitle: context.currentTitle,
        linkedTasks: context.linkedTasks || [],
        proposedNodes: (context.proposedNodes || []).map((node: any) => ({
          title: node.title,
          status: node.status,
          sourceTaskIndexes: node.sourceTaskIndexes || [],
          sourceTasks: node.sourceTasks || [],
          reason: node.reason,
        })),
        deferredTaskIndexes: context.deferredTaskIndexes || [],
        deferredTasks: context.deferredTasks || [],
      };
    case "grouping-outline":
      return {
        type: "grouping-outline",
        parentTitle: context.parentTitle,
        structure: context.structure,
        proposedGroupTitle: context.proposedGroupTitle,
        proposedChildren: context.proposedChildren,
        unaffectedChildren: context.unaffectedChildren || [],
        sourceTasks: context.sourceTasks || [],
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
        sourceTasks: context.sourceTasks || [],
      };
    case "placement-comparison":
      return {
        type: "placement-comparison",
        nodeTitle: context.nodeTitle,
        currentParentTitle: context.currentParentTitle,
        currentBucket:
          context.currentBucket && context.currentBucket !== "main"
            ? context.currentBucket
            : "",
        placementIssue: context.placementIssue,
        sourceTasks: context.sourceTasks || [],
      };
    case "overlap-comparison":
      return {
        type: "overlap-comparison",
        parentTitle: context.parentTitle,
        firstCollection: context.firstCollection,
        firstTitle: context.firstTitle,
        secondCollection: context.secondCollection,
        secondTitle: context.secondTitle,
        sourceTasks: context.sourceTasks || [],
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
    case "metadata-edit":
      return {
        type: "metadata-edit",
        nodeTitle: context.nodeTitle,
        field: context.field,
        currentText: context.currentText || "",
        proposedText: context.proposedText || "",
        currentValues: context.currentValues || [],
        proposedValues: context.proposedValues || [],
        synonymScope: context.synonymScope || "structured-field",
        sourceTasks: context.sourceTasks || [],
      };
    case "polysemy-review":
      return {
        type: "polysemy-review",
        nodeTitle: context.nodeTitle,
        currentParentTitle: context.currentParentTitle,
        sourceTasks: context.sourceTasks || [],
        proposedSenses: (context.proposedSenses || []).map((sense: any) => ({
          title: sense.title,
          meaning: sense.meaning,
        })),
      };
    case "collection-design":
      return {
        type: "collection-design",
        parentTitle: context.parentTitle,
        currentChildren: context.currentChildren || [],
        proposedCollectionName: context.proposedCollectionName,
        proposedBranches: context.proposedBranches || [],
        sourceTasks: context.sourceTasks || [],
      };
    case "sense-relocation-action":
      return {
        type: "sense-relocation-action",
        nodeTitle: context.nodeTitle,
        currentParentTitle: context.currentParentTitle,
        currentCollection: context.currentCollection || "main",
        sourceTasks: context.sourceTasks || [],
        retainedSenseTitle: context.retainedSenseTitle,
        retainedParentTitle: context.retainedParentTitle,
        movedSenseTitle: context.movedSenseTitle,
        proposedParentTitle: context.proposedParentTitle,
      };
    default:
      throw new Error(`Unknown reviewer context type: ${context?.type}`);
  }
};
