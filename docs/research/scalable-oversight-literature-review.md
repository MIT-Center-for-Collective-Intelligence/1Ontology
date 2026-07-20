# Scalable Oversight Without Objective Targets

## A focused literature review for AI-proposed ontology changes

Review date: July 20, 2026

Scope: primary research on scalable oversight, human-AI judgment, disagreement,
deliberation, expertise, selective prediction, and ontology evaluation.

## Executive synthesis

The proposed ontology-review study sits at the intersection of two research
traditions that use similar language for different problems.

1. **AI alignment and scalable oversight** ask how weaker supervisors can judge
   outputs that are too complex or costly to evaluate directly. Debate, process
   supervision, recursive reward modeling, weak-to-strong generalization, and
   AI-generated feedback are prominent approaches.
2. **HCI, CSCW, and human computation** ask how people and AI should interact
   when judgments are fallible, expertise is uneven, and disagreement may be
   informative rather than noise.

The ontology case is not yet a demonstration of oversight over a superhuman
model. It is a defensible instance of **operational scalable oversight**: AI agents
can generate substantially more open-ended structural proposals than a small set
of ontology stewards can inspect, while the quality target is only partially
specified and sometimes contestable.

Five conclusions are especially important:

1. Decompose complex outcomes into locally inspectable decisions, but validate
   that local approval composes into a better global artifact.
2. Collect an independent human judgment before exposing the model's rationale.
   Explanations alone do not reliably prevent overreliance.
3. Do not convert every disagreement into a majority label. First distinguish
   mistakes, missing context, policy ambiguity, expertise differences, and
   legitimate alternative goals.
4. Deliberation should preserve minority rationales and permit an unresolved
   result. Consensus is evidence only when it is reasoned and not coerced.
5. Replace the false choice between 100% human review and autonomous execution
   with selective oversight: use empirical evidence to decide which proposal
   classes need one reviewer, multiple reviewers, expert adjudication, or
   continued abstention.

## 1. What “scalable oversight” means here

