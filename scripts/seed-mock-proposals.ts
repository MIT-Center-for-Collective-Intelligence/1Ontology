/**
 * Seed mock algorithm proposals for an app so the review workspace has
 * something to show. Steps are bound to real activity nodes of the same app:
 * each child's proposal starts from its parent's resolved parts and gets a
 * seeded variation (keep, specialize, drop, add, loop, conditional).
 *
 *   NODE_ENV=development npx tsx --env-file=.env.local scripts/seed-mock-proposals.ts [--app test-ontology] [--wipe]
 *
 * --wipe removes this app's existing mock proposals (and review docs) first.
 * Never run against production.
 */
import { db } from "../src/lib/firestoreServer/admin";

const argOf = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
};
const APP = argOf("--app") || "test-ontology";
const WIPE = process.argv.includes("--wipe");
if (process.env.NODE_ENV !== "development") {
  console.error("Refusing to run outside NODE_ENV=development");
  process.exit(1);
}

let seed = 20261016;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];

type N = {
  id: string;
  title: string;
  kids: { id: string; coll: string }[];
  parents: string[];
  parts: { id: string; optional: boolean }[];
  source: string | null;
};

async function main() {
  const snap = await db
    .collection("nodes")
    .where("appName", "==", APP)
    .where("deleted", "==", false)
    .where("nodeType", "==", "activity")
    .get();
  const N: Record<string, N> = {};
  for (const d of snap.docs) {
    const x = d.data();
    N[d.id] = {
      id: d.id,
      title: x.title,
      kids: (x.specializations || []).flatMap((c: any) =>
        (c.nodes || []).map((n: any) => ({
          id: n.id,
          coll: c.collectionName || "main",
        })),
      ),
      parents: (x.generalizations || []).flatMap((c: any) =>
        (c.nodes || []).map((n: any) => n.id),
      ),
      parts: (x.properties?.parts || []).flatMap((c: any) =>
        (c.nodes || []).map((n: any) => ({ id: n.id, optional: !!n.optional })),
      ),
      source: x.partsInheritance?.source ?? null,
    };
  }
  const resolvedParts = (
    id: string,
    depth = 0,
  ): { id: string; optional: boolean }[] => {
    const n = N[id];
    if (!n || depth > 10) return [];
    if (n.parts.length) return n.parts;
    return n.source ? resolvedParts(n.source, depth + 1) : [];
  };
  const vocabulary = [
    ...new Set(Object.values(N).flatMap((n) => n.parts.map((p) => p.id))),
  ];
  const title = (id: string) => N[id]?.title ?? id;

  if (WIPE) {
    const old = await db
      .collection("proposals")
      .where("appName", "==", APP)
      .get();
    const batch = db.batch();
    old.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`wiped ${old.size} proposal docs for ${APP}`);
  }

  const families = Object.values(N).filter((n) => n.kids.length >= 2);
  const batch = db.batch();
  let made = 0;
  const seen = new Set<string>();
  for (const fam of families) {
    const base = resolvedParts(fam.id).map((p) => p.id);
    if (!base.length) continue;
    for (const c of fam.kids) {
      const leaf = N[c.id];
      if (!leaf || seen.has(leaf.id)) continue;
      if (leaf.parts.length && rnd() < 0.5) continue; // some children keep only their real parts
      seen.add(leaf.id);
      let ids = [...base];
      let note = "Follows the parent's parts in the usual order.";
      let flowKind: "sequence" | "loop" | "parallel" | "conditional" =
        "sequence";
      const r = rnd();
      if (r < 0.35) {
        /* keep */
      } else if (r < 0.55) {
        // replace one part with one of its specializations, when it has any
        const cand = ids.filter((p) => N[p]?.kids.length);
        if (cand.length) {
          const p = pick(cand);
          ids[ids.indexOf(p)] = pick(N[p].kids).id;
          note = `Uses a more specific form of “${title(p)}”.`;
        }
      } else if (r < 0.7) {
        ids.splice(Math.floor(rnd() * ids.length), 1);
        note = "One of the parent's parts is not implied by this activity.";
      } else if (r < 0.85) {
        const extra = pick(
          vocabulary.filter((v) => !ids.includes(v) && v !== leaf.id),
        );
        if (extra)
          ids.splice(
            Math.min(ids.length, 1 + Math.floor(rnd() * ids.length)),
            0,
            extra,
          );
        note = "Needs one step the parent does not have.";
      } else if (r < 0.93) {
        flowKind = "loop";
        note = "Repeats for each item handled.";
      } else {
        flowKind = "conditional";
        note = "The last step only happens in some cases.";
      }
      if (rnd() < 0.15 && !ids.includes(fam.id)) {
        ids.splice(1, 0, fam.id);
        note =
          "Reads the activity as a composition that includes its own parent.";
      }
      const flags: { t: string; k: string }[] = [{ t: "mock", k: "info" }];
      if (ids.includes(fam.id))
        flags.push({ t: "step is own ancestor", k: "warn" });
      if (rnd() < 0.2) flags.push({ t: "review: revise", k: "warn" });
      const ref = db.collection("proposals").doc(`alg_${APP}_${leaf.id}`);
      batch.set(ref, {
        kind: "algorithm",
        appName: APP,
        nodeId: leaf.id,
        nodeTitle: leaf.title,
        parentId: fam.id,
        steps: ids.map((id) => ({ id, title: title(id) })),
        flowKind,
        flowNote:
          flowKind === "loop"
            ? "repeat while items remain · stop when none remain"
            : flowKind === "conditional"
              ? "when a discrepancy is found"
              : "",
        rationale: note,
        source: "mock generator, seed 20261016",
        flags,
        mock: true,
        status: "pending",
        decision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      made++;
    }
  }
  await batch.commit();
  console.log(
    `seeded ${made} mock proposals for ${APP} across ${families.length} families`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
