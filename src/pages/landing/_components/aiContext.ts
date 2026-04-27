// ──────────────────────────────────────────────────────────────
// Navigate AI — ontology context builders
// Ports the Process-Handbook pipeline (directory + detected-entity
// profiles + keyword fallback) onto the `INode` shape used by Firestore.
// ──────────────────────────────────────────────────────────────

import type { ICollection, INode } from "../../../types/INode";

const flattenIds = (cols: ICollection[] | undefined): string[] => {
  if (!Array.isArray(cols)) return [];
  const ids: string[] = [];
  for (const c of cols) {
    for (const n of c?.nodes ?? []) {
      if (n?.id) ids.push(n.id);
    }
  }
  return ids;
};

const resolveTitle = (
  id: string,
  nodes: { [id: string]: INode },
): string => nodes[id]?.title?.trim() || id;

const resolveNames = (
  ids: string[],
  nodes: { [id: string]: INode },
): string => ids.map((id) => resolveTitle(id, nodes)).join(", ");

const getDescription = (n: INode): string => {
  const p = n.properties as Record<string, unknown> | undefined;
  const fromProps = p?.description;
  if (typeof fromProps === "string" && fromProps.trim()) return fromProps.trim();
  const tv = n.textValue as Record<string, string> | undefined;
  const fromTv = tv?.description;
  if (typeof fromTv === "string" && fromTv.trim()) return fromTv.trim();
  return "";
};

// ──────────────────────────────────────────────────────────────
// Directory (cheap, cacheable). One line per node: `#id Title`.
// ──────────────────────────────────────────────────────────────

export const buildDirectory = (nodes: { [id: string]: INode }): string => {
  const lines: string[] = [];
  for (const n of Object.values(nodes)) {
    if (!n?.title) continue;
    lines.push(`#${n.id} ${n.title}`);
  }
  return lines.join("\n");
};

// ──────────────────────────────────────────────────────────────
// Per-node profile — gen / spec / parts / isPartOf, all resolved to titles.
// ──────────────────────────────────────────────────────────────

export const buildProfile = (
  id: string,
  nodes: { [id: string]: INode },
): string => {
  const n = nodes[id];
  if (!n) return "";
  const gens = flattenIds(n.generalizations);
  const specs = flattenIds(n.specializations);
  const parts = flattenIds(n.properties?.parts as ICollection[] | undefined);
  const isPartOf = flattenIds(
    n.properties?.isPartOf as ICollection[] | undefined,
  );
  const desc = getDescription(n);

  let p = `=== #${id} ${n.title ?? id} ===\n`;
  if (desc) p += `Description: ${desc}\n`;
  if (gens.length)
    p += `Generalizations (${gens.length}): ${resolveNames(gens, nodes)}\n`;
  if (specs.length) {
    const shown = specs.slice(0, 60);
    p += `Specializations (${specs.length}): ${resolveNames(shown, nodes)}${
      specs.length > 60 ? ` …and ${specs.length - 60} more` : ""
    }\n`;
  }
  if (parts.length)
    p += `Parts (${parts.length}): ${resolveNames(parts, nodes)}\n`;
  if (isPartOf.length)
    p += `Part Of (${isPartOf.length}): ${resolveNames(isPartOf, nodes)}\n`;
  return p;
};

// ──────────────────────────────────────────────────────────────
// Entity detection — heuristic scoring on the user's question.
// Returns top-5 likely entities to profile in detail.
// ──────────────────────────────────────────────────────────────

export type DetectedEntity = { id: string; score: number };