[Leike et al.](https://arxiv.org/abs/1811.07871) frame scalable alignment as the
problem of learning and extending a user's implicit objective when direct reward
specification and exhaustive feedback are infeasible. [Irving, Christiano, and
Amodei](https://arxiv.org/abs/1805.00899) propose debate so that competing agents
surface information a weaker judge could otherwise miss. In an empirical analogue,
[Khan et al.](https://proceedings.mlr.press/v235/khan24a.html) found that debate
helped nonexpert model and human judges answer questions whose decisive evidence
was held by stronger debaters.

Several related approaches reduce the unit of oversight:

- [Lightman et al.](https://arxiv.org/abs/2305.20050) show, in mathematical
  reasoning, that supervision of intermediate steps can outperform outcome-only
  supervision and can support active selection of feedback.
- [Bai et al.](https://arxiv.org/abs/2212.08073) replace many direct human labels
  with AI critique and preference judgments constrained by a human-written
  constitution.
- [Burns et al.](https://cdn.openai.com/papers/weak-to-strong-generalization.pdf)
  study whether weak supervision can elicit capabilities from a stronger model,
  while emphasizing that naive weak supervision remains substantially limited.
- [Collective Constitutional AI](https://www.anthropic.com/news/collective-constitutional-ai-aligning-a-language-model-with-public-input)
  demonstrates one process for turning public input into explicit principles,
  although deliberative participation and training remain distinct stages.

### Implication for 1Ontology

The review app's before/after cards are a form of process decomposition: instead
of asking whether a complete ontology is “good,” reviewers judge bounded proposed
changes. That analogy is useful but must not be overstated. The agents are not
proven to exceed expert capability, and the decomposition itself may omit global
interactions. A rigorous paper should call this _scalable human oversight of
high-volume, open-ended AI proposals_, not superhuman alignment.

## 2. No objective target does not mean no evaluation

Ontology quality is multidimensional. [Burton-Jones et al.](https://doi.org/10.1016/j.datak.2004.11.010)
distinguish syntactic, semantic, pragmatic, and social quality. [Guarino and
Welty's OntoClean](https://doi.org/10.1145/503124.503150) shows that some
subsumption errors can be assessed against formal metaproperties. A review of
biomedical ontology evaluation practices identifies four broad strategies:
comparison with a gold standard, application-based evaluation, corpus or coverage
analysis, and expert review against criteria ([Amith et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC5882531/)).
NIST similarly notes the lack of community consensus about ontology quality and
the need for empirically grounded evaluation practices
([NIST IR 8008](https://nvlpubs.nist.gov/nistpubs/ir/2014/NIST.IR.8008.pdf)).

Therefore, “there is no ground truth” should be decomposed into three cases:

1. **Formally resolvable:** violations of explicit ontology rules or data
   invariants can have objective checks.
2. **Reference-resolvable:** qualified experts can reach a reasoned reference
   decision after inspecting shared evidence and policy.
3. **Plural or goal-dependent:** multiple structures remain defensible because
   they optimize different users, granularity levels, or downstream tasks.

The study should not use one metric for all three.

## 3. Human disagreement is a signal to diagnose

[Plank](https://aclanthology.org/2022.emnlp-main.731/) argues that label variation
can arise from subjectivity and multiple plausible answers rather than noise.
[Davani, Díaz, and Prabhakaran](https://aclanthology.org/2022.tacl-1.6/) show that
majority aggregation can erase systematic annotator perspectives. [Jury
Learning](https://hci.stanford.edu/publications/2022/gordon_jury_learning_chi22.pdf)
demonstrates that changing who is represented in a decision rule can alter model
outcomes, making aggregation a governance choice rather than a neutral statistic.

[Schaekermann et al.](https://edithlaw.ca/papers/ambiguity.pdf) directly compare
resolvable and irresolvable disagreement. Their findings show that resolvability
depends on why people disagree, initial consensus, and the amount and quality of
deliberation. In a clinical setting, [structured expert
adjudication](https://edithlaw.ca/papers/adjudication.pdf) revealed that expert
background, data presentation, and guideline clarity all contribute to initial
and persistent disagreement.

### Implication for 1Ontology

The primary data are not only `agree` and `disagree`. The study must preserve:

- initial independent decisions;
- confidence and “insufficient information” responses;
- evidence-linked rationales;
- reviewer expertise and relevant experience;
- post-deliberation decisions;
- whether disagreement was resolved; and
- a coded reason for disagreement.

A useful disagreement taxonomy is:

1. attention or execution error;
2. misunderstood question or interface;
3. missing or contradictory evidence;
4. unclear title or lexical ambiguity;
5. unclear ontology policy;
6. domain-knowledge difference;
7. different use goals or granularity preferences; and
8. residual unexplained disagreement.

Categories 1–6 may motivate task, interface, evidence, or prompt repair. Category
7 should usually be preserved rather than “fixed” by majority vote.

## 4. Deliberation can help, but consensus is not the objective

Structured deliberation has repeatedly improved discussion quality or judgment
in appropriate settings:

- [Schaekermann et al.](https://edithlaw.ca/papers/ambiguity.pdf) found improved
  correctness and characterized when cases remained unresolved.
- [Kim et al.'s DebateBot](https://doi.org/10.1145/3449161) found that structured
  discussion promoted diverse contributions and perceived deliberative quality,
  while facilitation improved contribution equality and alignment.
- [Ma et al.](https://arxiv.org/abs/2403.16812) use dimension-level opinion
  elicitation and human-AI discussion rather than a single accept/reject exchange.
- [Khan et al.](https://proceedings.mlr.press/v235/khan24a.html) show that
  adversarial arguments can reveal otherwise unavailable evidence, but their
  benchmark has known answers and should not be generalized directly to
  contestable ontology design.

The design implication is **deliberation with an exit**. Reviewers should be able
to converge, revise one another, request evidence, or mark the case unresolved.
An AI moderator may cluster claims, locate contradictions, and ensure that each
position is represented, but should not manufacture a single recommendation.

## 5. Exposure to AI rationales must be staged

The current app presents an LLM-generated recommendation and rationale. This is
useful operationally but creates a measurement problem. [Buçinca, Malaya, and
Gajos](https://arxiv.org/abs/2102.09692) found that explanations alone did not
prevent overreliance, while cognitive forcing reduced overreliance at a usability
cost. [Bondi et al.](https://ojs.aaai.org/index.php/AAAI/article/view/20465) found
that selective-prediction messaging changed human accuracy; informing people
that the system deferred without revealing its prediction performed better in
their task than revealing the prediction.

The study should therefore collect:

1. an initial judgment from the before/after evidence without model identity,
   confidence, or rationale;
2. a second judgment after revealing the rationale and source evidence; and
3. deliberation only after independent judgments are locked.

This design measures model influence and protects the independence needed for
meaningful disagreement analysis. It does not assume that changing toward the
model is good.

## 6. Expertise is both a measurement variable and a governance choice

Latent-truth aggregation methods such as
[MACE](https://aclanthology.org/N13-1132/) estimate annotator competence from
redundant labels. Such models are useful sensitivity analyses when a single truth
is plausible, but they are poorly suited as the primary method when systematic
disagreement may be valid. Research on expertise-aware crowdsourcing suggests
that expertise can improve aggregation ([Merritt et al.](https://ojs.aaai.org/index.php/HCOMP/article/view/13263)),
but expertise is not a universal scalar: a work analyst, ontology engineer, and
intended nonexpert user may each be authoritative for different criteria.

The study should separate:

- **scientific analysis:** model each reviewer's expertise and report
  stratum-specific judgment distributions; and
- **operational governance:** allow authorized stewards to decide whose judgment
  governs an actual ontology release.

Tom and Rob's higher operational authority must not silently become a statistical
claim that their answers are objective ground truth.

## 7. Selective oversight is the appropriate scaling target

Selective classification trades coverage against risk by allowing a system to
abstain ([El-Yaniv and Wiener](https://jmlr.csail.mit.edu/papers/v11/el-yaniv10a.html)).
Learning-to-defer work routes cases to humans when machine judgment is less
reliable, while emphasizing that human and AI behavior are interdependent
([Bondi et al.](https://ojs.aaai.org/index.php/AAAI/article/view/20465);
[Wei, Cao, and Feng](https://proceedings.mlr.press/v235/wei24a.html)).

For ontology review, the policy should not initially be “auto-apply or human.”
It should have at least four routes:

1. one independent reviewer plus audit;
2. multiple independent reviewers;
3. structured deliberation and steward adjudication; and
4. unresolved/defer until policy or evidence improves.

Coverage-risk analysis can be adapted, but “risk” must remain disaggregated:

- reversal by an expert reference panel on resolvable cases;
- failure to identify a legitimately unresolved case;
- downstream ontology invariant violation;
- loss of a documented minority rationale; and
- review time and monetary cost.

Collapsing these into one accuracy score would recreate the ground-truth problem
the study is meant to address.

## 8. Human-AI interaction requirements

[Amershi et al.](https://doi.org/10.1145/3290605.3300233) emphasize communicating
system capabilities, supporting correction, and preserving user control. Applied
to the review app, the study interface should:

- state exactly which decision is being requested;
- show current and proposed states symmetrically;
- show source evidence without hiding it behind expert-only language;
- distinguish diagnosis from irreversible action;
- allow revision of saved judgments;
- expose phase and exact proposal dependencies;
- permit uncertainty or insufficient-evidence responses;
- preserve raw rationales next to any AI synthesis; and
- record every prompt, model, ontology snapshot, and UI version.

## 9. Literature-to-design matrix

| Evidence                             | What the study contributes                                          | Design consequence                                                                             |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Irving et al., AI debate             | Stronger agents can surface evidence for weaker judges              | Compare raw rationales with structured AI synthesis, not unaided voting alone                  |
| Khan et al., empirical debate        | Debate helped nonexpert judges on answerable tasks                  | Test whether the benefit extends to partly contestable judgments; retain an unresolved outcome |
| Lightman et al., process supervision | Local step feedback can outperform outcome-only feedback            | Review bounded proposal steps and separately validate whole-ontology outcomes                  |
| Burns et al., weak-to-strong         | Weak labels can elicit some strong capability but leave a large gap | Do not treat lower-expertise agreement as proof that oversight has succeeded                   |
| Plank; Davani et al.                 | Label variation may encode perspectives                             | Store distributions and annotator-level data; do not majority-collapse the dataset             |
| Schaekermann et al.                  | Disagreement has resolvable and irreducible causes                  | Code disagreement reasons and allow unresolved cases                                           |
| Jury Learning                        | Aggregation composition changes outcomes                            | Make reviewer composition explicit and report counterfactual aggregation policies              |
| Buçinca et al.                       | Explanations can induce overreliance                                | Lock an independent initial judgment before model rationale                                    |
| Bondi et al.                         | Deferral messaging changes human performance                        | Experimentally control what the reviewer learns about the model                                |
| Amershi et al.                       | Human-AI systems require correction and control affordances         | Preserve revision, provenance, and clear action boundaries                                     |
| OntoClean                            | Some ontology errors are formally testable                          | Separate formal checks from preference-sensitive structural judgments                          |
| Burton-Jones et al.                  | Ontology quality is multidimensional                                | Include pragmatic and social utility, not only structural correctness                          |

## 10. Open research gap

Existing scalable-oversight studies typically use tasks with externally known
answers or formal verifiers. Disagreement research explains why consensus may be
undesirable, but rarely connects that insight to selective automation of a
multi-stage AI pipeline. Ontology evaluation offers formal metrics and expert
review methods, but little evidence about how to allocate oversight across
AI-generated proposal types and reviewer expertise levels.

The strongest CHI contribution is therefore not “an LLM improves an ontology.” It
is a dependency-aware, disagreement-preserving method for deciding **which AI
proposals can receive less oversight, which require deliberation, and which must
remain unresolved when quality has no single objective target**.

## References

- Amershi, S., et al. (2019). [Guidelines for Human-AI Interaction](https://doi.org/10.1145/3290605.3300233).
- Amith, M., et al. (2018). [Assessing the Practice of Biomedical Ontology Evaluation](https://pmc.ncbi.nlm.nih.gov/articles/PMC5882531/).
- Bai, Y., et al. (2022). [Constitutional AI](https://arxiv.org/abs/2212.08073).
- Bondi, E., et al. (2022). [Role of Human-AI Interaction in Selective Prediction](https://ojs.aaai.org/index.php/AAAI/article/view/20465).
- Burns, C., et al. (2023). [Weak-to-Strong Generalization](https://cdn.openai.com/papers/weak-to-strong-generalization.pdf).
- Burton-Jones, A., et al. (2005). [A Semiotic Metrics Suite for Assessing the Quality of Ontologies](https://doi.org/10.1016/j.datak.2004.11.010).
- Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). [To Trust or to Think](https://arxiv.org/abs/2102.09692).
- Davani, A. M., Díaz, M., & Prabhakaran, V. (2022). [Dealing with Disagreements](https://aclanthology.org/2022.tacl-1.6/).
- El-Yaniv, R., & Wiener, Y. (2010). [On the Foundations of Noise-free Selective Classification](https://jmlr.csail.mit.edu/papers/v11/el-yaniv10a.html).
- Gordon, M. L., et al. (2022). [Jury Learning](https://hci.stanford.edu/publications/2022/gordon_jury_learning_chi22.pdf).
- Guarino, N., & Welty, C. (2002). [Evaluating Ontological Decisions with OntoClean](https://doi.org/10.1145/503124.503150).
- Hovy, D., et al. (2013). [Learning Whom to Trust with MACE](https://aclanthology.org/N13-1132/).
- Irving, G., Christiano, P., & Amodei, D. (2018). [AI Safety via Debate](https://arxiv.org/abs/1805.00899).
- Khan, A., et al. (2024). [Debating with More Persuasive LLMs Leads to More Truthful Answers](https://proceedings.mlr.press/v235/khan24a.html).
- Kim, S., et al. (2021). [Moderator Chatbot for Deliberative Discussion](https://doi.org/10.1145/3449161).
- Leike, J., et al. (2018). [Scalable Agent Alignment via Reward Modeling](https://arxiv.org/abs/1811.07871).
- Lightman, H., et al. (2023). [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050).
- Ma, S., et al. (2024). [Towards Human-AI Deliberation](https://arxiv.org/abs/2403.16812).
- Merritt, D., et al. (2015). [Using Expertise for Crowd-Sourcing](https://ojs.aaai.org/index.php/HCOMP/article/view/13263).
- Plank, B. (2022). [The “Problem” of Human Label Variation](https://aclanthology.org/2022.emnlp-main.731/).
- Schaekermann, M., et al. (2018). [Resolvable vs. Irresolvable Disagreement](https://edithlaw.ca/papers/ambiguity.pdf).
- Schaekermann, M., et al. (2019). [Understanding Expert Disagreement through Structured Adjudication](https://edithlaw.ca/papers/adjudication.pdf).
- Wei, Z., Cao, Y., & Feng, L. (2024). [Exploiting Human-AI Dependence for Learning to Defer](https://proceedings.mlr.press/v235/wei24a.html).
