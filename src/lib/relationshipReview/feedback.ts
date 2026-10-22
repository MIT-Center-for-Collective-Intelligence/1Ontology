import { createHash } from "crypto";
import type { RelationshipFeedback } from "../../types/IRelationshipReview";
export class RelationshipError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export interface FeedbackRequest {
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  decision: "agree" | "disagree" | "discuss";
  revisitLater?: boolean;
  note: string;
  correction: string;
  revision: number;
  requestId: string;
  presentationSha256?: string;
  presentationVersion?: string;
}
export function parseFeedback(
  body: Record<string, unknown>,
  version: string,
  sha: string,
  caseIds: string[],
): FeedbackRequest {
  if (body.datasetVersion !== version || body.datasetSha256 !== sha)
    throw new RelationshipError(
      409,
      "This proposal version has changed. Reload before saving.",
    );
  if (typeof body.caseId !== "string" || !caseIds.includes(body.caseId))
    throw new RelationshipError(400, "Unknown activity.");
  if (!["agree", "disagree", "discuss"].includes(String(body.decision)))
    throw new RelationshipError(400, "Choose a response before saving.");
  if (
    typeof body.note !== "string" ||
    body.note.length > 8000 ||
    typeof body.correction !== "string" ||
    body.correction.length > 2000
  )
    throw new RelationshipError(400, "Please shorten your feedback.");
  if (
    !Number.isSafeInteger(body.revision) ||
    Number(body.revision) < 0 ||
    typeof body.requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId)
  )
    throw new RelationshipError(400, "Invalid save request.");
  const hasRevisitLater = Object.prototype.hasOwnProperty.call(
    body,
    "revisitLater",
  );
  if (hasRevisitLater && typeof body.revisitLater !== "boolean")
    throw new RelationshipError(400, "Invalid save request.");
  return {
    caseId: body.caseId,
    datasetVersion: version,
    datasetSha256: sha,
    decision: body.decision as FeedbackRequest["decision"],
    note: body.note.trim(),
    correction: body.correction.trim(),
    revision: Number(body.revision),
    requestId: body.requestId,
    ...(hasRevisitLater ? { revisitLater: body.revisitLater as boolean } : {}),
  };
}
export function feedbackHash(request: FeedbackRequest) {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}
export function nextFeedback(
  request: FeedbackRequest,
  current: RelationshipFeedback | null,
  savedAt: string,
): RelationshipFeedback {
  if ((current?.revision || 0) !== request.revision)
    throw new RelationshipError(
      409,
      "A newer answer was saved in another tab. Your draft is preserved.",
      "revision_conflict",
    );
  const revisitLater = request.revisitLater ?? current?.revisitLater;
  return {
    caseId: request.caseId,
    datasetVersion: request.datasetVersion,
    decision: request.decision,
    note: request.note,
    correction: request.correction,
    revision: request.revision + 1,
    savedAt,
    ...(request.presentationSha256
      ? {
          presentationSha256: request.presentationSha256,
          presentationVersion: request.presentationVersion,
        }
      : {}),
    ...(typeof revisitLater === "boolean" ? { revisitLater } : {}),
  };
}
