import { SomReviewDecision } from "../../types/ISomReview";
import { SomDataset } from "./dataset";

export const TRUSTED_PROPAGATION_POLICY_VERSION =
  "trusted-reviewer-fast-track-v1";

export type TrustedPropagationStatus = "not-requested" | "ready" | "ineligible";

export interface TrustedPropagationDirective {
  status: TrustedPropagationStatus;
  policyVersion: string;
  sourceSnapshotSha256: string;
  reason?: string;
}

export interface TrustedPropagationPlanState {
  status: "ready" | "retracted";
  policyVersion: string;
  sourceSnapshotSha256: string;
  decision: SomReviewDecision;
}

export type TrustedPropagationPlanAction = "authorize" | "update" | "retract";

export interface TrustedPropagationPlanTransition {
  action: TrustedPropagationPlanAction;
  status: "ready" | "retracted";
}

const sourceSnapshotSha256 = (dataset: SomDataset): string =>
  String(
    dataset.manifest.sourceOntologySha256 ||
      dataset.manifest.sourceSnapshot?.sha256 ||
      "",
  ).trim();

/**
 * Plans a server-side fast-track directive. This authorizes a reviewed answer
 * for a later snapshot-bound batch plan; it never authorizes an immediate
 * ontology write or infers an answer for another proposal.
 */
export const trustedPropagationDirective = ({
  requested,
  allowed,
  currentRound,
  dataset,
  record,
}: {
  requested: boolean;
  allowed: boolean;
  currentRound: boolean;
  dataset: SomDataset;
  record: any;
}): TrustedPropagationDirective => {
  const snapshotSha256 = sourceSnapshotSha256(dataset);
  const base = {
    policyVersion: TRUSTED_PROPAGATION_POLICY_VERSION,
    sourceSnapshotSha256: snapshotSha256,
  };
  if (!requested) return { ...base, status: "not-requested" };
  if (!allowed) {
    return {
      ...base,
      status: "ineligible",
      reason: "Reviewer is not authorized for trusted propagation",
    };
  }
  if (!currentRound) {
    return {
      ...base,
      status: "ineligible",
      reason: "Past review rounds cannot enter the current propagation draft",
    };
  }
  if (!snapshotSha256) {
    return {
      ...base,
      status: "ineligible",
      reason: "The review round is not bound to an ontology snapshot",
    };
  }
  if (
    record?.datasetVersion !== dataset.datasetVersion ||
    record?.provenance?.sourceSnapshotSha256 !== snapshotSha256
  ) {
    return {
      ...base,
      status: "ineligible",
      reason: "The proposal is not bound to the active source snapshot",
    };
  }
  if (
    record?.reviewMode !== "proposed-change" ||
    record?.rolloutStatus === "control"
  ) {
    return {
      ...base,
      status: "ineligible",
      reason: "Controls and status-quo checks cannot enter a propagation draft",
    };
  }
  return { ...base, status: "ready" };
};

/** Returns the audited plan change needed for a response submission. */
export const trustedPropagationPlanTransition = ({
  existing,
  directive,
  decision,
}: {
  existing?: TrustedPropagationPlanState | null;
  directive: TrustedPropagationDirective;
  decision: SomReviewDecision;
}): TrustedPropagationPlanTransition | null => {
  if (directive.status !== "ready") {
    return existing?.status === "ready"
      ? { action: "retract", status: "retracted" }
      : null;
  }
  if (!existing || existing.status === "retracted") {
    return { action: "authorize", status: "ready" };
  }
  if (
    existing.policyVersion === directive.policyVersion &&
    existing.sourceSnapshotSha256 === directive.sourceSnapshotSha256 &&
    existing.decision === decision
  ) {
    return null;
  }
  return { action: "update", status: "ready" };
};
