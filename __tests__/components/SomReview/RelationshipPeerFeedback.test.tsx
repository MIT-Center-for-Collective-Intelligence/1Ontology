/** @jest-environment jsdom */
import React from "react";
import { createHash } from "crypto";
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { RelationshipPeerFeedback } from "../../../src/components/SomReview/RelationshipPeerFeedback";
import { relationshipRequest } from "../../../src/lib/relationshipReview/client";
import { relationshipFeedbackSnapshotJson } from "../../../src/types/IRelationshipReview";
import type {
  PeerDecision,
  PeerFeedback,
  PeerFeedbackQuery,
  PeerFeedbackResponse,
  PeerReviewer,
  RelationshipFeedback,
  RelationshipSession,
  SavePeerFeedbackRequest,
} from "../../../src/types/IRelationshipReview";

jest.mock("../../../src/lib/relationshipReview/client", () => ({
  relationshipRequest: jest.fn(),
}));

const wire = relationshipRequest as jest.MockedFunction<
  typeof relationshipRequest
>;
const A = "fixture-case-a";
const B = "fixture-case-b";
const VERSION = "fixture-v1";
const TIME = "2025-01-02T03:04:05.000Z";
const LABEL = { tom: "Tom", rob: "Rob" } as const;
const UUIDS = [
  "8a9ed9af-4b21-4db4-a965-7de49bfa6203",
  "ed375a6d-a801-4e21-92d4-cc4b3f5bac02",
] as const;
const DATASET_SHA = createHash("sha256")
  .update("peer-ui-synthetic-dataset")
  .digest("hex");
const READ_ERROR =
  "Shared feedback could not be loaded or verified. Retry to obtain current feedback.";
const SAVE_ERROR =
  "The save could not be confirmed. Retry save resends the identical request.";
const CONFLICT_ERROR =
  "The feedback or your saved response changed. Review updated feedback before saving.";

const sha = (feedback: RelationshipFeedback) =>
  createHash("sha256")
    .update(relationshipFeedbackSnapshotJson(feedback))
    .digest("hex");
const query = (caseId: string = A): PeerFeedbackQuery => ({
  datasetVersion: VERSION,
  datasetSha256: DATASET_SHA,
  caseId,
});
const review = (
  person: PeerReviewer,
  caseId: string = A,
  revision = 1,
  note = `${LABEL[person]} saved ${caseId}:\n  exact spacing & punctuation.`,
): RelationshipFeedback => ({
  caseId,
  datasetVersion: VERSION,
  decision: person === "tom" ? "discuss" : "disagree",
  note,
  correction: `${LABEL[person]} fixture correction`,
  revisitLater: person === "tom",
  revision,
  savedAt: TIME,
});
const rows = (
  caseId: string = A,
  tom = review("tom", caseId),
  rob = review("rob", caseId),
): PeerFeedbackResponse => ({
  ...query(caseId),
  reviewers: [
    {
      reviewer: "tom",
      label: "Tom",
      feedback: tom,
      feedbackSha256: sha(tom),
      response: null,
    },
    {
      reviewer: "rob",
      label: "Rob",
      feedback: rob,
      feedbackSha256: sha(rob),
      response: null,
    },
  ],
});
const savedPeer = (
  target: PeerReviewer,
  snapshot: RelationshipFeedback,
  patch: Partial<PeerFeedback> = {},
): PeerFeedback => ({
  caseId: snapshot.caseId,
  datasetVersion: snapshot.datasetVersion,
  targetReviewer: target,
  authorReviewer: target === "tom" ? "rob" : "tom",
  targetRevision: snapshot.revision,
  targetFeedbackSha256: sha(snapshot),
  targetFeedback: snapshot,
  decision: "agree",
  note: "Stored peer fixture note",
  revision: 1,
  savedAt: TIME,
  ...patch,
});
const receipt = (
  p: Readonly<SavePeerFeedbackRequest>,
  snapshot: RelationshipFeedback,
) =>
  savedPeer(p.targetReviewer, snapshot, {
    caseId: p.caseId,
    datasetVersion: p.datasetVersion,
    targetRevision: p.targetRevision,
    targetFeedbackSha256: p.targetFeedbackSha256,
    decision: p.decision,
    note: p.note ?? "",
    revision: p.revision + 1,
  });
