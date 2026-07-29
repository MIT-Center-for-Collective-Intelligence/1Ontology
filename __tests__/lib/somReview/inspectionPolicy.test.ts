import {
  confidenceAuthorizesOntologyMutation,
  inspectionRecordSource,
} from "../../../src/lib/somReview/inspectionPolicy";

describe("inspection policy", () => {
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
});
