import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { IActivity, IAlgorithm } from "@components/types/INode";
import { taskColumns } from "@components/lib/review/taskMatch";
import FlowTrack, { PickedTask } from "./FlowTrack";

/**
 * The flows of a node's specializations, one row each. With columns, a
 * column is a task at least half of the counted flows do, marked with a dot
 * in the rows that do it; every other step goes in the Not shared cell. Without columns each flow is drawn
 * from the left (loops, branches), shared tasks tinted. Reviewing parts, the
 * tasks are always lined up and the rest go under Own parts. The title column
 * is stuck to the left, the actions to the right.
 */
export type AlignedRow = {
  id: string;
  title: string;
  algorithm: IAlgorithm | null;
  /** Highlights the row, e.g. while its editor is open. */
  active?: boolean;
  /** A line under the title (a verdict, a status). */
  note?: React.ReactNode;
  /** False keeps the row out of the counts and dims it (a rejected flow). */
  counted?: boolean;
  /** True leaves the row out of the list; it still counts for the columns. */
  hidden?: boolean;
};

type Props = {
  rows: AlignedRow[];
  dark: boolean;
  titleOf?: (id: string) => string;
  /** The right-hand column; none when left out. */
  renderActions?: (row: AlignedRow) => React.ReactNode;
  /** Rendered under the row, pinned to the visible area (editor, panels). */
  renderBelow?: (row: AlignedRow) => React.ReactNode;
  onTitleClick?: (row: AlignedRow) => void;
  /** Shown in place of the steps when the row has no algorithm. */
  emptyText?: string;
  /** Header over the title column. */
  heading?: string;
  /** With columns: the header's top-right label, split from `heading` by a diagonal. */
  corner?: string;
  /** Header over the actions column. */
  actionsHeading?: string;
  /** False draws each flow from the left instead of lining the tasks up. */
  columns?: boolean;
  /** True reviews parts: always lined up, with "Own parts" for the rest. */
  parts?: boolean;
  /** Flow view: makes each task a button; called with the one picked. */
  onTaskPick?: (task: PickedTask) => void;
  /** Flow view: the key of the picked task, which is outlined. */
  pickedKey?: string | null;
};

const LABEL_W = 210;
const COL_W = 84;
const COL_MIN = 78;

type Task = { key: string; text: string };

/** The tasks of a flow in reading order, branches included, each once. */
export function tasksOf(
  alg: IAlgorithm | null,
  titleOf?: (id: string) => string,
) {
  const out: Task[] = [];
  const seen = new Set<string>();
  const walk = (a: IActivity) => {
    if (a.type === "task") {
      const text =
        a.name?.trim() || (a.partId && titleOf ? titleOf(a.partId) : "") || "…";
      const key = a.partId || text;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ key, text });
      }
    }
    (a.sub_activities || []).forEach(walk);
  };
  if (alg) walk(alg as unknown as IActivity);
  return out;
}

