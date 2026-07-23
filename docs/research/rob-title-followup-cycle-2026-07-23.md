# Rob title follow-up cycle

Date: July 23, 2026

## Expert result

Rob reviewed all four title-split follow-ups generated after the first title
calibration cycle:

- `Market Product`;
- `Sell Beverage`;
- `Sell Product`; and
- `Sell Supply`.

He agreed with all four proposals and supplied no new disagreement rationale.
This cycle therefore provides confirmation of the previous prompt correction,
not evidence for another prompt change.

The immutable reviewer export is:
`artifacts/rob-title-review-2026-07-23/rob-title-followup-benchmark.json`.

## Ontology application

The accepted proposals were applied to a new ontology:

- source: `Final Hierarchy with O*Net - Rob Title Review 2026-07-22`;
- target: `Final Hierarchy with O*Net - Rob Title Review v2 2026-07-23`;
- result: four retained/renamed source nodes, 13 newly created nodes, one
  assignment to the existing `Sell Products` node, and 52,298 target nodes;
  and
- source ontology digest before and after: identical.

The application plan and verification audit are stored beside the benchmark.
The audit verifies the target node count and digest and confirms that the
source ontology was unchanged.

## Downstream regeneration

Every old proposal was rebound to a fresh snapshot of the target ontology.
The regeneration:

1. removed the completed title queue;
2. retained only proposals whose current nodes and relations still exist;
3. wrote 64 stale records and their rejection reasons to an audit file;
4. regenerated meaning, grouping, placement, metadata, and optional gap
   candidates against the post-split structure; and
5. linked each exact merge or relocation to the diagnosis that must be
   approved first.

The resulting package contains 137 proposals. The 75 description and
missing-activity proposals are optional. No proposal writes to Firestore.

## Implication of Rob's attached articles

The Age of Hyperspecialization supports decomposing ontology improvement into
bounded expert tasks, but also warns that task flow, quality control, and final
integration must be designed explicitly. The Collective Intelligence Genome
supports separating who contributes judgments from who has final decision
authority. Together, they justify atomic review plus dependency tracking and
expert stewardship; they do not justify majority voting as ground truth.

## Next operational step

Deploy the regenerated package, ask Rob to begin with the meaning and identity
phase, capture his rationales, and repeat the same export-apply-regenerate
cycle. Only after those meaning decisions are incorporated should the
structure and placement queues be treated as stable.
