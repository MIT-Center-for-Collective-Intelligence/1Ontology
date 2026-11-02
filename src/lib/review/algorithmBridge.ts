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
