import { getIdToken } from "../firestoreClient/auth";
import { relationshipFeedbackSnapshotJson } from "../../types/IRelationshipReview";
import type {
  PeerFeedback,
  PeerFeedbackQuery,
  PeerFeedbackResponse,
  RelationshipFeedback,
  SavePeerFeedbackRequest,
} from "../../types/IRelationshipReview";

const readActions = new Set([
  "session",
  "trace",
  "evidence",
  "context",
  "tom-feedback",
  "peer-feedback",
  "branch-session",
  "branch-trace",
  "branch-context",
  "branch-peer-feedback",
]);
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
const retryMessage =
  "The review service is temporarily unavailable. Keep this tab open and retry; your draft is retained.";

/** A hosting/proxy failure can return text or HTML before our JSON API runs.
 * Read-only requests may be repeated once. Saves keep their existing explicit,
 * idempotent retry workflow because a lost receipt can follow a successful save. */
export async function relationshipRequest(
  action: string,
  body: unknown = {},
  preview = false,
): Promise<any> {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!preview) headers.Authorization = "Bearer " + (await getIdToken());
  const attempts = readActions.has(action) ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let status = 0;
    let retryable = true;
    try {
      const response = await fetch("/api/som-review/relationships/" + action, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: payload,
        signal: controller.signal,
      });
      status = response.status;
      retryable = transientStatuses.has(status);
      let data;
      try {
        data = await response.json();
      } catch {
        // Never render a raw upstream response or a JSON parser exception.
        retryable = response.ok || retryable;
        throw Error(retryMessage);
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        retryable = response.ok || retryable;
        throw Error(retryMessage);
      }
      if (!response.ok)
        throw Object.assign(
          Error(typeof data.error === "string" ? data.error : retryMessage),
          { code: typeof data.code === "string" ? data.code : undefined },
        );
      return data;
    } catch (error: any) {
      if (retryable && attempt + 1 < attempts) {
        clearTimeout(timeout);
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw Object.assign(
        Error(
          status && error.name !== "AbortError" ? error.message : retryMessage,
        ),
        {
          status: status >= 400 ? status : status ? 502 : 503,
          ...(error.code ? { code: error.code } : {}),
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw Error(retryMessage);
}

export function readRelationshipPeerFeedback(
  request: PeerFeedbackQuery,
  preview = false,
): Promise<PeerFeedbackResponse> {
  return relationshipRequest("peer-feedback", request, preview);
}

/** Keep requestId, revision and target binding unchanged for an explicit retry.
 * A changed target requires a deliberate new request, not automatic carry-over. */
export function saveRelationshipPeerFeedback(
  request: SavePeerFeedbackRequest,
  preview = false,
): Promise<{ answer: PeerFeedback }> {
  return relationshipRequest("save-peer", request, preview);
}

export async function relationshipTargetFeedbackSha256(
  feedback: RelationshipFeedback,
): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw Error(
      "This browser cannot verify saved feedback. Use a current browser on the review site.",
    );
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(relationshipFeedbackSnapshotJson(feedback)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Compare the saved response with the current row.feedback, not its snapshot.
 * This only reports staleness; it never changes or resaves a response. */
export async function isRelationshipPeerFeedbackStale(
  response: PeerFeedback | null,
  target: RelationshipFeedback | null,
): Promise<boolean> {
  if (!response) return false;
  if (
    !target ||
    response.caseId !== target.caseId ||
    response.datasetVersion !== target.datasetVersion ||
    response.targetRevision !== target.revision
  )
    return true;
  return (
    response.targetFeedbackSha256 !==
    (await relationshipTargetFeedbackSha256(target))
  );
}
