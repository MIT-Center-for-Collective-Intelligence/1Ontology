import { createHash } from "crypto";
import { RelationshipError } from "./feedback";
import { RELATIONSHIP_COLLECTION } from "./repository";
import {
  nextPeerFeedback,
  parsePeerFeedback,
  parsePeerFeedbackQuery,
  peerFeedbackHash,
  snapshotTargetFeedback,
  targetFeedbackHash,
} from "./peerFeedback";
import type {
  PeerFeedback,
  PeerFeedbackQuery,
  PeerFeedbackResponse,
  PeerReviewer,
  RelationshipFeedback,
  SavePeerFeedbackRequest,
} from "../../types/IRelationshipReview";

export interface PeerReviewerUids {
  tom: string;
  rob: string;
}
interface PeerBinding {
  reviewerKey: string;
  authorReviewer: PeerReviewer;
  targetReviewer: PeerReviewer;
  targetReviewerKey: string;
  softwareQA: boolean;
}
interface Snapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
const actorId = (uid: string) => createHash("sha256").update(uid).digest("hex");
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

function uidPair(authorUid: string, targetUid: string): boolean {
  if (
    typeof authorUid !== "string" ||
    !authorUid ||
    authorUid.length > 128 ||
    typeof targetUid !== "string" ||
    !targetUid ||
    targetUid.length > 128
  )
    throw new RelationshipError(400, "Invalid reviewer account.");
  if (authorUid === targetUid)
    throw new RelationshipError(
      400,
      "You cannot respond to your own original feedback.",
    );
  const softwareQA = authorUid.startsWith("software-qa:");
  if (softwareQA !== targetUid.startsWith("software-qa:"))
    throw new RelationshipError(
      403,
      "Use separate software QA identities for both reviewers.",
    );
  return softwareQA;
}

function binding(
  uid: string,
  reviewer: PeerReviewer,
  targetUid: string,
  targetReviewer: PeerReviewer,
): PeerBinding {
  const softwareQA = uidPair(uid, targetUid);
  return {
    reviewerKey: actorId(uid),
    authorReviewer: reviewer,
    targetReviewer,
    targetReviewerKey: actorId(targetUid),
    softwareQA,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new RelationshipError(
      409,
      "Saved peer feedback is unavailable. Reload this review.",
    );
  return value as Record<string, unknown>;
}

function checkBinding(value: Record<string, unknown>, expected: PeerBinding) {
  if (
    Object.entries(expected).some(
      ([key, field]) => !own(value, key) || value[key] !== field,
    )
  )
    throw new RelationshipError(
      409,
      "The peer reviewer account changed. Existing responses are preserved.",
      "account_changed",
    );
}

function checkManifest(manifest: Snapshot, sha: string) {
  if (manifest.exists && manifest.data()?.datasetSha256 !== sha)
    throw new RelationshipError(
      409,
      "This proposal set changed without a new version. Existing feedback is preserved; the review needs a corrected release.",
    );
}

function boundRecord(
  snapshot: Snapshot,
  expected: PeerBinding,
): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  const value = record(snapshot.data());
  checkBinding(value, expected);
  return value;
}

function readOriginal(
  snapshot: Snapshot,
  query: PeerFeedbackQuery,
): RelationshipFeedback | null {
  if (!snapshot.exists) return null;
  // Original review documents predate peer feedback and do not store a bundle
  // hash. The enclosing dataset manifest is checked in the same transaction.
  return snapshotTargetFeedback(
    record(snapshot.data()) as unknown as RelationshipFeedback,
    query,
  );
}

