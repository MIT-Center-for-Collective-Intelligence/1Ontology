import React from "react";
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from "@xyflow/react";
import { useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { FlowEdge, Pt } from "./FlowGenerator";
import { useFlowEdit } from "./editContext";

const CORNER = 12;

/** Polyline through `pts` with each interior corner rounded. */
const roundedPath = (pts: Pt[]): string => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(CORNER, inLen / 2, outLen / 2);
    if (r <= 0 || inLen === 0 || outLen === 0) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const a = {
      x: cur.x - ((cur.x - prev.x) / inLen) * r,
      y: cur.y - ((cur.y - prev.y) / inLen) * r,
    };
    const b = {
      x: cur.x + ((next.x - cur.x) / outLen) * r,
      y: cur.y + ((next.y - cur.y) / outLen) * r,
    };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  const end = pts[pts.length - 1];
  return `${d} L ${end.x} ${end.y}`;
};

/** Point half-way along the polyline's length. */
const midpoint = (pts: Pt[]): Pt => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  let left = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (left <= seg) {
      const t = seg === 0 ? 0 : left / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    left -= seg;
  }
  return pts[pts.length - 1];
};

/** Draws the route precomputed by FlowGenerator; ignores handle positions. */
const OrthoEdge: React.FC<EdgeProps<FlowEdge>> = ({ id, data, markerEnd }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { editing, onInsert } = useFlowEdit();
  const points = data?.points ?? [];
  if (points.length < 2) return null;
  const path = roundedPath(points);
  const insert = data?.insert;
  const mid = insert ? midpoint(points) : null;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: data?.color,
          strokeWidth: 1.5,
          strokeDasharray: data?.dashed ? "6 4" : undefined,
        }}
      />
      {editing && insert && mid && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="nopan"
            aria-label="Insert step here"
            onClick={(e) => onInsert(insert, e.currentTarget)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: "all",
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: "50%",
              border: `1px solid ${dark ? "#4b5563" : "#c8cfd6"}`,
              background: dark ? "#23272e" : "#ffffff",
              color: dark ? "#c9d1d9" : "#4b5563",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: dark
                ? "0 1px 2px rgba(0,0,0,0.5)"
                : "0 1px 2px rgba(16,24,40,0.15)",
            }}
          >
            <AddIcon sx={{ fontSize: 15 }} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default OrthoEdge;
