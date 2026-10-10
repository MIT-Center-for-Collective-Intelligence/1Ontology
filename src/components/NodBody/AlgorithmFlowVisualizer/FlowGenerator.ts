import type { Edge, MarkerType, Node } from "@xyflow/react";
import { IActivity, IAlgorithm } from "@components/types/INode";

/**
 * Pure top-to-bottom layout for an algorithm flowchart. Every activity becomes
 * a block with one entry on top and one exit at the bottom, both on the
 * block's axis. Blocks are measured bottom-up, placed top-down, and every edge
 * is a precomputed orthogonal polyline (drawn by OrthoEdge), so nothing
 * depends on React Flow handle positions and uneven branches stay aligned.
 * In edit mode the chart also carries "+" affordances: `add` nodes at the end
 * of every chain and an `insert` hint on every edge between steps.
 */

export type Kind = "task" | "sequential" | "parallel" | "condition" | "loop";

export type FlowNodeType =
  | "task"
  | "decision"
  | "frame"
  | "bar"
  | "merge"
  | "terminal"
  | "add"
  | "placeholder";

export type Placement = "before" | "after" | "inside" | "true" | "false";

/** Where a new step goes when a "+" is clicked. */
export type Insert = { target: IActivity | IAlgorithm; placement: Placement };

export type FlowNodeData = {
  kind: Kind;
  label?: string;
  condition?: string;
  activityId?: string;
  variant?: "start" | "end";
  /** The tree node this element stands for (the algorithm itself for the root fork). */
  activity?: IActivity | IAlgorithm;
  insert?: Insert;
  needsSetup?: boolean;
};

export type Pt = { x: number; y: number };

export type OrthoEdgeData = {
  points: Pt[];
  color: string;
  dashed?: boolean;
  insert?: Insert;
};

export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowEdge = Edge<OrthoEdgeData, "ortho">;

export interface FlowGenerationResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

export const SIZE = {
  task: { w: 224, h: 60 },
  decision: { w: 240, h: 96 },
  terminal: { w: 116, h: 38 },
  placeholder: { w: 168, h: 40 },
  add: 28,
  merge: 8,
  barH: 6,
  barCap: 20,
  // Room for the name chip that sits on the fork bar's entry point.
  barLabel: 24,
};

/** Horizontal offset of the If / Else tabs from the decision card's axis. */
export const TAB_DX = 60;

const GAP_V = 44;
const GAP_H = 56;
const FRAME_PAD = 24;
// Space under a frame's top edge for its header chip.
const FRAME_HEAD = 40;
// A condition fans out below its tabs: a short drop, a horizontal run to
// each branch axis, then down into the branch.
const SPLIT_DROP = 26;
const COND_GAP = 72;
const MIN_SPLIT = TAB_DX + 12;
const BYPASS_GAP = 48;

/** Shared palette: node fills/strokes, legend chips and minimap. */
export const kindColor = (kind: Kind, dark: boolean): string => {
  switch (kind) {
    case "sequential":
      return dark ? "#90caf9" : "#1976d2";
    case "parallel":
      return dark ? "#ce93d8" : "#9c27b0";
    case "condition":
      return dark ? "#ffb74d" : "#f57c00";
    case "loop":
      return dark ? "#81c784" : "#43a047";
    case "task":
    default:
      return dark ? "#b0bec5" : "#607d8b";
  }
};

export const edgeColor = (dark: boolean): string =>
  dark ? "#6b7682" : "#9aa4b0";

// Stored as { "<expr>": true }, but the model sometimes returns a plain string.
export const conditionText = (condition: unknown): string | undefined => {
  if (!condition) return undefined;
  if (typeof condition === "string") return condition;
  const keys = Object.keys(condition as object);
  return keys.length ? keys[0] : undefined;
};

/** A step that still needs a name or an expression; shown as a chip in edit mode. */
export const needsSetup = (a: IActivity): boolean => {
  if (!a.name?.trim()) return true;
  if (a.type === "condition") return !conditionText(a.condition);
  if (a.type === "loop") return !conditionText(a.loop_condition ?? a.condition);
  return false;
};

type Block = { w: number; h: number; axis: number };

type ParallelMeasure = Block & {
  colAxes: number[];
  barLeft: number;
  barRight: number;
  labelH: number;
};

type ConditionMeasure = Block & {
  dL: number;
  dR: number;
  branchH: number;
};

/** Where an edge attaches; `step` is the activity the port stands for. */
type Port = { nodeId: string; x: number; y: number; step?: IActivity };

type Placed = { entry: Port; exit: Port };

