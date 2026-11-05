import type { NextApiRequest, NextApiResponse } from "next";
import { admin } from "@components/lib/firestoreServer/admin";
import { PUBLIC_VIEWER_CLAIM } from "@components/lib/server/publicAccess";
import { PUBLIC_ONTOLOGY_APP_ID } from "@components/lib/CONSTANTS";
import { searchChromaCore } from "../helpers";

const MAX_RESULTS = 100;
const MAX_QUERY_LENGTH = 500;

/** Read-only search for public-link visitors. Requires a `publicViewer` ID token. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const token = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded[PUBLIC_VIEWER_CLAIM] !== true) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { query, appName, resultsNum } = req.body || {};
    if (
      typeof query !== "string" ||
      !query.trim() ||
      query.length > MAX_QUERY_LENGTH ||
      appName !== PUBLIC_ONTOLOGY_APP_ID
    ) {
      return res.status(400).json({ error: "Bad request" });
    }

    const results = await searchChromaCore({
      query,
      appName,
      resultsNum: Math.min(Number(resultsNum) || 20, MAX_RESULTS),
    });
    return res.status(200).json({ results });
  } catch (error: any) {
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("public search error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
