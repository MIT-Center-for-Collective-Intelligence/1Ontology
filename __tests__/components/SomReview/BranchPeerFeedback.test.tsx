/** @jest-environment jsdom */
import React from "react";
import { createHash } from "crypto";
import "@testing-library/jest-dom";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RelationshipPeerFeedback } from "../../../src/components/SomReview/RelationshipPeerFeedback";
import { relationshipRequest } from "../../../src/lib/relationshipReview/client";
import { GENERALIZATION_BRANCH_VERSION } from "../../../src/types/IBranchReview";
import type {
  BranchDataset,
  BranchSession,
} from "../../../src/types/IBranchReview";
import { relationshipFeedbackSnapshotJson } from "../../../src/types/IRelationshipReview";
import type {
  PeerFeedback,
  PeerFeedbackQuery,
  PeerFeedbackResponse,
  RelationshipFeedback,
  SavePeerFeedbackRequest,
} from "../../../src/types/IRelationshipReview";

jest.mock("../../../src/lib/relationshipReview/client", () => ({
  relationshipRequest: jest.fn(),
}));

const wire = relationshipRequest as jest.MockedFunction<typeof relationshipRequest>;
type Props = React.ComponentProps<typeof RelationshipPeerFeedback>;
type Actions = Pick<Props, "readAction" | "saveAction">;
const branchActions = {
  readAction: "branch-peer-feedback",
  saveAction: "branch-save-peer",
} as const;
const CASE_ID = "fixture-family";
const TIME = "2026-10-24T00:00:00.000Z";
const UUID = "8a9ed9af-4b21-4db4-a965-7de49bfa6203";
const READ_ERROR =
  "Shared feedback could not be loaded or verified. Retry to obtain current feedback.";
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const feedbackHash = (feedback: RelationshipFeedback) =>
  digest(relationshipFeedbackSnapshotJson(feedback));

const dataset: BranchDataset = {
  schemaVersion: "generalization-branch-review-v1",
  version: GENERALIZATION_BRANCH_VERSION,
  title: "Synthetic whole-family review",
  createdAt: TIME,
  model: "fixture",
  modelVersion: "fixture-v1",
  reasoning: "Synthetic test evidence",
  fundingRoute: "ACCESS",
  sourceApp: "fixture",
  sourceCapturedAt: TIME,
  sourceRecheckedAt: TIME,
  sourceSha256: digest("synthetic frozen graph"),
  priorDatasetVersion: "fixture-child-v1",
  priorDatasetSha256: digest("synthetic immutable child dataset"),
  scopeNote: "Review the whole arrangement without changing the ontology.",
  titleStatusNote: "Synthetic titles are unchanged.",
  nounNote: "Synthetic noun evidence.",
  prompt: "Synthetic family review prompt.",
  criticPrompts: [],
  families: [{
    id: CASE_ID,
    title: "Synthetic family",
    description: "Synthetic family description.",
    generalizations: [
      { id: "fixture-parent-a", title: "First independent Generalization" },
      { id: "fixture-parent-b", title: "Second independent Generalization" },
    ],
    currentSpecializations: [{ id: "fixture-child", title: "Synthetic Specialization" }],
    currentSourceRecords: [],
    summary: "Judge this entire synthetic arrangement.",
    scopeNote: "No vote migration.",
    groups: [],
    sourceCaseIds: ["fixture-child"],
    remainingQuestions: [],
  }],
};
const branchSession: BranchSession = {
  dataset,
  datasetSha256: digest(JSON.stringify(dataset)),
  reviewerKey: "fixture-tom-account",
  reviewerLabel: "Synthetic reviewer",
  feedback: {},
  preview: false,
  peerReviewer: "tom",
  canViewPeerFeedback: true,
  legacy: {
    version: dataset.priorDatasetVersion,
    sha256: dataset.priorDatasetSha256,
  },
};
const legacySession: Props["session"] = {
  dataset: { version: branchSession.legacy.version },
  datasetSha256: branchSession.legacy.sha256,
  reviewerKey: branchSession.reviewerKey,
  preview: branchSession.preview,
  peerReviewer: branchSession.peerReviewer,
  canViewPeerFeedback: branchSession.canViewPeerFeedback,
};
const query = (session: Props["session"] = branchSession): PeerFeedbackQuery => ({
  caseId: CASE_ID,
  datasetVersion: session.dataset.version,
  datasetSha256: session.datasetSha256,
});
const review = (
  q: PeerFeedbackQuery,
  revision = 1,
  note = "Synthetic original feedback",
): RelationshipFeedback => ({
  caseId: q.caseId,
  datasetVersion: q.datasetVersion,
  decision: "discuss",
  note,
  correction: "Synthetic correction",
  revisitLater: true,
  revision,
  savedAt: TIME,
});
const rows = (
  q: PeerFeedbackQuery,
  feedback: RelationshipFeedback | null = review(q),
): PeerFeedbackResponse => ({
  ...q,
  reviewers: [
    { reviewer: "tom", label: "Tom", feedback: null, feedbackSha256: null, response: null },
    {
      reviewer: "rob",
      label: "Rob",
      feedback,
      feedbackSha256: feedback ? feedbackHash(feedback) : null,
      response: null,
    },
  ],
});
const saved = (
  request: SavePeerFeedbackRequest,
  target: RelationshipFeedback,
): { answer: PeerFeedback } => ({
  answer: {
    caseId: request.caseId,
    datasetVersion: request.datasetVersion,
    authorReviewer: "tom",
    targetReviewer: request.targetReviewer,
    targetRevision: request.targetRevision,
    targetFeedbackSha256: request.targetFeedbackSha256,
    targetFeedback: target,
    decision: request.decision,
    note: request.note ?? "",
    revision: request.revision + 1,
    savedAt: TIME,
  },
});
const view = (
  session: Props["session"] = branchSession,
  actions: Actions = branchActions,
  refreshKey = 0,
) => (
  <RelationshipPeerFeedback
    session={session}
    caseId={CASE_ID}
    {...actions}
    refreshKey={refreshKey}
  />
);
const noteField = () => screen.getByLabelText("Optional note for Rob’s feedback");
const radio = (decision: "Agree" | "Disagree") =>
  screen.getByRole("radio", { name: `${decision} with this feedback` });
