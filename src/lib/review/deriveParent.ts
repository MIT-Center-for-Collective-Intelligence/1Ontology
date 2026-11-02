/**
 * Builds a generalization's flow from the accepted flows of its
 * specializations. A task becomes a step when at least half of the flows do
 * it; steps take the order most flows use; a run of steps that most of those
 * flows repeat becomes a loop, and a run most of them do only on a condition
 * becomes a condition's Y branch, each labelled with the most common text.
 */
import { IActivity, IAlgorithm } from "@components/types/INode";
import { conditionText } from "@components/components/NodBody/AlgorithmFlowVisualizer/FlowGenerator";

type Seen = {
  key: string;
  pos: number; // 0..1 along the flow
  loop: string | null; // label of the innermost loop around it
  cond: string | null; // text of the condition whose Y branch holds it
  par: boolean;
};

const walkFlow = (alg: IAlgorithm): Seen[] => {
  const out: Seen[] = [];
  const go = (
    a: IActivity,
    ctx: { loop: string | null; cond: string | null; par: boolean },
  ) => {
    const kids = a.sub_activities || [];
    switch (a.type) {
      case "loop": {
        const label = conditionText(a.loop_condition ?? a.condition) || "";
        kids.forEach((k) => go(k, { ...ctx, loop: label }));
        return;
      }
      case "condition": {
        const text = conditionText(a.condition) || a.name?.trim() || "";
        kids.forEach((k, i) =>
          go(k, { ...ctx, cond: i === 0 ? text : ctx.cond }),
        );
        return;
      }
      case "parallel":
        kids.forEach((k) => go(k, { ...ctx, par: true }));
        return;
      case "sequential":
        kids.forEach((k) => go(k, ctx));
        return;
      default:
        if (a.partId) out.push({ key: a.partId, pos: 0, ...ctx });
    }
  };
  go(alg as unknown as IActivity, { loop: null, cond: null, par: false });
  out.forEach((s, i) => (s.pos = out.length > 1 ? i / (out.length - 1) : 0));
  return out;
};

const mostCommon = (xs: string[]) => {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) || 0) + 1);
  return (
    [...n].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ||
    ""
  );
};

export type Derived = {
  algorithm: IAlgorithm;
  /** how many of the flows do each task (all tasks, not only the steps) */
  counts: Map<string, number>;
  total: number;
  /** tasks that did not make it, most common first */
  leftOut: { id: string; count: number }[];
};

export function deriveParentFlow(
  name: string,
  flows: IAlgorithm[],
  titleOf: (id: string) => string,
): Derived {
  const total = flows.length;
  const seen = flows.map(walkFlow);
  const counts = new Map<string, number>();
  const pos = new Map<string, number[]>();
  const inLoop = new Map<string, string[]>();
  const inCond = new Map<string, string[]>();
  const inPar = new Map<string, number>();
  for (const flow of seen) {
    const done = new Set<string>();
    for (const s of flow) {
      if (done.has(s.key)) continue; // a repeated task counts once per flow
      done.add(s.key);
      counts.set(s.key, (counts.get(s.key) || 0) + 1);
      pos.set(s.key, [...(pos.get(s.key) || []), s.pos]);
      // any occurrence inside a loop / a Y branch / a parallel block counts
      const all = flow.filter((x) => x.key === s.key);
      const loop = all.find((x) => x.loop !== null)?.loop;
      if (typeof loop === "string")
        inLoop.set(s.key, [...(inLoop.get(s.key) || []), loop]);
      const cond = all.find((x) => x.cond !== null)?.cond;
      if (typeof cond === "string")
        inCond.set(s.key, [...(inCond.get(s.key) || []), cond]);
      if (all.some((x) => x.par)) inPar.set(s.key, (inPar.get(s.key) || 0) + 1);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const steps = [...counts]
    .filter(([, n]) => n * 2 >= total)
    .map(([key, n]) => ({
      key,
      n,
      at: mean(pos.get(key) || [0]),
      loop: (inLoop.get(key) || []).length * 2 >= n,
      cond: (inCond.get(key) || []).length * 2 >= n,
      par: (inPar.get(key) || 0) * 2 >= n,
    }))
    .sort((a, b) => a.at - b.at || b.n - a.n);
  const leftOut = [...counts]
    .filter(([, n]) => n * 2 < total)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count }));

  let seq = 0;
  const task = (key: string): IActivity => ({
    id: `S${++seq}`,
    name: titleOf(key),
    type: "task",
    partId: key,
  });
  // Group consecutive steps that share a flag; a condition can sit inside a
  // loop, a parallel block inside either.
  type Step = (typeof steps)[number];
  const build = (
    list: Step[],
    flag: "loop" | "cond" | "par" | null,
  ): IActivity[] => {
    const out: IActivity[] = [];
    let i = 0;
    const next = { loop: "cond", cond: "par", par: null } as const;
    while (i < list.length) {
      let j = i;
      if (!flag || !list[i][flag]) {
        // a run without this flag: try the next, finer construct on it
        while (j < list.length && (!flag || !list[j][flag])) j++;
        const run = list.slice(i, j);
        if (flag) out.push(...build(run, next[flag]));
        else out.push(...run.map((s) => task(s.key)));
        i = j;
        continue;
      }
      while (j < list.length && list[j][flag]) j++;
      const run = list.slice(i, j);
      if (flag === "loop") {
        const label = mostCommon(run.flatMap((s) => inLoop.get(s.key) || []));
        out.push({
          id: `L${++seq}`,
          name: label,
          type: "loop",
          variables: [],
          loop_condition: label ? { [label]: true } : {},
          sub_activities: build(run, "cond"),
        });
      } else if (flag === "cond") {
        const text = mostCommon(run.flatMap((s) => inCond.get(s.key) || []));
        out.push({
          id: `C${++seq}`,
          name: text,
          type: "condition",
          variables: [],
          condition: text ? { [text]: true } : {},
          sub_activities: [
            {
              id: `Q${++seq}`,
              name: "",
              type: "sequential",
              sub_activities: build(run, "par"),
            },
          ],
        });
      } else {
        out.push({
          id: `P${++seq}`,
          name: "In parallel",
          type: "parallel",
          sub_activities: run.map((s) => task(s.key)),
        });
      }
      i = j;
    }
    return out;
  };
  const algorithm: IAlgorithm = {
    name,
    type: "sequential",
    performance_model: "",
    advantages: "",
    disadvantages: "",
    sub_activities: build(steps, "loop"),
  };
  return { algorithm, counts, total, leftOut };
}

/** A string that is equal for two flows with the same tasks in the same
 * structure, whatever their labels and ids. */
export function flowSignature(alg: IAlgorithm): string {
  const go = (a: IActivity): string => {
    const kids = (a.sub_activities || []).map(go).join(",");
    switch (a.type) {
      case "sequential":
        return kids;
      case "loop":
        return `L(${kids})`;
      case "condition":
        return `C(${kids})`;
      case "parallel":
        return `P(${kids})`;
      default:
        return a.partId || "?";
    }
  };
  return go(alg as unknown as IActivity);
}
