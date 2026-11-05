import { timingSafeEqual } from "crypto";

/** Firebase uid shared by every anonymous visitor of the public link. */
export const PUBLIC_VIEWER_UID = "public-viewer";
/** Custom claim that marks a Firebase session as read-only public access. */
export const PUBLIC_VIEWER_CLAIM = "publicViewer";

const MIN_TOKEN_LENGTH = 32;

/**
 * Checks a candidate against the secret in PUBLIC_VIEW_TOKEN.
 * Fails closed when the secret is unset or too short to be unguessable.
 */
export const isValidPublicToken = (candidate: unknown): boolean => {
  const secret = process.env.PUBLIC_VIEW_TOKEN?.trim();
  if (!secret || secret.length < MIN_TOKEN_LENGTH) return false;
  if (typeof candidate !== "string" || candidate.length > 512) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};
