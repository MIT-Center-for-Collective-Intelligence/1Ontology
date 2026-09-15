# Comparing saved title-clarification results

Open `/title-prompt-study` from **Compare title prompts** on `/review`.
Choose one of the 18 titles, then select an O*NET description to see where
all three versions place it. Desktop shows all versions beside each other;
compact screens have version buttons and a shared placement summary.
Descriptions can be searched by their wording or number. Existing `#case-N`
links and links from the original review cards select the same example.

This page compares the saved September 2 v6 results (GPT-5.6 Sol) with
Rob's saved September 13 prompt study (GPT-6 Astra), and his revised prompt
supplied September 14 (GPT-6 Astra, Max reasoning). The September 14 run uses
Rob's previously clarified target of 5–9 descriptions per new group, allowing
exceptions. The display preserves 61, 72, and 39 proposed groups respectively,
including the original observations. The v6 comparison changes both prompt
and model, and none of these counts establishes accuracy. Historical answers
are not rerun or rewritten when a new prompt is added.

The adapter joins proposals and keep controls only when the occurrence
identifier, original title, and every numbered source description match.
The third run must also match every input, source identity, and description
of the September 13 study before the page can build.
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
