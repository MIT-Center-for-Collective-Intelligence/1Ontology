/** @jest-environment jsdom */
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => (
  <button>Use dark mode</button>
));
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("../../../src/lib/firestoreClient/auth", () => ({
  getIdToken: async () => "test-token",
}));
import RelationshipReview from "../../../src/components/SomReview/RelationshipReview";
import type {
  RelationshipCase,
  RelationshipFeedback,
  RelationshipSession,
} from "../../../src/types/IRelationshipReview";

type FeedbackWithRevisit = RelationshipFeedback & { revisitLater?: boolean };

function reviewCase(id: string, title: string): RelationshipCase {
  return {
    id,
    title,
    level: 4,
    scope: "top-four-levels",
    currentParents: [{ id: "think", title: "Think" }],
    children: [],
    ancestors: [],
    sourceIssues: [],
    responseId: `response-${id}`,
    requestSha256: `request-${id}`,
    challengeResponseId: `challenge-${id}`,
    mechanicalIssues: [],
    challenge: {
      verdict: "supported",
      reason: "Test support",
      issues: [],
    },
    analysis: {
      nodeId: id,
      judgment: "change",
      summary: "Retain Think and add Act.",
      meaning: "Frozen test meaning",
      currentLinks: [
        {
          parentId: "think",
          assessment: "valid",
          reason: "Retain this Generalization.",
          counterexample: "None in this fixture",
        },
      ],
      proposedParents: [
        { nodeId: "think", reason: "Retain this Generalization.", whyCloser: "" },
        { nodeId: "act", reason: "Add this Generalization.", whyCloser: "" },
      ],
      alternatives: [],
      example: "Frozen test example",
      caution: "For review only.",
      definitionConflict: "",
      referenceNodeIds: [id, "think", "act"],
    },
  };
}

function makeSession(): RelationshipSession {
  const cases = [
    reviewCase("reason", "Reason"),
    reviewCase("observe", "Observe"),
    reviewCase("plan", "Plan"),
  ];
  return {
    reviewerKey: "rob-hash",
    reviewerLabel: "Rob",
    preview: false,
    canViewTomFeedback: true,
    datasetSha256: "sha",
    feedback: {},
    dataset: {
      version: "v1",
      createdAt: "2026-10-16T12:00:00Z",
      title: "Relationship review fixture",
      model: "test-model",
      modelVersion: "test-version",
      reasoning: "high",
      fundingRoute: "ACCESS",
      sourceApp: "test",
      sourceCapturedAt: "2026-10-16T12:00:00Z",
      sourceSha256: "source-sha",
      scopeExplanation: "Test scope.",
      candidateLimit: "Test candidates.",
      prompt: "Frozen test prompt",
      challengePrompt: "Frozen test challenge",
      candidates: [
        { id: "think", title: "Think" },
        { id: "act", title: "Act" },
      ],
      cases,
    },
    presentationSha256: "presentation-sha",
    presentation: {
      version: "p1",
      datasetVersion: "v1",
      datasetSha256: "sha",
      selectedCaseIds: cases.map((c) => c.id),
      cards: cases.map((c) => ({
        caseId: c.id,
        eligible: true,
        reason: "Test selection",
        headline: "Retain Think and add Act",
        whyChange: "Frozen test explanation",
        example: "Frozen test example",
        exampleIsIllustrative: true,
        quotes: [],
        alternativeAssessment: "Other Generalizations remain.",
        remainingMaterialObjections: [],
      })),
      selectionRule: "Test selection",
      model: "test-model",
      reasoning: "high",
      fundingRoute: "ACCESS",
    },
  };
}

function feedback(caseId: string, revisitLater?: boolean): FeedbackWithRevisit {
  return {
    caseId,
    datasetVersion: "v1",
    decision: "disagree",
    note: "Original note.\nKeep this example.",
    correction: "Think; Act",
    revision: 2,
    savedAt: "2026-10-16T12:00:00Z",
    ...(revisitLater === undefined ? {} : { revisitLater }),
  };
}

