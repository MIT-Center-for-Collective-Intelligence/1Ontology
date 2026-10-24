import { createHash } from "crypto";
import {
  readPeerFeedback,
  savePeerFeedback,
} from "../../../src/lib/relationshipReview/peerRepository";
import type { PeerReviewerUids } from "../../../src/lib/relationshipReview/peerRepository";
import { RELATIONSHIP_COLLECTION } from "../../../src/lib/relationshipReview/repository";
import type {
  PeerFeedback,
  PeerFeedbackQuery,
  PeerReviewer,
  RelationshipFeedback,
  SavePeerFeedbackRequest,
} from "../../../src/types/IRelationshipReview";

const mockDocs = new Map<string, any>();
const mockSourceDocs = new Map<string, any>();
const mockWritePaths: string[] = [];
const mockClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const mockSnapshot = (key: string) => {
  const value = mockDocs.has(key) ? mockClone(mockDocs.get(key)) : undefined;
  return {
    exists: mockDocs.has(key),
    data: () => (value === undefined ? undefined : mockClone(value)),
  };
};
const mockRef = (key: string): any => ({
  key,
  doc: (id: string) => mockRef(`${key}/${id}`),
  collection: (id: string) => mockRef(`${key}/${id}`),
});

jest.mock("../../../src/lib/firestoreServer/admin", () => ({
  db: {
    collection: (name: string) => mockRef(name),
    runTransaction: async (fn: any) => {
      const pending: { key: string; value: any; merge: boolean }[] = [];
      // Atomic commits; attempted writes remain observable even on rollback.
      const stage = (r: any, value: any, merge = false, create = false) => {
        mockWritePaths.push(r.key);
        if (
          create &&
          (mockDocs.has(r.key) || pending.some((w) => w.key === r.key))
        )
          throw new Error("already exists");
        pending.push({ key: r.key, value: mockClone(value), merge });
      };
      const result = await fn({
        get: async (r: any) => {
          if (pending.length) throw new Error("transaction read after write");
          return mockSnapshot(r.key);
        },
        set: (r: any, value: any, options?: { merge?: boolean }) =>
          stage(r, value, options?.merge === true),
        create: (r: any, value: any) => stage(r, value, false, true),
      });
      for (const { key, value, merge } of pending)
        mockDocs.set(
          key,
          mockClone(merge ? { ...mockDocs.get(key), ...value } : value),
        );
      return result;
    },
  },
}));

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const UIDS: PeerReviewerUids = { tom: "tom-auth-uid", rob: "rob-auth-uid" };
const QA_UIDS: PeerReviewerUids = {
  tom: "software-qa:tom",
  rob: "software-qa:rob",
};
const IDS = [
  "f99da80d-a392-4e19-a2c2-c82fb991cc1a",
  "54ff4bd8-8fdd-4d39-9c3d-0de22ea2c5bb",
  "b167c91a-7f4a-4262-8ab9-a86a67d7e193",
] as const;
const QUERY: PeerFeedbackQuery = {
  caseId: "reason",
  datasetVersion: "v1",
  datasetSha256: hash("dataset-v1"),
};
const ROOT = `${RELATIONSHIP_COLLECTION}/${QUERY.datasetVersion}`;
const PEER_PREFIX = `${ROOT}/peerReviewers/`;
const ROLES: PeerReviewer[] = ["tom", "rob"];
const other = (reviewer: PeerReviewer): PeerReviewer =>
  reviewer === "tom" ? "rob" : "tom";
const originalBase = {
  caseId: QUERY.caseId,
  datasetVersion: QUERY.datasetVersion,
  savedAt: "2026-01-02T00:00:00.000Z",
  presentationSha256: hash("cards-v1"),
  presentationVersion: "cards-v1",
};
const originals: Record<PeerReviewer, RelationshipFeedback> = {
  tom: {
    ...originalBase,
    decision: "discuss",
    note: "Tom original",
    correction: "Tom correction",
    revision: 2,
    revisitLater: false,
  },
  rob: {
    ...originalBase,
    decision: "disagree",
    note: "Rob original",
    correction: "Rob correction",
    revision: 3,
    revisitLater: true,
  },
};

