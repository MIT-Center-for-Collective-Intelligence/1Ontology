import { PUBLIC_ONTOLOGY_APP_ID } from "@components/lib/CONSTANTS";

const PUBLIC_VIEWER = "public";

const PUBLIC_VIEW_ACTIONS = new Set([
  "Opened a node",
  "Search result clicked",
  "view change",
  "opened dagre-view",
  "clicked tree-view",
  "Long session detected",
]);

const DETAIL_FIELDS = [
  "node",
  "nodeTitle",
  "clicked",
  "itemClicked",
  "viewType",
  "message",
] as const;

export type PublicViewLogInput = {
  browser?: unknown;
  operatingSystem?: unknown;
  action?: unknown;
  at?: unknown;
  query?: unknown;
  results?: unknown;
  node?: unknown;
  nodeTitle?: unknown;
  clicked?: unknown;
  itemClicked?: unknown;
  viewType?: unknown;
  message?: unknown;
};

const clip = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
};

const clipResults = (results: unknown) => {
  if (!Array.isArray(results)) return [];
  return results.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = clip((item as { id?: unknown }).id, 200);
    if (!id) return [];
    return [{ id, title: clip((item as { title?: unknown }).title, 300) || "" }];
  });
};

const doerCreate = (now: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${PUBLIC_VIEWER}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
};

/**
 * Builds a `logs` document for a public-view interaction.
 * The actor is the shared label "public", with no device identifier.
 */
export const buildPublicViewLog = (
  input: PublicViewLogInput,
  now = new Date(),
): Record<string, unknown> | null => {
  const base = {
    type: "info" as const,
    createdAt: now,
    doer: PUBLIC_VIEWER,
    browser: clip(input.browser, 80) || "",
    operatingSystem: clip(input.operatingSystem, 80) || "",
    doerCreate: doerCreate(now),
    publicView: true,
    appName: PUBLIC_ONTOLOGY_APP_ID,
  };

  if (input.at === "publicSearch") {
    const query = clip(input.query, 500);
    if (!query) return null;
    return {
      ...base,
      at: "publicSearch",
      query,
      results: clipResults(input.results),
    };
  }

  const action = clip(input.action, 80);
  if (!action || !PUBLIC_VIEW_ACTIONS.has(action)) return null;

  const details: Record<string, string> = {};
  for (const field of DETAIL_FIELDS) {
    const value = clip(
      input[field],
      field === "message" || field === "nodeTitle" ? 300 : 200,
    );
    if (value) details[field] = value;
  }

  return {
    ...base,
    type: action === "Long session detected" ? "warning" : "info",
    action,
    ...details,
  };
};
