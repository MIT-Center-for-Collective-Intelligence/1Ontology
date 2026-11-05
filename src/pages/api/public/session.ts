import type { NextApiRequest, NextApiResponse } from "next";
import { admin } from "@components/lib/firestoreServer/admin";
import {
  PUBLIC_VIEWER_CLAIM,
  PUBLIC_VIEWER_UID,
  isValidPublicToken,
} from "@components/lib/server/publicAccess";

/**
 * Exchanges the secret public-link token for a Firebase custom token that
 * carries the `publicViewer` claim. Invalid tokens get a bare 404 so the
 * endpoint reveals nothing about whether public access is configured.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isValidPublicToken(req.body?.token)) return res.status(404).end();
  try {
    const customToken = await admin
      .auth()
      .createCustomToken(PUBLIC_VIEWER_UID, { [PUBLIC_VIEWER_CLAIM]: true });
    return res.status(200).json({ customToken });
  } catch (error) {
    console.error("public session error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
