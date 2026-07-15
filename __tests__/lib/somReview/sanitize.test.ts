import { loadDataset } from "../../../src/lib/somReview/dataset";
import {
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
        proposedState: "Record a synonym judgment.",
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
        reasoning: "A service is an activity rather than information.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Sell Service",
          currentParentTitle: "Sell (Information)",
          currentBucket: "Information",
          candidateHome: "Actors and Activities",
          placementIssue: "wrong-bucket",
        },
      },
    });

    expect(card.reviewerView).toMatchObject({
      question: 'Is "Sell Service" misplaced under "Sell (Information)"?',
      currentState:
        '"Sell Service" is currently under "Sell (Information)" in the "Information" category.',
      proposedState:
        '"Sell Service" does not belong under "Sell (Information)". Possible new home to review next: "Actors and Activities".',
      agreeLabel: "Yes, misplaced",
      disagreeLabel: "No, keep here",
    });
    expect(JSON.stringify(card)).not.toMatch(
      /advisory candidate home|exact move remains|separate human decision/i,
    );
  });
});
