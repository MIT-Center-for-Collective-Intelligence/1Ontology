import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";

describe("Sell legal-rights exact follow-up", () => {
  const datasetRoot = path.join(
    process.cwd(),
    "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
    "review-datasets-rob-legal-rights-followup-2026-08-05",
  );
  const dataset = loadDataset(datasetRoot, "sell-semantic-coverage");
  const records = [...dataset.recordsById.values()];

  it("is pinned to the verified cleanup copy", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-rob-legal-rights-followup-2026-08-05-v1",
    );
    expect(dataset.manifest.sourceSnapshot).toMatchObject({
      ontologyAppId:
        "final-hierarchy-with-o*net-rob-cleanup-applied-2026-08-05-v2",
      environment: "production",
      nodeCount: 197,
      edgeCount: 231,
      collectionCount: 200,
    });
    expect(dataset.manifest.propagationCheckpoint).toMatchObject({
      sourceUnchanged: true,
      targetDigestVerified: true,
      changedDocumentCount: 2,
      exactReviewedScope: true,
      acceptedEmptyNodeRemovalApplied: true,
      rejectedCollectionApplied: false,
    });
  });

  it("contains only Rob's exact legal-rights correction", () => {
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      issueType: "collection-design",
      internalModelEvidence: {
        detectorId: "expert-correction-projection",
        detectorConfidence: "not-scored",
        reviewerVisible: false,
      },
      subject: {
        title: "Legal rights conveyed in sale",
        parentTitle: "Sell",
      },
      reviewerView: {
        question:
          "Do you agree with this exact implementation of your proposed legal-rights collection?",
        agreeLabel: "Agree",
        disagreeLabel: "Disagree",
        context: {
          type: "collection-design",
          parentTitle: "Sell",
          proposedCollectionName: "Legal rights conveyed in sale",
          proposedBranches: [
            {
              title: "Sell ownership",
              status: "new",
              children: [
                "Sell Products",
                "Sell information",
                "Sell physical objects",
                "Sell service",
              ],
            },
            {
              title: "Sell temporary use",
              status: "new",
              children: ["Rent out"],
            },
          ],
          sourceTasks: [],
        },
      },
    });
    expect(records[0].reviewerView.reasoning).toContain(
      "not an LLM-generated collection",
    );
  });

  it("starts from the cleaned hierarchy without applying the rejected design", () => {
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(datasetRoot, "ontology-snapshot.json"), "utf8"),
    );
    const titles = snapshot.nodes.map((node: any) => node.title);

    expect(titles).not.toContain("Sell (Other)");
    expect(titles).not.toEqual(
      expect.arrayContaining(["Sell ownership", "Sell temporary use"]),
    );
  });

  it("excludes unsupported legacy Add nodes instead of presenting them for review", () => {
    expect(dataset.manifest.excludedLegacyAddNodes).toEqual({
      sourceDatasetVersion: "sell-final-hierarchy-onet-2026-07-15-v4",
      proposalCount: 10,
      sourceTaskCount: 0,
      detectorNames: ["GapScanner"],
      disposition: "exclude-until-onet-grounded",
    });
    expect(
      records.some((record) => record.issueType === "missing-activity"),
    ).toBe(false);

    const audit = JSON.parse(
      fs.readFileSync(
        path.join(datasetRoot, "diagnostics", "regeneration-audit.json"),
        "utf8",
      ),
    );
    expect(audit).toMatchObject({
      expertCorrectionProjected: true,
      llmCalls: 0,
      legacyAddNodes: {
        proposalCount: 10,
        sourceTaskCount: 0,
        detectorNames: ["GapScanner"],
        disposition: "exclude-until-onet-grounded",
      },
      ontologyMutatedByGeneration: false,
    });
  });
});
