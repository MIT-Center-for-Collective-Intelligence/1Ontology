import { SomDataset } from "../../../src/lib/somReview/dataset";
import {
  CarryForwardResponseRecord,
  carryForwardResponseRecords,
  responseCarryForwardSources,
} from "../../../src/lib/somReview/responseCarryForward";

const dataset = {
  manifest: {
    responseCarryForward: {
      schemaVersion: "som-response-carry-forward-v1",
      mappings: [
        {
          sourceProposalId: "old-move",
          sourceIssueType: "relocation",
          targetProposalId: "one-step-move",
          targetIssueType: "cross-branch-recall",
          subjectTitle: "Rent Equipment",
        },
      ],
    },
  },
  recordsById: new Map([["one-step-move", {}]]),
} as Pick<SomDataset, "manifest" | "recordsById">;

describe("review-response carry-forward", () => {
  it("projects an exact retired move response without losing its correction", () => {
    const [response] = carryForwardResponseRecords(dataset, [
      {
        proposalId: "old-move",
        issueType: "relocation",
        reviewerId: "reviewer-1",
        response: {
          proposalId: "old-move",
          decision: "disagree",
          disagreementReason: "Move only two descendants.",
          suggestedCorrection: "Keep the third descendant under Lease.",
        },
      },
    ]);

    expect(response).toMatchObject({
      proposalId: "one-step-move",
      issueType: "cross-branch-recall",
      carriedForwardFromProposalId: "old-move",
      response: {
        proposalId: "one-step-move",
        decision: "disagree",
        disagreementReason: "Move only two descendants.",
        suggestedCorrection: "Keep the third descendant under Lease.",
      },
    });
  });

  it("prefers a response saved directly on the current proposal", () => {
    const responses = carryForwardResponseRecords(dataset, [
      {
        proposalId: "one-step-move",
        issueType: "cross-branch-recall",
        reviewerId: "reviewer-1",
        response: { decision: "agree" },
      },
      {
        proposalId: "old-move",
        issueType: "relocation",
        reviewerId: "reviewer-1",
        response: { decision: "disagree" },
      },
    ]);

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      proposalId: "one-step-move",
      response: { decision: "agree" },
    });
    expect(
      (responses[0] as CarryForwardResponseRecord).carriedForwardFromProposalId,
    ).toBeUndefined();
  });

  it("returns the retired source ID for an editable inherited answer", () => {
    expect(responseCarryForwardSources(dataset, "one-step-move")).toEqual([
      "old-move",
    ]);
  });
});
