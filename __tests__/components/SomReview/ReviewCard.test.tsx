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
  branch: "Sell",
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
          reviewedAt: "2026-07-24T12:00:00.000Z",
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
        "som-review-draft-reviewer-1-dataset-1-title-1-revise",
      ),
    ).toBeNull();
  });

  it("does not let a stale revision draft replace the saved response", async () => {
    window.sessionStorage.setItem(
      "som-review-draft-reviewer-1-dataset-1-title-1-revise",
      JSON.stringify({
        open: false,
        reason: "",
        correction: "",
      }),
    );

    render(
      <ReviewCard
        card={card}
        reviewerId="reviewer-1"
        mode="revise"
        initialResponse={{
          decision: "disagree",
          disagreementReason: "The saved rationale must remain visible.",
          suggestedCorrection: "Keep the current title.",
          reviewedAt: "2026-07-24T12:00:00.000Z",
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(await screen.findByLabelText(/Why do you disagree/i)).toHaveValue(
      "The saved rationale must remain visible.",
    );
    expect(screen.getByLabelText(/Suggested correction/i)).toHaveValue(
      "Keep the current title.",
    );
    expect(
      window.sessionStorage.getItem(
        "som-review-draft-reviewer-1-dataset-1-title-1-revise",
      ),
    ).toBeNull();
  });

  it("restores an unfinished revision only for the same saved response", () => {
    const initialResponse = {
      decision: "disagree" as const,
      disagreementReason: "The saved rationale.",
      suggestedCorrection: "The saved suggestion.",
      reviewedAt: "2026-07-24T12:00:00.000Z",
    };
    const firstRender = render(
      <ReviewCard
        card={card}
        reviewerId="reviewer-1"
        mode="revise"
        initialResponse={initialResponse}
        onSubmit={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Why do you disagree/i), {
      target: { value: "An unfinished revision." },
    });
    firstRender.unmount();

    render(
      <ReviewCard
        card={card}
        reviewerId="reviewer-1"
        mode="revise"
        initialResponse={initialResponse}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/Why do you disagree/i)).toHaveValue(
      "An unfinished revision.",
    );
  });

  it("shows the placement diagnosis and destination as one move decision", () => {
    const placementCard: SomReviewCard = {
      proposalId: "placement-1",
      datasetVersion: "dataset-1",
      branch: "Sell",
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
    expect(screen.getByText("Proposed location")).toBeInTheDocument();
    expect(
      screen.getByText(
        'This is one complete move decision. Approve only if the current parent is incorrect and "Actors and Activities" is the better parent.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Actors and Activities")).not.toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Approve move" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject proposed move" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/advisory candidate home/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/exact move remains a separate review step/i),
    ).not.toBeInTheDocument();
  });

  it("uses explicit same-activity choices for possible synonyms", () => {
    const synonymCard: SomReviewCard = {
      proposalId: "synonym-1",
      datasetVersion: "dataset-1",
      branch: "Sell",
      issueType: "duplicate-synonym",
      reviewerView: {
        question:
          'Do "Sell products" and "Sell merchandise" name the same activity?',
        currentState: "They are separate activity nodes.",
        proposedState: "Keep one title and record the other as a synonym.",
        reasoning: "Their meanings may be interchangeable.",
        context: {
          type: "duplicate-comparison",
          parentTitle: "Sell",
          canonicalTitle: "Sell products",
          candidateSynonymTitle: "Sell merchandise",
        },
        agreeLabel: "Agree",
        disagreeLabel: "Disagree",
      },
    };

    render(
      <ReviewCard
        card={synonymCard}
        reviewerId="reviewer-1"
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Same activity" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Different activities" }),
    );
    expect(
      screen.getByLabelText(/What meaningfully distinguishes/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save as different activities" }),
    ).toBeDisabled();
  });

  it("shows a missing-node proposal as one exact move, not a broad-parent diagnosis", () => {
    const missingNodeCard: SomReviewCard = {
      proposalId: "missing-node-1",
      datasetVersion: "dataset-1",
      branch: "Sell",
      issueType: "cross-branch-recall",
      reviewerView: {
        question:
          'Should "Rent Equipment" move from "Lease (Physical Object)" to "Rent out" in the Sell sub-branch?',
        currentState:
          '"Rent Equipment" is currently under "Lease (Physical Object)" in the Buy sub-branch.',
        proposedState:
          'Move "Rent Equipment" to "Rent out" in the Sell sub-branch.',
        reasoning:
          "The source task uses rent equipment in the provider-side sense.",
        context: {
          type: "placement-comparison",
          nodeTitle: "Rent Equipment",
          currentParentTitle: "Lease (Physical Object)",
          candidateHome: "Rent out",
          currentPathTitles: [
            "Buy",
            "Rent (pay for time-limited use)",
            "Lease",
            "Lease (Physical Object)",
            "Rent Equipment",
          ],
          proposedPathTitles: [
            "Sell",
            "Sell temporary use",
            "Rent out",
            "Rent Equipment",
          ],
          placementIssue: "missing-from-branch",
          sourceTasks: ["Rent equipment to customers."],
        },
        agreeLabel: "Approve move",
        disagreeLabel: "Keep current location",
      },
    };

    render(
      <ReviewCard
        card={missingNodeCard}
        reviewerId="reviewer-1"
        onSubmit={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/incorrect parent for its provider-side meaning/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/parent that is too broad/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve move" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject proposed move" }),
    ).toBeInTheDocument();
  });

  it("does not repeat generic state panels when the context has before and after panels", () => {
    const metadataCard: SomReviewCard = {
      proposalId: "metadata-1",
      datasetVersion: "dataset-1",
      branch: "Sell",
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
