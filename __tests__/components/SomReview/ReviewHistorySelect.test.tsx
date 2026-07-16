/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewHistorySelect from "../../../src/components/SomReview/ReviewHistorySelect";
import { SomReviewHistoryItem } from "../../../src/types/ISomReview";

const history: SomReviewHistoryItem[] = [
  {
    proposalId: "proposal-1",
    proposalIndex: 0,
    question: "Should the first proposed grouping be created?",
    decision: "agree",
    disagreementReason: "",
    suggestedCorrection: "",
    reviewedAt: "2026-07-15T12:00:00.000Z",
  },
  {
    proposalId: "proposal-2",
    proposalIndex: 1,
    question: "Is the second activity misplaced?",
    decision: "disagree",
    disagreementReason: "It belongs here.",
    suggestedCorrection: "",
    reviewedAt: "2026-07-15T12:01:00.000Z",
  },
];

describe("Review history selector", () => {
  it("does not reserve toolbar space before the first review", () => {
    render(
      <ReviewHistorySelect
        history={[]}
        selectedProposalId=""
        onSelect={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Revise an earlier review" }),
    ).not.toBeInTheDocument();
  });

  it("lists readable prior proposals and selects one for revision", () => {
    const onSelect = jest.fn();
    render(
      <ReviewHistorySelect
        history={history}
        selectedProposalId=""
        onSelect={onSelect}
      />,
    );

    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Revise an earlier review" }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: /Item 2: Is the second activity misplaced\? Current answer: Disagreed/,
      }),
    );

    expect(onSelect).toHaveBeenCalledWith("proposal-2");
  });

  it("shows which prior item is being revised", () => {
    render(
      <ReviewHistorySelect
        history={history}
        selectedProposalId="proposal-2"
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText("Revising item 2")).toBeInTheDocument();
  });
});
