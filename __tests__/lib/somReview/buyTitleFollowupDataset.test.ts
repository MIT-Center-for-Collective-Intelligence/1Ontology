import fs from "fs";
import path from "path";

import {
  isIssueTypeReleased,
  loadDataset,
} from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const DATASET_DIR = path.join(
  process.cwd(),
  "Buy_Society_of_Mind_Title_Followup_2026-07-25",
  "review-datasets-title-followup-v1",
);

const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(DATASET_DIR, file), "utf8"));

describe("Buy title follow-up Society of Mind dataset", () => {
  const dataset = loadDataset(DATASET_DIR);

  it("binds the follow-up to the isolated post-review ontology", () => {
    expect(dataset.manifest.sourceSnapshot.ontologyAppId).toBe(
      "final-hierarchy-with-o*net-rob-buy-titles-applied-2026-07-25",
    );
    expect(dataset.manifest.sourceSnapshot.branchRootTitle).toBe("Buy");
    expect(dataset.recordsById.size).toBe(dataset.manifest.counts.proposals);
  });

  it("releases only the three newly detected title items", () => {
    expect(isIssueTypeReleased(dataset, "title-clarity")).toBe(true);
    expect(isIssueTypeReleased(dataset, "mistaken-synonym")).toBe(false);
    expect(isIssueTypeReleased(dataset, "node-merge")).toBe(false);
    expect(isIssueTypeReleased(dataset, "flat-list-grouping")).toBe(false);

    const titleIds = dataset.orderedIdsByIssue.get("title-clarity") || [];
    expect(titleIds).toHaveLength(3);
    const currentTitles = titleIds.map((proposalId) => {
      const card = toReviewerCard(dataset.recordsById.get(proposalId));
      expect(card.reviewerView.context.type).toBe("title-comparison");
      if (card.reviewerView.context.type !== "title-comparison") return "";
      expect(card.reviewerView.context.linkedTasks?.length).toBeGreaterThan(0);
      return card.reviewerView.context.currentTitle;
    });
    expect(currentTitles.sort()).toEqual(
      [
        "Subcontract Arrangement",
        "Subcontract Fabrication",
        "Subcontract Installation",
      ].sort(),
    );
  });

  it("keeps prior expert-approved titles when their evidence is unchanged", () => {
    const audit = readJson("diagnostics/exploratory_candidate_audit.json");
    expect(audit.priorExpertTitleLocks).toMatchObject({
      benchmarkFile: "rob-buy-title-benchmark.json",
      count: 10,
    });

    const snapshot = readJson("ontology-snapshot.json");
    const titles = new Set(snapshot.nodes.map((node: any) => node.title));
    for (const title of [
      "Cash Money Order",
      "Purchase Web Address",
      "Purchase Surface Finish",
      "Purchase Wardrobe Necessity",
      "Purchase Advertising Space",
      "Purchase Advertising Time",
      "Purchase Artwork",
      "Rent Wardrobe Necessity",
      "Shop for Meals",
      "Staff Organizational Unit",
    ]) {
      expect(titles.has(title)).toBe(true);
    }

    const proposedCurrentTitles = new Set(
      [...dataset.recordsById.values()]
        .filter((record) => record.issueType === "title-clarity")
        .map((record) => record.reviewerView.context.currentTitle),
    );
    expect(proposedCurrentTitles.has("Purchase Wardrobe Necessity")).toBe(
      false,
    );
    expect(proposedCurrentTitles.has("Rent Wardrobe Necessity")).toBe(false);
    expect(proposedCurrentTitles.has("Shop for Meals")).toBe(false);
  });
});