/** One element of a vertical chain: a step, a "+" button, or an empty hint. */
type Elem = { step: IActivity } | { add: Insert } | { placeholder: true };

const KINDS: Kind[] = ["task", "sequential", "parallel", "condition", "loop"];
const kindOf = (a: IActivity): Kind =>
  KINDS.includes(a.type as Kind) ? (a.type as Kind) : "task";
const children = (a: IActivity | IAlgorithm): IActivity[] =>
  Array.isArray(a.sub_activities) ? a.sub_activities.filter(Boolean) : [];

/** Drops repeated consecutive points so rounded corners never see a zero-length segment. */
const dedupe = (pts: Pt[]): Pt[] =>
  pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);

export class FlowGenerator {
  private nodes: FlowNode[] = [];
  private edges: FlowEdge[] = [];
  private counter = 0;
  private measured = new WeakMap<IActivity, Block>();
  private falseBranches = new WeakMap<IActivity, IActivity | null>();
  private branchElems = new WeakMap<IActivity, (Elem[] | null)[]>();

  constructor(
    private dark: boolean,
    private editing = false,
  ) {}

  public generateFlow(algorithm: IAlgorithm): FlowGenerationResult {
    this.nodes = [];
    this.edges = [];
    this.counter = 0;

    const kids = children(algorithm);
    const T = SIZE.terminal;
    const rootParallel = algorithm.type === "parallel" && kids.length > 0;
    const rootElems = this.chainElems(kids, {
      target: algorithm,
      placement: "inside",
    });
    const body = rootParallel
      ? this.measureParallel(this.parallelBranches(kids, algorithm), false)
      : this.measureChain(rootElems);
    const axis = Math.max(body.axis, T.w / 2);
    const width = Math.max(body.w, T.w);

    const startId = this.addNode("terminal", axis - T.w / 2, 0, T.w, T.h, {
      kind: "task",
      label: "Start",
      variant: "start",
    });
    const top = T.h + GAP_V;
    const placed = rootParallel
      ? this.placeParallel(
          this.parallelBranches(kids, algorithm),
          axis,
          top,
          undefined,
          algorithm,
        )
      : this.placeChain(rootElems, axis, top);
    this.connect({ nodeId: startId, x: axis, y: T.h }, placed.entry);

    const endY = top + body.h + GAP_V;
    const endId = this.addNode("terminal", axis - T.w / 2, endY, T.w, T.h, {
      kind: "task",
      label: "End",
      variant: "end",
    });
    this.connect(placed.exit, { nodeId: endId, x: axis, y: endY });

    return {
      nodes: this.nodes,
      edges: this.edges,
      width,
      height: endY + T.h,
    };
  }

  /** Steps of a container, plus a trailing "+" in edit mode or a hint when empty. */
  private chainElems(kids: IActivity[], trailing: Insert): Elem[] {
    const elems: Elem[] = kids.map((step) => ({ step }));
    if (this.editing) elems.push({ add: trailing });
    else if (elems.length === 0) elems.push({ placeholder: true });
    return elems;
  }

  /** One single-element chain per branch, plus an "add branch" row in edit mode. */
  private parallelBranches(
    kids: IActivity[],
    container: IActivity | IAlgorithm,
  ): Elem[][] {
    const branches: Elem[][] = kids.map((step) => [{ step }]);
    if (this.editing) {
      branches.push([{ add: { target: container, placement: "inside" } }]);
    }
    return branches;
  }

  /** children[0] is the true branch; children[1..] collapse into one false branch. */
  private falseBranchOf(a: IActivity): IActivity | null {
    if (this.falseBranches.has(a)) return this.falseBranches.get(a)!;
    const kids = children(a);
    let result: IActivity | null = null;
    if (kids.length === 2) result = kids[1];
    else if (kids.length > 2) {
      result = {
        name: "",
        id: "",
        type: "sequential",
        sub_activities: kids.slice(1),
      };
    }
    this.falseBranches.set(a, result);
    return result;
  }

  /** Chain for a condition branch; null means "no branch" (a bypass line). */
  private conditionBranch(a: IActivity, slot: 0 | 1): Elem[] | null {
    let cached = this.branchElems.get(a);
    if (!cached) {
      const kids = children(a);
      const build = (step: IActivity | null, placement: "true" | "false") => {
        const elems: Elem[] = step ? [{ step }] : [];
        if (this.editing) elems.push({ add: { target: a, placement } });
        return elems.length ? elems : null;
      };
      cached = [
        build(kids[0] ?? null, "true"),
        build(this.falseBranchOf(a), "false"),
      ];
      this.branchElems.set(a, cached);
    }
    return cached[slot];
  }

