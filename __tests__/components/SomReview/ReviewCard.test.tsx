/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewCard from "../../../src/components/SomReview/ReviewCard";
import { SomReviewCard } from "../../../src/types/ISomReview";

const card: SomReviewCard = {
  proposalId: "title-1",
  datasetVersion: "dataset-1",
  issueType: "title-clarity",
  reviewerView: {
    question: 'Is "Sell Supplies" clearer than "Sell Supply"?',
    currentState: "Current title: Sell Supply",
    proposedState: "Proposed title: Sell Supplies",
    reasoning: "The plural title is more natural.",
    context: {
      type: "title-comparison",
      currentTitle: "Sell Supply",
      proposedTitle: "Sell Supplies",
      linkedTasks: [],
    },
    agreeLabel: "Agree",
    disagreeLabel: "Disagree",
  },
};

describe("Society of Mind review card", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("submits agreement immediately", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ReviewCard card={card} reviewerId="reviewer-1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      decision: "agree",
      disagreementReason: "",
      suggestedCorrection: "",
    });
  });

  it("requires a non-whitespace disagreement reason", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ReviewCard card={card} reviewerId="reviewer-1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Disagree" }));
    const save = screen.getByRole("button", { name: "Save disagreement" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Why do you disagree/i), {
      target: { value: "   " },
    });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Why do you disagree/i), {
      target: { value: "The original title is already clearer." },
    });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      decision: "disagree",
      disagreementReason: "The original title is already clearer.",
    });
  });

  it("does not advance on a failed save and supports retry", async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    render(<ReviewCard card={card} reviewerId="reviewer-1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    expect(
      await screen.findByText("Your answer was not saved. This item is still open."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Sell Supplies",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it("names local drafts by reviewer as well as proposal", () => {
    render(<ReviewCard card={card} reviewerId="reviewer-2" onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Disagree" }));
    fireEvent.change(screen.getByLabelText(/Why do you disagree/i), {
      target: { value: "Needs another title." },
    });
    expect(
      window.sessionStorage.getItem(
        "som-review-draft-reviewer-2-dataset-1-title-1",
      ),
    ).toContain("Needs another title.");
  });
});
