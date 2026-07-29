# Rob Review Workflow Decisions

Date: July 28, 2026

Sources:

- July 28 meeting between Iman YeckehZaare and Rob Laubacher
- Rob's pre-meeting Slack requirements
- `SellOutlineInput2026-07-28.docx`
- July 27 MIT CCI ontology oversight action plan

## Product decisions

### 1. Tom's review has two stages

Tom should not repeat Rob's entire atomic review.

1. **Independent hierarchy scan.** Tom compares the original and current Sell
   outlines and records any unclear, misplaced, duplicated, missing, or poorly
   grouped activities. The notes are locked before prior-review evidence is
   revealed.
2. **Prior-review inspection.** Tom sees every item Rob reviewed in stable queue
   order on one scrollable page. Each item includes:
   - the before state;
   - the LLM-proposed after state, including no-change controls;
   - Rob's visibly selected response;
   - Rob's disagreement rationale, when present; and
   - Rob's proposed alternative, when present.

Tom does not overwrite or replicate Rob's response. He leaves an exception only
when he is not aligned with it. The exception stores Tom's rationale and optional
alternative as a separate, audited record. No response is inferred from silence.
The first release does not aggregate multiple reviewer groups or assign
governance weights.

### 2. Non-expert calibration is a separate surface

The non-expert surface must not expose research controls, workspaces, ontology
rounds, prior answers, group results, or the complete dependency graph.

- Start with a concise explanation page.
- Show one frozen sub-branch and one released task set.
- Show one atomic item at a time.
- On completion, stop and wait for the research team to release the next
  assignment.
- Generate every later assignment from the frozen expert-consensus ontology,
  never from an individual non-expert's answers.
- Store assignment and consensus-snapshot identifiers with the response trace so
  non-expert answers cannot accidentally become propagation inputs.

The initial use is calibration with a few UROPs, team members, or SkillsFuture
participants. It is not a confirmatory randomized experiment.

### 3. Confidence never causes silent ontology changes

- No proposal is applied because a detector or judge reports high confidence.
- The inspection surface includes all items the expert saw: proposed changes,
  direct detector questions, and sampled no-change controls.
- Blinded reviewer surfaces continue to hide model identity and confidence to
  avoid anchoring.
- Research exports retain record source, detector and judge identities, prompt
  versions, and confidence fields.
- Propagation accepts only an explicit consensus application plan tied to
  reviewed proposal IDs and a frozen source snapshot.

### 4. Expert outline tools remain research-only

The expert and inspection surfaces should:

- explain hierarchy chevrons and guide lines;
- show recorded synonyms without turning them into child nodes;
- optionally show associated O\*NET evidence;
- allow downloading the selected outline; and
- compare original and selected ontology versions.

These controls do not appear in the non-expert surface.

## Sell ontology corrections

Each observed error must first be assigned a failure class. Prompt changes are
appropriate only for generalizable failures.

| Observation                                                                                                              | Initial failure class                        | Required correction                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Sell -- Miscellaneous` and `Sell (Other)` duplicate the `What?` organization                                            | prompt-policy gap                            | Represent this as an explicit collection-policy proposal; do not silently delete it                         |
| O\*NET evidence remains attached to a broad source after a task-specific title is created                                | dependency failure                           | Reassign each source task to the task-derived output node while preserving justified multiple inheritance   |
| `Rent out` is the only child of `Sell temporary usage`                                                                   | identity/policy question                     | Test whether the wrapper and activity are coextensive; preserve `Lease out` as a synonym                    |
| Insurance and investment instruments appear under information                                                            | detector/prompt-policy gap                   | Classify the sold entitlement and interactive obligation as a service, not merely the policy document       |
| Long lists remain under physical objects                                                                                 | detector miss or judge threshold             | Permit coherent, evidence-supported intermediate groups and regression-test against aesthetic over-grouping |
| Bicycle/accessory, flower/agriculture, food-specialty/food, gambling chip/token, service/services, admission pass/ticket | local identity, grouping, or placement cases | Add regression cases and fix only the general detector or judge rule that failed                            |

The funeral-products lineage must be traced from its source proposal and O\*NET
task before changing propagation logic.

## Acceptance criteria

- Tom can lock a hierarchy scan before seeing Rob's answers.
- A research-team member can select Rob and inspect all of his applicable
  responses without clicking proposal by proposal.
- Rob's decision, rationale, and alternative remain visible after an inspection
  exception is saved.
- An inspector can add, edit, or clear a separate not-aligned exception.
- The non-expert link exposes only one assignment and cannot switch branches,
  rounds, queues, or open research-only hierarchy tools.
- Completing a non-expert assignment does not release, generate, or propagate a
  later wave.
- The outline shows synonyms and O\*NET evidence distinctly and can be downloaded
  as a deterministic text outline.
- Tests prove that confidence is descriptive metadata and is never an
  application gate.
- Prompt and propagation changes include regression fixtures for every
  generalizable Sell failure addressed in this cycle.
