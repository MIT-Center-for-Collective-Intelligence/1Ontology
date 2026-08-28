import {
  SomIssueType,
  SomReviewCard,
  SomReviewContext,
} from "../../types/ISomReview";
import { agentTraceForRecord } from "./agentTransparency";

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

export const reviewerQuestion = (
  context: SomReviewContext,
  branch = "Sell",
): string => {
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
      return `Do "${context.canonicalTitle}" and "${context.candidateSynonymTitle}" name the same activity?`;
    case "placement-comparison":
      if ((context.affectedNodes || []).length > 1) {
        return context.placementIssue === "wrong-verb"
          ? `Do these ${context.affectedNodes?.length} activities use "${
              context.sharedAction || "their leading verb"
            }" as a different main action from the "${branch}" action?`
          : `Should these ${
              context.affectedNodes?.length
            } activities be placed under ${
              context.candidateHome
                ? `the more specific category "${context.candidateHome}"`
                : "a more specific category"
            }?`;
      }
      if (context.placementIssue === "missing-from-branch") {
        return context.candidateHome
          ? `Should "${context.nodeTitle}" move from "${context.currentParentTitle}" to "${context.candidateHome}" in the ${branch} sub-branch?`
          : `Does "${context.nodeTitle}" express the "${branch}" action and belong in this sub-branch?`;
      }
      return context.placementIssue === "wrong-verb"
        ? `Does "${context.nodeTitle}" use a different main action than the "${branch}" action?`
        : context.candidateHome
          ? `Is "${context.nodeTitle}" better placed under the more specific category "${context.candidateHome}" than under "${context.currentParentTitle}"?`
          : `Is "${context.nodeTitle}" misplaced under "${context.currentParentTitle}"?`;
    case "evidence-parent-allocation":
      return `Should this source task keep the specific parents shown and drop only ${context.removedParentTitles
        .map((title) => `"${title}"`)
        .join(" and ")}?`;
    case "evidence-specialization":
      return context.proposedTitleStatus === "new"
        ? `Should this source task create the more specific activity "${context.proposedTitle}"?`
        : `Should this source task be assigned to the more specific activity "${context.proposedTitle}"?`;
    case "empty-node-action":
      return `Should the empty node "${context.nodeTitle}" be removed from "${context.parentTitle}"?`;
    case "empty-collection-action":
      return `Should the empty collection "${context.collectionName}" be removed from "${context.parentTitle}"?`;
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
      return `Should the sense of "${context.nodeTitle}" that does not belong in the ${branch} sub-branch move to "${context.proposedParentTitle}"?`;
  }
};

const placementReviewerText = (
  context: Extract<SomReviewContext, { type: "placement-comparison" }>,
  branch: string,
) => {
  const category = cleanText(context.currentBucket);
  const affectedNodes = context.affectedNodes || [];
  if (affectedNodes.length > 1) {
    return {
      currentState: `${affectedNodes.length} activities beginning with "${
        context.sharedAction || "the same verb"
      }" currently appear within the ${branch} sub-branch.`,
      proposedState:
        context.placementIssue === "wrong-verb"
          ? `These activities appear to use "${
              context.sharedAction || "their leading verb"
            }" as a different main action from the "${branch}" action${
              context.candidateHome
                ? `; "${context.candidateHome}" is the suggested category`
                : ""
            }.`
          : `These activities appear to belong under "${
              context.candidateHome || "a more specific category"
            }".`,
      agreeLabel: context.candidateHome
        ? "Approve all moves"
        : context.placementIssue === "wrong-verb"
          ? "Yes, different action"
          : "Yes, misplaced",
      disagreeLabel: context.candidateHome
        ? "Review individually"
        : context.placementIssue === "wrong-verb"
          ? "No, review separately"
          : "No, review separately",
    };
  }
  return {
    currentState: `"${context.nodeTitle}" is currently under "${
      context.currentParentTitle
    }"${category ? ` in the "${category}" category` : ""}.`,
    proposedState:
      context.placementIssue === "missing-from-branch"
        ? `Move "${context.nodeTitle}" to "${context.candidateHome || branch}" because its evidence expresses a provider-side "${branch}" action.`
        : context.placementIssue === "wrong-verb"
          ? `"${context.nodeTitle}" does not express the "${branch}" action${
              context.candidateHome
                ? `; "${context.candidateHome}" is the suggested category`
                : ` and does not belong under "${context.currentParentTitle}"`
            }.`
          : context.candidateHome
            ? `"${context.nodeTitle}" appears to belong under the more specific category "${context.candidateHome}".`
            : `"${context.nodeTitle}" does not belong under "${context.currentParentTitle}".`,
    agreeLabel: context.candidateHome
      ? "Approve move"
      : context.placementIssue === "wrong-verb"
        ? "Yes, different action"
        : "Yes, misplaced",
    disagreeLabel: context.candidateHome
      ? "Reject proposed move"
      : context.placementIssue === "wrong-verb"
        ? "No, it belongs here"
        : "No, keep here",
  };
};

