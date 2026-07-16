# Firestore source boundary

The review dataset is generated from the production Firestore ontology
`final-hierarchy-with-o*net`, displayed in the application as
**Final Hierarchy with O\*Net**. The bundled `ontology-snapshot.json` contains
the stable Firestore IDs and relations for the Sell subtree that existed when
the Society of Mind run began.

The July 15 snapshot contains 112 Sell-subtree nodes, 146 parent-child
relations, and three reference-only destination nodes: `Advertise`, `Persuade`,
and `Provide service`. Every review record includes the IDs it references and
the snapshot SHA-256. The server validates the snapshot hash, ontology
identity, node IDs, metadata current state, parent-child relations, and
collection names before it serves any review queue. One invalid record prevents
the dataset from loading.

Exact-action records have stricter checks. Merge records must name two current
siblings and reproduce the current union of their children. Relocation records
must name both current parents and the existing source relation. Missing-node
records must name an absent title under a current parent. Wrapper-removal
records must reproduce the current parent, wrapper, and direct children.
Sense-relocation records must retain an existing Sell sense, name a verified
outside destination, and depend on an accepted polysemy diagnosis.

`Sell Financial Instrument` is not a node in this snapshot. It may appear only
as the title of a proposed new grouping; it cannot appear as an existing node,
parent, or placement target.

After producing a new review-only pipeline dataset, refresh and validate the
handoff with:

```bash
node scripts/som-review/sync-live-sell-dataset.mjs \
  --input-dir /absolute/path/to/review-datasets \
  --output-dir ./Sell_Society_of_Mind_Review_UI_Handoff_YYYY-MM-DD/review-datasets \
  --environment production
```

The sync command is read-only with respect to Firestore. It writes local
artifacts only and aborts on unknown or stale ontology references.

Then regenerate the complete review inventory:

```bash
node scripts/som-review/expand-comprehensive-sell-dataset.mjs \
  --directory ./Sell_Society_of_Mind_Review_UI_Handoff_YYYY-MM-DD/review-datasets
```
