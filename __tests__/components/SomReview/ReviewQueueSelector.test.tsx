/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewQueueSelector from "../../../src/components/SomReview/ReviewQueueSelector";
import {
  SomIssueType,
  SomIssueTypeOption,
  SomLinkedFollowUp,
  SomReviewStage,
} from "../../../src/types/ISomReview";

const option = (
  id: SomIssueType,
  label: string,
  stage: SomReviewStage,
  robTaskIds: number[],
  overrides: Partial<SomIssueTypeOption> = {},
): SomIssueTypeOption => ({
  id,
  label,
  stage,
  robTaskIds,
  total: 1,
  reviewed: 0,
  pending: 1,
  waiting: 0,
  notApplicable: 0,
  enabled: true,
  ...overrides,
});

const issues: SomIssueTypeOption[] = [
  option("title-clarity", "1. Clarify unclear titles", "content", [1], {
    total: 47,
    reviewed: 10,
    pending: 37,
    activeSession: { cursor: 3, total: 10 },
  }),
  option("synonym-enrichment", "2. Add missing synonyms", "content", [2], {
    total: 0,
    pending: 0,
  }),
  option(
    "description-enrichment",
    "15. Add missing descriptions",
    "additional-quality",
    [3],
    { optional: true },
  ),
  option(
    "misc-facet-duplicate",
    "6. Repeated miscellaneous/facet nodes",
    "within-branch",
    [4],
    { total: 4, reviewed: 4, pending: 0 },
  ),
  option("mistaken-synonym", "3. Mistaken synonyms", "content", [5]),
  option("duplicate-synonym", "4. Undetected synonyms", "content", [6]),
  option("polysemy", "5. Undetected double meanings", "content", [7]),
  option(
    "flat-list-grouping",
    "7. Group long flat lists",
    "within-branch",
    [8],
  ),
  option(
    "compound-object-grouping",
    "8. Group compound objects",
    "within-branch",
    [9],
  ),
  option(
    "collection-design",
    "9. Create warranted collections",
    "within-branch",
    [10],
  ),
  option(
    "placement",
    "10. Wrong place within Sub-branch",
    "within-branch",
    [11],
    {
      total: 16,
      pending: 16,
    },
  ),
  option(
    "wrong-verb",
    "11. Misjudged synonyms within Sub-branch",
    "outside-branch",
    [12],
  ),
  option(
    "sense-relocation",
    "12. Move a separated non-selling sense",
    "outside-branch",
    [13],
  ),
  option(
    "node-merge",
    "13. Review approved node merges",
    "final-action",
    [4, 6],
    {
      total: 3,
      pending: 0,
      waiting: 3,
    },
  ),
  option(
    "relocation",
    "14. Review approved relocations",
    "final-action",
    [11, 12],
    {
      total: 2,
      pending: 0,
      notApplicable: 2,
    },
  ),
  option("missing-activity", "16. Missing activity", "additional-quality", [], {
    optional: true,
  }),
  option("redundant-node", "17. Redundant node", "additional-quality", [], {
    total: 0,
    pending: 0,
  }),
];

const readyFollowUp: SomLinkedFollowUp = {
  proposalId: "relocation-1",
  issueType: "relocation",
  issueLabel: "14. Review approved relocations",
  question: 'Should "Sell Contract" move to "Sign Contract"?',
  sources: [
    {
      proposalId: "placement-1",
      issueType: "placement",
      issueLabel: "10. Wrong place within Sub-branch",
      question: 'Is "Sell Contract" misplaced under "Sell"?',
    },
  ],
};

describe("Society of Mind review queue selector", () => {
  it("shows every task and action queue in its workflow stage", () => {
    render(<ReviewQueueSelector issueTypes={issues} onStart={jest.fn()} />);
    for (const issue of issues) {
      expect(screen.getByText(issue.label)).toBeInTheDocument();
    }
    expect(screen.getByText("Content of nodes")).toBeInTheDocument();
    expect(screen.getByText("Structure within Sub-branch")).toBeInTheDocument();
    expect(screen.getByText("Movement beyond Sub-branch")).toBeInTheDocument();
    expect(screen.getByText("Follow-up change proposals")).toBeInTheDocument();
    expect(
      screen.getByText("Additional optional quality checks"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Optional for initial restructuring"),
    ).toHaveLength(2);
    expect(
      screen.getByText("In progress: 10 of 47 reviewed"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("In progress: 10 of 47 reviewed")
        .closest(".MuiChip-root"),
    ).toHaveClass("MuiChip-outlined");
    expect(
      screen.getByText("16 ready to review").closest(".MuiChip-root"),
    ).toHaveClass("MuiChip-outlined");
    expect(screen.getAllByText("No review items found")).toHaveLength(2);
    expect(screen.getByText("4 reviewed")).toBeInTheDocument();
    expect(screen.getByText("Review completed items")).toBeInTheDocument();
    expect(screen.getByText("Related review required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review its related diagnosis first. If you agree, this action will become available.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not needed")).toBeInTheDocument();
  });

  it("starts available queues and explains dependency-blocked queues", () => {
    const onStart = jest.fn();
    render(<ReviewQueueSelector issueTypes={issues} onStart={onStart} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Start 10. Wrong place within Sub-branch review, 16 remaining",
      }),
    );
    expect(onStart).toHaveBeenCalledWith("placement");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Review completed items in 6. Repeated miscellaneous/facet nodes, 4 saved",
      }),
    );
    expect(onStart).toHaveBeenCalledWith("misc-facet-duplicate");
    expect(
      screen.getByRole("button", {
        name: "13. Review approved node merges; review its related diagnosis first",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "2. Add missing synonyms, no review items available",
      }),
    ).toBeDisabled();
  });

  it("keeps postponed linked actions directly accessible", () => {
    const onStartFollowUp = jest.fn();
    render(
      <ReviewQueueSelector
        issueTypes={issues}
        onStart={jest.fn()}
        readyFollowUps={[readyFollowUp]}
        onStartFollowUp={onStartFollowUp}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `Review this next: ${readyFollowUp.question}`,
      }),
    );
    expect(onStartFollowUp).toHaveBeenCalledWith(readyFollowUp);
  });

  it("shows the deliberation entry only for authorized reviewers", () => {
    const { rerender } = render(
      <ReviewQueueSelector issueTypes={issues} onStart={jest.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Group deliberation" }),
    ).not.toBeInTheDocument();

    const onOpenDeliberation = jest.fn();
    rerender(
      <ReviewQueueSelector
        issueTypes={issues}
        onStart={jest.fn()}
        canDeliberate
        onOpenDeliberation={onOpenDeliberation}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Group deliberation" }));
    expect(onOpenDeliberation).toHaveBeenCalledTimes(1);
  });
});
