/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import OntologyComparisonPanel from "../../../src/components/SomReview/OntologyComparisonPanel";
import { Post } from "../../../src/lib/utils/Post";
import { SomOntologyOutlineResponse } from "../../../src/types/ISomReview";

jest.mock("../../../src/lib/utils/Post", () => ({
  Post: jest.fn(),
}));

const outlineResponse: SomOntologyOutlineResponse = {
  datasetId: "buy-current",
  workspaceId: "buy",
  branch: "Buy",
  currentRound: true,
  original: {
    ontologyName: "Original ontology",
    capturedAt: "2026-07-20T00:00:00.000Z",
    rootNodeId: "original-root",
    rootTitle: "Buy",
    nodes: [
      { id: "original-root", title: "Buy", evidence: false },
      { id: "original-child", title: "Purchase product", evidence: false },
      {
        id: "original-evidence",
        title: "(O*Net) Purchase task",
        evidence: true,
      },
    ],
    edges: [
      {
        parentId: "original-root",
        childId: "original-child",
        collectionName: "commerce",
      },
      {
        parentId: "original-root",
        childId: "original-evidence",
        collectionName: "evidence",
      },
    ],
  },
  selected: {
    ontologyName: "Current ontology",
    capturedAt: "2026-07-25T00:00:00.000Z",
    rootNodeId: "current-root",
    rootTitle: "Buy",
    nodes: [
      { id: "current-root", title: "Buy", evidence: false },
      { id: "current-child", title: "Purchase goods", evidence: false },
    ],
    edges: [
      {
        parentId: "current-root",
        childId: "current-child",
        collectionName: "commerce",
      },
    ],
  },
};

describe("ontology comparison panel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Post as jest.Mock).mockResolvedValue(outlineResponse);
  });

  it("loads lazily and presents the original and current outlines side by side", async () => {
    render(
      <OntologyComparisonPanel
        datasetId="buy-current"
        branch="Buy"
        roundLabel="Current Buy round"
        currentRound
      />,
    );

    expect(Post).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: /Compare Buy hierarchy/i }),
    );

    await waitFor(() =>
      expect(Post).toHaveBeenCalledWith(
        "/som-review/outline",
        { datasetId: "buy-current" },
        false,
      ),
    );
    expect(
      screen.getByRole("region", { name: "Original ontology outline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Current ontology outline" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("commerce")).toHaveLength(2);
    expect(screen.getAllByLabelText("Collection: commerce")).toHaveLength(2);
    expect(
      screen
        .getAllByLabelText("Collection: commerce")
        .every(
          (collection) =>
            collection.getAttribute("data-outline-kind") === "collection",
        ),
    ).toBe(true);
    expect(screen.queryByText("(O*Net) Purchase task")).not.toBeInTheDocument();
  });

  it("reveals O*NET evidence only when the reviewer requests it", async () => {
    render(
      <OntologyComparisonPanel
        datasetId="buy-current"
        branch="Buy"
        roundLabel="Current Buy round"
        currentRound
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Compare Buy hierarchy/i }),
    );

    const checkbox = await screen.findByRole("checkbox", {
      name: "Include O*NET evidence",
    });
    fireEvent.click(checkbox);

    expect(
      await screen.findByText("(O*Net) Purchase task"),
    ).toBeInTheDocument();
  });

  it("collapses collections independently and renders parent guide lines", async () => {
    render(
      <OntologyComparisonPanel
        datasetId="buy-current"
        branch="Buy"
        roundLabel="Current Buy round"
        currentRound
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Compare Buy hierarchy/i }),
    );

    const collapseCollectionButtons = await screen.findAllByRole("button", {
      name: "Collapse collection commerce",
    });

    expect(collapseCollectionButtons).toHaveLength(2);
    expect(
      document.querySelectorAll('[data-outline-guide="node"]'),
    ).toHaveLength(2);
    expect(
      document.querySelectorAll('[data-outline-guide="collection"]'),
    ).toHaveLength(2);
    expect(screen.getByText("Purchase product")).toBeInTheDocument();
    expect(screen.getByText("Purchase goods")).toBeInTheDocument();

    fireEvent.click(collapseCollectionButtons[0]);

    expect(screen.queryByText("Purchase product")).not.toBeInTheDocument();
    expect(screen.getByText("Purchase goods")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand collection commerce" }),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-outline-guide="collection"]'),
    ).toHaveLength(1);
  });
});
