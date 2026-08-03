import {
  inspectionIssueTypeFromTaskKey,
  inspectionTaskKey,
  inspectionTasks,
  selectInspectionReviewer,
} from "../../../src/lib/somReview/inspectionPolicy";
import { SomInspectionItem } from "../../../src/types/ISomReview";

const inspectionItem = (
  proposalId: string,
  decision: "agree" | "disagree",
  exception = false,
  round: {
    datasetId?: string;
    datasetLabel?: string;
    currentRound?: boolean;
  } = {},
): SomInspectionItem => ({
  datasetId: round.datasetId || "sell-round",
  datasetLabel: round.datasetLabel || "Sell round",
  currentRound: round.currentRound ?? true,
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

  it("keeps old round-specific inspection links usable", () => {
    expect(
      inspectionIssueTypeFromTaskKey("sell-initial-review::duplicate-synonym"),
    ).toBe("duplicate-synonym");
    expect(inspectionIssueTypeFromTaskKey("issue::placement")).toBe(
      "placement",
    );
  });

  it("combines the same decision type across review rounds", () => {
    const tasks = inspectionTasks([
      inspectionItem("one", "agree"),
      inspectionItem("two", "disagree", true, {
        datasetId: "sell-round-older",
        datasetLabel: "Older Sell round",
        currentRound: false,
      }),
    ]);

    expect(tasks).toEqual([
      expect.objectContaining({
        key: inspectionTaskKey("placement"),
        issueLabel: "Activities under an incorrect parent",
        roundCount: 2,
        datasetIds: ["sell-round", "sell-round-older"],
        responseCount: 2,
        agreeCount: 1,
        disagreeCount: 1,
        exceptionCount: 1,
        currentlyApplicableCount: 2,
      }),
    ]);
  });
});
