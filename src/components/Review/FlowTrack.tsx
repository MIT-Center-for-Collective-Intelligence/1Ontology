import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { IActivity, IAlgorithm } from "@components/types/INode";
import {
  conditionText,
  kindColor,
} from "../NodBody/AlgorithmFlowVisualizer/FlowGenerator";

/**
 * One flow drawn from the left: tasks as pills on a track, a condition as a
 * yes and a no lane that rejoin, the steps of a loop boxed together under a
 * caption. A parallel block forks into one lane per branch, which rejoin.
 * Wraps when the row is long. With `parts` it lists the tasks only, each
 * once, with no track: what the activity is made of, not how it runs.
 */
type Props = {
  algorithm: IAlgorithm;
  dark: boolean;
  titleOf?: (id: string) => string;
  /** True tints the pill: the task is one the flows share. */
  shared?: (key: string) => boolean;
  /** Makes each task a button; called with the one the reviewer picked. */
  onPick?: (task: PickedTask) => void;
  /** The key of the picked task, which is outlined. */
  picked?: string | null;
  /** What to say on a task: a short badge after its name, more on hover,
   * and whether it steps back (another selection does not include it). */
  mark?: (task: PickedTask) => TaskMark | undefined;
  /** True lists the tasks as pills, each once, and draws no track. */
  parts?: boolean;
};

/** A task of a flow: `partId` is the activity it is bound to, if any. */
export type PickedTask = { key: string; partId: string | null; text: string };

export type TaskMark = {
  badge?: string;
  /** "new" tints the badge: a step that is not in the ontology yet. */
  tone?: "new";
  tip?: string;
  dim?: boolean;
};

// One unit on the track. Only tasks carry a key.
type Slot = {
  kind: "task" | "cond" | "branches" | "par";
  key: string | null;
  partId?: string | null;
  text: string;
  loop?: { id: number; label: string };
  yes?: Slot[];
  no?: Slot[];
  /** A parallel block: its branches, in order. */
  lanes?: Slot[][];
};

const MAX_CHARS = 26;
const shorten = (t: string, max = MAX_CHARS) =>
  t.length > max ? t.slice(0, max - 1) + "…" : t;

function flatten(alg: IAlgorithm, titleOf?: (id: string) => string): Slot[] {
  let loopSeq = 0;
  const label = (a: IActivity) =>
    a.name?.trim() || (a.partId && titleOf ? titleOf(a.partId) : "") || "…";
  const walk = (a: IActivity): Slot[] => {
    const kids = a.sub_activities || [];
    switch (a.type) {
      case "sequential":
        return kids.flatMap(walk);
      case "parallel": {
        // one lane per branch; a block of one branch is a plain run
        const lanes = kids.map(walk).filter((l) => l.length);
        if (lanes.length < 2) return lanes.flat();
        return [{ kind: "par", key: null, text: "", lanes }];
      }
      case "loop": {
        const id = ++loopSeq;
        const text = conditionText(a.loop_condition ?? a.condition) || "";
        return kids
          .flatMap(walk)
          .map((s) => ({ ...s, loop: s.loop ?? { id, label: text } }));
      }
      case "condition": {
        const text =
          conditionText(a.condition) || a.name?.trim() || "condition";
        return [
          { kind: "cond", key: null, text },
          {
            kind: "branches",
            key: null,
            text: "",
            yes: kids[0] ? walk(kids[0]) : [],
            no: kids.slice(1).flatMap(walk),
          },
        ];
      }
      default: {
        const text = label(a);
        return [
          {
            kind: "task",
            key: a.partId || text,
            partId: a.partId || null,
            text,
          },
        ];
      }
    }
  };
  return walk(alg as unknown as IActivity);
}

