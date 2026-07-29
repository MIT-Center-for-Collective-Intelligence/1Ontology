import fs from "fs";
import path from "path";

import {
  isIssueTypeReleased,
  loadDataset,
  proposalAvailability,
} from "../../../src/lib/somReview/dataset";

const DATASET_DIR = path.join(
  process.cwd(),
  "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
  "review-datasets-rob-outline-followup-2026-07-28",
);

const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(DATASET_DIR, file), "utf8"));

describe("Rob Sell outline follow-up dataset", () => {
  const dataset = loadDataset(DATASET_DIR);
  const records = [...dataset.recordsById.values()];

  it("is snapshot-bound, review-only, and complete", () => {
    expect(dataset.datasetVersion).toBe(
      "sell-rob-outline-followup-2026-07-28-v1",
    );
    expect(dataset.manifest.sourceSnapshot.branchRootTitle).toBe("Sell");
    expect(dataset.manifest.safety).toEqual(
      expect.objectContaining({
        reviewOnly: true,
        mutatesOntology: false,
        approvalAuthorizesAutomaticWrite: false,
      }),
    );
    expect(records).toHaveLength(
      dataset.manifest.counts.proposals + dataset.manifest.counts.manualChecks,
    );

    const audit = readJson("diagnostics/generation-audit.json");
    expect(audit.sourceSnapshotSha256).toBe(
      dataset.manifest.sourceSnapshot.sha256,
    );
    expect(audit.ontologyMutated).toBe(false);

    const followupAudit = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "artifacts",
          "rob-sell-followup-2026-07-28",
          "followup-audit.json",
        ),
        "utf8",
      ),
    );
    expect(followupAudit.sourceSnapshot.sha256).toBe(
      dataset.manifest.sourceSnapshot.sha256,
    );
  });

  it("releases only the issue types represented in this follow-up", () => {
    for (const issueType of [
      "collection-design",
      "duplicate-synonym",
      "flat-list-grouping",
      "node-merge",
      "placement",
      "redundant-node",
      "relocation",
    ] as const) {
      expect(isIssueTypeReleased(dataset, issueType)).toBe(true);
    }
    expect(isIssueTypeReleased(dataset, "title-clarity")).toBe(false);
    expect(isIssueTypeReleased(dataset, "description-enrichment")).toBe(false);
  });

  it("shows the funeral task as an explicit multi-parent allocation", () => {
    const record = records.find(
      (candidate) =>
        candidate.reviewerView.context.type === "evidence-parent-allocation",
    );
    expect(record).toBeDefined();
    expect(record.reviewerView.context).toMatchObject({
      taskTitle:
        "(O*Net) 18843 - Sell funeral services, products, or merchandise to clients.",
      currentParentTitles: expect.arrayContaining([
        "Sell Products",
        "Sell Funeral Products",
        "Sell Services",
      ]),
      assignedOutputTitles: ["Sell Funeral Products"],
      retainedParentTitles: ["Sell Services"],
      removedParentTitles: ["Sell Products"],
    });
  });

  it("keeps every exact merge and move dependency-gated", () => {
    const exactActions = records.filter((record) =>
      ["node-merge", "relocation"].includes(record.issueType),
    );
    expect(exactActions.length).toBeGreaterThan(0);

    for (const record of exactActions) {
      const dependencyIds = record.workflow.dependsOnProposalIds;
      expect(dependencyIds).toHaveLength(1);
      expect(proposalAvailability(record, new Map())).toBe("waiting");
      expect(
        proposalAvailability(record, new Map([[dependencyIds[0], "agree"]])),
      ).toBe("ready");
      expect(
        proposalAvailability(record, new Map([[dependencyIds[0], "disagree"]])),
      ).toBe("not-applicable");
    }
  });

  it("keeps unresolved semantic boundaries as manual checks", () => {
    const manualChecks = fs
      .readFileSync(path.join(DATASET_DIR, "manual_checks.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(manualChecks).toHaveLength(5);
    expect(manualChecks.map((record) => record.proposalId)).toEqual(
      expect.arrayContaining(
        dataset.manifest.issueTypes
          .flatMap((issue: any) => issue.manualCheckIds || [])
          .filter(Boolean),
      ),
    );
    expect(
      manualChecks.every(
        (record) =>
          record.reviewMode === "manual-check" &&
          record.internalModelEvidence?.reviewerVisible === false &&
          record.provenance?.sourceSnapshotSha256 ===
            dataset.manifest.sourceSnapshot.sha256,
      ),
    ).toBe(true);
  });
});
