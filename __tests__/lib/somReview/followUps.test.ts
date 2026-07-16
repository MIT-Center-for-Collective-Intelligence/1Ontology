import path from "path";

import { loadDataset } from "../../../src/lib/somReview/dataset";
import {
  readyDependentRecords,
  toLinkedFollowUps,
} from "../../../src/lib/somReview/followUps";

describe("Society of Mind linked follow-ups", () => {
  const dataset = loadDataset(
    path.join(
      process.cwd(),
      "Sell_Society_of_Mind_Review_UI_Handoff_2026-07-15",
      "review-datasets",
    ),
  );
  const relocation = [...dataset.recordsById.values()].find(
    (record) => record.issueType === "relocation",
  );
  const sourceProposalId = relocation.workflow.dependsOnProposalIds[0];

  it("returns the exact action unlocked by an agreed diagnosis", () => {
    const records = readyDependentRecords(
      dataset,
      new Map([[sourceProposalId, "agree"]]),
      sourceProposalId,
    );

    expect(records.map((record) => record.proposalId)).toEqual([
      relocation.proposalId,
    ]);
  });

  it("excludes rejected, unanswered, and already reviewed actions", () => {
    expect(
      readyDependentRecords(
        dataset,
        new Map([[sourceProposalId, "disagree"]]),
        sourceProposalId,
      ),
    ).toEqual([]);
    expect(readyDependentRecords(dataset, new Map(), sourceProposalId)).toEqual(
      [],
    );
    expect(
      readyDependentRecords(
        dataset,
        new Map([
          [sourceProposalId, "agree"],
          [relocation.proposalId, "agree"],
        ]),
        sourceProposalId,
      ),
    ).toEqual([]);
  });

  it("serves reviewer-safe questions and both queue labels", () => {
    const [summary] = toLinkedFollowUps(dataset, [relocation]);

    expect(summary).toMatchObject({
      proposalId: relocation.proposalId,
      issueType: "relocation",
      issueLabel: "Apply approved relocations",
      question: expect.stringContaining("move from"),
      sources: [
        {
          proposalId: sourceProposalId,
          issueLabel: expect.stringMatching(/^1[12]\./),
          question: expect.any(String),
        },
      ],
    });
  });
});
