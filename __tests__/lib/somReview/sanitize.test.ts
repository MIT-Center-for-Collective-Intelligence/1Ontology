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
      expect(serialized).not.toMatch(/\bH\d+\s*(?::|not\s+run\b)/i);
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
    expect(card.reviewerView.proposedState).toBe(
      'Record "Sell merchandise" as a synonym of "Sell products".',
    );
    expect(card.reviewerView.proposedState).not.toMatch(
      /merge|delete|downstream/i,
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

  it("replaces ambiguous placement copy with a clear current-parent decision", () => {
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
      question: 'Is "Sell Service" misplaced under "Sell (Information)"?',
      currentState: '"Sell Service" is currently under "Sell (Information)".',
      proposedState:
        '"Sell Service" does not belong under "Sell (Information)".',
      agreeLabel: "Yes, misplaced",
      disagreeLabel: "No, keep here",
    });
    expect(JSON.stringify(card)).not.toMatch(
      /advisory candidate home|exact move remains|separate human decision|actors and activities|H1/i,
    );
    expect(card.reviewerView.reasoning).toBe(
      "A service is an activity rather than information.",
    );
    expect(card.reviewerView.context).not.toHaveProperty("candidateHome");
    expect(card.reviewerView.context).toMatchObject({ currentBucket: "" });
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
