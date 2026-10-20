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
import { createTheme, ThemeProvider } from "@mui/material/styles";
import QuickTitleVerification from "../../../src/components/SomReview/QuickTitleVerification";
import { postQuickReview as Post } from "../../../src/lib/titleValidation/quickRequest";
jest.mock("../../../src/lib/titleValidation/quickRequest", () => ({
  postQuickReview: jest.fn(),
}));
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => (
  <button>Use dark mode</button>
));
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
    activities: [
      {
        id: "case-1",
        currentTitle: "Write Report",
        proposals: [
          {
            id: "proposed-0",
            title: "Write Technical Reports for Clients",
            reason: "Adds the audience",
            groupNumber: 1,
          },
        ],
        modelReason: "Saved explanation",
        flagged: false,
        evidenceDescriptionNumber: 1,
        supportingDescriptionCount: 1,
      },
      {
        id: "case-2",
        currentTitle: "Send Report",
        proposals: [
          {
            id: "related-0",
            title: "Send Reports to Clients",
            reason: "Names the recipient",
            groupNumber: 1,
          },
        ],
        modelReason: "Saved explanation",
        flagged: false,
        evidenceDescriptionNumber: 1,
        supportingDescriptionCount: 1,
      },
    ],
  },
  questions: [
    {
      id: "related-0",
      label: "Is the proposed title acceptable?",
      title: "Send Reports to Clients",
      originalTitle: "Send Report",
      reason: "Names the recipient",
    },
    {
      id: "proposed-0",
      label: "Is the proposed title acceptable?",
      title: "Write Technical Reports for Clients",
      originalTitle: "Write Report",
      reason: "Adds the audience",
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
        "related-0": { value: "", explanation: "" },
        "proposed-0": { value: "", explanation: "" },
      },
      correction: "",
      interruption: "",
      activeTimeMs: 7000,
      submissionId: "test-submission-0001",
    },
    legacyReferences: [],
  },
  flagged: false,
  canManage: false,
  canReviewFlagged: false,
  canUseReviewLinks: false,
  exports: { ownSubmitted: 1, teamAllowed: false, regularRemaining: 25 },
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
  jest.mocked(Post).mockReset();
  localStorage.clear();
});
afterEach(() => jest.useRealTimers());
test("local preview uses one stable identity without showing test-account names or switches", async () => {
  jest
    .mocked(Post)
    .mockResolvedValue({ ...start(), reviewerLabel: "preview-a" });
  render(<QuickTitleVerification preview />);
  await screen.findByText(/Local preview · 0 of 25/);
  expect(document.body).not.toHaveTextContent(/preview-[abc]/);
  expect(Post).toHaveBeenCalledWith(
    expect.stringContaining("session"),
    expect.objectContaining({ previewReviewer: "preview-a" }),
    true,
  );
});
test("a break stops hidden timing, survives reload, and resumes without counting the break", async () => {
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
    if (String(path).endsWith("respond"))
      return {
        ...v,
        item: undefined,
        draft: undefined,
        questions: [],
        completed: 25,
      } as any;
    return v as any;
  });
  const first = render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  for (const group of screen.getAllByRole("radiogroup"))
    fireEvent.click(within(group).getByLabelText("Acceptable"));
  await act(async () => {
    jest.advanceTimersByTime(2500);
  });
  fireEvent.click(screen.getByRole("button", { name: "Pause review" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(v.draft.payload.activeTimeMs).toBe(9500);
  expect(screen.getByText("Paused", { exact: true })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeDisabled();
  for (const group of screen.getAllByRole("radiogroup"))
    expect(within(group).getByLabelText("Acceptable")).toBeChecked();
  await act(async () => {
    jest.advanceTimersByTime(300000);
  });
  expect(v.draft.payload.activeTimeMs).toBe(9500);
  first.unmount();
  render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText("Paused", { exact: true })).toBeVisible();
  await act(async () => {
    jest.advanceTimersByTime(20000);
  });
  expect(v.draft.payload.activeTimeMs).toBe(9500);
  fireEvent.click(screen.getByRole("button", { name: "Resume review" }));
  expect(screen.getByText("Reviewing", { exact: true })).toBeVisible();
  for (const group of screen.getAllByRole("radiogroup"))
    expect(within(group).getByLabelText("Acceptable")).toBeEnabled();
  await act(async () => {
    jest.advanceTimersByTime(3500);
  });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await act(async () => {
    await Promise.resolve();
  });
  const sent = jest
    .mocked(Post)
    .mock.calls.find((c) => String(c[0]).endsWith("respond"))![1] as any;
  expect(sent.payload.activeTimeMs).toBe(13000);
  expect(
    Object.values(sent.payload.ratings).every(
      (r: any) => r.value === "acceptable",
    ),
  ).toBe(true);
  expect(
    localStorage.getItem("source-title-paused:quick-v1:reviewer-test:case-1"),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Pause review|Resume review/ }),
  ).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(
    /00:|9500|13000|Total review time:/,
  );
});
test("pausing during an in-flight checkpoint keeps the review paused after that save finishes", async () => {
  jest.useFakeTimers();
  const v = start();
  let finish: ((value: unknown) => void) | undefined, body: any;
  jest.mocked(Post).mockImplementation(async (path, request: any) => {
    if (String(path).endsWith("checkpoint")) {
      body = request;
      return new Promise((resolve) => {
        finish = resolve;
      }) as any;
    }
    return v as any;
  });
  render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Pause review" }));
  await act(async () => {
    jest.advanceTimersByTime(60000);
    finish!({
      ...v,
      draft: { ...v.draft, revision: 1, payload: body.payload },
    });
    await Promise.resolve();
  });
  expect(screen.getByText("Paused", { exact: true })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeDisabled();
  const local = JSON.parse(
    localStorage.getItem("source-title-draft:quick-v1:reviewer-test:case-1")!,
  );
  expect(local.payload.activeTimeMs).toBe(37000);
  expect(local.revision).toBe(1);
});
test("the disclosure retains the exact prompt and model without displaying raw saved provenance or changing it", async () => {
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
  expect(
    screen.queryByText(/Saved proposal information/),
  ).not.toBeInTheDocument();
  for (const technical of [
    "saved-source",
    "Saved evidence",
    "source-hash",
    "prompt-hash",
  ])
    expect(document.body).not.toHaveTextContent(technical);
  expect(
    screen.getByText(
      /The software requires a rating for each displayed question/,
    ),
  ).toBeVisible();
  expect(document.body).not.toHaveTextContent(fundingRoute);
  expect(JSON.stringify(v.disclosure.provenance)).toEqual(originalProvenance);
});
test("three plain ratings replace rankings and reason menus; uncertainty opens a required explanation", async () => {
  jest.mocked(Post).mockResolvedValue(start());
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Is the original title acceptable?"),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("radiogroup", {
      name: "Is the proposed title acceptable?",
    }),
  ).toHaveLength(2);
  const group = screen.getAllByRole("radiogroup")[0];
  fireEvent.click(within(group).getByLabelText("I’m not sure"));
  expect(
    screen.getByLabelText("What are you unsure about?", { exact: false }),
  ).toBeRequired();
  expect(
    screen.queryByText(/This activity:|Total review time:/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Take a break")).not.toBeInTheDocument();
});
test("unfinished answers and time recover from browser draft, and restore matching server revision", async () => {
  const v = start();
  v.draft.payload.activeTimeMs = 19000;
  v.draft.payload.correction = "My unfinished correction";
  v.draft.payload.ratings["related-0"] = {
    value: "not_acceptable",
    explanation: "My saved explanation",
  };
  localStorage.setItem(
    "source-title-draft:quick-v1:reviewer-test:case-1",
    JSON.stringify({ revision: 0, payload: v.draft.payload }),
  );
  jest.mocked(Post).mockResolvedValue(start());
  render(<QuickTitleVerification />);
  expect(
    await screen.findByDisplayValue("My unfinished correction"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/This activity:|Total review time:/),
  ).not.toBeInTheDocument();
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
  await screen.findByText(/You have finished the 25 O\*NET descriptions/);
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
    localStorage.getItem("source-title-pending:quick-v1:reviewer-test:regular"),
  ).toBeNull();
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText(
      "Not acceptable",
    ),
  );
  fireEvent.change(
    screen.getByLabelText("Why is it not acceptable?", { exact: false }),
    { target: { value: "My explanation after rejection" } },
  );
  fireEvent.change(screen.getByLabelText(/Suggested correction/), {
    target: { value: "My correction after the rejection" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText(/You have finished the 25 O\*NET descriptions/);
  expect((jest.mocked(Post).mock.calls[2][1] as any).payload.correction).toBe(
    "My correction after the rejection",
  );
});
test("a rejected submission from an older browser recovers on reload without losing choices or time", async () => {
  const v = start();
  const payload = JSON.parse(JSON.stringify(v.draft.payload));
  payload.ratings["related-0"] = {
    value: "unsure",
    explanation: "My saved uncertainty",
  };
  payload.activeTimeMs = 19000;
  localStorage.setItem(
    "source-title-pending:quick-v1:reviewer-test:regular",
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
  expect(
    screen.queryByText(/This activity:|Total review time:/),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText("I’m not sure"),
  ).toBeChecked();
  expect(
    localStorage.getItem("source-title-pending:quick-v1:reviewer-test:regular"),
  ).toBeNull();
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[1]).getByLabelText("Acceptable"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText(/You have finished the 25 O\*NET descriptions/);
  const sent = (jest.mocked(Post).mock.calls[2][1] as any).payload;
  expect(sent.ratings["related-0"]).toEqual(payload.ratings["related-0"]);
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
  await screen.findByText(/You have finished the 25 O\*NET descriptions/);
  expect(jest.mocked(Post).mock.calls[2][1]).toEqual(sent);
  expect(
    localStorage.getItem("source-title-pending:quick-v1:reviewer-test:regular"),
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
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText(
      "Not acceptable",
    ),
  );
  fireEvent.change(screen.getByLabelText(/Interruptions or other comments/), {
    target: { value: "Brief interruption noted." },
  });
  await act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });
  await act(async () => {
    jest.advanceTimersByTime(28000);
    await Promise.resolve();
  });
  const checkpoint = jest
    .mocked(Post)
    .mock.calls.filter((c) => String(c[0]).endsWith("checkpoint"))
    .slice(-1)[0];
  expect((checkpoint[1] as any).payload.interruption).toBe(
    "Brief interruption noted.",
  );
  expect((checkpoint[1] as any).payload.activeTimeMs).toBeGreaterThanOrEqual(
    15000,
  );
  expect(
    screen.queryByText(/This activity:|Total review time:/),
  ).not.toBeInTheDocument();
});
test("optional comments appear only for Not acceptable and retain draft text when hidden", async () => {
  jest.mocked(Post).mockResolvedValue(start());
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  expect(
    screen.queryByLabelText(/Suggested correction/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText(/Interruptions or other comments/),
  ).not.toBeInTheDocument();
  const group = screen.getAllByRole("radiogroup")[0];
  fireEvent.click(within(group).getByLabelText("Not acceptable"));
  fireEvent.change(screen.getByLabelText(/Suggested correction/), {
    target: { value: "Retain my correction" },
  });
  fireEvent.change(screen.getByLabelText(/Interruptions or other comments/), {
    target: { value: "Retain my comment" },
  });
  fireEvent.click(within(group).getByLabelText("I’m not sure"));
  expect(
    screen.queryByLabelText(/Suggested correction/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText(/Interruptions or other comments/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("What are you unsure about?", { exact: false }),
  ).toBeRequired();
  fireEvent.click(within(group).getByLabelText("Not acceptable"));
  expect(screen.getByLabelText(/Suggested correction/)).toHaveValue(
    "Retain my correction",
  );
  expect(screen.getByLabelText(/Interruptions or other comments/)).toHaveValue(
    "Retain my comment",
  );
});
test.each(["Rob", "Xinru", "Iman"])(
  "%s sees the permitted navigation but not the temporarily hidden earlier pilot",
  async (name) => {
    jest.mocked(Post).mockResolvedValue({
      ...start(),
      reviewerLabel: name,
      canUseReviewLinks: true,
      canReviewFlagged: true,
    });
    render(<QuickTitleVerification />);
    await screen.findByText("Write Technical Reports for Clients");
    expect(
      screen.getByRole("button", { name: "Reload saved review" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Rob’s flagged review" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Earlier five-activity pilot" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Coordinator tools")).not.toBeInTheDocument();
  },
);
test.each([false, true])(
  "other reviewers do not see restricted navigation, even with coordinator permission %s",
  async (canManage) => {
    jest
      .mocked(Post)
      .mockResolvedValue({ ...start(), canManage, canReviewFlagged: true });
    render(<QuickTitleVerification />);
    await screen.findByText("Write Technical Reports for Clients");
    expect(
      screen.queryByRole("button", { name: "Reload saved review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Rob’s flagged review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Earlier five-activity pilot" }),
    ).not.toBeInTheDocument();
  },
);
test("switching profile appearance keeps the in-progress choices and does not reload the review", async () => {
  jest.mocked(Post).mockResolvedValue(start());
  const view = render(
    <ThemeProvider theme={createTheme({ palette: { mode: "light" } })}>
      <QuickTitleVerification />
    </ThemeProvider>,
  );
  await screen.findByText("Write Technical Reports for Clients");
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText(
      "Not acceptable",
    ),
  );
  fireEvent.change(screen.getByLabelText(/Why is it not acceptable/), {
    target: { value: "Keep my unfinished explanation" },
  });
  view.rerender(
    <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
      <QuickTitleVerification />
    </ThemeProvider>,
  );
  expect(
    screen.getByDisplayValue("Keep my unfinished explanation"),
  ).toBeVisible();
  expect(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText(
      "Not acceptable",
    ),
  ).toBeChecked();
  expect(
    jest
      .mocked(Post)
      .mock.calls.filter(([path]) => String(path).endsWith("session")),
  ).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeEnabled();
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
      localStorage.getItem("source-title-draft:quick-v1:reviewer-test:case-1")!,
    ).payload.ratings["related-0"].explanation,
  ).toBe("More text written during autosave");
});

test("account errors appear beside Add reviewers and preserve the entered email", async () => {
  const v = { ...start(), canManage: true };
  const missing =
    "The email address s_a_min@mit.edu does not exist in the ontology platform. Create the ontology account first, then add it as a reviewer here.";
  jest
    .mocked(Post)
    .mockResolvedValueOnce(v)
    .mockRejectedValueOnce(Object.assign(new Error(missing), { status: 400 }));
  render(<QuickTitleVerification />);
  await screen.findByText("Coordinator tools");
  fireEvent.click(screen.getByText("Coordinator tools"));
  const field = screen.getByLabelText(
    "Existing reviewer account emails, one per line",
  );
  fireEvent.change(field, { target: { value: "s_a_min@mit.edu" } });
  fireEvent.click(screen.getByRole("button", { name: "Add reviewers" }));
  await waitFor(() =>
    expect(screen.getAllByText(missing).length).toBeGreaterThan(0),
  );
  expect(field).toHaveValue("s_a_min@mit.edu");
});
test("submission queues behind autosave, includes newer edits, and never loses or duplicates the click", async () => {
  jest.useFakeTimers();
  const v = start();
  let finish!: (v: any) => void, checkpointBody: any;
  jest.mocked(Post).mockImplementation(async (path, body: any) => {
    if (String(path).endsWith("checkpoint")) {
      checkpointBody = body;
      return new Promise((r) => {
        finish = r;
      }) as any;
    }
    if (String(path).endsWith("respond"))
      return {
        ...v,
        item: undefined,
        draft: undefined,
        questions: [],
        completed: 25,
      } as any;
    return v as any;
  });
  render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  for (const group of screen.getAllByRole("radiogroup"))
    fireEvent.click(within(group).getByLabelText("Acceptable"));
  await act(async () => {
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
  });
  expect(finish).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Saving…" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(screen.getAllByRole("radiogroup")[0]).getByLabelText(
      "Not acceptable",
    ),
  );
  fireEvent.change(screen.getByLabelText(/Why is it not acceptable/), {
    target: { value: "New text typed while draft save is slow" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(
    jest
      .mocked(Post)
      .mock.calls.filter((c) => String(c[0]).endsWith("respond")),
  ).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await act(async () => {
    finish({
      ...v,
      draft: { ...v.draft, revision: 1, payload: checkpointBody.payload },
    });
    await Promise.resolve();
  });
  await screen.findByText(/You have finished the 25/);
  const deliveries = jest
    .mocked(Post)
    .mock.calls.filter((c) => String(c[0]).endsWith("respond"));
  expect(deliveries).toHaveLength(1);
  expect((deliveries[0][1] as any).revision).toBe(1);
  expect(
    (deliveries[0][1] as any).payload.ratings["related-0"].explanation,
  ).toBe("New text typed while draft save is slow");
});
test("unchanged paused drafts cause no repeated network writes", async () => {
  jest.useFakeTimers();
  let v = start();
  jest.mocked(Post).mockImplementation(async (path, body: any) => {
    if (String(path).endsWith("checkpoint"))
      v = {
        ...v,
        draft: {
          ...v.draft,
          revision: v.draft.revision + 1,
          payload: body.payload,
        },
      };
    return v as any;
  });
  render(<QuickTitleVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Pause review" }));
  await act(async () => {
    await Promise.resolve();
  });
  const count = jest.mocked(Post).mock.calls.length;
  await act(async () => {
    jest.advanceTimersByTime(300000);
    await Promise.resolve();
  });
  expect(jest.mocked(Post).mock.calls.length).toBe(count);
  expect(v.draft.payload.activeTimeMs).toBe(12000);
});
test("download errors appear beside the download controls without interrupting the form", async () => {
  jest
    .mocked(Post)
    .mockResolvedValueOnce(start())
    .mockRejectedValueOnce(new Error("Download temporarily unavailable"));
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Download my reviews and timing (CSV)",
    }),
  );
  expect(
    await screen.findByText("Download temporarily unavailable"),
  ).toBeVisible();
  const card = screen.getByText("Download submitted reviews").parentElement!;
  expect(
    within(card).getByText("Download temporarily unavailable"),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeEnabled();
});
test("a CSV downloads once without redundant success controls and retains its URL until unmount", async () => {
  const create = jest.fn(() => "blob:prepared-review-csv"),
    revoke = jest.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: create,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revoke,
  });
  let attached = false,
    filename = "",
    href = "";
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      attached = document.body.contains(this);
      filename = this.download;
      href = this.href;
    });
  jest
    .mocked(Post)
    .mockResolvedValueOnce(start())
    .mockResolvedValueOnce({
      study: { roster: [] },
      answers: [],
      legacyAnswers: [],
      dataset: { pages: [] },
      legacyDataset: { cases: [] },
    });
  const mounted = render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Download my reviews and timing (CSV)",
    }),
  );
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(attached).toBe(true);
  expect(href).toBe("blob:prepared-review-csv");
  expect(filename).toBe("title-review-self-quick-v1.csv");
  expect(screen.queryByText(/Your CSV is ready/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Download the prepared CSV" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Download my reviews and timing (CSV)",
    }),
  ).toBeEnabled();
  expect(revoke).not.toHaveBeenCalled();
  expect(jest.mocked(Post).mock.calls[1][1]).toMatchObject({ scope: "self" });
  mounted.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:prepared-review-csv");
  click.mockRestore();
});
test("an unfinished coordinator can download team reviews within Coordinator tools", async () => {
  jest.mocked(Post).mockResolvedValue({
    ...start(),
    canManage: true,
    exports: { ownSubmitted: 1, teamAllowed: true, regularRemaining: 25 },
  });
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  const tools = screen.getByRole("button", { name: "Coordinator tools" });
  expect(tools).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(tools);
  const section = tools.closest<HTMLElement>(".MuiAccordion-root")!;
  expect(
    within(section).getByRole("button", {
      name: "Download team reviews and timing (CSV)",
    }),
  ).toBeEnabled();
  expect(
    within(
      screen.getByText("Download submitted reviews").parentElement!,
    ).queryByRole("button", { name: "Download team reviews and timing (CSV)" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Download my reviews and timing (CSV)",
    }),
  ).toBeEnabled();
  expect(screen.queryByText(/Finish your remaining/)).not.toBeInTheDocument();
  expect(
    within(section).getByText(
      /Download all submitted team reviews and timing at any point/,
    ),
  ).toBeVisible();
});
test("ordinary reviewers cannot see team downloads or Coordinator tools", async () => {
  jest.mocked(Post).mockResolvedValue(start());
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  expect(
    screen.queryByRole("button", { name: "Coordinator tools" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: "Download team reviews and timing (CSV)",
    }),
  ).not.toBeInTheDocument();
});
test("a team export failure appears in Coordinator tools and leaves the review editable", async () => {
  jest
    .mocked(Post)
    .mockResolvedValueOnce({
      ...start(),
      canManage: true,
      exports: { ownSubmitted: 1, teamAllowed: true, regularRemaining: 25 },
    })
    .mockRejectedValueOnce(new Error("Team download temporarily unavailable"));
  render(<QuickTitleVerification />);
  await screen.findByText("Write Technical Reports for Clients");
  const tools = screen.getByRole("button", { name: "Coordinator tools" });
  fireEvent.click(tools);
  fireEvent.click(
    within(tools.closest<HTMLElement>(".MuiAccordion-root")!).getByRole(
      "button",
      {
        name: "Download team reviews and timing (CSV)",
      },
    ),
  );
  expect(
    await within(tools.closest<HTMLElement>(".MuiAccordion-root")!).findByText(
      "Team download temporarily unavailable",
    ),
  ).toBeVisible();
  expect(
    within(
      screen.getByText("Download submitted reviews").parentElement!,
    ).queryByText("Team download temporarily unavailable"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeEnabled();
  expect(jest.mocked(Post).mock.calls[1][1]).toMatchObject({ scope: "team" });
});
test("conflict recovery keeps an unsent copy before explicitly loading another tab's saved version", async () => {
  const v = start();
  v.draft.revision = 2;
  const local = JSON.parse(JSON.stringify(v.draft.payload));
  local.ratings["related-0"] = {
    value: "unsure",
    explanation: "My unsent version",
  };
  local.activeTimeMs = 19000;
  localStorage.setItem(
    "source-title-draft:quick-v1:reviewer-test:case-1",
    JSON.stringify({ revision: 0, payload: local }),
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: jest.fn(() => "blob:recovery-copy"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
  jest.mocked(Post).mockResolvedValue(v);
  render(<QuickTitleVerification />);
  expect(await screen.findByDisplayValue("My unsent version")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Keep my copy and load saved version" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByDisplayValue("My unsent version"),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: "Save and continue" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("link", { name: "Download my unsent choices" }),
  ).toHaveAttribute("href", "blob:recovery-copy");
  const backup = Object.keys(localStorage).find((k) =>
    k.includes(":recovery:"),
  )!;
  expect(
    JSON.parse(localStorage.getItem(backup)!).payload.ratings["related-0"]
      .explanation,
  ).toBe("My unsent version");
});
test("a confirmed reviewer addition shows an explicit success message next to coordinator controls", async () => {
  const v = { ...start(), canManage: true };
  jest
    .mocked(Post)
    .mockResolvedValueOnce(v)
    .mockResolvedValueOnce({
      ok: true,
      addedReviewers: ["example@mit.edu"],
      alreadyAssigned: [],
    })
    .mockResolvedValueOnce(v);
  render(<QuickTitleVerification />);
  await screen.findByText("Coordinator tools");
  fireEvent.click(screen.getByText("Coordinator tools"));
  const field = screen.getByLabelText(
    "Existing reviewer account emails, one per line",
  );
  fireEvent.change(field, { target: { value: "example@mit.edu" } });
  fireEvent.click(screen.getByRole("button", { name: "Add reviewers" }));
  expect(
    await screen.findByText("Added as reviewer: example@mit.edu."),
  ).toBeVisible();
  expect(field).toHaveValue("");
});
