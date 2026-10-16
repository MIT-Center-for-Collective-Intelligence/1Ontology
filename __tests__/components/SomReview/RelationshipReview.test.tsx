/** @jest-environment jsdom */
import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import RelationshipReview from "../../../src/components/SomReview/RelationshipReview";
import type { RelationshipSession } from "../../../src/types/IRelationshipReview";
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("../../../src/lib/firestoreClient/auth", () => ({
  getIdToken: async () => "test-token",
}));
const session: RelationshipSession = {
  reviewerKey: "tom-hash",
  reviewerLabel: "Tom",
  preview: false,
  canViewTomFeedback: true,
  datasetSha256: "sha",
  feedback: {},
  dataset: {
    version: "v1",
    createdAt: "now",
    title: "Relationship review",
    model: "gpt-6.1-sol",
    modelVersion: "2026-09-29",
    reasoning: "high",
    fundingRoute: "ACCESS",
    sourceApp: "final",
    sourceCapturedAt: "now",
    sourceSha256: "source-sha",
    scopeExplanation: "Act is level 1.",
    candidateLimit: "Bounded search",
    prompt: "Exact prompt",
    challengePrompt: "Exact challenge",
    candidates: [{ id: "think", title: "Think" }],
    cases: [
      {
        id: "reason",
        title: "Reason",
        level: 4,
        scope: "top-four-levels",
        currentParents: [
          { id: "think", title: "Think", description: "Think about things" },
        ],
        children: [],
        ancestors: [],
        sourceIssues: [],
        responseId: "resp_1",
        challengeResponseId: "resp_2",
        requestSha256: "req-sha",
        mechanicalIssues: [],
        challenge: {
          verdict: "supported",
          reason: "Provisional support",
          issues: [],
        },
        analysis: {
          nodeId: "reason",
          judgment: "keep",
          summary: "Keep this placement.",
          meaning: "Draw conclusions",
          currentLinks: [
            {
              parentId: "think",
              assessment: "valid",
              reason: "Inference is thinking.",
              counterexample: "None established",
            },
          ],
          proposedParents: [
            {
              nodeId: "think",
              reason: "Every case fits.",
              whyCloser: "No closer option established.",
            },
          ],
          alternatives: [],
          example: "Compare explanations",
          caution: "Meaning needs expert review.",
          definitionConflict: "",
          referenceNodeIds: ["reason", "think"],
        },
      },
    ],
  },
};
const clone = () => JSON.parse(JSON.stringify(session));
const curated = () => {
  const data = clone();
  data.canViewTomFeedback = false;
  const item = JSON.parse(JSON.stringify(data.dataset.cases[0]));
  item.id = "selected";
  item.title = "Selected activity";
  item.analysis.nodeId = item.id;
  item.currentParents = [
    { id: "old", title: "Old generalization" },
    { id: "think", title: "Think" },
  ];
  item.analysis.judgment = "change";
  item.analysis.proposedParents = [
    { nodeId: "think", reason: "Keep this valid link", whyCloser: "" },
    { nodeId: "new", reason: "Add a suitable generalization", whyCloser: "" },
  ];
  data.dataset.candidates.push(
    { id: "old", title: "Old generalization" },
    { id: "new", title: "New generalization" },
  );
  data.dataset.cases.push(item);
  data.presentationSha256 = "presentation-sha";
  data.presentation = {
    version: "p1",
    datasetVersion: "v1",
    datasetSha256: "sha",
    selectedCaseIds: ["selected"],
    cards: [
      {
        caseId: "selected",
        eligible: true,
        remainingMaterialObjections: [],
        headline: "Replace only the unsupported generalization",
        reason: "The current definition excludes the stated example.",
        whyChange: "A detailed argument",
        example: "An illustrative example",
        quotes: [{ nodeId: "think", quote: "Think about things" }],
        alternativeAssessment: "The other valid generalization remains.",
      },
    ],
  };
  return data;
};
const respond = (data: any, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data,
});
const answer = (revision = 1, note = "", decision = "agree") => ({
  caseId: "reason",
  datasetVersion: "v1",
  decision,
  note,
  correction: "",
  revision,
  savedAt: "2026-10-16T12:00:00Z",
});
const setup = (
  save: (body: any) => any = () => respond({ answer: answer() }),
  data = clone(),
) => {
  (global.fetch as jest.Mock).mockImplementation(async (url, options) =>
    String(url).endsWith("session")
      ? respond(data)
      : save(JSON.parse(options.body)),
  );
  return render(<RelationshipReview />);
};
beforeEach(() => {
  window.history.replaceState({}, "", "/review/relationships?view=analysis");
  sessionStorage.clear();
  localStorage.clear();
  jest.restoreAllMocks();
  global.fetch = jest.fn();
  let id = 0;
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: () => "aaaaaaaa-bbbb-cccc-dddd-" + String(++id).padStart(12, "0"),
  });
});
test("the default queue includes only selected actual changes and shows Generalizations", async () => {
  window.history.replaceState({}, "", "/review/relationships?activity=reason");
  setup(undefined, curated());
  await screen.findByRole("heading", { name: "Selected activity" });
  expect(
    screen.queryByRole("heading", { name: "Reason" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("0 of 1 selected proposals reviewed"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Current generalizations" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Proposed generalizations" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Current broader activities"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("The current definition excludes the stated example."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "View research archive" }),
  ).not.toBeInTheDocument();
});
test("a partial change keeps the other valid generalization and binds new saves to the displayed evidence", async () => {
  window.history.replaceState({}, "", "/review/relationships");
  setup(
    () => respond({ answer: { ...answer(), caseId: "selected" } }),
    curated(),
  );
  await screen.findByRole("heading", { name: "Selected activity" });
  expect(
    screen.getByText(/Remove the generalization link to Old generalization/),
  ).toHaveTextContent(
    "Add the generalization link to New generalization. Keep Think.",
  );
  expect(screen.getByText("Think (keep this link)")).toBeInTheDocument();
  fireEvent.click(
    screen.getByLabelText("Agree with the proposed generalizations"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText("Saved to your account.");
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
      .presentationSha256,
  ).toBe("presentation-sha");
});
test("an unchanged archived analysis does not duplicate current and proposed generalizations", async () => {
  setup();
  await screen.findByRole("heading", { name: "Reason" });
  expect(
    screen.getByText(/No change is proposed. Current generalizations: Think/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Current generalizations" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Proposed generalizations" }),
  ).not.toBeInTheDocument();
});
test("an old idempotent receipt cannot replace a newer answer already loaded in this tab", async () => {
  const data = clone();
  data.feedback.reason = answer(2, "Latest answer", "disagree");
  sessionStorage.setItem(
    "relationship-review:tom-hash:v1:sha:reason",
    JSON.stringify({
      decision: "agree",
      note: "Earlier draft",
      correction: "",
      revision: 0,
      dirty: true,
      pending: {
        caseId: "reason",
        datasetVersion: "v1",
        datasetSha256: "sha",
        decision: "agree",
        note: "Earlier draft",
        correction: "",
        revision: 0,
        requestId: "aaaaaaaa-bbbb-cccc-dddd-000000000000",
        reviewerKey: "tom-hash",
      },
    }),
  );
  setup(() => respond({ answer: answer(1, "Earlier draft") }), data);
  fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
  await screen.findByRole("button", {
    name: "Keep my draft and edit the latest answer",
  });
  expect(screen.getByLabelText("Comments or examples (optional)")).toHaveValue(
    "Earlier draft",
  );
  expect(screen.getByText(/revision 2/)).toBeInTheDocument();
  expect(screen.queryByText("Saved to your account.")).not.toBeInTheDocument();
});
test("a delayed session reload cannot erase a save made while it was loading", async () => {
  window.history.replaceState(
    {},
    "",
    "/review/relationships?view=analysis&activity=missing",
  );
  let reads = 0,
    release: (v: any) => void = () => {};
  (global.fetch as jest.Mock).mockImplementation(async (url) => {
    if (String(url).endsWith("session"))
      return ++reads === 1
        ? respond(clone())
        : new Promise((resolve) => {
            release = resolve;
          });
    return respond({ answer: answer(1, "Saved while loading") });
  });
  render(<RelationshipReview />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(reads).toBe(2));
  fireEvent.click(
    screen.getByLabelText("Agree with the proposed generalizations"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText(/revision 1/);
  await act(async () => {
    release(respond(clone()));
  });
  expect(screen.getByText("1 of 1 analyses reviewed")).toBeInTheDocument();
  expect(screen.getByText(/revision 1/)).toBeInTheDocument();
  expect(screen.getByLabelText("Comments or examples (optional)")).toHaveValue(
    "Saved while loading",
  );
});
test("no default judgment; saves only after acknowledgement and hides technical details", async () => {
  setup();
  await screen.findByRole("heading", { name: "Reason" });
  expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled();
  expect(
    screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked),
  ).toBe(true);
  expect(
    screen.getByRole("button", {
      name: "Agents and prompts used for this proposal",
    }),
  ).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(
    screen.getByLabelText("Agree with the proposed generalizations"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText("Saved to your account.");
  expect(screen.getByText("1 of 1 analyses reviewed")).toBeInTheDocument();
  const call = (global.fetch as jest.Mock).mock.calls[1];
  expect(call[0]).toBe("/api/som-review/relationships/save");
  expect(call[1].headers.Authorization).toBe("Bearer test-token");
});
test("lost-response retry restores the exact request after reload", async () => {
  let attempts = 0;
  const payloads: any[] = [];
  const save = (body: any) => {
    payloads.push(body);
    if (++attempts === 1) throw Error("Connection lost");
    return respond({ answer: answer(1, "Check meaning", "discuss") });
  };
  const view = setup(save);
  await screen.findByRole("heading", { name: "Reason" });
  fireEvent.click(
    screen.getByLabelText("Needs discussion — I’m not ready to decide"),
  );
  fireEvent.change(screen.getByLabelText("Comments or examples (optional)"), {
    target: { value: "Check meaning" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText(/Connection lost/);
  expect(screen.queryByText("Saved to your account.")).not.toBeInTheDocument();
  view.unmount();
  setup(save);
  await screen.findByRole("button", { name: "Retry save" });
  expect(screen.getByLabelText("Comments or examples (optional)")).toHaveValue(
    "Check meaning",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await screen.findByText("Saved to your account.");
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
  expect(localStorage.length).toBe(0);
});
test("revision conflict offers explicit recovery while preserving the draft", async () => {
  let sessions = 0,
    attempts = 0;
  const payloads: any[] = [];
  (global.fetch as jest.Mock).mockImplementation(async (url, options) => {
    if (String(url).endsWith("session")) {
      const data = clone();
      if (++sessions > 1)
        data.feedback.reason = answer(1, "Other tab’s notes", "disagree");
      return respond(data);
    }
    const body = JSON.parse(options.body);
    payloads.push(body);
    return ++attempts === 1
      ? respond(
          { error: "A newer answer was saved", code: "revision_conflict" },
          409,
        )
      : respond({ answer: answer(2, "My notes", "discuss") });
  });
  render(<RelationshipReview />);
  await screen.findByRole("heading", { name: "Reason" });
  fireEvent.click(
    screen.getByLabelText("Needs discussion — I’m not ready to decide"),
  );
  fireEvent.change(screen.getByLabelText("Comments or examples (optional)"), {
    target: { value: "My notes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  const recover = await screen.findByRole("button", {
    name: "Keep my draft and edit the latest answer",
  });
  expect(screen.getByLabelText("Comments or examples (optional)")).toHaveValue(
    "My notes",
  );
  fireEvent.click(recover);
  expect(
    screen.getByLabelText("Comments or examples (optional)"),
  ).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText(/revision 2/);
  expect(payloads[1].revision).toBe(1);
  expect(payloads[1].note).toBe("My notes");
  expect(payloads[1].requestId).not.toBe(payloads[0].requestId);
});
test("unavailable browser storage does not lose a draft when navigating between activities", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Storage full");
  });
  const data = clone();
  data.dataset.cases.push({
    ...data.dataset.cases[0],
    id: "other",
    title: "Other",
  });
  setup(undefined, data);
  await screen.findByRole("heading", { name: "Reason" });
  fireEvent.change(screen.getByLabelText("Comments or examples (optional)"), {
    target: { value: "Still here" },
  });
  await screen.findByText(/keep this tab open until your answer is saved/);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Other" });
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByRole("heading", { name: "Reason" });
  expect(screen.getByLabelText("Comments or examples (optional)")).toHaveValue(
    "Still here",
  );
});
test("a delayed old acknowledgement cannot downgrade a newer saved revision", async () => {
  let releaseOld: (v: any) => void = () => {};
  let calls = 0;
  const data = clone();
  data.dataset.cases.push({
    ...data.dataset.cases[0],
    id: "other",
    title: "Other",
  });
  setup(() => {
    calls++;
    return calls === 1
      ? new Promise((resolve) => {
          releaseOld = resolve;
        })
      : respond({
          answer: answer(calls - 1, calls === 3 ? "Newer notes" : ""),
        });
  }, data);
  await screen.findByRole("heading", { name: "Reason" });
  fireEvent.click(
    screen.getByLabelText("Agree with the proposed generalizations"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByRole("button", { name: "Saving…" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
  await screen.findByText(/revision 1/);
  fireEvent.change(screen.getByLabelText("Comments or examples (optional)"), {
    target: { value: "Newer notes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText(/revision 2/);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await act(async () => {
    releaseOld(respond({ answer: answer(1) }));
  });
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByText(/revision 2/);
  expect(screen.getByLabelText("Comments or examples (optional)")).toHaveValue(
    "Newer notes",
  );
});
