import { getDataset } from "../../../src/lib/somReview/dataset";
import { toOutlineSnapshot } from "../../../src/lib/somReview/outline";

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
});
