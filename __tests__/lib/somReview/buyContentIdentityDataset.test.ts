import fs from "fs";
import path from "path";

import {
  isIssueTypeReleased,
  loadDataset,
  proposalAvailability,
} from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const DATASET_DIR = path.join(
  process.cwd(),
  "Buy_Society_of_Mind_Content_Identity_2026-07-26",
  "review-datasets-content-identity-v1",
);

const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(DATASET_DIR, file), "utf8"));

const readJsonl = (file: string) =>
  fs
    .readFileSync(path.join(DATASET_DIR, file), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

describe("Buy content and identity Society of Mind dataset", () => {
  const dataset = loadDataset(DATASET_DIR);

  it("binds the wave to the isolated post-title-follow-up ontology", () => {
    expect(dataset.manifest.sourceSnapshot.ontologyAppId).toBe(
      "final-hierarchy-with-o*net-rob-buy-title-followup-applied-2026-07-26",
    );
    expect(dataset.manifest.sourceSnapshot.branchRootTitle).toBe("Buy");
    expect(dataset.recordsById.size).toBe(dataset.manifest.counts.proposals);
  });

  it("releases title and identity diagnoses while deferring structure", () => {
    for (const issueType of [
      "title-clarity",
      "synonym-enrichment",
      "mistaken-synonym",
      "duplicate-synonym",
      "polysemy",
      "misc-facet-duplicate",
      "node-merge",
    ] as const) {
      expect(isIssueTypeReleased(dataset, issueType)).toBe(true);
    }
    expect(isIssueTypeReleased(dataset, "flat-list-grouping")).toBe(false);
    expect(isIssueTypeReleased(dataset, "placement")).toBe(false);
    expect(isIssueTypeReleased(dataset, "relocation")).toBe(false);
  });

  it("keeps all prior approved title decisions evidence-locked", () => {
    const audit = readJson("diagnostics/exploratory_candidate_audit.json");
    expect(audit.priorExpertTitleLocks).toMatchObject({
      benchmarkFile: "rob-buy-approved-title-locks.json",
      count: 13,
    });

    const proposedCurrentTitles = new Set(
      [...dataset.recordsById.values()]
        .filter((record) => record.issueType === "title-clarity")
        .map((record) => record.reviewerView.context.currentTitle),
    );
    for (const title of [
      "Cash Money Order",
      "Purchase Advertising Space",
      "Purchase Advertising Time",
      "Purchase Artwork",
      "Purchase Surface Finish",
      "Purchase Wardrobe Necessity",
      "Purchase Web Address",
      "Rent Wardrobe Necessity",
      "Shop for Meals",
      "Staff Organizational Unit",
      "Subcontract Interior Arrangement",
      "Subcontract Interior Fabrication",
      "Subcontract Interior Installation",
    ]) {
      expect(proposedCurrentTitles.has(title)).toBe(false);
    }
  });

  it("shows source evidence for every newly detected title", () => {
    const titleIds = dataset.orderedIdsByIssue.get("title-clarity") || [];
    expect(titleIds).toHaveLength(14);
    for (const proposalId of titleIds) {
      const card = toReviewerCard(dataset.recordsById.get(proposalId));
      expect(card.reviewerView.context.type).toBe("title-comparison");
      if (card.reviewerView.context.type === "title-comparison") {
        expect(card.reviewerView.context.linkedTasks?.length).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("does not mistake valid lexical variants for bad synonyms", () => {
    const mistakenIds = dataset.orderedIdsByIssue.get("mistaken-synonym") || [];
    expect(mistakenIds).toHaveLength(1);
    const card = toReviewerCard(dataset.recordsById.get(mistakenIds[0]));
    expect(card.reviewerView.context).toMatchObject({
      type: "metadata-edit",
      nodeTitle: "Buy",
    });
    expect(JSON.stringify(card.reviewerView.context)).toContain("Cash");
    expect(JSON.stringify(card.reviewerView.context)).not.toMatch(
      /Employ Staff|Purchase Merchandise|Rent Property|Shop Equipment/,
    );
  });

  it("rejects coordinated, broader, and preparatory concepts as synonyms", () => {
    const duplicateIds =
      dataset.orderedIdsByIssue.get("duplicate-synonym") || [];
    expect(duplicateIds).toHaveLength(1);
    const onlyDuplicate = toReviewerCard(
      dataset.recordsById.get(duplicateIds[0]),
    );
    expect(onlyDuplicate.reviewerView.context).toMatchObject({
      type: "duplicate-comparison",
      canonicalTitle: "Purchase Product",
      candidateSynonymTitle: "Purchase Good",
    });

    const rejectedPairs = readJsonl(
      "diagnostics/rejected_agent_candidates.jsonl",
    )
      .filter(
        (record) =>
          record.stage === "content-verification-specialist" &&
          record.candidate?.issueType === "duplicate-synonym",
      )
      .map(
        (record) =>
          `${record.candidate.canonicalTitle}|${record.candidate.candidateTitle}`,
      );
    expect(rejectedPairs).toEqual(
      expect.arrayContaining([
        "Purchase Costume|Purchase Wardrobe Necessity",
        "Rent Costume|Rent Wardrobe Necessity",
        "Purchase Domain|Purchase Web Address",
        "Purchase Meal|Shop for Meals",
      ]),
    );
  });

  it("gates each exact merge on a released identity diagnosis", () => {
    const actionIds = dataset.orderedIdsByIssue.get("node-merge") || [];
    expect(actionIds).toHaveLength(3);
    for (const actionId of actionIds) {
      const action = dataset.recordsById.get(actionId);
      expect(action?.workflow.dependsOnProposalIds).toHaveLength(1);
      const prerequisiteId = action?.workflow.dependsOnProposalIds[0];
      const prerequisite = prerequisiteId
        ? dataset.recordsById.get(prerequisiteId)
        : undefined;
      expect(prerequisite).toBeDefined();
      expect(isIssueTypeReleased(dataset, prerequisite!.issueType)).toBe(true);
      expect(proposalAvailability(action, new Map())).toBe("waiting");
      expect(
        proposalAvailability(
          action,
          new Map([[prerequisiteId!, "agree" as const]]),
        ),
      ).toBe("ready");
    }
  });
});
