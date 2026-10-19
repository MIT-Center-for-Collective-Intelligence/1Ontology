import { relationshipSourceEvidence } from "../../../src/lib/relationshipReview/evidence";
import type { RelationshipDataset } from "../../../src/types/IRelationshipReview";

const dataset = {
  version: "frozen-v3",
  cases: [
    {
      id: "atomic",
      children: [{ id: "source", title: "Original complete O*NET title" }],
    },
  ],
  candidates: [
    {
      id: "source",
      title: "Original complete O*NET title",
      description: "All source wording, including tools and purpose.",
      oNetTask: true,
    },
    { id: "deep", title: "A deeper source", oNetTask: true },
    {
      id: "parent",
      title: "(O*Net) generated parent definition",
      oNetTask: false,
    },
  ],
} as unknown as RelationshipDataset;

test("preserves complete source wording and includes deeper records only from the frozen descendant set", () => {
  const evidence = relationshipSourceEvidence(dataset, "atomic", {
    sourceContext: {
      records: [
        { id: "unrelated", title: "Other candidate evidence", oNetTask: true },
      ],
      descendantCoverage: {
        complete: true,
        total: 3,
        fullDescendantRecords: [
          { id: "source", title: "Original complete O*NET title" },
          { id: "deep", title: "A deeper source" },
          {
            id: "parent",
            title: "(O*Net) generated parent definition",
            oNetTask: false,
          },
        ],
      },
    },
  });
  expect(evidence.complete).toBe(true);
  expect(evidence.records.map((r) => r.id)).toEqual(["source", "deep"]);
  expect(evidence.records[0].description).toBe(
    "All source wording, including tools and purpose.",
  );
  expect(evidence.records[0].title).toBe("Original complete O*NET title");
});
test("incomplete source coverage remains explicit; missing trace does not imply completeness", () => {
  const result = relationshipSourceEvidence(dataset, "atomic", {});
  expect(result.complete).toBe(false);
  expect(result.limitation).toContain("not a complete evidence set");
  expect(() => relationshipSourceEvidence(dataset, "unknown", {})).toThrow(
    "Unknown activity",
  );
});
test("conflicting source flags or wording are disclosed rather than silently substituted", () => {
  const result = relationshipSourceEvidence(dataset, "atomic", {
    sourceContext: {
      descendantCoverage: {
        complete: true,
        total: 1,
        fullDescendantRecords: [
          {
            id: "parent",
            title: "Original task wording",
            description: "Original description",
            oNetTask: true,
          },
        ],
      },
    },
  });
  expect(result.complete).toBe(false);
  expect(result.issues.join(" ")).toContain("source flag differs");
  expect(result.records.find((r) => r.id === "parent")).toMatchObject({
    title: "Original task wording",
    alternateTitle: "(O*Net) generated parent definition",
  });
});
test("a focal O*NET record and missing traversal totals do not disappear or imply completeness", () => {
  const focal = {
    ...dataset,
    cases: [
      { id: "atomic", title: "Original task", oNetTask: true, children: [] },
    ],
  } as unknown as RelationshipDataset;
  const result = relationshipSourceEvidence(focal, "atomic", {
    sourceContext: {
      descendantCoverage: { complete: true, fullDescendantRecords: [] },
    },
  });
  expect(result.records.map((r) => r.id)).toEqual(["atomic"]);
  expect(result.complete).toBe(false);
});