// Independent canonical bytes: legacy storage metadata must not enter the hash.
function feedbackHash(f: RelationshipFeedback): string {
  return hash(
    JSON.stringify({
      caseId: f.caseId,
      correction: f.correction,
      datasetVersion: f.datasetVersion,
      decision: f.decision,
      note: f.note,
      presentationSha256: f.presentationSha256,
      presentationVersion: f.presentationVersion,
      revision: f.revision,
      revisitLater: f.revisitLater,
      savedAt: f.savedAt,
    }),
  );
}
const actorPath = (author: PeerReviewer, uids = UIDS) =>
  `${PEER_PREFIX}${hash(uids[author])}`;
const answerPath = (author: PeerReviewer, uids = UIDS) =>
  `${actorPath(author, uids)}/answers/${QUERY.caseId}`;
const eventPath = (author: PeerReviewer, id: string, uids = UIDS) =>
  `${actorPath(author, uids)}/events/${id}`;
const originalPath = (reviewer: PeerReviewer, uids = UIDS) =>
  `${ROOT}/reviewers/${hash(uids[reviewer])}/answers/${QUERY.caseId}`;

function seed(path: string, value: any) {
  mockDocs.set(path, mockClone(value));
  if (!path.startsWith(PEER_PREFIX)) mockSourceDocs.set(path, mockClone(value));
}
function docsSnapshot(prefix = "") {
  const result = new Map<string, any>();
  for (const [path, value] of mockDocs)
    if (path.startsWith(prefix)) result.set(path, mockClone(value));
  return result;
}
function seedOriginals(uids = UIDS) {
  for (const reviewer of ROLES) {
    const reviewerKey = hash(uids[reviewer]);
    const base = `${ROOT}/reviewers/${reviewerKey}`;
    const metadata = {
      reviewerKey,
      softwareQA: uids[reviewer].startsWith("software-qa:"),
    };
    seed(base, { ...metadata, legacy: true });
    seed(originalPath(reviewer, uids), {
      ...originals[reviewer],
      ...metadata,
      legacyExtra: { preserve: true },
    });
    seed(`${base}/events/${IDS[0]}`, {
      ...metadata,
      requestId: IDS[0],
      requestSha256: hash(`original-event-${reviewer}`),
      answer: originals[reviewer],
      legacyExtra: "unchanged",
    });
  }
}
function requestFor(
  author: PeerReviewer = "tom",
  patch: Partial<SavePeerFeedbackRequest> = {},
  uids = UIDS,
): SavePeerFeedbackRequest {
  const target = mockDocs.get(
    originalPath(other(author), uids),
  ) as RelationshipFeedback;
  return {
    ...QUERY,
    reviewerKey: hash(uids[author]),
    targetReviewer: other(author),
    targetRevision: target.revision,
    targetFeedbackSha256: feedbackHash(target),
    decision: "agree",
    note: `${author} response`,
    revision: 0,
    requestId: IDS[0],
    ...patch,
  };
}
const saveAs = (
  author: PeerReviewer,
  request: SavePeerFeedbackRequest,
  uids = UIDS,
) => savePeerFeedback(uids[author], author, uids[other(author)], request);

function expectPersisted(
  author: PeerReviewer,
  request: SavePeerFeedbackRequest,
  answer: PeerFeedback,
  uids = UIDS,
) {
  const binding = {
    reviewerKey: hash(uids[author]),
    authorReviewer: author,
    targetReviewer: other(author),
    targetReviewerKey: hash(uids[other(author)]),
    softwareQA: uids[author].startsWith("software-qa:"),
  };
  expect(mockDocs.get(actorPath(author, uids))).toEqual({
    ...binding,
    updatedAt: answer.savedAt,
  });
  expect(mockDocs.get(answerPath(author, uids))).toEqual({
    ...binding,
    ...answer,
    datasetSha256: request.datasetSha256,
  });
  expect(mockDocs.get(eventPath(author, request.requestId, uids))).toEqual({
    ...binding,
    caseId: request.caseId,
    datasetVersion: request.datasetVersion,
    datasetSha256: request.datasetSha256,
    requestId: request.requestId,
    requestSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    answer,
  });
}
async function rejectsWithoutWrites(
  action: () => Promise<unknown>,
  status = 409,
) {
  const before = docsSnapshot();
  const attempts = mockWritePaths.length;
  await expect(action()).rejects.toMatchObject({ status });
  expect(mockWritePaths).toHaveLength(attempts);
  expect(docsSnapshot()).toEqual(before);
}

