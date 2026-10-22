import { getIdToken } from "../firestoreClient/auth";

const readActions = new Set([
  "session",
  "trace",
  "evidence",
  "context",
  "tom-feedback",
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
