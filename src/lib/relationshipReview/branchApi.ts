import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { GENERALIZATION_BRANCH_VERSION } from "../../types/IBranchReview";
import type {
  BranchAction,
  BranchSession,
  BranchTraceResponse,
} from "../../types/IBranchReview";
import type { PeerReviewer } from "../../types/IRelationshipReview";
import type { PeerReviewerUids } from "./peerRepository";
import { parseFeedback, RelationshipError } from "./feedback";
import { readFeedback, saveFeedback } from "./repository";
import { parsePeerFeedback, parsePeerFeedbackQuery } from "./peerFeedback";
import { readPeerFeedback, savePeerFeedback } from "./peerRepository";

const actions = new Set<string>([
  "branch-session",
  "branch-save",
  "branch-trace",
  "branch-context",
  "branch-peer-feedback",
  "branch-save-peer",
]);
const sha256Pattern = /^[0-9a-f]{64}$/;
const own = (body: object, key: string) =>
  Object.prototype.hasOwnProperty.call(body, key);

export function isBranchAction(action: string): action is BranchAction {
  return actions.has(action);
}

export interface BranchAuthenticatedContext {
  uid: string;
  label: string;
  preview: boolean;
  peerReviewer: PeerReviewer | null;
  canViewPeerFeedback: boolean;
  activePeerReviewerUids(): Promise<PeerReviewerUids>;
  checkPeerAccount(
    uid: string,
    reviewer: PeerReviewer | null,
    reviewers: PeerReviewerUids,
  ): void;
}

function branchRequest(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new RelationshipError(400, "Invalid family review request.");
  const prototype = Object.getPrototypeOf(body);
  if (prototype !== Object.prototype && prototype !== null)
    throw new RelationshipError(400, "Invalid family review request.");
  return body as Record<string, unknown>;
}

/** Server dispatch only; authentication, origin checks and no-store are owned by api.ts. */
export async function branchReviewHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  action: BranchAction,
  authenticated: BranchAuthenticatedContext,
) {
  const { uid, label, preview, peerReviewer, canViewPeerFeedback } = authenticated;
  const peerAction =
    action === "branch-peer-feedback" || action === "branch-save-peer";
  if (peerAction && preview)
    throw new RelationshipError(
      403,
      "Peer feedback is unavailable in local preview. Sign in on the review site.",
    );
  if (peerAction && !canViewPeerFeedback)
    throw new RelationshipError(403, "Peer feedback is unavailable for this account.");
  if (action === "branch-save-peer" && peerReviewer === null)
    throw new RelationshipError(
      403,
      "Only Tom and Rob can save peer responses. Coordinators can view them.",
    );

  const sessionAction = action === "branch-session";
  const body = branchRequest(
    sessionAction && req.body === undefined ? {} : req.body,
  );
  const hasVersion = own(body, "datasetVersion");
  const hasSha = own(body, "datasetSha256");
  if (
    (!sessionAction && (!hasVersion || !hasSha)) ||
    (hasVersion && typeof body.datasetVersion !== "string") ||
    (hasSha && typeof body.datasetSha256 !== "string")
  )
    throw new RelationshipError(
      400,
      "A family review version and snapshot hash are required. Reload this review.",
    );
  const requestedVersion = hasVersion ? (body.datasetVersion as string) : undefined;
  const expectedSha = hasSha ? (body.datasetSha256 as string) : undefined;
  if (
    requestedVersion !== undefined &&
    requestedVersion !== GENERALIZATION_BRANCH_VERSION
  )
    throw new RelationshipError(
      409,
      "This family review version is unavailable. Reload to continue.",
    );
  if (expectedSha !== undefined && !sha256Pattern.test(expectedSha))
    throw new RelationshipError(400, "Invalid family review snapshot hash.");

  // Private release files are loaded only inside the authenticated server dispatch.
  const { getBranchDataset, getBranchTrace } = await import("./branchDataset");
  const { dataset, sha256 } = getBranchDataset(requestedVersion);
  if (
    dataset.version !== GENERALIZATION_BRANCH_VERSION ||
    !sha256Pattern.test(sha256) ||
    (expectedSha !== undefined && expectedSha !== sha256)
  )
    throw new RelationshipError(
      409,
      "This family review snapshot changed. Reload before continuing.",
    );

  const reviewerKey = createHash("sha256").update(uid).digest("hex");
  if (sessionAction) {
    const session: BranchSession = {
      dataset,
      datasetSha256: sha256,
      reviewerKey,
      reviewerLabel: label,
      feedback: await readFeedback(uid, dataset.version, preview, sha256),
      preview,
      peerReviewer,
      canViewPeerFeedback,
      legacy: {
        version: dataset.priorDatasetVersion,
        sha256: dataset.priorDatasetSha256,
      },
    };
    return res.status(200).json(session);
  }

  const caseIds = dataset.families.map((family) => family.id);
  const caseId = body.caseId;
  if (!own(body, "caseId") || typeof caseId !== "string" || !caseIds.includes(caseId))
    throw new RelationshipError(400, "Unknown Generalization family.");

  switch (action) {
    case "branch-trace": {
      const response: BranchTraceResponse = {
        trace: getBranchTrace(caseId, dataset.version),
        caseId,
        datasetVersion: dataset.version,
        datasetSha256: sha256,
      };
      return res.status(200).json(response);
    }
    case "branch-context": {
      const { branchContext } = await import("./branchContext");
      // Context owns focus/pagination validation. No source paths are forwarded.
      const contextOptions = Object.fromEntries(
        ["focusId", "activityOffset", "sourceOffset", "limit"]
          .filter((key) => own(body, key))
          .map((key) => [key, body[key]]),
      );
      return res.status(200).json({
        context: branchContext(dataset, sha256, caseId, contextOptions),
      });
    }
    case "branch-save": {
      if (body.reviewerKey !== reviewerKey)
        throw new RelationshipError(
          409,
          "Your signed-in account changed. Reload this review before saving.",
          "account_changed",
        );
      const request = parseFeedback(body, dataset.version, sha256, caseIds);
      return res.status(200).json({
        answer: await saveFeedback(uid, request, preview),
      });
    }
    case "branch-peer-feedback": {
      const request = parsePeerFeedbackQuery(body, dataset.version, sha256, caseIds);
      const reviewers = await authenticated.activePeerReviewerUids();
      authenticated.checkPeerAccount(uid, peerReviewer, reviewers);
      return res.status(200).json(await readPeerFeedback(reviewers, request));
    }
    case "branch-save-peer": {
      if (peerReviewer === null)
        throw new RelationshipError(403, "Only Tom and Rob can save peer responses.");
      const request = parsePeerFeedback(
        body,
        dataset.version,
        sha256,
        caseIds,
        peerReviewer,
      );
      if (request.reviewerKey !== reviewerKey)
        throw new RelationshipError(
          409,
          "Your signed-in account changed. Reload this review before saving.",
          "account_changed",
        );
      const reviewers = await authenticated.activePeerReviewerUids();
      authenticated.checkPeerAccount(uid, peerReviewer, reviewers);
      return res.status(200).json({
        answer: await savePeerFeedback(
          uid,
          peerReviewer,
          reviewers[request.targetReviewer],
          request,
        ),
      });
    }
  }
  throw new RelationshipError(404, "Unknown family review action.");
}
