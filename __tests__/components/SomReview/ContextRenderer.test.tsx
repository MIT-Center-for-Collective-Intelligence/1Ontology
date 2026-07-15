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

  it("places the advisory destination in a quiet bottom note", () => {
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
    expect(
      screen.getByText("Possible new home to review next:"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rent out")).toBeInTheDocument();
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

  it("shows the complete before and after effect of an exact merge", () => {
    render(
      <ContextRenderer
        context={{
          type: "merge-action",
          parentTitle: "Sell",
          canonicalTitle: "Sell information",
          canonicalCollection: "Sell what?",
          canonicalChildren: [],
          absorbedTitle: "Sell (Information)",
          absorbedCollection: "Sell -- miscellaneous",
          absorbedChildren: ["Sell Contract", "Sell Policy"],
          resultingChildren: ["Sell Contract", "Sell Policy"],
          absorbedBecomesSynonym: true,
        }}
      />,
    );
    expect(screen.getByLabelText("Nodes before merge")).toHaveTextContent(
      "Sell (Information)",
    );
    expect(screen.getByLabelText("Node after merge")).toHaveTextContent(
      "Synonym: Sell (Information)",
    );
    expect(screen.getAllByText("Sell Contract")).toHaveLength(2);
  });

  it("renders exact relocation, addition, and wrapper-removal actions", () => {
    const { rerender } = render(
      <ContextRenderer
        context={{
          type: "relocation-action",
          nodeTitle: "Sell Ticket",
          currentParentTitle: "Sell physical objects",
          currentCollection: "main",
          proposedParentTitle: "Sell service",
          proposedCollection: "main",
          childTitles: ["Ticket source task"],
        }}
      />,
    );
    expect(
      screen.getByLabelText("Placement before relocation"),
    ).toHaveTextContent("Sell physical objects");
    expect(
      screen.getByLabelText("Placement after relocation"),
    ).toHaveTextContent("Sell service");

    rerender(
      <ContextRenderer
        context={{
          type: "addition-action",
          parentTitle: "Sell (Physical Object)",
          proposedTitle: "Sell Furniture",
          description: "Sell movable furnishings.",
          examples: ["a sofa"],
        }}
      />,
    );
    expect(screen.getByLabelText("Ontology after addition")).toHaveTextContent(
      "Sell Furniture",
    );

    rerender(
      <ContextRenderer
        context={{
          type: "merge-up-action",
          parentTitle: "Sell",
          parentCollection: "Sell -- miscellaneous",
          nodeTitle: "Sell (Other)",
          childTitles: ["Sell Products or Ideas"],
        }}
      />,
    );
    expect(
      screen.getByLabelText("Hierarchy before wrapper removal"),
    ).toHaveTextContent("Sell (Other)");
    expect(
      screen.getByLabelText("Hierarchy after wrapper removal"),
    ).not.toHaveTextContent("Sell (Other)");
  });
});
