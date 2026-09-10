import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";
import {
  reviewDatasetConfig,
  reviewDatasetDir,
} from "../../../src/lib/somReview/reviewWorkspaces";

const v7Config = reviewDatasetConfig("ontology-title-testbed-v7");
const v7Dir = reviewDatasetDir(v7Config);
const readJson = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(v7Dir, file), "utf8"));

describe("random 50 title-clarification review dataset", () => {
  it("loads all 50 held-out cards while preserving the archived v6 round", () => {
    expect(v7Config.current).toBe(true);
    expect(v7Config.datasetVersion).toBe(
      "ontology-title-random-round-2026-09-09-v7",
    );
    const v7 = loadDataset(v7Dir, v7Config.id);
    expect(v7.recordsById.size).toBe(50);
    expect(v7.manifest.counts).toMatchObject({
      proposals: 43,
      controls: 7,
      manualChecks: 0,
    });
    const v6Config = reviewDatasetConfig("ontology-title-testbed");
    expect(v6Config.current).toBe(false);
    expect(loadDataset(reviewDatasetDir(v6Config), v6Config.id).recordsById.size).toBe(18);
  });

  it("records the frozen random design and excludes the 18 development cases", () => {
    const manifest = readJson("manifest.json");
    expect(manifest.sampleDesign.seed).toBe(
      "title-clarification-round-2-random-50-2026-09-09",
    );
    expect(manifest.upstreamSource).toMatchObject({
      atomicActivityOccurrences: 20491,
      distinctTitleEvidenceCases: 15994,
      eligibleAfterExcludingPriorRound: 15976,
      sampledTitleEvidenceCases: 50,
    });
    expect(manifest.limitations).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/18 reviewed cases were used to calibrate/i),
        expect.stringMatching(/model differs from the prior 18-case round/i),
        expect.stringMatching(/No generated proposal or expert response writes/i),
      ]),
    );
  });

  it("shows every exact source under each proposed group it supports", () => {
    const dataset = loadDataset(v7Dir, v7Config.id);
    for (const record of dataset.recordsById.values()) {
      const context = record.reviewerView.context;
      for (const group of context.proposedNodes) {
        expect(group.sourceTaskIndexes).toHaveLength(group.sourceTasks.length);
        group.sourceTaskIndexes.forEach((sourceIndex: number, index: number) => {
          expect(group.sourceTasks[index]).toBe(context.linkedTasks[sourceIndex - 1]);
        });
      }
    }
    const quality = readJson("diagnostics/quality-report.json");
    expect(quality.counts).toMatchObject({
      cards: 50,
      groups: 138,
      sharedSourceDeclarations: 57,
    });
    expect(quality.evaluationStatus).toMatchObject({
      expertReviewsCompleted: 0,
      disagreements: null,
      disagreementRate: null,
    });
  });

  it("starts the second-round tracker at zero reviewed rather than assuming agreement", () => {
    const tracker = readJson("diagnostics/disagreement-tracker.json");
    expect(tracker.rounds[0]).toMatchObject({
      cardsReviewed: 18,
      agreements: 15,
      disagreements: 3,
    });
    expect(tracker.rounds[1]).toMatchObject({
      cardsGenerated: 50,
      cardsReviewed: 0,
      agreements: 0,
      disagreements: 0,
      disagreementRate: null,
      status: "ready-for-review",
    });
  });
});
