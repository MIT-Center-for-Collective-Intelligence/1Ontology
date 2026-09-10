import { getDataset } from "../../../src/lib/somReview/dataset";
import { SOM_REVIEW_WORKSPACES } from "../../../src/lib/somReview/reviewWorkspaces";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

describe("Society of Mind agent transparency", () => {
  it("discloses archived v6 model, funding, and source without inventing a model build", () => {
    const dataset = getDataset("ontology-title-testbed");
    const records = [...dataset.recordsById.values()];
    expect(records).toHaveLength(18);
    for (const record of records) {
      const provenance = toReviewerCard(record).agentTrace!.provenance!;
      expect(provenance).toEqual(expect.arrayContaining([
        { label: "Model / deployment", value: "CloudBank Azure OpenAI / gpt-5-6-sol-society-of-mind" },
        { label: "Funding route", value: "ACCESS project CIS261400 through CloudBank Azure (archived v6 manifest)" },
        { label: "Source record", value: record.provenance.sourceRecord },
      ]));
      expect(provenance.find((item) => item.label === "Model build version")?.value).toContain("Not captured");
    }
  });

  it("discloses the calibrated v7 prompt, deterministic checks, model build, and ACCESS route", () => {
    const workspace = SOM_REVIEW_WORKSPACES.find(
      (item) => item.id === "ontology-title-testbed",
    )!;
    expect(workspace.activeDatasetId).toBe("ontology-title-testbed-v7");
    const records = [...getDataset(workspace.activeDatasetId).recordsById.values()];
    expect(records).toHaveLength(50);
    const multiple = records.find(
      (record) => record.reviewerView.context.linkedTasks.length > 1,
    )!;
    const trace = toReviewerCard(multiple).agentTrace!;
    expect(trace.stages.map((stage) => stage.actorId)).toEqual([
      "access-multiple-description-title-grouping-v7",
      "evidence-bound-title-grouping-validator-v7",
      "evidence-bound-title-testbed-card-assembler-v7",
    ]);
    expect(trace.stages[0].promptVersion).toBe(
      "access-multiple-description-title-grouping-2026-09-09-v7.4",
    );
    expect(trace.stages[0].prompt).toMatch(/Reviewed calibration decisions/);
    expect(trace.stages[0].prompt).toMatch(/shared-source assignment/);
    expect(trace.stages[1].prompt).toMatch(/exact source quote/i);
    expect(trace.provenance).toEqual(
      expect.arrayContaining([
        { label: "Model build version", value: "2026-09-03" },
        {
          label: "Funding route",
          value: "ACCESS project CIS261400 through CloudBank Azure",
        },
      ]),
    );
  });

  it("shows the archived prompts used by both Clarify unclear titles rounds", () => {
    const initialRecord = [
      ...getDataset("sell-initial-review").recordsById.values(),
    ].find((record) => record.internalModelEvidence?.detectorId === "D12");
    const followUpRecord = [
      ...getDataset("sell-title-followup").recordsById.values(),
    ].find((record) => record.internalModelEvidence?.detectorId === "D12");

    expect(initialRecord).toBeDefined();
    expect(followUpRecord).toBeDefined();

    const initialDetector = toReviewerCard(
      initialRecord!,
    ).agentTrace?.stages.find((stage) => stage.actorId === "D12");
    const followUpDetector = toReviewerCard(
      followUpRecord!,
    ).agentTrace?.stages.find((stage) => stage.actorId === "D12");

    expect(initialDetector).toMatchObject({
      actorName: "Title clarifier",
      promptVersion: "wave-28-d12-title-clarifier-2026-07-13",
      promptLabel: "Prompt template",
    });
    expect(initialDetector?.prompt).toMatch(/standing alone/i);
    expect(followUpDetector).toMatchObject({
      actorName: "Title clarifier",
      promptVersion: "wave-31-d12-expert-calibrated-title-and-sense-2026-07-22",
      promptLabel: "Prompt template",
    });
    expect(followUpDetector?.prompt).toMatch(/choose exactly one decision/i);
  });

  it("shows the separate one- and multi-description workflows", () => {
    const records = [
      ...getDataset("ontology-title-testbed").recordsById.values(),
    ];
    const single = records.find(
      (record) =>
        record.reviewerView.context.type === "title-split" &&
        record.reviewerView.context.linkedTasks.length === 1,
    );
    const multiple = records.find(
      (record) =>
        record.reviewerView.context.type === "title-split" &&
        record.reviewerView.context.linkedTasks.length > 1,
    );
    const singleTrace = toReviewerCard(single!).agentTrace;
    const multipleTrace = toReviewerCard(multiple!).agentTrace;

    expect(singleTrace?.stages.map((stage) => stage.actorId)).toEqual([
      "access-single-description-title-check-v6",
      "two-route-title-grouping-validator-v6",
      "two-route-title-testbed-card-assembler-v6",
    ]);
    expect(multipleTrace?.stages.map((stage) => stage.actorId)).toEqual([
      "access-multiple-description-title-grouping-v6",
      "two-route-title-grouping-validator-v6",
      "two-route-title-testbed-card-assembler-v6",
    ]);
    expect(singleTrace?.stages[0].prompt).toMatch(
      /one linked O\*NET description/i,
    );
    expect(multipleTrace?.stages[0].prompt).toMatch(
      /put like descriptions together/i,
    );
    expect(multipleTrace?.stages[0].prompt).toMatch(/broad umbrella title/i);
    expect(multipleTrace?.stages[0].prompt).not.toMatch(
      /alternatives for Web architecture|audio and video data/i,
    );
    expect(singleTrace?.stages[1].prompt).toMatch(
      /deterministic computer check/i,
    );
    expect(singleTrace?.stages[1].prompt).toMatch(/exactly once/i);
    expect(singleTrace?.stages[1].prompt).toMatch(/does not decide/i);
  });

  it("classifies every recorded component in every configured round", () => {
    const unclassified: Array<{
      datasetId: string;
      proposalId: string;
      actorId: string;
    }> = [];

    for (const config of SOM_REVIEW_WORKSPACES.flatMap(
      (workspace) => workspace.datasets,
    )) {
      for (const record of getDataset(config.id).recordsById.values()) {
        for (const stage of toReviewerCard(record).agentTrace?.stages || []) {
          if (stage.actorId.startsWith("no-")) continue;
          if (stage.actorKind === "recorded-component") {
            unclassified.push({
              datasetId: config.id,
              proposalId: record.proposalId,
              actorId: stage.actorId,
            });
          }
        }
      }
    }

    expect(unclassified).toEqual([]);
  });

  it("provides source-backed instructions for every identified component", () => {
    const missing: Array<{
      datasetId: string;
      proposalId: string;
      actorId: string;
      promptVersion: string;
    }> = [];

    for (const config of SOM_REVIEW_WORKSPACES.flatMap(
      (workspace) => workspace.datasets,
    )) {
      for (const record of getDataset(config.id).recordsById.values()) {
        for (const stage of toReviewerCard(record).agentTrace?.stages || []) {
          if (stage.actorId.startsWith("no-")) continue;
          if (stage.promptLabel === "Prompt unavailable") {
            missing.push({
              datasetId: config.id,
              proposalId: record.proposalId,
              actorId: stage.actorId,
              promptVersion: stage.promptVersion,
            });
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("does not invent lineage when a historical record lacks it", () => {
    const card = toReviewerCard({
      proposalId: "legacy-title",
      datasetVersion: "legacy-v1",
      branch: "Sell",
      issueType: "title-clarity",
      workflow: {},
      reviewerView: {
        currentState: "Sell Item",
        proposedState: "Sell Items",
        reasoning: "The evidence uses the plural form.",
        context: {
          type: "title-comparison",
          currentTitle: "Sell Item",
          proposedTitle: "Sell Items",
          linkedTasks: [],
        },
      },
    });

    expect(
      card.agentTrace?.stages.find((stage) => stage.role === "issue-detection"),
    ).toMatchObject({
      actorId: "no-issue-detector-recorded",
      promptLabel: "Prompt unavailable",
    });
    expect(JSON.stringify(card.agentTrace)).toMatch(
      /does not infer or invent/i,
    );
  });
});
