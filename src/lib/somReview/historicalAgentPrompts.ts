/**
 * Source-backed disclosures for historical review components.
 *
 * Runtime ontology records are represented with bracketed placeholders. The
 * two D12 entries reproduce the archived prompt templates used for the Sell
 * title passes; other model entries are concise source-backed templates because
 * several historical proposal records did not preserve the complete runtime
 * prompt or its version.
 */

const EXPLORATORY_SHARED_RULES = `You are reviewing one branch of an activity ontology.

Inputs:
- Branch: [BRANCH]
- Branch data: [TITLES, DESCRIPTIONS, SYNONYMS, PARENTS, CHILDREN, PATHS, AND O*NET SOURCE TASKS]
- Allowed external destinations: [EXACT SNAPSHOT TITLES, WHEN APPLICABLE]

Rules:
1. Treat O*NET source tasks as evidence, never as ontology nodes.
2. Propose only the issue types owned by this specialist.
3. Change a title only when the new title clarifies the supplied evidence and preserves every supported meaning.
4. Activities are not synonyms merely because they share an object.
5. Do not infer a different main action from the leading verb alone; ordering, renting, hiring, recruiting, leasing, and subcontracting may specialize another action.
6. A move must name an exact existing destination.
7. Use exact supplied titles and prefer no candidate to a speculative or weakly supported change.
8. Return at most the governed candidate limit as structured JSON.`;

const D12_SIMPLE_PROMPT = `In a catalog of work activities, every activity has a short title of the form "<Verb> <Object>". These titles were compressed from longer task descriptions, and some lost too much meaning to be understood on their own (e.g. "Sell Specialty", "Handle Remain").

Title to check: "[CURRENT TITLE]"
All original task descriptions linked to this title:
[ALL LINKED O*NET TASK DESCRIPTIONS]

1. Standing alone, is this title clear and unambiguous to a person scanning a list - would they know what work it names?
2. If not, propose a clearer title: KEEP THE SAME LEADING VERB, and sharpen the object with a short modifier drawn from the task description (2-4 words total, Title Case). Also fix number/lemma slips (e.g. "Handle Remain" should be "Handle Remains").
Do not change a title that is already clear. Do not invent information that is not in the task descriptions.

Output ONLY a JSON object:
{"clear": true|false, "betterTitle": "<empty if clear>", "reason": "<one sentence>", "confidence": "high|medium|low"}`;

const D12_EXPERT_CALIBRATED_PROMPT = `You are reviewing one node in an ontology of work activities. A node must name ONE coherent activity sense or one coherent restriction of an activity. Its title must be understandable without reading its source tasks.

Current title: "[CURRENT TITLE]"
Source tasks:
[NUMBERED O*NET TASKS, INCLUDING OTHER EXISTING NODES ALREADY LINKED TO EACH SOURCE]

Choose exactly one decision:

KEEP
- Use when the current title accurately covers one coherent activity.
- A broad generic title is acceptable only for tasks that actually use an unmodified generic object.

RENAME
- Use when all tasks describe one coherent activity but the title is unclear, malformed, or omits a restriction shared by the evidence.
- Keep the current title's leading verb in this title stage; preserve meaning rather than adding a more specific category than the evidence supports.
- Do not add "other" when it merely came from prose such as "tickets and other items."
- Use natural ontology class wording. Do not rename solely to change a count noun from singular to plural or vice versa; number normalization is an ontology-wide policy decision.

SPLIT
- This is a correction pass for the current node, not an exhaustive noun-extraction pass. Account first for other existing nodes already representing parts of a source task; do not duplicate those covered activities.
- Coverage is sufficient only when the sibling is at the same relevant specificity.
- Use split when residual evidence still combines separable sold objects, activities, senses, or restrictions. Do not join distinct residual activities with "and" or "or" merely because one sentence mentions both.
- A modifier before a generic object normally identifies a restricted activity. A following example list may justify a concise category grounded in those examples.
- Keep an unmodified generic node only for tasks that genuinely remain generic.
- Every proposed title in this title stage must keep the current title's leading verb. Defer a task that primarily belongs to a different verb or requires a later placement decision.
- A single source task may support more than one resulting node. Assign every source task index to at least one recommended node. Do not invent evidence.

Expert-calibration examples:
- "Sell Accessory" with mixed accessory evidence -> rename to "Sell Accessories"; do not split it by accessory subtype.
- "Sell Bicycle" backed by "Sell bicycles and accessories" -> split into "Sell Bicycles" and "Sell Bicycle Accessories"; both cite that task.
- "Sell Part" backed by "Sell parts and equipment" -> split into "Sell Parts" and "Sell Equipment".
- "Sell Equipment" with clothing, supplies, parts, and services already covered by siblings -> split only residual equipment meanings into "Sell Equipment", "Sell Sporting Equipment", and "Sell Expedition Equipment".
- "Sell Food" with supplies, beverages, and tobacco already covered -> split only into "Sell Pet Food" and "Sell Food".
- "Sell Item" with tickets already covered by "Sell Ticket" -> rename to "Sell Items"; do not propose another ticket node.
- "Sell Products or Ideas" backed by the broad O*NET item "Selling or Influencing Others" -> split into "Sell Products" and "Sell Ideas" under the recorded expert policy.
- "Sell Service (1)" with other meanings already covered by siblings -> rename the residual node to "Sell Services".

Return only structured JSON with decision keep, rename, or split; betterTitle only for rename; evidence-indexed recommendedNodes only for split; deferredTaskIndexes; one concise reason; and confidence.`;

