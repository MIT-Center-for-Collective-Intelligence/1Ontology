/**
 * Build a transformed ontology JSON (`.transformed.json`) from a legacy hierarchy file
 * (`compare-ontology/<FILE_NAME>.json`, e.g. `0112_FINALHIERARCHY.json`).
 *
 * The script parses labels, disambiguates duplicate base titles when child structure
 * differs, and emits each node as `{ title, description, parts, specializations }`
 * (same overall shape as `compare-ontology/0112-dn.json`).
 *
 * ---
 * When comparing ontology node presence and locations across two JSON formats, these
 * are treated as ignorable or normalized (legacy key-tree vs node-object format such as
 * `Final Ontology - edited 0228.json`):
 *
 * - "(Synonyms: ...)" suffixes in labels
 * - "(Verb.v.0n ...)" style verb-sense suffixes in labels
 * - "(Specializations)" intermediary nodes
 * - "(Atomic Tasks)" intermediary nodes
 * - "[Verb -- miscellaneous]" intermediary nodes
 * - Non-structural properties in the edited format (title/description/parts/etc.)
 *
 * This file performs the transform and write only; it does not diff two inputs. For
 * side-by-side comparison logic, see `compare-ontology/compare-ontology-jsons.ts`.
 */

const fs: typeof import("fs") = require("fs");
const path: typeof import("path") = require("path");

const FILE_NAME = "0112_FINALHIERARCHY";

/** Carries synonym line for `description`; stripped before traversing children. */
const ONTOLOGY_SYNONYM_DESC_KEY = "__ontologySynonymDescription";

/** Parsed synonym / sense fragment from a legacy ontology label. */
interface SynonymEntry {
  name: string;
  version?: string;
}

interface ParsedOntologyTitle {
  title: string;
  synonyms: SynonymEntry[];
}

interface BaseTitleParts {
  normalized: string;
  synonyms: string[];
}

/** Any value allowed in legacy ontology JSON from disk. */
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

type JsonObject = { [key: string]: JsonValue };

/** Transformed node shape written to `.transformed.json` (recursive). */
interface DnNode {
  title: string;
  description: string;
  parts: readonly [];
  specializations: Record<string, DnNode>;
}

interface SeenVariant {
  childrenSignatures: string[];
}

type SeenMap = Map<string, SeenVariant[]>;

const ONTOLOGY_OBJECT = require(`./${FILE_NAME}.json`) as JsonObject;

function parseOntologyTitle(rawTitle: string): ParsedOntologyTitle {
  let title = rawTitle.trim();
  if (title.startsWith("(O*Net)")) {
    return { title, synonyms: [] };
  }
  const matches = Array.from(title.matchAll(/\(([^)]+)\)/g));
  const synonymEntries: SynonymEntry[] = [];
  const keptParentheses: string[] = [];

  for (const match of matches) {
    const content = match[1].trim();
    const synonymMatch = content.match(/^Synonyms\s*:\s*(.+)$/i);
    if (synonymMatch) {
      const synonyms = synonymMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      synonymEntries.push(...synonyms.map((name) => ({ name })));
      continue;
    }

    const parts = content.split(",").map((s) => s.trim());
    const keptParts: string[] = [];
    for (const s of parts) {
      const versionMatch = s.match(/\.v\.?(\d+)/i);
      if (versionMatch) {
        const cleanName = s.replace(/\.v\.?\d+/i, "").trim();
        synonymEntries.push({
          name: cleanName,
          version: `v.${versionMatch[1]}`,
        });
      } else {
        keptParts.push(s);
      }
    }
    if (keptParts.length > 0) {
      keptParentheses.push(`(${keptParts.join(", ")})`);
    }
  }

  title = title.replace(/\(.*?\)/g, "").trim();
  if (keptParentheses.length > 0) {
    title = `${title} ${keptParentheses.join(" ")}`.trim();
  }
  title = title.replace(/\.v\.?\d+/gi, "").trim();

  return { title, synonyms: synonymEntries };
}

/** Text for `description` when `(Synonyms: a, b, …)` was parsed from the label. */
function descriptionFromSynonyms(displayTitle: string): string {
  const { synonyms } = parseOntologyTitle(displayTitle);
  if (synonyms.length === 0) return "";
  return `Synonyms: ${synonyms.map((s) => s.name).join(", ")}`;
}

function synonymLineFromNames(synonyms: string[]): string {
  if (synonyms.length === 0) return "";
  return `Synonyms: ${synonyms.join(", ")}`;
}

function attachSynonymDescription(
  body: JsonObject,
  synonymDescription: string,
): JsonObject {
  if (!synonymDescription) return body;
  return { ...body, [ONTOLOGY_SYNONYM_DESC_KEY]: synonymDescription };
}