export const detectEntities = (
  rawQuery: string,
  nodes: { [id: string]: INode },
): DetectedEntity[] => {
  const ql = rawQuery.toLowerCase();
  const found: DetectedEntity[] = [];

  for (const n of Object.values(nodes)) {
    const tl = n.title?.toLowerCase();
    if (!tl) continue;
    if (tl === ql) found.push({ id: n.id, score: 100 });
    else if (ql.includes(tl) && tl.length > 2)
      found.push({ id: n.id, score: 50 + tl.length });
    else if (tl.includes(ql)) found.push({ id: n.id, score: 40 });
  }

  const words = ql.split(/\s+/).filter((w) => w.length >= 3);
  for (const n of Object.values(nodes)) {
    const tl = n.title?.toLowerCase();
    if (!tl) continue;
    for (const w of words) {
      if (tl === w) {
        found.push({ id: n.id, score: 60 });
        break;
      } else if (
        tl.startsWith(w + " ") ||
        tl.endsWith(" " + w) ||
        tl.includes(" " + w + " ")
      ) {
        found.push({ id: n.id, score: 30 });
        break;
      }
    }
  }

  const seen = new Set<string>();
  return found
    .sort((a, b) => b.score - a.score)
    .filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    })
    .slice(0, 5);
};

// ──────────────────────────────────────────────────────────────
// Keyword scorer — fallback context (title match + short description snippet).
// ──────────────────────────────────────────────────────────────

export type KeywordHit = { id: string; score: number; title: string; desc: string };

export const scoreKeywords = (
  rawQuery: string,
  nodes: { [id: string]: INode },
): KeywordHit[] => {
  const ql = rawQuery.toLowerCase();
  const words = ql.split(/\s+/).filter((w) => w.length > 1);
  const hits: KeywordHit[] = [];
  for (const n of Object.values(nodes)) {
    const t = (n.title ?? "").toLowerCase();
    const d = getDescription(n).toLowerCase();
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += 3;
      if (d.includes(w)) score += 1;
    }
    if (score > 0) {
      hits.push({ id: n.id, score, title: n.title ?? n.id, desc: getDescription(n) });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
};

// ──────────────────────────────────────────────────────────────
// Full system prompt assembly.
// ──────────────────────────────────────────────────────────────

export const buildSystemPrompt = (
  query: string,
  nodes: { [id: string]: INode },
  directoryCached: string,
): string => {
  const detected = detectEntities(query, nodes);
  const profiledIds = new Set<string>();
  let profiles = "";
  for (const d of detected) {
    profiles += buildProfile(d.id, nodes) + "\n";
    profiledIds.add(d.id);
    // Profile the first-tier neighbours too (parts, gens, top-5 specs)
    const n = nodes[d.id];
    if (!n) continue;
    const neighbourIds = [
      ...flattenIds(n.properties?.parts as ICollection[] | undefined),
      ...flattenIds(n.generalizations),
      ...flattenIds(n.specializations).slice(0, 5),
    ];
    for (const nid of neighbourIds) {
      if (!profiledIds.has(nid) && nodes[nid]) {
        profiles += buildProfile(nid, nodes) + "\n";
        profiledIds.add(nid);
      }
    }
  }

  const kw = scoreKeywords(query, nodes)
    .slice(0, 20)
    .filter((h) => !profiledIds.has(h.id))
    .map(
      (h) =>
        `#${h.id} ${h.title}${h.desc ? ` — ${h.desc.slice(0, 80)}` : ""}`,
    )
    .join("\n");

  const totalCount = Object.keys(nodes).length;

  return (
    `You are an expert on the MIT ontology of activities — a taxonomy of ` +
    `${totalCount} activities maintained on this platform.\n\n` +
    `COMPLETE DIRECTORY OF ALL ENTRIES (id + title only):\n` +
    directoryCached +
    `\n\n` +
    (profiles
      ? `DETAILED PROFILES OF RELEVANT ENTRIES (with all relationships):\n${profiles}\n`
      : "") +
    (kw ? `ADDITIONAL KEYWORD MATCHES:\n${kw}\n\n` : "\n") +
    `INSTRUCTIONS:\n` +
    `- Answer the user's question using only the data above.\n` +
    `- For structural questions (parts, specializations, relationships), use the DETAILED PROFILES — they contain the ground truth.\n` +
    `- Reference entries as **#ID Title** so the UI can make them clickable.\n` +
    `- Be precise with counts and names. Never invent entries or relationships not present above.\n` +
    `- You can use markdown: **bold**, \`code\`, ## headers, --- rules, and fenced code blocks.\n` +
    `- If the data does not contain enough to answer confidently, say so.\n` +
    `- Be concise but thorough.`
  );
};

export default function AiContextPage() {
  return null;
}
