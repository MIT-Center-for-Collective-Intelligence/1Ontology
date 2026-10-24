/** @jest-environment jsdom */
import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import RelationshipNeighborhood from "../../../src/components/SomReview/RelationshipNeighborhood";
import { relationshipRequest } from "../../../src/lib/relationshipReview/client";
import type {
  ContextNode,
  ContextPage,
  RelationshipContext,
} from "../../../src/lib/relationshipReview/context";
import type { RelationshipCase } from "../../../src/types/IRelationshipReview";

jest.mock("../../../src/lib/relationshipReview/client", () => ({
  relationshipRequest: jest.fn(),
}));

const request = relationshipRequest as jest.Mock;
const datasetVersion = "atomic-v3";
const datasetSha256 = "a".repeat(64);

// Synthetic records with only fields consumed by this component.
function node(
  id: string,
  title: string,
  description = "",
  oNetTask = false,
): ContextNode {
  return {
    id,
    title,
    description,
    oNetTask,
    descriptionSource: description ? "Synthetic recorded description" : null,
  } as ContextNode;
}

const reviewed = node("reason", "Reason", "Consider reasons for a conclusion.");
const otherReviewed = node("classify", "Classify");
const current = node("think", "Think");
const secondCurrent = node("act", "Act");
const proposed = node("plan", "Plan", "Choose how to reach a goal.");
const alternative = node("reflect", "Reflect");
const item = { id: reviewed.id, title: reviewed.title } as RelationshipCase;
const otherItem = {
  id: otherReviewed.id,
  title: otherReviewed.title,
} as RelationshipCase;
const props = { item, datasetVersion, datasetSha256, preview: false };
const activityNodes = Array.from({ length: 21 }, (_, i) =>
  node(`activity-${i}`, `Recorded activity ${i + 1}`),
);
const sourceNodes = Array.from({ length: 21 }, (_, i) =>
  node(
    `source-${i}`,
    `Source task ${i + 1}`,
    `O*NET task description ${i + 1}.`,
    true,
  ),
);

type ContextQuery = {
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  focusId: string;
  activityOffset: number;
  sourceOffset: number;
  limit: number;
};
type ContextResponse = { context: RelationshipContext };

function query(
  focusId: string,
  overrides: Partial<ContextQuery> = {},
): ContextQuery {
  return {
    caseId: item.id,
    datasetVersion,
    datasetSha256,
    focusId,
    activityOffset: 0,
    sourceOffset: 0,
    limit: 20,
    ...overrides,
  };
}

function page(
  items: ContextNode[],
  offset: number,
  limit: number,
): ContextPage {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
    nextOffset: offset + limit < items.length ? offset + limit : null,
  };
}