beforeEach(() => {
  mockDocs.clear();
  mockSourceDocs.clear();
  mockWritePaths.length = 0;
  seed(ROOT, { datasetSha256: QUERY.datasetSha256 });
  seed("directobjects/untouched", {
    title: "Original object",
    parentIds: ["root"],
  });
  seed("nodes/untouched", { title: "Original node", childIds: ["leaf"] });
});
afterEach(() => {
  // Protect all original actors/answers/events, manifests and graph documents.
  expect(mockWritePaths.every((path) => path.startsWith(PEER_PREFIX))).toBe(
    true,
  );
  expect(
    new Map([...mockDocs].filter(([path]) => !path.startsWith(PEER_PREFIX))),
  ).toEqual(mockSourceDocs);
});

test("reads legacy originals under the manifest without creating or rewriting original saves", async () => {
  const emptyBefore = docsSnapshot();
  const empty = await readPeerFeedback(UIDS, QUERY);
  expect(empty.reviewers).toEqual([
    {
      reviewer: "tom",
      label: "Tom",
      feedback: null,
      feedbackSha256: null,
      response: null,
    },
    {
      reviewer: "rob",
      label: "Rob",
      feedback: null,
      feedbackSha256: null,
      response: null,
    },
  ]);
  expect(docsSnapshot()).toEqual(emptyBefore);

  seedOriginals();
  const legacyBefore = docsSnapshot();
  for (const reviewer of ROLES)
    expect(mockDocs.get(originalPath(reviewer))).not.toHaveProperty(
      "datasetSha256",
    );
  expect(await readPeerFeedback(UIDS, QUERY)).toEqual({
    ...QUERY,
    reviewers: [
      {
        reviewer: "tom",
        label: "Tom",
        feedback: originals.tom,
        feedbackSha256: feedbackHash(originals.tom),
        response: null,
      },
      {
        reviewer: "rob",
        label: "Rob",
        feedback: originals.rob,
        feedbackSha256: feedbackHash(originals.rob),
        response: null,
      },
    ],
  });
  expect(docsSnapshot()).toEqual(legacyBefore);
  expect(mockWritePaths).toHaveLength(0);
});

test("Tom and Rob responses occupy the opposite rows with correct authors", async () => {
  seedOriginals();
  const originalsBefore = docsSnapshot(`${ROOT}/reviewers/`);
  const tomRequest = requestFor("tom", {
    decision: "disagree",
    note: "Tom answers Rob",
  });
  const robRequest = requestFor("rob", {
    requestId: IDS[1],
    note: "Rob answers Tom",
  });
  const tom = await saveAs("tom", tomRequest);
  const rob = await saveAs("rob", robRequest);
  expect(tom).toMatchObject({
    authorReviewer: "tom",
    targetReviewer: "rob",
    revision: 1,
    decision: "disagree",
    note: "Tom answers Rob",
    targetFeedback: originals.rob,
  });
  expect(rob).toMatchObject({
    authorReviewer: "rob",
    targetReviewer: "tom",
    revision: 1,
    decision: "agree",
    note: "Rob answers Tom",
    targetFeedback: originals.tom,
  });
  expect((await readPeerFeedback(UIDS, QUERY)).reviewers).toEqual([
    {
      reviewer: "tom",
      label: "Tom",
      feedback: originals.tom,
      feedbackSha256: feedbackHash(originals.tom),
      response: rob,
    },
    {
      reviewer: "rob",
      label: "Rob",
      feedback: originals.rob,
      feedbackSha256: feedbackHash(originals.rob),
      response: tom,
    },
  ]);
  expectPersisted("tom", tomRequest, tom);
  expectPersisted("rob", robRequest, rob);
  expect(docsSnapshot(`${ROOT}/reviewers/`)).toEqual(originalsBefore);
});

