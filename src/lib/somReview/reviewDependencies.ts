import {
  SomIssuePrerequisite,
  SomIssueType,
  SomIssueTypeOption,
} from "../../types/ISomReview";

/**
 * Queue-level prerequisites capture decisions that must be made before a
 * reviewer can interpret a later class of proposal. Exact diagnosis-to-action
 * dependencies remain attached to individual proposals in the dataset.
 */
const ISSUE_PREREQUISITES: Partial<Record<SomIssueType, SomIssueType[]>> = {
  "evidence-specialization": ["cross-branch-recall"],
  "title-clarity": ["cross-branch-recall", "evidence-specialization"],
  "synonym-enrichment": ["title-clarity"],
  "mistaken-synonym": ["title-clarity"],
  "duplicate-synonym": ["title-clarity"],
  polysemy: ["title-clarity"],
  "misc-facet-duplicate": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
  ],
  "flat-list-grouping": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
  ],
  "compound-object-grouping": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
  ],
  "collection-design": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
  ],
  placement: [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
  ],
  "wrong-verb": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
  ],
  "description-enrichment": ["title-clarity"],
  "missing-activity": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
  ],
  "redundant-node": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
  ],
  "empty-node": [
    "cross-branch-recall",
    "evidence-specialization",
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
    "flat-list-grouping",
    "compound-object-grouping",
    "collection-design",
    "placement",
    "wrong-verb",
    "relocation",
    "sense-relocation",
  ],
  "empty-collection": [
    "cross-branch-recall",
    "evidence-specialization",
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
    "node-merge",
    "flat-list-grouping",
    "compound-object-grouping",
    "collection-design",
    "placement",
    "wrong-verb",
    "relocation",
    "sense-relocation",
  ],
};

export const issuePrerequisiteTypes = (
  issueType: SomIssueType,
): SomIssueType[] => [...(ISSUE_PREREQUISITES[issueType] || [])];

export const issueReviewIsComplete = (
  issue: Pick<SomIssueTypeOption, "enabled" | "total" | "pending" | "waiting">,
): boolean =>
  !issue.enabled ||
  issue.total === 0 ||
  (issue.pending === 0 && issue.waiting === 0);

export const blockingIssuePrerequisites = (
  issueType: SomIssueType,
  issues: Map<SomIssueType, SomIssueTypeOption>,
): SomIssuePrerequisite[] =>
  issuePrerequisiteTypes(issueType).flatMap((prerequisiteId) => {
    const prerequisite = issues.get(prerequisiteId);
    if (!prerequisite || issueReviewIsComplete(prerequisite)) return [];
    return [
      {
        id: prerequisite.id,
        label: prerequisite.label,
        remaining: prerequisite.pending + prerequisite.waiting,
      },
    ];
  });

export interface SomReviewPathStep {
  id: string;
  number: number;
  title: string;
  description: string;
  issueTypes: SomIssueType[];
  contextual?: boolean;
  optional?: boolean;
}

export const SOM_REVIEW_PATH: SomReviewPathStep[] = [
  {
    id: "coverage",
    number: 1,
    title: "Potentially missing nodes for this sub-branch",
    description:
      "Review activities found elsewhere and specific nodes supported by source evidence.",
    issueTypes: ["cross-branch-recall", "evidence-specialization"],
  },
  {
    id: "labels",
    number: 2,
    title: "Clarify labels",
    description: "Resolve unclear titles before judging meaning or structure.",
    issueTypes: ["title-clarity"],
  },
  {
    id: "meaning",
    number: 3,
    title: "Resolve meaning and identity",
    description:
      "Review meaning diagnoses and confirm their exact node merges before structure.",
    issueTypes: [
      "synonym-enrichment",
      "mistaken-synonym",
      "duplicate-synonym",
      "polysemy",
      "misc-facet-duplicate",
      "node-merge",
    ],
  },
  {
    id: "structure",
    number: 4,
    title: "Review structure and placement",
    description:
      "Judge proposed groups, collections, and movements after meanings are clear.",
    issueTypes: [
      "flat-list-grouping",
      "compound-object-grouping",
      "collection-design",
      "placement",
      "wrong-verb",
    ],
  },
  {
    id: "actions",
    number: 5,
    title: "Confirm exact changes",
    description:
      "Exact move decisions appear as soon as their structural diagnoses are approved.",
    issueTypes: ["relocation", "sense-relocation"],
    contextual: true,
  },
  {
    id: "cleanup",
    number: 6,
    title: "Review empty-structure cleanup",
    description:
      "After upstream changes settle, decide whether each remaining empty node or named collection should be retained.",
    issueTypes: ["empty-node", "empty-collection"],
  },
  {
    id: "optional",
    number: 7,
    title: "Optional quality checks",
    description:
      "Descriptions, missing activities, and redundant nodes do not block restructuring.",
    issueTypes: [
      "description-enrichment",
      "missing-activity",
      "redundant-node",
    ],
    optional: true,
  },
];

export const reviewPathForIssueTypes = (
  issueTypes: SomIssueType[],
): SomReviewPathStep[] => {
  const present = new Set(issueTypes);
  return SOM_REVIEW_PATH.filter((step) =>
    step.issueTypes.some((issueType) => present.has(issueType)),
  ).map((step, index) => ({ ...step, number: index + 1 }));
};