function savedAnswer(body: any): FeedbackWithRevisit {
  return {
    caseId: body.caseId,
    datasetVersion: body.datasetVersion,
    decision: body.decision,
    note: body.note,
    correction: body.correction,
    revisitLater: body.revisitLater,
    revision: body.revision + 1,
    savedAt: "2026-10-17T12:00:00Z",
    presentationSha256: body.presentationSha256,
  };
}

const respond = (value: any, status = 200) => {
  const snapshot = JSON.parse(JSON.stringify(value));
  return { ok: status === 200, status, json: async () => snapshot };
};

function setup(
  save: (body: any) => any = (body) => respond({ answer: savedAnswer(body) }),
  data = makeSession(),
  tomFeedback: Record<string, FeedbackWithRevisit> = {},
) {
  const saves: any[] = [];
  (global.fetch as jest.Mock).mockImplementation(async (url, options) => {
    const path = String(url);
    if (path.endsWith("session")) return respond(data);
    if (path.endsWith("tom-feedback")) return respond({ feedback: tomFeedback });
    const body = JSON.parse(options.body);
    if (path.endsWith("evidence"))
      return respond({
        evidence: {
          caseId: body.caseId,
          datasetVersion: data.dataset.version,
          datasetSha256: data.datasetSha256,
          complete: true,
          limitation: "",
          records: [],
        },
      });
    if (path.endsWith("save")) {
      saves.push(body);
      return save(body);
    }
    throw Error(`Unexpected review request: ${path}`);
  });
  return { ...render(<RelationshipReview />), saves };
}

async function chooseOption(label: string, name: string | RegExp) {
  fireEvent.mouseDown(screen.getByLabelText(label, { selector: '[role="combobox"]' }));
  fireEvent.click(await screen.findByRole("option", { name }));
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
}

async function expectActivity(id: string) {
  await waitFor(() =>
    expect(new URL(window.location.href).searchParams.get("activity")).toBe(id),
  );
}

function expectOriginalAnswer(original: RelationshipFeedback) {
  const name = {
    agree: /^Agree/,
    disagree: /^Disagree/,
    discuss: /^Needs discussion/,
  }[original.decision];
  expect(screen.getByRole("radio", { name })).toBeChecked();
  expect(screen.getByLabelText("Comments or examples (optional)"))
    .toHaveValue(original.note);
  expect(screen.getByLabelText("Suggested generalizations (optional)"))
    .toHaveValue(original.correction);
}

const originalFetch = global.fetch;
const originalMatchMedia = window.matchMedia;
const originalRandomUUID = Object.getOwnPropertyDescriptor(
  window.crypto,
  "randomUUID",
);
let requestSequence = 0;
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/review/relationships");
  global.fetch = jest.fn();
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
  requestSequence = 0;
  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value: () =>
      `00000000-0000-4000-8000-${String(++requestSequence).padStart(12, "0")}`,
  });
});
afterEach(cleanup);
afterAll(() => {
  global.fetch = originalFetch;
  window.matchMedia = originalMatchMedia;
  if (originalRandomUUID)
    Object.defineProperty(window.crypto, "randomUUID", originalRandomUUID);
  else Reflect.deleteProperty(window.crypto, "randomUUID");
});

test.each([true, false, undefined])(
  "loads saved revisitLater=%s without resubmitting or changing feedback",
  async (flag) => {
    const data = makeSession();
    const original = feedback("reason", flag);
    data.feedback.reason = original;
    const before = JSON.stringify(data.feedback);
    const { saves } = setup(undefined, data);
    const checkbox = await screen.findByRole("checkbox", { name: "Revisit later" });
    if (flag === true) expect(checkbox).toBeChecked();
    else expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAccessibleDescription(/No comment is needed/);
    expectOriginalAnswer(original);
    expect(saves).toEqual([]);
    expect(JSON.stringify(data.feedback)).toBe(before);
    expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled();
  },
);

