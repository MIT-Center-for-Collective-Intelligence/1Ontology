# MIT CCI Ontology Oversight Action Plan

Date: July 27, 2026

Source: MIT CCI group meeting with Tom Malone, Rob Laubacher, Vicky Charisi,
Shuo Sun, Anushka Nair, and Iman YeckehZaare

## Executive decision

Run two tracks in parallel.

1. **Operational ontology improvement:** Iman and Rob continue improving Sell and
   testing transfer on Buy. The team should not pause useful engineering while
   waiting for a large reviewer pool.
2. **Research validation:** preserve the current operational trace, obtain an
   independent review from Tom, and run a small far-transfer pilot to measure
   whether nonexpert review adds enough value to justify its recruitment,
   training, aggregation, and coordination cost.

The paper should not assume that a nonexpert middle layer is valuable. That is
an empirical question. The more distinctive research problem is allocating work
among LLMs, nonexperts, and experts while their judgments update the same
dependent, mutable artifact.

## What the meeting established

- The current system can decompose ontology repair into reviewable microtasks,
  preserve expert corrections, propagate approved changes, and regenerate
  downstream proposals.
- Sell remains formative development work. Prompt behavior, dependencies, UI
  copy, and ontology state all changed during review.
- Buy is useful near-transfer evidence because it mirrors Sell, but it cannot by
  itself establish generalization.
- Recruiting many reviewers before defining routing and coordination would be
  expensive and scientifically weak.
- Some bounded tasks may not require deep expertise once an expert has identified
  the issue family and the system has decomposed the work.
- There is no single ground truth for every ontology decision. The system must
  preserve policy ambiguity and legitimate alternative organizations.
- Research summaries belong in a separate back-office surface. Adding them to the
  reviewer workflow would create clutter and could anchor later reviewers.
- The team should pilot on a small subset before attempting work across roughly
  20,000 ontology nodes.

## Immediate work package

### 1. Preserve the formative baseline

Use `scripts/som-review/export-study-baseline.mjs` to capture:

- all immutable Sell and Buy dataset versions and ontology snapshots;
- proposal, control, dependency, detector, judge, and prompt-version inventories;
- current review decisions, timing, sessions, and save/edit/undo histories;
- matchable versus orphaned historical responses;
- title-based and edge-based before/after comparisons for cloned ontologies; and
- the exact Git revision and SHA-256 hashes of study-relevant code and data.

The export is descriptive operational evidence, not a confirmatory dataset.

### 2. Complete a blind-first Tom review

Tom should inspect the current Sell hierarchy before seeing Rob's judgments.

1. Scan the current hierarchy and record unclear, misplaced, duplicated, missing,
   or poorly grouped activities.
2. Compare the original and current hierarchy outlines.
3. Only after locking that independent pass, inspect Rob's disagreement appendix.
4. Classify differences as agent error, reviewer error, missing evidence, policy
   ambiguity, or legitimate alternative organization.
5. Walk through the detector, judge, propagation, and dependency architecture
   with Iman.

This produces an independent comparison rather than a second reviewer anchored
on the first expert's answers.

### 3. Finish the Sell audit

Iman and Rob should classify each remaining concern in the current Sell hierarchy:

- **local correction:** the prompt is sound, but this item needs a one-off change;
- **detector miss:** the issue family exists, but the detector did not find it;
- **judge error:** the candidate was found, but the judge retained or rejected it
  incorrectly;
- **prompt-policy gap:** the system lacks a general rule;
- **dependency failure:** an upstream change did not invalidate or regenerate the
  right downstream proposal;
- **evidence gap:** the reviewer lacked the needed O\*NET or hierarchy context; or
- **legitimate alternative:** more than one organization remains defensible.

Only recurring, generalizable failures should change prompts. Every prompt change
must be regression-tested against prior accepted and rejected cases.

### 4. Continue Buy as near transfer

Continue the already-started Buy review using the current learned issue patterns.
Report it as near transfer, not a held-out generalization test. If Sell changes
again, identify exactly which Buy proposal families are invalidated and
regenerate only those dependent waves.

### 5. Select one far-transfer branch before inspection

Choose a branch that differs from Sell and Buy in semantic content, hierarchy
shape, and issue distribution. Record the selection rule before inspecting agent
proposals. Freeze:

- source ontology snapshot and hash;
- prompt, model, and agent versions;
- review UI version;
- issue-family coverage; and
- branch-level invariants.

This branch supplies the first credible test of whether the learned decomposition
and prompts transfer beyond a mirror task.

### 6. Run a small cost-value pilot

Before large recruitment, use a balanced sample of approximately 24-36 proposals
from the frozen far-transfer branch.

Suggested pilot:

- two independent expert or steward reviewers;
- four informed nonexpert reviewers;
- four careful general reviewers;
- balanced coverage of title, identity, grouping, placement, and exact-action
  tasks; and
- independent evidence-only judgments before any prior reviewer answer appears.

Measure:

- review time and estimated cost by reviewer stratum;
- proposal acceptance and disagreement distributions;
- nonexpert errors caught by experts;
- agent errors caught by nonexperts that would otherwise reach experts;
- expert minutes saved after including training and aggregation time;
- escalation precision for ambiguous or high-impact cases; and
- disagreement categories, including legitimate alternatives.

Continue investing in the middle layer only if it reduces net expert effort or
adds distinct error-detection value without suppressing unresolved cases.

### 7. Compare the three ontology systems

Shuo should coordinate demos of the systems developed by Iman, Alice's UROPs, and
Shuo's team. Each team should provide a short design record covering:

- problem decomposition;
- prompt and agent architecture;
- human roles and routing;
- dependency and propagation handling;
- evidence shown to reviewers;
- known failure modes;
- constraints that drove design choices; and
- lessons that should transfer into a combined system.

The decision should compare design principles and constraints, not only polished
demos.

## Product and research boundary

Keep these on the operational reviewer surface:

- one atomic decision at a time;
- the evidence needed for that decision;
- dependency-aware queue availability;
- saved-answer revision and undo;
- workspace and round switching; and
- original/current hierarchy comparison.

Keep these on the research or deliberation surface:

- cross-reviewer tallies and role distributions;
- prior reviewers' rationales;
- prompt and agent performance;
- timing and revision analytics;
- disagreement coding;
- resolution and routing policy; and
- export and reproducibility controls.

## Decision gates

### Gate A: Sell readiness

Proceed when Tom and Rob have independently inspected the current Sell hierarchy,
remaining failures are classified, and the team distinguishes prompt changes from
legitimate alternatives.

### Gate B: far-transfer readiness

Proceed when one semantically different branch, all prompts, models, dependencies,
and UI behavior are frozen before proposal inspection.

### Gate C: middle-layer value

Scale nonexpert recruitment only if the small pilot shows a defensible reduction
in net expert effort or distinct quality gains after accounting for recruitment,
training, aggregation, and expert audit.

### Gate D: confirmatory study

Begin confirmatory collection only after ethics review, a frozen protocol,
external reference reviewers, power analysis, and a clear separation between
development and held-out branches.

## Next meeting packet

Prepare these artifacts:

1. current Sell hierarchy plus original/current comparison;
2. aggregate agree/disagree counts by review round;
3. Rob's disagreement appendix, withheld until Tom's independent pass;
4. prompt, detector, judge, and dependency architecture overview;
5. list of remaining Sell concerns classified by failure type;
6. candidate far-transfer branches with a predeclared selection rule; and
7. a one-page protocol for the small cost-value pilot.