function contextFor(expected: ContextQuery): RelationshipContext {
  const focal = expected.caseId === otherItem.id ? otherReviewed : reviewed;
  const choices: RelationshipContext["choices"] = [
    { node: focal, roles: ["focal"] },
    { node: current, roles: ["current", "proposed"] },
    { node: secondCurrent, roles: ["current"] },
    { node: proposed, roles: ["proposed"] },
    { node: alternative, roles: ["alternative"] },
  ];
  const focus = choices.find(({ node }) => node.id === expected.focusId)!.node;
  const generalizations =
    focus.id === secondCurrent.id
      ? []
      : [current, secondCurrent].filter((parent) => parent.id !== focus.id);
  return {
    available: true,
    caseId: expected.caseId,
    datasetVersion: expected.datasetVersion,
    datasetSha256: expected.datasetSha256,
    sourceSha256: "b".repeat(64),
    disclosureVersion: "context-test-1",
    contextSha256: "c".repeat(64),
    sourceApp: "final-hierarchy-with-o*net",
    sourceCapturedAt: "2026-09-29T14:05:06.000Z",
    focus,
    choices,
    generalizations,
    generalizationsTotal: generalizations.length,
    specializationPage: page(
      focus.id === proposed.id ? activityNodes : [],
      expected.activityOffset,
      expected.limit,
    ),
    sourcePage: page(
      focus.id === proposed.id ? sourceNodes : [],
      expected.sourceOffset,
      expected.limit,
    ),
    ancestors: {
      nodes: generalizations,
      edges: generalizations.map(({ id }) => ({
        generalizationId: id,
        specializationId: focus.id,
      })),
      truncated: false,
      cycles: [],
    },
    missingNodeIds: [],
    limitations: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function selectFocus(name: RegExp) {
  fireEvent.mouseDown(
    screen.getByLabelText("Activity to inspect", {
      selector: '[role="combobox"]',
    }),
  );
  fireEvent.click(screen.getByRole("option", { name }));
}

async function showDefault() {
  fireEvent.click(
    screen.getByRole("button", { name: "Show neighboring activities" }),
  );
  await screen.findByRole("heading", { name: proposed.title, level: 4 });
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((_action, expected: ContextQuery) =>
    Promise.resolve({ context: contextFor(expected) }),
  );
});

test("loads only on request, defaults to the new proposed parent, and separates recorded links and sources", async () => {
  render(<RelationshipNeighborhood {...props} />);
  expect(request).not.toHaveBeenCalled();
  await showDefault();
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenNthCalledWith(
    1,
    "context",
    query(reviewed.id),
    false,
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    "context",
    query(proposed.id),
    false,
  );

  const focus = within(screen.getByRole("region", { name: "Selected focus" }));
  expect(
    focus.getByText("Proposed Generalization (not applied)"),
  ).toBeInTheDocument();
  expect(
    focus.getByText(/This is a proposed placement, not a recorded link\./),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Activities can have more than one Generalization\./),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Source: Final Hierarchy with O*NET"),
  ).toBeInTheDocument();
  expect(screen.getByText("Captured: Sep 29, 2026")).toBeInTheDocument();

  fireEvent.mouseDown(
    screen.getByLabelText("Activity to inspect", {
      selector: '[role="combobox"]',
    }),
  );
  expect(
    screen.getAllByRole("option").map((option) => option.textContent),
  ).toEqual([
    "Reason — Activity under review",
    "Think — Current Generalization (recorded); Proposed Generalization (retained link)",
    "Act — Current Generalization (recorded)",
    "Plan — Proposed Generalization (not applied)",
    "Reflect — Alternative Generalization (considered)",
  ]);
  fireEvent.click(screen.getByRole("option", { name: /Plan —/ }));

  const parents = within(
    screen.getByRole("region", { name: "Recorded Generalizations" }),
  );
  expect(parents.getByText(current.title)).toBeInTheDocument();
  expect(parents.getByText(secondCurrent.title)).toBeInTheDocument();
  const activities = within(
    screen.getByRole("region", { name: "Activity Specializations" }),
  );
  expect(activities.getByText(activityNodes[0].title)).toBeInTheDocument();
  expect(activities.queryByText(reviewed.title)).not.toBeInTheDocument();
  expect(activities.queryByText(sourceNodes[0].title)).not.toBeInTheDocument();
  expect(
    activities.queryByText("No recorded description is supplied."),
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "O*NET source records (21)" }),
  );
  const sources = within(
    await screen.findByRole("region", { name: "O*NET source records" }),
  );
  expect(sources.getByText(sourceNodes[0].title)).toBeInTheDocument();
  expect(sources.queryByText(activityNodes[0].title)).not.toBeInTheDocument();
  expect(sources.getByText(/not activity Specializations/)).toBeInTheDocument();
});

