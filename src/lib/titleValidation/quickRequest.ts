import { getIdToken } from "../firestoreClient/auth";

// This workflow needs HTTP status to distinguish a rejected answer from an
// uncertain delivery. The shared Axios adapter converts server errors to strings.
export async function postQuickReview<T>(
  path: string,
  body: object,
  preview = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!preview) {
    const token = await getIdToken();
    if (!token)
      throw Object.assign(new Error("Sign in again to continue."), {
        status: 401,
      });
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch("/api" + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw Object.assign(
      new Error(
        "The server returned an unreadable response. Please retry saving this answer.",
      ),
      { status: response.ok ? 502 : response.status },
    );
  }
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof data?.error === "string"
          ? data.error
          : "Your answer could not be saved. Please retry.",
      ),
      { status: response.status },
    );
  return data as T;
}
