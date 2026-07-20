# Dependency-Aware Review Workflow

Status: implementation specification for the `sell-final-hierarchy-onet-2026-07-15-v4` review dataset

Source meeting: MIT CCI ontology group, July 20, 2026

Implementation branch: `codex/dependency-aware-review-study`

## 1. Why dependencies matter

The review app does not contain 17 independent lists. Several proposal types ask
reviewers to make decisions whose interpretation depends on earlier decisions.
The July 20 meeting identified the clearest example: an unclear activity title
must be resolved before a reviewer can reliably judge that activity's synonyms,
placement, or structural role.

The Sell dataset confirms three distinct dependency classes:

1. **Semantic prerequisites.** A later queue assumes that labels and meanings
   have already been interpreted. These are queue-level dependencies.
2. **Diagnosis-to-action dependencies.** A precise merge or relocation should
   only be reviewed after its corresponding diagnosis is accepted. These are
   proposal-level dependencies.
3. **Snapshot dependencies.** Accepted changes in one phase may change the
   inputs to later detectors. These are dataset-level dependencies and require
   adjudication, application, and proposal regeneration between study waves.

Treating all three as a generic “waiting” state hides what the reviewer must do,
encourages invalid review order, and makes it difficult to reason about whether
the resulting judgments are comparable.

## 2. Evidence from the Sell dataset

The same ontology nodes recur across proposal types. Examples include:

| Node                   | Proposal types in the frozen dataset                       |
| ---------------------- | ---------------------------------------------------------- |
| Sell Service (1)       | title clarity, description, mistaken synonym, placement    |
| Sell Good              | title clarity, description, undetected synonym, node merge |
| Sell Contract          | title clarity, description, placement, relocation          |
| Sell Package           | title clarity, description, placement, relocation          |
| Market Space           | title clarity, description, wrong verb, relocation         |
| Sell Products or Ideas | description, double meaning, sense relocation              |

Every final-action proposal in the current dataset has a specific source:

- 6 node merges depend on 2 repeated-facet diagnoses or 4 undetected-synonym
  diagnoses.
- 11 relocations depend on 6 within-sub-branch placement diagnoses or 5
  wrong-verb diagnoses.
- 1 sense relocation depends on the double-meaning diagnosis.

These links are encoded in `workflow.dependsOnProposalIds` and should not be
replaced by queue-level rules.

## 3. Dependency policy

### Phase 1: clarify labels

Required queue:

- `title-clarity`

Rationale: title clarity is a semantic precondition for judgments about identity,
meaning, and structure. Reviewers should not have to infer what an opaque label
means while simultaneously evaluating a different proposed change.

### Phase 2: resolve meaning and identity

Queues:

- `synonym-enrichment`
- `mistaken-synonym`
- `duplicate-synonym`
- `polysemy`
- `misc-facet-duplicate`

Rules:

- All meaning queues require Phase 1.
- `misc-facet-duplicate` additionally requires synonym-enrichment,
  mistaken-synonym, duplicate-synonym, and polysemy because it asks a structural
  overlap question after node identity has been considered.
- The first four meaning queues are otherwise parallel. The current evidence does not
  justify an arbitrary order among them.

### Phase 3: review structure and placement

Queues:

- `flat-list-grouping`
- `compound-object-grouping`
- `collection-design`
- `placement`
- `wrong-verb`

Prerequisites:

- Phase 1
- missing synonyms
- mistaken synonyms
- undetected synonyms
- double meanings
- repeated miscellaneous/facet nodes

Rationale: grouping and placement assume that reviewers know what each node
denotes and which nodes should remain distinct.

### Phase 4: confirm exact changes

Queues:

- `node-merge`
- `relocation`
- `sense-relocation`

Rule: no global queue gate. Each action is unlocked only by agreement with its
exact source diagnosis. The reviewer is offered that follow-up immediately while
the source node and evidence remain fresh.

This exception is intentional. Requiring completion of an entire diagnosis queue
before an exact follow-up would increase memory burden without improving validity.

### Phase 5: optional quality checks

Queues:

- `description-enrichment`
- `missing-activity`
- `redundant-node`

Rules:

- Descriptions require clarified titles.
- Missing and redundant activity reviews require clarified identity and meaning.
- These queues do not block restructuring and are marked optional.

## 4. Reviewer-facing behavior

The interface implements the following behavior:

1. A **Guided review path** shows five phases, their status, and the next valid
   queue.
2. A blocked queue names the unfinished earlier queue or queues. It never uses an
   unexplained “waiting” badge for a phase dependency.
3. A reviewer cannot start unanswered items in a blocked queue through the UI or
   by calling the session API directly.
4. Previously saved judgments remain accessible, including judgments made before
   phase gating was introduced.
5. Exact diagnosis-to-action follow-ups bypass queue gates and remain available
   immediately after agreement with their source diagnosis.
6. “Related review required” is reserved for proposal-level action dependencies;
   “Earlier phase required” is reserved for queue-level semantic prerequisites.
7. The app continues to state that review responses are recorded separately from
   ontology changes.

## 5. Server enforcement

Client-only disabling is insufficient because a stale client or direct request
could create an invalid review session. The session API therefore:

- calculates unfinished prerequisite queues for the current reviewer;
- returns HTTP 409 with `PREREQUISITE_REVIEW_REQUIRED` when an unanswered blocked
  queue is requested;
- allows `historyOnly` access to saved judgments;
- allows a valid `preferredProposalId` when it is an exact linked follow-up.

The overview API returns both:

- `prerequisiteIssueTypes`: the declared dependency graph; and
- `blockedBy`: the currently unfinished prerequisites and remaining counts.

## 6. Important scientific limitation

The current implementation enforces **review order within one frozen dataset**.
It does not apply accepted changes or regenerate downstream proposals. That is
adequate for interface piloting, but it is not enough for a confirmatory study of
the full pipeline.

The production study must use dataset-level waves:

1. Freeze ontology snapshot S0 and generate Phase 1 proposals.
2. Collect independent Phase 1 reviews.
3. Adjudicate and apply accepted changes to create S1.
4. Regenerate Phase 2 proposals from S1 and preserve provenance linking S0 to S1.
5. Repeat for structural phases.

Without regeneration, a reviewer may approve a clearer title in Phase 1 but see
the old title in a later proposal, or may judge a structure containing a node that
an earlier decision would merge. Such observations are not independent evidence
about pipeline quality.

## 7. Non-dependencies

The following should not be encoded without new evidence:

- a fixed order among all queues inside the same phase;
- a requirement to complete optional descriptions before restructuring;
- a global requirement to finish every diagnosis before reviewing an exact
  follow-up;
- automatic acceptance based solely on high model confidence;
- a scientific weighting rule that treats senior reviewers as ground truth.

Tom and Rob may have greater **governance authority** in operational decisions,
but role weights must remain separate from the study's analysis of judgments and
disagreement.

## 8. Acceptance checks

- [x] The title queue is the first required phase.
- [x] Meaning queues remain unavailable until titles are complete.
- [x] Structural queues remain unavailable until identity questions are complete.
- [x] Optional checks do not block restructuring.
- [x] Exact merge and move actions retain proposal-level links.
- [x] Saved judgments can still be reopened.
- [x] Server and client enforce the same queue policy.
- [x] Focused unit tests cover completion, blocking counts, saved-history access,
      and exact follow-ups.
- [ ] Before confirmatory data collection, implement admin-controlled wave
      release and proposal regeneration from adjudicated ontology snapshots.