const session = (
  peerReviewer: PeerReviewer | null = "rob",
  patch: Partial<RelationshipSession> = {},
): RelationshipSession => ({
  dataset: {
    version: VERSION,
    createdAt: TIME,
    title: "Synthetic fixture",
    model: "test",
    modelVersion: "test",
    reasoning: "test",
    fundingRoute: "ACCESS",
    sourceApp: "test",
    sourceCapturedAt: TIME,
    sourceSha256: DATASET_SHA,
    scopeExplanation: "test",
    candidateLimit: "test",
    prompt: "test",
    challengePrompt: "test",
    cases: [],
    candidates: [],
    usefulnessNote: "test",
  },
  datasetSha256: DATASET_SHA,
  reviewerKey: `fixture-${peerReviewer ?? "coordinator"}`,
  reviewerLabel: peerReviewer ? LABEL[peerReviewer] : "Fixture coordinator",
  feedback: {},
  preview: false,
  peerReviewer,
  canViewPeerFeedback: true,
  ...patch,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const original = (person: PeerReviewer) =>
  within(
    screen.getByRole("heading", { name: `${LABEL[person]}’s original review` })
      .parentElement!,
  );
const editor = (person: PeerReviewer = "tom") =>
  within(
    screen.getByRole("group", {
      name: `Response to ${LABEL[person]}’s feedback`,
    }),
  );
const note = (person: PeerReviewer = "tom") =>
  editor(person).getByRole("textbox");
const saveButton = (person: PeerReviewer = "tom") =>
  editor(person).getByRole("button", {
    name: /^(Save response|Retry save) to/,
  });
const pick = (decision: PeerDecision, person: PeerReviewer = "tom") =>
  fireEvent.click(
    editor(person).getByRole("radio", {
      name:
        decision === "agree"
          ? "Agree with this feedback"
          : "Disagree with this feedback",
    }),
  );
const writeNote = (value: string, person: PeerReviewer = "tom") =>
  fireEvent.change(note(person), { target: { value } });
const saves = () =>
  wire.mock.calls
    .filter(([action]) => action === "save-peer")
    .map(([, body]) => body as Readonly<SavePeerFeedbackRequest>);
function expectExactNote(person: PeerReviewer, feedback: RelationshipFeedback) {
  const text = `Note: ${feedback.note}`;
  expect(
    original(person).getByText(text, { normalizer: (value) => value })
      .textContent,
  ).toBe(text);
}
async function loaded() {
  await waitFor(() =>
    expect(
      screen.queryByRole("progressbar", {
        name: "Loading shared feedback",
      }),
    ).not.toBeInTheDocument(),
  );
}

const uuid = jest.fn();
const uuidDescriptor = Object.getOwnPropertyDescriptor(
  window.crypto,
  "randomUUID",
);
beforeAll(() => {
  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value: uuid,
  });
});
afterAll(() => {
  if (uuidDescriptor)
    Object.defineProperty(window.crypto, "randomUUID", uuidDescriptor);
  else Reflect.deleteProperty(window.crypto, "randomUUID");
});
beforeEach(() => {
  uuid.mockReset().mockReturnValue(UUIDS[1]).mockReturnValueOnce(UUIDS[0]);
  wire
    .mockReset()
    .mockImplementation((action, body) =>
      action === "peer-feedback"
        ? Promise.resolve(rows((body as PeerFeedbackQuery).caseId))
        : Promise.reject(new Error(`Unexpected wire action: ${action}`)),
    );
});
afterEach(cleanup);