export const HISTORICAL_MODEL_PROMPTS_BY_KEY: Record<string, string> = {
  "D12@wave-28-d12-title-clarifier-2026-07-13": D12_SIMPLE_PROMPT,
  "D12@wave-31-d12-expert-calibrated-title-and-sense-2026-07-22":
    D12_EXPERT_CALIBRATED_PROMPT,
};

export const HISTORICAL_MODEL_PROMPTS_BY_ACTOR: Record<string, string> = {
  D7: `Find zero to four justified, mutually exclusive sub-clusters in [A PARENT'S COMPLETE SIBLING LIST]. Propose an intermediate activity only when every member is a kind of that activity. Propose a facet collection only when members answer one explicit facet question and no activity can subsume them. Require at least three members, do not force a grouping, and return structured JSON.`,
  D8: `Inspect [A PARENT'S COMPLETE CHILD LIST] for true semantic duplicates: nodes that denote the same activity under different surface strings. Related categories, shared objects, and broader/narrower activities are not duplicates. Empty output is valid. Return exact supplied titles, a canonical member, evidence-based rationale, and confidence as structured JSON.`,
  D9: `Inspect [A PARENT'S COMPLETE CHILD LIST] for well-known specializations that are genuinely missing. A candidate must match sibling granularity, denote a recognized activity, be absent even under another name, and be meaningfully distinct. Prefer an empty result to a speculative addition. Return at most six structured candidates with definitions, concrete examples, rationale, and confidence.`,
  "D10+J7": `First identify groups of verbs that denote the same act under different words. Merge only mutually substitutable synonyms; keep troponyms (a narrower way of acting) and unrelated verbs distinct. Then apply the verb-doctrine gate: preserve one canonical verb for one act, reject parent-child synonym edges, and do not treat a different main action as a specialization. Use [VERBS, EXAMPLES, WORDNET CONTEXT, AND CURRENT PATHS] and return only evidence-supported findings.`,
  D11: `For each supplied activity, compare its complete meaning with its current parent, sibling context, and exact candidate parents. Report a placement issue only when another supplied existing parent covers all evidence more specifically, or when the activity's main action belongs outside the branch. Use exact titles and prefer no move to an uncertain move.`,
  H1: `Classify [AN ACTIVITY AND ITS EVIDENCE] into the one top-level category whose meaning fully contains it. Use the complete activity, not a keyword; return uncertain rather than forcing a bucket.`,
  J1: `Classify [AN ACTIVITY AND ITS EVIDENCE] into the one top-level category whose meaning fully contains it. Use the complete activity, not a keyword; return uncertain rather than forcing a bucket.`,
  H2: `Test whether every proposed child is genuinely a kind of the candidate activity. Reject shared topics, attributes, audiences, or methods that do not establish an is-a activity relation. Distinguish a semantic intermediate from a display-only collection.`,
  J2: `Test whether every proposed child is genuinely a kind of the candidate activity. Reject shared topics, attributes, audiences, or methods that do not establish an is-a activity relation. Distinguish a semantic intermediate from a display-only collection.`,
  H3: `Given a set of truly equivalent activity nodes, choose the most standard, natural, general canonical title that preserves all evidence. Keep alternative wording as synonyms and do not choose a broader or narrower activity merely because its wording is familiar.`,
  J3: `Given a set of truly equivalent activity nodes, choose the most standard, natural, general canonical title that preserves all evidence. Keep alternative wording as synonyms and do not choose a broader or narrower activity merely because its wording is familiar.`,
  "J4+J5": `Apply both precision gates to a proposed missing activity. First verify it is not already represented by a title, synonym, or broader/narrower existing node. Then verify it is a meaningfully distinct sibling activity rather than a cosmetic, hyper-specific, speculative, or overlapping category. Advance only when both gates pass.`,
  H6: `Test whether the proposed parent is a true activity generalization of the child: every instance of the child must be an instance of the parent, and the relation must preserve the complete action and object meaning.`,
  H7: `Apply the verb doctrine. Synonymous verbs denote the same act and should not form parent-child levels; a troponym is a narrower way of the parent act and may specialize it; an unrelated main action belongs elsewhere. Prefer uncertainty to erasing a real action distinction.`,
  J7: `Apply the verb doctrine. Synonymous verbs denote the same act and should not form parent-child levels; a troponym is a narrower way of the parent act and may specialize it; an unrelated main action belongs elsewhere. Prefer uncertainty to erasing a real action distinction.`,
  "W16+J7": `Evaluate a proposed relocation against the complete activity meaning and verb doctrine. Confirm that the destination is an exact existing node, the activity is a genuine specialization of it, the move preserves every supported sense, and the source and target branches do not confuse synonyms with troponyms. Return no action when those conditions are not established.`,
  "title-evidence-agent": `${EXPLORATORY_SHARED_RULES}

Specialist question: Does each current title clearly and concisely express every activity meaning supported by its description and source tasks?

Inspect every ordinary node. Propose a new title only when it is evidence-supported, natural, and more precise without removing a supported object, action, or meaning. Do not decide synonym, grouping, or placement issues. Return title-clarity candidates as {nodeTitle,currentParentTitle,proposedTitle,rationale}.`,
  "identity-agent": `${EXPLORATORY_SHARED_RULES}

Specialist question: Do the recorded terms and nodes represent the same activity, or a missing synonym, false synonym, duplicate activity, or distinct meaning?

Compare meanings in every source task, not surface wording alone. Keep substitutable lexical and morphological variants. Remove a synonym only when it denotes a different activity in context. Do not decide title, grouping, or placement issues.`,
  "structure-agent": `${EXPLORATORY_SHARED_RULES}

Specialist question: Would an evidence-supported grouping make existing siblings more coherent, or should existing child links be assigned to a clearer display collection?

An intermediate is a real activity that every proposed child is a kind of. A collection is only a named display bucket over existing direct child links and must not invent a node or relation. Do not decide title, synonym, identity, or placement issues.`,
  "placement-boundary-agent": `${EXPLORATORY_SHARED_RULES}

Specialist question: Is each node under the most specific existing parent that covers all evidence, or does its main action belong under an exact existing destination outside this branch?

Judge the complete activity meaning from source tasks, description, ancestors, siblings, and proposed destination. Do not decide title, synonym, or grouping issues.`,
  "independent-critic": `${EXPLORATORY_SHARED_RULES}

For every specialist candidate, assess the diagnosis and proposed solution independently. Accept only when evidence clearly establishes the issue and the solution improves an applicable criterion without reducing another. Revise only when corrected permitted fields make a real issue's solution valid. Reject cosmetic regrouping, word similarity without activity identity, unsupported destinations, duplicates, and missing evidence. Return one structured assessment for every candidate ID.`,
  "evidence-convergence-scan": `Inspect repeated O*NET evidence across [THE COMPLETE SIBLING SET]. Propose an intermediate grouping only when multiple exact existing children share a stable activity-level meaning that their other siblings do not, every moved child is a kind of the proposed activity, and all cited source evidence remains attached. Do not create a grouping merely to shorten a list.`,
  "semantic-direction-or-evidence-specialization-judge": `Assess every supplied cross-ontology candidate. Include it only when its primary activity is selling or the seller-side act of granting temporary use for payment, the meaning is not already represented by a Sell title or synonym, and an exact supplied Sell destination is the narrowest parent that fully covers it. Exclude buyer-side acquisition and adjacent activities such as advertising, arranging, negotiating, collecting payment, delivering, analyzing, or exchanging.`,
  "whole-ontology-semantic-one-step-move": `Use embedding retrieval only to recall possible existing activities outside Sell. For every recalled activity, judge its complete title, description, synonyms, path, children, and O*NET tasks. Propose one exact move into Sell only when the activity itself is seller-side and the supplied destination is the narrowest complete match. Similar words or objects alone are insufficient.`,
  "whole-ontology-semantic-retrieval": `Retrieve a bounded, high-recall set of existing ontology activities that may themselves express seller-side selling or temporary-use-for-payment. Use semantic similarity only for candidate recall; do not treat similarity as a placement decision. Preserve each candidate's current path and evidence for downstream judgment.`,
  "content-verification-specialist": `Recheck each critic-approved content or identity proposal against every linked O*NET task, current title, description, structured synonym, and affected node. Verify that the proposed change preserves every supported activity meaning and does not manufacture a synonym, split, merge, or title restriction unsupported by the evidence.`,
  "access-gpt-5.6-sol-two-pass-audit": `Audit each snapshot-bound implementation plan in two passes. Pass 1 checks semantic fidelity to the saved expert decision and source evidence. Pass 2 checks exact node and edge references, complete preservation of unaffected structure and evidence, absence of implicit deletion, and consistency between the plan and reviewer-facing card. Reject or require clarification when either pass fails.`,
};

