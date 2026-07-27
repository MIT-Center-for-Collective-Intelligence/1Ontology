# Ontology Oversight Formative Baseline

Captured: 2026-07-27T23:23:59.000Z

Code revision: `28b0b12ab3f620f003e553e663970c4e3f9aea15` on `codex/instrumented-ontology-pilot`

> This is a descriptive export of operational pilot data. It is not a
> preregistered or confirmatory study result, and proposal acceptance is not
> equivalent to correctness.

## Branch summary

| Branch | Rounds | Recorded | Matched | Orphaned | Agree | Disagree | Acceptance | Edits | Undos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Buy | 3 | 40 | 40 | 0 | 40 | 0 | 100% | 0 | 0 |
| Sell | 6 | 216 | 202 | 14 | 179 | 37 | 83% | 6 | 0 |

## Dataset timeline

| Branch | Dataset version | Records | Recorded | Matched | Orphaned | Reviewers | Acceptance | Timed | Median |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sell | `sell-final-hierarchy-onet-2026-07-15-v4` | 142 | 122 | 108 | 14 | 4 | 84% | 100% | 10.5s |
| Sell | `sell-rob-title-applied-title-pass-2026-07-22-v1` | 4 | 8 | 8 | 0 | 2 | 100% | 100% | 7.3s |
| Sell | `sell-rob-title-v2-downstream-2026-07-23-v2` | 137 | 18 | 18 | 0 | 2 | 83% | 100% | 10.4s |
| Sell | `sell-rob-content-wave-2026-07-24-v1` | 128 | 6 | 6 | 0 | 2 | 100% | 100% | 17.2s |
| Sell | `sell-rob-structure-wave-2026-07-24-v1` | 123 | 50 | 50 | 0 | 1 | 72% | 100% | 9.1s |
| Sell | `sell-rob-post-structure-2026-07-25-v1` | 65 | 12 | 12 | 0 | 1 | 100% | 100% | 860.6s |
| Buy | `buy-exploratory-transfer-2026-07-25-v1` | 53 | 20 | 20 | 0 | 2 | 100% | 100% | 1.8s |
| Buy | `buy-title-followup-after-initial-review-2026-07-25-v1` | 21 | 6 | 6 | 0 | 2 | 100% | 100% | 11.4s |
| Buy | `buy-content-identity-after-title-followup-2026-07-26-v1` | 58 | 14 | 14 | 0 | 1 | 100% | 100% | 14.3s |

## Buy snapshot evolution

254 nodes and 320 edges became 252 nodes and 320 edges.

Comparison method: Normalized title and parent-collection-child signatures; node IDs are not compared across ontology copies.

### Added or newly titled nodes

- Cash Money Order
- Purchase Advertising Space
- Purchase Advertising Time
- Purchase Artwork
- Purchase Surface Finish
- Purchase Wardrobe Necessity
- Purchase Web Address
- Rent Wardrobe Necessity
- Shop for Meals
- Staff Organizational Unit
- Subcontract Interior Arrangement
- Subcontract Interior Fabrication
- ...and 1 more in the JSON export.

### Removed or replaced titles

- Cash Order
- Perform (action) (Information)
- Provide Service (1)
- Purchase Address
- Purchase Finish
- Purchase Necessity
- Purchase Space
- Purchase Time
- Purchase Work
- Rent Necessity
- Shop Meal
- Staffing Unit
- ...and 3 more in the JSON export.

### Added structural links

- Buy (Information) > [main] > Purchase Advertising Space
- Buy (Information) > [main] > Purchase Advertising Time
- Buy (Information) > [main] > Purchase Artwork
- Buy (Information) > [main] > Purchase Web Address
- Buy (Information) > [main] > Shop for Meals
- Buy (Physical Object) > [main] > Cash Money Order
- Buy (Physical Object) > [main] > Purchase Surface Finish
- Buy (Physical Object) > [main] > Purchase Wardrobe Necessity
- Cash Money Order > [main] > (O*Net) 11331 - Cash money orders.
- Cash Money Order > [main] > (O*Net) 5268 - Issue and cash money orders.
- Lease (Physical Object) > [main] > Rent Wardrobe Necessity
- Purchase Advertising Space > [main] > (O*Net) 1774 - Purchase advertising space or time as required to promote client's product or agenda.
- ...and 15 more in the JSON export.

### Removed structural links

