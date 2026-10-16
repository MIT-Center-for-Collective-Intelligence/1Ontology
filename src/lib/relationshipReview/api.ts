import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { localPreviewEnabled } from "../titleValidation/repository";
import { getRelationshipDataset, getRelationshipTrace } from "./dataset";
import { parseFeedback, RelationshipError } from "./feedback";
import { readFeedback, saveFeedback } from "./repository";

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
        good = new URL(req.headers.origin).host === req.headers.host;
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
    const { dataset, sha256 } = getRelationshipDataset();
    if (action === "tom-feedback") {
      if (!canViewTomFeedback || preview)
        throw new RelationshipError(403, "This overview is available to Iman.");
      const { admin } = await import("../firestoreServer/admin");
      const tom = await admin.auth().getUserByEmail("malone@mit.edu");
      return res
        .status(200)
        .json({
          feedback: await readFeedback(tom.uid, dataset.version, false, sha256),
        });
    }
    if (action === "trace") {
      const caseId = String(req.body?.caseId || "");
      if (!dataset.cases.some((c) => c.id === caseId))
        throw new RelationshipError(404, "Unknown activity.");
      return res.status(200).json({ trace: getRelationshipTrace(caseId) });
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
      return res
        .status(200)
        .json({ answer: await saveFeedback(uid, request, preview) });
    }
    return res.status(200).json({
      dataset,
      datasetSha256: sha256,
      reviewerKey: createHash("sha256").update(uid).digest("hex"),
      reviewerLabel: label,
      feedback: await readFeedback(uid, dataset.version, preview, sha256),
      preview,
      canViewTomFeedback,
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
