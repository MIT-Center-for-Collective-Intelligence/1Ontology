import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";
import {
  TRUSTED_PROPAGATION_POLICY_VERSION,
  trustedPropagationDirective,
  trustedPropagationPlanTransition,
} from "../../../src/lib/somReview/trustedPropagation";

describe("trusted reviewer propagation policy", () => {
  const currentDataset = loadDataset(
    path.join(
      process.cwd(),
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets-rob-semantic-coverage-2026-07-29",
    ),
  );
  const proposedChange = [...currentDataset.recordsById.values()][0];

  it("authorizes only an explicitly requested current-snapshot proposal", () => {
    expect(
      trustedPropagationDirective({
        requested: true,
        allowed: true,
        currentRound: true,
        dataset: currentDataset,
        record: proposedChange,
      }),
    ).toEqual({
      status: "ready",
      policyVersion: TRUSTED_PROPAGATION_POLICY_VERSION,
      sourceSnapshotSha256: currentDataset.manifest.sourceOntologySha256,
    });
  });

  it("keeps the default path review-only and rejects past rounds", () => {
    expect(
      trustedPropagationDirective({
        requested: false,
        allowed: true,
        currentRound: true,
        dataset: currentDataset,
        record: proposedChange,
      }).status,
    ).toBe("not-requested");
    expect(
      trustedPropagationDirective({
        requested: true,
        allowed: true,
        currentRound: false,
        dataset: currentDataset,
        record: proposedChange,
      }),
    ).toMatchObject({ status: "ineligible", reason: expect.any(String) });
  });

  it("never fast-tracks a status-quo control", () => {
    const controlDataset = loadDataset(
      path.join(
        process.cwd(),
        "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
        "review-datasets",
      ),
    );
    const control = [...controlDataset.recordsById.values()].find(
      (record) => record.rolloutStatus === "control",
    );
    expect(control).toBeDefined();
    expect(
      trustedPropagationDirective({
        requested: true,
        allowed: true,
        currentRound: true,
        dataset: controlDataset,
        record: control,
      }),
    ).toMatchObject({ status: "ineligible", reason: expect.any(String) });
  });

  it("audits authorization, updates, and retraction without duplicate writes", () => {
    const directive = {
      status: "ready" as const,
      policyVersion: TRUSTED_PROPAGATION_POLICY_VERSION,
      sourceSnapshotSha256: "snapshot-1",
    };
    expect(
      trustedPropagationPlanTransition({
        existing: null,
        directive,
        decision: "agree",
      }),
    ).toEqual({ action: "authorize", status: "ready" });
    expect(
      trustedPropagationPlanTransition({
        existing: {
          status: "ready",
          policyVersion: TRUSTED_PROPAGATION_POLICY_VERSION,
          sourceSnapshotSha256: "snapshot-1",
          decision: "agree",
        },
        directive,
        decision: "agree",
      }),
    ).toBeNull();
    expect(
      trustedPropagationPlanTransition({
        existing: {
          status: "ready",
          policyVersion: TRUSTED_PROPAGATION_POLICY_VERSION,
          sourceSnapshotSha256: "snapshot-1",
          decision: "agree",
        },
        directive,
        decision: "disagree",
      }),
    ).toEqual({ action: "update", status: "ready" });
    expect(
      trustedPropagationPlanTransition({
        existing: {
          status: "ready",
          policyVersion: TRUSTED_PROPAGATION_POLICY_VERSION,
          sourceSnapshotSha256: "snapshot-1",
          decision: "agree",
        },
        directive: { ...directive, status: "not-requested" },
        decision: "agree",
      }),
    ).toEqual({ action: "retract", status: "retracted" });
  });
});