function peelSynonymDescription(obj: JsonObject): {
  description: string;
  rest: JsonObject;
} {
  const raw = obj[ONTOLOGY_SYNONYM_DESC_KEY];
  const description = typeof raw === "string" ? raw : "";
  if (!description) return { description: "", rest: obj };
  const rest = { ...obj };
  delete rest[ONTOLOGY_SYNONYM_DESC_KEY];
  return { description, rest };
}

/** Flat transformOntology output → node-object shape; unwrap (Specializations); map (Atomic Tasks) → [parent -- miscellaneous]. */
function wrapDnSubtree(value: JsonValue, displayTitle: string): DnNode {
  const parts = [] as const;

  let peeledDescription = "";
  let nodeValue: JsonValue = value;
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ONTOLOGY_SYNONYM_DESC_KEY in (value as JsonObject)
  ) {
    const peeled = peelSynonymDescription(value as JsonObject);
    peeledDescription = peeled.description;
    nodeValue = peeled.rest;
  }

  const description =
    peeledDescription || descriptionFromSynonyms(displayTitle);

  if (Array.isArray(nodeValue)) {
    const specializations: Record<string, DnNode> = {};
    for (const item of nodeValue) {
      const s = String(item);
      specializations[s] = {
        title: s,
        description: descriptionFromSynonyms(s),
        parts: [],
        specializations: {},
      };
    }
    return { title: displayTitle, description, parts, specializations };
  }

  if (nodeValue == null || typeof nodeValue !== "object") {
    return {
      title: displayTitle,
      description,
      parts,
      specializations: {},
    };
  }

  const specializations: Record<string, DnNode> = {};
  const obj = nodeValue as JsonObject;

  for (const key of Object.keys(obj)) {
    const k = key.trim().toLowerCase();

    if (k === "(specializations)") {
      const inner = obj[key];
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        const innerObj = inner as JsonObject;
        for (const childKey of Object.keys(innerObj)) {
          specializations[childKey] = wrapDnSubtree(
            innerObj[childKey],
            childKey,
          );
        }
      }
      continue;
    }

    if (k === "(atomic tasks)") {
      const inner = obj[key];
      const bracketName = `[${parseOntologyTitle(displayTitle).title} -- miscellaneous]`;
      const children: Record<string, DnNode> = {};
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        const innerObj = inner as JsonObject;
        for (const childKey of Object.keys(innerObj)) {
          children[childKey] = wrapDnSubtree(innerObj[childKey], childKey);
        }
      }
      specializations[bracketName] = {
        title: bracketName,
        description: descriptionFromSynonyms(bracketName),
        parts: [],
        specializations: children,
      };
      continue;
    }

    specializations[key] = wrapDnSubtree(obj[key], key);
  }

  return { title: displayTitle, description, parts, specializations };
}

function wrapDnRoot(input: JsonValue): Record<string, DnNode> {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, DnNode> = {};
  const root = input as JsonObject;
  for (const key of Object.keys(root)) {
    out[key] = wrapDnSubtree(root[key], key);
  }
  return out;
}

function getBaseTitle(title: string): BaseTitleParts {
  if (!title) return { normalized: "", synonyms: [] };
  const c = parseOntologyTitle(title);
  return {
    normalized: c.title,
    synonyms: c.synonyms.map((s) => s.name),
  };
}

function isCollectionKey(key: string): boolean {
  if (!key) return false;
  const k = key.trim().toLowerCase();
  return (
    k === "(atomic tasks)" ||
    k === "(specializations)" ||
    (key.startsWith("[") && key.endsWith("]"))
  );
}

function areChildrenSame(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function canonicalizeForSignature(value: JsonValue): JsonValue {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item == null) return null;
      if (typeof item === "object") return canonicalizeForSignature(item);
      if (typeof item === "string") return item;
      return String(item);
    });
  }
  if (typeof value !== "object") return value;

  const result: JsonObject = {};
  const keys = Object.keys(value as object).sort((a, b) => a.localeCompare(b));
  const obj = value as JsonObject;
  for (const key of keys) {
    const normalizedKey = isCollectionKey(key)
      ? `collection:${key.trim().toLowerCase()}`
      : `title:${getBaseTitle(key).normalized.toLowerCase()}`;
    result[normalizedKey] = canonicalizeForSignature(obj[key]);
  }
  return result;
}

function buildStructureSignature(value: JsonValue): string {
  try {
    return JSON.stringify(canonicalizeForSignature(value));
  } catch {
    return "";
  }
}