function decodePeerFeedback(
  value: unknown,
  query: PeerFeedbackQuery,
  expected: PeerBinding,
): PeerFeedback {
  const data = record(value);
  const required = [
    "caseId",
    "datasetVersion",
    "authorReviewer",
    "targetReviewer",
    "decision",
    "note",
    "revision",
    "savedAt",
    "targetRevision",
    "targetFeedbackSha256",
    "targetFeedback",
  ];
  if (
    !required.every((key) => own(data, key)) ||
    data.caseId !== query.caseId ||
    data.datasetVersion !== query.datasetVersion ||
    data.authorReviewer !== expected.authorReviewer ||
    data.targetReviewer !== expected.targetReviewer ||
    (data.decision !== "agree" && data.decision !== "disagree") ||
    typeof data.note !== "string" ||
    data.note.length > 8000 ||
    typeof data.revision !== "number" ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    typeof data.savedAt !== "string"
  )
    throw new RelationshipError(
      409,
      "Saved peer feedback is unavailable. Reload this review.",
    );

  const target = snapshotTargetFeedback(
    data.targetFeedback as RelationshipFeedback | null,
    query,
  );
  const targetSha256 = targetFeedbackHash(target);
  if (
    data.targetRevision !== target.revision ||
    data.targetFeedbackSha256 !== targetSha256
  )
    throw new RelationshipError(
      409,
      "The saved peer response has an invalid original feedback snapshot.",
    );

  return {
    caseId: query.caseId,
    datasetVersion: query.datasetVersion,
    authorReviewer: expected.authorReviewer,
    targetReviewer: expected.targetReviewer,
    decision: data.decision,
    note: data.note,
    revision: data.revision,
    savedAt: data.savedAt,
    targetRevision: target.revision,
    targetFeedbackSha256: targetSha256,
    targetFeedback: target,
  };
}

function readPeerAnswer(
  actor: Snapshot,
  answer: Snapshot,
  query: PeerFeedbackQuery,
  expected: PeerBinding,
): PeerFeedback | null {
  const metadata = boundRecord(actor, expected);
  const value = boundRecord(answer, expected);
  if (!value) return null;
  if (!metadata)
    throw new RelationshipError(
      409,
      "Peer reviewer metadata is missing.",
      "account_changed",
    );
  checkManifest(answer, query.datasetSha256);
  return decodePeerFeedback(value, query, expected);
}

export async function readPeerFeedback(
  reviewers: PeerReviewerUids,
  query: PeerFeedbackQuery,
): Promise<PeerFeedbackResponse> {
  if (!query || typeof query !== "object")
    throw new RelationshipError(400, "Invalid peer feedback request.");
  const scope = parsePeerFeedbackQuery(
    query,
    query.datasetVersion,
    query.datasetSha256,
    [query.caseId],
  );
  if (!reviewers || typeof reviewers !== "object")
    throw new RelationshipError(400, "Invalid reviewer account.");
  const tom = binding(reviewers.tom, "tom", reviewers.rob, "rob");
  const rob = binding(reviewers.rob, "rob", reviewers.tom, "tom");
  const { db } = await import("../firestoreServer/admin");
  const version = db
    .collection(RELATIONSHIP_COLLECTION)
    .doc(scope.datasetVersion);
  const tomPeer = version.collection("peerReviewers").doc(tom.reviewerKey);
  const robPeer = version.collection("peerReviewers").doc(rob.reviewerKey);

  return db.runTransaction(async (tx) => {
    const [
      manifest,
      tomOriginal,
      robOriginal,
      tomActor,
      robActor,
      tomAnswer,
      robAnswer,
    ] = await Promise.all([
      tx.get(version),
      tx.get(
        version
          .collection("reviewers")
          .doc(tom.reviewerKey)
          .collection("answers")
          .doc(scope.caseId),
      ),
      tx.get(
        version
          .collection("reviewers")
          .doc(rob.reviewerKey)
          .collection("answers")
          .doc(scope.caseId),
      ),
      tx.get(tomPeer),
      tx.get(robPeer),
      tx.get(tomPeer.collection("answers").doc(scope.caseId)),
      tx.get(robPeer.collection("answers").doc(scope.caseId)),
    ]);
    checkManifest(manifest, scope.datasetSha256);
    const tomFeedback = readOriginal(tomOriginal, scope);
    const robFeedback = readOriginal(robOriginal, scope);
    const tomResponse = readPeerAnswer(tomActor, tomAnswer, scope, tom);
    const robResponse = readPeerAnswer(robActor, robAnswer, scope, rob);
    const rows = [
      {
        reviewer: "tom" as const,
        label: "Tom" as const,
        feedback: tomFeedback,
        feedbackSha256: tomFeedback ? targetFeedbackHash(tomFeedback) : null,
        response: robResponse,
      },
      {
        reviewer: "rob" as const,
        label: "Rob" as const,
        feedback: robFeedback,
        feedbackSha256: robFeedback ? targetFeedbackHash(robFeedback) : null,
        response: tomResponse,
      },
    ];
    return { ...scope, reviewers: rows };
  });
}