const FlowTrack = ({
  algorithm,
  dark,
  titleOf,
  shared,
  onPick,
  picked,
  mark,
  parts,
}: Props) => {
  const c = {
    line: dark ? "#6f757c" : "#b8c0c8",
    text: dark ? "#c9ced3" : "#4b5560",
    box: dark ? "#2a2b2d" : "#eef1f4",
    card: dark ? "#1b1b1c" : "#fff",
    sharedBox: dark ? "#25382a" : "#e2f2e5",
    hl: dark ? "#8fd7ad" : "#2a8a5c",
    cond: kindColor("condition", dark),
    loop: kindColor("loop", dark),
    loopBg: dark ? "rgba(129,199,132,0.08)" : "rgba(67,160,71,0.06)",
  };

  const pill = (s: Slot, k: string) => {
    const cond = s.kind === "cond";
    const text = cond && !s.text.endsWith("?") ? `${s.text}?` : s.text;
    const key = cond ? null : s.key;
    const on = !!key && !!shared?.(key);
    const lit = !!key && picked === key;
    const task = key ? { key, partId: s.partId ?? null, text } : null;
    const pick = task && onPick ? () => onPick(task) : undefined;
    const m = task ? mark?.(task) : undefined;
    // The full name on hover, since long ones are cut, with what is known
    // about the step after it.
    return (
      <Tooltip
        key={k}
        title={m?.tip ? `${text} · ${m.tip}` : text}
        describeChild
        enterDelay={150}
        placement="top"
        arrow
      >
        <Box
          component="span"
          data-dim={m?.dim || undefined}
          {...(pick
            ? {
                role: "button",
                tabIndex: 0,
                "aria-pressed": lit,
                onClick: pick,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick();
                  }
                },
              }
            : {})}
          sx={{
            display: "inline-block",
            verticalAlign: "middle",
            px: 1.25,
            py: 0.5,
            borderRadius: "8px",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            bgcolor: cond ? c.card : on ? c.sharedBox : c.box,
            color: cond ? c.cond : c.text,
            border: cond ? `1px solid ${c.cond}` : "none",
            fontWeight: cond ? 500 : 400,
            ...(pick
              ? { cursor: "pointer", "&:hover": { color: "text.primary" } }
              : {}),
            ...(lit ? { boxShadow: `0 0 0 1px ${c.hl}` } : {}),
            ...(m?.dim ? { opacity: 0.35 } : {}),
          }}
        >
          {shorten(text)}
          {m?.badge && (
            <Box
              component="span"
              aria-hidden
              data-badge
              sx={{
                ml: "6px",
                fontSize: 11,
                fontWeight: 600,
                color: m.tone === "new" ? c.cond : c.hl,
              }}
            >
              {m.badge}
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };
  // A small label on a lane: "yes" or "no".
  const tag = (t: string) => (
    <Box
      component="span"
      sx={{
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        px: 0.6,
        py: "4px",
        borderRadius: "5px",
        color: c.cond,
        border: `1px solid ${c.cond}`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {t}
    </Box>
  );
  const joint = (k: string) => (
    <Box
      key={k}
      component="span"
      sx={{
        display: "inline-block",
        width: 8,
        height: "1px",
        bgcolor: c.line,
        flexShrink: 0,
      }}
    />
  );
  // One side of a fork or join: a bar from the first lane's centre to the
  // last's, with a stub into this lane.
  const fork = (
    side: "left" | "right",
    first: boolean,
    last: boolean,
    color = c.cond,
  ) => {
    const v = {
      [side === "left" ? "borderLeft" : "borderRight"]: `1px solid ${color}`,
    };
    return (
      <Box
        component="span"
        data-join={side === "right" || undefined}
        sx={{
          display: "flex",
          flexDirection: "column",
          width: 12,
          flexShrink: 0,
        }}
      >
        <Box
          component="span"
          sx={{
            flex: 1,
            borderBottom: `1px solid ${c.line}`,
            ...(first ? {} : v),
          }}
        />
        <Box component="span" sx={{ flex: 1, ...(last ? {} : v) }} />
      </Box>
    );
  };
  // A lane between a fork and a join; an empty lane is a dashed bypass.
  // A condition's lanes carry a tag; a parallel block's carry none. An
  // open lane ends the track: no line after its steps and no join.
  const lane = (
    k: string,
    steps: Slot[],
    label: string,
    first: boolean,
    last: boolean,
    color?: string,
    open?: boolean,
  ) => (
    <Box
      key={k}
      component="span"
      sx={{ display: "flex", alignItems: "stretch" }}
    >
      {fork("left", first, last, color)}
      <Box
        component="span"
        sx={{ flex: 1, display: "flex", alignItems: "center", py: "3px" }}
      >
        {label && tag(label)}
        {joint(`${k}t`)}
        {steps.length > 0 && run(steps, k)}
        {!open && (
          <Box
            component="span"
            sx={{
              flex: 1,
              minWidth: 12,
              borderTop: `1px ${steps.length ? "solid" : "dashed"} ${c.line}`,
            }}
          />
        )}
      </Box>
      {!open && fork("right", first, last, color)}
    </Box>
  );
  const stacked = {
    display: "inline-flex",
    flexDirection: "column" as const,
    alignItems: "stretch",
  };
  // `tail`: the slot ends the track, so a parallel block stays open.
  const draw = (s: Slot, k: string, tail = false): React.ReactNode =>
    s.kind === "branches" ? (
      <Box key={k} component="span" sx={stacked}>
        {lane(`${k}y`, s.yes || [], "yes", true, false)}
        {lane(`${k}n`, s.no || [], "no", false, true)}
      </Box>
    ) : s.kind === "par" ? (
      <Box
        key={k}
        component="span"
        data-par={s.lanes!.length}
        title="in parallel"
        sx={stacked}
      >
        {s.lanes!.map((steps, i) =>
          lane(
            `${k}p${i}`,
            steps,
            "",
            i === 0,
            i === s.lanes!.length - 1,
            c.line,
            tail,
          ),
        )}
      </Box>
    ) : (
      pill(s, k)
    );
  // Loop labels are stored as the condition; "until …" and "while …" read
  // as they are, anything else is the condition the loop repeats on.
  const loopText = (label: string) =>
    !label
      ? "repeat"
      : /^(until|while|for|as long as)\b/i.test(label)
        ? `repeat ${label}`
        : `repeat while ${label}`;
  // The steps of one loop in a box with its caption on top.
  const loopBox = (k: string, label: string, inner: React.ReactNode) => (
    <Box
      key={k}
      component="span"
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        border: `1px solid ${c.loop}`,
        borderRadius: "10px",
        bgcolor: c.loopBg,
        px: 1,
        pt: "4px",
        pb: "8px",
        maxWidth: "100%",
      }}
    >
      <Typography
        component="span"
        title={label}
        sx={{
          fontSize: 10,
          fontWeight: 600,
          color: c.loop,
          lineHeight: 1.4,
          whiteSpace: "nowrap",
          mb: "4px",
        }}
      >
        ↻ {shorten(loopText(label), 44)}
      </Typography>
      <Box
        component="span"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          rowGap: "4px",
        }}
      >
        {inner}
      </Box>
    </Box>
  );
  // The track: consecutive steps of one loop are boxed together. At the
  // top level the last slot ends the track.
  const run = (seq: Slot[], k: string, top = false): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < seq.length) {
      if (out.length) out.push(joint(`${k}j${i}`));
      const loop = seq[i].loop;
      if (!loop) {
        out.push(draw(seq[i], `${k}s${i}`, top && i === seq.length - 1));
        i++;
        continue;
      }
      let j = i;
      while (j < seq.length && seq[j].loop?.id === loop.id) j++;
      const inner = seq
        .slice(i, j)
        .map((s, x) => [
          x ? joint(`${k}gj${i}${x}`) : null,
          draw(s, `${k}gs${i}${x}`),
        ]);
      out.push(loopBox(`${k}g${i}`, loop.label, inner));
      i = j;
    }
    return out;
  };

  // The parts: every task once, in reading order, branches and lanes
  // included, with nothing drawn between them.
  const partsOf = (slots: Slot[]) => {
    const out: Slot[] = [];
    const seen = new Set<string>();
    const walk = (s: Slot) => {
      if (s.kind === "task" && s.key && !seen.has(s.key)) {
        seen.add(s.key);
        out.push(s);
      }
      [...(s.yes || []), ...(s.no || []), ...(s.lanes || []).flat()].forEach(
        walk,
      );
    };
    slots.forEach(walk);
    return out;
  };

  const slots = flatten(algorithm, titleOf);
  return (
    <Box
      component="span"
      data-parts={parts || undefined}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        rowGap: "6px",
        columnGap: parts ? "6px" : 0,
        minWidth: 0,
      }}
    >
      {parts
        ? partsOf(slots).map((s, i) => pill(s, `p${i}`))
        : run(slots, "f", true)}
    </Box>
  );
};

export default FlowTrack;
