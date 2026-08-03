/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ContextRenderer from "../../../src/components/SomReview/ContextRenderer";

describe("Society of Mind context renderers", () => {
  it("shows title evidence by default and lets the reviewer collapse it", () => {
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
      screen.getByText("Recommend and sell lotions or tonics."),
    ).toBeInTheDocument();
    const collapseButton = screen.getByRole("button", {
      name: "Hide source O*NET evidence",
    });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapseButton);
    const expandButton = screen.getByRole("button", {
      name: "Show source O*NET evidence",
    });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expandButton);
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

    expect(screen.getAllByText("Sell products or services.")).toHaveLength(1);
  });

  it("shows a title split with numbered evidence and existing-node status", () => {
    render(
      <ContextRenderer
        context={{
          type: "title-split",
          currentTitle: "Sell Product",
          linkedTasks: ["Sell agricultural products.", "Sell products."],
          proposedNodes: [
            {
              title: "Sell Agricultural Products",
              status: "new",
              sourceTaskIndexes: [1],
              sourceTasks: ["Sell agricultural products."],
              reason: "The source names a restricted product category.",
            },
            {
              title: "Sell Products",
              status: "existing",
              sourceTaskIndexes: [2],
              sourceTasks: ["Sell products."],
              reason: "The generic source belongs with the existing node.",
            },
          ],
          deferredTaskIndexes: [],
          deferredTasks: [],
        }}
      />,
    );

    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("New node")).toBeInTheDocument();
    expect(screen.getByText("Already in ontology")).toBeInTheDocument();
    expect(screen.getByText("Uses source item 1")).toBeInTheDocument();
    expect(screen.getByText("Uses source item 2")).toBeInTheDocument();
    expect(screen.getAllByText("Sell agricultural products.")).toHaveLength(1);
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
          parentTitle: "Sell physical objects",
          canonicalParentTitle: "Sell (Other)",
          candidateParentTitle: "Sell physical objects",
          canonicalTitle: "Sell Products",
          candidateSynonymTitle: "Sell Merchandise",
          sourceTasks: ["Sell products to customers."],
        }}
      />,
    );
    expect(
      screen.getByLabelText("Separate node before synonym change"),
    ).toHaveTextContent(
      "Sell MerchandiseSeparate node under Sell physical objects",
    );
    expect(
      screen.getByLabelText("Proposed synonym relationship"),
    ).toHaveTextContent(
      "Sell ProductsKeep under Sell (Other) and record Sell Merchandise as a synonym",
    );
    expect(screen.getByText("Sell products to customers.")).toBeInTheDocument();
    expect(
      screen.queryByText(/merge|delete|downstream/i),
    ).not.toBeInTheDocument();
  });

  it("shows the suggested destination while preserving a separate move step", () => {
    render(
      <ContextRenderer
        context={{
          type: "placement-comparison",
          nodeTitle: "Lease out",
          currentParentTitle: "Sell",
          currentBucket: "Unknown",
          candidateHome: "Rent out",
          placementIssue: "wrong-parent",
          sourceTasks: ["Rent merchandise to customers."],
        }}
      />,
    );
    expect(
      screen.getByText(
        'The suggested category is "Rent out". Agreeing confirms that the current parent is too broad. The exact move remains a separate review step.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rent out/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide source O*NET evidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Rent merchandise to customers."),
    ).toBeInTheDocument();
  });

  it("explains a whole-ontology recall candidate without reversing its direction", () => {
    render(
      <ContextRenderer
        context={{
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
          sourceTasks: ["Sell or rent equipment to customers."],
        }}
        branch="Sell"
      />,
    );

    expect(
      screen.getByText(
        /compare the source evidence with both hierarchy locations/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Current hierarchy location"),
    ).toHaveTextContent(
      "BuyRent (pay for time-limited use)LeaseLease (Physical Object)Rent Equipment",
    );
    expect(
      screen.getByLabelText("Proposed hierarchy location"),
    ).toHaveTextContent("SellSell temporary useRent outRent Equipment");
    expect(
      screen.queryByText(/exact move remains a separate review step/i),
    ).not.toBeInTheDocument();
  });

  it("shows the exact evidence reassignment for a specific Sell activity", () => {
    render(
      <ContextRenderer
        context={{
          type: "evidence-specialization",
          genericNodeTitle: "Sell Products",
          sourceTask: "(O*Net) 1 - Buy or sell non-pharmaceutical merchandise.",
          currentParentTitles: ["Buy Merchandise", "Sell Products"],
          proposedTitle: "Sell Non-Pharmaceutical Merchandise",
          proposedTitleStatus: "new",
          targetParentTitle: "Sell Products",
          removedParentTitles: ["Sell Products"],
          retainedParentTitles: ["Buy Merchandise"],
        }}
      />,
    );

    expect(
      screen.getByText(
        "(O*Net) 1 - Buy or sell non-pharmaceutical merchandise.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sell Non-Pharmaceutical Merchandise"),
    ).toBeInTheDocument();
    expect(screen.getByText("New activity")).toBeInTheDocument();
    expect(
      screen.getByText("Remove generic parent: Sell Products"),
    ).toBeVisible();
  });

  it("renders empty-node removal without pretending children move upward", () => {
    render(
      <ContextRenderer
        context={{
          type: "empty-node-action",
          parentTitle: "Sell",
          parentCollection: "Sell -- miscellaneous",
          nodeTitle: "Sell (Other)",
        }}
      />,
    );

    expect(
      screen.getByLabelText("Hierarchy before empty-node removal"),
    ).toHaveTextContent("No direct children or source evidence");
    expect(
      screen.getByLabelText("Hierarchy after empty-node removal"),
    ).toHaveTextContent("Sell (Other) removed");
  });

  it("renders empty-collection removal as a collection-only change", () => {
    render(
      <ContextRenderer
        context={{
          type: "empty-collection-action",
          parentTitle: "Sell",
          collectionName: "Sell how?",
        }}
      />,
    );

    expect(
      screen.getByLabelText("Hierarchy before empty-collection removal"),
    ).toHaveTextContent("Named collection with no member nodes");
    expect(
      screen.getByLabelText("Hierarchy after empty-collection removal"),
    ).toHaveTextContent('Collection "Sell how?" removed');
  });

  it("lists every activity covered by a grouped wrong-verb diagnosis", () => {
    render(
      <ContextRenderer
        context={{
          type: "placement-comparison",
          nodeTitle: "Market Artwork",
          currentParentTitle: "Sell information",
          candidateHome: "Promote",
          sharedAction: "Market",
          affectedNodes: [
            {
              nodeTitle: "Market Artwork",
              currentParentTitle: "Sell information",
            },
            {
              nodeTitle: "Market Vacant Space",
              currentParentTitle: "Sell physical objects",
            },
          ],
          placementIssue: "wrong-verb",
        }}
      />,
    );

    expect(screen.getByText("Affected activities")).toBeInTheDocument();
    expect(screen.getByText("Market Artwork")).toBeInTheDocument();
    expect(screen.getByText("Market Vacant Space")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Agreeing confirms the shared diagnosis.*Each exact move remains a separate review step/,
      ),
    ).toBeInTheDocument();
  });

  it("shows an evidence task retaining justified parents while removing only the stale parent", () => {
    render(
      <ContextRenderer
        context={{
          type: "evidence-parent-allocation",
          taskTitle:
            "(O*Net) 18843 - Sell funeral services, products, or merchandise to clients.",
          currentParentTitles: [
            "Sell Funeral Products",
            "Sell Products",
            "Sell Services",
          ],
          assignedOutputTitles: ["Sell Funeral Products"],
          retainedParentTitles: ["Sell Services"],
          removedParentTitles: ["Sell Products"],
        }}
      />,
    );

    expect(screen.getByLabelText("Evidence parents before")).toHaveTextContent(
      "Sell Funeral ProductsSell ProductsSell Services",
    );
    expect(screen.getByLabelText("Evidence parents after")).toHaveTextContent(
      "Sell Funeral ProductsSell ServicesRemove stale parent: Sell Products",
    );
    expect(
      screen.getByText(
        /may retain multiple parents.*removes only the named stale parent/i,
      ),
    ).toBeInTheDocument();
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
          canonicalParentTitle: "Sell what?",
          absorbedParentTitle: "Sell",
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
    expect(screen.getByLabelText("Nodes before merge")).toHaveTextContent(
      "Under Sell what?",
    );
    expect(screen.getByLabelText("Nodes before merge")).toHaveTextContent(
      "Under Sell",
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
    const beforePanel = screen.getByLabelText("Metadata before change");
    expect(beforePanel).toHaveTextContent("Market Accessory");
    expect(beforePanel).toHaveTextContent("Recorded as a synonym of");
    expect(beforePanel).toHaveTextContent("Sell Accessory");
    const afterPanel = screen.getByLabelText("Metadata after change");
    expect(afterPanel).toHaveTextContent("Remove Market Accessory");
    expect(afterPanel).toHaveTextContent(
      "from the synonyms recorded for Sell Accessory",
    );
    expect(
      screen.getByText("Recorded synonyms after this change"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sell and install accessories."),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText("Selling or Influencing Others"),
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
    expect(screen.getAllByText("Proposed new activity")).toHaveLength(2);
    expect(
      screen.getByText(/cannot be applied as a collection-only change/i),
    ).toBeInTheDocument();

    rerender(
      <ContextRenderer
        context={{
          type: "collection-design",
          parentTitle: "Sell",
          currentChildren: ["Sell Products", "Rent out"],
          proposedCollectionName: "Sell what kind of usage?",
          proposedBranches: [
            { title: "Sell Products", status: "existing", children: [] },
            { title: "Rent out", status: "existing", children: [] },
          ],
        }}
      />,
    );
    expect(screen.queryByText("Proposed new activity")).not.toBeInTheDocument();
    expect(
      screen.getByText(/only assigns existing direct children/i),
    ).toBeInTheDocument();

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
