import type { NextApiRequest, NextApiResponse } from "next";
import { admin } from "@components/lib/firestoreServer/admin";
import { PUBLIC_VIEWER_CLAIM } from "@components/lib/server/publicAccess";
import { savePublicViewLog } from "@components/lib/server/publicViewLog";

/** Records a public-view interaction. Requires a `publicViewer` ID token. */
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

    const saved = await savePublicViewLog(req.body || {});
    if (!saved) return res.status(400).json({ error: "Bad request" });
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("public log error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
