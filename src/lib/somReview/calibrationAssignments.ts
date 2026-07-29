import { SomIssueType } from "../../types/ISomReview";

export interface SomCalibrationAssignmentConfig {
  id: string;
  title: string;
  branch: string;
  taskLabel: string;
  introduction: string;
  datasetId: string;
  datasetVersion: string;
  issueType: SomIssueType;
  consensusSnapshotId: string;
  propagationPolicy: "frozen-expert-consensus";
  releasedAt: string;
  released: boolean;
}

/**
 * Calibration waves are deliberately released one at a time. Adding a later
 * wave requires an explicit, versioned expert-consensus snapshot; participant
 * responses are never a propagation source.
 */
export const SOM_CALIBRATION_ASSIGNMENTS: SomCalibrationAssignmentConfig[] = [
  {
    id: "sell-title-clarity-calibration-2026-07-28-v1",
    title: "Sell ontology calibration",
    branch: "Sell",
    taskLabel: "Activity-title review",
    introduction:
      "You will compare current ontology activity titles with proposed revisions. Review each item on its own meaning and evidence. Agree when the proposal is clearer without changing the activity; otherwise explain the problem and, if possible, suggest a better alternative.",
    datasetId: "sell-initial-review",
    datasetVersion: "sell-final-hierarchy-onet-2026-07-15-v4",
    issueType: "title-clarity",
    consensusSnapshotId:
      "sell-title-consensus-2026-07-22:02d4204c5d431d4e725b3e3df9492b5970480adfafda8e663ee23b0a4eecedac",
    propagationPolicy: "frozen-expert-consensus",
    releasedAt: "2026-07-28T00:00:00.000Z",
    released: true,
  },
];

export const releasedCalibrationAssignments = () =>
  SOM_CALIBRATION_ASSIGNMENTS.filter((assignment) => assignment.released);

export const calibrationAssignmentConfig = (
  assignmentId: string,
): SomCalibrationAssignmentConfig => {
  const assignment = SOM_CALIBRATION_ASSIGNMENTS.find(
    (candidate) => candidate.id === assignmentId && candidate.released,
  );
  if (!assignment) throw new Error("Unknown calibration assignment");
  return assignment;
};
