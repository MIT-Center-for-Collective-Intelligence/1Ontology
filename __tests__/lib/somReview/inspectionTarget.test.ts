jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  db: {},
}));

import { inspectionTargetForWorkspace } from "../../../src/lib/somReview/inspectionStore";

describe("prior-review inspection target", () => {
  it("binds a Sell scan to the active round and exact ontology snapshot", () => {
    const target = inspectionTargetForWorkspace("sell");

    expect(target.workspace.activeDatasetId).toBe("sell-outline-followup");
    expect(target.datasetVersion).toBe(
      "sell-rob-outline-followup-2026-07-28-v1",
    );
    expect(target.sourceSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(target.sourceSnapshotSha256).toBe(
      target.dataset.manifest.sourceSnapshot.sha256,
    );
  });

  it("keeps Buy inspection bound independently", () => {
    const target = inspectionTargetForWorkspace("buy");

    expect(target.workspace.activeDatasetId).toBe("buy-content-identity");
    expect(target.datasetVersion).toBe(
      "buy-content-identity-after-title-followup-2026-07-26-v1",
    );
  });
});
