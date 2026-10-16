import { test } from "node:test";
import assert from "node:assert/strict";
import {
  graphInventory,
  inspectRecommendation,
  descendants,
  combinedProposalConflicts,
} from "./relationship-graph-lib.mjs";
const node = (id, children = [], parents = [], root = false, title = id) => ({
  id,
  title,
  root,
  specializations: [{ nodes: children.map((id) => ({ id })) }],
  generalizations: [{ nodes: parents.map((id) => ({ id })) }],
});
test("minimum depth respects polyhierarchy and follows headings without treating them as activities", () => {
  const g = graphInventory([
    node("r", ["a", "b"], [], true),
    node("a", ["x"], ["r"]),
    node("b", ["c"], ["r"]),
    node("c", ["x"], ["b"]),
    node("x", [], ["a", "c"]),
  ]);
  assert.equal(g.levels.get("x"), 3);
  assert.deepEqual(g.mismatches, []);
  assert.deepEqual(inspectRecommendation("a", ["x"], g), [
    "Proposed link would create a cycle",
  ]);
  assert.deepEqual(inspectRecommendation("x", ["a", "c"], g), []);
});
test("source cycles terminate and proposed self-links/missing parents/headings fail closed", () => {
  const g = graphInventory([
    node("r", ["a"], [], true),
    node("a", ["b"], ["r", "b"]),
    node("b", ["a"], ["a"]),
    node("h", [], [], false, "[How?]"),
  ]);
  assert.equal(descendants("a", g.byId).size, 2);
  assert.ok(inspectRecommendation("a", ["a", "missing", "h"], g).length >= 4);
});
test("one-sided edges and dangling pointers are reported rather than silently repaired", () => {
  const g = graphInventory([
    node("r", ["a", "gone"], [], true),
    node("a", [], []),
  ]);
  assert.equal(g.missing.length, 1);
  assert.equal(g.mismatches.length, 1);
});
test("two individually safe sibling moves are flagged if their combination creates a cycle", () => {
  const g = graphInventory([
    node("r", ["a", "b"], [], true),
    node("a", [], ["r"]),
    node("b", [], ["r"]),
  ]);
  assert.deepEqual(inspectRecommendation("a", ["b"], g), []);
  assert.deepEqual(
    combinedProposalConflicts(
      [
        { subjectId: "a", parentIds: ["b"] },
        { subjectId: "b", parentIds: ["a"] },
      ],
      g,
    )
      .map((x) => x.subjectId)
      .sort(),
    ["a", "b"],
  );
  assert.deepEqual(
    combinedProposalConflicts(
      [
        { subjectId: "a", parentIds: ["b"] },
        { subjectId: "b", parentIds: ["r"] },
      ],
      g,
    ),
    [],
  );
});
import { siblingFamilies } from "./relationship-graph-lib.mjs";
test("sibling review includes children beyond the parent level band without changing their source", () => {
  const link = (ids) => [{ nodes: ids.map((id) => ({ id })) }];
  const nodes = [
    {
      id: "root",
      title: "Act",
      root: true,
      specializations: link(["heading"]),
    },
    {
      id: "heading",
      title: "[What]",
      generalizations: link(["root"]),
      specializations: link(["think"]),
    },
    {
      id: "think",
      title: "Think",
      generalizations: link(["heading"]),
      specializations: link(["decide"]),
    },
    {
      id: "decide",
      title: "Decide",
      generalizations: link(["think"]),
      specializations: link(["accept", "reject", "select"]),
    },
    ...["accept", "reject", "select"].map((id) => ({
      id,
      title: id,
      generalizations: link(["decide"]),
    })),
  ];
  const before = JSON.stringify(nodes);
  assert.deepEqual(siblingFamilies(nodes), [
    { parentId: "decide", childIds: ["accept", "reject", "select"] },
  ]);
  assert.equal(JSON.stringify(nodes), before);
});