- Buy (Information) > [main] > Purchase Address
- Buy (Information) > [main] > Purchase Space
- Buy (Information) > [main] > Purchase Time
- Buy (Information) > [main] > Purchase Work
- Buy (Information) > [main] > Shop Meal
- Buy (Physical Object) > [main] > Cash Order
- Buy (Physical Object) > [main] > Purchase Finish
- Buy (Physical Object) > [main] > Purchase Necessity
- Cash Order > [main] > (O*Net) 11331 - Cash money orders.
- Cash Order > [main] > (O*Net) 5268 - Issue and cash money orders.
- Lease (Physical Object) > [main] > Rent Necessity
- Purchase Address > [main] > (O*Net) 15724 - Devise, select, or purchase domain name and web address.
- ...and 15 more in the JSON export.

## Sell snapshot evolution

115 nodes and 146 edges became 127 nodes and 156 edges.

Comparison method: Normalized title and parent-collection-child signatures; node IDs are not compared across ontology copies.

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
- ...and 41 more in the JSON export.

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
- ...and 29 more in the JSON export.

### Added structural links

- Sell > [main] > Sell Products
- Sell > [Sell what kind of usage?] > Sell ownership
- Sell > [Sell what kind of usage?] > Sell temporary use
- Sell Accessories > [main] > (O*Net) 10725 - Sell and install accessories, such as batteries, windshield wiper blades, fan belts, bulbs, or headlamps.
- Sell Accessories > [main] > (O*Net) 13028 - Develop a group of products or accessories, and market them through venues such as boutiques or mail-order catalogs.
- Sell Accessories > [main] > (O*Net) 20917 - Sell bicycles and accessories.
- Sell Admission Passes > [main] > (O*Net) 20764 - Sell or collect admission tickets, passes, or facility memberships from patrons at entertainment events.
- Sell Agricultural Products > [main] > (O*Net) 4.A.4.a.6.I02.D02 - Sell agricultural products.
- Sell Agricultural Supplies > [main] > (O*Net) 12887 - Sell supplies, such as seed, feed, fertilizers, or insecticides, arranging for loans or financing as necessary.
- Sell Alcoholic Beverages > [main] > (O*Net) 9659 - Sell alcoholic beverages to passengers.
- Sell Beverages > [main] > (O*Net) 8026 - Sell food, beverages, or tobacco to players.
- Sell Beverages > [main] > Sell Alcoholic Beverages
- ...and 121 more in the JSON export.

### Removed structural links

- Market Artwork > [main] > (O*Net) 20990 - Market artwork through brochures, mailings, or Web sites.
- Market Casino > [main] > (O*Net) 20472 - Market or promote the casino to bring in business.
- Market Event > [main] > (O*Net) 4.A.4.a.6.I03.D04 - Market products, services, or events.
- Market Product > [main] > (O*Net) 13028 - Develop a group of products or accessories, and market them through venues such as boutiques or mail-order catalogs.
- Market Product > [main] > (O*Net) 3421 - Market bank products to individuals and firms, promoting bank services that may meet customers' needs.
- Market Product > [main] > (O*Net) 4.A.4.a.6.I03.D04 - Market products, services, or events.
- Market Space > [main] > (O*Net) 7231 - Market vacant space to prospective tenants through leasing agents, advertising, or other methods.
- Sell (Information) > [main] > Market Artwork
- Sell (Information) > [main] > Market Casino
- Sell (Information) > [main] > Market Event
- Sell (Information) > [main] > Market Product
- Sell (Information) > [main] > Sell Bond
- ...and 111 more in the JSON export.

## Instrumentation status

- Current judgments, save/edit/undo revisions, and sessions were exported read-only from Firestore.
- Recorded, matchable, and orphaned judgments are reported separately; no historical response is silently dropped.
- Reviewer labels are one-way pseudonyms; raw reviewer IDs and email addresses are excluded.
- Elapsed time is wall-clock card time, not verified active attention. Values over 30 minutes are flagged.
- Dataset, snapshot, prompt-evidence, agent, review code, and exporter files are SHA-256 inventoried.
- The current production UI remains the operational reviewer surface. Research summaries remain separate.

## Interpretation limits

- These rounds were used to improve prompts, dependencies, hierarchy state, and interface behavior.
- Reviewers did not receive randomized conditions, independent evidence-only and rationale stages, or a frozen confirmatory protocol.
- Repeated judgments across regenerated ontology copies are not independent observations.
- Agreement records whether a reviewer accepted a proposal, not whether the proposal is objectively correct.
- The semantic snapshot diff uses normalized titles and edge labels because cloned ontology copies do not share node IDs.