test("saved target snapshots do not follow later original edits", async () => {
  seedOriginals();
  const request = requestFor();
  const receipt = await saveAs("tom", request);
  const updated = {
    ...originals.rob,
    revision: originals.rob.revision + 1,
    note: "Rob changed",
    correction: "New correction",
    revisitLater: false,
    savedAt: "2026-01-03T00:00:00.000Z",
  };
  seed(originalPath("rob"), {
    ...mockDocs.get(originalPath("rob")),
    ...updated,
  });
  const beforeRead = docsSnapshot();
  const attempts = mockWritePaths.length;
  const view = await readPeerFeedback(UIDS, QUERY);
  expect(view.reviewers[1]!.feedback).toEqual(updated);
  expect(view.reviewers[1]!.feedbackSha256).toBe(feedbackHash(updated));
  expect(view.reviewers[1]!.response).toEqual(receipt);
  expect(receipt.targetFeedback).toEqual(originals.rob);
  expect(receipt.targetFeedbackSha256).toBe(feedbackHash(originals.rob));
  expect(mockDocs.get(answerPath("tom")).targetFeedback).toEqual(originals.rob);
  expect(mockDocs.get(eventPath("tom", request.requestId)).answer).toEqual(
    receipt,
  );
  expect(docsSnapshot()).toEqual(beforeRead);
  expect(mockWritePaths).toHaveLength(attempts);
});

test("each peer revision survives and explicit retries return their original receipts", async () => {
  seedOriginals();
  const requests: SavePeerFeedbackRequest[] = [];
  const receipts: PeerFeedback[] = [];
  const history = new Map<string, any>();
  for (let i = 0; i < 3; i++) {
    const target = {
      ...originals.rob,
      note: `Rob original ${i}`,
      revision: originals.rob.revision + i,
    };
    seed(originalPath("rob"), {
      ...mockDocs.get(originalPath("rob")),
      ...target,
    });
    const request = requestFor("tom", {
      revision: i,
      requestId: IDS[i]!,
      note: `Peer revision ${i + 1}`,
      decision: i === 1 ? "disagree" : "agree",
    });
    const receipt = await saveAs("tom", request);
    requests.push(request);
    receipts.push(receipt);
    expect(receipt).toMatchObject({
      revision: i + 1,
      targetRevision: target.revision,
      targetFeedbackSha256: feedbackHash(target),
      targetFeedback: target,
    });
    expectPersisted("tom", request, receipt);
    const path = eventPath("tom", request.requestId);
    history.set(path, mockClone(mockDocs.get(path)));
    expect(docsSnapshot(`${actorPath("tom")}/events/`)).toEqual(history);
  }
  expect(receipts.map((receipt) => receipt.revision)).toEqual([1, 2, 3]);
  seed(originalPath("rob"), {
    ...mockDocs.get(originalPath("rob")),
    note: "Changed after all peer saves",
    revision: originals.rob.revision + 3,
  });
  const beforeReplay = docsSnapshot();
  const attempts = mockWritePaths.length;
  for (let i = 0; i < requests.length; i++)
    expect(await saveAs("tom", { ...requests[i]! })).toEqual(receipts[i]);
  expect((await readPeerFeedback(UIDS, QUERY)).reviewers[1]!.response).toEqual(
    receipts[2],
  );
  expect(docsSnapshot(`${actorPath("tom")}/events/`)).toEqual(history);
  expect(docsSnapshot()).toEqual(beforeReplay);
  expect(mockWritePaths).toHaveLength(attempts);
});

test("a changed payload cannot reuse a committed requestId", async () => {
  seedOriginals();
  const request = requestFor();
  const receipt = await saveAs("tom", request);
  const changes: Partial<SavePeerFeedbackRequest>[] = [
    { note: `${request.note} ` },
    { decision: "disagree" },
    { revision: 1 },
    { targetRevision: request.targetRevision + 1 },
    { targetFeedbackSha256: hash("different target") },
    { caseId: "other-reason" },
  ];
  for (const change of changes)
    await rejectsWithoutWrites(() => saveAs("tom", { ...request, ...change }));
  expect(await saveAs("tom", { ...request })).toEqual(receipt);
  expect(docsSnapshot(`${actorPath("tom")}/events/`).size).toBe(1);
});

