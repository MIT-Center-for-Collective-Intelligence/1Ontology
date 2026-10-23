/** @jest-environment node */
import { createHash } from "crypto";
import { RelationshipError } from "../../../src/lib/relationshipReview/feedback";
import {
  nextPeerFeedback,
  otherPeerReviewer,
  parsePeerFeedback,
  parsePeerFeedbackQuery,
  peerFeedbackHash,
  snapshotTargetFeedback,
  targetFeedbackHash,
} from "../../../src/lib/relationshipReview/peerFeedback";
import type { PeerFeedbackRequest } from "../../../src/lib/relationshipReview/peerFeedback";
import type {
  PeerFeedback,
  PeerReviewer,
  RelationshipFeedback,
} from "../../../src/types/IRelationshipReview";

const VERSION = "peer-v1",
  DATASET_SHA = "a".repeat(64),
  CASE_ID = "peer-case";
const CASE_IDS = [CASE_ID];
const REQUEST_ID = "53f33252-9fdb-4d73-8d66-1308ea309b11";
const NEXT_REQUEST_ID = "7e8d62ec-e069-42c3-a132-dd7c7211cc40";
const SOURCE_TIME = "2026-06-01T00:00:00.000Z";
const SAVE_TIME = "2026-06-01T01:00:00.000Z";
const LATER_TIME = "2026-06-01T02:00:00.000Z";

