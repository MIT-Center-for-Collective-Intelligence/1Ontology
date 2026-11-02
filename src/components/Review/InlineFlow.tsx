import React from "react";
import { Box } from "@mui/material";
import { IActivity, IAlgorithm } from "@components/types/INode";
import {
  conditionText,
  kindColor,
} from "../NodBody/AlgorithmFlowVisualizer/FlowGenerator";

/**
 * A railroad diagram of an algorithm tree, read left to right: tasks are
 * boxes on one track; a condition splits the track into a Y and an N branch
 * that rejoin; a loop adds a return track underneath; a parallel block forks
 * into stacked tracks between two bars. Same tree the canvas draws top-down.
 */
type Props = {
  algorithm: IAlgorithm;
  dark: boolean;
  titleOf?: (id: string) => string;
};

// A laid-out block: the main track enters at (x, y + axis) and leaves at
// (x + w, y + axis). draw() emits SVG for the block at that origin.
type Block = {
  w: number;
  h: number;
  axis: number;
  draw: (x: number, y: number) => React.ReactNode;
};

const H = 22; // box height
const GAP = 14; // track between neighbours
const LEAD = 18; // run-in before a fork / after a join
const R = 7; // curve radius
const VGAP = 8; // between stacked branches
const FONT = 12;
const MAX_CHARS = 26;

const shorten = (t: string) =>
  t.length > MAX_CHARS ? t.slice(0, MAX_CHARS - 1) + "…" : t;
const textW = (t: string) => Math.round(t.length * 6.4) + 2;

