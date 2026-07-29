/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import OntologyComparisonPanel, {
  OUTLINE_COLLECTION_COLORS,
} from "../../../src/components/SomReview/OntologyComparisonPanel";
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
      { id: "original-root", title: "Buy", evidence: false, synonyms: [] },
      {
        id: "original-child",
        title: "Purchase product",
        evidence: false,
        synonyms: ["Acquire product"],
      },
      {
        id: "original-main-child",
        title: "Purchase directly",
        evidence: false,
        synonyms: [],
      },
      {
        id: "original-evidence",
        title: "(O*Net) Purchase task",
        evidence: true,
        synonyms: [],
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
        childId: "original-main-child",
        collectionName: "Main",
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
      { id: "current-root", title: "Buy", evidence: false, synonyms: [] },
      {
        id: "current-child",
        title: "Purchase goods",
        evidence: false,
        synonyms: [],
      },
      {
        id: "current-main-child",
        title: "Acquire directly",
        evidence: false,
        synonyms: [],
      },
    ],
    edges: [
      {
        parentId: "current-root",
        childId: "current-child",
        collectionName: "commerce",
      },
      {
        parentId: "current-root",
        childId: "current-main-child",
        collectionName: "default",
      },
    ],
  },
};

const luminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (foreground: string, background: string): number => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

describe("ontology comparison panel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Post as jest.Mock).mockResolvedValue(outlineResponse);
  });

  it("uses collection colors with readable contrast in light and dark modes", () => {
    expect(
      contrast(OUTLINE_COLLECTION_COLORS.light, "#FFFFFF"),
    ).toBeGreaterThan(4.5);
    expect(contrast(OUTLINE_COLLECTION_COLORS.dark, "#28282A")).toBeGreaterThan(
      4.5,
    );
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

  it("waits for an explicit retry after a load failure", async () => {
    (Post as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    render(
      <OntologyComparisonPanel
        datasetId="buy-current"
        branch="Buy"
        roundLabel="Current Buy round"
        currentRound
        initiallyExpanded
      />,
    );

    expect(
      await screen.findByText("The ontology outlines could not be loaded."),
    ).toBeInTheDocument();
    expect(Post).toHaveBeenCalledTimes(1);

    (Post as jest.Mock).mockResolvedValueOnce(outlineResponse);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("region", { name: "Original ontology outline" });
    expect(Post).toHaveBeenCalledTimes(2);
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

  it("keeps manually expanded nodes open when toggling O*NET evidence", async () => {
    const nestedOutline: SomOntologyOutlineResponse = {
      ...outlineResponse,
      original: {
        ...outlineResponse.original,
        nodes: [
          ...outlineResponse.original.nodes,
          {
            id: "original-grandchild",
            title: "Purchase online",
            evidence: false,
            synonyms: [],
          },
        ],
        edges: [
          ...outlineResponse.original.edges,
          {
            parentId: "original-main-child",
            childId: "original-grandchild",
            collectionName: "main",
          },
        ],
      },
    };
    (Post as jest.Mock).mockResolvedValue(nestedOutline);

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

    const expandChild = await screen.findByRole("button", {
      name: "Expand Purchase directly",
    });
    fireEvent.click(expandChild);
    expect(screen.getByText("Purchase online")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Include O*NET evidence" }),
    );

    expect(screen.getByText("Purchase online")).toBeInTheDocument();
    expect(screen.getByText("(O*Net) Purchase task")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Purchase directly" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Include O*NET evidence" }),
    );

    expect(screen.getByText("Purchase online")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Purchase directly" }),
    ).toBeInTheDocument();
  });

  it("renders Main collection children directly beneath their parent", async () => {
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

    const originalDirectChild = await screen.findByRole("treeitem", {
      name: "Node: Purchase directly",
    });
    const currentDirectChild = screen.getByRole("treeitem", {
      name: "Node: Acquire directly",
    });
    const namedCollection = screen.getAllByRole("treeitem", {
      name: "Collection: commerce",
    })[0];
    const namedCollectionChild = screen.getByRole("treeitem", {
      name: "Node: Purchase product",
    });

    expect(screen.queryByLabelText("Collection: main")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /collection (main|default)/i }),
    ).not.toBeInTheDocument();
    expect(originalDirectChild).toHaveAttribute(
      "data-outline-indent-level",
      "1",
    );
    expect(currentDirectChild).toHaveAttribute(
      "data-outline-indent-level",
      "1",
    );
    expect(namedCollection).toHaveAttribute("data-outline-indent-level", "1");
    expect(namedCollectionChild).toHaveAttribute(
      "data-outline-indent-level",
      "2",
    );
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
