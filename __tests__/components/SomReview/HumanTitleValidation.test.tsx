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
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => (
  <button>Use dark mode</button>
));
import HumanTitleValidation from "../../../src/components/SomReview/HumanTitleValidation";
import TitleValidationPage, {
  getServerSideProps,
} from "../../../src/pages/review/title-validation";
import { Post } from "../../../src/lib/utils/Post";
import { useAuth } from "../../../src/components/context/AuthContext";
import type { TitleValidationSession } from "../../../src/types/ITitleValidation";
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("../../../src/lib/utils/Post", () => ({ Post: jest.fn() }));
jest.mock("../../../src/components/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("../../../src/components/hoc/withAuthUser", () => ({
  __esModule: true,
  default: () => (Component: React.ComponentType) => Component,
}));
jest.mock("../../../src/lib/titleValidation/repository", () => ({
  localPreviewEnabled: jest.fn(() => false),
}));
const session = (caseId = "c1"): TitleValidationSession => ({
  studyId: "study",
  datasetVersion: "v1",
  studyStatus: "active",
  reviewerLabel: "Same display name",
  reviewerKey: "unique-reviewer-a",
  phase: "create",
  progress: {
    creationDone: 0,
    creationTotal: 2,
    evaluationDone: 0,
    evaluationTotal: 3,
  },
  task: {
    caseId,
    currentTitle: "Write Report",
    description: "Write annual reports for the committee.",
    stage: "create",
  },
  canManage: false,
  preview: true,
});
beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
  jest.mocked(Post).mockReset();
  jest.mocked(useAuth).mockReset();
});
const respond = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
test("the old practice bookmark redirects to the team flow without carrying old answers", async () => {
  expect(
    await getServerSideProps({ query: { workspace: "practice" } } as never),
  ).toEqual({
    redirect: { destination: "/review/title-validation", permanent: false },
  });
  expect(
    await getServerSideProps({
      query: {},
      req: {
        headers: { host: "ontology.mit.edu" },
        socket: { remoteAddress: "127.0.0.1" },
      },
    } as never),
  ).toEqual({
    props: {
      preview: false,
      practice: false,
      earlier: false,
      flagged: false,
      qa: false,
    },
  });
});
test("the signed-in page waits for restored authentication before requesting a session", async () => {
  jest
    .mocked(useAuth)
    .mockReturnValue([
      { isAuthInitialized: false, isAuthenticated: false },
    ] as never);
  jest.mocked(Post).mockResolvedValue({ ...session(), preview: false });
  const view = render(<TitleValidationPage preview={false} earlier />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your account");
  expect(Post).not.toHaveBeenCalled();
  jest
    .mocked(useAuth)
    .mockReturnValue([
      { isAuthInitialized: true, isAuthenticated: false },
    ] as never);
  view.rerender(<TitleValidationPage preview={false} earlier />);
  expect(Post).not.toHaveBeenCalled();
  jest
    .mocked(useAuth)
    .mockReturnValue([
      { isAuthInitialized: true, isAuthenticated: true },
    ] as never);
  view.rerender(<TitleValidationPage preview={false} earlier />);
  await screen.findByText("Write Report");
  expect(Post).toHaveBeenCalledTimes(1);
});
test("a failed production session shows the server message and can recover without reloading", async () => {
  jest
    .mocked(Post)
    .mockRejectedValueOnce("Sign in again to continue.")
    .mockResolvedValueOnce({ ...session(), preview: false });
  render(<HumanTitleValidation preview={false} />);
  await screen.findByText("Sign in again to continue.");
  fireEvent.click(screen.getByRole("button", { name: "Try loading again" }));
  await screen.findByText("Write Report");
  expect(
    screen.queryByText("Sign in again to continue."),
  ).not.toBeInTheDocument();
  expect(Post).toHaveBeenCalledTimes(2);
});
test("the owner's copy is one five-activity flow with no role selection and isolated drafts", async () => {
  jest.mocked(Post).mockResolvedValue({
    ...session(),
    studyId: "human-title-practice-own",
    reviewerLabel: "Your review",
    preview: false,
    practice: true,
    progress: {
      creationDone: 0,
      creationTotal: 5,
      evaluationDone: 0,
      evaluationTotal: 5,
    },
  });
  const view = render(<HumanTitleValidation preview={false} practice />);
  await screen.findByText("Write Report");
  expect(screen.getByText("Earlier review copy")).toBeVisible();
  expect(
    screen.queryByText(/not included in the team/),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByText(/Titles 0\/5/)).toBeVisible();
  expect(screen.getByText(/Comparisons 0\/5/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Coordinator overview" }),
  ).not.toBeInTheDocument();
  expect(Post).toHaveBeenCalledWith(
    "/som-review/title-validation/session",
    { workspace: "practice" },
    false,
  );
  fireEvent.click(screen.getByLabelText("Use one clearer title"));
  fireEvent.change(screen.getByLabelText("Your title"), {
    target: { value: "My saved draft" },
  });
  view.unmount();
  render(<HumanTitleValidation preview={false} practice />);
  await screen.findByDisplayValue("My saved draft");
});
test("own-copy submissions advance automatically and uncertain-delivery retries retain the exact payload", async () => {
  jest
    .mocked(Post)
    .mockResolvedValueOnce({ ...session(), preview: false, practice: true })
    .mockRejectedValueOnce(Error("Network lost"))
    .mockResolvedValueOnce({
      ...session("c2"),
      preview: false,
      practice: true,
    });
  render(<HumanTitleValidation preview={false} practice />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Keep it"));
  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByRole("button", { name: "Retry the same answer" });
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry the same answer" }),
  );
  await waitFor(() => expect(Post).toHaveBeenCalledTimes(3));
  expect(jest.mocked(Post).mock.calls[1][1]).toEqual(
    expect.objectContaining({
      workspace: "practice",
    }),
  );
  expect(jest.mocked(Post).mock.calls[1][1]).toEqual(
    jest.mocked(Post).mock.calls[2][1],
  );
  await screen.findByText("Write Report");
  expect(screen.getByLabelText("Keep it")).not.toBeChecked();
});
test("the coordinator joins the team under their own account using the normal reviewer flow", async () => {
  jest
    .mocked(Post)
    .mockResolvedValueOnce({
      ...session(),
      studyId: "team-study",
      phase: "unassigned",
      task: undefined,
      canManage: true,
      preview: false,
    })
    .mockResolvedValueOnce({ joined: true })
    .mockResolvedValueOnce({
      ...session(),
      preview: false,
      canManage: true,
      progress: {
        creationDone: 0,
        creationTotal: 2,
        evaluationDone: 0,
        evaluationTotal: 3,
      },
    });
  render(<HumanTitleValidation preview={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Join as reviewer" }),
  );
  await screen.findByText("Write Report");
  expect(Post).toHaveBeenCalledWith(
    "/som-review/title-validation/manage",
    {
      studyId: "team-study",
      operation: "join",
    },
    false,
  );
  expect(screen.getByText(/Titles 0\/2/)).toBeVisible();
  expect(screen.getByText(/Comparisons 0\/3/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Join as reviewer" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/not included in the team/),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Practice role")).not.toBeInTheDocument();
});

test.each([false, true])(
  "the simplified copy recovers a prior comparison draft (pending=%s) without exposing roles",
  async (pending) => {
    const options = [{ id: "option-a", titles: ["Write Annual Reports"] }];
    const submission = {
      kind: "evaluate",
      caseId: "c1",
      ratings: [{ optionId: "option-a", adequacy: "adequate", rank: 1 }],
      cannotRank: false,
      confidence: 4,
      notes: "My earlier comparison",
      activeTimeMs: 20000,
      submissionId: "retained-submission",
    };
    const oldKey =
      "human-title-validation/human-title-practice-own/earlier-key/evaluate/c1";
    const saved = JSON.stringify({
      key: oldKey,
      decision: "",
      titles: [""],
      ratings: { "option-a": { adequacy: "adequate", rank: 1 } },
      cannotRank: false,
      confidence: 4,
      notes: "My earlier comparison",
      activeTimeMs: 20000,
      paused: true,
      ...(pending ? { pendingSubmission: submission } : {}),
    });
    localStorage.setItem(oldKey, saved);
    const currentKey =
      "human-title-validation/human-title-practice-own/current-key/evaluate/c1";
    localStorage.setItem(
      currentKey,
      JSON.stringify({
        key: currentKey,
        decision: "",
        confidence: null,
        notes: "",
        ratings: {},
      }),
    );
    jest.mocked(Post).mockResolvedValue({
      ...session(),
      studyId: "human-title-practice-own",
      reviewerKey: "current-key",
      draftReviewerKeys: ["current-key", "earlier-key"],
      preview: false,
      practice: true,
      phase: "evaluate",
      progress: {
        creationDone: 5,
        creationTotal: 5,
        evaluationDone: 0,
        evaluationTotal: 5,
      },
      task: { ...session().task!, stage: "evaluate", options },
    });
    render(<HumanTitleValidation preview={false} practice />);
    await screen.findByDisplayValue("My earlier comparison");
    expect(screen.getByText("2. Compare alternatives")).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: /role|reviewer/i }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(oldKey)).toBe(saved);
    if (pending) {
      fireEvent.click(
        screen.getByRole("button", { name: "Retry the same answer" }),
      );
      await waitFor(() => expect(Post).toHaveBeenCalledTimes(2));
      expect(jest.mocked(Post).mock.calls[1][1]).toEqual(
        expect.objectContaining({ workspace: "practice", submission }),
      );
    }
  },
);
test("first screen has no preselected decision or confidence, and no model answer", async () => {
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  expect(
    screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked),
  ).toBe(true);
  expect(screen.queryByText("Alternative A")).not.toBeInTheDocument();
  expect(
    screen.getByText("Write annual reports for the committee."),
  ).toBeVisible();
});
test("known validation errors leave the draft editable", async () => {
  global.fetch = jest
    .fn()
    .mockImplementationOnce(() => respond(session()))
    .mockImplementationOnce(() =>
      respond({ error: "Please correct your answer" }, 400),
    );
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Use one clearer title"));
  fireEvent.change(screen.getByLabelText("Your title"), {
    target: { value: "Write Annual Reports" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "4" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText("Please correct your answer");
  expect(screen.getByLabelText("Your title")).toBeEnabled();
});
test("a network failure retries exactly the same payload", async () => {
  const fetch = jest
    .fn()
    .mockImplementationOnce(() => respond(session()))
    .mockRejectedValueOnce(Error("Network lost"))
    .mockImplementationOnce(() =>
      respond({
        ...session("c2"),
        progress: { ...session().progress, creationDone: 1 },
      }),
    );
  global.fetch = fetch;
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Keep it"));
  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByRole("button", { name: "Retry the same answer" });
  fireEvent.click(
    screen.getByRole("button", { name: "Retry the same answer" }),
  );
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  expect(fetch.mock.calls[1][1].body).toEqual(fetch.mock.calls[2][1].body);
});
test("moving to another task does not copy the previous answer into its draft", async () => {
  const store = jest.spyOn(Storage.prototype, "setItem");
  global.fetch = jest
    .fn()
    .mockImplementationOnce(() => respond(session()))
    .mockImplementationOnce(() =>
      respond({
        ...session("c2"),
        progress: { ...session().progress, creationDone: 1 },
      }),
    );
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Use one clearer title"));
  fireEvent.change(screen.getByLabelText("Your title"), {
    target: { value: "Old draft must not leak" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "2" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Your title")).not.toBeInTheDocument(),
  );
  const nextKey = "human-title-validation/study/unique-reviewer-a/create/c2";
  // The old form disappears before the next draft's storage effect commits.
  // Wait for that effect, then verify both the retained draft and every write.
  await waitFor(() => {
    const next = localStorage.getItem(nextKey);
    expect(next).not.toBeNull();
    expect(JSON.parse(next!)).toEqual(
      expect.objectContaining({
        decision: "",
        titles: [""],
        confidence: null,
        notes: "",
      }),
    );
  });
  expect(
    store.mock.calls
      .filter(([key]) => key === nextKey)
      .every(([, value]) => !value.includes("Old draft must not leak")),
  ).toBe(true);
});
test("a legacy paused draft reopens with its answers intact and no pause controls", async () => {
  const key = "human-title-validation/study/unique-reviewer-a/create/c1";
  localStorage.setItem(
    key,
    JSON.stringify({
      key,
      paused: true,
      decision: "clarify",
      titles: ["Write Annual Report"],
      confidence: 3,
      notes: "Working note",
      activeTimeMs: 12300,
    }),
  );
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  const view = render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  expect(screen.getByLabelText("Your title")).toHaveValue(
    "Write Annual Report",
  );
  expect(screen.getByRole("radio", { name: "3" })).toBeChecked();
  expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue(
    "Working note",
  );
  expect(JSON.parse(localStorage.getItem(key)!).activeTimeMs).toBe(12300);
  expect(JSON.parse(localStorage.getItem(key)!)).not.toHaveProperty("paused");
  view.unmount();
  render(<HumanTitleValidation preview />);
  await screen.findByDisplayValue("Write Annual Report");
  for (const name of [
    "Pause review",
    "Resume review",
    "Take a break",
    "Continue reviewing",
  ])
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  expect(
    jest
      .mocked(global.fetch)
      .mock.calls.some(([url]) => String(url).endsWith("manage")),
  ).toBe(false);
  expect(
    screen.getByText("Write annual reports for the committee."),
  ).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Comments" })).toHaveValue(
    "Working note",
  );
});
test("the review timer automatically stops while the page is hidden or unfocused", async () => {
  jest.useFakeTimers();
  const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(false);
  const focused = jest.spyOn(document, "hasFocus").mockReturnValue(true);
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  const view = render(<HumanTitleValidation preview />);
  try {
    await screen.findByText("Write Report");
    const key = "human-title-validation/study/unique-reviewer-a/create/c1";
    const time = () => JSON.parse(localStorage.getItem(key)!).activeTimeMs;
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const active = time();
    expect(active).toBeGreaterThan(0);
    hidden.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(3000);
    });
    expect(time()).toBe(active);
    hidden.mockReturnValue(false);
    focused.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("blur"));
      jest.advanceTimersByTime(3000);
    });
    expect(time()).toBe(active);
    focused.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      jest.advanceTimersByTime(1000);
    });
    expect(time()).toBeGreaterThan(active);
    expect(
      jest
        .mocked(global.fetch)
        .mock.calls.every(([url]) => String(url).endsWith("session")),
    ).toBe(true);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});