export const HISTORICAL_DETERMINISTIC_RULES_BY_ACTOR: Record<string, string> = {
  C6: `Validate a proposed relocation mechanically: source and destination exist, the source edge exists, no cycle is introduced, no unrelated parent is removed, multi-parent structure is preserved, and the proposal performs only the declared edge change. Block on any failed check.`,
  W16: `Construct a relocation proposal from an already established semantic decision. Bind the source node, current parent, and exact destination to the snapshot; preserve the node and all unaffected parents, children, metadata, and evidence; and do not make a new semantic judgment.`,
  "description-gap-scan": `Find non-evidence activity nodes whose description is empty or contains only a synonym statement. Propose a concise description grounded in the title and linked O*NET tasks; do not add unsupported details.`,
  "description-synonym-parser": `Parse explicit synonym statements already present in a node description. Propose only terms absent from the structured synonym field, preserving existing values and excluding terms suppressed by expert policy.`,
  "deterministic-overlap-scan": `Compare exact sibling titles, facets, and source-backed identities for reproducible overlap conditions. Emit only rule-matching candidates and bind every referenced node and edge to the snapshot.`,
  "deterministic-empty-semantic-node-scan": `Find semantic activity nodes with no direct semantic children and no directly linked O*NET evidence in the exact snapshot. Present each as a manual policy check because an empty node may still be an intentional organizing concept; never delete it automatically.`,
  "deterministic-facet-overlap-scan": `Detect when the same activity is represented both as a direct child and through a facet or miscellaneous grouping. Compare exact snapshot titles and relations; do not make semantic similarity claims.`,
  "deterministic-facet-overlap-scan-exact-action": `Translate a validated facet-overlap finding into explicit, snapshot-bound node and edge operations while preserving every unaffected child, collection, and evidence link.`,
  "identity-agent-exact-action": `Translate an accepted identity decision into exact node, synonym, and evidence-preservation operations. Do not change placement or grouping and do not infer a new identity judgment.`,
  "placement-boundary-agent-exact-action": `Translate an accepted placement decision into one exact source-edge removal and destination-edge addition, preserving every unrelated parent, child, collection, metadata field, and evidence link.`,
  "deterministic-collection-policy-scan": `Check collection labels and assignments against the ontology collection policy. Collections group existing direct child links for display; they are not activity nodes and may not create or delete semantic relations.`,
  "evidence-parent-contract-audit": `Verify that each evidence node remains linked to every independently supported activity parent and that proposed changes remove only explicitly superseded generic assignments.`,
  "rob-outline-identity-followup": `Project Rob's recorded identity decisions into follow-up items without changing their meaning or inventing unresolved details.`,
  "rob-outline-identity-exact-action": `Convert a complete recorded identity decision into exact, snapshot-bound changes; otherwise emit a clarification-only item.`,
  "rob-outline-placement-followup": `Project Rob's recorded placement decisions into follow-up items and preserve every stated alternative or qualification.`,
  "rob-outline-placement-exact-action": `Convert a complete recorded placement decision into an exact edge change; otherwise request clarification and make no mutation plan.`,
  "snapshot-bound-followup-audit": `Verify every follow-up against the exact reviewed snapshot, the source proposal, and the saved expert decision. Reject stale references, unsupported additions, evidence loss, and inferred expert intent.`,
  "snapshot-action-audit": `Check that an action proposal names exact existing nodes and edges, preserves unaffected structure and evidence, and performs only the operation authorized by its prerequisite diagnosis.`,
  "deterministic-post-semantic-regeneration": `After accepted semantic changes are projected to an isolated snapshot, rerun reproducible empty-node, empty-collection, overlap, and evidence-preservation checks. Emit only new review candidates; never mutate production.`,
  "onet-generic-object-specialization": `Scan every O*NET task attached to a generic object node. Emit a candidate only when the source text explicitly contains a stable modifier or list that supports a more specific seller-side activity. Preserve the exact evidence phrase and governing action.`,
  "flat-list-coverage-control": `Check whether a proposed grouping accounts for its exact listed children while leaving every unaffected sibling in place. Fail on missing, duplicated, or out-of-scope children.`,
  "single-child-wrapper-policy-check": `Flag a proposed or existing wrapper only when it has one semantic child and adds no independent meaning, while protecting wrappers needed for polysemy, facets, or explicit policy.`,
};

