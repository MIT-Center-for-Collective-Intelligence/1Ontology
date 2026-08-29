import { SomIssueType } from "../../types/ISomReview";

export const ISSUE_DESCRIPTIONS: Record<SomIssueType, string> = {
  "cross-branch-recall":
    "Review potentially missing nodes found elsewhere in the ontology and their proposed locations.",
  "evidence-specialization":
    "Create specific activity nodes when O*NET evidence modifies a generic object.",
  "title-clarity": "Judge whether an activity title is clear and precise.",
  "synset-alignment":
    "Check the inherited WordNet verb sense against one homogeneous activity group and all of its source evidence.",
  "synonym-enrichment": "Review synonyms missing from structured metadata.",
  "description-enrichment":
    "Optionally review evidence-grounded descriptions for empty nodes.",
  "misc-facet-duplicate":
    "Find concepts repeated in miscellaneous and explicit facets.",
  "mistaken-synonym":
    "Remove terms that name a meaningfully different activity.",
  "duplicate-synonym":
    "Decide whether two titles name exactly the same activity.",
  polysemy: "Separate one title that combines distinct activity meanings.",
  "flat-list-grouping":
    "Organize a long sibling list into coherent intermediate groups.",
  "compound-object-grouping":
    "Group activities joined in the same O*NET object phrase.",
  "collection-design":
    "Review a distinct specialization dimension and its branches.",
  placement:
    "Review an activity's current parent and proposed destination together.",
  "wrong-verb":
    "Review whether an activity uses another main action and should move.",
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
    "Review all O*NET records currently attached to one atomic title. Agree only when the displayed groups preserve the leading action, account for every source record, reuse existing activities where appropriate, and add only evidence-supported modifiers. New nodes shown here are provisional children for title review; final placement is a later operation.",
  "synset-alignment":
    "After the title groups are reviewed, compare each group's complete O*NET evidence with the inherited WordNet sense and the locally retrieved alternatives. Agree only when the selected definition fits the leading action across every displayed source record. This decision does not change the title or placement.",
  "synonym-enrichment":
    "Review a proposed addition to an activity's structured synonym field. Agree only if every proposed term names the same activity, rather than a related activity.",
  "description-enrichment":
    "Review a proposed description for a node that currently has no description. Agree only if it is concise, accurate, and supported by the source tasks.",
  "misc-facet-duplicate":
    "Compare a node in the miscellaneous structure with a similarly named node in an explicit facet. Decide whether they may represent the same concept; any exact consolidation will be reviewed later.",
  "mistaken-synonym":
    "Review terms currently recorded as synonyms. Agree only if the proposed removal separates a term that names a meaningfully different activity.",
  "duplicate-synonym":
    "Compare two existing activity titles. Choose Same activity only when the titles are interchangeable names for the same action in this ontology. If one activity is broader, narrower, a subtype, or merely related to the other, choose Different activities.",
  polysemy:
    "Review whether one title combines distinct activity meanings. Decide only whether the meanings should be represented separately; their locations will be reviewed later.",
  "flat-list-grouping":
    "Review a proposed intermediate group for a long list of sibling activities. The highlighted children would move under the new group; all other children would remain with the current parent.",
  "compound-object-grouping":
    "Review an intermediate group suggested by activities that share an O*NET object phrase. The highlighted children would move under the new group; all other children would remain with the current parent.",
  "collection-design":
    "Review a collection that captures a distinct specialization dimension. Agree only if the dimension and proposed branches organize the activities coherently without treating related activities as synonyms.",
  placement:
    "Review the current parent and proposed destination together. When a destination is shown, approve the move only if both the current placement is incorrect and the displayed destination is better. A historical item without a destination records a diagnosis only and cannot authorize a move.",
  "wrong-verb":
    "Review whether the activity uses a different main action and compare its current location with the proposed destination. When a destination is shown, one answer approves or rejects the complete move.",
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
