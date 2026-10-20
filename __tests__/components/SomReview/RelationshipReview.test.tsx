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
import { reconcileSession } from "../../../src/lib/relationshipReview/clientState";
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
    String(url).endsWith("evidence")
      ? respond({
          evidence: {
            caseId: JSON.parse(options.body).caseId,
            datasetVersion: data.dataset.version,
            datasetSha256: data.datasetSha256,
            complete: true,
            limitation: "",
            records: [],
          },
        })
      : String(url).endsWith("session")
        ? respond(data)
        : save(JSON.parse(options.body)),
  );
  return render(<RelationshipReview />);
};
test("atomic proposals clearly retain an earlier review and do not invent an example", async () => {
  const data = curated();
  data.dataset.methodology = "atomic-generalization-pilot-v1";
  data.dataset.cases[1].scope = "atomic-activity-review";
  data.dataset.cases[1].analysis.example = "";
  data.presentation.cards[0].example = "";
  data.availableVersions = [
    { version: "v1", current: true, label: "New atomic proposals" },
    {
      version: "earlier",
      current: false,
      label: "Earlier 16 proposals and saved answers",
    },
  ];
  setup(undefined, data);
  await screen.findByText(/New atomic-activity proposals/);
  expect(
    screen.getByText(/Your answers to the earlier proposals remain saved/),
  ).toBeInTheDocument();
  for (const a of screen.getAllByRole("link", {
    name: "Earlier 16 proposals and saved answers",
  }))
    expect(a).toHaveAttribute("href", "/review/relationships?version=earlier");
  expect(screen.queryByText("Illustrative example:")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Reason’s immediate child"),
  ).not.toBeInTheDocument();
});
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
test("complete O*NET wording is shown separately from illustrative examples and saving remains explicit", async () => {
  (global.fetch as jest.Mock).mockImplementation(async (url, options) => {
    if (String(url).endsWith("session")) return respond(clone());
    if (String(url).endsWith("evidence"))
      return respond({
        evidence: {
          caseId: "reason",
          datasetVersion: "v1",
          datasetSha256: "sha",
          complete: false,
          limitation: "Deeper sources were not exhaustively reviewed.",
          records: [
            {
              id: "onet-id",
              title: "Complete original title including its tools and purpose.",
              description: "",
              descriptionSource: "title",
            },
          ],
        },
      });
    throw Error("No save expected");
  });
  render(<RelationshipReview />);
  await screen.findByText(
    "Complete original title including its tools and purpose.",
  );
  expect(screen.getByText(/Source record: onet-id/)).toBeInTheDocument();
  expect(
    screen.getByText("Deeper sources were not exhaustively reviewed."),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Save feedback shares your answer/),
  ).toBeInTheDocument();
  expect(
    (global.fetch as jest.Mock).mock.calls.some(([url]) =>
      String(url).endsWith("/save"),
    ),
  ).toBe(false);
});
test("versioned links load the matching review and keep history accessible", async () => {
  window.history.replaceState({}, "", "/review/relationships?version=v1");
  const data = curated();
  data.availableVersions = [
    { version: "v1", current: false },
    { version: "v2", current: true },
  ];
  data.dataset.cases[1].scope = "sibling-review";
  setup(undefined, data);
  await screen.findByRole("heading", { name: "Selected activity" });
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      .datasetVersion,
  ).toBe("v1");
  expect(
    screen.getByRole("link", { name: "Return to current review" }),
  ).toHaveAttribute("href", "/review/relationships?version=v2");
  expect(
    screen.getByRole("link", { name: "Open latest proposals" }),
  ).toHaveAttribute("href", "/review/relationships?version=v2");
  expect(
    screen.getByText(/Your answers here remain saved with this version/),
  ).toBeInTheDocument();
  expect(screen.getByText("Sibling comparison")).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get("version")).toBe("v1");
});
test("Tom's feedback links preserve the version of the reviewed evidence", async () => {
  setup(() => respond({ feedback: { reason: answer() } }));
  await screen.findByRole("heading", { name: "Reason" });
  fireEvent.click(screen.getByRole("button", { name: "Tom’s saved feedback" }));
  fireEvent.click(screen.getByRole("button", { name: "Load latest feedback" }));
  expect(
    await screen.findByRole("link", { name: "View activity" }),
  ).toHaveAttribute(
    "href",
    "/review/relationships?view=analysis&activity=reason&version=v1",
  );
});
test("the disclosure shows the exact prompts used for the displayed case", async () => {
  const data = curated();
  data.dataset.prompt = "Shared author fallback";
  data.dataset.challengePrompt = "Shared critic fallback";
  data.dataset.promptByCase = { selected: "Exact selected author prompt" };
  data.dataset.challengePromptByCase = {
    selected: "Exact selected critic prompt",
  };
  setup(undefined, data);
  await screen.findByRole("heading", { name: "Selected activity" });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Agents and prompts used for this proposal",
    }),
  );
  expect(screen.getByText("Exact selected author prompt")).toBeVisible();
  expect(screen.getByText("Exact selected critic prompt")).toBeVisible();
  expect(screen.queryByText("Shared author fallback")).not.toBeInTheDocument();
  expect(screen.queryByText("Shared critic fallback")).not.toBeInTheDocument();
});
test("evidence includes supporting O*NET and ancestor quotes beyond the direct parents", async () => {
  const data = curated();
  data.dataset.candidates.push(
    {
      id: "support",
      title: "(O*Net) 123 - Create invoices for completed work.",
      description: "Create invoices for completed work.",
      oNetTask: true,
    },
    {
      id: "ancestor",
      title: "Create information",
      description: "Generate new information.",
    },
  );
  data.presentation.cards[0].quotes = [
    { nodeId: "support", quote: "Create invoices for completed work." },
    { nodeId: "ancestor", quote: "Generate new information." },
  ];
  setup(undefined, data);
  await screen.findByRole("heading", { name: "Selected activity" });
  expect(
    screen.getByText("O*NET description:", { selector: "strong" }),
  ).toBeVisible();
  expect(
    screen.getByText(/Create invoices for completed work\./),
  ).toBeVisible();
  expect(screen.getByText(/Generate new information\./)).toBeVisible();
});
test("a partial change keeps the other valid generalization and binds new saves to the displayed evidence", async () => {
  window.history.replaceState({}, "", "/review/relationships");
  setup(
    () => respond({ answer: { ...answer(), caseId: "selected" } }),
    curated(),
  );
  await screen.findByRole("heading", { name: "Selected activity" });
  expect(
    screen.getByText(
      /Remove the direct generalization link to Old generalization/,
    ),
  ).toHaveTextContent(
    "Add the direct generalization link to New generalization. Keep Think.",
  );
  expect(screen.getByText("Think (keep this link)")).toBeInTheDocument();
  fireEvent.click(
    screen.getByLabelText("Agree with the proposed generalizations"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  await screen.findByText("Saved to your account.");
  expect(
    JSON.parse(
      (global.fetch as jest.Mock).mock.calls.find(([url]) =>
        String(url).endsWith("/save"),
      )[1].body,
    ).presentationSha256,
  ).toBe("presentation-sha");
});
test("exact prompt requests stay bound to the displayed dataset version", async () => {
  window.history.replaceState({}, "", "/review/relationships?version=v1");
  setup(
    () => respond({ trace: { source: "exact frozen evidence" } }),
    curated(),
  );
  await screen.findByRole("heading", { name: "Selected activity" });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Agents and prompts used for this proposal",
    }),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Show exact requests and outputs",
    }),
  );
  await screen.findByText(/exact frozen evidence/);
  const call = (global.fetch as jest.Mock).mock.calls.find((c) =>
    String(c[0]).endsWith("/trace"),
  );
  expect(JSON.parse(call[1].body)).toEqual({
    caseId: "selected",
    datasetVersion: "v1",
  });
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
  const incoming = clone(),
    saved = clone();
  saved.feedback.reason = answer(1, "Saved while loading");
  const reconciled = reconcileSession(saved, incoming);
  expect(reconciled.feedback.reason).toEqual(saved.feedback.reason);
  const anotherVersion = clone();
  anotherVersion.dataset.version = "v2";
  expect(reconcileSession(saved, anotherVersion).feedback).toEqual({});
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
  const call = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
    String(url).endsWith("/save"),
  );
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
  await screen.findByText(/review service is temporarily unavailable/);
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
    if (String(url).endsWith("evidence"))
      return respond({
        evidence: {
          caseId: "reason",
          datasetVersion: "v1",
          datasetSha256: "sha",
          complete: true,
          records: [],
          limitation: "",
        },
      });
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