test("paginates activities and O*NET records independently", async () => {
  render(<RelationshipNeighborhood {...props} />);
  await showDefault();
  expect(
    screen.getByRole("button", { name: "Previous activity Specializations" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Next activity Specializations" }),
  );
  await screen.findByText("21–21 of 21 activities");
  expect(
    screen.getByRole("button", { name: "Next activity Specializations" }),
  ).toBeDisabled();

  fireEvent.click(
    screen.getByRole("button", { name: "O*NET source records (21)" }),
  );
  await screen.findByRole("region", { name: "O*NET source records" });
  fireEvent.click(screen.getByRole("button", { name: "Next O*NET records" }));
  await screen.findByText("21–21 of 21 records");
  expect(
    screen.getByRole("button", { name: "Next O*NET records" }),
  ).toBeDisabled();

  fireEvent.click(
    screen.getByRole("button", { name: "Previous activity Specializations" }),
  );
  await screen.findByText("1–20 of 21 activities");
  expect(
    within(
      screen.getByRole("region", { name: "O*NET source records" }),
    ).getByText(sourceNodes[20].title),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Previous O*NET records" }),
  );
  await screen.findByText("1–20 of 21 records");
  expect(request.mock.calls.slice(2)).toEqual([
    ["context", query(proposed.id, { activityOffset: 20 }), false],
    [
      "context",
      query(proposed.id, { activityOffset: 20, sourceOffset: 20 }),
      false,
    ],
    ["context", query(proposed.id, { sourceOffset: 20 }), false],
    ["context", query(proposed.id), false],
  ]);
});

test("ignores late responses for an older focus and a replaced card", async () => {
  const view = render(<RelationshipNeighborhood {...props} />);
  await showDefault();
  const olderFocus = deferred<ContextResponse>();
  request.mockReturnValueOnce(olderFocus.promise);
  selectFocus(/Reflect — Alternative Generalization/);
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(
      "context",
      query(alternative.id),
      false,
    ),
  );
  expect(screen.getByRole("status")).toBeInTheDocument();
  selectFocus(/Reason — Activity under review/);
  await screen.findByRole("heading", { name: reviewed.title, level: 4 });
  await act(async () => {
    olderFocus.resolve({ context: contextFor(query(alternative.id)) });
  });
  expect(
    screen.getByRole("heading", { name: reviewed.title, level: 4 }),
  ).toBeInTheDocument();

  const olderCard = deferred<ContextResponse>();
  request.mockReturnValueOnce(olderCard.promise);
  selectFocus(/Plan — Proposed Generalization/);
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(
      "context",
      query(proposed.id),
      false,
    ),
  );
  const callsBeforeReplacement = request.mock.calls.length;
  view.rerender(<RelationshipNeighborhood {...props} item={otherItem} />);
  expect(request).toHaveBeenCalledTimes(callsBeforeReplacement);
  expect(
    screen.getByRole("button", { name: "Show neighboring activities" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Selected focus" }),
  ).not.toBeInTheDocument();
  await showDefault();
  expect(request).toHaveBeenLastCalledWith(
    "context",
    query(proposed.id, { caseId: otherItem.id }),
    false,
  );
  await act(async () => {
    olderCard.resolve({ context: contextFor(query(proposed.id)) });
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Snapshot identity and technical details",
    }),
  );
  const details = within(
    await screen.findByRole("region", { name: "Snapshot technical details" }),
  );
  expect(details.getByText(otherItem.id)).toBeInTheDocument();
  expect(details.queryByText(item.id)).not.toBeInTheDocument();
});

test("allows retry after an error and rejects a response with the wrong snapshot identity", async () => {
  const wrongIdentity = {
    ...contextFor(query(reviewed.id)),
    datasetSha256: "f".repeat(64),
  };
  request
    .mockRejectedValueOnce(new Error("Temporary connection problem."))
    .mockResolvedValueOnce({ context: wrongIdentity });
  render(<RelationshipNeighborhood {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Show neighboring activities" }),
  );
  await screen.findByText("Temporary connection problem.");
  fireEvent.click(
    screen.getByRole("button", { name: "Retry neighboring activities" }),
  );
  await screen.findByText(
    "The neighboring activities do not match this activity, focus or page. Please retry.",
  );
  expect(
    screen.queryByRole("region", { name: "Selected focus" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Activity to inspect"),
  ).not.toBeInTheDocument();
  expect(request).toHaveBeenNthCalledWith(
    2,
    "context",
    query(reviewed.id),
    false,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Retry neighboring activities" }),
  );
  await screen.findByRole("heading", { name: proposed.title, level: 4 });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(4);
  expect(request).toHaveBeenLastCalledWith(
    "context",
    query(proposed.id),
    false,
  );
});

test("shows the unavailable explanation without neighborhood sections for a legacy version", async () => {
  const legacyVersion = "atomic-v2";
  const limitation =
    "No captured neighborhood is supplied for this review version.";
  const emptyPage = page([], 0, 20);
  const unavailable: RelationshipContext = {
    ...contextFor(query(reviewed.id, { datasetVersion: legacyVersion })),
    available: false,
    focus: null,
    choices: [],
    generalizations: [],
    generalizationsTotal: 0,
    specializationPage: emptyPage,
    sourcePage: emptyPage,
    ancestors: { nodes: [], edges: [], truncated: false, cycles: [] },
    sourceApp: "",
    sourceCapturedAt: "",
    sourceSha256: "",
    contextSha256: "",
    limitations: [limitation],
  };
  request.mockResolvedValue({ context: unavailable });
  render(
    <RelationshipNeighborhood {...props} datasetVersion={legacyVersion} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show neighboring activities" }),
  );
  await screen.findByText(
    "Neighboring activities are not available for this review version.",
  );
  expect(screen.getByText(limitation)).toBeInTheDocument();
  expect(
    screen.getByText("Captured: Not recorded for this version"),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Activity to inspect"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Activity Specializations" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /O\*NET source records/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Snapshot identity and technical details",
    }),
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    "context",
    query(reviewed.id, { datasetVersion: legacyVersion }),
    false,
  );
});
