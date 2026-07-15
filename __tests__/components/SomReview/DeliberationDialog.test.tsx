/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import DeliberationDialog from "../../../src/components/SomReview/DeliberationDialog";
import { SomDeliberationProposalResponse } from "../../../src/types/ISomReview";

const detail: SomDeliberationProposalResponse = {
  datasetVersion: "dataset-1",
  access: {
    role: "researcher",
    roleLabel: "Research team",
    canFinalize: false,
  },
  card: {
    proposalId: "proposal-1",
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
  },
  aggregate: {
    recommendation: "ready-to-accept",
    quorumMet: true,
    totalResponses: 2,
    coreResponses: 2,
    allWeightedSupport: 2 / 3,
    coreWeightedSupport: 2 / 3,
    stewardSplit: false,
    stewardDissent: false,
    roleSummaries: [
      {
        role: "steward",
        label: "Senior steward",
        weight: 4,
        responses: 1,
        agree: 1,
        disagree: 0,
      },
      {
        role: "researcher",
        label: "Research team",
        weight: 2,
        responses: 1,
        agree: 0,
        disagree: 1,
      },
    ],
  },
  participants: [
    {
      reviewerId: "tom",
      displayName: "Thomas Malone",
      role: "steward",
      roleLabel: "Senior steward",
      weight: 4,
      originalDecision: "agree",
      effectiveDecision: "agree",
      revised: false,
      rationale: "",
      reviewedAt: "2026-07-15T12:00:00.000Z",
    },
    {
      reviewerId: "researcher",
      displayName: "Researcher One",
      role: "researcher",
      roleLabel: "Research team",
      weight: 2,
      originalDecision: "disagree",
      effectiveDecision: "disagree",
      revised: false,
      rationale: "The original title is sufficient.",
      reviewedAt: "2026-07-15T12:05:00.000Z",
    },
  ],
  comments: [],
  myOriginalDecision: "disagree",
  myEffectiveDecision: "disagree",
};

describe("Society of Mind deliberation dialog", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });
  });

  it("shows identities and private weights only inside the admin dialog", () => {
    render(
      <DeliberationDialog
        open
        loading={false}
        detail={detail}
        loadError=""
        onClose={jest.fn()}
        onRefresh={jest.fn()}
        onComment={jest.fn()}
        onPosition={jest.fn()}
        onResolve={jest.fn()}
      />,
    );
    expect(screen.getByText("Thomas Malone")).toBeInTheDocument();
    expect(screen.getByText("Senior steward · 4x")).toBeInTheDocument();
    expect(screen.getByText("Research team · 2x")).toBeInTheDocument();
    expect(screen.queryByText("Final resolution")).not.toBeInTheDocument();
  });

  it("submits a structured discussion comment", async () => {
    const onComment = jest.fn().mockResolvedValue(undefined);
    render(
      <DeliberationDialog
        open
        loading={false}
        detail={detail}
        loadError=""
        onClose={jest.fn()}
        onRefresh={jest.fn()}
        onComment={onComment}
        onPosition={jest.fn()}
        onResolve={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Discussion comment"), {
      target: { value: "Can we verify this against the linked task?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(onComment).toHaveBeenCalledWith(
        "question",
        "Can we verify this against the linked task?",
      ),
    );
  });
});