export async function savePeerFeedback(
  uid: string,
  authorReviewer: PeerReviewer,
  targetUid: string,
  request: SavePeerFeedbackRequest,
): Promise<PeerFeedback> {
  if (!request || typeof request !== "object")
    throw new RelationshipError(400, "Invalid peer feedback request.");
  const input = parsePeerFeedback(
    request,
    request.datasetVersion,
    request.datasetSha256,
    [request.caseId],
    authorReviewer,
  );
  const expected = binding(
    uid,
    authorReviewer,
    targetUid,
    input.targetReviewer,
  );
  if (input.reviewerKey !== expected.reviewerKey)
    throw new RelationshipError(
      409,
      "Your signed-in account changed. Reload this review before saving.",
      "account_changed",
    );
  const requestSha256 = peerFeedbackHash(input);
  const { db } = await import("../firestoreServer/admin");
  const version = db
    .collection(RELATIONSHIP_COLLECTION)
    .doc(input.datasetVersion);
  const actor = version.collection("peerReviewers").doc(expected.reviewerKey);
  const answerRef = actor.collection("answers").doc(input.caseId);
  const eventRef = actor.collection("events").doc(input.requestId);
  const targetRef = version
    .collection("reviewers")
    .doc(expected.targetReviewerKey)
    .collection("answers")
    .doc(input.caseId);

  return db.runTransaction(async (tx) => {
    const [manifest, actorSnapshot, eventSnapshot] = await Promise.all([
      tx.get(version),
      tx.get(actor),
      tx.get(eventRef),
    ]);
    checkManifest(manifest, input.datasetSha256);
    const metadata = boundRecord(actorSnapshot, expected);
    const event = boundRecord(eventSnapshot, expected);

    // A committed receipt wins over later changes to the live target or answer.
    if (event) {
      checkManifest(eventSnapshot, input.datasetSha256);
      if (
        event.requestId !== input.requestId ||
        event.requestSha256 !== requestSha256 ||
        event.caseId !== input.caseId ||
        event.datasetVersion !== input.datasetVersion
      )
        throw new RelationshipError(
          409,
          "This request ID was already used for different peer feedback.",
        );
      if (!metadata)
        throw new RelationshipError(
          409,
          "Peer reviewer metadata is missing.",
          "account_changed",
        );
      const previous = decodePeerFeedback(event.answer, input, expected);
      if (
        previous.revision !== input.revision + 1 ||
        previous.targetRevision !== input.targetRevision ||
        previous.targetFeedbackSha256 !== input.targetFeedbackSha256 ||
        previous.decision !== input.decision ||
        previous.note !== input.note
      )
        throw new RelationshipError(
          409,
          "The saved peer receipt does not match this request.",
        );
      return previous;
    }

    const [targetSnapshot, answerSnapshot] = await Promise.all([
      tx.get(targetRef),
      tx.get(answerRef),
    ]);
    const target = readOriginal(targetSnapshot, input);
    const current = readPeerAnswer(
      actorSnapshot,
      answerSnapshot,
      input,
      expected,
    );
    const answer = nextPeerFeedback(
      input,
      current,
      target,
      authorReviewer,
      new Date().toISOString(),
    );

    tx.create(eventRef, {
      ...expected,
      caseId: input.caseId,
      datasetVersion: input.datasetVersion,
      datasetSha256: input.datasetSha256,
      requestId: input.requestId,
      requestSha256,
      answer,
    });
    tx.set(actor, { ...expected, updatedAt: answer.savedAt }, { merge: true });
    tx.set(answerRef, {
      ...expected,
      ...answer,
      datasetSha256: input.datasetSha256,
    });
    return answer;
  });
}