  private measureElem(e: Elem): Block {
    if ("step" in e) return this.measure(e.step);
    if ("add" in e) return this.boxBlock({ w: SIZE.add, h: SIZE.add });
    return this.boxBlock(SIZE.placeholder);
  }

  private measure(a: IActivity): Block {
    const cached = this.measured.get(a);
    if (cached) return cached;
    const kids = children(a);
    let block: Block;
    switch (kindOf(a)) {
      case "sequential":
      case "loop":
        block = this.measureChain(
          this.chainElems(kids, { target: a, placement: "inside" }),
          true,
        );
        break;
      case "parallel":
        block = kids.length
          ? this.measureParallel(this.parallelBranches(kids, a), !!a.name)
          : this.boxBlock(SIZE.task);
        break;
      case "condition":
        block = this.measureCondition(a);
        break;
      default:
        block = this.boxBlock(SIZE.task);
    }
    this.measured.set(a, block);
    return block;
  }

  private boxBlock(size: { w: number; h: number }): Block {
    return { w: size.w, h: size.h, axis: size.w / 2 };
  }

  private measureChain(elems: Elem[], framed = false): Block {
    let leftExt = 0;
    let rightExt = 0;
    let h = 0;
    elems.forEach((e, i) => {
      const b = this.measureElem(e);
      leftExt = Math.max(leftExt, b.axis);
      rightExt = Math.max(rightExt, b.w - b.axis);
      h += b.h + (i > 0 ? GAP_V : 0);
    });
    if (!framed) return { w: leftExt + rightExt, h, axis: leftExt };
    return {
      w: leftExt + rightExt + 2 * FRAME_PAD,
      h: h + FRAME_HEAD + 2 * FRAME_PAD,
      axis: leftExt + FRAME_PAD,
    };
  }

  private measureParallel(
    branches: Elem[][],
    labeled: boolean,
  ): ParallelMeasure {
    const colAxes: number[] = [];
    let x = 0;
    let maxH = 0;
    branches.forEach((chain, i) => {
      const b = this.measureChain(chain);
      if (i > 0) x += GAP_H;
      colAxes.push(x + b.axis);
      x += b.w;
      maxH = Math.max(maxH, b.h);
    });
    const first = colAxes[0];
    const lastAxis = colAxes[colAxes.length - 1];
    const cap = branches.length === 1 ? 40 : SIZE.barCap;
    let barLeft = first - cap;
    let barRight = lastAxis + cap;
    const minX = Math.min(0, barLeft);
    const maxX = Math.max(x, barRight);
    const shift = -minX;
    barLeft += shift;
    barRight += shift;
    const axes = colAxes.map((c) => c + shift);
    const labelH = labeled ? SIZE.barLabel : 0;
    return {
      w: maxX - minX,
      h: labelH + SIZE.barH + GAP_V + maxH + GAP_V + SIZE.barH,
      axis: (axes[0] + axes[axes.length - 1]) / 2,
      colAxes: axes,
      barLeft,
      barRight,
      labelH,
    };
  }

  private measureCondition(a: IActivity): ConditionMeasure {
    const D = SIZE.decision;
    const ifE = this.conditionBranch(a, 0);
    const elseE = this.conditionBranch(a, 1);
    const ifB = ifE ? this.measureChain(ifE) : null;
    const elseB = elseE ? this.measureChain(elseE) : null;
    const dL = ifB
      ? Math.max(GAP_H / 2 + (ifB.w - ifB.axis), MIN_SPLIT)
      : D.w / 2 + BYPASS_GAP;
    const dR = elseB
      ? Math.max(GAP_H / 2 + elseB.axis, MIN_SPLIT)
      : D.w / 2 + BYPASS_GAP;
    const leftExt = Math.max(dL + (ifB ? ifB.axis : 0), D.w / 2);
    const rightExt = Math.max(dR + (elseB ? elseB.w - elseB.axis : 0), D.w / 2);
    const branchH = Math.max(ifB?.h ?? 0, elseB?.h ?? 0);
    return {
      w: leftExt + rightExt,
      h: D.h + COND_GAP + branchH + GAP_V + SIZE.merge,
      axis: leftExt,
      dL,
      dR,
      branchH,
    };
  }

