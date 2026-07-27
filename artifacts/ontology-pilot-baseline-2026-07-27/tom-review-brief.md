# Tom Review Package: Sell Ontology Pilot

## Purpose

This package supports an independent inspection of the current Sell hierarchy,
followed by a review of how the expert-guided LLM workflow reached it. The
sequence matters: seeing the prior expert's answers first would anchor the new
review and erase the independent comparison the team wants.

## Recommended review sequence

1. Open the production review app and select the Sell workspace.
2. Expand the current hierarchy without opening the disagreement appendix.
3. Record anything unclear, misplaced, duplicated, missing, or grouped at the wrong granularity.
4. Compare the original and current outlines side by side.
5. Only then open `expert-steward-disagreements.md` and compare the earlier expert's reasoning with your independent notes.
6. In the meeting, classify differences as agent error, reviewer error, missing evidence, policy ambiguity, or legitimate alternative organization.

Production review surface: https://ontology.mit.edu/review?dataset=sell-current

## What is frozen for this review

- Current Sell dataset: `sell-rob-post-structure-2026-07-25-v1`
- Baseline Sell dataset: `sell-final-hierarchy-onet-2026-07-15-v4`
- Code revision: `6a0cc8cdbf46416c53faf253d8cd286c0c365663`
- Capture time: 2026-07-27T23:21:35.000Z

## Structural scan

115 nodes and 146 links became 127 nodes and 156 links.

This is a title-and-link comparison rather than an ID diff because each applied
review cycle created a new ontology copy.

### Added or newly titled nodes

- Promote
- Sell Accessories
- Sell Admission Passes
- Sell Agricultural Products
- Sell Agricultural Supplies
- Sell Alcoholic Beverages
- Sell Beverages
- Sell Bicycle Accessories
- Sell Bicycles
- Sell Commodity Futures
- Sell Cosmetic Supplies
- Sell Cosmetics
- Sell Expedition Clothing
- Sell Expedition Equipment
- Sell Expedition Products
- Sell Expedition Supplies
- Sell Eyewear and Eye-Care Products
- Sell Financial Derivatives
- Sell Financial Products
- Sell Food and Beverages
- ...and 33 more in the JSON export.

### Removed or replaced titles

- (O*Net) 20472 - Market or promote the casino to bring in business.
- (O*Net) 20990 - Market artwork through brochures, mailings, or Web sites.
- (O*Net) 3421 - Market bank products to individuals and firms, promoting bank services that may meet customers' needs.
- (O*Net) 7231 - Market vacant space to prospective tenants through leasing agents, advertising, or other methods.
- Lease out
- Market Artwork
- Market Casino
- Market Event
- Market Product
- Market Space
- Sell (Information)
- Sell (Physical Object)
- Sell Accessory
- Sell Beverage
- Sell Bicycle
- Sell Check
- Sell Chip
- Sell Clothing
- Sell Contract
- Sell Currency
- ...and 21 more in the JSON export.

## Expert review trace by round

| Dataset version | Recorded | Matched | Orphaned | Agree | Disagree | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| `sell-final-hierarchy-onet-2026-07-15-v4` | 45 | 43 | 2 | 33 | 12 | 73% |
| `sell-rob-title-applied-title-pass-2026-07-22-v1` | 4 | 4 | 0 | 4 | 0 | 100% |
| `sell-rob-title-v2-downstream-2026-07-23-v2` | 16 | 16 | 0 | 13 | 3 | 81% |
| `sell-rob-content-wave-2026-07-24-v1` | 4 | 4 | 0 | 4 | 0 | 100% |
| `sell-rob-structure-wave-2026-07-24-v1` | 50 | 50 | 0 | 36 | 14 | 72% |
| `sell-rob-post-structure-2026-07-25-v1` | 0 | 0 | 0 | 0 | 0 | n/a |

The table separates judgments that still match the frozen dataset from historical responses whose source record is no longer present.

The complete aggregate metrics are in `study-baseline.md`; the machine-readable
file is `study-baseline.json`. The disagreement appendix intentionally omits
reviewer identity and should remain closed until the independent hierarchy scan
is complete.

## Meeting decisions

1. Which remaining Sell issues require prompt changes versus local corrections?
2. Which task families can a nonexpert review reliably enough to reduce expert time?
3. Which disagreements are legitimate alternatives that the system should preserve?
4. What far-transfer branch, unlike the near-mirror Buy branch, will test generalization?
5. What smallest paid pilot can estimate value per minute for LLM, nonexpert, and expert oversight?

