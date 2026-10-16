import {
  relationshipPackages,
  relationshipPackage,
} from "../../../src/lib/relationshipReview/package";
import {
  getRelationshipDataset,
  getRelationshipTrace,
} from "../../../src/lib/relationshipReview/dataset";
import { getRelationshipPresentation } from "../../../src/lib/relationshipReview/presentation";
test("each pinned review version keeps its own dataset, evidence and presentation", () => {
  for (const entry of relationshipPackages()) {
    const { dataset, sha256 } = getRelationshipDataset(entry.version);
    expect(dataset.version).toBe(entry.version);
    expect(dataset.cases).toHaveLength(entry.cases);
    expect(sha256).toBe(entry.bundleSha256);
    expect(getRelationshipPresentation(dataset, sha256).sha256).toBe(
      entry.presentationSha256,
    );
    expect(
      getRelationshipTrace(dataset.cases[0].id, entry.version)
        .sourceSnapshotSha256,
    ).toBe(dataset.sourceSha256);
    if (entry.directory === "sibling-v2") {
      const { presentation } = getRelationshipPresentation(dataset, sha256);
      expect(
        presentation.selectedCaseIds
          .slice(0, 2)
          .map((id) => dataset.cases.find((c) => c.id === id)?.title),
      ).toEqual(["Accept", "Reject"]);
      expect(presentation.selectedCaseIds.length).toBeGreaterThan(2);
    }
  }
  expect(getRelationshipDataset().dataset.version).toBe(
    relationshipPackages()[0].version,
  );
  expect(() => relationshipPackage("../../escape")).toThrow(
    "Unknown relationship review version",
  );
  expect(() => getRelationshipTrace("../escape")).toThrow("Unknown case");
});