  private placeElem(e: Elem, axis: number, top: number): Placed {
    if ("step" in e) return this.placeBlock(e.step, axis, top);
    if ("add" in e) {
      const s = SIZE.add;
      const id = this.addNode("add", axis - s / 2, top, s, s, {
        kind: "task",
        insert: e.add,
      });
      return {
        entry: { nodeId: id, x: axis, y: top },
        exit: { nodeId: id, x: axis, y: top + s },
      };
    }
    const P = SIZE.placeholder;
    const id = this.addNode("placeholder", axis - P.w / 2, top, P.w, P.h, {
      kind: "task",
      label: "No steps",
    });
    return {
      entry: { nodeId: id, x: axis, y: top },
      exit: { nodeId: id, x: axis, y: top + P.h },
    };
  }

  /** Places a step and tags both ports with it, so edges around it know what they border. */
  private placeBlock(a: IActivity, axis: number, top: number): Placed {
    const kids = children(a);
    let placed: Placed;
    switch (kindOf(a)) {
      case "sequential":
      case "loop":
        placed = this.placeFrame(a, axis, top);
        break;
      case "parallel":
        placed = kids.length
          ? this.placeParallel(
              this.parallelBranches(kids, a),
              axis,
              top,
              a.name ? a : undefined,
              a,
            )
          : this.placeBox(a, axis, top);
        break;
      case "condition":
        placed = this.placeCondition(a, axis, top);
        break;
      default:
        placed = this.placeBox(a, axis, top);
    }
    return {
      entry: { ...placed.entry, step: a },
      exit: { ...placed.exit, step: a },
    };
  }

  private placeBox(a: IActivity, axis: number, top: number): Placed {
    const size = SIZE.task;
    const id = this.addNode("task", axis - size.w / 2, top, size.w, size.h, {
      kind: kindOf(a),
      label: a.name,
      activityId: a.id,
      activity: a,
      needsSetup: this.editing && needsSetup(a),
    });
    return {
      entry: { nodeId: id, x: axis, y: top },
      exit: { nodeId: id, x: axis, y: top + size.h },
    };
  }

  private placeChain(elems: Elem[], axis: number, top: number): Placed {
    let y = top;
    let entry: Port | null = null;
    let prev: Port | null = null;
    for (const e of elems) {
      const placed = this.placeElem(e, axis, y);
      if (prev) this.connect(prev, placed.entry);
      else entry = placed.entry;
      prev = placed.exit;
      y += this.measureElem(e).h + GAP_V;
    }
    return { entry: entry!, exit: prev! };
  }

  /** Loop body or nested sequence: a tinted region with a header chip. */
  private placeFrame(a: IActivity, axis: number, top: number): Placed {
    const kind = kindOf(a) === "loop" ? "loop" : "sequential";
    const elems = this.chainElems(children(a), {
      target: a,
      placement: "inside",
    });
    const m = this.measureChain(elems, true);
    this.addNode(
      "frame",
      axis - m.axis,
      top,
      m.w,
      m.h,
      {
        kind,
        label: a.name,
        activityId: a.id,
        activity: a,
        condition:
          kind === "loop"
            ? conditionText(a.loop_condition ?? a.condition)
            : undefined,
        needsSetup: this.editing && needsSetup(a),
      },
      -1,
    );
    return this.placeChain(elems, axis, top + FRAME_HEAD + FRAME_PAD);
  }

  private placeParallel(
    branches: Elem[][],
    axis: number,
    top: number,
    labelOf: IActivity | undefined,
    container: IActivity | IAlgorithm,
  ): Placed {
    const m = this.measureParallel(branches, !!labelOf);
    const left = axis - m.axis;
    const barX = left + m.barLeft;
    const barW = m.barRight - m.barLeft;
    const forkY = top + m.labelH;
    const forkId = this.addNode("bar", barX, forkY, barW, SIZE.barH, {
      kind: "parallel",
      label: labelOf?.name,
      activityId: labelOf?.id,
      activity: container,
    });

    const kidTop = forkY + SIZE.barH + GAP_V;
    let maxBottom = kidTop;
    const exits: { port: Port; axis: number }[] = [];
    branches.forEach((chain, i) => {
      const kAxis = left + m.colAxes[i];
      const placed = this.placeChain(chain, kAxis, kidTop);
      this.connect(
        { nodeId: forkId, x: kAxis, y: forkY + SIZE.barH },
        placed.entry,
      );
      exits.push({ port: placed.exit, axis: kAxis });
      maxBottom = Math.max(maxBottom, kidTop + this.measureChain(chain).h);
    });

    const joinY = maxBottom + GAP_V;
    const joinId = this.addNode("bar", barX, joinY, barW, SIZE.barH, {
      kind: "parallel",
    });
    for (const { port, axis: kAxis } of exits) {
      this.connect(
        port,
        { nodeId: joinId, x: kAxis, y: joinY },
        { arrow: false },
      );
    }
    return {
      entry: { nodeId: forkId, x: axis, y: forkY },
      exit: { nodeId: joinId, x: axis, y: joinY + SIZE.barH },
    };
  }

