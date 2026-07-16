import { SomDataset } from "../../../src/lib/somReview/dataset";
import {
  applicableReviewResponses,
  remainingIndependentReviewCount,
  WorkflowResponseRecord,
} from "../../../src/lib/somReview/reviewWorkflow";

const dataset = {
  datasetVersion: "dataset-1",
  manifest: {},
  recordsById: new Map([
    [
      "diagnosis",
      {
        proposalId: "diagnosis",
        workflow: { dependsOnProposalIds: [] },
      },
    ],
    [
      "action",
      {
        proposalId: "action",
        workflow: { dependsOnProposalIds: ["diagnosis"] },
      },
    ],
  ]),
  orderedIdsByIssue: new Map(),
  issueLabels: new Map(),
} as SomDataset;

const response = (
  proposalId: string,
  decision: "agree" | "disagree",
  reviewerId = "reviewer-1",
): WorkflowResponseRecord => ({
  proposalId,
  reviewerId,
  response: { decision },
});

describe("Society of Mind dependent review workflow", () => {
  it("stops counting a stale action answer after its diagnosis is rejected", () => {
    const responses = [
      response("diagnosis", "disagree"),
      response("action", "agree"),
    ];

    expect(
      applicableReviewResponses(dataset, responses).map(
        (item) => item.proposalId,
      ),
    ).toEqual(["diagnosis"]);
    expect(
      remainingIndependentReviewCount(dataset, "reviewer-1", responses),
    ).toBe(0);
  });

  it("counts an unlocked action until it receives an answer", () => {
    const responses = [response("diagnosis", "agree")];

    expect(
      remainingIndependentReviewCount(dataset, "reviewer-1", responses),
    ).toBe(1);
  });

  it("keeps reviewers' prerequisite decisions isolated", () => {
    const responses = [
      response("diagnosis", "disagree", "reviewer-1"),
      response("action", "agree", "reviewer-1"),
      response("diagnosis", "agree", "reviewer-2"),
      response("action", "agree", "reviewer-2"),
    ];

    expect(
      applicableReviewResponses(dataset, responses).map(
        (item) => `${item.reviewerId}:${item.proposalId}`,
      ),
    ).toEqual([
      "reviewer-1:diagnosis",
      "reviewer-2:diagnosis",
      "reviewer-2:action",
    ]);
  });
});
