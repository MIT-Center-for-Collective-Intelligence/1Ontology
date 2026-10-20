import { quickTitleHandler } from "../../../src/lib/titleValidation/quickApi";
import { actorFor } from "../../../src/lib/titleValidation/api";
import { withQuickStudy } from "../../../src/lib/titleValidation/quickRepository";
import { getQuickDataset } from "../../../src/lib/titleValidation/quickDataset";
import {
  emptyQuickPayload,
  quickKey,
  saveQuick,
  QUICK_QA_ID,
  QUICK_SELECTION_QA_ID,
  QUICK_STUDY_ID,
  QuickCase,
  QuickState,
} from "../../../src/lib/titleValidation/quick";
import { TitleValidationError } from "../../../src/lib/titleValidation/engine";
import { db, admin } from "../../../src/lib/firestoreServer/admin";
import { quickReviewCsv } from "../../../src/lib/titleValidation/quickCsv";
import { sourceReviewAction } from "../../../src/lib/titleValidation/sourceApi";
jest.mock("../../../src/lib/titleValidation/sourceApi", () => ({
  sourceReviewAction: jest.fn(),
}));
import {
  effectiveQuickBatch,
  LEGACY_QUICK_SELECTION,
  makeQuickSelection,
  quickSelectionManifest,
  quickSelectionRelease,
  selectionHash,
} from "../../../src/lib/titleValidation/quickSelection";
jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  db: { collection: jest.fn(), runTransaction: jest.fn() },
  admin: { auth: jest.fn() },
}));
jest.mock("../../../src/lib/titleValidation/api", () => ({
  actorFor: jest.fn(),
}));
jest.mock("../../../src/lib/titleValidation/quickRepository", () => ({
  withQuickStudy: jest.fn(),
}));
let state: QuickState;
const previousRevision = process.env.K_REVISION;
const previousReady = process.env.TITLE_QUICK_SELECTION_ACTIVATION_READY;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const data = getQuickDataset();
function coordinator() {
  jest.mocked(actorFor).mockResolvedValue({
    uid: "rob",
    label: "Rob",
    canManage: true,
    preview: false,
  });
}
function seedDraft(item: QuickCase) {
  const now = Date.now(),
    payload = emptyQuickPayload(item);
  payload.correction = "Private existing text";
  payload.activeTimeMs = 5000;
  return (state.drafts[quickKey("urop", item.id)] = {
    reviewerId: "urop",
    caseId: item.id,
    revision: 3,
    firstPresentedAt: now - 10000,
    updatedAt: now - 3000,
    payload,
  });
}
function activationRequest() {
  const protectedItem = data.cases.find(
    (c) => c.id === quickSelectionManifest.protectedCaseIds[0],
  )!;
  const protectedDraft = seedDraft(protectedItem);
  process.env.K_REVISION = "compatible-main";
  delete process.env.TITLE_QUICK_SELECTION_ACTIVATION_READY;
  return {
    operation: "activate-selection",
    ...quickSelectionRelease(data),
    compatibleRevision: "compatible-main",
    drainedOldRevisions: true,
    protectedDraftSha256: selectionHash(protectedDraft),
  };
}
function store() {
  const events: Record<string, any> = {
    existing: { kind: "quick-answer-submitted", at: 123 },
  };
  const ids: string[] = [],
    collections: Record<string, any> = {};
  const root: any = {
    get: jest.fn(async () => ({
      exists: true,
      data: () => ({ study: clone(state.study) }),
    })),
    collection: (name: string) =>
      (collections[name] ||= {
        get: jest.fn(async () => ({
          docs: Object.entries(
            name === "answers"
              ? state.answers
              : name === "drafts"
                ? state.drafts
                : events,
          ).map(([id, record]) => ({ id, data: () => clone(record) })),
        })),
        doc: (id = "generated") => ({ name, id }),
      }),
  };
  const tx = {
    get: jest.fn((ref: any) => ref.get()),
    update: jest.fn((_ref: any, fields: Record<string, unknown>) => {
      for (const [field, value] of Object.entries(fields))
        (state.study as any)[field.split(".")[1]] = clone(value);
    }),
    create: jest.fn((ref: any, record: any) => {
      expect(ref.name).toBe("events");
      expect(events[ref.id]).toBeUndefined();
      events[ref.id] = clone(record);
    }),
  };
  (db.collection as jest.Mock).mockImplementation(() => ({
    doc: (id: string) => {
      ids.push(id);
      return root;
    },
  }));
  (db.runTransaction as jest.Mock).mockImplementation(async (mutate: any) =>
    mutate(tx),
  );
  return { tx, events, ids };
}
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
  jest.mocked(actorFor).mockResolvedValue({
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
  if (previousRevision === undefined) delete process.env.K_REVISION;
  else process.env.K_REVISION = previousRevision;
  if (previousReady === undefined)
    delete process.env.TITLE_QUICK_SELECTION_ACTIVATION_READY;
  else process.env.TITLE_QUICK_SELECTION_ACTIVATION_READY = previousReady;
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
  jest.mocked(actorFor).mockResolvedValue({
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

test("new source-page software QA is isolated and remains coordinator-only", async () => {
  expect(
    (await call("quick-source-session", { qa: true, sourceReview: true }))
      .status,
  ).toBe(403);
  expect(sourceReviewAction).not.toHaveBeenCalled();
  coordinator();
  jest.mocked(sourceReviewAction).mockResolvedValue({ ok: true } as any);
  expect(
    (await call("quick-source-session", { qa: true, sourceReview: true }))
      .status,
  ).toBe(200);
  expect(jest.mocked(sourceReviewAction).mock.calls[0][3]).toBe(
    "software-qa-quick-title-source-pages-v2",
  );
  expect(
    (await call("quick-source-session", { studyId: QUICK_QA_ID })).status,
  ).toBe(200);
  expect(jest.mocked(sourceReviewAction).mock.calls[1][3]).toBe(QUICK_STUDY_ID);
});
test.each([false, true])(
  "review links follow authenticated permission %s, not a client-supplied flag",
  async (allowed) => {
    jest.mocked(actorFor).mockResolvedValue({
      uid: "urop",
      label: "UROP",
      canManage: false,
      canUseReviewLinks: allowed,
      preview: false,
    });
    const result = await call("quick-session", { canUseReviewLinks: !allowed });
    expect(result.status).toBe(200);
    expect(result.body.canUseReviewLinks).toBe(allowed);
    expect(result.body.canManage).toBe(false);
  },
);
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

test("a missing reviewer account identifies the email and next step; nothing is partly added", async () => {
  coordinator();
  const backend = store(),
    before = JSON.stringify(state);
  const lookup = jest
    .fn()
    .mockResolvedValueOnce({
      uid: "new",
      email: "existing@mit.edu",
      displayName: "Existing",
    })
    .mockRejectedValueOnce({ code: "auth/user-not-found" });
  jest.mocked(admin.auth).mockReturnValue({ getUserByEmail: lookup } as any);
  const result = await call("quick-manage", {
    operation: "add",
    reviewers: [{ email: "existing@mit.edu" }, { email: "s_a_min@mit.edu" }],
  });
  expect(result.status).toBe(400);
  expect(result.body.error).toContain(
    "s_a_min@mit.edu does not exist in the ontology platform",
  );
  expect(result.body.error).toContain("Create the ontology account first");
  expect(JSON.stringify(state)).toBe(before);
  expect(backend.tx.update).not.toHaveBeenCalled();
});
test("existing accounts get confirmed reviewer access, and a repeated add reports already assigned", async () => {
  coordinator();
  store();
  jest.mocked(admin.auth).mockReturnValue({
    getUserByEmail: jest.fn().mockResolvedValue({
      uid: "new-reviewer",
      email: "example@mit.edu",
      displayName: "Example",
    }),
  } as any);
  const req = { operation: "add", reviewers: [{ email: "example@mit.edu" }] };
  const result = await call("quick-manage", req);
  expect(result.status).toBe(200);
  expect(result.body.addedReviewers).toEqual(["example@mit.edu"]);
  expect(
    state.study.roster.filter((r) => r.reviewerId === "new-reviewer"),
  ).toEqual([{ reviewerId: "new-reviewer", label: "Example" }]);
  store();
  const again = await call("quick-manage", req);
  expect(again.body.addedReviewers).toEqual([]);
  expect(again.body.alreadyAssigned).toEqual(["example@mit.edu"]);
});
test.each([
  [{ code: "auth/internal-error" }, 503, "could not be checked"],
  [{ disabled: true, uid: "disabled" }, 400, "disabled"],
])(
  "account service failures and disabled accounts never get reported as nonexistent",
  async (value, status, expected) => {
    coordinator();
    const backend = store();
    const lookup = (value as any).code
      ? jest.fn().mockRejectedValue(value)
      : jest.fn().mockResolvedValue(value);
    jest.mocked(admin.auth).mockReturnValue({ getUserByEmail: lookup } as any);
    const result = await call("quick-manage", {
      operation: "add",
      reviewers: [{ email: "example@mit.edu" }],
    });
    expect(result.status).toBe(status);
    expect(result.body.error).toContain(expected);
    expect(backend.tx.update).not.toHaveBeenCalled();
  },
);

test.each([undefined, true])(
  "authorized activation preserves existing production/old-QA records (qa=%s)",
  async (qa) => {
    coordinator();
    const request = activationRequest(),
      backend = store();
    const answers = JSON.stringify(state.answers),
      drafts = JSON.stringify(state.drafts);
    const study = clone(state.study),
      oldEvent = JSON.stringify(backend.events.existing);
    expect((await call("quick-manage", { ...request, qa })).status).toBe(200);
    expect(backend.ids[0]).toBe(qa ? QUICK_QA_ID : QUICK_STUDY_ID);
    expect(JSON.stringify(state.answers)).toBe(answers);
    expect(JSON.stringify(state.drafts)).toBe(drafts);
    const { selection, ...unchangedStudy } = state.study;
    expect(unchangedStudy).toEqual(study);
    expect(
      selection!.legacyDrafts[Object.keys(state.drafts)[0]].snapshotSha256,
    ).toBe(request.protectedDraftSha256);
    expect(backend.tx.update).toHaveBeenCalledTimes(1);
    expect(backend.tx.update.mock.calls[0][1]).toEqual({
      "study.selection": selection,
    });
    expect(backend.tx.create).toHaveBeenCalledTimes(1);
    expect(backend.events[quickSelectionManifest.version]).toMatchObject({
      kind: "quick-selection-activated",
      initialOutcomes: { Keep: 5, Clarify: 15, Split: 5 },
      draftSnapshots: [
        {
          key: Object.keys(state.drafts)[0],
          sha256: request.protectedDraftSha256,
          draft: Object.values(state.drafts)[0],
        },
      ],
    });
    expect(JSON.stringify(backend.events.existing)).toBe(oldEvent);
    const activated = JSON.stringify({ state, events: backend.events });
    expect(
      (await call("quick-manage", { ...request, qa })).body.duplicate,
    ).toBe(true);
    expect(JSON.stringify({ state, events: backend.events })).toBe(activated);
    expect(backend.tx.update).toHaveBeenCalledTimes(1);
    expect(backend.tx.create).toHaveBeenCalledTimes(1);
  },
);

test.each([
  ["selectionVersion", "wrong"],
  ["selectionSha256", "wrong"],
  ["initialOutcomes", { Keep: 2, Clarify: 22, Split: 1 }],
  ["reservedOutcomes", { Keep: 4, Clarify: 67, Split: 4 }],
  [
    "selectionCoverage",
    { initial: 25, reserve: 75, regular: 100, flagged: 318, cases: 419 },
  ],
  ["compatibleRevision", "old-revision"],
  ["drainedOldRevisions", false],
  ["protectedDraftSha256", "wrong"],
] as [string, unknown][])(
  "activation rejects mismatched %s without writes",
  async (field, value) => {
    coordinator();
    const request = activationRequest(),
      backend = store(),
      before = JSON.stringify(state);
    expect(
      (await call("quick-manage", { ...request, [field]: value })).status,
    ).toBe(409);
    expect(JSON.stringify(state)).toBe(before);
    expect(backend.tx.update).not.toHaveBeenCalled();
    expect(backend.tx.create).not.toHaveBeenCalled();
  },
);

test("activation remains coordinator-only and the separate selection QA does not replace browser qa=1", async () => {
  expect(
    (await call("quick-manage", { operation: "activate-selection" })).status,
  ).toBe(403);
  expect((await call("quick-session", { qa: "selection" })).status).toBe(403);
  coordinator();
  for (const [qa, id, version] of [
    [true, QUICK_QA_ID, LEGACY_QUICK_SELECTION],
    ["selection", QUICK_SELECTION_QA_ID, quickSelectionManifest.version],
  ] as const) {
    jest
      .mocked(withQuickStudy)
      .mockImplementationOnce(async (_id, _uid, _preview, mutate) => {
        const changed = mutate(null);
        state = changed.state!;
        return changed.result as any;
      });
    const opened = await call("quick-session", { qa });
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({
      studyId: id,
      softwareQA: true,
      selectionVersion: version,
      total: 25,
    });
    expect(jest.mocked(withQuickStudy).mock.calls.at(-1)![0]).toBe(id);
  }
  expect((await call("quick-session", { qa: "other" })).status).toBe(400);
});

test("read-only exports create no phantom drafts and retain legacy and per-answer selection provenance", async () => {
  const oldItem = data.cases.find(
    (c) => c.batch === "first25" && effectiveQuickBatch(c) === "next75",
  )!;
  const oldPayload = clone(seedDraft(oldItem).payload);
  for (const r of Object.values(oldPayload.ratings)) r.value = "acceptable";
  const old = saveQuick(
    state,
    data,
    "urop",
    false,
    false,
    oldPayload,
    3,
    true,
    Date.now(),
  ).answer!;
  delete old.selection; // A record written before per-answer provenance existed.
  const request = activationRequest(),
    backend = store();
  coordinator();
  const beforeOldExport = JSON.stringify(state);
  const inactive = await call("quick-export");
  expect(inactive.status).toBe(200);
  expect(inactive.body.selection.active).toBe(false);
  expect(JSON.stringify(state)).toBe(beforeOldExport);
  state.study.selection = makeQuickSelection(state, data, Date.now());
  const currentDraft = Object.values(state.drafts).find(
    (d) => !state.answers[quickKey(d.reviewerId, d.caseId)],
  )!;
  const payload = clone(currentDraft.payload);
  for (const r of Object.values(payload.ratings)) r.value = "acceptable";
  const current = saveQuick(
    state,
    data,
    "urop",
    false,
    false,
    payload,
    3,
    true,
    Date.now(),
  ).answer!;
  const before = JSON.stringify({ state, events: backend.events }),
    exported = await call("quick-export");
  expect(exported.status).toBe(200);
  expect(JSON.stringify({ state, events: backend.events })).toBe(before);
  expect(exported.body.drafts).toEqual(Object.values(state.drafts));
  expect(exported.body.answers).toEqual(Object.values(state.answers));
  expect(exported.body.answerSelections[old.id]).toEqual({
    version: LEGACY_QUICK_SELECTION,
    sha256: null,
    batch: "first25",
    access: "assigned",
  });
  expect(exported.body.answerSelections[current.id]).toEqual(current.selection);
  expect(exported.body.selection.selectionSha256).toBe(request.selectionSha256);
  const oldRow = quickReviewCsv(exported.body)
    .split("\r\n")
    .find((row) => row.includes(`"${old.caseId}"`))!;
  expect(oldRow).toContain(
    `"next75","${request.selectionVersion}","${request.selectionSha256}","${LEGACY_QUICK_SELECTION}","","first25","assigned"`,
  );
  expect(backend.tx.update).not.toHaveBeenCalled();
  expect(backend.tx.create).not.toHaveBeenCalled();
});
