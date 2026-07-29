import { SomInspectionRecordSource } from "../../types/ISomReview";

export const inspectionRecordSource = (
  record: Record<string, unknown>,
): SomInspectionRecordSource => {
  if (record.reviewMode === "status-quo-audit") return "status-quo-audit";
  if (record.reviewMode === "manual-check") return "manual-check";
  return "proposed-change";
};

/**
 * Confidence is retained for research analysis but can never authorize an
 * ontology mutation. Application scripts require reviewed proposal IDs and a
 * snapshot-bound plan instead.
 */
export const confidenceAuthorizesOntologyMutation = (
  _detectorConfidence: unknown,
  _judgeConfidence: unknown,
): false => false;