const saveButton = () =>
  screen.getByRole("button", { name: "Save response to Rob’s feedback" });
const loaded = async () => {
  await screen.findByRole("heading", { name: "Rob’s original review" });
  await waitFor(() => expect(noteField()).toBeEnabled());
};
const choose = (decision: "Agree" | "Disagree", note: string) => {
  fireEvent.click(radio(decision));
  fireEvent.change(noteField(), { target: { value: note } });
};

const randomUUID = jest.fn();
const uuidDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: randomUUID,
  });
});
afterAll(() => {
  if (uuidDescriptor)
    Object.defineProperty(globalThis.crypto, "randomUUID", uuidDescriptor);
  else
    Reflect.deleteProperty(globalThis.crypto, "randomUUID");
});
beforeEach(() => {
  wire.mockReset();
  randomUUID.mockReset().mockReturnValue(UUID);
});
afterEach(() => cleanup());

const routes: {
  label: string;
  session: Props["session"];
  actions: Actions;
  read: string;
  save: string;
}[] = [
  {
    label: "branch routes",
    session: branchSession,
    actions: branchActions,
    read: "branch-peer-feedback",
    save: "branch-save-peer",
  },
  {
    label: "legacy defaults",
    session: legacySession,
    actions: {},
    read: "peer-feedback",
    save: "save-peer",
  },
];
test.each(routes)("$label keep route-specific queries and bound save receipts", async ({ session, actions, read, save }) => {
  const q = query(session);
  const target = review(q);
  wire.mockImplementation(async (action, body) => {
    if (action === read) return rows(q, target);
    if (action === save) return saved(body as SavePeerFeedbackRequest, target);
    throw new Error("Unexpected synthetic peer action");
  });
  render(view(session, actions));
  await loaded();
  expect(wire).toHaveBeenNthCalledWith(1, read, q);
  choose("Agree", "  Synthetic peer response.  ");
  fireEvent.click(saveButton());
  await screen.findByText(/Saved response by Tom:\s*Agree/);
  const saves = wire.mock.calls.filter(([action]) => action === save);
  expect(saves).toHaveLength(1);
  expect(saves[0][1]).toEqual({
    ...q,
    reviewerKey: session.reviewerKey,
    targetReviewer: "rob",
    targetRevision: target.revision,
    targetFeedbackSha256: feedbackHash(target),
    decision: "agree",
    note: "Synthetic peer response.",
    revision: 0,
    requestId: UUID,
  });
  expect(randomUUID).toHaveBeenCalledTimes(1);
  for (const [action, body] of wire.mock.calls) {
    expect([read, save]).toContain(action);
    if (action === read) expect(body).toEqual(q);
  }
});

const alternateActions: { label: string; actions: Actions }[] = [
  { label: "read", actions: { readAction: "peer-feedback", saveAction: "branch-save-peer" } },
  { label: "save", actions: { readAction: "branch-peer-feedback", saveAction: "save-peer" } },
];
test.each(alternateActions)("isolates drafts when only the $label action changes", async ({ actions }) => {
  const q = query();
  wire.mockResolvedValue(rows(q));
  const { rerender } = render(view());
  await loaded();
  choose("Disagree", "Branch-only draft");
  rerender(view(branchSession, actions));
  await loaded();
  expect(wire).toHaveBeenCalledTimes(2);
  expect(noteField()).toHaveValue("");
  expect(radio("Disagree")).not.toBeChecked();
  choose("Agree", "Other-action draft");
  rerender(view());
  await loaded();
  expect(wire).toHaveBeenCalledTimes(3);
  expect(noteField()).toHaveValue("Branch-only draft");
  expect(radio("Disagree")).toBeChecked();
  expect(radio("Agree")).not.toBeChecked();
  for (const [, body] of wire.mock.calls) expect(body).toEqual(q);
});