const AlignedFlows = ({
  rows,
  dark,
  titleOf,
  renderActions,
  renderBelow,
  onTitleClick,
  emptyText = "No proposal",
  heading = "Specialization",
  corner,
  actionsHeading = "Decision",
  columns: lineUp = true,
  parts,
  onTaskPick,
  pickedKey,
}: Props) => {
  const withColumns = lineUp || !!parts;
  const c = {
    line: dark ? "#6f757c" : "#b8c0c8",
    // table lines and header, in the flat grey of a documentation table
    grid: dark ? "#2c2d2f" : "#e8eaed",
    headBg: dark ? "#202122" : "#f7f8f9",
    text: dark ? "#c9ced3" : "#4b5560",
    box: dark ? "#2a2b2d" : "#eef1f4",
    boxHover: dark ? "#363739" : "#e1e6eb",
    tint: dark ? "#25382a" : "#e2f2e5",
    // the column under the pointer
    colTint: dark ? "#1f2933" : "#eaf2fb",
    card: dark ? "#1b1b1c" : "#fff",
    ok: dark ? "#8fd7ad" : "#2a8a5c",
  };
  const rowTint = dark ? "#202122" : "#f8f9fb";

  const { tasks, order, columns, total, keyOf } = useMemo(() => {
    const tasks = rows.map((r) => tasksOf(r.algorithm, titleOf));
    const countedIx = rows
      .map((_, i) => i)
      .filter((i) => rows[i].counted !== false && tasks[i].length);
    const shared = taskColumns(
      countedIx.map((i) => tasks[i].map((t) => t.key)),
    );
    const columns = withColumns ? shared.columns : [];
    const { total, keyOf } = shared;
    // Rows keep their given order, whatever was decided; the empty go last.
    const order = [
      ...rows.flatMap((_, i) => (tasks[i].length ? [i] : [])),
      ...rows.flatMap((_, i) => (!tasks[i].length ? [i] : [])),
    ];
    return { tasks, order, columns, total, keyOf };
  }, [rows, titleOf, withColumns]);

  const N = columns.length;
  // The column in focus: the header under the pointer, or the one clicked.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinKey, setPinKey] = useState<string | null>(null);
  const hl = hoverKey ?? pinKey;
  const shown = order.filter((ri) => !rows[ri].hidden);
  // Grid columns: title | N task columns | also | actions
  const ALSO = N + 2;
  const ACT = N + 3;

  // A chip: the whole name, wrapped, never cut.
  const chipSx = {
    px: "8px",
    py: "5px",
    borderRadius: "6px",
    fontSize: 12.5,
    lineHeight: 1.35,
    overflowWrap: "break-word" as const,
    hyphens: "auto" as const,
    cursor: "default",
  };
  // The task's name in its column, filling the cell.
  const named = (k: string, text: string) => (
    <Box
      key={k}
      component="span"
      sx={{
        ...chipSx,
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        bgcolor: dark ? "#24342a" : c.tint,
        color: dark ? "#d9e6dc" : c.text,
      }}
    >
      {text}
    </Box>
  );
  // A step with no column.
  const pill = (t: Task, k: string) => (
    <Box
      key={k}
      component="span"
      sx={{
        ...chipSx,
        display: "inline-block",
        verticalAlign: "middle",
        maxWidth: "100%",
        bgcolor: c.box,
        color: c.text,
        "&:hover": { bgcolor: c.boxHover, color: "text.primary" },
      }}
    >
      {t.text}
    </Box>
  );

  // The scroll viewport's width pins the panels under a row to what is
  // visible; a shadow on the actions column says there is more to the left.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  // The grid's own scrollbar is hidden; a bar under the scrolling middle
  // (between the pinned columns) moves the grid, and follows it.
  const barRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ left: LABEL_W, right: 0, extra: 0 });
  const follow = (from: HTMLElement | null, to: HTMLElement | null) => {
    if (from && to && to.scrollLeft !== from.scrollLeft)
      to.scrollLeft = from.scrollLeft;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setViewport(el.clientWidth);
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
      // A pinned column's width; none while it scrolls with the rest.
      const pin = (side: string) => {
        const col = el.querySelector<HTMLElement>(`[data-pin="${side}"]`);
        if (!col) return undefined;
        return getComputedStyle(col).position === "static"
          ? 0
          : col.offsetWidth;
      };
      setBar({
        left: pin("left") ?? LABEL_W,
        right: pin("right") ?? 0,
        extra: el.scrollWidth - el.clientWidth,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [N, rows.length]);

  const grid = {
    display: "grid",
    // Task columns shrink before the grid scrolls, so a family fits the page.
    gridTemplateColumns: `${LABEL_W}px ${columns.map(() => `minmax(${COL_MIN}px, ${COL_W}px)`).join(" ")} minmax(${N ? 220 : 320}px, 1fr)${renderActions ? " max-content" : ""}`,
    minWidth: "100%",
  };
  const rowSx = (bg: string, hoverable?: boolean) => ({
    display: "grid",
    gridColumn: "1 / -1",
    gridTemplateColumns: "subgrid",
    gridTemplateRows: "auto auto",
    bgcolor: bg,
    borderTop: `1px solid ${c.grid}`,
    ...(hoverable ? { "&:hover": { bgcolor: rowTint } } : {}),
  });
  const stickyLeft = {
    gridColumn: 1,
    gridRow: 1,
    // On a phone the title scrolls away with the flow; the actions stay.
    position: { xs: "static", sm: "sticky" },
    left: 0,
    zIndex: 2,
    bgcolor: "inherit",
    display: "flex",
    alignItems: "center",
    px: 2,
    py: 2,
    minHeight: 60,
    borderRight: `1px solid ${c.grid}`,
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
    borderLeft: `1px solid ${c.grid}`,
    boxShadow: overflowing ? "-10px 0 10px -10px rgba(0,0,0,0.25)" : "none",
  };
  const headSx = {
    fontSize: 14,
    fontWeight: 600,
    color: "text.primary",
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
    // A hairline between task columns, so an empty cell reads as a slot.
    ...(i > 0 ? { borderLeft: `1px solid ${c.grid}` } : {}),
  });
  const alsoSx = {
    gridColumn: ALSO,
    gridRow: 1,
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: "4px",
    px: 1.5,
    py: 1.5,
    minWidth: 0,
    ...(N > 0 ? { borderLeft: `1px solid ${c.grid}` } : {}),
  };
  const fullWidth = {
    gridColumn: "1 / -1",
    position: "sticky" as const,
    left: 0,
    width: viewport ? `${viewport}px` : "100%",
    boxSizing: "border-box" as const,
  };

  const drawRow = (ri: number) => {
    const r = rows[ri];
    const below = renderBelow?.(r);
    const list = tasks[ri];
    // A flow left out is dimmed, and that is its only mark; the answer
    // beside it stays at full strength.
    const out = r.counted === false;
    const dimSx = out ? { opacity: 0.4 } : {};
    // A dot in each column's cell; the rest in the Not shared cell, in order.
    const cells = new Map<string, Task>();
    const also: Task[] = [];
    for (const t of list) {
      if (keyOf(t.key) === t.key) cells.set(t.key, t);
      else also.push(t);
    }
    return (
      <Box key={r.id} sx={rowSx(r.active ? rowTint : c.card, true)}>
        <Box
          sx={{
            ...stickyLeft,
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "center",
          }}
        >
          <Typography
            fontWeight={400}
            fontSize={14}
            title={r.title}
            sx={{
              lineHeight: 1.4,
              color: out ? (dark ? "#7a7a80" : "#8a8a90") : "text.primary",
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
              sx={{
                fontSize: 12,
                color: "text.secondary",
                mt: 0.25,
                lineHeight: 1.4,
              }}
            >
              {r.note}
            </Typography>
          )}
        </Box>
        {columns.map((col, i) => {
          const t = cells.get(col.key);
          const on = hl === col.key;
          return (
            <Box
              key={`${r.id}-${i}`}
              data-hl={on || undefined}
              sx={{
                ...cellSx(i),
                "& > *": dimSx,
                ...(on ? { bgcolor: c.colTint } : {}),
              }}
            >
              {t && named(`${r.id}c${i}`, t.text)}
            </Box>
          );
        })}
        <Box sx={{ ...alsoSx, "& > *": dimSx }}>
          {list.length === 0 || !r.algorithm ? (
            <Typography variant="caption" color="text.secondary">
              {emptyText}
            </Typography>
          ) : withColumns ? (
            also.length || !parts ? (
              also.map((t, i) => pill(t, `${r.id}a${i}`))
            ) : (
              <Typography
                component="span"
                aria-label="No own parts"
                sx={{ fontSize: 13, color: "#6e6e74" }}
              >
                —
              </Typography>
            )
          ) : (
            <FlowTrack
              algorithm={r.algorithm}
              dark={dark}
              titleOf={titleOf}
              shared={(key) => total > 1 && keyOf(key) !== null}
              onPick={onTaskPick}
              picked={pickedKey}
            />
          )}
        </Box>
        {renderActions && <Box sx={stickyRight}>{renderActions(r)}</Box>}
        {below && (
          <Box
            sx={{
              ...fullWidth,
              gridRow: 2,
              px: 3,
              pb: 3,
              zIndex: 3,
            }}
          >
            {below}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Box
        ref={scrollRef}
        onScroll={() => follow(scrollRef.current, barRef.current)}
        sx={{
          overflowX: "auto",
          // Lined up, the grid scrolls inside the card under a fixed header.
          ...(withColumns ? { maxHeight: "72vh", overflowY: "auto" } : {}),
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        <Box sx={grid}>
          {/* Header: the columns' tasks with a count, the Not shared and actions headings */}
          <Box
            sx={{
              ...rowSx(c.headBg),
              position: "sticky",
              top: 0,
              zIndex: 4,
              borderTop: "none",
              borderBottom: `1px solid ${c.grid}`,
            }}
          >
            {corner && N > 0 ? (
              <Box
                data-pin="left"
                sx={{
                  ...stickyLeft,
                  // tall enough for the labels to clear the diagonal
                  minHeight: 58,
                  p: 0,
                  alignItems: "stretch",
                  // the diagonal, bottom-left to top-right
                  backgroundImage: `linear-gradient(to top right, transparent calc(50% - 0.5px), ${c.grid} calc(50% - 0.5px), ${c.grid} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
                }}
              >
                <Typography
                  sx={{ ...headSx, position: "absolute", top: 8, right: 12 }}
                >
                  {corner}
                </Typography>
                <Typography
                  sx={{ ...headSx, position: "absolute", bottom: 8, left: 12 }}
                >
                  {heading}
                </Typography>
              </Box>
            ) : (
              <Box
                data-pin="left"
                sx={{ ...stickyLeft, minHeight: 36, py: 0.5 }}
              >
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
            )}
            {columns.map((col, i) => {
              const name = titleOf?.(col.key) || col.key;
              const on = hl === col.key;
              return (
                <Tooltip
                  key={`h${i}`}
                  title={`${name} · in ${col.n} of ${total} ${parts ? "activities" : "flows"}`}
                  enterDelay={150}
                  placement="top"
                  arrow
                >
                  <Box
                    role="button"
                    aria-pressed={pinKey === col.key}
                    data-hl={on || undefined}
                    onMouseEnter={() => setHoverKey(col.key)}
                    onMouseLeave={() => setHoverKey(null)}
                    onClick={() =>
                      setPinKey((k) => (k === col.key ? null : col.key))
                    }
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPinKey((k) => (k === col.key ? null : col.key));
                      }
                    }}
                    sx={{
                      ...cellSx(i),
                      px: 0.25,
                      py: 1,
                      textAlign: "center",
                      cursor: "pointer",
                      ...(on ? { bgcolor: c.colTint } : {}),
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        lineHeight: 1.35,
                        overflowWrap: "break-word",
                        hyphens: "auto",
                      }}
                    >
                      {name}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
            <Box sx={{ ...alsoSx, py: 0.5, minHeight: 36 }}>
              <Typography sx={headSx}>
                {N ? (parts ? "Own parts" : "Not shared") : "Flow"}
              </Typography>
            </Box>
            {renderActions && (
              <Box
                data-pin="right"
                sx={{ ...stickyRight, minHeight: 36, boxShadow: "none" }}
              >
                <Typography sx={headSx}>{actionsHeading}</Typography>
              </Box>
            )}
          </Box>

          {shown.map((ri) => drawRow(ri))}
          {rows.length > 0 && shown.length === 0 && (
            <Typography
              sx={{
                ...fullWidth,
                px: 2,
                py: 2,
                fontSize: 13,
                color: "text.secondary",
                borderTop: `1px solid ${c.grid}`,
              }}
            >
              {parts ? "No parts" : "No flows"}
            </Typography>
          )}
        </Box>
      </Box>
      {overflowing && (
        <Box
          ref={barRef}
          onScroll={() => follow(barRef.current, scrollRef.current)}
          sx={{
            overflowX: "auto",
            ml: `${bar.left}px`,
            mr: `${bar.right}px`,
            height: 12,
            scrollbarWidth: "thin",
            scrollbarColor: `${c.line} ${c.box}`,
            "&::-webkit-scrollbar": { height: 10 },
            "&::-webkit-scrollbar-track": { bgcolor: c.box },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: c.line,
              borderRadius: 5,
              border: `2px solid ${c.box}`,
            },
          }}
        >
          <Box sx={{ width: `calc(100% + ${bar.extra}px)`, height: 1 }} />
        </Box>
      )}
    </Box>
  );
};

export default AlignedFlows;
