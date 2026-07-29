export const AUDIT_POLICY_VERSION = "ontology-audit-policy-v3";

export const AUDIT_POLICY_RULES = Object.freeze([
  {
    id: "semantic-value-over-carrier",
    text: `Classify what is sold by the value, right, or continuing obligation
being transferred, not by the noun's physical or informational carrier. A
policy, certificate, account, membership, or contract can document access to a
service without making the sold activity "information." Treat fixed content as
information only when the content itself is the delivered value and no
continuing performance or entitlement is central.`,
  },
  {
    id: "existing-parent-before-new-group",
    text: `Before proposing a new intermediate group, test each apparent outlier
against every existing semantically coherent parent in the supplied branch.
Prefer a justified move to an existing parent over creating a parallel group.`,
  },
  {
    id: "evidence-supported-small-group",
    text: `A useful intermediate group may have two or more members. Propose it
when the members share a stable domain category, the category improves
retrieval or comparison, and source evidence supports the boundary. Do not
require three members merely to consider the group.`,
  },
  {
    id: "no-aesthetic-grouping",
    text: `Do not group merely to make sibling counts or visual spacing look
tidier. Reject a group whose label is vague, whose members overlap other
groups, or whose boundary cannot be explained from meaning, evidence, or an
established domain classification.`,
  },
  {
    id: "exact-activity-identity",
    text: `Treat singular/plural variants and lexical alternatives as identity
candidates only when they denote the same activity in every supplied evidence
context. A document, object, prerequisite, broader category, subtype, or
adjacent action is not a synonym merely because its wording is similar.`,
  },
  {
    id: "collection-policy-is-reviewable",
    text: `When a generic "miscellaneous" or "other" collection duplicates an
explicit specialization dimension such as what, how, where, when, or why,
return an explicit collection-design policy proposal. Account for every current
child and state which generic collection or placeholder would be retired. Never
silently delete or fold it during detection.`,
  },
  {
    id: "explicit-evidence-parent-allocation",
    text: `When source evidence motivates a renamed or task-specific output,
keep an explicit allocation for that evidence. Preserve multiple inheritance
only for independently justified meanings; do not leave the evidence attached
to a superseded broad parent merely because the old edge already exists.`,
  },
  {
    id: "contextual-placement",
    text: `Judge placement using the node's source tasks, siblings, ancestors,
and candidate destination together. A generic current parent can be valid, but
a more specific existing parent is preferable when it covers the full meaning
without narrowing away evidence.`,
  },
]);

export const AUDIT_POLICY_RULE_IDS = Object.freeze(
  AUDIT_POLICY_RULES.map((rule) => rule.id),
);

export const IDENTITY_AGENT_GUIDANCE = `Inspect exact activity identity before
surface wording. Return both likely missed identities and likely false
synonyms, but preserve alternative lexicalizations that remain substitutable
across every source task.`;

export const STRUCTURE_AGENT_GUIDANCE = `Inspect every long flat sibling list,
not only the most obvious one. First test moves to existing coherent parents;
then propose evidence-supported intermediate groups with two or more members.
Return no proposal when the only benefit is visual tidiness.`;

export const PLACEMENT_AGENT_GUIDANCE = `Classify the semantic value being sold
and the activity's full evidence, not the grammatical form of its direct
object. In particular, distinguish fixed information from rights, access, and
continuing service obligations. Prefer exact existing destinations.`;

export const CRITIC_GROUPING_GUIDANCE = `Reducing a long flat sibling list is an
operational benefit when the proposed group is semantically coherent, uses a
stable category, has at least two members, and does not overlap another group.
Two-member groups require the same evidence and utility as larger groups; they
must not be rejected solely for having fewer than three members. Reject
aesthetic, vague, overlapping, or unsupported groupings.`;

export const renderAuditPolicy = (branch) => {
  const numbered = AUDIT_POLICY_RULES.map(
    (rule, index) => `${index + 1}. [${rule.id}] ${rule.text}`,
  ).join("\n");
  return `The following branch-independent policy applies to "${branch}":\n${numbered}`;
};

const normalized = (value) => String(value || "").trim();

export const detectRedundantCollectionPolicy = ({ branch, children }) => {
  const root = normalized(branch);
  const semanticChildren = (children || [])
    .map((child) => ({
      title: normalized(child.title),
      collectionName: normalized(child.collectionName) || "main",
    }))
    .filter((child) => child.title);
  const miscellaneous = semanticChildren.filter((child) => {
    const collection = child.collectionName.toLowerCase();
    const title = child.title.toLowerCase();
    const rootPrefix = root.toLowerCase();
    return (
      /\b(?:miscellaneous|other)\b/.test(collection) ||
      title === `${rootPrefix} (other)` ||
      title === `${rootPrefix} other` ||
      title === `${rootPrefix} -- miscellaneous`
    );
  });
  const what = semanticChildren.filter((child) =>
    /\bwhat\b/.test(child.collectionName.toLowerCase()),
  );
  if (!miscellaneous.length || what.length < 2) return null;
  return {
    proposedCollectionName: what
      .map((child) => child.collectionName)
      .sort((left, right) => left.localeCompare(right, "en"))[0],
    proposedBranchTitles: [...new Set(what.map((child) => child.title))].sort(
      (left, right) => left.localeCompare(right, "en"),
    ),
    retiredCollectionNames: [
      ...new Set(miscellaneous.map((child) => child.collectionName)),
    ].sort((left, right) => left.localeCompare(right, "en")),
    retiredPlaceholderTitles: [
      ...new Set(miscellaneous.map((child) => child.title)),
    ].sort((left, right) => left.localeCompare(right, "en")),
  };
};
