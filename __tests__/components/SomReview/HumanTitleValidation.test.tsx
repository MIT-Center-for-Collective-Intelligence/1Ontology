/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import HumanTitleValidation from "../../../src/components/SomReview/HumanTitleValidation";
import type { TitleValidationSession } from "../../../src/types/ITitleValidation";
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("../../../src/lib/utils/Post", () => ({ Post: jest.fn() }));
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
});
const respond = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
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
test("pausing hides the task content", async () => {
  global.fetch = jest.fn(() => respond(session())) as jest.Mock;
  render(<HumanTitleValidation preview />);
  await screen.findByText("Write Report");
  fireEvent.click(screen.getByRole("button", { name: "Pause review" }));
  expect(
    screen.queryByText("Write annual reports for the committee."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Resume review" }));
  expect(
    screen.getByText("Write annual reports for the committee."),
  ).toBeVisible();
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
test("closing requires an in-page confirmation and cancellation leaves the pilot open", async () => {
  const coordinator = {
    ...session(),
    canManage: true,
    task: undefined,
    phase: "complete",
  };
  const fetch = jest.fn((url: string) =>
    respond(
      url.endsWith("dashboard")
        ? {
            studyId: "study",
            status: "active",
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
  fireEvent.click(await screen.findByRole("button", { name: "Close study" }));
  expect(
    screen.getByRole("dialog", { name: "Close this pilot?" }),
  ).toBeVisible();
  expect(fetch.mock.calls.some(([url]) => url.endsWith("manage"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Keep pilot open" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close study" }));
  fireEvent.click(screen.getByRole("button", { name: "Close pilot" }));
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.endsWith("manage"))).toBe(true),
  );
});
