// System prompt + provider-neutral tool defs for the chat loop.
// Prompt is static so caching hits across turns; tool schemas are
// translated per provider in aiProviders.ts.

import type { ICollection, INode } from "../../../types/INode";

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<
      string,
      {
        type: "string" | "array" | "number" | "boolean";
        description: string;
        items?: { type: "string" };
      }
    >;
    required: string[];
  };
};

export const TOOLS: ToolDef[] = [
  {
    name: "search_activities",
    description:
      "Semantic search across the ontology. Use this to find activities by concept, theme, or partial name. Returns up to 10 ranked candidates with id, title, and a short description. Use first when the user mentions an activity by name or describes one in their own words.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text query. Can be a noun phrase ('transport'), a description ('moving things from place to place'), or a question fragment.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_activities",
    description:
      "Fetch full profiles for one or more activities by id. Returns each activity's title, description, and all relations (generalizations, specializations, parts, isPartOf) with both ids and titles. Call this after search_activities to deep-dive on the most relevant matches, or to expand neighbours when answering structural questions.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description:
            "Activity ids to fetch. Cap of 20 per call. Pass multiple ids to batch — much more efficient than one call per id.",
        },
      },
      required: ["ids"],
    },
  },
];

// Hard caps — enforced client-side regardless of what the model passes.
export const MAX_TOOL_ITERATIONS = 8;
export const MAX_GET_ACTIVITIES_BATCH = 20;
export const MAX_SEARCH_RESULTS = 10;

export const SYSTEM_PROMPT = `You are an expert assistant for the MIT ontology of activities — a taxonomy where each activity has four kinds of relations: generalizations (broader concepts), specializations (narrower kinds), parts (sub-activities), and isPartOf (larger activities it belongs to).

You do not see the full ontology up front. Use the tools below to navigate it.

TOOLS:
- search_activities(query) — semantic search; returns up to 10 candidates with id, title, and a short description. Call first when the user mentions or describes an activity.
- get_activities(ids) — fetch full profiles in batch (cap 20 ids per call). Returns title, description, and all relations with ids + titles.

INSTRUCTIONS:
- Answer the user's question using only data returned by the tools.
- For structural questions (parts, specializations, relationships), fetch the relevant profiles via get_activities — they contain the ground truth.
- Reference entries as **#ID Title** so the UI can make them clickable. Use the exact id from get_activities — never make one up.
- Be precise with counts and names. Never invent entries or relationships not present in tool results.
- You can use markdown: **bold**, \`code\`, ## headers, --- rules, and fenced code blocks.
- If the tools do not return enough to answer confidently, say so.
- Be concise but thorough.`;

// Compact string formatters — every byte goes into the prompt.

export type SearchHit = {
  id: string;
  title: string;
  description?: string;
};

export const formatSearchResults = (
  query: string,
  hits: SearchHit[],
): string => {
  if (hits.length === 0) {
    return `No matches for "${query}". Try a broader term, a paraphrase, or a related concept.`;
  }
  const lines = hits.slice(0, MAX_SEARCH_RESULTS).map((h) => {
    const desc = (h.description ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
    return desc ? `#${h.id} ${h.title} — ${desc}` : `#${h.id} ${h.title}`;
  });
  return `${hits.length} match${hits.length === 1 ? "" : "es"} for "${query}":\n${lines.join("\n")}`;
};

const flattenLinks = (
  cols: ICollection[] | undefined,
): Array<{ id: string; title: string }> => {
  if (!Array.isArray(cols)) return [];
  const out: Array<{ id: string; title: string }> = [];
  for (const c of cols) {
    for (const n of c?.nodes ?? []) {
      if (n?.id) out.push({ id: n.id, title: n.title || n.id });
    }
  }
  return out;
};

const getDescription = (n: INode): string => {
  const p = n.properties as Record<string, unknown> | undefined;
  const fromProps = p?.description;
  if (typeof fromProps === "string" && fromProps.trim()) return fromProps.trim();
  const tv = n.textValue as Record<string, string> | undefined;
  const fromTv = tv?.description;
  if (typeof fromTv === "string" && fromTv.trim()) return fromTv.trim();
  return "";
};

export const formatActivityProfile = (id: string, node: INode): string => {
  const gens = flattenLinks(node.generalizations);
  const specs = flattenLinks(node.specializations);
  const parts = flattenLinks(node.properties?.parts as ICollection[] | undefined);
  const isPartOf = flattenLinks(
    node.properties?.isPartOf as ICollection[] | undefined,
  );
  const desc = getDescription(node);

  const renderLinks = (
    label: string,
    items: Array<{ id: string; title: string }>,
    cap: number,
  ): string => {
    if (items.length === 0) return "";
    const shown = items.slice(0, cap);
    const tail =
      items.length > cap ? ` …and ${items.length - cap} more` : "";
    const list = shown.map((l) => `#${l.id} ${l.title}`).join(", ");
    return `${label} (${items.length}): ${list}${tail}\n`;
  };

  let out = `=== #${id} ${node.title ?? id} ===\n`;
  if (desc) out += `Description: ${desc}\n`;
  out += renderLinks("Generalizations", gens, 30);
  out += renderLinks("Specializations", specs, 60);
  out += renderLinks("Parts", parts, 60);
  out += renderLinks("IsPartOf", isPartOf, 30);
  return out;
};

export const formatActivityProfiles = (
  profiles: Array<{ id: string; node: INode | null }>,
): string => {
  const lines: string[] = [];
  for (const p of profiles) {
    if (!p.node) {
      lines.push(`=== #${p.id} ===\n(Not found.)\n`);
      continue;
    }
    lines.push(formatActivityProfile(p.id, p.node));
  }
  return lines.join("\n");
};

export default function AiContextPage() {
  return null;
}
