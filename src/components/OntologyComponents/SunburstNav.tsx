import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import { getFirestore } from "firebase/firestore";
import * as d3 from "d3";
import { UNCLASSIFIED_COLLECTION } from "@components/lib/CONSTANTS";
import { batchGetNodesByIds } from "@components/lib/utils/loadOutlineFromPathIds";
import { choosePrimaryParentId } from "@components/lib/utils/derivedNavigation";
import { fetchSingleNode } from "@components/lib/utils/ontology.helpers";
import { INode } from "@components/types/INode";

const INNER_RADIUS = 78;
const RING_THICKNESS = 76;
const RING_GAP = 1.5;
const MAX_RINGS = 4;
const MAX_NODES = 480;
const FRAME_PAD = 28;
const CHAR_WIDTH = 0.56;
const LINE_HEIGHT = 1.22;
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;
const DRAG_THRESHOLD = 5;

const clampScale = (scale: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

type BurstNode = {
  id: string;
  name: string;
  hasChildren: boolean;
  children: BurstNode[];
};

type Crumb = { id: string; title: string };

type Props = {
  node: INode | null;
  appName: string;
  onNavigate: (nodeId: string) => void;
  /** Space left above the breadcrumb for a floating toolbar. */
  insetTop?: number;
  zoomPlacement?: "top" | "bottom";
};

const childIdsOf = (node: INode | undefined): string[] => {
  if (!node || node.unclassified) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const collection of node.specializations || []) {
    if (collection.collectionName === UNCLASSIFIED_COLLECTION) continue;
    for (const link of collection.nodes || []) {
      if (!link?.id || seen.has(link.id) || link.id === node.id) continue;
      seen.add(link.id);
      ids.push(link.id);
    }
  }
  return ids;
};

