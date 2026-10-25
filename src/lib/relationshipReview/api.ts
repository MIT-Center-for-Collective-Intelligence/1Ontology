import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { localPreviewEnabled } from "../titleValidation/repository";
import { getRelationshipDataset, getRelationshipTrace } from "./dataset";
import { parseFeedback, RelationshipError } from "./feedback";
import { readFeedback, saveFeedback } from "./repository";
import { parsePeerFeedback, parsePeerFeedbackQuery } from "./peerFeedback";
import { readPeerFeedback, savePeerFeedback } from "./peerRepository";
import type { PeerReviewerUids } from "./peerRepository";
import type { PeerReviewer } from "../../types/IRelationshipReview";
import { relationshipPackages } from "./package";
import { relationshipTraceDisclosure } from "./trace";
import { relationshipSourceEvidence } from "./evidence";
import { relationshipContext } from "./context";
import { isBranchAction, branchReviewHandler } from "./branchApi";
import {
  getRelationshipPresentation,
  getPresentationTrace,
} from "./presentation";

export const relationshipReviewAllowed = (user: {
  email?: string;
  email_verified?: boolean;
}) =>
  user.email_verified === true &&
  [
    "malone@mit.edu",
    "rjl@mit.edu",
    "oneweb@umich.edu",
    "oneman@mit.edu",
  ].includes(String(user.email || "").toLowerCase());

export function relationshipPeerReviewer(user: {
  email?: string;
  email_verified?: boolean;
}): PeerReviewer | null {
  if (!relationshipReviewAllowed(user)) return null;
  switch (String(user.email || "").toLowerCase()) {
    case "malone@mit.edu":
      return "tom";
    case "rjl@mit.edu":
      return "rob";
    default:
      return null;
  }
}

async function activePeerUid(reviewer: PeerReviewer): Promise<string> {
  let email: string;
  switch (reviewer) {
    case "tom":
      email = "malone@mit.edu";
      break;
    case "rob":
      email = "rjl@mit.edu";
      break;
    default:
      throw new RelationshipError(400, "Unknown peer reviewer.");
  }
  const { admin } = await import("../firestoreServer/admin");
  let user;
  try {
    // Only these approved emails are resolved. No UID or email comes from a body.
    user = await admin.auth().getUserByEmail(email);
  } catch (error: any) {
    if (error?.code === "auth/user-not-found")
      throw new RelationshipError(
        403,
        "This reviewer's active, verified account is unavailable.",
      );
    throw error;
  }
  if (
    user.disabled === true ||
    user.emailVerified !== true ||
    String(user.email || "").toLowerCase() !== email ||
    typeof user.uid !== "string" ||
    !user.uid ||
    user.uid.startsWith("software-qa:")
  )
    throw new RelationshipError(
      403,
      "This reviewer's active, verified account is unavailable.",
    );
  return user.uid;
}

async function activePeerReviewerUids(): Promise<PeerReviewerUids> {
  const [tom, rob] = await Promise.all([
    activePeerUid("tom"),
    activePeerUid("rob"),
  ]);
  if (tom === rob)
    throw new RelationshipError(403, "The reviewer accounts are unavailable.");
  return { tom, rob };
}

function checkPeerAccount(
  uid: string,
  reviewer: PeerReviewer | null,
  reviewers: PeerReviewerUids,
) {
  if (reviewer !== null && reviewers[reviewer] !== uid)
    throw new RelationshipError(
      409,
      "Your signed-in account changed. Reload this review before continuing.",
      "account_changed",
    );
}

