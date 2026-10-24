import { createHash } from "crypto";
import { RelationshipError } from "./feedback";
import { relationshipFeedbackSnapshotJson } from "../../types/IRelationshipReview";
import type {
  PeerFeedback,
  PeerFeedbackQuery,
  PeerReviewer,
  RelationshipFeedback,
  SavePeerFeedbackRequest,
} from "../../types/IRelationshipReview";

export interface PeerFeedbackRequest extends SavePeerFeedbackRequest {
  note: string;
}

const readFields = new Set(["datasetVersion", "datasetSha256", "caseId"]);
const saveFields = new Set([
  ...readFields,
  "reviewerKey",
  "targetReviewer",
  "targetRevision",
  "targetFeedbackSha256",
  "decision",
  "note",
  "revision",
  "requestId",
]);
const sha256Pattern = /^[0-9a-f]{64}$/;
// Canonical UUID layout, a defined version and the RFC variant; no path keys.
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

function requestBody(
  body: unknown,
  allowedFields: ReadonlySet<string>,
): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new RelationshipError(400, "Invalid peer feedback request.");
  const prototype = Object.getPrototypeOf(body);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.keys(body).some((key) => !allowedFields.has(key))
  )
    throw new RelationshipError(400, "Invalid peer feedback request.");
  return body as Record<string, unknown>;
}

function isDocumentId(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/^__.*__$/.test(value) &&
    ![".", "..", "__proto__", "prototype", "constructor"].includes(value)
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && sha256Pattern.test(value);
}

function isRevision(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

export function otherPeerReviewer(reviewer: PeerReviewer): PeerReviewer {
  if (reviewer === "tom") return "rob";
  if (reviewer === "rob") return "tom";
  throw new RelationshipError(400, "Unknown peer reviewer.");
}

function parseScope(
  body: Record<string, unknown>,
  version: string,
  sha: string,
  caseIds: readonly string[],
): PeerFeedbackQuery {
  if (!own(body, "datasetVersion") || !own(body, "datasetSha256"))
    throw new RelationshipError(
      400,
      "A review version and snapshot hash are required for peer feedback. Reload this review.",
    );
  if (!isDocumentId(body.datasetVersion, 200) || !isSha256(body.datasetSha256))
    throw new RelationshipError(
      400,
      "Invalid review version or snapshot hash.",
    );
  if (body.datasetVersion !== version || body.datasetSha256 !== sha)
    throw new RelationshipError(
      409,
      "This proposal version has changed. Reload before continuing.",
    );
  if (
    !own(body, "caseId") ||
    !isDocumentId(body.caseId, 256) ||
    !caseIds.includes(body.caseId)
  )
    throw new RelationshipError(400, "Unknown activity.");
  return {
    datasetVersion: body.datasetVersion,
    datasetSha256: body.datasetSha256,
    caseId: body.caseId,
  };
}

export function parsePeerFeedbackQuery(
  body: unknown,
  version: string,
  sha: string,
  caseIds: readonly string[],
): PeerFeedbackQuery {
  return parseScope(requestBody(body, readFields), version, sha, caseIds);
}

export function parsePeerFeedback(
  body: unknown,
  version: string,
  sha: string,
  caseIds: readonly string[],
  authorReviewer: PeerReviewer,
): PeerFeedbackRequest {
  const input = requestBody(body, saveFields);
  const scope = parseScope(input, version, sha, caseIds);
  const targetReviewer = input.targetReviewer;
  if (targetReviewer !== "tom" && targetReviewer !== "rob")
    throw new RelationshipError(
      400,
      "Choose Tom or Rob as the target reviewer.",
    );
  if (targetReviewer !== otherPeerReviewer(authorReviewer))
    throw new RelationshipError(
      400,
      "You cannot respond to your own original feedback.",
    );
  if (input.decision !== "agree" && input.decision !== "disagree")
    throw new RelationshipError(400, "Choose agree or disagree before saving.");
  if (!isSha256(input.reviewerKey))
    throw new RelationshipError(
      400,
      "Invalid reviewer key. Reload this review.",
    );
  if (!isSha256(input.targetFeedbackSha256))
    throw new RelationshipError(400, "Invalid original feedback hash.");
  if (
    !isRevision(input.revision, 0, Number.MAX_SAFE_INTEGER - 1) ||
    !isRevision(input.targetRevision, 1, Number.MAX_SAFE_INTEGER) ||
    typeof input.requestId !== "string" ||
    !uuidPattern.test(input.requestId)
  )
    throw new RelationshipError(400, "Invalid peer save request.");
  let note = "";
  if (own(input, "note")) {
    if (typeof input.note !== "string" || input.note.length > 8000)
      throw new RelationshipError(
        400,
        "Please shorten your peer feedback note.",
      );
    // Preserve the exact note so a changed payload cannot reuse a receipt.
    note = input.note;
  }
  return {
    ...scope,
    reviewerKey: input.reviewerKey,
    targetReviewer,
    targetRevision: input.targetRevision,
    targetFeedbackSha256: input.targetFeedbackSha256,
    decision: input.decision,
    note,
    revision: input.revision,
    requestId: input.requestId,
  };
}

export function peerFeedbackHash(request: PeerFeedbackRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        reviewerKey: request.reviewerKey,
        datasetVersion: request.datasetVersion,
        datasetSha256: request.datasetSha256,
        caseId: request.caseId,
        targetReviewer: request.targetReviewer,
        targetRevision: request.targetRevision,
        targetFeedbackSha256: request.targetFeedbackSha256,
        decision: request.decision,
        note: request.note,
        revision: request.revision,
        requestId: request.requestId,
      }),
    )
    .digest("hex");
}

