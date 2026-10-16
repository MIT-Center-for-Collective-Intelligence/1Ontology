import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { localPreviewEnabled } from "../titleValidation/repository";
import { getRelationshipDataset, getRelationshipTrace } from "./dataset";
import { parseFeedback, RelationshipError } from "./feedback";
import { readFeedback, saveFeedback } from "./repository";
import { relationshipPackages } from "./package";
import {
  getRelationshipPresentation,
  getPresentationTrace,
} from "./presentation";

export const relationshipReviewAllowed = (user: {
  email?: string;
  email_verified?: boolean;
}) =>
  user.email_verified === true &&
  ["malone@mit.edu", "oneweb@umich.edu", "oneman@mit.edu"].includes(
    String(user.email || "").toLowerCase(),
  );
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
    if (!["session", "save", "trace", "tom-feedback"].includes(action))
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
      canViewTomFeedback = false;
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
          "This review is available to Tom and Iman. Please use your invited account.",
        );
      uid = user.uid;
      label = String(user.name || user.email || "Reviewer");
      canViewTomFeedback =
        String(user.email).toLowerCase() !== "malone@mit.edu";
    }
    // Cached v1 clients did not send a version for these read-only actions.
    // New clients always bind them explicitly to the displayed dataset.
    const requestedVersion =
      req.body?.datasetVersion ??
      (["trace", "tom-feedback"].includes(action)
        ? relationshipPackages().find((e) => !e.directory)?.version
        : undefined);
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
    const { presentation, sha256: presentationSha256 } =
      getRelationshipPresentation(dataset, sha256);
    if (action === "tom-feedback") {
      if (!canViewTomFeedback || preview)
        throw new RelationshipError(403, "This overview is available to Iman.");
      const { admin } = await import("../firestoreServer/admin");
      const tom = await admin.auth().getUserByEmail("malone@mit.edu");
      return res.status(200).json({
        feedback: await readFeedback(tom.uid, dataset.version, false, sha256),
      });
    }
    if (action === "trace") {
      const caseId = String(req.body?.caseId || "");
      if (!dataset.cases.some((c) => c.id === caseId))
        throw new RelationshipError(404, "Unknown activity.");
      return res.status(200).json({
        trace: {
          original: getRelationshipTrace(caseId, dataset.version),
          selectedChangesReview: getPresentationTrace(dataset.version),
        },
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
      availableVersions: relationshipPackages().map((e) => ({
        version: e.version,
        current: e.version === relationshipPackages()[0].version,
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