test("refreshKey reloads after an own family vote without rebasing a stale draft automatically", async () => {
  const q = query();
  let target = review(q);
  wire.mockImplementation(async (action, body) => {
    if (action === "branch-peer-feedback") return rows(q, target);
    if (action === "branch-save-peer") return saved(body as SavePeerFeedbackRequest, target);
    throw new Error("Unexpected synthetic peer action");
  });
  const { rerender } = render(view());
  await loaded();
  choose("Disagree", "Preserve this draft until I review the update");
  target = review(q, 2, "Updated family feedback");
  const updated: BranchSession = {
    ...branchSession,
    feedback: { [CASE_ID]: review(q, 1, "Own whole-family judgment") },
  };
  rerender(view(updated, branchActions, updated.feedback[CASE_ID].revision));
  await screen.findByText("Note: Updated family feedback");
  expect(wire).toHaveBeenCalledTimes(2);
  expect(noteField()).toHaveValue("Preserve this draft until I review the update");
  expect(radio("Disagree")).toBeDisabled();
  expect(saveButton()).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Review updated feedback from Rob" }));
  expect(noteField()).toHaveValue("");
  expect(radio("Disagree")).not.toBeChecked();
  choose("Agree", "Read the updated feedback");
  fireEvent.click(saveButton());
  await screen.findByText(/Saved response by Tom:\s*Agree/);
  const request = wire.mock.calls.find(([action]) => action === "branch-save-peer")![1];
  expect(request).toMatchObject({
    ...q,
    targetRevision: 2,
    targetFeedbackSha256: feedbackHash(target),
    revision: 0,
    note: "Read the updated feedback",
  });
});

test("an uncertain branch save explicitly retries the identical frozen request", async () => {
  const q = query();
  const target = review(q);
  let attempts = 0;
  wire.mockImplementation(async (action, body) => {
    if (action === "branch-peer-feedback") return rows(q, target);
    if (action === "branch-save-peer") {
      if (++attempts === 1)
        throw Object.assign(new Error("Synthetic unavailable service"), { status: 503 });
      return saved(body as SavePeerFeedbackRequest, target);
    }
    throw new Error("Unexpected synthetic peer action");
  });
  render(view());
  await loaded();
  choose("Agree", "Retained branch response");
  fireEvent.click(saveButton());
  await screen.findByText("The save could not be confirmed. Retry save resends the identical request.");
  expect(noteField()).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry save to Rob’s feedback" }));
  await screen.findByText(/Saved response by Tom:\s*Agree/);
  const saves = wire.mock.calls.filter(([action]) => action === "branch-save-peer");
  expect(saves).toHaveLength(2);
  expect(saves[1][1]).toBe(saves[0][1]);
  expect(Object.isFrozen(saves[0][1])).toBe(true);
  expect(saves[0][1]).toMatchObject({ requestId: UUID, revision: 0, targetFeedbackSha256: feedbackHash(target) });
  expect(randomUUID).toHaveBeenCalledTimes(1);
  expect(wire.mock.calls.some(([action]) => action === "save-peer")).toBe(false);
});

test("hides a loaded empty section but exposes real read errors and retry", async () => {
  const q = query();
  wire.mockResolvedValueOnce(rows(q, null));
  const { rerender } = render(view());
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: "Tom and Rob’s feedback" })).not.toBeInTheDocument(),
  );
  wire.mockRejectedValueOnce(new Error("Synthetic read failure"))
    .mockResolvedValueOnce(rows(q, null));
  rerender(view(branchSession, branchActions, 1));
  await screen.findByText(READ_ERROR);
  expect(screen.getByRole("region", { name: "Tom and Rob’s feedback" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry loading feedback" }));
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: "Tom and Rob’s feedback" })).not.toBeInTheDocument(),
  );
  expect(wire).toHaveBeenCalledTimes(3);
  for (const [action, body] of wire.mock.calls) {
    expect(action).toBe("branch-peer-feedback");
    expect(body).toEqual(q);
  }
});

test.each(["caseId", "datasetVersion", "datasetSha256"] as const)("rejects branch reads with a mismatched %s", async (field) => {
  const q = query();
  wire.mockResolvedValueOnce({
    ...rows(q),
    [field]: field === "datasetSha256" ? digest("different synthetic dataset") : "different-synthetic-target",
  }).mockResolvedValueOnce(rows(q));
  render(view());
  await screen.findByText(READ_ERROR);
  expect(screen.queryByRole("heading", { name: "Rob’s original review" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry loading feedback" }));
  await loaded();
  expect(wire).toHaveBeenLastCalledWith("branch-peer-feedback", q);
});

test("does not enable a branch response without a valid target hash", async () => {
  const data = rows(query());
  data.reviewers[1].feedbackSha256 = "not-a-sha256";
  wire.mockResolvedValue(data);
  render(view());
  await screen.findByRole("heading", { name: "Rob’s original review" });
  expect(radio("Agree")).toBeDisabled();
  expect(noteField()).toBeDisabled();
  expect(saveButton()).toBeDisabled();
  fireEvent.click(saveButton());
  expect(wire).toHaveBeenCalledTimes(1);
});