function scope() {
  return {
    datasetVersion: VERSION,
    datasetSha256: DATASET_SHA,
    caseId: CASE_ID,
  };
}
function source(): RelationshipFeedback {
  return {
    caseId: CASE_ID,
    datasetVersion: VERSION,
    decision: "discuss",
    note: "Mock original note",
    correction: "Mock original correction",
    revision: 3,
    savedAt: SOURCE_TIME,
    revisitLater: false,
    presentationSha256: "c".repeat(64),
    presentationVersion: "mock-p1",
  };
}
function request(
  patch: Partial<PeerFeedbackRequest> = {},
): PeerFeedbackRequest {
  return {
    ...scope(),
    reviewerKey: "b".repeat(64),
    targetReviewer: "tom",
    targetRevision: 3,
    targetFeedbackSha256: targetFeedbackHash(source()),
    decision: "agree",
    note: "  peer note\r\n  ",
    revision: 0,
    requestId: REQUEST_ID,
    ...patch,
  };
}
function parse(body: unknown, author: PeerReviewer = "rob") {
  return parsePeerFeedback(body, VERSION, DATASET_SHA, CASE_IDS, author);
}
function rejects(run: () => unknown, status: number, code?: string) {
  let error: unknown;
  try {
    run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(RelationshipError);
  expect(error).toMatchObject({ status, ...(code ? { code } : {}) });
}

test("fresh scoped saves accept both peers, copy inputs, and preserve exact notes", () => {
  const input = Object.freeze(request());
  const parsed = parse(input);
  expect(parsed).toEqual(input);
  expect(parsed).not.toBe(input);
  expect(parse(request({ targetReviewer: "rob" }), "tom").targetReviewer).toBe(
    "rob",
  );
  expect(
    parsePeerFeedbackQuery(
      Object.freeze(scope()),
      VERSION,
      DATASET_SHA,
      CASE_IDS,
    ),
  ).toEqual(scope());
  expect(parse(Object.assign(Object.create(null), input))).toEqual(input);
  expect(
    parsePeerFeedbackQuery(
      Object.assign(Object.create(null), scope()),
      VERSION,
      DATASET_SHA,
      CASE_IDS,
    ),
  ).toEqual(scope());
  const withoutNote: Partial<PeerFeedbackRequest> = { ...input };
  delete withoutNote.note;
  expect(parse(withoutNote).note).toBe("");
  expect(parse(request({ note: "x".repeat(8000) })).note).toHaveLength(8000);
});

test.each(["tom", "rob"] as const)(
  "%s cannot respond to their own original feedback",
  (author) => {
    const input = request({ targetReviewer: author });
    rejects(() => parse(input, author), 400);
    rejects(
      () => nextPeerFeedback(input, null, source(), author, SAVE_TIME),
      400,
    );
  },
);

test("peer identities are exact, not arbitrary caller-supplied roles", () => {
  expect(otherPeerReviewer("tom")).toBe("rob");
  expect(otherPeerReviewer("rob")).toBe("tom");
  rejects(() => otherPeerReviewer("Tom" as PeerReviewer), 400);
  rejects(() => parse(request(), "coordinator" as PeerReviewer), 400);
});

test.each([
  ["unknown case", { caseId: "missing" }, 400],
  ["path case", { caseId: "../other" }, 400],
  ["reserved case", { caseId: "__proto__" }, 400],
  ["other version", { datasetVersion: "peer-v2" }, 409],
  ["path version", { datasetVersion: "../peer-v1" }, 400],
  ["other snapshot", { datasetSha256: "d".repeat(64) }, 409],
  ["short SHA", { datasetSha256: "sha" }, 400],
  ["nonhex SHA", { datasetSha256: "g".repeat(64) }, 400],
  ["uppercase SHA", { datasetSha256: "A".repeat(64) }, 400],
] as Array<[string, Record<string, unknown>, number]>)(
  "%s is rejected for reads and saves",
  (_label, patch, status) => {
    rejects(
      () =>
        parsePeerFeedbackQuery(
          { ...scope(), ...patch },
          VERSION,
          DATASET_SHA,
          CASE_IDS,
        ),
      status,
    );
    rejects(() => parse({ ...request(), ...patch }), status);
  },
);

test("scope fields must be owned properties on a plain request object", () => {
  for (const body of [
    null,
    [],
    "body",
    {},
    { datasetVersion: VERSION },
    { datasetSha256: DATASET_SHA },
    { ...scope(), datasetVersion: undefined },
    { ...scope(), datasetSha256: undefined },
    Object.create(scope()),
  ]) {
    rejects(
      () => parsePeerFeedbackQuery(body, VERSION, DATASET_SHA, CASE_IDS),
      400,
    );
    rejects(() => parse(body), 400);
  }
  rejects(
    () =>
      parse(Object.assign(Object.create({ authorReviewer: "tom" }), request())),
    400,
  );
  rejects(
    () => parsePeerFeedbackQuery(request(), VERSION, DATASET_SHA, CASE_IDS),
    400,
  );
});

test.each([
  "uid",
  "email",
  "authorReviewer",
  "targetUid",
  "targetEmail",
  "targetFeedback",
  "savedAt",
  "presentationSha256",
  "__proto__",
  "constructor",
])(
  "rejects injected %s instead of trusting identity, snapshots or storage fields",
  (field) => {
    rejects(() => parse({ ...request(), [field]: "injected" }), 400);
    rejects(
      () =>
        parsePeerFeedbackQuery(
          { ...scope(), [field]: "injected" },
          VERSION,
          DATASET_SHA,
          CASE_IDS,
        ),
      400,
    );
  },
);

test.each([
  ["targetReviewer", "coordinator"],
  ["decision", "discuss"],
  ["reviewerKey", "old-reviewer"],
  ["reviewerKey", "B".repeat(64)],
  ["targetFeedbackSha256", "g".repeat(64)],
  ["revision", -1],
  ["revision", 0.5],
  ["revision", NaN],
  ["revision", Number.MAX_SAFE_INTEGER],
  ["targetRevision", 0],
  ["targetRevision", Number.MAX_SAFE_INTEGER + 1],
  ["requestId", "0123456789abcdef"],
  ["requestId", "00000000-0000-0000-8000-000000000000"],
  ["requestId", "00000000-0000-4000-7000-000000000000"],
  ["note", null],
  ["note", "x".repeat(8001)],
] as Array<[string, unknown]>)(
  "rejects invalid save field %s (%#)",
  (field, value) => {
    rejects(() => parse({ ...request(), [field]: value }), 400);
  },
);

test("peer hashes ignore insertion order but bind every payload field, including whitespace", () => {
  const input = Object.freeze(request());
  const hash = peerFeedbackHash(input);
  const reversed = Object.fromEntries(
    Object.entries(input).reverse(),
  ) as unknown as PeerFeedbackRequest;
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  expect(peerFeedbackHash(reversed)).toBe(hash);
  const changes: Partial<PeerFeedbackRequest>[] = [
    { reviewerKey: "e".repeat(64) },
    { datasetVersion: "peer-v2" },
    { datasetSha256: "d".repeat(64) },
    { caseId: "other" },
    { targetReviewer: "rob" },
    { targetRevision: 4 },
    { targetFeedbackSha256: "f".repeat(64) },
    { decision: "disagree" },
    { note: input.note + " " },
    { revision: 1 },
    { requestId: NEXT_REQUEST_ID },
  ];
  for (const change of changes)
    expect(peerFeedbackHash({ ...input, ...change })).not.toBe(hash);
});

test("original snapshots have canonical bytes and retain all source fields without storage metadata", () => {
  const target = Object.freeze(source());
  const expectedBytes = JSON.stringify({
    caseId: CASE_ID,
    correction: "Mock original correction",
    datasetVersion: VERSION,
    decision: "discuss",
    note: "Mock original note",
    presentationSha256: "c".repeat(64),
    presentationVersion: "mock-p1",
    revision: 3,
    revisitLater: false,
    savedAt: SOURCE_TIME,
  });
  const hash = targetFeedbackHash(target);
  expect(hash).toBe(createHash("sha256").update(expectedBytes).digest("hex"));
  const reversed = Object.fromEntries(
    Object.entries(target).reverse(),
  ) as unknown as RelationshipFeedback;
  expect(targetFeedbackHash(reversed)).toBe(hash);
  const stored = Object.freeze({
    ...target,
    uid: "storage-only",
    eventSha256: "f".repeat(64),
  });
  const snapshot = snapshotTargetFeedback(stored, scope());
  expect(snapshot).toEqual(target);
  expect(snapshot).not.toBe(stored);
  expect(targetFeedbackHash(stored)).toBe(hash);
  expect(stored.eventSha256).toBe("f".repeat(64));
  expect(
    snapshotTargetFeedback(Object.assign(Object.create(null), target), scope()),
  ).toEqual(target);
  const changes: Partial<RelationshipFeedback>[] = [
    { caseId: "other" },
    { datasetVersion: "peer-v2" },
    { decision: "agree" },
    { note: "changed" },
    { correction: "changed" },
    { revision: 4 },
    { savedAt: SAVE_TIME },
    { revisitLater: true },
    { presentationSha256: "d".repeat(64) },
    { presentationVersion: "mock-p2" },
  ];
  for (const change of changes)
    expect(targetFeedbackHash({ ...target, ...change })).not.toBe(hash);
  const withoutRevisit = { ...target };
  delete withoutRevisit.revisitLater;
  expect(targetFeedbackHash(withoutRevisit)).not.toBe(hash);
});

test("missing, foreign, inherited or malformed original feedback cannot become a target snapshot", () => {
  const missing: Partial<RelationshipFeedback> = { ...source() };
  delete missing.savedAt;
  const malformed: unknown[] = [
    null,
    [],
    missing,
    Object.create(source()),
    { ...source(), caseId: "other" },
    { ...source(), datasetVersion: "peer-v2" },
    { ...source(), decision: "unknown" },
    { ...source(), revision: 0 },
    { ...source(), revision: 1.5 },
    { ...source(), note: null },
    { ...source(), correction: [] },
    { ...source(), savedAt: 42 },
    { ...source(), revisitLater: "false" },
    { ...source(), presentationSha256: 42 },
    { ...source(), presentationVersion: false },
  ];
  for (const target of malformed) {
    rejects(
      () =>
        snapshotTargetFeedback(target as RelationshipFeedback | null, scope()),
      409,
    );
  }
});

test("next response binds the full target snapshot, revision and hash without mutating either record", () => {
  const input = Object.freeze(request());
  const target = Object.freeze(source());
  const first = nextPeerFeedback(input, null, target, "rob", SAVE_TIME);
  expect(first).toEqual({
    caseId: CASE_ID,
    datasetVersion: VERSION,
    targetReviewer: "tom",
    authorReviewer: "rob",
    decision: "agree",
    note: input.note,
    revision: 1,
    savedAt: SAVE_TIME,
    targetRevision: 3,
    targetFeedbackSha256: targetFeedbackHash(target),
    targetFeedback: target,
  });
  expect(first.targetFeedback).not.toBe(target);
  const current = Object.freeze({
    ...first,
    targetFeedback: Object.freeze({ ...first.targetFeedback }),
  });
  const next = nextPeerFeedback(
    Object.freeze({
      ...input,
      revision: 1,
      requestId: NEXT_REQUEST_ID,
      note: "second peer note",
    }),
    current,
    target,
    "rob",
    LATER_TIME,
  );
  expect(next).toMatchObject({
    revision: 2,
    savedAt: LATER_TIME,
    note: "second peer note",
    targetRevision: 3,
  });
  expect(next.targetFeedback).toEqual(target);
  expect(next.targetFeedback).not.toBe(current.targetFeedback);
  next.targetFeedback.note = "snapshot-only edit";
  expect(target.note).toBe("Mock original note");
  expect(current.targetFeedback.note).toBe("Mock original note");
  expect(current.note).toBe(input.note);
  expect(input.revision).toBe(0);
});

test("stale other-tab peer revisions and changed original revisions or hashes are conflicts", () => {
  const input = Object.freeze(request()),
    target = Object.freeze(source());
  const current = Object.freeze(
    nextPeerFeedback(input, null, target, "rob", SAVE_TIME),
  );
  const before = JSON.stringify({ input, target, current });
  rejects(
    () => nextPeerFeedback(input, current, target, "rob", LATER_TIME),
    409,
    "revision_conflict",
  );
  rejects(
    () =>
      nextPeerFeedback(
        { ...input, revision: 1 },
        null,
        target,
        "rob",
        LATER_TIME,
      ),
    409,
    "revision_conflict",
  );
  const revisedTarget = { ...target, revision: 4 };
  rejects(
    () =>
      nextPeerFeedback(
        { ...input, targetFeedbackSha256: targetFeedbackHash(revisedTarget) },
        null,
        revisedTarget,
        "rob",
        LATER_TIME,
      ),
    409,
    "revision_conflict",
  );
  for (const change of [
    { note: "edited in another tab" },
    { revisitLater: true },
    { presentationVersion: "mock-p2" },
  ]) {
    rejects(
      () =>
        nextPeerFeedback(
          input,
          null,
          { ...target, ...change },
          "rob",
          LATER_TIME,
        ),
      409,
      "revision_conflict",
    );
  }
  rejects(
    () =>
      nextPeerFeedback(
        { ...input, targetFeedbackSha256: "e".repeat(64) },
        null,
        target,
        "rob",
        LATER_TIME,
      ),
    409,
    "revision_conflict",
  );
  expect(JSON.stringify({ input, target, current })).toBe(before);
});

test("an existing response cannot be reused across cases, versions, authors or targets", () => {
  const input = request(),
    target = source();
  const current = Object.freeze(
    nextPeerFeedback(input, null, target, "rob", SAVE_TIME),
  );
  const before = JSON.stringify(current);
  const changes: Partial<PeerFeedback>[] = [
    { caseId: "other" },
    { datasetVersion: "peer-v2" },
    { authorReviewer: "tom" },
    { targetReviewer: "rob" },
  ];
  for (const change of changes) {
    rejects(
      () =>
        nextPeerFeedback(
          { ...input, revision: 1 },
          { ...current, ...change },
          target,
          "rob",
          LATER_TIME,
        ),
      409,
      "account_changed",
    );
  }
  expect(JSON.stringify(current)).toBe(before);
});