test.each(["tom", "rob"] as const)(
  "%s can respond to an existing review without seeing empty review or response sections",
  async (author) => {
    const target = author === "tom" ? "rob" : "tom";
    const data = rows();
    const own = data.reviewers.find((row) => row.reviewer === author)!;
    own.feedback = null;
    own.feedbackSha256 = null;
    wire.mockResolvedValue(data);
    render(<RelationshipPeerFeedback session={session(author)} caseId={A} />);
    await loaded();
    expect(
      screen.queryByRole("heading", {
        name: `${LABEL[author]}’s original review`,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: `${LABEL[target]}’s original review`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No original review saved/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No saved response from/),
    ).not.toBeInTheDocument();
    pick("agree", target);
    expect(saveButton(target)).toBeEnabled();
  },
);

test("hides the whole shared section when empty and shows saved feedback after navigation", async () => {
  const empty = rows();
  empty.reviewers.forEach((row) => {
    row.feedback = null;
    row.feedbackSha256 = null;
  });
  wire.mockResolvedValueOnce(empty).mockResolvedValueOnce(rows(B));
  const coordinator = session(null);
  const view = render(
    <RelationshipPeerFeedback session={coordinator} caseId={A} />,
  );
  await loaded();
  expect(
    screen.queryByRole("region", { name: "Tom and Rob’s feedback" }),
  ).not.toBeInTheDocument();
  view.rerender(<RelationshipPeerFeedback session={coordinator} caseId={B} />);
  await loaded();
  expectExactNote("tom", review("tom", B));
  expect(screen.queryByText(/No saved response from/)).not.toBeInTheDocument();
});

test("keeps a saved response and its snapshot when the live original is absent", async () => {
  const data = rows();
  const snapshot = data.reviewers[0].feedback!;
  data.reviewers[0].response = savedPeer("tom", snapshot);
  data.reviewers[0].feedback = null;
  data.reviewers[0].feedbackSha256 = null;
  wire.mockResolvedValue(data);
  render(<RelationshipPeerFeedback session={session(null)} caseId={A} />);
  await loaded();
  expect(
    screen.queryByRole("heading", { name: "Tom’s original review" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Saved response by Rob: Agree")).toBeInTheDocument();
  expect(
    screen.getByText("Saved target feedback (revision 1)"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(`Note: ${snapshot.note}`, {
      normalizer: (value) => value,
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/No original review saved/),
  ).not.toBeInTheDocument();
});

test("keeps identical retry controls if the target disappears after an uncertain save", async () => {
  const initial = rows();
  const snapshot = initial.reviewers[0].feedback!;
  const empty = rows();
  empty.reviewers.forEach((row) => {
    row.feedback = null;
    row.feedbackSha256 = null;
  });
  let reads = 0;
  let attempts = 0;
  wire.mockImplementation((action, body) => {
    if (action === "peer-feedback")
      return Promise.resolve(++reads === 1 ? initial : empty);
    if (++attempts === 1)
      return Promise.reject(new Error("Synthetic lost receipt"));
    return Promise.resolve({
      answer: receipt(body as SavePeerFeedbackRequest, snapshot),
    });
  });
  render(<RelationshipPeerFeedback session={session()} caseId={A} />);
  await loaded();
  pick("agree");
  writeNote("Preserve this pending response");
  fireEvent.click(saveButton());
  await screen.findByText(SAVE_ERROR);
  const pending = saves()[0];
  fireEvent.click(screen.getByRole("button", { name: "Refresh feedback" }));
  await loaded();
  expect(
    screen.queryByRole("heading", { name: "Tom’s original review" }),
  ).not.toBeInTheDocument();
  expect(note()).toHaveValue("Preserve this pending response");
  expect(note()).toBeDisabled();
  expect(saveButton()).toHaveAccessibleName("Retry save to Tom’s feedback");
  expect(saveButton()).toBeEnabled();
  fireEvent.click(saveButton());
  await screen.findByText("Saved response by Rob: Agree");
  await loaded();
  expect(saves()[1]).toBe(pending);
  expect(uuid).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText("Saved target feedback (revision 1)"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/No original review saved/),
  ).not.toBeInTheDocument();
});

test("Rob reads Tom's exact saved note and can agree/disagree, never self-respond", async () => {
  const data = rows();
  wire.mockResolvedValue(data);
  render(<RelationshipPeerFeedback session={session()} caseId={A} />);
  await loaded();
  expect(wire.mock.calls).toEqual([["peer-feedback", query(A)]]);
  expectExactNote("tom", data.reviewers[0].feedback!);
  expect(
    original("tom").getByText("Proposal decision: discuss"),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  expect(
    screen.queryByRole("group", { name: "Response to Rob’s feedback" }),
  ).not.toBeInTheDocument();
  expect(saveButton()).toBeDisabled();
  pick("agree");
  expect(editor().getByRole("radio", { name: /^Agree/ })).toBeChecked();
  expect(saveButton()).toBeEnabled();
  pick("disagree");
  expect(editor().getByRole("radio", { name: /^Disagree/ })).toBeChecked();
  expect(editor().getByRole("radio", { name: /^Agree/ })).not.toBeChecked();
  expectExactNote("tom", data.reviewers[0].feedback!);
  expect(saves()).toHaveLength(0);
});

test("Tom responds only to Rob with the opposite author/target binding", async () => {
  const data = rows();
  const target = data.reviewers[1].feedback!;
  wire.mockImplementation((action, body) =>
    action === "peer-feedback"
      ? Promise.resolve(data)
      : Promise.resolve({
          answer: receipt(body as SavePeerFeedbackRequest, target),
        }),
  );
  render(<RelationshipPeerFeedback session={session("tom")} caseId={A} />);
  await loaded();
  expectExactNote("rob", target);
  expect(
    screen.queryByRole("group", { name: "Response to Tom’s feedback" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  pick("disagree", "rob");
  writeNote("Tom peer fixture", "rob");
  fireEvent.click(saveButton("rob"));
  await original("rob").findByText("Saved response by Tom: Disagree");
  expect(saves()).toHaveLength(1);
  expect(saves()[0]).toMatchObject({
    ...query(A),
    reviewerKey: "fixture-tom",
    targetReviewer: "rob",
    targetRevision: target.revision,
    targetFeedbackSha256: sha(target),
    decision: "disagree",
    note: "Tom peer fixture",
  });
  expect(
    original("rob").getByText("Note: Tom peer fixture"),
  ).toBeInTheDocument();
});

test("coordinators are read-only; preview and denied viewers perform no reads", async () => {
  const data = rows();
  data.reviewers.forEach((row) => {
    row.response = savedPeer(row.reviewer, row.feedback!);
  });
  wire.mockResolvedValue(data);
  const view = render(
    <RelationshipPeerFeedback session={session(null)} caseId={A} />,
  );
  await loaded();
  expect(screen.getByText(/read-only for coordinators/)).toBeInTheDocument();
  expect(screen.getByText("Saved response by Rob: Agree")).toBeInTheDocument();
  expect(screen.getByText("Saved response by Tom: Agree")).toBeInTheDocument();
  expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /^(Save response|Retry save) to/ }),
  ).not.toBeInTheDocument();
  view.rerender(
    <RelationshipPeerFeedback
      session={session("rob", { preview: true })}
      caseId={A}
    />,
  );
  expect(
    screen.getByText(/Peer feedback is unavailable in preview/),
  ).toBeInTheDocument();
  view.rerender(
    <RelationshipPeerFeedback
      session={session("rob", { canViewPeerFeedback: false })}
      caseId={A}
    />,
  );
  expect(
    screen.getByText(/Peer feedback is unavailable for this reviewer/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Tom’s original review" }),
  ).not.toBeInTheDocument();
  expect(wire).toHaveBeenCalledTimes(1);
});

test("saves the exact immutable body and installs an answer-only receipt over an older refresh", async () => {
  const target = review("tom", A, 7);
  const data = rows(A, target);
  data.reviewers[0].response = savedPeer("tom", target, {
    revision: 3,
    decision: "disagree",
    note: "Previous saved response",
  });
  const refresh = deferred<PeerFeedbackResponse>();
  let reads = 0;
  wire.mockImplementation((action, body) =>
    action === "peer-feedback"
      ? ++reads === 1
        ? Promise.resolve(data)
        : refresh.promise
      : Promise.resolve({
          answer: receipt(body as SavePeerFeedbackRequest, target),
        }),
  );
  render(<RelationshipPeerFeedback session={session()} caseId={A} />);
  await loaded();
  expect(saveButton()).toBeDisabled();
  pick("agree");
  writeNote(" \n  Confirmed peer note.  \n ");
  fireEvent.click(saveButton());
  const body = saves()[0];
  expect(body).toEqual({
    ...query(A),
    reviewerKey: "fixture-rob",
    targetReviewer: "tom",
    targetRevision: 7,
    targetFeedbackSha256: sha(target),
    decision: "agree",
    note: "Confirmed peer note.",
    revision: 3,
    requestId: UUIDS[0],
  });
  expect(Object.isFrozen(body)).toBe(true);
  expect(body.requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await original("tom").findByText("Note: Confirmed peer note.");
  expect(
    original("tom").getByText("Saved response by Rob: Agree"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Retry save to Tom’s feedback" }),
  ).not.toBeInTheDocument();
  expect(reads).toBe(2);
  await act(async () => {
    refresh.resolve(data);
  });
  await loaded();
  expect(
    original("tom").getByText("Note: Confirmed peer note."),
  ).toBeInTheDocument();
  expect(note()).toHaveValue("Confirmed peer note.");
  expect(saveButton()).toBeDisabled();
  expect(uuid).toHaveBeenCalledTimes(1);
});

test("a lost receipt survives navigation and retries the identical body/ID after target changes", async () => {
  const a = rows(A);
  const b = rows(B);
  const oldTarget = a.reviewers[0].feedback!;
  const newTarget = review("tom", A, 2, "Updated Tom target");
  const changed = rows(A, newTarget);
  const first = deferred<{ answer: PeerFeedback }>();
  const retry = deferred<{ answer: PeerFeedback }>();
  let aReads = 0;
  let attempts = 0;
  wire.mockImplementation((action, body) => {
    if (action === "peer-feedback")
      return Promise.resolve(
        (body as PeerFeedbackQuery).caseId === B
          ? b
          : ++aReads === 1
            ? a
            : changed,
      );
    return ++attempts === 1 ? first.promise : retry.promise;
  });
  const rob = session();
  const view = render(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  pick("agree");
  writeNote("  Keep this request  ");
  fireEvent.click(saveButton());
  const pending = saves()[0];
  expect(note()).toBeDisabled();
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={B} />);
  await loaded();
  expectExactNote("tom", b.reviewers[0].feedback!);
  expect(note()).toHaveValue("");
  await act(async () => {
    first.reject(new Error("Synthetic lost receipt"));
  });
  expect(screen.queryByText(SAVE_ERROR)).not.toBeInTheDocument();
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  expectExactNote("tom", newTarget);
  expect(note()).toHaveValue("  Keep this request  ");
  expect(note()).toBeDisabled();
  expect(editor().getByRole("radio", { name: /^Agree/ })).toBeChecked();
  expect(
    screen.getByRole("button", { name: "Review updated feedback from Tom" }),
  ).toBeDisabled();
  expect(saveButton()).toHaveAccessibleName("Retry save to Tom’s feedback");
  expect(saveButton()).toBeEnabled();
  fireEvent.click(saveButton());
  expect(saves()[1]).toBe(pending);
  expect(Object.isFrozen(pending)).toBe(true);
  expect(pending).toMatchObject({
    targetRevision: 1,
    targetFeedbackSha256: sha(oldTarget),
    note: "Keep this request",
  });
  expect(uuid).toHaveBeenCalledTimes(1);
  await act(async () => {
    retry.resolve({ answer: receipt(pending, oldTarget) });
  });
  await loaded();
  expect(
    original("tom").getByText("Note: Keep this request"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("This response refers to earlier feedback"),
  ).toBeInTheDocument();
  expectExactNote("tom", oldTarget);
  expect(
    screen.getByRole("button", { name: "Review updated feedback from Tom" }),
  ).toBeEnabled();
});

test("case drafts survive navigation and late reads cannot replace the active case/account", async () => {
  const a = rows(A);
  const b = rows(B);
  const newA = rows(A, review("tom", A, 2, "Late A feedback"));
  const newB = rows(
    B,
    review("tom", B, 2, "Late B feedback for prior account"),
  );
  const lateA = deferred<PeerFeedbackResponse>();
  const lateB = deferred<PeerFeedbackResponse>();
  wire
    .mockReset()
    .mockResolvedValueOnce(a)
    .mockReturnValueOnce(lateA.promise)
    .mockResolvedValueOnce(b)
    .mockReturnValueOnce(lateB.promise)
    .mockResolvedValueOnce(b)
    .mockResolvedValueOnce(newB)
    .mockResolvedValueOnce(newA);
  const rob = session();
  const tom = session("tom");
  const view = render(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  pick("agree");
  writeNote("A draft");
  fireEvent.click(screen.getByRole("button", { name: "Refresh feedback" }));
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={B} />);
  await loaded();
  pick("disagree");
  writeNote("B draft");
  fireEvent.click(screen.getByRole("button", { name: "Refresh feedback" }));
  view.rerender(<RelationshipPeerFeedback session={tom} caseId={B} />);
  await loaded();
  expect(note("rob")).toHaveValue("");
  await act(async () => {
    lateA.resolve(newA);
    lateB.resolve(newB);
  });
  expectExactNote("tom", b.reviewers[0].feedback!);
  expect(note("rob")).toHaveValue("");
  expect(screen.queryByText("Note: Late A feedback")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Note: Late B feedback for prior account"),
  ).not.toBeInTheDocument();
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={B} />);
  await loaded();
  expect(note()).toHaveValue("B draft");
  expect(editor().getByRole("radio", { name: /^Disagree/ })).toBeChecked();
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  expect(note()).toHaveValue("A draft");
  expect(editor().getByRole("radio", { name: /^Agree/ })).toBeChecked();
  expectExactNote("tom", newA.reviewers[0].feedback!);
  expect(saves()).toHaveLength(0);
});

test("late successful saves stay with their original case/account", async () => {
  const a = rows(A);
  const b = rows(B);
  const pendingSave = deferred<{ answer: PeerFeedback }>();
  wire.mockImplementation((action, body) =>
    action === "peer-feedback"
      ? Promise.resolve((body as PeerFeedbackQuery).caseId === A ? a : b)
      : pendingSave.promise,
  );
  const rob = session();
  const tom = session("tom");
  const view = render(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  pick("disagree");
  writeNote("Rob A only");
  fireEvent.click(saveButton());
  const pending = saves()[0];
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={B} />);
  await loaded();
  pick("disagree");
  writeNote("Rob B draft");
  view.rerender(<RelationshipPeerFeedback session={tom} caseId={B} />);
  await loaded();
  pick("agree", "rob");
  writeNote("Tom B draft", "rob");
  await act(async () => {
    pendingSave.resolve({ answer: receipt(pending, a.reviewers[0].feedback!) });
  });
  await loaded();
  expect(note("rob")).toHaveValue("Tom B draft");
  expectExactNote("tom", b.reviewers[0].feedback!);
  expect(screen.queryByText("Note: Rob A only")).not.toBeInTheDocument();
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={B} />);
  await loaded();
  expect(note()).toHaveValue("Rob B draft");
  view.rerender(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  expect(
    original("tom").getByText("Saved response by Rob: Disagree"),
  ).toBeInTheDocument();
  expect(original("tom").getByText("Note: Rob A only")).toBeInTheDocument();
  expect(note()).toHaveValue("Rob A only");
  expect(saveButton()).toBeDisabled();
  expect(saves()).toHaveLength(1);
});

test("stale responses show the stored target snapshot and require explicit review before a new choice", async () => {
  const snapshot = review(
    "tom",
    A,
    1,
    "Earlier Tom snapshot.\n  Preserved second line.",
  );
  const current = review("tom", A, 3, "Current Tom feedback");
  const data = rows(A, current);
  data.reviewers[0].response = savedPeer("tom", snapshot, {
    revision: 4,
    decision: "disagree",
    note: "Earlier peer response",
  });
  wire.mockResolvedValue(data);
  render(<RelationshipPeerFeedback session={session()} caseId={A} />);
  await loaded();
  expect(
    screen.getByText("This response refers to earlier feedback"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Saved target feedback (revision 1)"),
  ).toBeInTheDocument();
  expectExactNote("tom", snapshot);
  expectExactNote("tom", current);
  expect(
    original("tom").getByText("Saved response by Rob: Disagree"),
  ).toBeInTheDocument();
  expect(note()).toHaveValue("");
  expect(note()).toBeDisabled();
  editor()
    .getAllByRole("radio")
    .forEach((radio) => {
      expect(radio).toBeDisabled();
      expect(radio).not.toBeChecked();
    });
  expect(saveButton()).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Review updated feedback from Tom" }),
  );
  expect(note()).toBeEnabled();
  expect(note()).toHaveValue("");
  expect(saveButton()).toBeDisabled();
  pick("agree");
  expect(editor().getByRole("radio", { name: /^Agree/ })).toBeChecked();
  expect(saveButton()).toBeEnabled();
  expect(saves()).toHaveLength(0);
});

test("409 refresh retains the draft until explicit rebase and then uses a new bound request", async () => {
  const initial = rows();
  const target = review("tom", A, 2, "Updated after conflict");
  const updated = rows(A, target);
  updated.reviewers[0].response = savedPeer("tom", target, {
    revision: 2,
    decision: "disagree",
    note: "Other-tab saved response",
  });
  let current = initial;
  let attempts = 0;
  wire.mockImplementation((action, body) => {
    if (action === "peer-feedback") return Promise.resolve(current);
    if (++attempts === 1) {
      current = updated;
      return Promise.reject(
        Object.assign(new Error("Synthetic conflict"), { status: 409 }),
      );
    }
    return Promise.resolve({
      answer: receipt(body as SavePeerFeedbackRequest, target),
    });
  });
  render(<RelationshipPeerFeedback session={session()} caseId={A} />);
  await loaded();
  pick("agree");
  writeNote("409 draft kept verbatim");
  fireEvent.click(saveButton());
  await screen.findByText(CONFLICT_ERROR);
  await loaded();
  expectExactNote("tom", target);
  expect(note()).toHaveValue("409 draft kept verbatim");
  expect(note()).toBeDisabled();
  expect(editor().getByRole("radio", { name: /^Agree/ })).toBeChecked();
  expect(saveButton()).toHaveAccessibleName("Save response to Tom’s feedback");
  expect(saveButton()).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Review updated feedback from Tom" }),
  );
  expect(note()).toHaveValue("");
  editor()
    .getAllByRole("radio")
    .forEach((radio) => expect(radio).not.toBeChecked());
  expect(screen.queryByText(CONFLICT_ERROR)).not.toBeInTheDocument();
  expect(saveButton()).toBeDisabled();
  pick("disagree");
  writeNote("Rebased note");
  fireEvent.click(saveButton());
  await original("tom").findByText("Note: Rebased note");
  expect(saves()[1]).toEqual({
    ...query(A),
    reviewerKey: "fixture-rob",
    targetReviewer: "tom",
    targetRevision: 2,
    targetFeedbackSha256: sha(target),
    decision: "disagree",
    note: "Rebased note",
    revision: 2,
    requestId: UUIDS[1],
  });
  expect(saves()[1]).not.toBe(saves()[0]);
  expect(uuid).toHaveBeenCalledTimes(2);
});

test("refreshes peer reads when the current own-proposal revision changes, not just its object", async () => {
  const initial = rows();
  const updated = rows(
    A,
    review("tom", A, 2, "Peer feedback after own revision"),
  );
  wire
    .mockReset()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(updated);
  const own = review("rob", A, 1);
  const rob = session("rob", { feedback: { [A]: own } });
  const view = render(<RelationshipPeerFeedback session={rob} caseId={A} />);
  await loaded();
  view.rerender(
    <RelationshipPeerFeedback
      session={{
        ...rob,
        feedback: { [A]: { ...own, note: "Same revision, new object" } },
      }}
      caseId={A}
    />,
  );
  expect(wire).toHaveBeenCalledTimes(1);
  view.rerender(
    <RelationshipPeerFeedback
      session={{
        ...rob,
        feedback: { [A]: { ...own, revision: 2 } },
      }}
      caseId={A}
    />,
  );
  await loaded();
  expect(wire.mock.calls).toEqual([
    ["peer-feedback", query(A)],
    ["peer-feedback", query(A)],
  ]);
  expectExactNote("tom", updated.reviewers[0].feedback!);
});

test("fails closed on malformed or wrong-bound peer reads", async () => {
  const base = rows();
  const snapshot = base.reviewers[0].feedback!;
  const stored = savedPeer("tom", snapshot);
  base.reviewers[0].response = stored;
  const withResponse = (response: unknown) => ({
    ...base,
    reviewers: [{ ...base.reviewers[0], response }, base.reviewers[1]],
  });
  const cases: Array<[string, unknown]> = [
    ["null read", null],
    ["unexpected envelope", { data: base }],
    ["wrong case", { ...base, caseId: B }],
    ["wrong version", { ...base, datasetVersion: "wrong-version" }],
    ["wrong dataset hash", { ...base, datasetSha256: "0".repeat(64) }],
    ["missing reviewer", { ...base, reviewers: [base.reviewers[0]] }],
    [
      "self-authored response",
      withResponse({ ...stored, authorReviewer: "tom" }),
    ],
    [
      "wrong snapshot case",
      withResponse({ ...stored, targetFeedback: { ...snapshot, caseId: B } }),
    ],
    [
      "unsupported peer decision",
      withResponse({ ...stored, decision: "discuss" }),
    ],
  ];
  for (const [name, payload] of cases) {
    wire.mockReset().mockResolvedValue(payload);
    const view = render(
      <RelationshipPeerFeedback session={session()} caseId={A} />,
    );
    await loaded();
    expect({ name, rejected: !!screen.queryByText(READ_ERROR) }).toEqual({
      name,
      rejected: true,
    });
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Tom’s original review" }),
    ).not.toBeInTheDocument();
    expect(saves()).toHaveLength(0);
    view.unmount();
  }
});

test("fails closed on malformed/wrong-bound receipts and keeps an identical retry", async () => {
  const data = rows();
  const snapshot = data.reviewers[0].feedback!;
  const cases: Array<[string, (r: PeerFeedback) => unknown]> = [
    ["missing answer", () => ({})],
    ["wrong case", (r) => ({ answer: { ...r, caseId: B } })],
    [
      "wrong version",
      (r) => ({ answer: { ...r, datasetVersion: "wrong-version" } }),
    ],
    ["wrong author", (r) => ({ answer: { ...r, authorReviewer: "tom" } })],
    [
      "wrong target hash",
      (r) => ({ answer: { ...r, targetFeedbackSha256: "0".repeat(64) } }),
    ],
    ["changed decision", (r) => ({ answer: { ...r, decision: "disagree" } })],
    [
      "changed note",
      (r) => ({ answer: { ...r, note: "Not our submitted note" } }),
    ],
    [
      "wrong response revision",
      (r) => ({ answer: { ...r, revision: r.revision + 1 } }),
    ],
    [
      "wrong snapshot case",
      (r) => ({
        answer: { ...r, targetFeedback: { ...r.targetFeedback, caseId: B } },
      }),
    ],
    [
      "changed snapshot bytes",
      (r) => ({
        answer: {
          ...r,
          targetFeedback: {
            ...r.targetFeedback,
            note: "Corrupted target snapshot",
          },
        },
      }),
    ],
  ];
  for (const [name, badReply] of cases) {
    uuid.mockReset().mockReturnValue(UUIDS[0]);
    const reply = deferred<unknown>();
    wire
      .mockReset()
      .mockImplementation((action) =>
        action === "peer-feedback" ? Promise.resolve(data) : reply.promise,
      );
    const view = render(
      <RelationshipPeerFeedback session={session()} caseId={A} />,
    );
    await loaded();
    pick("agree");
    writeNote("Unconfirmed note");
    fireEvent.click(saveButton());
    const pending = saves()[0];
    await act(async () => {
      reply.resolve(badReply(receipt(pending, snapshot)));
    });
    await loaded();
    expect({ name, rejected: !!editor().queryByText(SAVE_ERROR) }).toEqual({
      name,
      rejected: true,
    });
    expect(
      original("tom").queryByText("Saved response by Rob: Agree"),
    ).not.toBeInTheDocument();
    expect(note()).toHaveValue("Unconfirmed note");
    expect(note()).toBeDisabled();
    expect(saveButton()).toHaveAccessibleName("Retry save to Tom’s feedback");
    expect(saveButton()).toBeEnabled();
    await act(async () => {
      fireEvent.click(saveButton());
    });
    expect(saves()[1]).toBe(pending);
    expect(uuid).toHaveBeenCalledTimes(1);
    view.unmount();
  }
});
