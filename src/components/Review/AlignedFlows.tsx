import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { IActivity, IAlgorithm } from "@components/types/INode";
import {
  conditionText,
  kindColor,
} from "../NodBody/AlgorithmFlowVisualizer/FlowGenerator";

/**
 * The flows of a node's specializations, one row each, in one grid. Two
 * views: Flow draws each flow left to right (loops and branches; a parallel
 * block is a plain run) and wraps when a row is long; Line up has one column
 * per task
 * that two or more flows share, in the usual order, and a pill where a flow
 * does it, so the generalization can be read off the columns. A pinned row
 * (the generalization) sits at the bottom under its own heading. The title
 * column is stuck to the left and the actions column to the right.
 */
export type AlignedRow = {
  id: string;
  title: string;
  algorithm: IAlgorithm | null;
  /** Left accent colour for the title cell (e.g. the decision state). */
  accent?: string;
  /** Highlights the row, e.g. while its editor is open. */
  active?: boolean;
  /** A line under the title (a verdict, a status). */
  note?: React.ReactNode;
  /** Drawn last, filled, under `pinnedHeading`: the generalization. */
  pinned?: boolean;
  /** False keeps the row out of the counts (a rejected flow). Default true. */
  counted?: boolean;
};

type Props = {
  rows: AlignedRow[];
  dark: boolean;
  titleOf?: (id: string) => string;
  renderActions: (row: AlignedRow) => React.ReactNode;
  /** Rendered under the row, pinned to the visible area (editor, panels). */
  renderBelow?: (row: AlignedRow) => React.ReactNode;
  onTitleClick?: (row: AlignedRow) => void;
  /** Shown in place of the flow when the row has no algorithm. */
  emptyText?: string;
  /** Line shared tasks up in columns instead of drawing each flow. */
  aligned?: boolean;
  /** Header over the title column. */
  heading?: string;
  /** Header over the actions column. */
  actionsHeading?: string;
  /** Header over the flow column in Flow view. */
  flowsHeading?: string;
  /** Full-width line above the pinned row (or above `footer` when no row). */
  pinnedHeading?: React.ReactNode;
  /** Full-width content after the pinned row. */
  footer?: React.ReactNode;
  /** A task to outline in every row that has it. */
  highlightKey?: string | null;
};

const LABEL_W = 210;
const COL_W = 100;
const MAX_CHARS = 26;
const shorten = (t: string, max = MAX_CHARS) =>
  t.length > max ? t.slice(0, max - 1) + "…" : t;

// One unit on a row's track. Only tasks carry a key and can match across
// rows; conditions and branch stacks are drawn in place.
type Slot = {
  kind: "task" | "cond" | "branches";
  key: string | null;
  text: string;
  loop?: { id: number; label: string };
  yes?: Slot[]; // branches
  no?: Slot[];
};

function flattenAll(rows: AlignedRow[], titleOf?: (id: string) => string) {
  let loopSeq = 0;
  const label = (a: IActivity) =>
    a.name?.trim() || (a.partId && titleOf ? titleOf(a.partId) : "") || "…";
  const flatten = (a: IActivity): Slot[] => {
    const kids = a.sub_activities || [];
    switch (a.type) {
      case "sequential":
        return kids.flatMap(flatten);
      case "loop": {
        const id = ++loopSeq;
        const text = conditionText(a.loop_condition ?? a.condition) || "";
        return kids
          .flatMap(flatten)
          .map((s) => ({ ...s, loop: s.loop ?? { id, label: text } }));
      }
      case "parallel":
        // Drawn as a plain run of steps: which steps run side by side is
        // not something the review needs to see.
        return kids.flatMap(flatten);
      case "condition": {
        const text =
          conditionText(a.condition) || a.name?.trim() || "condition";
        return [
          { kind: "cond", key: null, text },
          {
            kind: "branches",
            key: null,
            text: "",
            yes: kids[0] ? flatten(kids[0]) : [],
            no: kids.slice(1).flatMap(flatten),
          },
        ];
      }
      default: {
        const text = label(a);
        return [{ kind: "task", key: a.partId || text, text }];
      }
    }
  };
  return rows.map((r) =>
    r.algorithm ? flatten(r.algorithm as unknown as IActivity) : [],
  );
}

/** The tasks of a flow in reading order, branches included. */
const tasksOf = (seq: Slot[]): Slot[] => {
  const out: Slot[] = [];
  const walk = (s: Slot) => {
    if (s.kind === "task") out.push(s);
    s.yes?.forEach(walk);
    s.no?.forEach(walk);
  };
  seq.forEach(walk);
  return out;
};

