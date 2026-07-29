import {
  SOM_REVIEW_CALIBRATION_RESPONSES,
  SOM_REVIEW_RESPONSES,
} from "../../../src/lib/firestoreClient/collections";
import {
  SOM_CALIBRATION_ASSIGNMENTS,
  releasedCalibrationAssignments,
} from "../../../src/lib/somReview/calibrationAssignments";
import { getDataset } from "../../../src/lib/somReview/dataset";

describe("Society of Mind non-expert calibration assignments", () => {
  it("releases one frozen task set at a time", () => {
    const released = releasedCalibrationAssignments();

    expect(released).toHaveLength(1);
    expect(released[0]).toMatchObject({
      branch: "Sell",
      datasetId: "sell-initial-review",
      issueType: "title-clarity",
      propagationPolicy: "frozen-expert-consensus",
    });
    expect(
      SOM_CALIBRATION_ASSIGNMENTS.filter((assignment) => assignment.released),
    ).toEqual(released);
  });

  it("pins the question set and downstream basis to explicit versions", () => {
    const assignment = releasedCalibrationAssignments()[0];
    const dataset = getDataset(assignment.datasetId);
    const proposalIds =
      dataset.orderedIdsByIssue.get(assignment.issueType) || [];

    expect(dataset.datasetVersion).toBe(assignment.datasetVersion);
    expect(proposalIds).toHaveLength(35);
    expect(
      proposalIds.some(
        (proposalId) =>
          dataset.recordsById.get(proposalId)?.reviewMode ===
          "status-quo-audit",
      ),
    ).toBe(true);
    expect(assignment.consensusSnapshotId).toMatch(
      /^sell-title-consensus-2026-07-22:[a-f0-9]{64}$/,
    );
  });

  it("cannot enter the expert-response propagation collection", () => {
    expect(SOM_REVIEW_CALIBRATION_RESPONSES).not.toBe(SOM_REVIEW_RESPONSES);
  });
});
