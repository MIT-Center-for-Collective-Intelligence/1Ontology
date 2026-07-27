# Expert Steward Disagreements

> Open this appendix only after the new reviewer has independently inspected
> the current hierarchy. It contains operational pilot judgments, not ground truth.

Reviewer label: expert-steward
Matchable current disagreements across exported rounds: 29
Unmatched historical focus-reviewer responses: 2 (0 disagreements). Their source records are no longer present, so this appendix does not reconstruct their content.


## sell-final-hierarchy-onet-2026-07-15-v4

### Sell Good

- Issue type: `duplicate-synonym`
- Question: Should "Sell Good" be recorded as a synonym of "Sell Product"?
- Agent proposal: Treat "Sell Good" as a synonym of "Sell Product".
- Disagreement reason: "Sell product" is a more general framing in a selling context and thus is preferable to "Sell good"
- Suggested correction: Not recorded.

### Sell Item

- Issue type: `duplicate-synonym`
- Question: Should "Sell Item" be recorded as a synonym of "Sell Product"?
- Agent proposal: Treat "Sell Item" as a synonym of "Sell Product".
- Disagreement reason: Product is a more general term for the activity in question
- Suggested correction: Not recorded.

### Sell Supply

- Issue type: `duplicate-synonym`
- Question: Should "Sell Supply" be recorded as a synonym of "Sell Product"?
- Agent proposal: Treat "Sell Supply" as a synonym of "Sell Product".
- Disagreement reason: "Sell product" is the preferable framing.
- Suggested correction: Not recorded.

### Sell Equipment

- Issue type: `title-clarity`
- Question: The agent judged "Sell Equipment" clear and proposed no change. Is that assessment correct?
- Agent proposal: Keep the current title unchanged.
- Disagreement reason: Sell Equipment is fine when the word appears on its own, without a modifier before it. But when a modifer precedes it, that modifer should be included, for example, Sell Sporting Equipment. And when a phrase follows the word Equipment that gives more information about its nature, that should also be included, for example, Sell Expedition Equipment.
- Suggested correction: Three nodes: Sell Equipment, Sell Sporting Equipment, Sell Expedition Equipment

### Sell Food

- Issue type: `title-clarity`
- Question: The agent judged "Sell Food" clear and proposed no change. Is that assessment correct?
- Agent proposal: Keep the current title unchanged.
- Disagreement reason: Pet food is more specific, would suggest separating that from the more general "Food"
- Suggested correction: Two nodes: Sell Pet Food, Sell Food

### Sell Products or Ideas

- Issue type: `title-clarity`
- Question: The agent judged "Sell Products or Ideas" clear and proposed no change. Is that assessment correct?
- Agent proposal: Keep the current title unchanged.
- Disagreement reason: Sell products involves exchange of money, while Sell ideas is only about persuasion
- Suggested correction: Two nodes: Sell products, Sell ideas

### Sell Item

- Issue type: `title-clarity`
- Question: Is "Sell Other Items" a clearer title for this activity than "Sell Item"?
- Agent proposal: Proposed title: Sell Other Items
- Disagreement reason: The word "other" is not necessary
- Suggested correction: Sell items

### Sell Part

- Issue type: `title-clarity`
- Question: Is "Sell Parts and Equipment" a clearer title for this activity than "Sell Part"?
- Agent proposal: Proposed title: Sell Parts and Equipment
- Disagreement reason: Parts are typically sub-elements of a piece of equipment, while Equipment is the entire item.
- Suggested correction: Two nodes: Sell Parts, Sell Equipment

### Sell Accessory

- Issue type: `title-clarity`
- Question: Is "Sell Product Accessories" a clearer title for this activity than "Sell Accessory"?
- Agent proposal: Proposed title: Sell Product Accessories
- Disagreement reason: Accessories is specific enough to convey the meaning
- Suggested correction: Sell Accessories

### Sell Bicycle