const wrapLabel = (label: string, maxChars: number): string[] => {
  const limit = Math.max(1, maxChars);
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const mix = (a: string, b: string, t: number): string => {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

const rose = (t: number): string => {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.5) return mix("#fff1f2", "#fda4af", x / 0.5);
  return mix("#fda4af", "#e11d48", (x - 0.5) / 0.5);
};

const luminance = (color: string): number => {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return 1;
  const [r, g, b] = [match[1], match[2], match[3]].map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const inkFor = (fill: string): string =>
  luminance(fill) > 0.62 ? "#3f1d26" : "#ffffff";

const FitIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const SunburstNav = ({
  node,
  appName,
  onNavigate,
  insetTop = 0,
  zoomPlacement = "top",
}: Props) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const canvas = dark ? "#0b0f17" : "#f8fafc";
  const crumbColor = dark ? "#cbd5e1" : "#334155";
  const [tree, setTree] = useState<BurstNode | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  // Sector under the pointer when the press started. Used only if the
  // gesture never crosses the drag threshold.
  const clickIdRef = useRef<string | null>(null);

  const nodeRef = useRef(node);
  nodeRef.current = node;

  const focusKey = node
    ? `${node.id}:${(node.specializations || []).reduce(
        (n, c) => n + (c.nodes?.length || 0),
        0,
      )}:${(node.generalizations || []).reduce(
        (n, c) => n + (c.nodes?.length || 0),
        0,
      )}`
    : "";

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [node?.id]);

  const onStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest?.("[data-zoom-controls]")) return;
    clickIdRef.current =
      target.closest?.("[data-burst-id]")?.getAttribute("data-burst-id") ||
      null;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: panRef.current.x,
      oy: panRef.current.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
    }
    setPan({ x: drag.ox + dx, y: drag.oy + dy });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const moved = dragRef.current?.moved ?? false;
    const id = clickIdRef.current;
    dragRef.current = null;
    clickIdRef.current = null;
    setDragging(false);
    if (commit && !moved && id) onNavigate(id);
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setScale((current) => clampScale(current * factor));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    setScale((current) => clampScale(current * factor));
  };

  useEffect(() => {
    const focus = nodeRef.current;
    if (!focus) {
      setTree(null);
      setCrumbs([]);
      setParentId(null);
      return;
    }

    let cancelled = false;
    const db = getFirestore();

    const load = async () => {
      setTree({
        id: focus.id,
        name: focus.title || "Untitled",
        hasChildren: childIdsOf(focus).length > 0,
        children: [],
      });
      setCrumbs([{ id: focus.id, title: focus.title || "Untitled" }]);
      setParentId(choosePrimaryParentId(focus.generalizations));
      setLoading(true);
      try {
        const byId = new Map<string, INode>();
        byId.set(focus.id, focus);
        const parentOf = new Map<string, string | null>();
        parentOf.set(focus.id, null);

        let frontier = [focus.id];
        for (let depth = 0; depth < MAX_RINGS; depth++) {
          const nextIds: string[] = [];
          for (const id of frontier) {
            const current = byId.get(id);
            for (const childId of childIdsOf(current)) {
              if (parentOf.has(childId)) continue;
              parentOf.set(childId, id);
              nextIds.push(childId);
              if (byId.size + nextIds.length >= MAX_NODES) break;
            }
            if (byId.size + nextIds.length >= MAX_NODES) break;
          }
          if (nextIds.length === 0) break;
          const fetched = await batchGetNodesByIds(db, nextIds, appName);
          if (cancelled) return;
          const loaded: string[] = [];
          for (const id of nextIds) {
            if (!fetched[id]) {
              parentOf.delete(id);
              continue;
            }
            byId.set(id, fetched[id]);
            loaded.push(id);
          }
          frontier = loaded;
          if (byId.size >= MAX_NODES) break;
        }

        const build = (id: string, seen: Set<string>): BurstNode | null => {
          if (seen.has(id)) return null;
          const current = byId.get(id);
          if (!current) return null;
          seen.add(id);
          const children: BurstNode[] = [];
          for (const childId of childIdsOf(current)) {
            if (parentOf.get(childId) !== id) continue;
            const child = build(childId, seen);
            if (child) children.push(child);
          }
          return {
            id: current.id,
            name: current.title || "Untitled",
            hasChildren: childIdsOf(current).length > 0,
            children,
          };
        };

        const chain: Crumb[] = [];
        const seenAncestors = new Set<string>();
        let cursor: INode | null = focus;
        let primaryParent: string | null = null;
        while (cursor && !seenAncestors.has(cursor.id) && chain.length < 24) {
          seenAncestors.add(cursor.id);
          chain.unshift({
            id: cursor.id,
            title: cursor.title || "Untitled",
          });
          const nextId = choosePrimaryParentId(cursor.generalizations);
          if (cursor.id === focus.id) primaryParent = nextId;
          if (!nextId) break;
          cursor = await fetchSingleNode(db, nextId, appName);
          if (cancelled) return;
        }

        if (cancelled) return;
        setTree(build(focus.id, new Set()));
        setCrumbs(chain);
        setParentId(primaryParent);
      } catch (error) {
        console.error("sunburst navigation load failed", error);
        if (!cancelled) {
          setTree({
            id: focus.id,
            name: focus.title || "Untitled",
            hasChildren: false,
            children: [],
          });
          setCrumbs([{ id: focus.id, title: focus.title || "Untitled" }]);
          setParentId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [focusKey, appName]);

  const layout = useMemo(() => {
    if (!tree) return null;
    const hierarchy = d3
      .hierarchy(tree)
      .sum((d) => (d.children.length === 0 ? 1 : 0));
    const root = d3.partition<BurstNode>().size([2 * Math.PI, 1])(hierarchy);
    const descendants = root.descendants();
    const maxValue = d3.max(descendants, (d) => d.value || 0) || 1;
    const ringCount = Math.max(
      2,
      d3.max(descendants, (d) => d.depth) || 0,
    );
    const outer = INNER_RADIUS + ringCount * RING_THICKNESS;
    const frame = outer + FRAME_PAD;

    const arc = d3
      .arc<d3.HierarchyRectangularNode<BurstNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(INNER_RADIUS)
      .innerRadius((d) => INNER_RADIUS + (d.depth - 1) * RING_THICKNESS + RING_GAP / 2)
      .outerRadius(
        (d) => INNER_RADIUS + d.depth * RING_THICKNESS - RING_GAP / 2,
      );

    const slices = descendants.slice(1).map((d) => {
      const share = Math.sqrt((d.value || 0) / maxValue);
      const fill = rose(share);
      const level = d.depth + 1;
      const fontPx = Math.max(8, 14 - (level - 2) * 1.6);
      const rInner = INNER_RADIUS + (d.depth - 1) * RING_THICKNESS + RING_GAP / 2;
      const rOuter = INNER_RADIUS + d.depth * RING_THICKNESS - RING_GAP / 2;
      const rMid = (rInner + rOuter) / 2;
      const arcLen = Math.max(0, d.x1 - d.x0) * rMid;
      const radial = rOuter - rInner;
      const tangential = level <= 3;
      const raw = d.data.name;
      const lines = wrapLabel(raw, 16).slice(0, 3);
      const longest = lines.reduce((m, line) => Math.max(m, line.length), 0);
      const blockW = longest * fontPx * CHAR_WIDTH;
      const blockH = lines.length * fontPx * LINE_HEIGHT;
      const fits =
        lines.length > 0 &&
        level <= 5 &&
        (tangential
          ? blockW <= arcLen * 0.92 && blockH <= radial * 0.88
          : blockW <= radial * 0.88 && blockH <= arcLen * 0.92);
      const mid = (d.x0 + d.x1) / 2;
      const midDeg = (mid * 180) / Math.PI - 90;
      let rotation = tangential ? midDeg + 90 : midDeg;
      if (rotation > 90 && rotation < 270) rotation += 180;
      const [x, y] = arc.centroid(d);
      return {
        id: d.data.id,
        name: d.data.name,
        d: arc(d) || "",
        fill,
        ink: inkFor(fill),
        lines: fits ? lines : [],
        fontPx,
        x,
        y,
        rotation,
        lineHeight: fontPx * LINE_HEIGHT,
      };
    });

    const centerLines = wrapLabel(tree.name, 16).slice(0, 3);
    const centerFont = Math.min(20, Math.max(11, INNER_RADIUS * 0.22));

    return { slices, frame, centerLines, centerFont };
  }, [tree]);

  if (!node) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          placeItems: "center",
          color: "text.secondary",
          background: canvas,
        }}
      >
        <Typography sx={{ fontSize: 13 }}>Open a node to navigate.</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: canvas,
        position: "relative",
        pt: insetTop ? `${insetTop}px` : 0,
      }}
    >
      <Box
        component="nav"
        aria-label="Ontology drill path"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          px: 1.25,
          py: 1,
          overflowX: "auto",
          flexShrink: 0,
          borderBottom: `1px solid ${dark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)"}`,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Box
              key={crumb.id}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
            >
              {index > 0 && (
                <ChevronRightRoundedIcon
                  sx={{ fontSize: 16, color: dark ? "#64748b" : "#94a3b8" }}
                />
              )}
              <Box
                component="button"
                type="button"
                disabled={last}
                title={crumb.title}
                onClick={() => {
                  if (!last) onNavigate(crumb.id);
                }}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.4,
                  maxWidth: 180,
                  border: "none",
                  borderRadius: "6px",
                  px: 0.75,
                  py: 0.35,
                  background: "transparent",
                  color: last ? (dark ? "#f8fafc" : "#0f172a") : crumbColor,
                  font: "inherit",
                  fontSize: 13,
                  fontWeight: last ? 600 : 500,
                  cursor: last ? "default" : "pointer",
                  "&:hover": last
                    ? undefined
                    : {
                        background: dark
                          ? "rgba(148,163,184,0.14)"
                          : "rgba(15,23,42,0.06)",
                      },
                }}
              >
                {index === 0 && (
                  <HomeRoundedIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                )}
                <Box
                  component="span"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {crumb.title}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box
        ref={stageRef}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={(event) => finishPointer(event, true)}
        onPointerCancel={(event) => finishPointer(event, false)}
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
          cursor: dragging ? "grabbing" : "grab",
          "& path, & circle": { cursor: dragging ? "grabbing" : "pointer" },
        }}
      >
        {layout && (
          <svg
            viewBox={`${-layout.frame} ${-layout.frame} ${layout.frame * 2} ${layout.frame * 2}`}
            width="100%"
            height="100%"
            role="img"
            aria-label="Sunburst navigation"
            style={{
              maxHeight: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
          >
            {layout.slices.map((slice) => (
              <path
                key={slice.id}
                data-burst-id={slice.id}
                d={slice.d}
                fill={slice.fill}
                stroke={canvas}
                strokeWidth={hoveredId === slice.id ? 2 : 1}
                strokeLinejoin="round"
                style={{
                  filter:
                    hoveredId === slice.id ? "brightness(1.08)" : undefined,
                }}
                onMouseEnter={() => setHoveredId(slice.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <title>{slice.name}</title>
              </path>
            ))}
            <circle
              data-burst-id={parentId ?? undefined}
              r={INNER_RADIUS - 1}
              fill={canvas}
            />
            {layout.centerLines.map((line, index) => {
              const lh = layout.centerFont * LINE_HEIGHT;
              const total = (layout.centerLines.length - 1) * lh;
              return (
                <text
                  key={`center-${index}`}
                  x={0}
                  y={-total / 2 + index * lh}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={dark ? "#f8fafc" : "#0f172a"}
                  fontSize={layout.centerFont}
                  fontWeight={600}
                  fontFamily="Inter, system-ui, sans-serif"
                  pointerEvents="none"
                >
                  {line}
                </text>
              );
            })}
            {layout.slices.flatMap((slice) =>
              slice.lines.map((line, index) => {
                const total = (slice.lines.length - 1) * slice.lineHeight;
                const dy = -total / 2 + index * slice.lineHeight;
                return (
                  <text
                    key={`${slice.id}-${index}`}
                    x={slice.x}
                    y={slice.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={slice.ink}
                    fontSize={slice.fontPx}
                    fontWeight={500}
                    fontFamily="Inter, system-ui, sans-serif"
                    pointerEvents="none"
                    transform={`rotate(${slice.rotation} ${slice.x} ${slice.y}) translate(0 ${dy})`}
                  >
                    {line}
                  </text>
                );
              }),
            )}
          </svg>
        )}
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 999,
                background: dark ? "rgba(15,23,42,0.78)" : "rgba(255,255,255,0.88)",
                color: dark ? "#f8fafc" : "#0f172a",
              }}
            >
              <CircularProgress size={14} sx={{ color: "#e11d48" }} />
              <Typography sx={{ fontSize: 12 }}>Loading rings…</Typography>
            </Box>
          </Box>
        )}
        <Box
          data-zoom-controls
          sx={{
            position: "absolute",
            top: zoomPlacement === "top" ? 12 : undefined,
            bottom: zoomPlacement === "bottom" ? 12 : undefined,
            right: 12,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
          }}
        >
          {[
            {
              label: "Zoom in",
              disabled: scale >= MAX_SCALE,
              onClick: () => zoomBy(ZOOM_STEP),
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              ),
            },
            {
              label: "Zoom out",
              disabled: scale <= MIN_SCALE,
              onClick: () => zoomBy(1 / ZOOM_STEP),
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              ),
            },
            {
              label: "Fit",
              disabled: false,
              onClick: () => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              },
              icon: <FitIcon />,
            },
          ].map((control) => (
            <Box
              key={control.label}
              component="button"
              type="button"
              aria-label={control.label}
              title={control.label}
              disabled={control.disabled}
              onClick={control.onClick}
              sx={{
                width: 34,
                height: 34,
                p: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: "8px",
                cursor: control.disabled ? "default" : "pointer",
                color: dark ? "#e2e8f0" : "#1e293b",
                background: dark ? "rgba(15, 23, 42, 0.92)" : "rgba(255,255,255,0.94)",
                border: `1px solid ${dark ? "rgba(148,163,184,0.28)" : "rgba(15,23,42,0.12)"}`,
                boxShadow: dark
                  ? "0 4px 14px rgba(0,0,0,0.35)"
                  : "0 4px 14px rgba(15,23,42,0.08)",
                "&:hover": control.disabled
                  ? undefined
                  : {
                      background: dark ? "rgba(30,41,59,0.96)" : "#ffffff",
                    },
                "&:disabled": { opacity: 0.4 },
              }}
            >
              {control.icon}
            </Box>
          ))}
        </Box>
      </Box>

      <Typography
        sx={{
          flexShrink: 0,
          px: 1.5,
          py: 0.75,
          fontSize: 11,
          color: dark ? "#94a3b8" : "#64748b",
        }}
      >
        Drag to move · Click a sector to open it · Click the center to step up
      </Typography>
    </Box>
  );
};

export default SunburstNav;
