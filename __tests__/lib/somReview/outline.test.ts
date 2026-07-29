import { getDataset } from "../../../src/lib/somReview/dataset";
import {
  formatOutlineText,
  toOutlineSnapshot,
} from "../../../src/lib/somReview/outline";

describe("Society of Mind ontology outlines", () => {
  it.each([
    ["buy-initial-title-review", "Buy"],
    ["buy-title-followup", "Buy"],
    ["sell-initial-review", "Sell"],
    ["sell-current", "Sell"],
  ])("projects only the reachable %s branch", (datasetId, rootTitle) => {
    const dataset = getDataset(datasetId);
    const outline = toOutlineSnapshot(dataset);
    const nodeIds = new Set(outline.nodes.map((node) => node.id));

    expect(outline.rootTitle).toBe(rootTitle);
    expect(nodeIds.has(outline.rootNodeId)).toBe(true);
    expect(outline.nodes.length).toBeGreaterThan(1);
    expect(outline.nodes.length).toBeLessThanOrEqual(
      dataset.snapshot.nodes.length,
    );
    expect(
      outline.edges.every(
        (edge) => nodeIds.has(edge.parentId) && nodeIds.has(edge.childId),
      ),
    ).toBe(true);
  });

  it("marks O*NET nodes so the interface can hide evidence by default", () => {
    const outline = toOutlineSnapshot(getDataset("sell-initial-review"));
    const evidenceNodes = outline.nodes.filter((node) => node.evidence);

    expect(evidenceNodes.length).toBeGreaterThan(0);
    expect(
      evidenceNodes.every((node) => node.title.startsWith("(O*Net)")),
    ).toBe(true);
  });

  it("includes normalized synonyms without representing them as child nodes", () => {
    const outline = toOutlineSnapshot(getDataset("sell-current"));
    const nodesWithSynonyms = outline.nodes.filter(
      (node) => node.synonyms.length > 0,
    );

    expect(nodesWithSynonyms.length).toBeGreaterThan(0);
    expect(
      nodesWithSynonyms.every(
        (node) =>
          new Set(node.synonyms.map((synonym) => synonym.toLowerCase()))
            .size === node.synonyms.length,
      ),
    ).toBe(true);
  });

  it("formats a deterministic, collection-aware downloadable outline", () => {
    const outline = toOutlineSnapshot(getDataset("sell-current"));
    const first = formatOutlineText(outline);
    const second = formatOutlineText(outline);

    expect(first).toBe(second);
    expect(first).toContain(`- ${outline.rootTitle}`);
    expect(first).toMatch(/\[[^\]]+\]/);
    expect(first).not.toContain("(O*Net)");
    expect(formatOutlineText(outline, true)).toContain("(O*Net)");
  });
});
