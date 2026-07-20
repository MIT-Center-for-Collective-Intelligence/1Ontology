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
  ],
  "compound-object-grouping": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
  ],
  "collection-design": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
  ],
  placement: [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
  ],
  "wrong-verb": [
    "title-clarity",
    "synonym-enrichment",
    "mistaken-synonym",
    "duplicate-synonym",
    "polysemy",
    "misc-facet-duplicate",
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
    id: "labels",
    number: 1,
    title: "Clarify labels",
    description: "Resolve unclear titles before judging meaning or structure.",
    issueTypes: ["title-clarity"],
  },
  {
    id: "meaning",
    number: 2,
    title: "Resolve meaning and identity",
    description:
      "Review synonym, double-meaning, and duplicate-structure diagnoses.",
    issueTypes: [
      "synonym-enrichment",
      "mistaken-synonym",
      "duplicate-synonym",
      "polysemy",
      "misc-facet-duplicate",
    ],
  },
  {
    id: "structure",
    number: 3,
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
    number: 4,
    title: "Confirm exact changes",
    description:
      "Separate merge and move decisions appear as soon as their diagnoses are approved.",
    issueTypes: ["node-merge", "relocation", "sense-relocation"],
    contextual: true,
  },
  {
    id: "optional",
    number: 5,
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
