# Comparing saved title-clarification results

Open `/title-prompt-study` from **Compare title prompts** on `/review`.
Choose one of the 18 titles, then select an O*NET description to see where
both versions place it. Desktop shows both versions beside each other;
compact screens have version buttons and a shared placement summary.
Descriptions can be searched by their wording or number. Existing `#case-N`
links and links from the original review cards select the same example.

This page compares the saved September 2 v6 results (GPT-5.6 Sol) with
Rob's saved September 13 prompt study (GPT-6 Astra). Both prompt and model
changed; the display does not isolate prompt effects or establish accuracy.
It preserves the original 61 and 72 proposed groups, including overlaps,
missing assignments, and verb-change observations. It does not rerun the
models or apply subsequent prompt amendments to historical answers.

The adapter joins proposals and keep controls only when the occurrence
identifier, original title, and every numbered source description match.
A mismatch is displayed as unavailable instead of substituting a different
case. Source archives and review responses are never written by this page.

Exact prompts, model versions, funding route, source evidence, software
checks, and original answers remain in collapsible disclosures. Internal
hashes and execution identifiers remain in the committed archives, outside
the reviewer interface. The v6 and v7 dataset links and release locks are
unchanged.

Focused tests cover all 18 archive pairings, altered-source rejection,
overlap preservation, navigation, prompt disclosure, hidden internal
identifiers, and authenticated static-prop forwarding. Run the review Jest
suites and the existing title-prompt-study Node tests before release, then
follow [the deployment procedure](deployment.md). Verify actual production
at desktop and compact widths and compare saved responses and revision
history before and after the release.