function collectChildStructureSignatures(obj: JsonValue): string[] {
  const signatures: string[] = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const o = obj as JsonObject;
    for (const key of Object.keys(o)) {
      if (isCollectionKey(key)) {
        const col = o[key];
        if (col && typeof col === "object") {
          const colObj = col as JsonObject;
          for (const subKey of Object.keys(colObj)) {
            const base = getBaseTitle(subKey).normalized.toLowerCase();
            signatures.push(
              `${base}::${buildStructureSignature(colObj[subKey] as JsonValue)}`,
            );
          }
        } else {
          signatures.push(`collection:${key.trim().toLowerCase()}::primitive`);
        }
      } else {
        const base = getBaseTitle(key).normalized.toLowerCase();
        signatures.push(`${base}::${buildStructureSignature(o[key])}`);
      }
    }
  }
  signatures.sort();
  return signatures;
}

function designateTitle(
  baseDisplay: string,
  childrenSignatures: string[],
  seen: SeenMap,
): string {
  const key = baseDisplay.toLowerCase();
  const existing = seen.get(key) || [];
  let matchIdx = -1;
  for (let i = 0; i < existing.length; i++) {
    if (areChildrenSame(existing[i].childrenSignatures, childrenSignatures)) {
      matchIdx = i;
      break;
    }
  }

  if (matchIdx === -1) {
    existing.push({ childrenSignatures });
    seen.set(key, existing);
    const idx = existing.length - 1;
    return idx === 0 ? baseDisplay : `${baseDisplay} (${idx})`;
  }
  return matchIdx === 0 ? baseDisplay : `${baseDisplay} (${matchIdx})`;
}

function deepEqualJson(a: JsonValue, b: JsonValue): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualJson(a[i] as JsonValue, b[i] as JsonValue)) return false;
    }
    return true;
  }

  if (typeof a === "object") {
    if (Array.isArray(b) || typeof b !== "object") return false;
    const ao = a as JsonObject;
    const bo = b as JsonObject;
    const keys = Object.keys(ao);
    if (Object.keys(bo).length !== keys.length) return false;
    for (const k of keys) {
      if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
      if (!deepEqualJson(ao[k], bo[k])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Writes a sibling under `output[title]`. If `title` already exists, keeps the first
 * value when deep-equal; otherwise throws with both source keys.
 */
function putTransformedSibling(
  output: JsonObject,
  title: string,
  nextValue: JsonObject,
  sourceKey: string,
  firstSourceByTitle: Map<string, string>,
): void {
  if (Object.prototype.hasOwnProperty.call(output, title)) {
    const existing = output[title];
    if (deepEqualJson(existing, nextValue)) return;
    const firstKey = firstSourceByTitle.get(title) ?? "(unknown)";
    throw new Error(
      `transformOntology: duplicate output title ${JSON.stringify(title)} from input keys ${JSON.stringify(firstKey)} and ${JSON.stringify(sourceKey)} (subtrees differ).`,
    );
  }
  firstSourceByTitle.set(title, sourceKey);
  output[title] = nextValue;
}

function transformOntology(input: JsonValue, seen: SeenMap): JsonObject {
  if (input == null) return {};
  if (Array.isArray(input)) return {};
  if (typeof input !== "object") return {};

  const output: JsonObject = {};
  const inputByKey = input as JsonObject;
  const firstSourceByTitle = new Map<string, string>();

  for (const key of Object.keys(inputByKey)) {
    if (isCollectionKey(key)) {
      const collectionValue = inputByKey[key];
      const keyLower = key.trim().toLowerCase();
      if (collectionValue && typeof collectionValue === "object") {
        output[key] = transformOntology(collectionValue as JsonValue, seen);
      } else if (
        keyLower === "(atomic tasks)" ||
        keyLower === "(specializations)"
      ) {
        output[key] = {};
      }
      continue;
    }

    const value = inputByKey[key];
    const { normalized: baseDisplay, synonyms } = getBaseTitle(key);
    const childrenSignatures = collectChildStructureSignatures(value);
    const title = designateTitle(baseDisplay, childrenSignatures, seen);
    const metaLine = synonymLineFromNames(synonyms);

    if (Array.isArray(value)) {
      const converted: JsonObject = {};
      for (const item of value) converted[String(item)] = {};
      putTransformedSibling(
        output,
        title,
        attachSynonymDescription(converted, metaLine),
        key,
        firstSourceByTitle,
      );
    } else if (value && typeof value === "object") {
      putTransformedSibling(
        output,
        title,
        attachSynonymDescription(transformOntology(value, seen), metaLine),
        key,
        firstSourceByTitle,
      );
    } else {
      putTransformedSibling(
        output,
        title,
        attachSynonymDescription({}, metaLine),
        key,
        firstSourceByTitle,
      );
    }
  }
  return output;
}

try {
  const seenMap: SeenMap = new Map();
  const normalizedTree = transformOntology(ONTOLOGY_OBJECT, seenMap);
  const transformed = wrapDnRoot(normalizedTree);

  const outPath = path.join(__dirname, "./", `${FILE_NAME}.transformed.json`);
  fs.writeFileSync(outPath, JSON.stringify(transformed, null, 2), "utf8");
  console.log("Wrote:", outPath);
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