test("stale target revision and hash fail independently before any write", async () => {
  seedOriginals();
  const stale = requestFor();
  const updated = {
    ...originals.rob,
    revision: originals.rob.revision + 1,
    note: "New original",
  };
  seed(originalPath("rob"), {
    ...mockDocs.get(originalPath("rob")),
    ...updated,
  });
  for (const patch of [
    { targetFeedbackSha256: feedbackHash(updated) },
    { targetRevision: updated.revision },
  ])
    await rejectsWithoutWrites(() => saveAs("tom", { ...stale, ...patch }));
  expect(mockDocs.has(actorPath("tom"))).toBe(false);
  expect(mockWritePaths).toHaveLength(0);
  const fresh = {
    ...stale,
    targetRevision: updated.revision,
    targetFeedbackSha256: feedbackHash(updated),
  };
  expect((await saveAs("tom", fresh)).targetFeedback).toEqual(updated);
});

test("a stale own-response revision cannot overwrite newer feedback", async () => {
  seedOriginals();
  const request = requestFor();
  const first = await saveAs("tom", request);
  const second = await saveAs("tom", {
    ...request,
    requestId: IDS[1],
    revision: 1,
    decision: "disagree",
    note: "Second response",
  });
  await rejectsWithoutWrites(() =>
    saveAs("tom", {
      ...request,
      requestId: IDS[2],
      revision: 1,
      note: "Stale tab",
    }),
  );
  expect(mockDocs.get(answerPath("tom")).revision).toBe(2);
  expect(mockDocs.get(eventPath("tom", IDS[0])).answer).toEqual(first);
  expect(mockDocs.get(eventPath("tom", IDS[1])).answer).toEqual(second);
});

test("wrong reviewer keys, accounts and roles reject without writes", async () => {
  seedOriginals();
  const request = requestFor();
  await saveAs("tom", request);
  await rejectsWithoutWrites(() =>
    saveAs("tom", { ...request, reviewerKey: hash(UIDS.rob) }),
  );
  await rejectsWithoutWrites(() =>
    savePeerFeedback("replacement-tom", "tom", UIDS.rob, request),
  );
  await rejectsWithoutWrites(() =>
    savePeerFeedback(UIDS.tom, "tom", "replacement-rob", request),
  );
  await rejectsWithoutWrites(() =>
    savePeerFeedback(UIDS.tom, "rob", UIDS.rob, {
      ...request,
      targetReviewer: "tom",
    }),
  );
  await rejectsWithoutWrites(
    () => saveAs("tom", { ...request, targetReviewer: "tom" }),
    400,
  );
  await rejectsWithoutWrites(
    () => savePeerFeedback(UIDS.tom, "tom", UIDS.tom, request),
    400,
  );
  await rejectsWithoutWrites(
    () =>
      savePeerFeedback(UIDS.tom, "unknown" as PeerReviewer, UIDS.rob, request),
    400,
  );
  await rejectsWithoutWrites(() =>
    readPeerFeedback({ ...UIDS, rob: "replacement-rob" }, QUERY),
  );
  await rejectsWithoutWrites(() =>
    readPeerFeedback({ tom: UIDS.rob, rob: UIDS.tom }, QUERY),
  );
});

test("stored actor, answer and receipt bindings are checked", async () => {
  seedOriginals();
  const request = requestFor();
  const receipt = await saveAs("tom", request);
  const next = requestFor("tom", { revision: 1, requestId: IDS[1] });
  const receiptPath = eventPath("tom", request.requestId);
  const corruptions: [string, Record<string, unknown>][] = [
    [actorPath("tom"), { reviewerKey: hash("foreign author") }],
    [actorPath("tom"), { authorReviewer: "rob" }],
    [actorPath("tom"), { targetReviewerKey: hash("foreign target") }],
    [answerPath("tom"), { reviewerKey: hash("foreign author") }],
    [receiptPath, { targetReviewer: "tom" }],
  ];
  for (const [path, patch] of corruptions) {
    const saved = mockClone(mockDocs.get(path));
    seed(path, { ...saved, ...patch });
    if (path === receiptPath) {
      await rejectsWithoutWrites(() => saveAs("tom", request));
    } else {
      await rejectsWithoutWrites(() => readPeerFeedback(UIDS, QUERY));
      await rejectsWithoutWrites(() => saveAs("tom", next));
    }
    seed(path, saved);
  }
  expect(await saveAs("tom", request)).toEqual(receipt);
});

