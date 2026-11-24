/**
 * How each specialization will inherit from a proposed generalization: its
 * parts matched to the generalization's parts, the way the node page's
 * "Parts inherited from generalizations" view matches them once saved.
 * A specialization part stands for the generalized part with its id, or
 * else for the generalized parts it is a specialization of. The same part
 * in the specialization's own wording is a specialized part (Shuo's ">").
 */
import type {
  PartMapping,
  PartsInheritance,
  ProposalStep,
} from "@components/types/IProposal";

const norm = (t: string) => t.trim().toLowerCase();

export function mapParts(
  generalized: ProposalStep[],
  specialization: ProposalStep[],
  ancestorsOf: (id: string) => string[] = () => [],
): PartMapping[] {
  const gen = dedupe(generalized);
  const spec = dedupe(specialization);
  const genPos = new Map(gen.map((g, i) => [g.id, i]));
  const specPos = new Map(spec.map((s, i) => [s.id, i]));
  const genOf = new Map<string, string[]>(); // spec part -> generalized parts
  const specOf = new Map<string, string[]>(); // generalized part -> spec parts
  for (const s of spec) {
    const hits = genPos.has(s.id)
      ? [s.id]
      : ancestorsOf(s.id).filter((a) => genPos.has(a));
    genOf.set(s.id, hits);
    for (const g of hits) specOf.set(g, [...(specOf.get(g) || []), s.id]);
  }
  // A row of the view holds every part connected through these matches.
  const rowOfSpec = new Map<string, number>();
  const rows: PartMapping[] = [];
  const placedGen = new Set<string>();
  const group = (startGen: string) => {
    const gs = new Set<string>();
    const ss = new Set<string>();
    const queue = [startGen];
    while (queue.length) {
      const g = queue.pop()!;
      if (gs.has(g)) continue;
      gs.add(g);
      for (const s of specOf.get(g) || []) {
        if (ss.has(s)) continue;
        ss.add(s);
        for (const g2 of genOf.get(s) || []) if (!gs.has(g2)) queue.push(g2);
      }
    }
    const generalizedPartIds = [...gs].sort(
      (a, b) => genPos.get(a)! - genPos.get(b)!,
    );
    const specializationPartIds = [...ss].sort(
      (a, b) => specPos.get(a)! - specPos.get(b)!,
    );
    const one = generalizedPartIds.length === 1 && ss.size === 1;
    const [g] = generalizedPartIds;
    const [s] = specializationPartIds;
    const same =
      one &&
      g === s &&
      norm(gen[genPos.get(g)!].title) === norm(spec[specPos.get(s)!].title);
    return {
      generalizedPartIds,
      specializationPartIds,
      relation: same ? "same" : "specialized",
    } as PartMapping;
  };
  // The generalized parts in their order; one the specialization lacks is
  // not inherited.
  for (const g of gen) {
    if (placedGen.has(g.id)) continue;
    if (!specOf.has(g.id)) {
      placedGen.add(g.id);
      rows.push({
        generalizedPartIds: [g.id],
        specializationPartIds: [],
        relation: "notInherited",
      });
      continue;
    }
    const row = group(g.id);
    row.generalizedPartIds.forEach((id) => placedGen.add(id));
    row.specializationPartIds.forEach((id) => rowOfSpec.set(id, rows.length));
    rows.push(row);
  }
  // A part of the specialization's own goes where it sits in its order:
  // after the previous matched part, else before the next, else last.
  let last: number | null = null;
  spec.forEach((s, i) => {
    if (genOf.get(s.id)!.length) {
      last = rows.indexOf(rows[rowOfSpec.get(s.id)!]);
      return;
    }
    const row: PartMapping = {
      generalizedPartIds: [],
      specializationPartIds: [s.id],
      relation: "added",
    };
    let at = rows.length;
    if (last !== null) at = last + 1;
    else {
      const next = spec
        .slice(i + 1)
        .find((x) => genOf.get(x.id)!.length && rowOfSpec.has(x.id));
      if (next) at = rows.indexOf(rows[rowOfSpec.get(next.id)!]);
    }
    rows.splice(at, 0, row);
    // rows after the insertion moved down one
    for (const [id, r] of rowOfSpec) if (r >= at) rowOfSpec.set(id, r + 1);
    rowOfSpec.set(s.id, at);
    last = at;
  });
  return rows;
}

const dedupe = (steps: ProposalStep[]) => {
  const seen = new Set<string>();
  return steps.filter((s) => !seen.has(s.id) && !!seen.add(s.id));
};

/** How many of each symbol a specialization's rows show: a ">" for each
 * specialized part, one "x" or "+" per row. */
export function countRelations(mapping: PartMapping[]) {
  const n = { specialized: 0, notInherited: 0, added: 0 };
  for (const m of mapping) {
    if (m.relation === "specialized")
      n.specialized += Math.max(1, m.specializationPartIds.length);
    else if (m.relation === "notInherited") n.notInherited += 1;
    else if (m.relation === "added") n.added += 1;
  }
  return n;
}

/** The symbol summary beside a specialization, "› 10 · × 1 · + 1"; zero
 * counts are left out, so it is empty when every part is the same. */
export const relationSummary = (mapping: PartMapping[]) => {
  const n = countRelations(mapping);
  return [
    n.specialized && `› ${n.specialized}`,
    n.notInherited && `× ${n.notInherited}`,
    n.added && `+ ${n.added}`,
  ]
    .filter(Boolean)
    .join(" · ");
};

/** The inheritance of every accepted specialization, keyed by node id. */
export function inheritanceOf(
  generalized: ProposalStep[],
  specializations: { id: string; steps: ProposalStep[] }[],
  ancestorsOf: (id: string) => string[] = () => [],
): PartsInheritance {
  const out: PartsInheritance = {};
  for (const s of specializations)
    out[s.id] = mapParts(generalized, s.steps, ancestorsOf);
  return out;
}