  private placeCondition(a: IActivity, axis: number, top: number): Placed {
    const m = this.measureCondition(a);
    const D = SIZE.decision;
    const M = SIZE.merge;
    const decisionId = this.addNode("decision", axis - D.w / 2, top, D.w, D.h, {
      kind: "condition",
      label: a.name,
      activityId: a.id,
      condition: conditionText(a.condition),
      activity: a,
      needsSetup: this.editing && needsSetup(a),
    });
    const bottom = top + D.h;
    const splitY = bottom + SPLIT_DROP;
    const branchTop = bottom + COND_GAP;
    const mergeY = branchTop + m.branchH + GAP_V;
    const joinY = mergeY - SPLIT_DROP;
    const mergeId = this.addNode("merge", axis - M / 2, mergeY, M, M, {
      kind: "condition",
    });

    const branch = (elems: Elem[] | null, bAxis: number, tabX: number) => {
      const fan: Pt[] = [
        { x: tabX, y: bottom },
        { x: tabX, y: splitY },
        { x: bAxis, y: splitY },
      ];
      const toMerge = (from: Pt): Pt[] => [
        from,
        { x: bAxis, y: joinY },
        { x: axis, y: joinY },
        { x: axis, y: mergeY },
      ];
      if (!elems) {
        this.addEdge(
          decisionId,
          mergeId,
          dedupe([...fan, ...toMerge({ x: bAxis, y: splitY })]),
          { arrow: false },
        );
        return;
      }
      const placed = this.placeChain(elems, bAxis, branchTop);
      this.addEdge(
        decisionId,
        placed.entry.nodeId,
        dedupe([...fan, { x: bAxis, y: placed.entry.y }]),
        { insert: this.insertFor(undefined, placed.entry) },
      );
      this.addEdge(
        placed.exit.nodeId,
        mergeId,
        dedupe(toMerge({ x: bAxis, y: placed.exit.y })),
        { arrow: false, insert: this.insertFor(placed.exit, undefined) },
      );
    };

    branch(this.conditionBranch(a, 0), axis - m.dL, axis - TAB_DX);
    branch(this.conditionBranch(a, 1), axis + m.dR, axis + TAB_DX);

    return {
      entry: { nodeId: decisionId, x: axis, y: top },
      exit: { nodeId: mergeId, x: axis, y: mergeY + M },
    };
  }

  /** "+" on an edge inserts before the step it enters, else after the one it leaves. */
  private insertFor(from?: Port, to?: Port): Insert | undefined {
    if (!this.editing) return undefined;
    if (to?.step) return { target: to.step, placement: "before" };
    if (from?.step) return { target: from.step, placement: "after" };
    return undefined;
  }

  /** Straight when both ports share an axis, otherwise one horizontal jog. */
  private connect(from: Port, to: Port, opts: { arrow?: boolean } = {}): void {
    const pts: Pt[] = [{ x: from.x, y: from.y }];
    if (from.x !== to.x) {
      const midY = (from.y + to.y) / 2;
      pts.push({ x: from.x, y: midY }, { x: to.x, y: midY });
    }
    pts.push({ x: to.x, y: to.y });
    this.addEdge(from.nodeId, to.nodeId, pts, {
      arrow: opts.arrow,
      insert: this.insertFor(from, to),
    });
  }

  private addNode(
    type: FlowNodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    data: FlowNodeData,
    zIndex?: number,
  ): string {
    const id = `n${++this.counter}`;
    this.nodes.push({
      id,
      type,
      position: { x, y },
      data,
      // Explicit dimensions so fitView and the minimap know sizes before measuring.
      width: w,
      height: h,
      draggable: false,
      selectable: false,
      connectable: false,
      ...(zIndex !== undefined ? { zIndex } : {}),
    });
    return id;
  }

  private addEdge(
    source: string,
    target: string,
    points: Pt[],
    opts: { arrow?: boolean; dashed?: boolean; insert?: Insert },
  ): void {
    const color = edgeColor(this.dark);
    const arrow = opts.arrow !== false;
    this.edges.push({
      id: `e${++this.counter}`,
      source,
      target,
      type: "ortho",
      selectable: false,
      data: { points, color, dashed: opts.dashed, insert: opts.insert },
      ...(arrow
        ? {
            markerEnd: {
              // Type-only import keeps this file free of runtime React Flow deps.
              type: "arrowclosed" as unknown as MarkerType,
              color,
              width: 14,
              height: 14,
            },
          }
        : {}),
    });
  }
}