export function targetFeedbackHash(feedback: RelationshipFeedback): string {
  return createHash("sha256")
    .update(relationshipFeedbackSnapshotJson(feedback))
    .digest("hex");
}

export function snapshotTargetFeedback(
  feedback: RelationshipFeedback | null,
  scope: Pick<PeerFeedbackQuery, "caseId" | "datasetVersion">,
): RelationshipFeedback {
  if (!feedback)
    throw new RelationshipError(
      409,
      "This reviewer has no saved original feedback for this activity.",
    );
  const required = [
    "caseId",
    "datasetVersion",
    "decision",
    "note",
    "correction",
    "revision",
    "savedAt",
  ];
  const prototype = Object.getPrototypeOf(feedback);
  if (
    typeof feedback !== "object" ||
    Array.isArray(feedback) ||
    (prototype !== Object.prototype && prototype !== null) ||
    !required.every((key) => own(feedback, key)) ||
    feedback.caseId !== scope.caseId ||
    feedback.datasetVersion !== scope.datasetVersion ||
    !["agree", "disagree", "discuss"].includes(feedback.decision) ||
    typeof feedback.note !== "string" ||
    typeof feedback.correction !== "string" ||
    typeof feedback.savedAt !== "string" ||
    !isRevision(feedback.revision, 1, Number.MAX_SAFE_INTEGER) ||
    (own(feedback, "revisitLater") &&
      feedback.revisitLater !== undefined &&
      typeof feedback.revisitLater !== "boolean") ||
    (own(feedback, "presentationSha256") &&
      feedback.presentationSha256 !== undefined &&
      typeof feedback.presentationSha256 !== "string") ||
    (own(feedback, "presentationVersion") &&
      feedback.presentationVersion !== undefined &&
      typeof feedback.presentationVersion !== "string")
  )
    throw new RelationshipError(
      409,
      "The saved original feedback does not match this activity and review version.",
    );
  // Copy all RelationshipFeedback fields without changing any original record.
  return JSON.parse(
    relationshipFeedbackSnapshotJson(feedback),
  ) as RelationshipFeedback;
}

export function nextPeerFeedback(
  request: PeerFeedbackRequest,
  current: PeerFeedback | null,
  target: RelationshipFeedback | null,
  authorReviewer: PeerReviewer,
  savedAt: string,
): PeerFeedback {
  if (request.targetReviewer !== otherPeerReviewer(authorReviewer))
    throw new RelationshipError(
      400,
      "You cannot respond to your own original feedback.",
    );
  const snapshot = snapshotTargetFeedback(target, request);
  const targetSha256 = targetFeedbackHash(snapshot);
  if (
    snapshot.revision !== request.targetRevision ||
    targetSha256 !== request.targetFeedbackSha256
  )
    throw new RelationshipError(
      409,
      "This original feedback changed. Reload it before responding.",
      "revision_conflict",
    );
  if (
    current &&
    (current.caseId !== request.caseId ||
      current.datasetVersion !== request.datasetVersion ||
      current.authorReviewer !== authorReviewer ||
      current.targetReviewer !== request.targetReviewer)
  )
    throw new RelationshipError(
      409,
      "The saved peer response belongs to another reviewer or review.",
      "account_changed",
    );
  if ((current?.revision ?? 0) !== request.revision)
    throw new RelationshipError(
      409,
      "A newer peer response was saved in another tab. Your draft is preserved.",
      "revision_conflict",
    );
  return {
    caseId: request.caseId,
    datasetVersion: request.datasetVersion,
    targetReviewer: request.targetReviewer,
    authorReviewer,
    decision: request.decision,
    note: request.note,
    revision: request.revision + 1,
    savedAt,
    targetRevision: snapshot.revision,
    targetFeedbackSha256: targetSha256,
    targetFeedback: snapshot,
  };
}