- Issue type: `title-clarity`
- Question: Is "Sell Bicycles and Accessories" a clearer title for this activity than "Sell Bicycle"?
- Agent proposal: Proposed title: Sell Bicycles and Accessories
- Disagreement reason: Bicycles and bicycle accessories are not the same, would suggest breaking this into two separate nodes.
- Suggested correction: Two separate nodes: Sell Bicycles, Sell Bicycle Accessories

### Sell Service (1)

- Issue type: `title-clarity`
- Question: Is "Sell Products or Services" a clearer title for this activity than "Sell Service (1)"?
- Agent proposal: Proposed title: Sell Products or Services
- Disagreement reason: Products can refer to anything sold, while the term Services is more specific
- Suggested correction: Two nodes: Sell products, Sell services

### Sell Product

- Issue type: `title-clarity`
- Question: The agent judged "Sell Product" clear and proposed no change. Is that assessment correct?
- Agent proposal: Keep the current title unchanged.
- Disagreement reason: In cases where product is used without any additional explantion, Sell Product is good, e.g. "Sell products, services, or memberships." But when a modifier precedes the word Product, it should be included, for example, Sell agricultural products or Sell hair care products. And when a list follows the word Product, a modifier should be generated to describe those items, for example, "Products...such as travelers' checks, savings bonds, money orders, and cashier's checks" would be better stated as Sell Financial products.
- Suggested correction: See comment above and redo prompt

## sell-rob-title-v2-downstream-2026-07-23-v2

### Sell Stamps and Money Orders

- Issue type: `compound-object-grouping`
- Question: Should the new grouping "Sell Stamps and Money Orders" be created under "Sell (Physical Object)" with the highlighted children under it?
- Agent proposal: Create Sell Stamps and Money Orders and move the highlighted children beneath it.
- Disagreement reason: I understand the rationale for this merger, but the work involved in undertaking these activities is different. Selling stamps is a simple transaction: the customer makes a payment and received the stamps. Selling a money order is more complex, the customer makes a payment, but the clerk must then fill in the value (the amount that the customer paid plus any fees) in the money order.
- Suggested correction: Two nodes: Sell Stamps, Sell Money Orders

### Sell Merchandise

- Issue type: `duplicate-synonym`
- Question: Should "Sell Merchandise" be recorded as a synonym of "Sell Items"?
- Agent proposal: Treat "Sell Merchandise" as a synonym of "Sell Items".
- Disagreement reason: While Sell Items may be technically correct, it is not the kind of wording that is typically used in work settings, a better usage would be Sell Products.
- Suggested correction: Sell Products

### Lease out

- Issue type: `synonym-enrichment`
- Question: Should the listed synonyms be added to the synonym field for "Lease out"?
- Agent proposal: Add Lease to the synonym field.
- Disagreement reason: The proposal is not a change; Lease out is listed in Before and also in After.
- Suggested correction: Is it possible that the LLM was trying to merge Rent out and Lease out?

## sell-rob-structure-wave-2026-07-24-v1

### Sell Expedition Goods

- Issue type: `compound-object-grouping`
- Question: Should the new grouping "Sell Expedition Goods" be created under "Sell physical objects" with the highlighted children under it?
- Agent proposal: Create Sell Expedition Goods and move the highlighted children beneath it.
- Disagreement reason: For the sake of consistency, it is good to use products to describe a general category like this.
- Suggested correction: Grouping should be named: Sell expedition products

### Sell Stamps and Money Orders

- Issue type: `compound-object-grouping`
- Question: Should the new grouping "Sell Stamps and Money Orders" be created under "Sell physical objects" with the highlighted children under it?
- Agent proposal: Create Sell Stamps and Money Orders and move the highlighted children beneath it.
- Disagreement reason: In the United States, the postal service sells the majority of money orders, so it makes sense that these are grouped together by O*NET. To reflect this, it would be better to name this grouping: Sell postal supplies
- Suggested correction: Sell postal supplies

### Sell Pet Products and Supplies

