import { SomIssueType } from "../../types/ISomReview";

export const ISSUE_DESCRIPTIONS: Record<SomIssueType, string> = {
  "cross-branch-recall":
    "Review potentially missing nodes found elsewhere in the ontology and their proposed locations.",
  "evidence-specialization":
    "Create specific activity nodes when O*NET evidence modifies a generic object.",
  "title-clarity": "Judge whether an activity title is clear and precise.",
  "synonym-enrichment": "Review synonyms missing from structured metadata.",
  "description-enrichment":
    "Optionally review evidence-grounded descriptions for empty nodes.",
  "misc-facet-duplicate":
    "Find concepts repeated in miscellaneous and explicit facets.",
  "mistaken-synonym":
    "Remove terms that name a meaningfully different activity.",
  "duplicate-synonym": "Judge one possible synonym pair at a time.",
  polysemy: "Separate one title that combines distinct activity meanings.",
  "flat-list-grouping":
    "Organize a long sibling list into coherent intermediate groups.",
  "compound-object-grouping":
    "Group activities joined in the same O*NET object phrase.",
  "collection-design":
    "Review a distinct specialization dimension and its branches.",
  placement: "Judge whether an activity is under the wrong parent.",
  "wrong-verb": "Assess whether misjudged synonyms should be moved.",
  "sense-relocation":
    "Move only the separated sense that belongs outside this sub-branch.",
  "node-merge":
    "Review an exact consolidation, including the survivor and moved children.",
  relocation:
    "Review an exact move from the current parent to a named new parent.",
  "missing-activity":
    "Optionally judge whether a well-known activity is missing from the sub-branch.",
  "redundant-node":
    "Review removal of a wrapper whose children can move to its parent.",
  "empty-node":
    "Review an empty semantic node before removing it from the sub-branch.",
  "empty-collection":
    "Review a named collection with no member nodes before removing it.",
};

export const ISSUE_INTRODUCTIONS: Record<SomIssueType, string> = {
  "cross-branch-recall":
    "Semantic retrieval searched the complete ontology for activities that may be missing from this sub-branch. Compare the source evidence and both hierarchy paths, then approve the displayed move only when the candidate expresses this branch's main action in the stated sense and the proposed parent is appropriate.",
  "evidence-specialization":
    "Review a specific activity node derived from modifiers in linked O*NET evidence. Agree only when the specific title preserves the task meaning and the listed evidence should move from its generic parent to that node.",
  "title-clarity":
    "Compare the current activity title with a proposed title using its source O*NET tasks. Agree only if the proposed title is clearer and still names the same activity.",
  "synonym-enrichment":
    "Review a proposed addition to an activity's structured synonym field. Agree only if every proposed term names the same activity, rather than a related activity.",
  "description-enrichment":
    "Review a proposed description for a node that currently has no description. Agree only if it is concise, accurate, and supported by the source tasks.",
  "misc-facet-duplicate":
    "Compare a node in the miscellaneous structure with a similarly named node in an explicit facet. Decide whether they may represent the same concept; any exact consolidation will be reviewed later.",
  "mistaken-synonym":
    "Review terms currently recorded as synonyms. Agree only if the proposed removal separates a term that names a meaningfully different activity.",
  "duplicate-synonym":
    "Compare two existing activity titles. Decide only whether they name the same activity.",
  polysemy:
    "Review whether one title combines distinct activity meanings. Decide only whether the meanings should be represented separately; their locations will be reviewed later.",
  "flat-list-grouping":
    "Review a proposed intermediate group for a long list of sibling activities. The highlighted children would move under the new group; all other children would remain with the current parent.",
  "compound-object-grouping":
    "Review an intermediate group suggested by activities that share an O*NET object phrase. The highlighted children would move under the new group; all other children would remain with the current parent.",
  "collection-design":
    "Review a collection that captures a distinct specialization dimension. Agree only if the dimension and proposed branches organize the activities coherently without treating related activities as synonyms.",
  placement:
    "Review whether an activity is currently under the wrong parent within the current sub-branch. Decide only whether its present placement is wrong; a specific new parent will be reviewed separately.",
  "wrong-verb":
    "Assess whether a synonym was misjudged because the activity uses a different main action. Decide whether it belongs in the current sub-branch; a specific destination will be reviewed separately.",
  "sense-relocation":
    "Review the exact separation and relocation proposed after a polysemy diagnosis. The before-and-after view shows which sense remains in the current sub-branch and which sense moves elsewhere.",
  "node-merge":
    "Review an exact consolidation after a related overlap or synonym diagnosis. The before-and-after view shows the surviving node, synonym, and every direct child that would move.",
  relocation:
    "Review an exact move after a related placement diagnosis. The before-and-after view shows the current parent, proposed parent, and any direct children that would move with the activity.",
  "missing-activity":
    "Optionally review a proposed activity that is not currently represented in the sub-branch. Agree only if it is distinct, commonly needed, and placed under an appropriate parent.",
  "redundant-node":
    "Review a wrapper node that may add no useful distinction. The before-and-after view shows which children would move directly to its parent if the wrapper were removed.",
  "empty-node":
    "Review a semantic node with no direct children or source evidence. Agree only when it is genuinely empty and adds no needed conceptual distinction; an expert can retain intentional organizing concepts.",
  "empty-collection":
    "Review a named collection with no member nodes. Agree only when the empty grouping is obsolete; an expert can retain a deliberately reserved collection.",
};