test("real and software-QA identities cannot be mixed for reads or saves", async () => {
  seedOriginals();
  const request = requestFor();
  for (const pair of [
    { tom: UIDS.tom, rob: QA_UIDS.rob },
    { tom: QA_UIDS.tom, rob: UIDS.rob },
  ]) {
    await rejectsWithoutWrites(() => readPeerFeedback(pair, QUERY), 403);
    await rejectsWithoutWrites(
      () =>
        saveAs(
          "tom",
          {
            ...request,
            reviewerKey: hash(pair.tom),
          },
          pair,
        ),
      403,
    );
  }
});

test("software-QA reads and answer/event metadata remain consistent and isolated", async () => {
  seedOriginals();
  seedOriginals(QA_UIDS);
  const tomRequest = requestFor("tom", {}, QA_UIDS);
  const robRequest = requestFor(
    "rob",
    { requestId: IDS[1], decision: "disagree" },
    QA_UIDS,
  );
  const tom = await saveAs("tom", tomRequest, QA_UIDS);
  const rob = await saveAs("rob", robRequest, QA_UIDS);
  expectPersisted("tom", tomRequest, tom, QA_UIDS);
  expectPersisted("rob", robRequest, rob, QA_UIDS);
  const beforeReads = docsSnapshot();
  const attempts = mockWritePaths.length;
  expect(
    (await readPeerFeedback(QA_UIDS, QUERY)).reviewers.map((row) => [
      row.reviewer,
      row.response,
    ]),
  ).toEqual([
    ["tom", rob],
    ["rob", tom],
  ]);
  expect(
    (await readPeerFeedback(UIDS, QUERY)).reviewers.map((row) => row.response),
  ).toEqual([null, null]);
  expect(docsSnapshot()).toEqual(beforeReads);
  expect(mockWritePaths).toHaveLength(attempts);

  const next = requestFor("tom", { revision: 1, requestId: IDS[2] }, QA_UIDS);
  const receiptPath = eventPath("tom", tomRequest.requestId, QA_UIDS);
  for (const path of [
    actorPath("tom", QA_UIDS),
    answerPath("tom", QA_UIDS),
    receiptPath,
  ]) {
    const saved = mockClone(mockDocs.get(path));
    seed(path, { ...saved, softwareQA: false });
    if (path === receiptPath) {
      await rejectsWithoutWrites(() => saveAs("tom", tomRequest, QA_UIDS));
    } else {
      await rejectsWithoutWrites(() => readPeerFeedback(QA_UIDS, QUERY));
      await rejectsWithoutWrites(() => saveAs("tom", next, QA_UIDS));
    }
    seed(path, saved);
  }
});

test("the manifest and stored dataset hashes reject changed proposal bundles", async () => {
  seedOriginals();
  const request = requestFor();
  const changedSha = hash("replacement dataset");
  await rejectsWithoutWrites(() =>
    readPeerFeedback(UIDS, { ...QUERY, datasetSha256: changedSha }),
  );
  await rejectsWithoutWrites(() =>
    saveAs("tom", { ...request, datasetSha256: changedSha }),
  );
  const receipt = await saveAs("tom", request);
  seed(ROOT, { ...mockDocs.get(ROOT), datasetSha256: changedSha });
  for (const datasetSha256 of [QUERY.datasetSha256, changedSha]) {
    await rejectsWithoutWrites(() =>
      readPeerFeedback(UIDS, { ...QUERY, datasetSha256 }),
    );
    await rejectsWithoutWrites(() =>
      saveAs("tom", { ...request, datasetSha256 }),
    );
    await rejectsWithoutWrites(() =>
      saveAs("tom", {
        ...request,
        datasetSha256,
        revision: 1,
        requestId: IDS[1],
      }),
    );
  }
  expect(mockDocs.get(eventPath("tom", request.requestId)).answer).toEqual(
    receipt,
  );
});