export async function relationshipReviewHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  try {
    const action = String(req.query.action || "");
    if (
      ![
        "session",
        "save",
        "trace",
        "evidence",
        "context",
        "tom-feedback",
        "peer-feedback",
        "save-peer",
      ].includes(action) &&
      !isBranchAction(action)
    )
      throw new RelationshipError(404, "Unknown review action.");
    if (req.headers.origin) {
      let good = false;
      try {
        const origin = new URL(req.headers.origin);
        // Firebase Hosting forwards the public domain to a Cloud Run host.
        // Pin that public origin; do not trust client-supplied forwarded hosts.
        good =
          req.headers.origin === origin.origin &&
          (origin.origin === "https://ontology.mit.edu" ||
            (origin.protocol === "https:" &&
              origin.host === req.headers.host) ||
            (process.env.NODE_ENV !== "production" &&
              origin.protocol === "http:" &&
              origin.host === req.headers.host &&
              ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)));
      } catch {}
      if (!good)
        throw new RelationshipError(403, "Use this review from its own page.");
    }
    const preview = localPreviewEnabled(
      req.headers.host,
      req.socket?.remoteAddress,
    );
    let uid = "relationship-local-preview",
      label = "Local preview",
      canViewTomFeedback = false,
      canViewPeerFeedback = false;
    let peerReviewer: PeerReviewer | null = null;
    if (!preview) {
      const token = String(req.headers.authorization || "").replace(
        /^Bearer /,
        "",
      );
      if (!token)
        throw new RelationshipError(401, "Sign in to review these proposals.");
      const { admin } = await import("../firestoreServer/admin");
      let user;
      try {
        user = await admin.auth().verifyIdToken(token, true);
      } catch {
        throw new RelationshipError(401, "Sign in again to continue.");
      }
      if (!relationshipReviewAllowed(user))
        throw new RelationshipError(
          403,
          "Please use your verified invited account to access this review.",
        );
      uid = user.uid;
      label = String(user.name || user.email || "Reviewer");
      peerReviewer = relationshipPeerReviewer(user);
      canViewTomFeedback = peerReviewer !== "tom";
      canViewPeerFeedback = true;
    }
    const isPeerAction = action === "peer-feedback" || action === "save-peer";
    if (isPeerAction && preview)
      throw new RelationshipError(
        403,
        "Peer feedback is unavailable in local preview. Sign in on the review site.",
      );
    if (action === "save-peer" && peerReviewer === null)
      throw new RelationshipError(
        403,
        "Only Tom and Rob can save peer responses. Coordinators can view them.",
      );
    if (
      isPeerAction &&
      (typeof req.body !== "object" ||
        req.body === null ||
        Array.isArray(req.body) ||
        !Object.prototype.hasOwnProperty.call(req.body, "datasetVersion") ||
        !Object.prototype.hasOwnProperty.call(req.body, "datasetSha256") ||
        typeof req.body.datasetVersion !== "string" ||
        typeof req.body.datasetSha256 !== "string")
    )
      throw new RelationshipError(
        400,
        "A review version and snapshot hash are required for peer feedback. Reload this review.",
      );
    if (isBranchAction(action))
      return await branchReviewHandler(req, res, action, {
        uid,
        label,
        preview,
        peerReviewer,
        canViewPeerFeedback,
        activePeerReviewerUids,
        checkPeerAccount,
      });

    // Cached v1 clients did not send a version for these read-only actions.
    // New clients always bind them explicitly to the displayed dataset.
    const requestedVersion =
      req.body?.datasetVersion ??
      (["trace", "tom-feedback"].includes(action)
        ? relationshipPackages().find((e) => !e.directory)?.version
        : undefined);
    if (action === "context" && requestedVersion === undefined)
      throw new RelationshipError(
        400,
        "A review version is required to show neighboring activities. Reload this review.",
      );
    if (
      requestedVersion !== undefined &&
      (typeof requestedVersion !== "string" ||
        !relationshipPackages().some((e) => e.version === requestedVersion))
    )
      throw new RelationshipError(
        409,
        "This review version is unavailable. Reload to continue.",
      );
    const { dataset, sha256 } = getRelationshipDataset(requestedVersion);
    if (action === "context") {
      const caseId = String(req.body?.caseId || "");
      if (!dataset.cases.some((c) => c.id === caseId))
        throw new RelationshipError(404, "Unknown activity.");
      if (
        req.body?.datasetSha256 !== undefined &&
        req.body.datasetSha256 !== sha256
      )
        throw new RelationshipError(
          409,
          "This review snapshot changed. Reload before showing neighboring activities.",
        );
      return res.status(200).json({
        context: relationshipContext(dataset, sha256, caseId, {
          focusId: req.body?.focusId,
          activityOffset: req.body?.activityOffset,
          sourceOffset: req.body?.sourceOffset,
          limit: req.body?.limit,
        }),
      });
    }
    if (action === "peer-feedback") {
      const request = parsePeerFeedbackQuery(
        req.body,
        dataset.version,
        sha256,
        dataset.cases.map((c) => c.id),
      );
      const reviewers = await activePeerReviewerUids();
      checkPeerAccount(uid, peerReviewer, reviewers);
      return res.status(200).json(await readPeerFeedback(reviewers, request));
    }
    if (action === "save-peer") {
      // Keep the write authorization in this branch as well as above.
      if (peerReviewer === null)
        throw new RelationshipError(
          403,
          "Only Tom and Rob can save peer responses.",
        );
      const request = parsePeerFeedback(
        req.body,
        dataset.version,
        sha256,
        dataset.cases.map((c) => c.id),
        peerReviewer,
      );
      if (
        request.reviewerKey !== createHash("sha256").update(uid).digest("hex")
      )
        throw new RelationshipError(
          409,
          "Your signed-in account changed. Reload this review before saving.",
          "account_changed",
        );
      const reviewers = await activePeerReviewerUids();
      checkPeerAccount(uid, peerReviewer, reviewers);
      return res.status(200).json({
        answer: await savePeerFeedback(
          uid,
          peerReviewer,
          reviewers[request.targetReviewer],
          request,
        ),
      });
    }
    const { presentation, sha256: presentationSha256 } =
      getRelationshipPresentation(dataset, sha256);
    if (action === "tom-feedback") {
      if (!canViewTomFeedback || preview)
        throw new RelationshipError(
          403,
          "This overview is available to Rob and the coordinators.",
        );
      const tomUid = await activePeerUid("tom");
      return res.status(200).json({
        feedback: await readFeedback(tomUid, dataset.version, false, sha256),
      });
    }
    if (action === "trace" || action === "evidence") {
      const caseId = String(req.body?.caseId || "");
      if (!dataset.cases.some((c) => c.id === caseId))
        throw new RelationshipError(404, "Unknown activity.");
      if (action === "evidence") {
        const evidence = relationshipSourceEvidence(
          dataset,
          caseId,
          getRelationshipTrace(caseId, dataset.version),
        );
        return res.status(200).json({
          evidence: {
            ...evidence,
            datasetSha256: sha256,
            disclosureVersion: "frozen-source-disclosure-v1",
            evidenceSha256: createHash("sha256")
              .update(JSON.stringify(evidence))
              .digest("hex"),
          },
        });
      }
      return res.status(200).json({
        trace: relationshipTraceDisclosure(
          getRelationshipTrace(caseId, dataset.version),
          getPresentationTrace(dataset.version),
          caseId,
        ),
      });
    }
    if (action === "save") {
      if (
        req.body?.reviewerKey !== createHash("sha256").update(uid).digest("hex")
      )
        throw new RelationshipError(
          409,
          "Your signed-in account changed. Reload this review before saving.",
          "account_changed",
        );
      const request = parseFeedback(
        req.body || {},
        dataset.version,
        sha256,
        dataset.cases.map((c) => c.id),
      );
      if (req.body.presentationSha256 !== undefined) {
        if (req.body.presentationSha256 !== presentationSha256)
          throw new RelationshipError(
            409,
            "The evidence presentation changed. Your draft is preserved; reload before saving.",
          );
        request.presentationSha256 = presentationSha256;
        request.presentationVersion = presentation.version;
      }
      return res
        .status(200)
        .json({ answer: await saveFeedback(uid, request, preview) });
    }
    return res.status(200).json({
      dataset,
      datasetSha256: sha256,
      presentation,
      presentationSha256,
      reviewerKey: createHash("sha256").update(uid).digest("hex"),
      reviewerLabel: label,
      feedback: await readFeedback(uid, dataset.version, preview, sha256),
      preview,
      canViewTomFeedback,
      peerReviewer,
      canViewPeerFeedback,
      availableVersions: relationshipPackages().map((e) => ({
        version: e.version,
        current: e.version === relationshipPackages()[0].version,
        ...(e.label ? { label: e.label } : {}),
      })),
    });
  } catch (e: any) {
    return res.status(e instanceof RelationshipError ? e.status : 500).json({
      error:
        e instanceof RelationshipError
          ? e.message
          : "The review could not be loaded or saved. Keep this tab open and retry.",
      ...(e instanceof RelationshipError && e.code ? { code: e.code } : {}),
    });
  }
}
