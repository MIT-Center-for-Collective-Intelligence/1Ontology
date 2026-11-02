import { IActivity, IAlgorithm } from "@components/types/INode";
import { Kind, Placement } from "./FlowGenerator";

/**
 * Pure edits on an algorithm tree. Steps are located by object identity in
 * the tree the chart was rendered from, turned into index paths, and every
 * operation returns a fresh deep copy so React and Firestore see new data.
 */

export type Container = IAlgorithm | IActivity;

const kidsOf = (c: Container): IActivity[] =>
  Array.isArray(c.sub_activities) ? c.sub_activities : [];

export const cloneAlgorithm = (a: IAlgorithm): IAlgorithm =>
  JSON.parse(JSON.stringify(a));

/** Index path from `root` down to `target` (by identity), or null. */
export function pathOf(root: Container, target: Container): number[] | null {
  if (target === root) return [];
  const kids = kidsOf(root);
  for (let i = 0; i < kids.length; i++) {
    if (kids[i] === target) return [i];
    const sub = pathOf(kids[i], target);
    if (sub) return [i, ...sub];
  }
  return null;
}

const nodeAt = (root: Container, path: number[]): Container => {
  let cur: Container = root;
  for (const i of path) cur = kidsOf(cur)[i];
  return cur;
};

const listOf = (c: Container): IActivity[] => {
  if (!Array.isArray(c.sub_activities)) c.sub_activities = [];
  return c.sub_activities;
};

export const isContainerKind = (kind: Kind): boolean =>
  kind === "sequential" || kind === "parallel" || kind === "loop";

/** Next free "S<n>" id across the whole algorithm. */
export function nextStepId(root: Container): string {
  const ids = new Set<string>();
  let max = 0;
  const walk = (c: Container) => {
    for (const k of kidsOf(c)) {
      ids.add(k.id);
      const m = /^S(\d+)$/.exec(k.id ?? "");
      if (m) max = Math.max(max, Number(m[1]));
      walk(k);
    }
  };
  walk(root);
  let n = max + 1;
  while (ids.has(`S${n}`)) n++;
  return `S${n}`;
}

export function newStep(
  kind: Kind,
  fields: { id: string; name: string; condition?: string; partId?: string },
): IActivity {
  const base: IActivity = {
    id: fields.id,
    name: fields.name.trim(),
    type: kind,
  };
  const expr = fields.condition?.trim();
  switch (kind) {
    case "condition":
      return {
        ...base,
        variables: [],
        condition: expr ? { [expr]: true } : {},
        sub_activities: [],
      };
    case "loop":
      return {
        ...base,
        variables: [],
        loop_condition: expr ? { [expr]: true } : {},
        sub_activities: [],
      };
    case "sequential":
    case "parallel":
      return { ...base, sub_activities: [] };
    default:
      return fields.partId ? { ...base, partId: fields.partId } : base;
  }
}

/** A freshly added step: named after its kind and flagged "needs setup" until edited. */
export const defaultStep = (kind: Kind, id: string): IActivity =>
  newStep(kind, {
    id,
    name: {
      task: "New task",
      condition: "Condition",
      loop: "Loop",
      parallel: "Parallel",
      sequential: "Sequence",
    }[kind],
  });

export type StepPatch = {
  name?: string;
  condition?: string;
  partId?: string | null;
};

/** Applies field edits from the properties panel to one step. */
export function updateStep(
  root: IAlgorithm,
  target: IActivity,
  patch: StepPatch,
): IAlgorithm {
  const path = pathOf(root, target);
  const next = cloneAlgorithm(root);
  if (!path || path.length === 0) return next;
  const step = nodeAt(next, path) as IActivity;
  if (patch.name !== undefined) step.name = patch.name.trim();
  if (patch.condition !== undefined) {
    const expr = patch.condition.trim();
    const value = expr ? { [expr]: true } : {};
    if (step.type === "loop") step.loop_condition = value;
    else step.condition = value;
  }
  if (patch.partId !== undefined) {
    if (patch.partId) step.partId = patch.partId;
    else delete step.partId;
  }
  return next;
}

