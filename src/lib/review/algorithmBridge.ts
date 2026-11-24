/**
 * Converts between a review proposal (ordered steps bound to activities plus
 * one control construct) and the platform's IAlgorithm tree that the React
 * Flow editor renders and edits. The editor's tree is the richer form; when it
 * comes back, the steps and the kind are re-derived from it and the full tree
 * is kept on the decision so nothing is lost.
 */
import { IActivity, IAlgorithm } from "@components/types/INode";
import { FlowKind, ProposalStep } from "@components/types/IProposal";

const task = (s: ProposalStep, i: number): IActivity => ({
  id: `S${i + 1}`,
  name: s.title,
  type: "task",
  partId: s.id,
});

export function proposalToAlgorithm(
  name: string,
  steps: ProposalStep[],
  kind: FlowKind,
  note?: string,
): IAlgorithm {
  const tasks = steps.map(task);
  const base = {
    name,
    performance_model: "",
    advantages: "",
    disadvantages: "",
  };
  const [guard, stop] = (note || "").split("·").map((s) => s.trim());
  switch (kind) {
    case "parallel":
      return { ...base, type: "parallel", sub_activities: tasks };
    case "loop":
      return {
        ...base,
        type: "sequential",
        sub_activities: [
          {
            id: "L1",
            name: "Loop",
            type: "loop",
            variables: [],
            loop_condition: guard ? { [guard]: true } : {},
            sub_activities: tasks,
          },
        ],
      };
    case "conditional": {
      const last = tasks[tasks.length - 1];
      const head = tasks.slice(0, -1);
      return {
        ...base,
        type: "sequential",
        sub_activities: [
          ...head,
          ...(last
            ? [
                {
                  id: "C1",
                  name: "Condition",
                  type: "condition" as const,
                  variables: [],
                  condition: guard ? { [guard]: true } : {},
                  sub_activities: [last],
                },
              ]
            : []),
        ],
      };
    }
    default:
      return { ...base, type: "sequential", sub_activities: tasks };
  }
}

/** Ordered task steps (only those bound to an activity) and the construct
 * that best describes the top of the tree. */
export function algorithmToProposal(alg: IAlgorithm): {
  steps: ProposalStep[];
  kind: FlowKind;
  unbound: string[];
} {
  const steps: ProposalStep[] = [];
  const unbound: string[] = [];
  const walk = (a: IActivity) => {
    if (a.type === "task") {
      if (a.partId) steps.push({ id: a.partId, title: a.name });
      else unbound.push(a.name);
    }
    for (const c of a.sub_activities || []) walk(c);
  };
  for (const a of alg.sub_activities) walk(a);
  const top = alg.sub_activities.map((a) => a.type);
  const kind: FlowKind =
    alg.type === "parallel"
      ? "parallel"
      : top.includes("loop")
        ? "loop"
        : top.includes("condition")
          ? "conditional"
          : top.includes("parallel")
            ? "parallel"
            : "sequence";
  return { steps, kind, unbound };
}

/** Makes the tree's tasks match `steps` while keeping its shape: a task whose
 * part is gone goes, a kept task takes the step's title, and a part the tree
 * does not have yet is appended as a task. A construct left empty goes too. */
export function applyPartsToAlgorithm(
  alg: IAlgorithm,
  steps: ProposalStep[],
): IAlgorithm {
  const want = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const prune = (a: IActivity): IActivity | null => {
    if (a.type === "task") {
      if (!a.partId) return a;
      const s = want.get(a.partId);
      if (!s) return null;
      seen.add(a.partId);
      return { ...a, name: s.title };
    }
    const kids = (a.sub_activities || [])
      .map(prune)
      .filter((k): k is IActivity => !!k);
    if (!kids.length && a.sub_activities?.length) return null;
    return { ...a, sub_activities: kids };
  };
  const kept = (alg.sub_activities || [])
    .map(prune)
    .filter((k): k is IActivity => !!k);
  const added = steps
    .filter((s) => !seen.has(s.id))
    .map((s, i) => ({ ...task(s, i), id: `A${i + 1}` }));
  return { ...alg, sub_activities: [...kept, ...added] };
}
