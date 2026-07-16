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

  it("shows repeated source tasks only once", () => {
    render(
      <ContextRenderer
        context={{
          type: "title-comparison",
          currentTitle: "Sell Product",
          proposedTitle: "Sell Products",
          linkedTasks: [
            "Sell products or services.",
            "Sell products or services.",
            "  Sell products or services.  ",
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show source task" }));
    expect(screen.getAllByText("Sell products or services.")).toHaveLength(1);
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

  it("keeps the destination out of a placement diagnosis", () => {
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
      screen.getByText(
        "If you agree that this activity is misplaced, its appropriate location will be reviewed in a separate step.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rent out")).not.toBeInTheDocument();
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
    expect(screen.getAllByText("Collection: Default")).toHaveLength(2);

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

  it("distinguishes structured synonym additions from recorded-synonym cleanup", () => {
    const { rerender } = render(
      <ContextRenderer
        context={{
          type: "metadata-edit",
          nodeTitle: "Lease out",
          field: "synonyms",
          synonymScope: "structured-field",
          currentValues: [],
          proposedValues: ["Lease"],
          sourceTasks: [],
        }}
      />,
    );
    expect(screen.getByText("Current structured synonyms")).toBeInTheDocument();
    expect(
      screen.getByText("Proposed structured synonyms"),
    ).toBeInTheDocument();

    rerender(
      <ContextRenderer
        context={{
          type: "metadata-edit",
          nodeTitle: "Sell Accessory",
          field: "synonyms",
          synonymScope: "all-recorded",
          currentValues: ["Market Accessory"],
          proposedValues: [],
          sourceTasks: ["Sell and install accessories."],
        }}
      />,
    );
    expect(screen.getByText("Current recorded synonyms")).toBeInTheDocument();
    expect(
      screen.getByText("Recorded synonyms after this change"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Sell and install accessories."),
    ).not.toBeInTheDocument();
  });

  it("shows the two meanings in a polysemy diagnosis", () => {
    render(
      <ContextRenderer
        context={{
          type: "polysemy-review",
          nodeTitle: "Sell Products or Ideas",
          currentParentTitle: "Sell (Other)",
          sourceTasks: ["Selling or Influencing Others"],
          proposedSenses: [
            {
              title: "Sell Product",
              meaning: "Transfer a product for payment.",
              destination: "Sell (Physical Object)",
            },
            {
              title: "Persuade",
              meaning: "Influence someone to accept an idea.",
              destination: "Persuade",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByLabelText("Meaning before separation"),
    ).toHaveTextContent("Sell Products or Ideas");
    expect(
      screen.getByLabelText("Meanings after separation"),
    ).toHaveTextContent("Sell Product");
    expect(
      screen.getByLabelText("Meanings after separation"),
    ).toHaveTextContent("Persuade");
    expect(screen.queryByText(/proposed home/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Sell (Physical Object)"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/where each meaning belongs will be reviewed/i),
    ).toBeInTheDocument();
  });

  it("renders collection design and the gated sense move as concrete outcomes", () => {
    const { rerender } = render(
      <ContextRenderer
        context={{
          type: "collection-design",
          parentTitle: "Sell",
          currentChildren: ["Lease out", "Rent out"],
          proposedCollectionName: "Sell what kind of usage?",
          proposedBranches: [
            { title: "Sell ownership", status: "new", children: [] },
            {
              title: "Sell temporary use",
              status: "new",
              children: ["Lease out", "Rent out"],
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByLabelText("Collections after redesign"),
    ).toHaveTextContent("Sell what kind of usage?");
    expect(screen.getByText("Sell temporary use")).toBeInTheDocument();

    rerender(
      <ContextRenderer
        context={{
          type: "sense-relocation-action",
          nodeTitle: "Sell Products or Ideas",
          currentParentTitle: "Sell (Other)",
          currentCollection: "main",
          sourceTasks: ["Selling or Influencing Others"],
          retainedSenseTitle: "Sell Product",
          retainedParentTitle: "Sell (Physical Object)",
          movedSenseTitle: "Persuade about an idea",
          proposedParentTitle: "Persuade",
        }}
      />,
    );
    expect(
      screen.getByLabelText("Separated senses after relocation"),
    ).toHaveTextContent("Sell Product");
    expect(
      screen.getByLabelText("Separated senses after relocation"),
    ).toHaveTextContent("Persuade about an idea");
  });
});