export const HISTORICAL_EXPERT_INSTRUCTIONS_BY_ACTOR: Record<string, string> = {
  "Rob-task-5": `Apply Rob's recorded decision for task 5 to the candidate exactly as documented. Preserve the reviewed title, evidence, and any stated exception; do not generalize it into a new ontology-wide policy.`,
  "Rob-task-6": `Apply Rob's recorded decision for task 6 exactly as documented and retain the source evidence and alternatives he reviewed.`,
  "Rob-task-7": `Apply Rob's recorded decision for task 7 exactly as documented; do not infer a broader sense or relocation beyond the reviewed case.`,
  "Rob-task-10": `Present the collection or grouping proposed in Rob's task 10 as an expert-authored candidate. Preserve its exact member list and treat it as pending review, not an automatic change.`,
  "Rob-task-13": `Present Rob's task 13 relocation or sense-separation direction exactly as recorded, preserving unresolved choices for explicit follow-up.`,
  "human-audit": `A human reviewer checked the candidate against the displayed snapshot and source evidence. This is recorded expert provenance, not a model prompt; the review interface preserves the decision as a separate, non-mutating judgment.`,
  "expert-correction-projection": `Project the expert's saved correction into a follow-up proposal exactly as written. Preserve the source proposal, snapshot, and event history; ask for clarification instead of completing missing structure.`,
};