test.each([false, true])(
  "explicitly saves a flag-only revision from revisitLater=%s",
  async (flag) => {
    const data = makeSession();
    const original = feedback("reason", flag);
    data.feedback.reason = original;
    const before = JSON.stringify(data.feedback);
    const { saves } = setup(undefined, data);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Revisit later" }));
    expectOriginalAnswer(original);
    expect(saves).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled(),
    );
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({
      caseId: "reason",
      decision: original.decision,
      note: original.note,
      correction: original.correction,
      revision: original.revision,
      revisitLater: !flag,
      reviewerKey: "rob-hash",
      presentationSha256: "presentation-sha",
    });
    expectOriginalAnswer(original);
    const checkbox = screen.getByRole("checkbox", { name: "Revisit later" });
    if (!flag) expect(checkbox).toBeChecked();
    else expect(checkbox).not.toBeChecked();
    expect(JSON.stringify(data.feedback)).toBe(before);
  },
);

test.each([false, true])(
  "a first save sends explicit revisitLater=%s without requiring a comment",
  async (flag) => {
    const { saves } = setup();
    const checkbox = await screen.findByRole("checkbox", { name: "Revisit later" });
    if (flag) fireEvent.click(checkbox);
    for (const radio of screen.getAllByRole("radio"))
      expect(radio).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled();
    expect(saves).toHaveLength(0);
    fireEvent.click(screen.getByRole("radio", { name: /^Agree/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled(),
    );
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({
      decision: "agree",
      note: "",
      correction: "",
      revision: 0,
      revisitLater: flag,
    });
  },
);

test("a lost save receipt survives remount and retries the same request and flag", async () => {
  const data = makeSession();
  const original = feedback("reason", false);
  data.feedback.reason = original;
  let committed: FeedbackWithRevisit | undefined;
  let attempt = 0;
  const view = setup((body) => {
    if (++attempt === 1) {
      committed = savedAnswer(body);
      data.feedback.reason = committed;
      throw Error("Save receipt lost.");
    }
    return respond({ answer: committed });
  }, data);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Revisit later" }));
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByRole("button", { name: "Retry save" });
  const first = { ...view.saves[0] };
  expect(first.requestId).toEqual(expect.any(String));
  expect(first).toMatchObject({ revisitLater: true, revision: original.revision });
  view.unmount();
  render(<RelationshipReview />);
  const retry = await screen.findByRole("button", { name: "Retry save" });
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeDisabled();
  expectOriginalAnswer(original);
  expect(view.saves).toHaveLength(1);
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled(),
  );
  expect(view.saves).toHaveLength(2);
  expect(view.saves[1]).toEqual(first);
  expect(view.saves[1].requestId).toBe(first.requestId);
  expect(view.saves[1].revisitLater).toBe(true);
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeEnabled();
});

test("navigation retains each draft's mark, judgment, note and Generalizations", async () => {
  const { saves } = setup();
  const checkbox = await screen.findByRole("checkbox", { name: "Revisit later" });
  fireEvent.click(screen.getByRole("radio", { name: /^Agree/ }));
  fireEvent.change(screen.getByLabelText("Comments or examples (optional)"), {
    target: { value: "Unsaved note.\nSecond line." },
  });
  fireEvent.change(screen.getByLabelText("Suggested generalizations (optional)"), {
    target: { value: "Think; Act" },
  });
  fireEvent.click(checkbox);
  await chooseOption("Activity", "Observe");
  await expectActivity("observe");
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: /^Needs discussion/ }));
  fireEvent.change(screen.getByLabelText("Comments or examples (optional)"), {
    target: { value: "Other draft." },
  });
  await chooseOption("Activity", "Reason");
  await expectActivity("reason");
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeChecked();
  expect(screen.getByRole("radio", { name: /^Agree/ })).toBeChecked();
  expect(screen.getByLabelText("Comments or examples (optional)"))
    .toHaveValue("Unsaved note.\nSecond line.");
  expect(screen.getByLabelText("Suggested generalizations (optional)"))
    .toHaveValue("Think; Act");
  await chooseOption("Activity", "Observe");
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: /^Needs discussion/ })).toBeChecked();
  expect(screen.getByLabelText("Comments or examples (optional)"))
    .toHaveValue("Other draft.");
  expect(saves).toHaveLength(0);
});