test("an unavailable draft store is visible without blocking review", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Storage blocked");
  });
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  render(<HumanTitleValidation preview />);
  expect(
    await screen.findByText(/This browser could not save your draft/),
  ).toBeVisible();
  fireEvent.click(screen.getByLabelText("Keep it"));
  expect(screen.getByLabelText("Keep it")).toBeChecked();
});
test("a recovered draft is identified and preserved", async () => {
  localStorage.setItem(
    "human-title-validation/study/unique-reviewer-a/create/c1",
    JSON.stringify({
      decision: "clarify",
      titles: ["Write Annual Reports"],
      confidence: 3,
      notes: "Retained draft",
    }),
  );
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  render(<HumanTitleValidation preview />);
  expect(await screen.findByText(/Your draft was restored/)).toBeVisible();
  expect(screen.getByLabelText("Your title")).toHaveValue(
    "Write Annual Reports",
  );
  expect(screen.getByLabelText("Comments")).toHaveValue("Retained draft");
});
test("missing confidence moves keyboard focus to its first choice", async () => {
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Keep it"));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(
    await screen.findByText("Choose your confidence from 1 to 5."),
  ).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("radio", { name: "1" })).toHaveFocus(),
  );
});
test("a missing rank focuses the visible combobox rather than its hidden input", async () => {
  const next: TitleValidationSession = {
    ...session(),
    phase: "evaluate",
    task: {
      ...session().task!,
      stage: "evaluate",
      options: [
        { id: "option-a", titles: ["First alternative"] },
        { id: "option-b", titles: ["Second alternative"] },
      ],
    },
  };
  global.fetch = jest.fn(() => respond(next)) as jest.Mock;
  render(<HumanTitleValidation preview />);
  await screen.findByText("First alternative");
  screen
    .getAllByLabelText("Adequate")
    .forEach((radio) => fireEvent.click(radio));
  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText(
    "Rank every alternative, or choose “I cannot rank these.”",
  );
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", {
        name: "Preference rank for alternative A",
      }),
    ).toHaveFocus(),
  );
});
test("a successful save announces the result and focuses the next task", async () => {
  const next = {
    ...session("c2"),
    task: { ...session("c2").task!, currentTitle: "Write Memo" },
  };
  global.fetch = jest
    .fn()
    .mockImplementationOnce(() => respond(session()))
    .mockImplementationOnce(() => respond(next));
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Keep it"));
  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(await screen.findByText("Your answer was saved.")).toBeVisible();
  await screen.findByText("Write Memo");
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Write your title" }),
    ).toHaveFocus(),
  );
});
test("removing a split row preserves neighboring titles and keyboard focus", async () => {
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByLabelText("Use several titles"));
  fireEvent.click(screen.getByRole("button", { name: "Add another title" }));
  ["First title", "Second title", "Third title"].forEach((value, i) =>
    fireEvent.change(screen.getByLabelText(`Title ${i + 1}`), {
      target: { value },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove title 2" }));
  expect(screen.getByLabelText("Title 1")).toHaveValue("First title");
  expect(screen.getByLabelText("Title 2")).toHaveValue("Third title");
  await waitFor(() => expect(screen.getByLabelText("Title 2")).toHaveFocus());
});
test.each(["draft", "active", "paused", "closed"] as const)(
  "the coordinator overview omits study pause and close controls (status=%s)",
  async (status) => {
    const coordinator = {
      ...session(),
      canManage: true,
      task: undefined,
      phase: "complete",
      studyStatus: status,
    };
    const fetch = jest.fn((url: string) =>
      respond(
        url.endsWith("dashboard")
          ? {
              studyId: "study",
              status,
              caseCount: 5,
              reviewerCount: 3,
              completedCreations: 5,
              completedEvaluations: 10,
              expectedEvaluations: 10,
              byReviewer: [],
              byOutcome: [],
              comparisons: [],
              notes: [],
              activityDetails: [],
              medianCreationActiveSeconds: null,
              medianEvaluationActiveSeconds: null,
              disagreementCases: 0,
              caution: "Software test",
            }
          : coordinator,
      ),
    );
    global.fetch = fetch as jest.Mock;
    render(<HumanTitleValidation preview />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Coordinator overview" }),
    );
    await screen.findByRole("button", { name: "Refresh overview" });
    for (const name of [
      "Pause study",
      "Resume study",
      "Close study",
      "Close pilot",
    ])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => url.endsWith("manage"))).toBe(
      false,
    );
  },
);