const duplicateReviewerText = (
  context: Extract<SomReviewContext, { type: "duplicate-comparison" }>,
) => ({
  currentState: `"${context.canonicalTitle}" and "${context.candidateSynonymTitle}" are currently represented as separate activity nodes.`,
  proposedState:
    'If they name the same activity, keep "' +
    context.canonicalTitle +
    '" as the node title and record "' +
    context.candidateSynonymTitle +
    '" as its synonym. The exact consolidation is reviewed separately.',
  agreeLabel: "Same activity",
  disagreeLabel: "Different activities",
});

export const toReviewerCard = (record: any): SomReviewCard => {
  const view = record.reviewerView;
  const context = sanitizeContext(view.context);
  const branch = cleanText(record.branch) || "Sell";
  const placementText =
    context.type === "placement-comparison"
      ? placementReviewerText(context, branch)
      : null;
  const duplicateText =
    context.type === "duplicate-comparison"
      ? duplicateReviewerText(context)
      : null;
  return {
    proposalId: record.proposalId,
    datasetVersion: record.datasetVersion,
    branch,
    issueType: record.issueType as SomIssueType,
    ...(record.issueType ? { agentTrace: agentTraceForRecord(record) } : {}),
    reviewerView: {
      question: reviewerQuestion(context, branch),
      currentState:
        placementText?.currentState ||
        duplicateText?.currentState ||
        cleanText(view.currentState),
      proposedState:
        placementText?.proposedState ||
        duplicateText?.proposedState ||
        cleanText(view.proposedState),
      reasoning:
        context.type === "placement-comparison"
          ? firstSentence(sanitizeReasoning(view.reasoning))
          : sanitizeReasoning(view.reasoning),
      context,
      agreeLabel: "Agree",
      disagreeLabel: "Disagree",
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
        canonicalParentTitle:
          context.canonicalParentTitle || context.parentTitle,
        candidateParentTitle:
          context.candidateParentTitle || context.parentTitle,
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
        candidateHome: cleanText(context.candidateHome),
        currentPathTitles: (context.currentPathTitles || [])
          .map(cleanText)
          .filter(Boolean),
        proposedPathTitles: (context.proposedPathTitles || [])
          .map(cleanText)
          .filter(Boolean),
        sharedAction: cleanText(context.sharedAction),
        affectedNodes: (context.affectedNodes || []).map((node: any) => ({
          nodeTitle: cleanText(node.nodeTitle),
          currentParentTitle: cleanText(node.currentParentTitle),
          currentBucket:
            node.currentBucket && node.currentBucket !== "main"
              ? cleanText(node.currentBucket)
              : "",
          sourceTasks: (node.sourceTasks || []).map(cleanText).filter(Boolean),
        })),
        placementIssue: context.placementIssue,
        sourceTasks: context.sourceTasks || [],
      };
    case "evidence-parent-allocation":
      return {
        type: "evidence-parent-allocation",
        taskTitle: cleanText(context.taskTitle),
        currentParentTitles: (context.currentParentTitles || [])
          .map(cleanText)
          .filter(Boolean),
        assignedOutputTitles: (context.assignedOutputTitles || [])
          .map(cleanText)
          .filter(Boolean),
        retainedParentTitles: (context.retainedParentTitles || [])
          .map(cleanText)
          .filter(Boolean),
        removedParentTitles: (context.removedParentTitles || [])
          .map(cleanText)
          .filter(Boolean),
      };
    case "evidence-specialization":
      return {
        type: "evidence-specialization",
        genericNodeTitle: cleanText(context.genericNodeTitle),
        sourceTask: cleanText(context.sourceTask),
        currentParentTitles: (context.currentParentTitles || [])
          .map(cleanText)
          .filter(Boolean),
        proposedTitle: cleanText(context.proposedTitle),
        proposedTitleStatus: context.proposedTitleStatus,
        targetParentTitle: cleanText(context.targetParentTitle),
        removedParentTitles: (context.removedParentTitles || [])
          .map(cleanText)
          .filter(Boolean),
        retainedParentTitles: (context.retainedParentTitles || [])
          .map(cleanText)
          .filter(Boolean),
      };
    case "empty-node-action":
      return {
        type: "empty-node-action",
        parentTitle: cleanText(context.parentTitle),
        parentCollection: cleanText(context.parentCollection) || "main",
        nodeTitle: cleanText(context.nodeTitle),
      };
    case "empty-collection-action":
      return {
        type: "empty-collection-action",
        parentTitle: cleanText(context.parentTitle),
        collectionName: cleanText(context.collectionName),
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
        canonicalParentTitle:
          context.canonicalParentTitle || context.parentTitle,
        absorbedParentTitle: context.absorbedParentTitle || context.parentTitle,
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
