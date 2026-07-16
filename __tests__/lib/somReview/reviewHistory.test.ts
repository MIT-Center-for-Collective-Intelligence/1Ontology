import { orderedReviewEntries } from "../../../src/lib/somReview/reviewHistory";

describe("Society of Mind review history", () => {
  it("keeps responses from earlier and later sessions in stable issue order", () => {
    const orderedProposalIds = Array.from(
      { length: 15 },
      (_, index) => `proposal-${index + 1}`,
    );
    const responses = new Map([
      ["proposal-2", { decision: "agree" }],
      ["proposal-10", { decision: "disagree" }],
      ["proposal-11", { decision: "agree" }],
      ["proposal-15", { decision: "agree" }],
    ]);

    expect(orderedReviewEntries(orderedProposalIds, responses)).toEqual([
      {
        proposalId: "proposal-2",
        proposalIndex: 1,
        response: { decision: "agree" },
      },
      {
        proposalId: "proposal-10",
        proposalIndex: 9,
        response: { decision: "disagree" },
      },
      {
        proposalId: "proposal-11",
        proposalIndex: 10,
        response: { decision: "agree" },
      },
      {
        proposalId: "proposal-15",
        proposalIndex: 14,
        response: { decision: "agree" },
      },
    ]);
  });
});
