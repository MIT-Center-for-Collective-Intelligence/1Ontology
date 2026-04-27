import {
  choosePrimaryParentId,
  isReachableViaSpecializations,
  parentIdsFromGeneralizations,
  pathsEqual,
} from "@components/lib/utils/derivedNavigation";

describe("derivedNavigation", () => {
  it("parentIdsFromGeneralizations preserves order and dedupes", () => {
    const gens = [
      {
        collectionName: "other",
        nodes: [{ id: "b" }, { id: "a" }],
      },
      {
        collectionName: "main",
        nodes: [{ id: "c" }],
      },
    ];
    expect(parentIdsFromGeneralizations(gens)).toEqual(["b", "a", "c"]);
  });

  it("choosePrimaryParentId prefers main collection first id", () => {
    expect(
      choosePrimaryParentId([
        { collectionName: "other", nodes: [{ id: "x" }] },
        { collectionName: "main", nodes: [{ id: "m1" }, { id: "m2" }] },
      ]),
    ).toBe("m1");
  });

  it("choosePrimaryParentId falls back to first collection order", () => {
    expect(
      choosePrimaryParentId([
        { collectionName: "a", nodes: [{ id: "first" }] },
      ]),
    ).toBe("first");
  });

  it("multi-parent: stable rule — main wins over global order", () => {
    const gens = [
      { collectionName: "main", nodes: [{ id: "P2" }, { id: "P1" }] },
      { collectionName: "extra", nodes: [{ id: "P0" }] },
    ];
    expect(choosePrimaryParentId(gens)).toBe("P2");
    expect(parentIdsFromGeneralizations(gens)).toEqual(["P2", "P1", "P0"]);
  });

  it("isReachableViaSpecializations detects descendant", () => {
    const child = (id: string) => {
      if (id === "r") return ["a", "b"];
      if (id === "a") return ["c"];
      return [];
    };
    expect(isReachableViaSpecializations("r", "c", child)).toBe(true);
    expect(isReachableViaSpecializations("r", "missing", child)).toBe(false);
  });

  it("pathsEqual compares arrays", () => {
    expect(pathsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(pathsEqual(["a"], ["a", "b"])).toBe(false);
  });
});
