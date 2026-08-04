import {
  confidenceAuthorizesOntologyMutation,
  inspectableReviewerCounts,
  inspectionRecordSource,
  inspectionSubjectAllowed,
} from "../../../src/lib/somReview/inspectionPolicy";

describe("inspection policy", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("exposes only Rob's expert review as the meta-review subject", () => {
    expect(
      inspectionSubjectAllowed({
        reviewerId: "vFCAkxKTwjcDKohmiWfiZWz2lZf1",
      }),
    ).toBe(true);
    expect(
      inspectionSubjectAllowed({
        reviewerId: "another-rob-account",
        email: "rjl@mit.edu",
        emailVerified: true,
      }),
    ).toBe(true);
    expect(
      inspectionSubjectAllowed({
        reviewerId: "development-reviewer",
        email: "oneman@mit.edu",
        emailVerified: true,
      }),
    ).toBe(false);
    expect(
      inspectionSubjectAllowed({
        reviewerId: "unverified-account",
        email: "rjl@mit.edu",
        emailVerified: false,
      }),
    ).toBe(false);
  });

  it.each([
    ["proposed-change", "proposed-change"],
    ["status-quo-audit", "status-quo-audit"],
    ["manual-check", "manual-check"],
  ])("classifies %s records independently of confidence", (mode, expected) => {
    expect(
      inspectionRecordSource({
        reviewMode: mode,
        internalModelEvidence: {
          detectorConfidence: "low",
          judgeConfidence: "high",
        },
      }),
    ).toBe(expected);
  });

  it.each([
    ["high", "high"],
    ["high", "low"],
    ["low", "high"],
    ["", ""],
  ])(
    "never treats %s/%s confidence as mutation authorization",
    (detectorConfidence, judgeConfidence) => {
      expect(
        confidenceAuthorizesOntologyMutation(
          detectorConfidence,
          judgeConfidence,
        ),
      ).toBe(false);
    },
  );

  it("counts only responses that still resolve to a proposal card", () => {
    const counts = inspectableReviewerCounts([
      {
        proposalIds: new Set(["proposal-1", "proposal-2"]),
        responses: [
          { proposalId: "proposal-1", reviewerId: "rob" },
          { proposalId: "proposal-2", reviewerId: "rob" },
          { proposalId: "orphaned", reviewerId: "rob" },
          { proposalId: "proposal-1", reviewerId: "tom" },
        ],
      },
    ]);

    expect([...counts.entries()]).toEqual([
      ["rob", 2],
      ["tom", 1],
    ]);
  });
});
