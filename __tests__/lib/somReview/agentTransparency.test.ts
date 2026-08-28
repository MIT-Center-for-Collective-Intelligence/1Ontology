import { getDataset } from "../../../src/lib/somReview/dataset";
import { SOM_REVIEW_WORKSPACES } from "../../../src/lib/somReview/reviewWorkspaces";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

describe("Society of Mind agent transparency", () => {
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
