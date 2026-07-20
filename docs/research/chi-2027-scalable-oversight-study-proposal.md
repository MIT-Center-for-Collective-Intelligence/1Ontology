# Oversight Without Ground Truth

## A Dependency-Aware, Disagreement-Preserving System for Reviewing AI-Proposed Ontology Changes

Proposed venue: ACM CHI 2027 Papers

Full-paper deadline: September 10, 2026, Anywhere on Earth

Protocol status: study proposal; not yet preregistered or ethics-approved

Prepared: July 20, 2026

## Decision summary

This is a credible CHI research direction, but the current Sell pilot is not
sufficient evidence for a CHI paper. A defensible submission requires:

1. a frozen and separately validated review interface;
2. prompt and proposal generation frozen before confirmatory data collection;
3. held-out ontology sub-branches rather than Sell alone;
4. independent judgments before reviewers see model rationales;
5. a response option for insufficient evidence or legitimate unresolved cases;
6. multiple reviewer expertise strata without treating seniority weights as
   scientific ground truth;
7. structured deliberation that preserves dissent; and
8. a held-out test of a selective oversight policy, not merely agreement rates.

The [CHI 2027 call](https://chi2027.acm.org/authors/papers/) sets a September 10,
2026 deadline. This leaves roughly seven weeks. Submission is possible only with
immediate ethics review, bounded scope, rapid recruitment, and a firm August 3
go/no-go decision. If those conditions are not met, the scientifically correct
choice is to continue the study for CSCW or CHI 2028 rather than submit a rushed,
underpowered paper.

## 1. Working abstract

AI agents can generate proposed improvements to complex knowledge artifacts much
faster than scarce domain stewards can inspect them. Yet scaling oversight is
especially difficult when proposal quality has no single objective target:
reviewers may disagree because of error, missing evidence, uneven expertise,
ambiguous policy, or legitimately different use goals. We present a
dependency-aware review system that decomposes AI-proposed ontology changes into
bounded
before/after judgments, stages model rationales after independent human decisions,
links diagnoses to exact downstream actions, and escalates disagreement through
structured deliberation without forcing consensus. We evaluate the system across
held-out branches of a large ontology of work activities with reviewers at three
expertise levels. Our study asks which proposal types can be reviewed reliably by
lower-cost reviewers, when structured human or AI-mediated deliberation improves
judgments, and whether a selective oversight policy can reduce expert workload
while preserving unresolved disagreement. Rather than construct a single gold
label for every proposal, we distinguish formally resolvable,
expert-reference-resolvable, and legitimately plural cases. We contribute
empirical evidence and
design guidance for scaling human oversight of open-ended AI work when agreement
is informative but not synonymous with correctness.

## 2. Intended contribution

The paper should claim four contributions:

1. **A conceptual contribution:** a model of oversight without objective targets
   that separates resolvable error from legitimate plural judgment.
2. **A system contribution:** a dependency-aware review workflow with independent
   judgment, evidence exposure, exact diagnosis-to-action transitions, revision,
   deliberation, provenance, and selective escalation.
3. **An empirical contribution:** evidence about how proposal type, reviewer
   expertise, model rationale, and deliberation affect decisions, uncertainty,
   disagreement, effort, and reference-panel resolution.
4. **An operational contribution:** a held-out selective oversight policy that
   determines which proposals need one reviewer, multiple reviewers, expert
   adjudication, or abstention.

The paper should not claim that:

- majority agreement is ground truth;
- Tom or Rob's operational authority makes their judgment objectively correct;
- local proposal acceptance necessarily improves the complete ontology;
- the agents are superhuman; or
- high model confidence is enough to remove human review.

## 3. Research framing

### 3.1 Operational scalable oversight

Classic scalable-oversight work asks how weaker supervisors can evaluate stronger
agents. Debate, process supervision, weak-to-strong generalization, and AI feedback
all reduce or redistribute human judgment. The 1Ontology setting is a tractable,
real-world analogue: a Society of Mind pipeline can produce many structural
proposals, the number of ontology stewards is small, and quality is expensive to
judge globally.

The paper should define the construct narrowly:

> Operational scalable oversight is the allocation and structuring of human
> judgment so that a high-volume AI proposal pipeline can operate at increasing
> coverage while maintaining predeclared quality, dissent-preservation, and audit
> requirements.

### 3.2 No single gold standard

Every proposal should be classified into one of three epistemic categories:

1. **Formally resolvable:** a decision can be checked against an explicit
   invariant, source record, or ontology policy.
2. **Reference-resolvable:** an independent qualified panel reaches a reasoned
   decision after reviewing common evidence.
3. **Plural or unresolved:** more than one decision remains defensible because
   policies, use goals, or interpretations differ.

Only categories 1 and 2 support an accuracy-like outcome. Category 3 requires
distributional reporting, rationale preservation, and continued human governance.

### 3.3 Why dependencies are part of the research design

The same node can have title, synonym, description, placement, grouping, and final
action proposals. Review order therefore changes the information available for a
later judgment. The app now distinguishes:

- queue-level semantic prerequisites;
- exact proposal-level diagnosis-to-action links; and
- dataset-level snapshot dependencies requiring adjudication and regeneration.

The complete dependency rationale is documented in
`docs/research/review-workflow-dependency-spec.md`.

## 4. Research questions

### RQ1: Reviewability across expertise

For which ontology proposal types can informed non-stewards and general reviewers
make judgments comparable to an independent expert reference panel, and where do
expertise gaps remain?

### RQ2: Influence and deliberation

How do model-rationale exposure, structured rationale exchange, and AI-mediated
synthesis change reviewers' decisions, confidence, disagreement reasons, effort,
and retention of minority rationales?

### RQ3: Selective oversight

Can observable signals identify which proposals can receive lower-cost oversight
and which require expert review or abstention, while meeting predeclared quality
and dissent-preservation thresholds on held-out ontology branches?

### RQ4: End-to-end compositionality

Does applying decisions from the proposed oversight policy produce an ontology
snapshot that is easier to understand and navigate without increasing formal or
expert-identified structural defects?

## 5. Preregistered expectations

These are candidate hypotheses. They should be revised after the formative pilot
and frozen before confirmatory data are inspected.

- **H1, expertise interaction:** expertise gaps will be smaller for title and
  metadata judgments than for polysemy, placement, collection, and final-action
  judgments.
- **H2, model influence:** revealing a model rationale will change judgments
  toward the model more often than away from it. This is an influence hypothesis,
  not a quality hypothesis.
- **H3, deliberation:** structured rationale exchange will improve alignment with
  the reference panel on reference-resolvable cases relative to a no-exchange
  reconsideration control.
- **H4, synthesis trade-off:** AI synthesis will reduce review time relative to a
  raw rationale board, but may omit or flatten minority arguments unless raw
  rationales remain expandable.
- **H5, selective coverage:** a held-out selective policy will reduce the share of
  proposals requiring steward adjudication while meeting preregistered quality and
  unresolved-case leakage thresholds.

## 6. System under study

### 6.1 Proposal pipeline

The Society of Mind pipeline uses specialized detectors and judges to produce
proposals for:

- title clarity;
- missing or mistaken synonyms;
- missing descriptions;
- double meanings;
- repeated facet nodes;
- undetected duplicates;
- flat-list and compound-object grouping;
- collection design;
- within-branch placement;
- wrong leading verbs;
- merge, relocation, and sense-relocation actions;
- missing activities; and
- redundant nodes.

Every proposal must carry:

- ontology snapshot ID and hash;
- subject and referenced node IDs;
- detector and judge prompt versions;
- issue type and epistemic category;
- source evidence, including O\*NET tasks where applicable;
- dependencies and conflict group;
- current and proposed state; and
- rationale.

### 6.2 Prompt-improvement loop before confirmatory evaluation

Reviewer corrections can improve the proposal agents, but automatically rewriting
prompts from individual comments would create unstable behavior and make the
evaluation circular. During development only, use this versioned loop:

1. collect independent decisions, corrections, and disagreement codes on Sell and
   the designated development branch;
2. have an LLM cluster recurring failure modes and draft candidate prompt changes,
   without editing production prompts;
3. require a human prompt owner to accept, reject, or revise each candidate and
   record the rationale;
4. run the candidate against a frozen regression set containing prior failures,
   accepted proposals, rejected proposals, and invariant checks;
5. retain the revision only if it improves the preregistered development metrics
   without a material regression by issue family; and
6. archive the prompt, model, data snapshot, and test report as one immutable
   version.

No prompt may be changed after the confirmatory prompts and branches are frozen.
Comments from held-out participants must not flow back into prompt development
until all confirmatory analyses are locked. This separates a useful
human-supervised engineering loop from evidence about whether the resulting
pipeline generalizes.

### 6.3 Dependency-aware review

The workflow has five phases:

1. clarify labels;
2. resolve meaning and identity;
3. review structure and placement;
4. confirm exact linked actions; and
5. conduct optional quality checks.

Exact actions are offered immediately after agreement with their source diagnosis.
Broader structural phases are gated until semantic prerequisites are complete.
Previously saved judgments remain revisable.

### 6.4 Study-mode additions required

The operational app should be forked into a versioned study mode with:

1. `Agree`, `Disagree`, and `Insufficient evidence / unresolved` responses;
2. confidence on a 0–100 scale;
3. independent Stage 1 judgment before model rationale exposure;
4. model rationale shown only after Stage 1 is locked;
5. O\*NET/source evidence visible by default in both stages;
6. a structured rationale form separating claim, evidence, uncertainty, and
   suggested correction;
7. randomized or counterbalanced proposal order;
8. no model identity, confidence, or reviewer-role status in the reviewer view;
9. instrumentation for view, expansion, revision, and response timing; and
10. a deliberation view that always preserves raw rationales beside any AI
    synthesis.

## 7. Study program

The UI and content questions must be separated. Otherwise, disagreement could be
caused by a bad proposal, an unclear title, or an interaction failure.

## Study 0: Formative interface and dependency validation

### Purpose

Establish that intended users understand exactly what each card asks, how before
and after differ, which evidence is relevant, and why some proposals follow
others. These data develop and freeze the instrument; they are not used as the
main evidence about agent quality.

### Participants

Planning target: 12 participants, four from each group:

1. ontology or knowledge-organization researchers;
2. HR, work-analysis, organizational research, or adjacent informed users; and
3. educated general users with no ontology experience.

Project prompt authors should not participate as evaluative subjects.

### Procedure

1. Five-minute onboarding with one example not used later.
2. Think-aloud review of 10–12 seeded proposals covering all major card forms.
3. At least two dependency transitions, including diagnosis to exact action.
4. Neutral comprehension questions after each form:
   - What decision are you making?
   - What changes if you agree?
   - What remains undecided?
   - What evidence did you use?
5. Retrospective interview about unclear terminology, missing context, and
   perceived pressure to follow the AI.

### Freeze criteria

The main study should not begin until:

- at least 90% of decision-scope comprehension questions are correct;
- no participant mistakes a diagnosis judgment for an already-applied action;
- at least 10 of 12 participants can explain the dependency path unaided;
- all critical accessibility defects are resolved;
- median task completion fits the planned participant burden; and
- no new critical usability theme appears in the last three sessions.

If these criteria fail, iterate the UI and repeat targeted sessions. Do not mix
pre-freeze and post-freeze responses in the confirmatory dataset.

## Study 1: Confirmatory oversight and deliberation study

### 7.1 Stimulus development and held-out test

Sell is the development branch. It must not be the sole confirmatory branch
because prompts, proposal copy, and interface behavior were tuned against it.

1. Use Sell and one additional branch for prompt development and variance
   estimation.
2. Freeze all prompts, model versions, ontology policies, and UI behavior.
3. Select 3–5 held-out sub-branches varying in size and semantic character.
4. Generate proposals by issue type from the frozen pipeline.
5. Sample approximately 180 proposals with minimum representation from six
   families: labels/metadata, identity, grouping, placement, exact actions, and
   optional additions/removals.
6. Include model-proposed negatives or control items where the detector rejected a
   change; otherwise agreement can be inflated by only reviewing positive
   proposals.
7. Keep a branch-level held-out partition untouched until the routing policy is
   frozen.

The exact count should follow the pilot variance and power simulation. `180` is a
planning target, not a post hoc promise.

### 7.2 Dataset-level wave execution

The confirmatory study cannot review every proposal from one stale snapshot in a
single pass.

For each phase:

1. generate proposals from snapshot S_t;
2. collect all independent reviews;
3. complete the assigned deliberation condition;
4. obtain reference-panel disposition;
5. apply approved changes to produce S_t+1;
6. run invariant checks; and
7. regenerate downstream proposals from S_t+1.

This prevents later judgments from referring to titles, nodes, or parent-child
relations that earlier approved changes would remove.

### 7.3 Participants

Planning target: 72 independent reviewers.

| Stratum                    | Target | Eligibility                                                                                       |  Planned workload |
| -------------------------- | -----: | ------------------------------------------------------------------------------------------------- | ----------------: |
| Ontology/knowledge experts |     12 | ontology engineering, knowledge graphs, classification, or closely related research/practice      | 30 proposals each |
| Informed domain users      |     24 | HR, work analysis, organizational research, labor/learning research, or related professional work | 15 proposals each |
| General reviewers          |     36 | fluent English, careful reasoning, no required ontology background                                | 10 proposals each |

This yields approximately 1,080 initial reviews: six per proposal, with two from
each stratum. Final sample size and allocation must be selected by
simulation-based power analysis using pilot estimates and the cross-classified
model below.

Recruitment sources may include professional networks, Prolific, relevant academic
mailing lists, and paid expert outreach. All participants should receive fair
compensation based on pilot-measured completion time.

### 7.4 Independent review stages

Each proposal has two individual stages before any social information appears.

#### Stage 1: evidence-only judgment

Show:

- current and proposed state;
- the exact question;
- ontology context needed for the decision; and
- source O\*NET tasks or other source evidence, visible by default.

Hide:

- model rationale;
- model identity and confidence;
- detector/judge agreement;
- other reviewers' responses; and
- reviewer seniority or role.

Collect decision, confidence, claim, evidence, uncertainty, and time.

#### Stage 2: model-rationale judgment

Reveal the model rationale, permit evidence reinspection, and collect the same
measures again. Preserve the Stage 1 response as immutable data while allowing a
new Stage 2 response.

Decision change is an influence measure. It is only scored as beneficial or
harmful after reference classification.

### 7.5 Deliberation assignment

After Stage 2, proposals with unanimous judgments finish without deliberation but
receive a random steward audit sample. Proposals with disagreement or substantial
uncertainty are randomized at the proposal level to one of three conditions:

1. **Reconsideration control:** matched delay, original evidence, and an invitation
   to reconsider without seeing others' rationales.
2. **Structured human rationale board:** anonymized claim/evidence/uncertainty
   cards from the other reviewers, randomly ordered and grouped only by stance.
3. **AI-mediated synthesis plus raw rationales:** a structured synthesis of claims,
   evidence, conflicts, missing context, and minority positions, with every raw
   rationale directly expandable.

The AI mediator must not recommend `Agree` or `Disagree`. It should identify the
decision dimensions, faithfully attribute supporting evidence, and explicitly
state any position it could not reconcile.

After exposure, each reviewer independently records a final decision, confidence,
and explanation. Reviewers are never required to reach consensus.

Randomization must be stratified by issue family and initial disagreement level.
Each participant sees only one deliberation condition for a given proposal.

### 7.6 Independent reference panel

Use a 3–5 person reference panel, preferably majority-external and spanning
ontology engineering and work-activity domain knowledge. The panel should not see
participant distributions, model confidence, or role weights before making its
initial judgments.

Panel procedure:

1. independent evidence-only judgment;
2. independent judgment after model rationale;
3. structured adjudication against the written ontology policy and source data;
4. disposition as `accept`, `reject`, or `unresolved/plural`;
5. epistemic category as formal, reference-resolvable, or plural; and
6. written rationale and any policy clarification.

Tom and Rob may serve as operational stewards or panel members, but a primary
scientific reference composed only of project leads would be circular. At least
two independent external panelists are strongly preferred.

### 7.7 Operational authority versus scientific analysis

The existing admin interface can weight stewards more than researchers and
researchers more than outside contributors for operational recommendations. That
governance rule must not determine the scientific outcome.

The paper should report:

- unweighted response distributions;
- stratum-specific distributions;
- reference-panel disposition;
- counterfactual outcomes under simple majority, equal-stratum vote, current
  operational weights, and deliberation; and
- which proposals change outcome under each policy.

## 8. Measures

### 8.1 Primary measures

1. **Reference alignment on resolvable cases:** agreement with the panel's accept
   or reject disposition, reported by issue family and expertise stratum.
2. **Unresolved-case identification:** sensitivity and precision for participant
   `insufficient evidence` responses relative to panel `unresolved/plural` cases.
3. **Decision transition:** Stage 1 to Stage 2 and Stage 2 to post-deliberation
   change, including direction relative to the model and reference panel.
4. **Minority-rationale retention:** blinded coders judge whether all distinct,
   evidence-supported positions remain represented after deliberation.
5. **Review effort:** active time, number of evidence expansions, rationale length,
   and estimated cost per routed decision.
6. **Selective oversight performance:** coverage and disaggregated risk on the
   untouched branch.

### 8.2 Secondary measures

- confidence and calibration on resolvable cases;
- inter-rater agreement, reported descriptively rather than as quality itself;
- response revision frequency;
- comprehension-check accuracy;
- perceived decision clarity;
- brief workload measure;
- perceived procedural fairness and voice;
- model-rationale usefulness and perceived pressure;
- deliberation contribution balance; and
- downstream formal invariant failures.

### 8.3 Disagreement coding

Two blinded coders should code rationales using a preregistered codebook:

1. attention/execution error;
2. interface or question misunderstanding;
3. missing context;
4. contradictory evidence;
5. lexical ambiguity;
6. unclear ontology policy;
7. domain expertise difference;
8. different use goal or granularity preference; and
9. residual disagreement.

Double-code at least 25% of rationales, report code reliability, reconcile the
codebook rather than silently forcing low-reliability categories, and preserve
multi-label codes.

## 9. Selective oversight policy

### 9.1 Routing levels

The learned or rule-based policy should predict the minimum acceptable oversight:

- **Route A: audit-only provisional acceptance/rejection.** No routine steward
  review, but a random audit sample remains mandatory.
- **Route B: two independent reviewers.** Appropriate for low-risk, highly
  reviewable proposal types.
- **Route C: mixed-stratum panel.** Used when expertise improves resolution or
  judgments diverge.
- **Route D: steward deliberation or abstention.** Used for policy ambiguity,
  unresolved disagreement, or high-impact structural actions.

No proposal should be irreversibly auto-applied during the study.

### 9.2 Candidate routing features

Only use features available before the route is selected:

- issue family and action reversibility;
- number of referenced nodes and dependency depth;
- amount and consistency of source evidence;
- detector/judge disagreement;
- model confidence, calibrated on development data;
- prior empirical error for that frozen prompt version;
- branch and node structural features; and
- whether the proposal conflicts with another proposal.

Do not use protected participant attributes, post hoc reference outcomes, or a
prompt author's manual judgment as routing features.

### 9.3 Predeclared safety criteria

Candidate deployment thresholds, subject to stakeholder confirmation before
preregistration:

- one-sided 95% lower confidence bound of at least 0.95 reference alignment on
  resolvable Route A cases;
- one-sided 95% upper confidence bound of at most 0.05 for routing panel-unresolved
  cases to Route A;
- no formal invariant failures after applying Route A decisions in a sandbox;
- at least 10% random audit of Route A decisions; and
- no issue family generalized beyond the prompt version and branch distribution
  represented in the held-out test.

Report sensitivity analyses at 0.90, 0.95, and 0.98 thresholds. The goal is not to
maximize coverage; it is to characterize the safe coverage-quality frontier.

## 10. Analysis plan

### 10.1 Confirmatory models

Use cross-classified hierarchical models because judgments are nested in neither
reviewers nor proposals alone.

For resolvable cases, fit a Bayesian or frequentist mixed-effects logistic model:

```text
reference_alignment ~
  expertise_stratum * issue_family * study_stage_or_condition +
  proposal_dependency_depth +
  (1 + study_stage_or_condition | reviewer) +
  (1 | proposal) +
  (1 | ontology_branch)
```

For the three-way `agree`, `disagree`, `insufficient` outcome, use a hierarchical
multinomial model. Analyze confidence with an ordinal or bounded model rather than
treating a 0–100 scale as unproblematic Gaussian data.

Deliberation effects are estimated only among eligible disagreement cases and
must respect proposal-level randomization. Report average effects and interactions
with issue family and expertise.

### 10.2 Distributional analysis

For every proposal, retain and visualize the response distribution. Agreement
coefficients may be reported but should not be interpreted as correctness.
Compare counterfactual governance policies using the same raw judgments.

Latent-competence models such as MACE may be included only as sensitivity analyses
on reference-resolvable cases. Their single-latent-truth assumption is not valid
for plural cases.

### 10.3 Rationale analysis

Use the preregistered disagreement codebook, blinded coding, and representative
quotes. Test whether the AI synthesis omits minority rationale categories more
often than the raw rationale board. Do not use an LLM as the only qualitative
coder; an LLM may assist retrieval after human codebook validation.

### 10.4 Power analysis

Do not justify sample size using a generic “30 per condition” rule. Use Study 0 or
a separate non-confirmatory pilot to estimate:

- baseline reference alignment by stratum and issue family;
- proposal and reviewer variance;
- proportion of proposals entering deliberation;
- within-reviewer decision-change correlation; and
- expected attrition.

Simulate the planned hierarchical analysis across candidate reviewer and proposal
counts. Freeze sample size before confirmatory data collection.

### 10.5 Missing data and exclusions

Preregister exclusions for failed attention/comprehension checks, implausibly fast
completion, duplicate participation, and technical interruption. Preserve all
substantive disagreement. Report analyses with and without speed-based exclusions
and reasons for missing deliberation follow-up.

## 11. End-to-end compositionality check

Local proposal judgments do not prove that the resulting ontology is globally
better. Construct three blinded snapshots for held-out evaluation:

1. baseline ontology;
2. changes selected by simple majority; and
3. changes selected by the frozen selective oversight policy.

Run automated checks for cycles, dangling references, duplicate paths, and other
formal invariants. Then recruit 18–24 HR/work-analysis participants not used in
Study 1 for counterbalanced tasks such as:

- locate the best activity for a source work task;
- identify where a new activity belongs;
- explain the difference between adjacent categories; and
- detect whether two paths represent the same activity.

Primary artifact outcomes are task success, time, confidence, and explanation
quality. Include pairwise snapshot preference only as a secondary subjective
measure. This check provides pragmatic ontology-quality evidence and tests whether
local decisions compose.

## 12. Ethics and research integrity

### Human subjects

- Obtain MIT ethics/IRB determination before recruitment.
- Explain that responses evaluate the system, not employee performance.
- Avoid recruiting direct reports where participation could feel compulsory; use
  an independent recruiter and compensation where internal recruitment is needed.
- Store reviewer identity separately from study responses.
- Do not expose role weights, senior reviewers' choices, or model confidence in
  participant views.
- Permit withdrawal without affecting employment or collaboration.

### AI-generated study materials

- Freeze and archive prompts and model versions.
- Human-review every model-generated stimulus for personally identifying or
  confidential information.
- Report the use of generative AI according to ACM policy.
- Ensure AI synthesis remains traceable to raw participant rationales.

### Author and evaluator separation

The prompt author should not contribute primary independent labels. System authors
may conduct engineering and analysis, but reference-panel decisions and rationale
coding should include blinded independent researchers. Any overlap must be
disclosed and analyzed as a sensitivity check.

## 13. Reproducibility package

Subject to ontology and participant-data permissions, release:

- anonymized frozen app and study mode;
- proposal schema and dependency graph;
- prompt and model-version manifests;
- ontology snapshots or structurally equivalent deidentified samples;
- preregistration and power simulation;
- task instructions and comprehension checks;
- analysis code and synthetic test data;
- anonymized individual decisions and confidence;
- deliberation condition assignments;
- disagreement codebook and coded excerpts; and
- selective routing policy with audit thresholds.

Do not release identifiable free-text rationales without a disclosure-risk review.

## 14. Feasibility, budget, and schedule

### Planning budget

| Cost                                       |      Planning range |
| ------------------------------------------ | ------------------: |
| Formative pilot compensation               |         $800–$1,500 |
| General and informed reviewer compensation |       $4,000–$7,000 |
| Independent expert honoraria               |       $4,000–$8,000 |
| Artifact-level validation                  |       $1,500–$3,000 |
| LLM/API and hosting                        |         $300–$1,000 |
| **Total**                                  | **$10,600–$20,500** |

These ranges require recalculation after the timed pilot. An unfunded internal
six-person pilot remains useful for development but is not a substitute for the
confirmatory study.

### Aggressive CHI 2027 schedule

| Date                  | Deliverable                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| July 20–23            | Freeze research questions, dependency policy, stimulus schema, and authorship plan |
| July 21–24            | Submit IRB/ethics protocol; begin external expert recruitment                      |
| July 24–29            | Run Study 0; repair and freeze study UI                                            |
| July 30–August 2      | Generate pilot branch; estimate variance; run power simulation; preregister        |
| **August 3**          | **Go/no-go decision for CHI 2027**                                                 |
| August 4–17           | Generate held-out waves and collect Study 1 data                                   |
| August 18–23          | Deliberation, reference adjudication, and artifact snapshots                       |
| August 24–28          | Artifact-level validation and confirmatory analysis                                |
| August 29–September 5 | Complete paper and supplementary materials                                         |
| September 6–9         | Independent methods audit, anonymization, accessibility, and final revisions       |
| September 10          | Submit before AoE deadline; do not rely on grace period                            |

### Go/no-go criteria on August 3

Proceed only if all are true:

- ethics approval or a documented determination permits data collection;
- Study 0 meets interface freeze criteria;
- at least three held-out branches and all required proposal families are ready;
- prompt/model/UI versions are frozen;
- power simulation supports a feasible sample;
- at least three independent reference panelists are committed;
- participant funding and recruitment channels are confirmed; and
- the team can preserve branch-wave dependencies rather than review one stale
  snapshot.

If any critical criterion fails, continue the pilot, collect stronger data, and
target a later venue.

## 15. Anticipated failure modes and safeguards

| Failure mode                        | Consequence                                             | Safeguard                                                    |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Sell-only evaluation                | Prompt and UI overfitting masquerades as generalization | Development/held-out branch split                            |
| UI changes during main study        | Interface and content effects become inseparable        | Study 0 freeze and version checks                            |
| Model rationale shown first         | Automation bias destroys independent baseline           | Locked evidence-only Stage 1                                 |
| Forced agree/disagree               | Legitimate ambiguity becomes artificial error           | Insufficient/unresolved option                               |
| Weighted vote as truth              | Governance authority becomes circular validation        | Separate operational and scientific analyses                 |
| Majority-only aggregation           | Minority knowledge and use goals disappear              | Raw distributions and rationale retention outcome            |
| Stale downstream proposals          | Later judgments refer to superseded nodes               | Adjudicate, apply, and regenerate between waves              |
| Prompt editing on test data         | Confirmatory overfitting                                | Frozen prompts and untouched branch                          |
| AI synthesis hallucinates consensus | Deliberation becomes persuasion                         | No recommendation; expandable raw rationales; fidelity audit |
| Unanimous errors evade review       | Selective system appears safer than it is               | Random audit of high-agreement cases and control proposals   |
| Local gains harm global structure   | Proposal accuracy does not compose                      | Formal checks and artifact-level user tasks                  |
| Too few genuine experts             | Expertise conclusions are unstable                      | Early recruitment and simulation-based sample decision       |

## 16. Paper outline

Target 7,000–8,000 words excluding references, consistent with the CHI call.

1. Introduction and motivating no-ground-truth oversight problem
2. Related work
   - scalable oversight and weak supervision
   - human-AI reliance and explanation
   - disagreement, deliberation, and expertise
   - ontology evaluation
3. System and dependency model
4. Study 0 and interface freeze
5. Study 1 method
6. Results
   - expertise and proposal type
   - model-rationale influence
   - deliberation and dissent preservation
   - selective routing and held-out coverage-risk
7. Artifact-level compositionality check
8. Discussion
   - when disagreement is oversight signal
   - limits of local decomposition
   - governance versus scientific truth
   - implications beyond ontologies
9. Limitations and ethics
10. Conclusion

## 17. Immediate actions

1. Ask Tom and Rob to approve the narrow framing: scalable oversight of
   open-ended AI proposals, not a general proof of ontology correctness.
2. Identify an MIT co-investigator responsible for human-subjects protocol and
   submit the ethics determination immediately.
3. Recruit at least two external ontology/knowledge-organization experts for the
   reference panel.
4. Freeze a written ontology policy covering titles, synonyms, polysemy,
   grouping, placement, and acceptable unresolved cases.
5. Implement study mode without changing the production review experience.
6. Select development and held-out branches before inspecting their agent
   proposals.
7. Run the 12-person formative UI study and simulation-based power analysis.
8. Make the August 3 go/no-go decision based on the criteria above.

## 18. Core literature

The accompanying review at
`docs/research/scalable-oversight-literature-review.md` provides the detailed
synthesis and links. The most central sources are:

- [AI Safety via Debate](https://arxiv.org/abs/1805.00899)
- [Scalable Agent Alignment via Reward Modeling](https://arxiv.org/abs/1811.07871)
- [Debating with More Persuasive LLMs](https://proceedings.mlr.press/v235/khan24a.html)
- [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050)
- [Weak-to-Strong Generalization](https://cdn.openai.com/papers/weak-to-strong-generalization.pdf)
- [The “Problem” of Human Label Variation](https://aclanthology.org/2022.emnlp-main.731/)
- [Dealing with Disagreements](https://aclanthology.org/2022.tacl-1.6/)
- [Resolvable vs. Irresolvable Disagreement](https://edithlaw.ca/papers/ambiguity.pdf)
- [Jury Learning](https://hci.stanford.edu/publications/2022/gordon_jury_learning_chi22.pdf)
- [To Trust or to Think](https://arxiv.org/abs/2102.09692)
- [Role of Human-AI Interaction in Selective Prediction](https://ojs.aaai.org/index.php/AAAI/article/view/20465)
- [Guidelines for Human-AI Interaction](https://doi.org/10.1145/3290605.3300233)
- [Evaluating Ontological Decisions with OntoClean](https://doi.org/10.1145/503124.503150)
- [A Semiotic Metrics Suite for Ontology Quality](https://doi.org/10.1016/j.datak.2004.11.010)
