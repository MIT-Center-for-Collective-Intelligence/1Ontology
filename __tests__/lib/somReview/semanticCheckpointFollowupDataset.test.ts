import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";

describe("Sell post-semantic checkpoint review", () => {
  const datasetRoot = path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets-rob-semantic-followup-2026-08-04",
  );
  const dataset = loadDataset(datasetRoot, "sell-semantic-coverage");
  const records = [...dataset.recordsById.values()];

  it("is pinned to the verified isolated semantic target", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-rob-semantic-followup-2026-08-04-v1",
    );
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId:
        "final-hierarchy-with-o*net-rob-semantic-applied-2026-08-04",
      environment: "production",
      nodeCount: 198,
      edgeCount: 232,
      collectionCount: 202,
    });
    expect(dataset.manifest.propagationCheckpoint).toMatchObject({
      priorDatasetVersion: "sell-rob-semantic-coverage-2026-07-29-v1",
      sourceUnchanged: true,
      targetDigestVerified: true,
      buyerEvidenceRetainedInOriginalBranch: true,
    });
  });

  it("contains only the two independent remaining decisions", () => {
    expect(records).toHaveLength(2);
    expect(
      records.map((record) => [record.issueType, record.subject.title]),
    ).toEqual([
      ["collection-design", "Sell ownership or temporary use?"],
      ["empty-node", "Sell (Other)"],
    ]);
    expect(
      records.every(
        (record) =>
          record.reviewerView.agreeLabel === "Agree" &&
          record.reviewerView.disagreeLabel === "Disagree",
      ),
    ).toBe(true);
  });

  it("does not recreate collection labels as activity nodes", () => {
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(datasetRoot, "ontology-snapshot.json"), "utf8"),
    );
    expect(snapshot.nodes.map((node: any) => node.title)).not.toEqual(
      expect.arrayContaining(["Sell ownership", "Sell temporary use"]),
    );

    const collection = records.find(
      (record) => record.issueType === "collection-design",
    );
    expect(collection?.reviewerView.context).toMatchObject({
      type: "collection-design",
      currentChildren: [
        "Rent out",
        "Sell information",
        "Sell physical objects",
        "Sell Products",
        "Sell service",
      ],
      proposedBranches: [
        { title: "Rent out", status: "existing", children: [] },
        { title: "Sell information", status: "existing", children: [] },
        { title: "Sell physical objects", status: "existing", children: [] },
        { title: "Sell Products", status: "existing", children: [] },
        { title: "Sell service", status: "existing", children: [] },
      ],
    });
    expect(collection?.reviewerView.proposedState).toContain(
      "creates no activity nodes or hierarchy edges",
    );
  });

  it("finds no empty named collection in the owned Sell branch", () => {
    expect(
      records.filter((record) => record.issueType === "empty-collection"),
    ).toHaveLength(0);
    const audit = JSON.parse(
      fs.readFileSync(
        path.join(datasetRoot, "diagnostics", "regeneration-audit.json"),
        "utf8",
      ),
    );
    expect(audit.counts).toMatchObject({
      emptyNodes: 1,
      emptyNamedCollections: 0,
      collectionDesigns: 1,
    });
    expect(audit.collectionInvariant).toMatchObject({
      createsActivityNodes: false,
      createsHierarchyEdges: false,
      temporaryUseBranch: "Rent out",
      deferredEmptyBranch: "Sell (Other)",
    });
  });
});