test("Tom's overview shows saved flags, while my saved-mark filter excludes drafts and stays stable on save", async () => {
  const data = makeSession();
  data.feedback.reason = feedback("reason", true);
  data.feedback.observe = feedback("observe", false);
  data.feedback.plan = feedback("plan");
  const tomFeedback = {
    observe: feedback("observe", true),
    plan: feedback("plan"),
  };
  const { saves } = setup(undefined, data, tomFeedback);
  await screen.findByRole("checkbox", { name: "Revisit later" });
  fireEvent.click(screen.getByRole("button", { name: "Tom’s saved feedback" }));
  fireEvent.click(await screen.findByRole("button", { name: "Load latest feedback" }));
  const marked = (await screen.findByRole("heading", {
    name: "Observe · disagree",
  })).parentElement!;
  expect(within(marked).getByText("Revisit later: Yes")).toBeInTheDocument();
  expect(within(marked).getByText(/Original note/)).toHaveTextContent("Think; Act");
  expect(within(marked).getByText(/Original note/))
    .toHaveTextContent("Original note. Keep this example.");
  const historical = screen.getByRole("heading", {
    name: "Plan · disagree",
  }).parentElement!;
  expect(within(historical).getByText("Revisit later: No")).toBeInTheDocument();

  await chooseOption("Activity", /^Observe · reviewed$/);
  fireEvent.click(screen.getByRole("checkbox", { name: "Revisit later" }));
  expect(saves).toHaveLength(0);
  await chooseOption("Show", "My saved Revisit later items");
  await expectActivity("reason");
  expect(screen.queryByLabelText("Activity")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Revisit later" }));
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled(),
  );
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({ caseId: "reason", revisitLater: false });
  await expectActivity("reason");
  expect(screen.getByLabelText("Show", { selector: '[role="combobox"]' }))
    .toHaveTextContent("My saved Revisit later items");
  expect(screen.queryByLabelText("Activity")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).not.toBeChecked();
  await chooseOption("Show", "All selected proposals");
  await chooseOption("Show", "My saved Revisit later items");
  await waitFor(() =>
    expect(screen.queryByRole("checkbox", { name: "Revisit later" }))
      .not.toBeInTheDocument(),
  );
  expect(saves).toHaveLength(1);
});

test("revision conflicts retain the draft flag and answer until explicit resubmission", async () => {
  const data = makeSession();
  const original = feedback("reason", true);
  data.feedback.reason = original;
  const latest: FeedbackWithRevisit = {
    ...feedback("reason", true),
    decision: "agree",
    note: "Newer saved note.",
    correction: "Act",
    revision: 3,
  };
  const before = JSON.stringify(latest);
  let attempt = 0;
  const { saves } = setup((body) => {
    if (++attempt === 1) {
      data.feedback.reason = latest;
      return respond({
        error: "A newer response is saved.",
        code: "revision_conflict",
      }, 409);
    }
    return respond({ answer: savedAnswer(body) });
  }, data);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Revisit later" }));
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  const keep = await screen.findByRole("button", {
    name: "Keep my draft and edit the latest answer",
  });
  expect(screen.getByText("Saved Revisit later: Yes")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeDisabled();
  expectOriginalAnswer(original);
  expect(saves).toHaveLength(1);
  fireEvent.click(keep);
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).toBeEnabled();
  expectOriginalAnswer(original);
  expect(saves).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save feedback" })).toBeDisabled(),
  );
  expect(saves).toHaveLength(2);
  expect(saves[1]).toMatchObject({
    revision: latest.revision,
    decision: original.decision,
    note: original.note,
    correction: original.correction,
    revisitLater: false,
  });
  expect(saves[1].requestId).not.toBe(saves[0].requestId);
  expectOriginalAnswer(original);
  expect(screen.getByRole("checkbox", { name: "Revisit later" })).not.toBeChecked();
  expect(JSON.stringify(latest)).toBe(before);
});