const AlignedFlows = ({
  rows,
  dark,
  titleOf,
  renderActions,
  renderBelow,
  onTitleClick,
  emptyText = "No proposal",
  aligned = false,
  heading = "Specialization",
  actionsHeading = "Decision",
  flowsHeading = "Flow",
  pinnedHeading,
  footer,
  highlightKey = null,
}: Props) => {
  const c = {
    line: dark ? "#6f757c" : "#b8c0c8",
    text: dark ? "#c9ced3" : "#4b5560",
    muted: dark ? "#8a9299" : "#8a939c",
    box: dark ? "#2a2b2d" : "#eef1f4",
    card: dark ? "#1b1b1c" : "#fff",
    cond: kindColor("condition", dark),
    loop: kindColor("loop", dark),
    loopBg: dark ? "rgba(129,199,132,0.08)" : "rgba(67,160,71,0.06)",
    band: dark ? "rgba(143,215,173,0.10)" : "rgba(42,138,92,0.09)",
    bandHot: dark ? "rgba(144,202,249,0.14)" : "rgba(25,118,210,0.10)",
    sharedBox: dark ? "#25382a" : "#e2f2e5",
    ok: dark ? "#8fd7ad" : "#2a8a5c",
    warn: dark ? "#e9bf6b" : "#8d5a0d",
    warnBg: dark ? "#3d2f12" : "#fff4de",
    primary: dark ? "#90caf9" : "#1976d2",
  };
  const rowTint = dark ? "#202122" : "#f8f9fb";
  const [hover, setHover] = useState<string | null>(null);

  const { slots, order, pinnedIx, count, kids, cols, colIx } = useMemo(() => {
    const slots = flattenAll(rows, titleOf);
    const tasks = slots.map(tasksOf);
    const keys = tasks.map((t) => new Set(t.map((s) => s.key as string)));
    const countedIx = rows
      .map((_, i) => i)
      .filter(
        (i) => !rows[i].pinned && rows[i].counted !== false && slots[i].length,
      );
    const kids = countedIx.length;
    // How many counted flows do each task, and where it usually sits.
    const count = new Map<string, number>();
    const pos = new Map<string, number[]>();
    for (const i of countedIx) {
      const seen = new Set<string>();
      tasks[i].forEach((s, k) => {
        const key = s.key as string;
        if (seen.has(key)) return;
        seen.add(key);
        count.set(key, (count.get(key) || 0) + 1);
        const at = tasks[i].length > 1 ? k / (tasks[i].length - 1) : 0;
        pos.set(key, [...(pos.get(key) || []), at]);
      });
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const cols = [...count]
      .filter(([, n]) => n > 1)
      .map(([key, n]) => ({ key, n, at: mean(pos.get(key) || [0]) }))
      .sort((a, b) => a.at - b.at || b.n - a.n);
    const colIx = new Map(cols.map((col, i) => [col.key, i]));
    // Order: most-connected row first, then always the unplaced row most
    // similar to the last one placed; rows without a flow stay last, then
    // the uncounted ones; the pinned row is drawn separately.
    const sim = (a: number, b: number) =>
      [...keys[a]].filter((k) => keys[b].has(k)).length;
    const withFlow = rows
      .map((_, i) => i)
      .filter(
        (i) => slots[i].length && !rows[i].pinned && rows[i].counted !== false,
      );
    const total = (i: number) =>
      withFlow.reduce((n, j) => (j === i ? n : n + sim(i, j)), 0);
    const order: number[] = [];
    const left = new Set(withFlow);
    while (left.size) {
      const last = order[order.length - 1];
      let best = -1;
      let bestScore = -1;
      for (const i of left) {
        const placed = order.reduce((n, j) => n + sim(i, j), 0);
        const score =
          last === undefined ? total(i) : sim(last, i) * 1000 + placed;
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      }
      order.push(best);
      left.delete(best);
    }
    rows.forEach((r, i) => {
      if (!r.pinned && r.counted === false && slots[i].length) order.push(i);
    });
    rows.forEach((r, i) => {
      if (!r.pinned && !slots[i].length) order.push(i);
    });
    const pinnedIx = rows.findIndex((r) => r.pinned);
    return { slots, order, pinnedIx, count, kids, cols, colIx };
  }, [rows, titleOf]);

  const N = aligned ? cols.length : 1;
  // Grid columns: title | N task columns (or the one flow column) | stretch | actions
  const ACT = N + 3;

  // ---- drawing ----
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
  const pill = (s: Slot, k: string, gen: boolean) => {
    const n = s.key ? count.get(s.key) || 0 : 0;
    const isShared = n > 1;
    const hot = !!s.key && hover === s.key;
    const hl = !!s.key && highlightKey === s.key;
    const cond = s.kind === "cond";
    const text = cond && !s.text.endsWith("?") ? `${s.text}?` : s.text;
    return (
      <Box
        key={k}
        component="span"
        title={
          cond ? text : isShared ? `${s.text}: in ${n} of ${kids} flows` : text
        }
        onMouseEnter={s.key ? () => setHover(s.key) : undefined}
        onMouseLeave={s.key ? () => setHover(null) : undefined}
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
          bgcolor: cond ? c.card : gen ? c.ok : isShared ? c.sharedBox : c.box,
          color: cond ? c.cond : gen ? "#fff" : c.text,
          border: cond ? `1px solid ${c.cond}` : "none",
          fontWeight: cond || gen ? 500 : 400,
          boxShadow: hl
            ? `0 0 0 2px ${c.warn}`
            : hot
              ? `0 0 0 2px ${c.primary}`
              : "none",
          transition: "box-shadow 80ms",
          cursor: s.key ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        {shorten(text)}
      </Box>
    );
  };
  // A small label on the track: a branch ("yes", "no") or a gateway.
  const tag = (t: string, color: string) => (
    <Box
      component="span"
      sx={{
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        px: 0.6,
        py: "4px",
        borderRadius: "5px",
        color,
        border: `1px solid ${color}`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {t}
    </Box>
  );
  // One side of a fork or join: a bar from the first lane's centre to the
  // last's, with a stub into this lane. `bar` is the bar's thickness.
  const fork = (
    side: "left" | "right",
    first: boolean,
    last: boolean,
    color: string,
    bar: number,
  ) => {
    const v = {
      [side === "left" ? "borderLeft" : "borderRight"]:
        `${bar}px solid ${color}`,
    };
    return (
      <Box
        component="span"
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
  const lane = (
    k: string,
    steps: Slot[],
    label: string | null,
    color: string,
    bar: number,
    first: boolean,
    last: boolean,
    gen: boolean,
  ) => (
    <Box
      key={k}
      component="span"
      sx={{ display: "flex", alignItems: "stretch" }}
    >
      {fork("left", first, last, color, bar)}
      <Box
        component="span"
        sx={{ flex: 1, display: "flex", alignItems: "center", py: "3px" }}
      >
        {label && tag(label, color)}
        {label && joint(`${k}t`)}
        {steps.length > 0 && run(steps, k, gen)}
        <Box
          component="span"
          sx={{
            flex: 1,
            minWidth: 12,
            borderTop: `1px ${steps.length ? "solid" : "dashed"} ${c.line}`,
          }}
        />
      </Box>
      {fork("right", first, last, color, bar)}
    </Box>
  );
  const draw = (s: Slot, k: string, gen: boolean): React.ReactNode => {
    switch (s.kind) {
      case "branches":
        return (
          <Box
            key={k}
            component="span"
            sx={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "stretch",
            }}
          >
            {lane(`${k}y`, s.yes || [], "yes", c.cond, 1, true, false, gen)}
            {lane(`${k}n`, s.no || [], "no", c.cond, 1, false, true, gen)}
          </Box>
        );
      default:
        return pill(s, k, gen);
    }
  };
  // Loop labels are stored as the condition; "until …" and "while …" read
  // as they are, anything else is the condition the loop repeats on.
  const loopText = (label: string) =>
    !label
      ? "repeat"
      : /^(until|while|for|as long as)\b/i.test(label)
        ? `repeat ${label}`
        : `repeat while ${label}`;
  const loopCaption = (label: string) => (
    <Typography
      component="span"
      title={label}
      sx={{
        fontSize: 10,
        fontWeight: 600,
        color: c.loop,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      ↻ {shorten(loopText(label), 44)}
    </Typography>
  );
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
      <Box component="span" sx={{ mb: "4px" }}>
        {loopCaption(label)}
      </Box>
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
  // A flow from the left: consecutive steps of one loop are boxed together.
  const run = (seq: Slot[], k: string, gen: boolean): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < seq.length) {
      if (out.length) out.push(joint(`${k}j${i}`));
      const loop = seq[i].loop;
      if (!loop) {
        out.push(draw(seq[i], `${k}s${i}`, gen));
        i++;
        continue;
      }
      let j = i;
      while (j < seq.length && seq[j].loop?.id === loop.id) j++;
      const inner = seq
        .slice(i, j)
        .map((s, x) => [
          x ? joint(`${k}gj${i}${x}`) : null,
          draw(s, `${k}gs${i}${x}`, gen),
        ]);
      out.push(loopBox(`${k}g${i}`, loop.label, inner));
      i = j;
    }
    return out;
  };

  // The scroll viewport's width pins the panels under a row to what is
  // visible; a shadow on the actions column says there is more to the left.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setViewport(el.clientWidth);
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [N, rows.length, aligned]);

  // ---- grid styles ----
  const grid = {
    display: "grid",
    gridTemplateColumns: aligned
      ? `${LABEL_W}px ${cols.map(() => `${COL_W}px`).join(" ")} minmax(24px, 1fr) max-content`
      : `${LABEL_W}px minmax(0, 1fr) 0px max-content`,
    minWidth: "100%",
  };
  const rowSx = (bg: string, hoverable?: boolean) => ({
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    gridTemplateRows: "auto auto",
    bgcolor: bg,
    borderTop: `1px solid ${c.line}44`,
    ...(hoverable ? { "&:hover": { bgcolor: rowTint } } : {}),
  });
  const stickyLeft = {
    gridColumn: 1,
    gridRow: 1,
    position: "sticky" as const,
    left: 0,
    zIndex: 2,
    bgcolor: "inherit",
    display: "flex",
    alignItems: "center",
    px: 2,
    py: 2,
    minHeight: 60,
    borderRight: `1px solid ${c.line}66`,
  };
  const stickyRight = {
    gridColumn: ACT,
    gridRow: 1,
    position: "sticky" as const,
    right: 0,
    zIndex: 2,
    bgcolor: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    px: 2,
    minWidth: 190,
    borderLeft: `1px solid ${c.line}66`,
    boxShadow: overflowing ? "-10px 0 10px -10px rgba(0,0,0,0.25)" : "none",
  };
  const headSx = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: c.muted,
    whiteSpace: "nowrap" as const,
  };
  const cellSx = (i: number) => ({
    gridColumn: i + 2,
    gridRow: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    px: 0.5,
    py: 1.5,
    minWidth: 0,
  });
  // A band behind the columns that go into the generalization (done by at
  // least half of the flows); any column lights up while its task is hovered.
  const bands = aligned
    ? cols.map((col, i) => {
        const inGen = col.n * 2 >= kids;
        const hot = hover === col.key;
        if (!inGen && !hot) return null;
        return (
          <Box
            key={`b${i}`}
            sx={{
              gridColumn: i + 2,
              gridRow: 1,
              my: 0.5,
              mx: "1px",
              borderRadius: "8px",
              bgcolor: hot ? c.bandHot : c.band,
              transition: "background-color 120ms",
              pointerEvents: "none",
            }}
          />
        );
      })
    : null;
  const fullWidth = {
    gridColumn: "1 / -1",
    position: "sticky" as const,
    left: 0,
    width: viewport ? `${viewport}px` : "100%",
    boxSizing: "border-box" as const,
  };

  const drawRow = (ri: number, gen: boolean) => {
    const r = rows[ri];
    const below = renderBelow?.(r);
    const seq = slots[ri];
    const tasks = tasksOf(seq);
    const hasKey = !!highlightKey && tasks.some((s) => s.key === highlightKey);
    // Line up: a pill in each shared task's column; the rest in one count.
    const cells = new Map<number, Slot>();
    const extra: string[] = [];
    if (aligned)
      for (const s of tasks) {
        const i = colIx.get(s.key as string);
        if (i !== undefined) {
          if (!cells.has(i)) cells.set(i, s);
        } else if (!extra.includes(s.text)) extra.push(s.text);
      }
    const used = [...cells.keys()].sort((a, b) => a - b);
    return (
      <Box key={r.id} sx={rowSx(r.active ? rowTint : c.card, true)}>
        <Box
          sx={{
            ...stickyLeft,
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "center",
            borderLeft: "3px solid",
            borderLeftColor: r.accent || "transparent",
            ...(hasKey ? { bgcolor: c.warnBg } : {}),
          }}
        >
          <Typography
            fontWeight={600}
            fontSize={13}
            title={r.title}
            sx={{
              lineHeight: 1.4,
              cursor: onTitleClick ? "pointer" : "default",
              "&:hover": onTitleClick ? { color: "primary.main" } : {},
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            onClick={() => onTitleClick?.(r)}
          >
            {r.title}
          </Typography>
          {r.note && (
            <Typography
              component="div"
              sx={{ fontSize: 12, color: c.muted, mt: 0.25, lineHeight: 1.4 }}
            >
              {r.note}
            </Typography>
          )}
          {aligned && extra.length > 0 && (
            // Under the title, so it stays in view when the columns scroll.
            <Typography
              component="div"
              sx={{ fontSize: 12, color: c.muted, mt: 0.25, lineHeight: 1.4 }}
              title={`Steps only this flow has: ${extra.join(", ")}`}
            >
              +{extra.length} step{extra.length === 1 ? "" : "s"} only this flow
              has
            </Typography>
          )}
        </Box>
        {bands}
        {seq.length === 0 && (
          <Box
            sx={{
              gridColumn: `2 / ${ACT}`,
              gridRow: 1,
              display: "flex",
              alignItems: "center",
              pl: 1.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {emptyText}
            </Typography>
          </Box>
        )}
        {!aligned && seq.length > 0 && (
          <Box
            sx={{
              gridColumn: 2,
              gridRow: 1,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              rowGap: "6px",
              px: 1.5,
              py: 1.5,
              minWidth: 0,
            }}
          >
            {run(seq, r.id, gen)}
          </Box>
        )}
        {aligned && used.length > 0 && (
          <Box
            sx={{
              gridColumn: `${used[0] + 2} / ${used[used.length - 1] + 3}`,
              gridRow: 1,
              alignSelf: "center",
              height: "1px",
              bgcolor: c.line,
              pointerEvents: "none",
            }}
          />
        )}
        {aligned &&
          used.map((i) => (
            <Box key={`${r.id}-${i}`} sx={cellSx(i)}>
              {pill(cells.get(i) as Slot, `${r.id}c${i}`, gen)}
            </Box>
          ))}
        <Box sx={stickyRight}>{renderActions(r)}</Box>
        {below && (
          <Box sx={{ ...fullWidth, gridRow: 2, px: 3, pb: 3, zIndex: 3 }}>
            {below}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box ref={scrollRef} sx={{ overflowX: "auto", scrollbarWidth: "thin" }}>
      <Box sx={grid}>
        {/* Header: the columns' names; in Line up a count under each task */}
        <Box sx={{ ...rowSx(c.card), borderTop: "none" }}>
          <Box sx={{ ...stickyLeft, minHeight: 36, py: 0.5 }}>
            <Typography
              sx={{
                ...headSx,
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
              title={heading}
            >
              {heading}
            </Typography>
          </Box>
          {bands}
          {!aligned && (
            <Box
              sx={{
                gridColumn: 2,
                gridRow: 1,
                display: "flex",
                alignItems: "center",
                px: 1.5,
                minHeight: 36,
              }}
            >
              <Typography sx={headSx}>{flowsHeading}</Typography>
            </Box>
          )}
          {aligned &&
            cols.map((col, i) => {
              const inGen = col.n * 2 >= kids;
              const name = titleOf?.(col.key) || col.key;
              return (
                <Box
                  key={`h${i}`}
                  sx={{
                    ...cellSx(i),
                    flexDirection: "column",
                    gap: "3px",
                    py: 1,
                    textAlign: "center",
                    cursor: "default",
                  }}
                  title={`${name}: in ${col.n} of ${kids} flows${inGen ? ", so it goes into the generalization" : ""}`}
                  onMouseEnter={() => setHover(col.key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 600,
                      lineHeight: 1.25,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 11,
                      fontWeight: inGen ? 600 : 400,
                      color: inGen ? c.ok : c.muted,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {col.n} of {kids}
                  </Typography>
                  <Box
                    sx={{
                      width: 56,
                      height: 4,
                      borderRadius: 2,
                      bgcolor: c.box,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${Math.round((100 * col.n) / Math.max(kids, 1))}%`,
                        bgcolor: inGen ? c.ok : c.line,
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          <Box sx={{ ...stickyRight, minHeight: 36, boxShadow: "none" }}>
            <Typography sx={headSx}>{actionsHeading}</Typography>
          </Box>
        </Box>

        {/* One row per specialization, most similar flows next to each other */}
        {order.map((ri) => drawRow(ri, false))}

        {/* The generalization: its own heading, its row, and whatever follows */}
        {(pinnedHeading || pinnedIx >= 0 || footer) && (
          <Box
            sx={{
              ...fullWidth,
              borderTop: `1px solid ${c.line}66`,
              bgcolor: c.card,
            }}
          >
            {pinnedHeading}
          </Box>
        )}
        {pinnedIx >= 0 && drawRow(pinnedIx, true)}
        {footer && <Box sx={{ ...fullWidth, bgcolor: c.card }}>{footer}</Box>}
      </Box>
    </Box>
  );
};

export default AlignedFlows;
