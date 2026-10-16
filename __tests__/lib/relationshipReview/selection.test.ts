import {
  generalizationChanges,
  selectedReviewCases,
} from "../../../src/lib/relationshipReview/selection";
import type {
  RelationshipCase,
  RelationshipDataset,
  RelationshipPresentation,
} from "../../../src/types/IRelationshipReview";

const activity = (id: string, current: string[], proposed: string[]) =>
  ({
    id,
    currentParents: current.map((id) => ({ id })),
    analysis: {
      judgment: "change",
      proposedParents: proposed.map((nodeId) => ({ nodeId })),
    },
    mechanicalIssues: [],
    interProposalIssues: [],
  }) as unknown as RelationshipCase;
const presentation = (ids: string[]) =>
  ({
    datasetVersion: "v1",
    selectedCaseIds: ids,
    cards: ids.map((caseId) => ({
      caseId,
      eligible: true,
      remainingMaterialObjections: [],
    })),
  }) as unknown as RelationshipPresentation;

test("compares every generalization independently and retains multiple valid links", () => {
  expect(
    generalizationChanges(
      activity(
        "a",
        ["keep-one", "remove", "keep-two"],
        ["keep-two", "add", "keep-one"],
      ),
    ),
  ).toEqual({
    added: ["add"],
    removed: ["remove"],
    retained: ["keep-two", "keep-one"],
  });
});
test("keeps pinned selection order and excludes unchanged, uncertain and structurally flagged cases", () => {
  const cases = [
    activity("a", ["old"], ["new"]),
    activity("b", ["one", "two"], ["two", "one"]),
    activity("c", [], ["new"]),
    activity("d", [], ["new"]),
    activity("e", [], ["new"]),
  ];
  cases[3].mechanicalIssues = ["cycle"];
  const selected = presentation(["e", "b", "c", "d", "a"]);
  selected.cards.find((c) => c.caseId === "c")!.remainingMaterialObjections = [
    "unresolved meaning",
  ];
  const dataset = { version: "v1", cases } as RelationshipDataset;
  expect(selectedReviewCases(dataset, selected).map((c) => c.id)).toEqual([
    "e",
    "a",
  ]);
  expect(
    selectedReviewCases(dataset, { ...selected, datasetVersion: "old" }),
  ).toEqual([]);
});
