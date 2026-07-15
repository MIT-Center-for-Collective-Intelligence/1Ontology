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

  it("keeps the current children alphabetized and labels only the after split", () => {
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
    const currentPanel = screen.getByLabelText("Current grouping");
    const currentRows = Array.from(
      currentPanel.querySelectorAll("[data-outline-item]"),
    );
    expect(
      currentRows.map((row) => row.getAttribute("data-outline-item")),
    ).toEqual(["Sell Bicycle", "Sell Equipment", "Sell Food", "Sell Tobacco"]);
    expect(
      currentRows.map((row) => row.getAttribute("data-highlighted")),
    ).toEqual(["false", "false", "true", "true"]);
    expect(
      screen.getByText("Children not included in the new grouping"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unchanged direct children"),
    ).not.toBeInTheDocument();
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

  it("renders duplicate judgments without an unnecessary process note", () => {
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
    expect(
      screen.queryByText(/merge|delete|downstream/i),
    ).not.toBeInTheDocument();
  });

  it("does not repeat placement details below the decision panels", () => {
    const { container } = render(
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
    expect(container).toBeEmptyDOMElement();
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
