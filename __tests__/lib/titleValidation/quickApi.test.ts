import { quickTitleHandler } from "../../../src/lib/titleValidation/quickApi";
import { actorFor } from "../../../src/lib/titleValidation/api";
import { withQuickStudy } from "../../../src/lib/titleValidation/quickRepository";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import {
  QUICK_STUDY_ID,
  QuickState,
} from "../../../src/lib/titleValidation/quick";
import { TitleValidationError } from "../../../src/lib/titleValidation/engine";
jest.mock("../../../src/lib/titleValidation/api", () => ({
  actorFor: jest.fn(),
}));
jest.mock("../../../src/lib/titleValidation/quickRepository", () => ({
  withQuickStudy: jest.fn(),
}));
let state: QuickState;
const call = async (action: string, body: any = {}) => {
  const res: any = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  await quickTitleHandler(
    { method: "POST", query: { action }, body } as any,
    res,
  );
  return {
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  };
};
beforeEach(() => {
  jest.clearAllMocks();
  process.env.TITLE_VALIDATION_RELEASED = "1";
  state = {
    study: {
      id: QUICK_STUDY_ID,
      protocol: "quick-title-verification-v1",
      datasetVersion: getQuickDataset().version,
      roster: [{ reviewerId: "urop", label: "UROP" }],
      flaggedReviewerIds: ["rob"],
      regularLimit: 25,
      createdAt: 1,
    },
    answers: {},
    drafts: {},
  };
  jest
    .mocked(actorFor)
    .mockResolvedValue({
      uid: "urop",
      label: "UROP",
      canManage: false,
      preview: false,
    });
  jest
    .mocked(withQuickStudy)
    .mockImplementation(async (_id, _uid, _preview, mutate) => {
      const changed = mutate(JSON.parse(JSON.stringify(state)));
      state = changed.state!;
      return changed.result as any;
    });
});
afterEach(() => {
  delete process.env.TITLE_VALIDATION_RELEASED;
});
test("anonymous users, unassigned reviewers and UROP access to flagged cases fail closed", async () => {
  jest
    .mocked(actorFor)
    .mockRejectedValueOnce(new TitleValidationError(401, "Sign in"));
  expect((await call("quick-session")).status).toBe(401);
  expect(withQuickStudy).not.toHaveBeenCalled();
  const baseline = JSON.stringify(state);
  expect((await call("quick-session", { pool: "flagged" })).status).toBe(403);
  expect(JSON.stringify(state)).toBe(baseline);
  jest
    .mocked(actorFor)
    .mockResolvedValue({
      uid: "other",
      label: "Other",
      canManage: false,
      preview: false,
    });
  expect((await call("quick-session")).status).toBe(403);
});
test("clients cannot select an earlier pilot or software test via studyId/qa fields", async () => {
  expect(
    (
      await call("quick-session", {
        studyId: "human-title-review-prepilot-20261015-v1",
      })
    ).status,
  ).toBe(200);
  expect(jest.mocked(withQuickStudy).mock.calls[0][0]).toBe(QUICK_STUDY_ID);
  expect((await call("quick-session", { qa: true })).status).toBe(403);
  expect((await call("quick-manage", { operation: "expand" })).status).toBe(
    403,
  );
  expect(state.study.regularLimit).toBe(25);
});
test("HTTP retry of a submitted answer returns progress without duplicating or changing saved timing", async () => {
  const opened = await call("quick-session"),
    payload = opened.body.draft.payload;
  for (const id of Object.keys(payload.ratings))
    payload.ratings[id] = {
      value: "unsure",
      explanation: "SOFTWARE TEST — not a human judgment.",
    };
  payload.activeTimeMs = 0;
  const request = { payload, revision: 0 };
  expect((await call("quick-respond", request)).status).toBe(200);
  const answerBytes = JSON.stringify(state.answers);
  expect((await call("quick-respond", request)).body.completed).toBe(1);
  expect(Object.keys(state.answers)).toHaveLength(1);
  expect(JSON.stringify(state.answers)).toBe(answerBytes);
  expect(
    (
      await call("quick-respond", {
        ...request,
        payload: { ...payload, correction: "Overwrite" },
      })
    ).status,
  ).toBe(409);
});
test("checkpoint revisions protect explanations from stale tabs", async () => {
  const opened = await call("quick-session"),
    payload = opened.body.draft.payload;
  payload.interruption = "Interrupted by a phone call.";
  expect(
    (await call("quick-checkpoint", { payload, revision: 0 })).body.draft
      .revision,
  ).toBe(1);
  const baseline = JSON.stringify(state.drafts);
  expect(
    (
      await call("quick-checkpoint", {
        payload: { ...payload, interruption: "Stale text" },
        revision: 0,
      })
    ).status,
  ).toBe(409);
  expect(JSON.stringify(state.drafts)).toBe(baseline);
  expect((await call("quick-session")).body.draft.payload.interruption).toBe(
    payload.interruption,
  );
});
