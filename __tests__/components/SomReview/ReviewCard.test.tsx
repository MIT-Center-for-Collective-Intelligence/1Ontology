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
    render(
      <ReviewCard card={card} reviewerId="reviewer-1" onSubmit={onSubmit} />,
    );
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
    render(
      <ReviewCard card={card} reviewerId="reviewer-1" onSubmit={onSubmit} />,
    );
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
    render(
      <ReviewCard card={card} reviewerId="reviewer-1" onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    expect(
      await screen.findByText(
        "Your answer was not saved. This item is still open.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Sell Supplies",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it("names local drafts by reviewer as well as proposal", () => {
    render(
      <ReviewCard card={card} reviewerId="reviewer-2" onSubmit={jest.fn()} />,
    );
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

  it("reopens a prior disagreement with its explanation", () => {
    render(
      <ReviewCard
        card={card}
        reviewerId="reviewer-1"
        mode="revise"
        initialResponse={{
          decision: "disagree",
          disagreementReason: "The original title is more precise.",
          suggestedCorrection: "Keep Sell Supply.",
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/Why do you disagree/i)).toHaveValue(
      "The original title is more precise.",
    );
    expect(screen.getByLabelText(/Suggested correction/i)).toHaveValue(
      "Keep Sell Supply.",
    );
    expect(
      screen.getByRole("button", { name: "Save revised answer" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Choose a different answer" }),
    ).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem(
        "som-review-draft-reviewer-1-dataset-1-title-1",
      ),
    ).toBeNull();
  });

  it("keeps downstream placement details out of the diagnosis", () => {
    const placementCard: SomReviewCard = {
      proposalId: "placement-1",
      datasetVersion: "dataset-1",
      issueType: "placement",
      reviewerView: {
        question: 'Is "Sell Service" misplaced under "Sell (Information)"?',
        currentState: "Sell Service is currently under Sell (Information).",
        proposedState:
          "Mark Sell Service as misplaced here. Advisory candidate home: Actors and Activities. The exact move remains a separate human decision.",
        reasoning: "A service is an activity rather than information.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Sell Service",
          currentParentTitle: "Sell (Information)",
          currentBucket: "Information",
          candidateHome: "Actors and Activities",
          placementIssue: "wrong-bucket",
        },
        agreeLabel: "Agree",
        disagreeLabel: "Disagree",
      },
    };

    render(
      <ReviewCard
        card={placementCard}
        reviewerId="reviewer-1"
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("Current location")).toBeInTheDocument();
    expect(screen.getByText("Recommended finding")).toBeInTheDocument();
    expect(
      screen.getByText(
        "If you agree that this activity is misplaced, its appropriate location will be reviewed in a separate step.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Actors and Activities")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Yes, misplaced" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No, keep here" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/advisory candidate home/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/exact move remains a separate human decision/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/agreeing only marks the current placement/i),
    ).not.toBeInTheDocument();
  });

  it("does not repeat generic state panels when the context has before and after panels", () => {
    const metadataCard: SomReviewCard = {
      proposalId: "metadata-1",
      datasetVersion: "dataset-1",
      issueType: "description-enrichment",
      reviewerView: {
        question: "Should this description be added?",
        currentState: "GENERIC CURRENT STATE",
        proposedState: "GENERIC PROPOSED STATE",
        reasoning: "The source task supports this description.",
        context: {
          type: "metadata-edit",
          nodeTitle: "Sell Product",
          field: "description",
          currentText: "",
          proposedText: "Transfer a product to a buyer for payment.",
          sourceTasks: [],
        },
        agreeLabel: "Agree",
        disagreeLabel: "Disagree",
      },
    };

    render(
      <ReviewCard
        card={metadataCard}
        reviewerId="reviewer-1"
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.queryByText("GENERIC CURRENT STATE")).not.toBeInTheDocument();
    expect(
      screen.queryByText("GENERIC PROPOSED STATE"),
    ).not.toBeInTheDocument();
  });
});
