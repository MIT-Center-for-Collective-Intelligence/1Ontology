# Algorithm-per-node research handoff

This isolated review app presents eight genuine source-current research algorithms as of capture and their independent critiques. It attaches procedures to existing ontology nodes; it does not publish algorithms or restructuring into the production ontology. It requires Node 20 or newer and no npm install, API key, model runner, database, or external service.

From the repository root:

```sh
node research/algorithm-review/server.mjs
node --test research/algorithm-review/test/*.test.mjs
```

Open the printed loopback URL. The server chooses a free port; optionally use `PORT=8766 node research/algorithm-review/server.mjs`. Stop with Ctrl-C and restart with the same command. All server routes are read-only. Browser-local critiques survive restart in the same browser and origin; an ephemeral port change changes the browser storage origin, so export critiques before stopping or select a stable port. Browser storage is not a durable multi-user review database.

Select an activity to inspect its exact recorded title, expanded parent-child context, typed procedure and captured reviews. Select a step or control relation to inspect its rationale, source claims and hypotheses. Activities without a captured algorithm say so. The recorded Collect (information) (Information) branch includes all 35 recorded children and Compile Evidence's O*Net descendant. Multiple parents remain separate paths. Large/deep branches show omissions instead of invented links. The 68-node public projection is partial; even a displayed child list does not establish full corpus coverage.

Human annotations are separate from captured model research critiques. Each local annotation is bound to the capture hash, activity, version and procedure hash. Exported annotations remain local files; there is no import/acceptance/ontology-write endpoint. A changed capture cannot silently attach old notes to a new procedure.

See [the readable report](REPORT.md), [method and continuation](METHOD.md), and [capture audit](data/audit-readable.md). Technical evidence and privacy transformations are in [evidence-summary.json](data/evidence-summary.json) and [privacy-transformation-manifest.json](data/privacy-transformation-manifest.json). Those records distinguish unchanged canonical procedure hashes from transformed public capture hashes.

The tests exercise actual captured procedures, exact digests, node bindings, the 35-child tree, multiple paths, uneven depths, cycle handling, control-flow inspection, version-bound notes, injection-resistant text rendering and HTTP write/path rejection. They validate this portable projection and service behavior, not original native execution or occupational correctness. A restrictive sandbox may deny loopback listening; run the test in an environment permitting temporary localhost listeners. A bounded real headless Chrome pass verified default expansion, all 35 exact Collect children and the Compile Evidence descendant, selection of a genuine algorithm, exact captured critiques, flow selection, browser-local saving and an actual export download. This is a bounded interaction smoke, not comprehensive usability verification. Screenshots and the detailed receipt are retained in the handoff evidence outside the repository.
