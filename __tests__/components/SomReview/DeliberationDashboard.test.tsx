/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import DeliberationDashboard from "../../../src/components/SomReview/DeliberationDashboard";
import { SomDeliberationOverviewResponse } from "../../../src/types/ISomReview";

const aggregate = {
  recommendation: "needs-deliberation" as const,
  quorumMet: true,
  totalResponses: 4,
  coreResponses: 3,
  allWeightedSupport: 0.6,
  coreWeightedSupport: 0.5,
  stewardSplit: false,
  stewardDissent: false,
  roleSummaries: [],
};

const overview: SomDeliberationOverviewResponse = {
  datasetVersion: "dataset-1",
  access: {
    role: "researcher",
    roleLabel: "Research team",
    canFinalize: false,
  },
  remainingIndependentReviews: 3,
  roleWeights: [
    { role: "steward", label: "Senior steward", weight: 4 },
    { role: "researcher", label: "Research team", weight: 2 },
    { role: "contributor", label: "Contributing reviewer", weight: 1 },
  ],
  proposals: [
    {
      proposalId: "proposal-1",
      issueType: "title-clarity",
      question: "Is Sell Supplies clearer?",
      currentState: "Sell Supply",
      proposedState: "Sell Supplies",
      aggregate,
      commentCount: 2,
    },
    {
      proposalId: "proposal-2",
      issueType: "placement",
      question: "Is Lease out misplaced?",
      currentState: "Sell",
      proposedState: "Review placement",
      aggregate: {
        ...aggregate,
        recommendation: "ready-to-reject",
        allWeightedSupport: 0.2,
        coreWeightedSupport: 0.2,
      },
      commentCount: 0,
    },
  ],
};

describe("Society of Mind deliberation dashboard", () => {
  it("shows private weights and opens an attention item", () => {
    const onOpen = jest.fn();
    render(<DeliberationDashboard overview={overview} onOpen={onOpen} />);
    expect(screen.getByText("Senior steward: 4x")).toBeInTheDocument();
    expect(screen.getByText("Research team: 2x")).toBeInTheDocument();
    expect(screen.getByText("Contributing reviewer: 1x")).toBeInTheDocument();
    expect(
      screen.getByText(/3 proposals remain in your independent review/),
    ).toBeInTheDocument();
    expect(screen.getByText("Is Sell Supplies clearer?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(
      screen.getByRole("button", {
        name: "Open deliberation: Is Lease out misplaced?",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open deliberation: Is Sell Supplies clearer?",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith("proposal-1");
  });

  it("filters ready proposals", () => {
    render(<DeliberationDashboard overview={overview} onOpen={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getByText("Is Lease out misplaced?")).toBeInTheDocument();
    expect(
      screen.queryByText("Is Sell Supplies clearer?"),
    ).not.toBeInTheDocument();
  });
});