/**
 * Puts `step` into a condition's true (slot 0) or false (slot 1) branch, at
 * the start or the end. A branch holds one activity, so an occupied branch
 * becomes a sequence of the old and the new step.
 */
const intoBranch = (
  cond: Container,
  slot: 0 | 1,
  step: IActivity,
  where: "start" | "end",
  wrapId: string,
) => {
  const kids = listOf(cond);
  if (kids.length <= slot) {
    kids.push(step);
    return;
  }
  const existing = kids[slot];
  if (existing.type === "sequential") {
    const list = listOf(existing);
    if (where === "start") list.unshift(step);
    else list.push(step);
    return;
  }
  kids[slot] = {
    id: wrapId,
    name: "",
    type: "sequential",
    sub_activities: where === "start" ? [step, existing] : [existing, step],
  };
};

const place = (
  root: IAlgorithm,
  path: number[],
  placement: Placement,
  step: IActivity,
) => {
  const target = nodeAt(root, path);
  const parent = nodeAt(root, path.slice(0, -1));
  const parentList = listOf(parent);
  const idx = path[path.length - 1];
  // Siblings of a branch are branches: before/after a branch's step stays inside it.
  const inBranch = parent.type === "condition" && idx <= 1;
  switch (placement) {
    case "before":
      if (inBranch)
        intoBranch(parent, idx as 0 | 1, step, "start", nextStepId(root));
      else parentList.splice(idx, 0, step);
      return;
    case "after":
      if (inBranch)
        intoBranch(parent, idx as 0 | 1, step, "end", nextStepId(root));
      else parentList.splice(idx + 1, 0, step);
      return;
    case "inside":
      listOf(target).push(step);
      return;
    case "true":
      intoBranch(target, 0, step, "end", nextStepId(root));
      return;
    case "false":
      intoBranch(target, 1, step, "end", nextStepId(root));
      return;
  }
};

/** Inserts `step` relative to `target`; `target === root` or null appends to the root. */
export function insertStep(
  root: IAlgorithm,
  target: Container | null,
  placement: Placement,
  step: IActivity,
): IAlgorithm {
  const next = cloneAlgorithm(root);
  const path = target ? pathOf(root, target) : null;
  if (!path || path.length === 0) {
    listOf(next).push(step);
    return next;
  }
  place(next, path, placement, step);
  return next;
}

export function removeStep(root: IAlgorithm, target: IActivity): IAlgorithm {
  const path = pathOf(root, target);
  const next = cloneAlgorithm(root);
  if (!path || path.length === 0) return next;
  listOf(nodeAt(next, path.slice(0, -1))).splice(path[path.length - 1], 1);
  return next;
}

/**
 * Moves `step` next to or into `target`. Returns null when the move is
 * impossible (target inside the moved subtree, or either not in the tree).
 */
export function moveStep(
  root: IAlgorithm,
  step: IActivity,
  target: Container,
  placement: Placement,
): IAlgorithm | null {
  const from = pathOf(root, step);
  const to = pathOf(root, target);
  if (!from || from.length === 0 || !to) return null;
  if (step === target) return null;
  const isPrefix = from.every((v, i) => to[i] === v);
  if (isPrefix && to.length >= from.length) return null;

  const next = cloneAlgorithm(root);
  // Tag the original spot first so the insert can't shift its path.
  const moved = nodeAt(next, from) as IActivity & { __moved?: boolean };
  moved.__moved = true;
  const copy = JSON.parse(JSON.stringify(step)) as IActivity;
  if (to.length === 0) listOf(next).push(copy);
  else place(next, to, placement, copy);

  const sweep = (c: Container) => {
    const kids = kidsOf(c);
    for (let i = kids.length - 1; i >= 0; i--) {
      if ((kids[i] as { __moved?: boolean }).__moved) kids.splice(i, 1);
      else sweep(kids[i]);
    }
  };
  sweep(next);
  return next;
}
