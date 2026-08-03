# Rob Sell Follow-up Analysis

Date: July 28, 2026

This analysis is bound to snapshot SHA-256
`ec34b54cd9a8a3230f31af8f5efc95997eb5f70e5ff15fc7986a8cf67aa55809`
from `Final Hierarchy with O*Net - Rob Structure Applied 2026-07-25`.
Nothing in this cycle mutated the ontology.

## What the trace established

### Funeral evidence is a dependency defect

O\*NET task 18843 currently has three semantic parents:

- `Sell Funeral Products`
- `Sell Products`
- `Sell Services`

The task-specific product node and the service parent jointly preserve the task's
two meanings. The broad `Sell Products` edge is stale. The title-split
application code now supports an explicit evidence-parent contract that would
retain `Sell Services`, assign `Sell Funeral Products`, and remove
`Sell Products` reciprocally. The change remains unexecuted until represented by
a reviewed proposal ID.

### Miscellaneous versus What? is a policy question

The Sell root currently places `Sell (Other)` in `Sell -- miscellaneous` while
`Sell information`, `Sell service`, and `Sell physical objects` are already
organized by `Sell what?`. A deterministic detector now creates an explicit
collection-design policy item whenever these structures coexist. It never
deletes or folds a collection automatically.

### Semantic placement needs the value being sold

`Sell Insurance Policies` and `Sell Investment Instruments` currently sit below
`Sell information`. The general prompt now distinguishes the document or data
carrier from the entitlement and continuing service obligation being sold. Both
placements are prepared for expert confirmation under `Sell service`.

## Ready for atomic expert proposals

The audit found seven corrections with enough snapshot evidence to formulate
atomic review items:

1. Remove the stale broad product parent from funeral task 18843 while retaining
   its specific product and service meanings.
2. Move insurance policies from information to service.
3. Move investment instruments from information to service.
4. Place bicycles and bicycle accessories under sporting equipment.
5. Place flowers under agricultural products.
6. Place food specialties under food and beverages.
7. Review exact consolidation for gambling chips/tokens and generic
   service/services.

These are not authorized application operations. The dry-run plan explicitly
requires reviewed proposal IDs.

## Questions that must remain open

- `Sell Admission Passes` has evidence that is a subset of `Sell Ticket`, not
  identical evidence. The reviewer should decide synonym versus subtype.
- `Sell Postal Products` has O\*NET evidence while `Sell Postal Supplies` has
  semantic descendants. Inspect both before choosing merge versus grouping.
- `Sell Equipment` and `Sell Items` cannot be merged from broad labels alone.
- Historical note: `Sell temporary use` had only `Rent out`, whose recorded
  synonym is `Lease out`. The wrapper was subsequently found to be an invalid
  activity node created under an overly broad collection-design contract and
  was retired. Future collection design is restricted to assigning existing
  direct children to a named collection; new intermediate nodes require their
  own proposal. Remove a valid semantic wrapper only if the expert confirms no
  additional temporary-use specialization is needed.

## Prompt and pipeline changes

- Production prompts contain no named Sell answers.
- Existing-parent placement is tested before creating new groups.
- Evidence-supported groups may contain two or more members.
- Aesthetic grouping remains prohibited.
- Singular/plural and lexical similarity trigger identity review but do not
  establish identity.
- Valid detector candidates rejected by a critic remain as blinded manual
  checks rather than disappearing.
- Detector and judge confidence remain hidden research metadata and never
  authorize a mutation.

Machine-readable artifacts:

- `artifacts/rob-sell-followup-2026-07-28/followup-audit.json`
- `artifacts/rob-sell-followup-2026-07-28/dry-run-application-plan.json`
- `artifacts/rob-sell-followup-2026-07-28/provenance.json`
