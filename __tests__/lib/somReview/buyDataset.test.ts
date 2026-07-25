import path from "path";

import {
  isIssueTypeReleased,
  loadDataset,
  proposalAvailability,
} from "../../../src/lib/somReview/dataset";
import { toReviewerCard } from "../../../src/lib/somReview/sanitize";

const BUY_DATASET_DIR = path.join(
  process.cwd(),
  "Buy_Society_of_Mind_Exploratory_2026-07-25",
  "review-datasets-exploratory-v1",
);

describe("Buy exploratory Society of Mind dataset", () => {
  const dataset = loadDataset(BUY_DATASET_DIR);

  it("loads as a snapshot-bound branch-neutral review package", () => {
    expect(dataset.manifest.branch).toBe("Buy");
    expect(dataset.manifest.sourceSnapshot.branchRootTitle).toBe("Buy");
    expect(dataset.recordsById.size).toBe(dataset.manifest.counts.proposals);
    expect(dataset.manifest.safety).toMatchObject({
      reviewOnly: true,
      mutatesOntology: false,
      approvalAuthorizesAutomaticWrite: false,
    });
  });

  it("releases only title clarity before the next propagation cycle", () => {
    expect(isIssueTypeReleased(dataset, "title-clarity")).toBe(true);
    expect(isIssueTypeReleased(dataset, "mistaken-synonym")).toBe(false);
    expect(isIssueTypeReleased(dataset, "flat-list-grouping")).toBe(false);
    expect(
      dataset.orderedIdsByIssue.get("title-clarity"),
    ).toHaveLength(10);
  });

  it("serves Buy-specific reviewer language without leaking Sell copy", () => {
    for (const record of dataset.recordsById.values()) {
      const card = toReviewerCard(record);
      expect(card.branch).toBe("Buy");
      if (record.issueType === "wrong-verb") {
        expect(card.reviewerView.question).toContain('"Buy"');
        expect(JSON.stringify(card)).not.toMatch(/\bSell\b|selling/i);
      }
    }
  });

  it("gates every exact action on its diagnosis", () => {
    const actions = [...dataset.recordsById.values()].filter((record) =>
      ["node-merge", "relocation", "sense-relocation"].includes(
        record.issueType,
      ),
    );
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.workflow.dependsOnProposalIds).toHaveLength(1);
      expect(
        proposalAvailability(action, new Map()),
      ).toBe("waiting");
      expect(
        proposalAvailability(
          action,
          new Map([
            [action.workflow.dependsOnProposalIds[0], "agree" as const],
          ]),
        ),
      ).toBe("ready");
    }
  });
});
