import { loadDataset } from "../../../src/lib/somReview/dataset";
import {
  reviewerQuestion,
  sanitizeReasoning,
  toReviewerCard,
} from "../../../src/lib/somReview/sanitize";

describe("Society of Mind reviewer card blinding", () => {
  const dataset = loadDataset();

  it("serves non-empty neutral questions for every dataset record", () => {
    for (const record of dataset.recordsById.values()) {
      const card = toReviewerCard(record);
      expect(card.reviewerView.question.trim()).not.toBe("");
      expect(card.reviewerView.question).not.toMatch(/\bagents?\b/i);
    }
  });

  it("never serves internal model or critic metadata", () => {
    for (const record of dataset.recordsById.values()) {
      const serialized = JSON.stringify(toReviewerCard(record));
      expect(serialized).not.toMatch(
        /internalModelEvidence|detector|judge|promptVersion|rolloutStatus/i,
      );
      expect(serialized).not.toMatch(/\b[HJ]\d+\s*(?::|not\s+run\b)/i);
    }
  });

  it("removes trailing internal critic output while preserving reasoning", () => {
    expect(
      sanitizeReasoning(
        "The activity transfers temporary use. H6: other - Internal detail.",
      ),
    ).toBe("The activity transfers temporary use.");
    expect(
      sanitizeReasoning(
        "The four children share a purpose. H2 not run: too few contrasts.",
      ),
    ).toBe("The four children share a purpose.");
  });

  it("constructs duplicate questions without exposing merge operations", () => {
    const card = toReviewerCard({
      proposalId: "duplicate-example",
      datasetVersion: dataset.datasetVersion,
      issueType: "duplicate-synonym",
      reviewerView: {
        currentState: "Two nodes exist.",
        proposedState:
          "Record a synonym judgment. Any merge is a separate downstream task.",
        reasoning: "The titles have the same meaning.",
        context: {
          type: "duplicate-comparison",
          parentTitle: "Sell",
          canonicalTitle: "Sell products",
          candidateSynonymTitle: "Sell merchandise",
        },
      },
    });
    expect(card.reviewerView.question).toBe(
      'Do "Sell products" and "Sell merchandise" name the same activity?',
    );
    expect(card.reviewerView.question).not.toMatch(/merge|delete/i);
    expect(card.reviewerView.currentState).toBe(
      '"Sell products" and "Sell merchandise" are currently represented as separate activity nodes.',
    );
    expect(card.reviewerView.proposedState).toBe(
      'If they name the same activity, keep "Sell products" as the node title and record "Sell merchandise" as its synonym. The exact consolidation is reviewed separately.',
    );
    expect(card.reviewerView.proposedState).not.toMatch(
      /merge|delete|downstream/i,
    );
  });

  it("names the mistaken synonym in recorded-synonym removal questions", () => {
    expect(
      reviewerQuestion({
        type: "metadata-edit",
        nodeTitle: "Sell Service",
        field: "synonyms",
        synonymScope: "all-recorded",
        currentValues: ["Market Service", "Sell"],
        proposedValues: ["Sell"],
      }),
    ).toBe(
      'Should "Market Service" be removed as a synonym of "Sell Service"?',
    );
  });

  it("states the complete grouping change in the reviewer question", () => {
    expect(
      reviewerQuestion({
        type: "grouping-outline",
        parentTitle: "Sell (Physical Object)",
        structure: "intermediate",
        proposedGroupTitle: "Sell Apparel and Adornment",
        proposedChildren: ["Sell Accessory", "Sell Clothing", "Sell Jewelry"],
        unaffectedChildren: ["Sell Beverage"],
      }),
    ).toBe(
      'Should the new grouping "Sell Apparel and Adornment" be created under "Sell (Physical Object)" with the highlighted children under it?',
    );
  });

  it("combines a placement finding with its exact destination", () => {
    const card = toReviewerCard({
      proposalId: "placement-example",
      datasetVersion: dataset.datasetVersion,
      issueType: "placement",
      reviewerView: {
        currentState: "Legacy current-state copy.",
        proposedState:
          "Advisory candidate home: Actors and Activities. The exact move remains a separate human decision.",
        reasoning:
          "A service is an activity rather than information. Actors and Activities is the proposed destination. H1: high confidence.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Sell Service",
          currentParentTitle: "Sell (Information)",
          currentBucket: "main",
          candidateHome: "Actors and Activities",
          placementIssue: "wrong-bucket",
        },
      },
    });

    expect(card.reviewerView).toMatchObject({
      question:
        'Is "Sell Service" better placed under the more specific category "Actors and Activities" than under "Sell (Information)"?',
      currentState: '"Sell Service" is currently under "Sell (Information)".',
      proposedState:
        '"Sell Service" appears to belong under the more specific category "Actors and Activities".',
      agreeLabel: "Approve move",
      disagreeLabel: "Reject proposed move",
    });
    expect(JSON.stringify(card)).not.toMatch(
      /advisory candidate home|exact move remains|separate human decision|H1/i,
    );
    expect(card.reviewerView.reasoning).toBe(
      "A service is an activity rather than information.",
    );
    expect(card.reviewerView.context).toMatchObject({
      currentBucket: "",
      candidateHome: "Actors and Activities",
    });
  });

  it("preserves exact paths and action wording for a missing-node move", () => {
    const card = toReviewerCard({
      proposalId: "missing-node-example",
      datasetVersion: dataset.datasetVersion,
      branch: "Sell",
      issueType: "cross-branch-recall",
      reviewerView: {
        currentState: "Legacy current state.",
        proposedState: "Legacy proposed state.",
        reasoning: "The source task rents equipment to customers.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Rent Equipment",
          currentParentTitle: "Lease (Physical Object)",
          candidateHome: "Rent out",
          currentPathTitles: [
            "Buy",
            "Rent (pay for time-limited use)",
            "Lease (Physical Object)",
            "Rent Equipment",
          ],
          proposedPathTitles: [
            "Sell",
            "Sell temporary use",
            "Rent out",
            "Rent Equipment",
          ],
          placementIssue: "missing-from-branch",
        },
      },
    });

    expect(card.reviewerView).toMatchObject({
      question:
        'Should "Rent Equipment" move from "Lease (Physical Object)" to "Rent out" in the Sell sub-branch?',
      proposedState:
        'Move "Rent Equipment" to "Rent out" because its evidence expresses a provider-side "Sell" action.',
      agreeLabel: "Approve move",
      disagreeLabel: "Reject proposed move",
      context: {
        currentPathTitles: [
          "Buy",
          "Rent (pay for time-limited use)",
          "Lease (Physical Object)",
          "Rent Equipment",
        ],
        proposedPathTitles: [
          "Sell",
          "Sell temporary use",
          "Rent out",
          "Rent Equipment",
        ],
      },
    });
  });

  it("consolidates a shared wrong-verb diagnosis without losing node detail", () => {
    const card = toReviewerCard({
      proposalId: "market-family",
      datasetVersion: dataset.datasetVersion,
      issueType: "wrong-verb",
      reviewerView: {
        reasoning: "Market means promote in these source tasks.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Market Artwork",
          currentParentTitle: "Sell information",
          candidateHome: "Promote",
          sharedAction: "Market",
          affectedNodes: [
            {
              nodeTitle: "Market Artwork",
              currentParentTitle: "Sell information",
            },
            {
              nodeTitle: "Market Vacant Space",
              currentParentTitle: "Sell physical objects",
            },
          ],
          placementIssue: "wrong-verb",
        },
      },
    });

    expect(card.reviewerView).toMatchObject({
      question:
        'Do these 2 activities use "Market" as a different main action from the "Sell" action?',
      proposedState:
        'These activities appear to use "Market" as a different main action from the "Sell" action; "Promote" is the suggested category.',
      agreeLabel: "Approve all moves",
      disagreeLabel: "Review individually",
    });
    expect(card.reviewerView.context).toMatchObject({
      candidateHome: "Promote",
      sharedAction: "Market",
      affectedNodes: [
        { nodeTitle: "Market Artwork" },
        { nodeTitle: "Market Vacant Space" },
      ],
    });
  });

  it("derives action-boundary copy from the dataset branch", () => {
    const card = toReviewerCard({
      proposalId: "buy-boundary",
      datasetVersion: "buy-v1",
      branch: "Buy",
      issueType: "wrong-verb",
      reviewerView: {
        reasoning: "Cashing is a different financial action.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Cash Check",
          currentParentTitle: "Buy information",
          candidateHome: "Convert",
          placementIssue: "wrong-verb",
        },
      },
    });

    expect(card.branch).toBe("Buy");
    expect(card.reviewerView.question).toBe(
      'Does "Cash Check" use a different main action than the "Buy" action?',
    );
    expect(card.reviewerView.proposedState).toContain(
      'does not express the "Buy" action',
    );
    expect(JSON.stringify(card)).not.toMatch(/\bSell\b|selling/i);
  });

  it("removes proposed destinations from a polysemy diagnosis", () => {
    const card = toReviewerCard({
      proposalId: "polysemy-example",
      datasetVersion: dataset.datasetVersion,
      issueType: "polysemy",
      reviewerView: {
        currentState: "One title combines two meanings.",
        proposedState: "Represent the meanings separately.",
        reasoning: "Selling and persuading are distinct activities.",
        context: {
          type: "polysemy-review",
          nodeTitle: "Sell Products or Ideas",
          currentParentTitle: "Sell (Other)",
          sourceTasks: ["Selling or Influencing Others"],
          proposedSenses: [
            {
              title: "Sell Product",
              meaning: "Transfer a product for payment.",
              destination: "Sell (Physical Object)",
            },
            {
              title: "Persuade",
              meaning: "Influence someone to accept an idea.",
              destination: "Persuade",
            },
          ],
        },
      },
    });

    expect(card.reviewerView.context).toMatchObject({
      type: "polysemy-review",
      proposedSenses: [
        { title: "Sell Product", meaning: "Transfer a product for payment." },
        { title: "Persuade", meaning: "Influence someone to accept an idea." },
      ],
    });
    expect(JSON.stringify(card.reviewerView.context)).not.toMatch(
      /destination|Sell \(Physical Object\)/i,
    );
  });

  it("constructs explicit questions for downstream action contexts", () => {
    expect(
      reviewerQuestion({
        type: "merge-action",
        parentTitle: "Sell",
        canonicalTitle: "Rent out",
        canonicalCollection: "main",
        canonicalChildren: [],
        absorbedTitle: "Lease out",
        absorbedCollection: "main",
        absorbedChildren: [],
        resultingChildren: [],
        absorbedBecomesSynonym: true,
      }),
    ).toBe('Should "Lease out" be merged into "Rent out"?');
    expect(
      reviewerQuestion({
        type: "addition-action",
        parentTitle: "Sell (Physical Object)",
        proposedTitle: "Sell Furniture",
        description: "Sell furniture.",
        examples: [],
      }),
    ).toBe(
      'Should the missing activity "Sell Furniture" be added under "Sell (Physical Object)"?',
    );
  });
});
