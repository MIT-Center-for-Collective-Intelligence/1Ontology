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
import QuickTitleVerification from "../../../src/components/SomReview/QuickTitleVerification";
import { postQuickReview as Post } from "../../../src/lib/titleValidation/quickRequest";
jest.mock("../../../src/lib/titleValidation/quickRequest", () => ({
  postQuickReview: jest.fn(),
}));
const start = () => ({
  studyId: "quick-test",
  datasetVersion: "quick-v1",
  reviewerKey: "reviewer-test",
  reviewerLabel: "Test reviewer",
  completed: 0,
  total: 25,
  item: {
    id: "case-1",
    currentTitle: "Write Report",
    description: "Write technical reports for clients.",
    modelTitles: ["Write Technical Reports for Clients"],
    modelReason: "Saved model explanation",
    outcome: "Clarify",
    batch: "first25",
    sourceId: "1",
  },
  questions: [
    {
      id: "original",
      label: "Is the original title acceptable?",
      title: "Write Report",
    },
    {
      id: "proposed-0",
      label: "Is the proposed title acceptable?",
      title: "Write Technical Reports for Clients",
    },
  ],
  draft: {
    revision: 0,
    firstPresentedAt: 1000,
    updatedAt: 1000,
    caseId: "case-1",
    reviewerId: "test",
    payload: {
      caseId: "case-1",
      ratings: {
        original: { value: "", explanation: "" },
        "proposed-0": { value: "", explanation: "" },
      },
      correction: "",
      interruption: "",
      activeTimeMs: 7000,
      submissionId: "test-submission-0001",
    },
  },
  flagged: false,
  canManage: false,
  canReviewFlagged: false,
  regularLimit: 25,
  softwareQA: false,
  savedActiveTimeMs: 4000,
  savedElapsedTimeMs: 5000,
  disclosure: {
    prompt: "Exact saved prompt",
    provenance: { model: "gpt-6.1-sol" },
  },
  preview: false,
});
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});
afterEach(() => jest.useRealTimers());
test("displayed proposal information omits model, reasoning, funding, and hashes without changing saved provenance", async () => {
  const v = start();
  const fundingRoute =
    "Native ChatGPT on oneman@mit.edu; user states personally funded allocation. Not ACCESS or MIT-funded inference.";
  Object.assign(v.disclosure.provenance, {
    fundingRoute,
    modelReasoningEffort: "high",
    sourceSha256: "source-hash",
    scientificPromptSha256: "prompt-hash",
    originalSourceSnapshotSha256: "original-source-hash",
    fullProposalCsvSha256: "csv-hash",
    sourceCohortSha256: "cohort-hash",
    sourceSnapshot: "saved-source",
    sourceDetails: { sourceSha256: "nested-hash", label: "Saved evidence" },
  });
  const originalProvenance = JSON.stringify(v.disclosure.provenance);
  jest.mocked(Post).mockResolvedValue(v);
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  fireEvent.click(
    screen.getByText("Agents and prompts used for these proposals"),
  );
  expect(screen.getByText("Exact saved prompt")).toBeVisible();
  expect(screen.getByText("gpt-6.1-sol")).toBeVisible();
  const displayed = screen.getByText(/saved-source/);
  expect(displayed).toBeVisible();
  expect(JSON.parse(displayed.textContent!)).toEqual({
    sourceSnapshot: "saved-source",
    sourceDetails: { label: "Saved evidence" },
  });
  expect(document.body).not.toHaveTextContent(fundingRoute);
  expect(JSON.stringify(v.disclosure.provenance)).toEqual(originalProvenance);
});
test("three plain ratings replace rankings and reason menus; uncertainty opens a required explanation", async () => {
  jest.mocked(Post).mockResolvedValue(start());
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  const group = screen.getByRole("radiogroup", {
    name: "Is the original title acceptable?",
  });
  fireEvent.click(within(group).getByLabelText("I’m not sure"));
  expect(
    screen.getByLabelText("What are you unsure about?", { exact: false }),
  ).toBeRequired();
  expect(screen.getByText(/This activity: 0:07/)).toHaveTextContent(
    "Total review time: 0:11",
  );
  expect(screen.queryByText("Take a break")).not.toBeInTheDocument();
});
test("unfinished answers and time recover from browser draft, and restore matching server revision", async () => {
  const v = start();
  v.draft.payload.activeTimeMs = 19000;
  v.draft.payload.correction = "My unfinished correction";
  localStorage.setItem(
    "quick-title-draft:quick-v1:reviewer-test:case-1",
    JSON.stringify({ revision: 0, payload: v.draft.payload }),
  );
  jest.mocked(Post).mockResolvedValue(start());
  render(<QuickTitleVerification />);
  expect(
    await screen.findByDisplayValue("My unfinished correction"),
  ).toBeInTheDocument();
  expect(screen.getByText(/This activity: 0:19/)).toBeInTheDocument();
});
test("an unanswered question is highlighted before submission and existing choices remain editable", async () => {
  const v = start();
  jest
    .mocked(Post)
    .mockResolvedValueOnce(v)
    .mockResolvedValueOnce({
      ...v,
      item: undefined,
      draft: undefined,
      questions: [],
      completed: 25,
    });
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  const groups = screen.getAllByRole("radiogroup");
  fireEvent.click(within(groups[0]).getByLabelText("Acceptable"));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(
    screen.getByText(/Please complete the highlighted questions/),
  ).toBeVisible();
  expect(
    screen.getByText("Choose one of the three ratings before continuing."),
  ).toBeVisible();
  expect(Post).toHaveBeenCalledTimes(1);
  expect(within(groups[0]).getByLabelText("Acceptable")).toBeChecked();
  expect(within(groups[1]).getByLabelText("Acceptable")).toBeEnabled();
  fireEvent.click(within(groups[1]).getByLabelText("Acceptable"));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText(/You have finished the 25 activities/);
  expect(Post).toHaveBeenCalledTimes(2);
});
test("a definite server rejection leaves all choices editable for a corrected save", async () => {
  const v = start();
  jest
    .mocked(Post)
    .mockResolvedValueOnce(v)
    .mockRejectedValueOnce(
      Object.assign(new Error("Please correct this answer."), { status: 400 }),
    )
    .mockResolvedValueOnce({
      ...v,
      item: undefined,
      draft: undefined,
      questions: [],
      completed: 25,
    });
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  for (const group of screen.getAllByRole("radiogroup"))
    fireEvent.click(within(group).getByLabelText("Acceptable"));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText("Please correct this answer.");
  for (const group of screen.getAllByRole("radiogroup"))
    expect(within(group).getByLabelText("Acceptable")).toBeEnabled();
  expect(
    localStorage.getItem("quick-title-pending:reviewer-test:regular"),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText(/Suggested correction/), {
    target: { value: "My correction after the rejection" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText(/You have finished the 25 activities/);
  expect((jest.mocked(Post).mock.calls[2][1] as any).payload.correction).toBe(
    "My correction after the rejection",
  );
});
test("a rejected submission from an older browser recovers on reload without losing choices or time", async () => {
  const v = start();
  const payload = JSON.parse(JSON.stringify(v.draft.payload));
  payload.ratings.original = {
    value: "unsure",
    explanation: "My saved uncertainty",
  };
  payload.activeTimeMs = 19000;
  localStorage.setItem(
    "quick-title-pending:reviewer-test:regular",
    JSON.stringify({ payload, revision: 0 }),
  );
  jest
    .mocked(Post)
    .mockResolvedValueOnce(v)
    .mockRejectedValueOnce(
      Object.assign(new Error("Choose a rating for every question."), {
        status: 400,
      }),
    )
    .mockResolvedValueOnce({
      ...v,
      item: undefined,
      draft: undefined,
      questions: [],
      completed: 25,
    });
  render(<QuickTitleVerification />);
  expect(await screen.findByDisplayValue("My saved uncertainty")).toBeEnabled();
  expect(screen.getByText(/This activity: 0:19/)).toBeVisible();
  expect(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText("I’m not sure"),
  ).toBeChecked();
  expect(
    localStorage.getItem("quick-title-pending:reviewer-test:regular"),
  ).toBeNull();
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[1]).getByLabelText("Acceptable"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText(/You have finished the 25 activities/);
  const sent = (jest.mocked(Post).mock.calls[2][1] as any).payload;
  expect(sent.ratings.original).toEqual(payload.ratings.original);
  expect(sent.activeTimeMs).toBeGreaterThanOrEqual(19000);
});
test("an uncertain network delivery retries the same frozen answer and advances only after confirmation", async () => {
  const v = start();
  jest
    .mocked(Post)
    .mockResolvedValueOnce(v)
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({
      ...v,
      item: undefined,
      draft: undefined,
      questions: [],
      completed: 25,
      savedActiveTimeMs: 11000,
    });
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  for (const group of screen.getAllByRole("radiogroup"))
    fireEvent.click(within(group).getByLabelText("Acceptable"));
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText("I’m not sure"),
  );
  fireEvent.change(
    screen.getByLabelText("What are you unsure about?", { exact: false }),
    { target: { value: "Keep this explanation in the submitted answer." } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText("Connection interrupted");
  expect(
    screen.getByLabelText("What are you unsure about?", { exact: false }),
  ).toBeDisabled();
  const sent = jest.mocked(Post).mock.calls[1][1];
  fireEvent.click(
    screen.getByRole("button", { name: "Retry saving this answer" }),
  );
  await screen.findByText(/You have finished the 25 activities/);
  expect(jest.mocked(Post).mock.calls[2][1]).toEqual(sent);
  expect(
    localStorage.getItem("quick-title-pending:reviewer-test:regular"),
  ).toBeNull();
});
test("automatic checkpoint includes elapsed active-page time and open text", async () => {
  jest.useFakeTimers();
  let v = start();
  jest.mocked(Post).mockImplementation(async (path, body: any) => {
    if (String(path).endsWith("checkpoint")) {
      v = {
        ...v,
        draft: {
          ...v.draft,
          revision: v.draft.revision + 1,
          payload: body.payload,
        },
      };
    }
    return v as any;
  });
  render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.change(screen.getByLabelText(/Interruptions or other comments/), {
    target: { value: "Brief interruption noted." },
  });
  await act(async () => {
    jest.advanceTimersByTime(10000);
    await Promise.resolve();
  });
  const checkpoint = jest
    .mocked(Post)
    .mock.calls.find((c) => String(c[0]).endsWith("checkpoint"))!;
  expect((checkpoint[1] as any).payload.interruption).toBe(
    "Brief interruption noted.",
  );
  expect((checkpoint[1] as any).payload.activeTimeMs).toBeGreaterThanOrEqual(
    15000,
  );
});
test("background checkpoints leave fields editable and do not replace text typed while saving", async () => {
  jest.useFakeTimers();
  const v = start();
  let finishCheckpoint: ((value: unknown) => void) | undefined;
  let checkpointBody: any;
  jest.mocked(Post).mockImplementation(async (path, body: any) => {
    if (String(path).endsWith("checkpoint")) {
      checkpointBody = body;
      return new Promise((resolve) => {
        finishCheckpoint = resolve;
      }) as any;
    }
    return v as any;
  });
  render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText("I’m not sure"),
  );
  const field = screen.getByLabelText("What are you unsure about?", {
    exact: false,
  });
  fireEvent.change(field, { target: { value: "Initial note" } });
  await act(async () => {
    jest.advanceTimersByTime(10000);
    await Promise.resolve();
  });
  expect(finishCheckpoint).toBeDefined();
  expect(field).not.toBeDisabled();
  fireEvent.change(field, {
    target: { value: "More text written during autosave" },
  });
  await act(async () => {
    finishCheckpoint!({
      ...v,
      draft: { ...v.draft, revision: 1, payload: checkpointBody.payload },
    });
    await Promise.resolve();
  });
  expect(field).toHaveValue("More text written during autosave");
  expect(
    JSON.parse(
      localStorage.getItem("quick-title-draft:quick-v1:reviewer-test:case-1")!,
    ).payload.ratings.original.explanation,
  ).toBe("More text written during autosave");
});
