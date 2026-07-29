/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InspectionItemCard from "../../../src/components/SomReview/InspectionItemCard";
import { SomInspectionItem } from "../../../src/types/ISomReview";

const reviewedItem: SomInspectionItem = {
  datasetId: "sell-initial-review",
  datasetLabel: "Initial review",
  currentRound: false,
  issueLabel: "4. Undetected synonyms",
  proposalIndex: 0,
  recordSource: "proposed-change",
  currentlyApplicable: true,
  card: {
    proposalId: "synonym-1",
    datasetVersion: "sell-v1",
    branch: "Sell",
    issueType: "duplicate-synonym",
    proposalIndex: 0,
    reviewerView: {
      question: "Should these two activity nodes be treated as synonyms?",
      currentState: "Two separate nodes",
      proposedState: "One canonical node with a synonym",
      reasoning: "Their meanings and task evidence overlap.",
      context: {
        type: "duplicate-comparison",
        parentTitle: "Sell",
        canonicalTitle: "Sell cosmetics",
        candidateSynonymTitle: "Sell makeup",
      },
      agreeLabel: "Merge as synonyms",
      disagreeLabel: "Keep separate",
    },
  },
  subjectResponse: {
    decision: "disagree",
    disagreementReason: "The activities differ in this ontology.",
    suggestedCorrection: "Keep both nodes and clarify their descriptions.",
    reviewedAt: "2026-07-28T12:00:00.000Z",
  },
};

describe("InspectionItemCard", () => {
  it("keeps the prior response visible and opens a separate not-aligned note", () => {
    render(
      <InspectionItemCard
        item={reviewedItem}
        reviewerName="Rob"
        onSaveException={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Should these two activity nodes be treated as synonyms?",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Rob selected Keep separate")).toBeVisible();
    expect(
      screen.getByText("The activities differ in this ontology."),
    ).toBeVisible();
    expect(
      screen.getByText("Keep both nodes and clarify their descriptions."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Mark not aligned" }));

    expect(
      screen.getByText("This does not overwrite Rob's response."),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /Why are you not aligned/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "Suggested alternative (optional)",
      }),
    ).toBeVisible();
  });

  it("lets a reviewer inspect their own response without self-annotation", () => {
    render(
      <InspectionItemCard
        item={reviewedItem}
        reviewerName="Rob"
        canAnnotate={false}
        onSaveException={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Rob selected Keep separate")).toBeVisible();
    expect(screen.getByText(/This is your own response/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Mark not aligned" }),
    ).toBeNull();
  });
});
