/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ContextRenderer from "../../../src/components/SomReview/ContextRenderer";

describe("Society of Mind context renderers", () => {
  it("keeps title evidence collapsed until requested", () => {
    render(
      <ContextRenderer
        context={{
          type: "title-comparison",
          currentTitle: "Sell Tonic",
          proposedTitle: "Sell Cosmetic Supplies",
          linkedTasks: ["Recommend and sell lotions or tonics."],
        }}
      />,
    );
    expect(
      screen.queryByText("Recommend and sell lotions or tonics."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show source task" }));
    expect(
      screen.getByText("Recommend and sell lotions or tonics."),
    ).toBeInTheDocument();
  });

  it("shows unchanged direct children in both grouping panels", () => {
    render(
      <ContextRenderer
        context={{
          type: "grouping-outline",
          parentTitle: "Sell Physical Objects",
          structure: "intermediate",
          proposedGroupTitle: "Sell Regulated Consumables",
          proposedChildren: ["Sell Food", "Sell Tobacco"],
          unaffectedChildren: ["Sell Bicycle", "Sell Equipment"],
        }}
      />,
    );
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(
      screen.getByText("Proposed new group (not currently in the ontology)"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unchanged direct children")).toHaveLength(2);
    expect(screen.getAllByText("Sell Bicycle")).toHaveLength(2);
    expect(screen.getAllByText("Sell Equipment")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /unchanged/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the flat-list control", () => {
    render(
      <ContextRenderer
        context={{
          type: "flat-list",
          parentTitle: "Sell Information",
          currentChildren: ["Sell Policies", "Sell Contracts"],
        }}
      />,
    );
    expect(screen.getByText("Current direct children")).toBeInTheDocument();
    expect(screen.getByText("Sell Policies")).toBeInTheDocument();
  });

  it("renders duplicate judgments without authorizing a merge", () => {
    render(
      <ContextRenderer
        context={{
          type: "duplicate-comparison",
          parentTitle: "Sell",
          canonicalTitle: "Sell Products",
          candidateSynonymTitle: "Sell Merchandise",
        }}
      />,
    );
    expect(screen.getByText("Sell Products")).toBeInTheDocument();
    expect(screen.getByText("Sell Merchandise")).toBeInTheDocument();
    expect(screen.getByText(/does not merge or delete/i)).toBeInTheDocument();
  });

  it("renders placement details without authorizing movement", () => {
    render(
      <ContextRenderer
        context={{
          type: "placement-comparison",
          nodeTitle: "Lease out",
          currentParentTitle: "Sell",
          currentBucket: "Unknown",
          candidateHome: "Rent out",
          placementIssue: "wrong-parent",
        }}
      />,
    );
    expect(screen.getByText("Lease out")).toBeInTheDocument();
    expect(screen.getByText("Current parent")).toBeInTheDocument();
    expect(screen.getByText("Current object category")).toBeInTheDocument();
    expect(screen.getByText(/does not move the activity/i)).toBeInTheDocument();
  });

  it("renders structural overlap details without authorizing a merge", () => {
    render(
      <ContextRenderer
        context={{
          type: "overlap-comparison",
          parentTitle: "Sell",
          firstCollection: "Miscellaneous",
          firstTitle: "Sell Physical Object",
          secondCollection: "Sell what?",
          secondTitle: "Sell physical objects",
        }}
      />,
    );
    expect(screen.getByText("Sell Physical Object")).toBeInTheDocument();
    expect(screen.getByText("Sell physical objects")).toBeInTheDocument();
    expect(
      screen.getByText(/does not merge either activity/i),
    ).toBeInTheDocument();
  });
});
