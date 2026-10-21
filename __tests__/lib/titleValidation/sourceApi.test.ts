import { sourceReviewAction } from "../../../src/lib/titleValidation/sourceApi";
import { withSourceStudy } from "../../../src/lib/titleValidation/sourceRepository";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import type { SourceState } from "../../../src/lib/titleValidation/sourceReview";
jest.mock("../../../src/lib/titleValidation/sourceRepository", () => ({
  withSourceStudy: jest.fn(),
}));
const data = getQuickDataset();
const actor = {
  uid: "urop",
  label: "Reviewer",
  canManage: false,
  preview: false,
};
let state: SourceState;
beforeEach(() => {
  jest.clearAllMocks();
  state = {
    legacy: {
      study: {
        id: "quick-title-verification-test",
        protocol: "quick-title-verification-v1",
        datasetVersion: data.version,
        roster: [{ reviewerId: "urop", label: "Reviewer" }],
        flaggedReviewerIds: [],
        regularLimit: 25,
        createdAt: 1,
      },
      answers: {},
      drafts: {},
    },
    answers: {},
    drafts: {},
  };
  jest
    .mocked(withSourceStudy)
    .mockImplementation(
      async (_id, _uid, _preview, _seed, fn) => fn(state).result as any,
    );
});
test("only own assigned source pages are delivered; package mismatch, unassigned identity, flagged access, exports and tampering fail", async () => {
  const view: any = await sourceReviewAction(
    "quick-source-session",
    {},
    actor,
    state.legacy.study.id,
    data,
    false,
  );
  expect(view.item.activities.length).toBeGreaterThan(0);
  expect(
    view.item.activities.every((a: any) => a.supportingDescriptionCount === 1),
  ).toBe(true);
  expect(view.canUseReviewLinks).toBe(false);
  expect(Object.keys(view)).not.toContain("legacyAnswers");
  await expect(
    sourceReviewAction(
      "quick-source-session",
      { canUseReviewLinks: true },
      { ...actor, uid: "other" },
      state.legacy.study.id,
      data,
      false,
    ),
  ).rejects.toThrow("not assigned");
  await expect(
    sourceReviewAction(
      "quick-source-session",
      {},
      actor,
      state.legacy.study.id,
      data,
      true,
    ),
  ).rejects.toThrow("Rob is reviewing");
  await expect(
    sourceReviewAction(
      "quick-source-export",
      {},
      actor,
      state.legacy.study.id,
      data,
      false,
    ),
  ).rejects.toThrow("Only coordinators");
  await expect(
    sourceReviewAction(
      "quick-source-respond",
      { payload: view.draft.payload, revision: 0, packageVersion: "old" },
      actor,
      state.legacy.study.id,
      data,
      false,
    ),
  ).rejects.toThrow("form version");
  const p = structuredClone(view.draft.payload);
  p.ratings.original = { value: "acceptable", explanation: "injected" };
  await expect(
    sourceReviewAction(
      "quick-source-respond",
      {
        payload: p,
        revision: 0,
        packageVersion: view.datasetVersion,
        reviewScope: view.reviewScope,
      },
      actor,
      state.legacy.study.id,
      data,
      false,
    ),
  ).rejects.toThrow("every proposed title");
  expect(Object.keys(state.answers)).toHaveLength(0);
  await expect(
    sourceReviewAction(
      "quick-source-checkpoint",
      {
        payload: view.draft.payload,
        revision: 0,
        packageVersion: view.datasetVersion,
      },
      actor,
      state.legacy.study.id,
      data,
      false,
    ),
  ).rejects.toThrow("review now includes only");
});
test("page response and retry store one record with its version and leave every historical answer untouched", async () => {
  const view: any = await sourceReviewAction(
    "quick-source-session",
    {},
    actor,
    state.legacy.study.id,
    data,
    false,
  );
  const before = JSON.stringify(state.legacy);
  for (const r of Object.values(view.draft.payload.ratings) as any[])
    r.value = "acceptable";
  const first = Object.keys(view.draft.payload.ratings)[0];
  view.draft.payload.ratings[first] = {
    value: "not_acceptable",
    explanation: "This title needs a change.",
    correction: "A correction attached only to this title",
  };
  const body = {
    payload: view.draft.payload,
    revision: 0,
    packageVersion: view.datasetVersion,
    reviewScope: view.reviewScope,
  };
  const saved: any = await sourceReviewAction(
    "quick-source-respond",
    body,
    actor,
    state.legacy.study.id,
    data,
    false,
  );
  expect(saved.completed).toBe(1);
  await sourceReviewAction(
    "quick-source-respond",
    body,
    actor,
    state.legacy.study.id,
    data,
    false,
  );
  expect(Object.keys(state.answers)).toHaveLength(1);
  expect(
    Object.values(state.answers)[0].payload.ratings[first].correction,
  ).toBe("A correction attached only to this title");
  expect(JSON.stringify(state.legacy)).toBe(before);
});
test("a personal export uses only the authenticated reviewer's repository scope, and rejects unknown scope", async () => {
  const own: any = await sourceReviewAction(
    "quick-source-export",
    { scope: "self", reviewerId: "other" },
    actor,
    state.legacy.study.id,
    data,
    false,
  );
  expect(own.scope).toBe("self");
  expect(own.study.roster).toEqual([{ reviewerId: "urop", label: "Reviewer" }]);
  expect(own.answers).toEqual([]);
  expect(own.dataset.pages).toEqual([]);
  expect(jest.mocked(withSourceStudy).mock.calls[0][1]).toBe("urop");
  await expect(
    sourceReviewAction(
      "quick-source-export",
      { scope: "all" },
      actor,
      state.legacy.study.id,
      data,
      false,
    ),
  ).rejects.toThrow("Unknown download scope");
});