- Issue type: `compound-object-grouping`
- Question: Should the new grouping "Sell Pet Products and Supplies" be created under "Sell physical objects" with the highlighted children under it?
- Agent proposal: Create Sell Pet Products and Supplies and move the highlighted children beneath it.
- Disagreement reason: A better name for the grouping would be: Pet products
- Suggested correction: Grouping shuould be named: Pet products

### Sell Agricultural Products and Supplies

- Issue type: `compound-object-grouping`
- Question: Should the new grouping "Sell Agricultural Products and Supplies" be created under "Sell physical objects" with the highlighted children under it?
- Agent proposal: Create Sell Agricultural Products and Supplies and move the highlighted children beneath it.
- Disagreement reason: These two items should not be grouped together. Agricultural supplies are the inputs to a farm, while agricultural productrs are the outputs.
- Suggested correction: Two separate nodes, not grouped: Agricultural supplies, Agricultural products

### Sell Travel Packages and Incentives

- Issue type: `compound-object-grouping`
- Question: Should the new grouping "Sell Travel Packages and Incentives" be created under "Sell information" with the highlighted children under it?
- Agent proposal: Create Sell Travel Packages and Incentives and move the highlighted children beneath it.
- Disagreement reason: A better name for the group would be: Sell travel services
- Suggested correction: Group should be named: Sell travel services

### Sell Financial Products

- Issue type: `relocation`
- Question: Should "Sell Financial Products" be moved from "Sell physical objects" to "Sell information"?
- Agent proposal: Move the node, together with its direct children, under "Sell information".
- Disagreement reason: Travelers checks, savings bonds, money orders, and cashier's checks are all embodied in physical objects, but these kinds of financial instruments are typically grouped in an industry called "Financial services," so they would be better classified under Sell service.
- Suggested correction: Parent name: Sell Service

### Market Bank Products

- Issue type: `relocation`
- Question: Should "Market Bank Products" be moved from "Sell information" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products should be a sub-set of the more general verb Promote
- Suggested correction: Change Advertise to Promote

### Market Services

- Issue type: `relocation`
- Question: Should "Market Services" be moved from "Sell information" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products be be place as a sub-set of the more general verb Promote
- Suggested correction: Change Advertise to Promote

### Market Casino

- Issue type: `relocation`
- Question: Should "Market Casino" be moved from "Sell information" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products be be place as a sub-set of the more general verb Promote
- Suggested correction: Change Advertise to Promote

### Market Products

- Issue type: `relocation`
- Question: Should "Market Products" be moved from "Sell information" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products be be place as a sub-set of the more general verb Promote
- Suggested correction: Replace Advertise with Promote

### Sell Products

- Issue type: `relocation`
- Question: Should "Sell Products" be moved from "Sell (Other)" to "Sell physical objects"?
- Agent proposal: Move the node, together with its direct children, under "Sell physical objects".
- Disagreement reason: The term "products" is very general and could potentially refer to both physical objects and services. We should classify items classified such items directly under the overall parent "Sell"
- Suggested correction: Parent should be "Sell"

### Market Vacant Space

- Issue type: `relocation`
- Question: Should "Market Vacant Space" be moved from "Sell physical objects" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products be be place as a sub-set of the more general verb Promote
- Suggested correction: Change Advertise to Promote

### Market Artwork

- Issue type: `relocation`
- Question: Should "Market Artwork" be moved from "Sell information" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products be be place as a sub-set of the more general verb Promote
- Suggested correction: Change Advertise to Promote

### Market Event

- Issue type: `relocation`
- Question: Should "Market Event" be moved from "Sell information" to "Advertise"?
- Agent proposal: Move the node, together with its direct children, under "Advertise".
- Disagreement reason: Marketing is a broader, more general activity than Advertising (the latter is a sub-set of Marketing). Would suggest that Market Bank Products be be place as a sub-set of the more general verb Promote
- Suggested correction: Change Advertise to Promote

