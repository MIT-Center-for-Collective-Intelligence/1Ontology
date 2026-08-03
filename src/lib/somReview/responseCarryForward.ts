import type { SomIssueType } from "../../types/ISomReview";
import type { SomDataset } from "./dataset";

export interface ResponseCarryForwardMapping {
  sourceProposalId: string;
  sourceIssueType: SomIssueType;
  targetProposalId: string;
  targetIssueType: SomIssueType;
  subjectTitle?: string;
}

export interface CarryForwardResponseRecord {
  proposalId: string;
  reviewerId?: string;
  issueType?: string;
  response?: object;
  carriedForwardFromProposalId?: string;
}

const configuredMappings = (
  dataset: Pick<SomDataset, "manifest" | "recordsById">,
): ResponseCarryForwardMapping[] => {
  const value = dataset.manifest?.responseCarryForward;
  if (value?.schemaVersion !== "som-response-carry-forward-v1") return [];
  if (!Array.isArray(value.mappings)) return [];

  return value.mappings.filter(
    (mapping: ResponseCarryForwardMapping) =>
      Boolean(mapping?.sourceProposalId) &&
      Boolean(mapping?.targetProposalId) &&
      dataset.recordsById.has(mapping.targetProposalId),
  );
};

export const responseCarryForwardSources = (
  dataset: Pick<SomDataset, "manifest" | "recordsById">,
  targetProposalId: string,
): string[] =>
  configuredMappings(dataset)
    .filter((mapping) => mapping.targetProposalId === targetProposalId)
    .map((mapping) => mapping.sourceProposalId);

/**
 * Projects responses to retired, semantically equivalent proposal IDs onto
 * their current IDs without changing the stored response or its audit trail.
 * A response saved directly against the current ID always takes precedence.
 */
export const carryForwardResponseRecords = <
  T extends CarryForwardResponseRecord,
>(
  dataset: Pick<SomDataset, "manifest" | "recordsById">,
  records: T[],
): T[] => {
  const bySource = new Map(
    configuredMappings(dataset).map((mapping) => [
      mapping.sourceProposalId,
      mapping,
    ]),
  );
  if (bySource.size === 0) return records;

  const selected = new Map<string, { record: T; carriedForward: boolean }>();
  for (const record of records) {
    const mapping = bySource.get(record.proposalId);
    const canCarry =
      mapping &&
      (!record.issueType || record.issueType === mapping.sourceIssueType);
    const projected = canCarry
      ? ({
          ...record,
          proposalId: mapping.targetProposalId,
          issueType: mapping.targetIssueType,
          response: record.response
            ? { ...record.response, proposalId: mapping.targetProposalId }
            : record.response,
          carriedForwardFromProposalId: mapping.sourceProposalId,
        } as T)
      : record;
    const key = `${projected.proposalId}|${projected.reviewerId || ""}`;
    const previous = selected.get(key);

    // A newer answer saved on the current card must override inherited data.
    if (!previous || (previous.carriedForward && !canCarry)) {
      selected.set(key, {
        record: projected,
        carriedForward: Boolean(canCarry),
      });
    }
  }
  return [...selected.values()].map(({ record }) => record);
};