const InlineFlow = ({ algorithm, dark, titleOf }: Props) => {
  const c = {
    line: dark ? "#6f757c" : "#b8c0c8",
    // same palette as the canvas
    par: kindColor("parallel", dark),
    loop: kindColor("loop", dark),
    text: dark ? "#c9ced3" : "#4b5560",
    muted: dark ? "#8a9299" : "#8a939c",
    box: dark ? "#2a2b2d" : "#eef1f4",
    cond: kindColor("condition", dark),
    bg: dark ? "#1b1b1c" : "#fff",
  };
  let key = 0;
  const k = () => `f${key++}`;

  const label = (a: IActivity) =>
    a.name?.trim() || (a.partId && titleOf ? titleOf(a.partId) : "") || "…";

  // ---- primitives ----
  const term = (full: string, tone: "task" | "cond" = "task"): Block => {
    const t = shorten(full);
    const w = textW(t) + 16;
    return {
      w,
      h: H,
      axis: H / 2,
      draw: (x, y) => (
        <g key={k()}>
          <title>{full}</title>
          <rect
            x={x}
            y={y}
            width={w}
            height={H}
            rx={6}
            fill={tone === "cond" ? c.bg : c.box}
            stroke={tone === "cond" ? c.cond : "none"}
          />
          <text
            x={x + w / 2}
            y={y + H / 2 + 4}
            textAnchor="middle"
            fontSize={FONT}
            fontWeight={tone === "cond" ? 500 : 400}
            fill={tone === "cond" ? c.cond : c.text}
          >
            {t}
          </text>
        </g>
      ),
    };
  };
  const skip = (w = 24): Block => ({
    w,
    h: H,
    axis: H / 2,
    draw: (x, y) => (
      <line
        key={k()}
        x1={x}
        y1={y + H / 2}
        x2={x + w}
        y2={y + H / 2}
        stroke={c.line}
      />
    ),
  });
  const track = (x1: number, x2: number, y: number) => (
    <line key={k()} x1={x1} y1={y} x2={x2} y2={y} stroke={c.line} />
  );

  const seq = (items: Block[]): Block => {
    if (!items.length) return skip();
    const axis = Math.max(...items.map((b) => b.axis));
    const below = Math.max(...items.map((b) => b.h - b.axis));
    const w = items.reduce((s, b) => s + b.w, 0) + GAP * (items.length - 1);
    return {
      w,
      h: axis + below,
      axis,
      draw: (x, y) => {
        const out: React.ReactNode[] = [];
        let cx = x;
        items.forEach((b, i) => {
          if (i > 0) {
            out.push(track(cx, cx + GAP, y + axis));
            cx += GAP;
          }
          out.push(b.draw(cx, y + axis - b.axis));
          cx += b.w;
        });
        return <g key={k()}>{out}</g>;
      },
    };
  };

  // Curve from the main track at ya down (or up) to a branch track at yb.
  const forkPath = (x: number, ya: number, yb: number, lead: number) => {
    if (yb === ya) return `M${x},${ya} h${lead}`;
    const d = yb > ya ? 1 : -1;
    const r = Math.min(R, Math.abs(yb - ya) / 2);
    return `M${x},${ya} q${r},0 ${r},${d * r} V${yb - d * r} q0,${d * r} ${r},${d * r} h${lead - 2 * r}`;
  };
  const joinPath = (x: number, ya: number, yb: number, lead: number) => {
    if (yb === ya) return `M${x},${yb} h${lead}`;
    const d = yb > ya ? -1 : 1;
    const r = Math.min(R, Math.abs(yb - ya) / 2);
    return `M${x},${yb} h${lead - 2 * r} q${r},0 ${r},${d * r} V${ya - d * r} q0,${d * r} ${r},${d * r}`;
  };

  // Stacked branches between a fork and a join; the first branch stays on
  // the main track. Parallel draws bars instead of curves.
  const split = (
    branches: Block[],
    opts: { labels?: string[]; parallel?: boolean } = {},
  ): Block => {
    const inner = Math.max(...branches.map((b) => b.w));
    const w = inner + 2 * LEAD;
    const tops: number[] = [];
    let yCursor = 0;
    for (const b of branches) {
      tops.push(yCursor);
      yCursor += b.h + VGAP;
    }
    const h = yCursor - VGAP + (opts.parallel ? 14 : 0); // room for the caption
    const axis = branches[0].axis;
    return {
      w,
      h,
      axis,
      draw: (x, y) => {
        const ya = y + axis;
        const out: React.ReactNode[] = [];
        branches.forEach((b, i) => {
          const yb = y + tops[i] + b.axis;
          const xr = x + LEAD + inner; // where every branch rejoins
          if (opts.parallel) {
            // lower tracks run bar to bar; the main track runs through
            const x1 = i ? x + LEAD / 2 : x;
            const x2 = i ? x + w - LEAD / 2 : x + w;
            out.push(track(x1, x + LEAD, yb), track(xr, x2, yb));
          } else {
            out.push(
              <path
                key={k()}
                d={forkPath(x, ya, yb, LEAD)}
                fill="none"
                stroke={c.line}
              />,
              <path
                key={k()}
                d={joinPath(xr, ya, yb, LEAD)}
                fill="none"
                stroke={c.line}
              />,
            );
          }
          if (b.w < inner) out.push(track(x + LEAD + b.w, xr, yb));
          if (opts.labels?.[i])
            out.push(
              <text
                key={k()}
                x={x + LEAD - 4}
                y={yb - 4}
                textAnchor="end"
                fontSize={9}
                fontWeight={600}
                fill={c.muted}
              >
                {opts.labels[i]}
              </text>,
            );
          out.push(b.draw(x + LEAD, y + tops[i]));
        });
        if (opts.parallel) {
          // fork and join bars, extended past the outer tracks so they read
          // as gateways, plus a caption under the block
          const y1 = y + tops[0] + branches[0].axis - 6;
          const last = branches.length - 1;
          const y2 = y + tops[last] + branches[last].axis + 6;
          const bar = (bx: number) => (
            <line
              key={k()}
              x1={bx}
              y1={y1}
              x2={bx}
              y2={y2}
              stroke={c.par}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
          out.push(
            bar(x + LEAD / 2),
            bar(x + w - LEAD / 2),
            <text
              key={k()}
              x={x + w / 2}
              y={y + h - 2}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill={c.par}
            >
              in parallel
            </text>,
          );
        }
        return <g key={k()}>{out}</g>;
      },
    };
  };

  // Body on the main track, return track underneath with the loop condition.
  const loop = (body: Block, text?: string): Block => {
    const t = text ? shorten(text) : "";
    const w = Math.max(body.w, textW(t) + 8) + 2 * LEAD;
    const yRet = body.h + VGAP + 2; // return track below the body
    const h = yRet + (t ? 12 : 4);
    return {
      w,
      h,
      axis: body.axis,
      draw: (x, y) => {
        const ya = y + body.axis;
        const yr = y + yRet;
        const bx = x + LEAD + (w - 2 * LEAD - body.w) / 2;
        const d = `M${x + w - LEAD},${ya} h${LEAD - R} q${R},0 ${R},${R} V${yr - R} q0,${R} -${R},${R} H${x + R} q-${R},0 -${R},-${R} V${ya + R} q0,-${R} ${R},-${R} h${LEAD - R}`;
        return (
          <g key={k()}>
            {track(x, x + w, ya)}
            <path d={d} fill="none" stroke={c.loop} />
            <path
              d={`M${x + w / 2 + 3},${yr - 3} l-4,3 l4,3`}
              fill="none"
              stroke={c.loop}
            />
            {t && (
              <text
                x={x + w / 2}
                y={yr + 11}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill={c.loop}
              >
                <title>{text}</title>↻ {t}
              </text>
            )}
            {body.draw(bx, y)}
          </g>
        );
      },
    };
  };

  // ---- tree -> blocks ----
  const toBlock = (a: IActivity): Block => {
    const kids = a.sub_activities || [];
    switch (a.type) {
      case "sequential":
        return seq(kids.map(toBlock));
      case "parallel":
        return kids.length
          ? split(kids.map(toBlock), { parallel: true })
          : skip();
      case "loop":
        return loop(
          seq(kids.map(toBlock)),
          conditionText(a.loop_condition ?? a.condition),
        );
      case "condition": {
        const yes = kids[0] ? toBlock(kids[0]) : skip();
        const no =
          kids.length === 2
            ? toBlock(kids[1])
            : kids.length > 2
              ? seq(kids.slice(1).map(toBlock))
              : skip();
        const text =
          conditionText(a.condition) || a.name?.trim() || "condition";
        return seq([
          term(text, "cond"),
          split([yes, no], { labels: ["Y", "N"] }),
        ]);
      }
      default:
        return term(label(a));
    }
  };

  const root =
    algorithm.type === "parallel" && algorithm.sub_activities.length
      ? split(algorithm.sub_activities.map(toBlock), { parallel: true })
      : seq(algorithm.sub_activities.map(toBlock));

  const PAD = 4;
  const STUB = 10;
  const width = root.w + 2 * STUB + 2 * PAD;
  const height = root.h + 2 * PAD;
  const ya = PAD + root.axis;
  return (
    <Box sx={{ overflowX: "auto", maxWidth: "100%" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", fontFamily: "inherit" }}
      >
        {track(PAD, PAD + STUB, ya)}
        {root.draw(PAD + STUB, PAD)}
        {track(PAD + STUB + root.w, width - PAD, ya)}
        <circle cx={width - PAD} cy={ya} r={2.5} fill={c.line} />
      </svg>
    </Box>
  );
};

export default InlineFlow;
