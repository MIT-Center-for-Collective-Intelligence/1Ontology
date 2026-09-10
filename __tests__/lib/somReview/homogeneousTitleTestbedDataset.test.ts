import fs from "fs";
import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const DATASET_DIR = path.join(
  process.cwd(),
  "Ontology_Title_Clarity_Testbed_2026-08-28",
  "review-datasets-v6",
);
type ProposedTitleNode = {
  title: string;
  sourceTaskIndexes: number[];
  sourceTasks: string[];
};

describe("ontology-wide two-route title test bed", () => {
  const dataset = loadDataset(DATASET_DIR, "ontology-title-testbed");
  const records = [...dataset.recordsById.values()];
  const titleRecords = records.filter(
    (record) => record.issueType === "title-clarity",
  );

  it("loads the 18 validated title-evidence cases without write authority", () => {
    expect(dataset.recordsById.size).toBe(18);
    expect(titleRecords).toHaveLength(18);
    expect(
      titleRecords.filter((record) => record.reviewMode === "status-quo-audit"),
    ).toHaveLength(1);
    expect(dataset.manifest.upstreamSource).toMatchObject({
      atomicActivityOccurrences: 20491,
      distinctTitleEvidenceCases: 15994,
      reusedOccurrenceResults: 4497,
      oneDescriptionOccurrences: 13720,
      oneDescriptionCases: 10810,
      multipleDescriptionCases: 5184,
      resultingHomogeneousGroups: 61,
    });
    expect(dataset.manifest.safety).toMatchObject({
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
    });
  });

  it("packages the active v6 title dataset into the production image", () => {
    const dockerfile = fs.readFileSync(
      path.join(process.cwd(), "Dockerfile"),
      "utf8",
    );
    expect(dockerfile).toContain(
      "RUN test -f ./Ontology_Title_Clarity_Testbed_2026-08-28/review-datasets-v6/manifest.json",
    );
  });

  it("packages the complete large-case inventory", () => {
    const inventory = dataset.manifest.largeCaseInventory;
    expect(inventory).toMatchObject({
      cutoff: 10,
      uniqueTitleCount: 564,
      ontologyOccurrenceCount: 786,
      maximumLinkedDescriptionCount: 216,
    });
    expect(inventory.rows).toHaveLength(564);
    expect(
      inventory.rows.every(
        (row: any) => row.linkedONetDescriptionCount > inventory.cutoff,
      ),
    ).toBe(true);
  });

  it("estimates one model call per distinct title-evidence case", () => {
    const estimate = JSON.parse(
      fs.readFileSync(
        path.join(DATASET_DIR, "diagnostics", "full-run-estimate.json"),
        "utf8",
      ),
    );
    expect(estimate.inventory).toMatchObject({
      atomicActivityOccurrences: 20491,
      distinctTitleEvidenceCases: 15994,
      reusedOccurrenceResults: 4497,
      distinctCaseONetRecords: 40949,
    });
    expect(estimate.projection.homogeneousGroupScenarios).toMatchObject({
      noSplit: 15994,
      stratifiedPilot: 24647,
      oneGroupPerSourceRecord: 40949,
    });
    const central =
      estimate.projection.twoRouteAllCandidatePipeline.stratifiedPilotScenario;
    expect(central.calls.titleGrouping).toBe(15994);
    expect(central.modelCalls).toBe(40641);
    expect(central.totalAccessTokensPlanningRange.central).toBeLessThan(
      100000000,
    );
    expect(
      estimate.projection.twoRouteAllCandidatePipeline.billing,
    ).toMatchObject({
      route: "ACCESS-funded CloudBank Azure allocation CIS261400",
      allocationConsumptionIsZero: false,
    });
  });

  it("assigns every description exactly once under concise same-verb titles", () => {
    for (const record of titleRecords) {
      const context = record.reviewerView.context;
      expect(context.type).toBe("title-split");
      if (context.type !== "title-split") continue;
      const groupedIndexes = context.proposedNodes.flatMap(
        (node: ProposedTitleNode) => node.sourceTaskIndexes,
      );
      const accounted = [...groupedIndexes, ...context.deferredTaskIndexes];
      expect(accounted.sort((left, right) => left - right)).toEqual(
        context.linkedTasks.map((_task: string, index: number) => index + 1),
      );
      expect(accounted).toHaveLength(new Set(accounted).size);
      for (const node of context.proposedNodes as ProposedTitleNode[]) {
        expect(node.sourceTaskIndexes).toHaveLength(node.sourceTasks.length);
        expect(node.title.split(/\s+/).length).toBeGreaterThanOrEqual(2);
        expect(node.title.split(/\s+/).length).toBeLessThanOrEqual(5);
        expect(node.title.split(/\s+/)[0]).toBe(
          context.currentTitle.split(/\s+/)[0],
        );
      }
      if (context.linkedTasks.length === 1 && context.proposedNodes.length) {
        expect(context.proposedNodes).toHaveLength(1);
        expect(context.proposedNodes[0].sourceTaskIndexes).toEqual([1]);
      }
    }
  });

  it("retains expert regressions and exercises Conduct Research at full size", () => {
    const documentAlternative = titleRecords.find(
      (record) => record.subject.title === "Document Alternative",
    );
    expect(documentAlternative?.reviewerView.context).toMatchObject({
      proposedNodes: [
        {
          title: "Document Web Technical Alternatives",
          sourceTaskIndexes: [1, 2],
        },
      ],
    });

    const storeData = titleRecords.find(
      (record) => record.subject.title === "Store Datum",
    );
    expect(
      storeData?.reviewerView.context.type === "title-split"
        ? storeData.reviewerView.context.proposedNodes.map(
            (node: ProposedTitleNode) => node.title,
          )
        : [],
    ).toEqual(["Store Audio and Video Data", "Store System Analysis Data"]);

    const conductResearch = titleRecords.find(
      (record) => record.subject.title === "Conduct Research",
    );
    expect(conductResearch?.reviewerView.context.type).toBe("title-split");
    if (conductResearch?.reviewerView.context.type === "title-split") {
      expect(conductResearch.reviewerView.context.linkedTasks).toHaveLength(
        133,
      );
      expect(conductResearch.reviewerView.context.proposedNodes).toHaveLength(
        20,
      );
      expect(
        conductResearch.reviewerView.context.proposedNodes.flatMap(
          (node: ProposedTitleNode) => node.sourceTaskIndexes,
        ),
      ).toHaveLength(133);
    }
  });

  it("packages a clean ACCESS release audit bound to the exact inputs", () => {
    const audit = JSON.parse(
      fs.readFileSync(
        path.join(DATASET_DIR, "diagnostics", "release-audit.json"),
        "utf8",
      ),
    );
    expect(dataset.manifest.releaseAudit).toMatchObject({
      materialIssueCount: 0,
      fundingRoute: "ACCESS project CIS261400 through CloudBank Azure",
    });
    expect(audit.materialIssues).toEqual([]);
    expect(audit.inputHashes).toEqual(
      dataset.manifest.releaseAudit.inputHashes,
    );
  });

  it("defers WordNet work until a title group has been accepted", () => {
    expect(dataset.manifest.reviewRelease).toMatchObject({
      strategy: "title-review-before-all-candidate-wordnet",
      releasedIssueTypes: ["title-clarity"],
      awaitingRegenerationIssueTypes: ["synset-alignment"],
    });
  });

  it("discloses the correct route, deterministic check, and assembler", () => {
    for (const record of records) {
      const card = toReviewerCard(record);
      const trace = card.agentTrace;
      expect(trace?.stages).toHaveLength(3);
      const expectedDetector =
        card.reviewerView.context.type === "title-split" &&
        card.reviewerView.context.linkedTasks.length === 1
          ? "access-single-description-title-check-v6"
          : "access-multiple-description-title-grouping-v6";
      expect(trace?.stages.map((stage) => stage.actorId)).toEqual([
        expectedDetector,
        "two-route-title-grouping-validator-v6",
        "two-route-title-testbed-card-assembler-v6",
      ]);
      for (const stage of trace?.stages || []) {
        expect(stage.promptLabel).not.toBe("Prompt unavailable");
        expect(stage.prompt.length).toBeGreaterThan(40);
      }
    }
  });
});
