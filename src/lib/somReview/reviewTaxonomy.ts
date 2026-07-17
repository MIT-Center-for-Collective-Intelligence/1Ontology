import { SomIssueType, SomReviewStage } from "../../types/ISomReview";

export interface SomReviewStageDefinition {
  id: SomReviewStage;
  title: string;
  description: string;
}

export const SOM_REVIEW_STAGES: SomReviewStageDefinition[] = [
  {
    id: "content",
    title: "Content of nodes",
    description: "Review titles, synonyms, descriptions, and meanings first.",
  },
  {
    id: "within-branch",
    title: "Structure within Sub-branch",
    description:
      "Review duplicate structure, groups, collections, and placement within the current sub-branch.",
  },
  {
    id: "outside-branch",
    title: "Movement beyond Sub-branch",
    description:
      "Review activities or senses that may use another main action or belong beyond the current sub-branch.",
  },
  {
    id: "final-action",
    title: "Follow-up change proposals",
    description:
      "After you agree with a diagnosis, review the specific merge or move as a separate decision here.",
  },
  {
    id: "additional-quality",
    title: "Additional optional quality checks",
    description:
      "These checks can improve the ontology, but they are optional during the initial restructuring review.",
  },
];

export type ReviewIssueDefinition = {
  id: SomIssueType;
  label: string;
  stage: SomReviewStage;
};

/**
 * Keeps numbering coupled to the order reviewers actually see. Reordering a
 * stage or moving an issue to another stage therefore cannot leave stale
 * numbers embedded in labels.
 */
export const numberReviewIssues = <T extends ReviewIssueDefinition>(
  issues: T[],
): T[] => {
  const ordered = SOM_REVIEW_STAGES.flatMap((stage) =>
    issues.filter((issue) => issue.stage === stage.id),
  );
  const knownIds = new Set(ordered.map((issue) => issue.id));
  const ungrouped = issues.filter((issue) => !knownIds.has(issue.id));

  return [...ordered, ...ungrouped].map((issue, index) => ({
    ...issue,
    label: `${index + 1}. ${issue.label.replace(/^\d+\.\s*/, "")}`,
  }));
};

export const numberedIssueLabelMap = <T extends ReviewIssueDefinition>(
  issues: T[],
): Map<SomIssueType, string> =>
  new Map(numberReviewIssues(issues).map((issue) => [issue.id, issue.label]));
