import {
  inspectionTaskKey,
  inspectionTasks,
  selectInspectionReviewer,
} from "../../../src/lib/somReview/inspectionPolicy";
import { SomInspectionItem } from "../../../src/types/ISomReview";

const inspectionItem = (
  proposalId: string,
  decision: "agree" | "disagree",
  exception = false,
): SomInspectionItem => ({
  datasetId: "sell-round",
  datasetLabel: "Sell round",
  currentRound: true,
  issueLabel: "1. Recall related activities",
  proposalIndex: 0,
  recordSource: "proposed-change",
  currentlyApplicable: true,
  card: {
    proposalId,
    datasetVersion: "sell-round-v1",
    branch: "Sell",
    issueType: "placement",
    reviewerView: {
      question: proposalId,
      currentState: "Before",
      proposedState: "After",
      reasoning: "Reason",
      context: {
        type: "placement-comparison",
        nodeTitle: "Rent out",
        currentParentTitle: "Buy",
        candidateHome: "Sell",
        placementIssue: "wrong-parent",
      },
      agreeLabel: "Agree",
      disagreeLabel: "Disagree",
    },
  },
  subjectResponse: {
    decision,
    disagreementReason: "",
    suggestedCorrection: "",
    reviewedAt: "2026-07-29T12:00:00.000Z",
  },
  ...(exception
    ? {
        exception: {
          datasetVersion: "sell-round-v1",
          proposalId,
          subjectReviewerId: "rob",
          inspectorId: "tom",
          rationale: "Discuss",
          suggestedAlternative: "",
          updatedAt: "2026-07-29T12:30:00.000Z",
        },
      }
    : {}),
});

describe("inspection task dashboard", () => {
  it("defaults to the inspector's own review when it is available", () => {
    const reviewers = [
      { reviewerId: "rob", displayName: "Rob", responseCount: 12 },
      { reviewerId: "tom", displayName: "Tom", responseCount: 20 },
    ];

    expect(selectInspectionReviewer(reviewers, undefined, "rob")).toBe("rob");
    expect(selectInspectionReviewer(reviewers, "tom", "rob")).toBe("tom");
    expect(selectInspectionReviewer(reviewers, "missing", "iman")).toBe("rob");
  });

  it("groups completed responses by dataset and issue type", () => {
    const tasks = inspectionTasks([
      inspectionItem("one", "agree"),
      inspectionItem("two", "disagree", true),
    ]);

    expect(tasks).toEqual([
      expect.objectContaining({
        key: inspectionTaskKey("sell-round", "placement"),
        responseCount: 2,
        agreeCount: 1,
        disagreeCount: 1,
        exceptionCount: 1,
        currentlyApplicableCount: 2,
      }),
    ]);
  });
});
