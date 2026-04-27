import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Search as SearchIcon,
  ErrorOutline as ErrorOutlineIcon,
  ExploreOutlined as CompassIcon,
  AccountTreeOutlined as GraphIcon,
  AutoAwesomeOutlined as SparkIcon,
} from "@mui/icons-material";
import {
  collection,
  getDocs,
  getFirestore,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import NodeCompass from "../../components/NodBody/NodeCompass";
import NodeGraph from "../../components/NodBody/NodeGraph";
import { AiPanel } from "./_components/AiPanel";
import type { ICollection, INode } from "../../types/INode";
import { NODES } from "../../lib/firestoreClient/collections";

const INTER =
  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

type Rel = { id: string; title: string };

// Description lives either on `properties.description` (any-typed) or on
// `textValue.description` depending on the node. Normalize to a trimmed
// string, or empty when nothing usable exists.
const getDescription = (node: INode): string => {
  const p = node.properties as Record<string, unknown> | undefined;
  const fromProps = p?.description;
  if (typeof fromProps === "string" && fromProps.trim()) {
    return fromProps.trim();
  }
  const tv = node.textValue as Record<string, string> | undefined;
  const fromTv = tv?.description;
  if (typeof fromTv === "string" && fromTv.trim()) {
    return fromTv.trim();
  }
  return "";
};

// Rank: exact match > starts-with > contains.
const scoreMatch = (title: string, q: string): number => {
  const t = title.toLowerCase();
  if (t === q) return 3;
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  return 0;
};

const countLinks = (cols: ICollection[] | undefined | null): number => {
  if (!Array.isArray(cols)) return 0;
  let n = 0;
  for (const c of cols) n += c?.nodes?.length ?? 0;
  return n;
};

// Format counts for the stats pill: < 10K uses thousands separator (e.g.
// "4,423"), >= 10K rounds to "NK+" (e.g. "18K+"), >= 1M to "N.MM+".
const formatStat = (n: number): string => {
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K+`;
  return `${(n / 1_000_000).toFixed(1)}M+`;
};

// ──────────────────────────────────────────────────────────────
// Detail panel — relation chip group (right panel)
// ──────────────────────────────────────────────────────────────

const RelationGroup: React.FC<{
  label: string;
  color: string;
  items: Rel[];
  onSelect: (id: string) => void;
}> = ({ label, color, items, onSelect }) => {
  if (items.length === 0) return null;
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 1,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
          }}
        />
        <Typography
          sx={{
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "text.secondary",
            fontFamily: INTER,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.68rem",
            fontWeight: 600,
            color: "text.disabled",
            fontVariantNumeric: "tabular-nums",
            fontFamily: INTER,
          }}
        >
          · {items.length}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {items.map((item) => (
          <Chip
            key={item.id}
            label={item.title}
            size="small"
            onClick={() => onSelect(item.id)}
            sx={{
              bgcolor: alpha(color, 0.08),
              border: `1px solid ${alpha(color, 0.25)}`,
              color: "text.primary",
              fontSize: "0.75rem",
              fontFamily: INTER,
              height: 26,
              mb: 0.5,
              transition: "all 0.15s ease",
              "& .MuiChip-label": { px: 1.1 },
              "&:hover": {
                bgcolor: alpha(color, 0.16),
                borderColor: alpha(color, 0.5),
                color: color,
                transform: "translateY(-1px)",
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Navigate section
// ──────────────────────────────────────────────────────────────

export const NavigateLandingSection = ({
  isDark,
  appName,
  initialNodeId,
  onBackToPlatform,
}: {
  isDark: boolean;
  appName: string;
  initialNodeId?: string | null;
  onBackToPlatform: () => void;
}) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const [nodes, setNodes] = useState<{ [id: string]: INode } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"compass" | "graph">("compass");
  const [sidebarTab, setSidebarTab] = useState<"search" | "ai">("search");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getFirestore();
        const q = firestoreQuery(
          collection(db, NODES),
          where("appName", "==", appName),
          where("deleted", "==", false),
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const loaded: { [id: string]: INode } = {};
        let root: string | null = null;
        snapshot.forEach((doc) => {
          const raw = doc.data() as Record<string, unknown>;
          const data = { id: doc.id, ...raw } as INode;
          loaded[doc.id] = data;
          if (!root && (raw.root === true || raw.root === "true")) {
            root = doc.id;
          }
        });
        setNodes(loaded);
        // Prefer the caller-supplied initial node id when it's a valid
        // node for this app; otherwise fall back to the app's root.
        if (initialNodeId && loaded[initialNodeId]) {
          setActiveId(initialNodeId);
        } else {
          setActiveId(root);
        }
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : "Failed to load ontology from Firestore.";
          setLoadError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appName, initialNodeId]);

  // Mirror the focused node into the URL hash so the back-to-platform
  // callback can read it, refreshes preserve focus, and the link is
  // shareable. The `/navigate` suffix is the mode marker that [id].tsx
  // uses to decide which component to render.
  useEffect(() => {
    if (!activeId) return;
    if (typeof window === "undefined") return;
    const target = `#${activeId}/navigate`;
    if (window.location.hash !== target) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${target}`,
      );
    }
  }, [activeId]);

  // Re-seed activeId when the URL hash is updated externally — e.g. the
  // platform firing "Open in Navigator" again while the navigator is still
  // mounted. Internal clicks use `replaceState`, which doesn't fire
  // hashchange, so we won't loop on our own updates.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (!h.endsWith("/navigate")) return;
      const id = h.slice(0, -"/navigate".length);
      if (id && nodes && nodes[id] && id !== activeId) {
        setActiveId(id);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [nodes, activeId]);

  const navigateToNode = useCallback(
    (id: string) => {
      if (!nodes || !nodes[id]) return;
      setActiveId(id);
    },
    [nodes],
  );

  // Graph view's expansion state lives here so it survives toggling between
  // compass ↔ graph (either view unmounts when the toggle switches away).
  // Reset whenever the active node changes — a fresh focus is a fresh tree.
  const [graphExpanded, setGraphExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    setGraphExpanded(new Set());
  }, [activeId]);
  const toggleGraphExpand = useCallback((id: string) => {
    setGraphExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Search results: ranked flat list of nodes whose title matches the query.
  // Empty query → empty list (left panel shows an empty-state prompt).
  const searchResults = useMemo(() => {
    if (!nodes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored: Array<{ node: INode; score: number }> = [];
    for (const node of Object.values(nodes)) {
      const s = scoreMatch(node.title ?? "", q);
      if (s > 0) scored.push({ node, score: s });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.node.title ?? "").localeCompare(b.node.title ?? "");
    });
    return scored.slice(0, 200).map((s) => s.node);
  }, [query, nodes]);

  // Header stats: process count, undirected relationship count (gen/spec +
  // parts/isPartOf are inverse pairs, so we count directed links and halve),
  // and max specialization depth via BFS from any root-flagged node.
  const stats = useMemo(() => {
    if (!nodes) return null;
    const values = Object.values(nodes);
    const processes = values.length;

    let directed = 0;
    for (const n of values) {
      directed += countLinks(n.generalizations);
      directed += countLinks(n.specializations);
      directed += countLinks(n.properties?.parts as ICollection[] | undefined);
      directed += countLinks(
        n.properties?.isPartOf as ICollection[] | undefined,
      );
    }
    const relationships = Math.round(directed / 2);

    const roots = values.filter((n) => {
      const r = (n as unknown as { root?: unknown }).root;
      return r === true || r === "true";
    });
    let depth = 0;
    const visited = new Set<string>();
    let frontier: string[] = roots.map((r) => r.id);
    frontier.forEach((id) => visited.add(id));
    while (frontier.length && depth < 64) {
      const next: string[] = [];
      for (const id of frontier) {
        const node = nodes[id];
        if (!node) continue;
        for (const col of node.specializations ?? []) {
          for (const child of col?.nodes ?? []) {
            if (child?.id && !visited.has(child.id) && nodes[child.id]) {
              visited.add(child.id);
              next.push(child.id);
            }
          }
        }
      }
      if (next.length === 0) break;
      depth += 1;
      frontier = next;
    }

    return { processes, relationships, depth };
  }, [nodes]);

  // Loading / error states
  if (loadError) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
          px: 3,
          bgcolor: "background.default",
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 40, color: "error.main" }} />
        <Typography
          sx={{ fontFamily: INTER, fontWeight: 600, fontSize: "1.05rem" }}
        >
          Couldn't load the ontology
        </Typography>
        <Typography
          sx={{
            fontFamily: INTER,
            fontSize: "0.85rem",
            color: "text.secondary",
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          {loadError}
        </Typography>
      </Box>
    );
  }

  if (!nodes || !activeId) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
          bgcolor: "background.default",
        }}
      >
        <CircularProgress size={28} thickness={4} />
        <Typography
          sx={{
            fontFamily: INTER,
            fontSize: "0.85rem",
            color: "text.secondary",
          }}
        >
          Loading the ontology of activities…
        </Typography>
      </Box>
    );
  }

  const activeNode = nodes[activeId];
  const description = getDescription(activeNode);

  const axisColors = {
    generalizations: isDark ? "#bc8cff" : "#8250df",
    specializations: accent,
    parts: theme.palette.success.main,
    isPartOf: theme.palette.warning.main,
  };

  // Resolve relation title from the link itself first, then fall back to the
  // node map — chips should never show raw ids.
  const relationsOf = (cols: ICollection[] | undefined): Rel[] =>
    (cols ?? [])
      .flatMap((c) => c?.nodes ?? [])
      .filter((n) => !!n?.id)
      .map((n) => {
        const linkTitle = n.title?.trim();
        const fromMap = nodes[n.id]?.title?.trim();
        return {
          id: n.id,
          title: linkTitle || fromMap || n.id,
        };
      });

  const generalizations = relationsOf(activeNode.generalizations);
  const specializations = relationsOf(activeNode.specializations);
  const parts = relationsOf(
    activeNode.properties?.parts as ICollection[] | undefined,
  );
  const isPartOf = relationsOf(
    activeNode.properties?.isPartOf as ICollection[] | undefined,
  );

  // Modern dividers: very low-contrast 1px line derived from text color rather
  // than MUI's default `divider` token, which reads as stark white in dark mode.
  const softDivider = (t: typeof theme) =>
    alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.06 : 0.07);
  const panelTint = (t: typeof theme) =>
    t.palette.mode === "dark"
      ? alpha(t.palette.text.primary, 0.015)
      : alpha(t.palette.text.primary, 0.02);

  return (
    <Box
      sx={{
        height: "100vh",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      <Grid container sx={{ height: "100%", flexWrap: { md: "nowrap" } }}>
        {/* Left: search + AI tab */}
        <Grid
          size={{ xs: 12, md: 3 }}
          sx={{
            borderRight: { xs: 0, md: `1px solid` },
            borderBottom: { xs: `1px solid`, md: 0 },
            borderColor: (t) => `${softDivider(t)} !important`,
            bgcolor: panelTint,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Segmented tab switcher — glass pill, matches the compass/graph toggle */}
          <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
            <Box
              sx={{
                display: "flex",
                gap: 0.25,
                p: 0.35,
                borderRadius: 999,
                bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                border: (t) =>
                  `1px solid ${alpha(t.palette.text.primary, 0.05)}`,
                backdropFilter: "blur(8px)",
              }}
            >
              {(
                [
                  { id: "search", label: "Search", Icon: SearchIcon },
                  { id: "ai", label: "Ask AI", Icon: SparkIcon },
                ] as const
              ).map(({ id, label, Icon }) => {
                const isActive = sidebarTab === id;
                return (
                  <Box
                    key={id}
                    component="button"
                    type="button"
                    onClick={() => setSidebarTab(id)}
                    sx={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.55,
                      px: 1,
                      py: 0.7,
                      borderRadius: 999,
                      border: "none",
                      background: isActive
                        ? (t) => alpha(t.palette.primary.main, 0.16)
                        : "transparent",
                      cursor: "pointer",
                      color: isActive ? "primary.main" : "text.secondary",
                      fontFamily: INTER,
                      fontSize: "0.78rem",
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: 0.2,
                      boxShadow: isActive
                        ? (t) =>
                            t.palette.mode === "dark"
                              ? `0 1px 2px rgba(0,0,0,0.25), inset 0 0 0 1px ${alpha(t.palette.primary.main, 0.28)}`
                              : `0 1px 2px rgba(0,0,0,0.04), inset 0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}`
                        : "none",
                      transition: "all 0.18s ease",
                      "&:hover": {
                        background: isActive
                          ? (t) => alpha(t.palette.primary.main, 0.22)
                          : (t) => alpha(t.palette.text.primary, 0.05),
                        color: isActive ? "primary.main" : "text.primary",
                      },
                    }}
                  >
                    <Icon sx={{ fontSize: 15 }} />
                    {label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Both panels stay mounted so switching tabs preserves state
              (chat history, scroll position, in-flight request). */}
          <Box
            sx={{
              display: sidebarTab === "search" ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
          <Box sx={{ p: 2.5, pb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search activities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={{ color: "text.secondary", fontSize: 18 }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 999,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                  fontFamily: INTER,
                  "& fieldset": {
                    borderColor: (t) => alpha(t.palette.text.primary, 0.08),
                  },
                  "&:hover fieldset": {
                    borderColor: (t) => alpha(t.palette.text.primary, 0.16),
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: (t) => alpha(t.palette.primary.main, 0.6),
                  },
                },
              }}
            />
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              maxHeight: { xs: 320, md: "none" },
              overflowY: "auto",
              px: 1.5,
              pb: 2,
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar-thumb": {
                background: alpha(theme.palette.text.primary, 0.14),
                borderRadius: 3,
              },
            }}
          >
            {query.trim() === "" ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 0.75,
                  mt: 4,
                  px: 2,
                  color: "text.secondary",
                }}
              >
                <SearchIcon sx={{ fontSize: 22, opacity: 0.5 }} />
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontFamily: INTER,
                    fontWeight: 500,
                    color: "text.secondary",
                  }}
                >
                  Search any activity
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontFamily: INTER,
                    color: "text.disabled",
                    lineHeight: 1.5,
                  }}
                >
                  Type a keyword to find matching activities across the
                  ontology.
                </Typography>
              </Box>
            ) : searchResults.length === 0 ? (
              <Typography
                sx={{
                  mt: 3,
                  textAlign: "center",
                  fontSize: "0.8rem",
                  fontFamily: INTER,
                  color: "text.disabled",
                }}
              >
                No activities match &ldquo;{query.trim()}&rdquo;.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {searchResults.map((n) => {
                  const isActive = n.id === activeId;
                  const desc = getDescription(n);
                  return (
                    <Box
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateToNode(n.id)}
                      sx={{
                        p: 1.1,
                        borderRadius: 1.5,
                        cursor: "pointer",
                        background: isActive
                          ? alpha(accent, 0.12)
                          : "transparent",
                        border: `1px solid ${
                          isActive ? alpha(accent, 0.35) : "transparent"
                        }`,
                        transition:
                          "background 0.15s ease, border-color 0.15s ease",
                        "&:hover": {
                          background: isActive
                            ? alpha(accent, 0.16)
                            : alpha(theme.palette.text.primary, 0.04),
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.82rem",
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? accent : "text.primary",
                          fontFamily: INTER,
                          lineHeight: 1.3,
                        }}
                      >
                        {n.title}
                      </Typography>
                      {desc && (
                        <Typography
                          sx={{
                            mt: 0.4,
                            fontSize: "0.72rem",
                            color: "text.secondary",
                            fontFamily: INTER,
                            lineHeight: 1.45,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {desc}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
          </Box>

          <Box
            sx={{
              display: sidebarTab === "ai" ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <AiPanel nodes={nodes} navigateToNode={navigateToNode} />
          </Box>
        </Grid>

        {/* Center: compass / graph (toggle overlaid at top) */}
        <Grid
          size={{ xs: 12, md: 6 }}
          sx={{
            height: { xs: 520, md: "100%" },
            minHeight: 0,
            position: "relative",
            bgcolor: (t) =>
              t.palette.mode === "dark" ? "#0d1117" : "#fafbfc",
          }}
        >
          {view === "compass" ? (
            <NodeCompass
              currentVisibleNode={activeNode}
              relatedNodes={nodes}
              navigateToNode={navigateToNode}
              borderless
            />
          ) : (
            <NodeGraph
              currentVisibleNode={activeNode}
              relatedNodes={nodes}
              navigateToNode={navigateToNode}
              borderless
              expanded={graphExpanded}
              onToggleExpand={toggleGraphExpand}
            />
          )}

          <Box
            component="button"
            type="button"
            onClick={onBackToPlatform}
            sx={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 12,
              display: "flex",
              alignItems: "center",
              gap: 0.55,
              height: 32,
              px: 1.25,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontFamily: INTER,
              fontSize: "0.78rem",
              fontWeight: 500,
              letterSpacing: 0.2,
              color: "text.primary",
              background: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(13,17,23,0.82)"
                  : "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              boxShadow: (t) =>
                t.palette.mode === "dark"
                  ? "0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)"
                  : "0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)",
              transition: "background 0.18s ease, color 0.18s ease",
              "&:hover": {
                background: (t) => alpha(t.palette.primary.main, 0.12),
                color: (t) => t.palette.primary.main,
              },
              "& svg": { fontSize: 17 },
            }}
          >
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* inline arrow-left glyph to avoid a new import */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </Box>
            Back to Platform
          </Box>

          {/* View toggle — top-center, glass surface */}
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 12,
              borderRadius: 999,
              p: 0.4,
              background: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(13,17,23,0.82)"
                  : "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              boxShadow: (t) =>
                t.palette.mode === "dark"
                  ? "0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)"
                  : "0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)",
            }}
          >
            <ToggleButtonGroup
              value={view}
              exclusive
              size="small"
              onChange={(_, v) => {
                if (v) setView(v);
              }}
              sx={{
                "& .MuiToggleButton-root": {
                  border: "none",
                  borderRadius: "999px !important",
                  px: 1.6,
                  py: 0.4,
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  letterSpacing: 0.2,
                  color: "text.secondary",
                  gap: 0.6,
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
                    color: "text.primary",
                  },
                  "&.Mui-selected": {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.16),
                    color: "primary.main",
                    fontWeight: 600,
                    "&:hover": {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.22),
                    },
                  },
                },
              }}
            >
              <ToggleButton value="compass" aria-label="Compass view">
                <CompassIcon sx={{ fontSize: 15 }} />
                Compass
              </ToggleButton>
              <ToggleButton value="graph" aria-label="Graph view">
                <GraphIcon sx={{ fontSize: 15 }} />
                Graph
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Stats pill — top-right, glass surface matching the view toggle.
              Horizontal pill on wide (xl+) screens; stacks vertically from
              md to lg so it doesn't crowd the compass/graph canvas. */}
          {stats && (
            <Box
              sx={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 12,
                display: { xs: "none", md: "flex" },
                flexDirection: { md: "column", xl: "row" },
                alignItems: { md: "stretch", xl: "center" },
                borderRadius: { md: "14px", xl: "999px" },
                background: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(24,30,38,0.92)"
                    : "rgba(255,255,255,0.96)",
                backdropFilter: "blur(10px)",
                border: (t) =>
                  `1px solid ${alpha(
                    t.palette.text.primary,
                    t.palette.mode === "dark" ? 0.1 : 0.07,
                  )}`,
                boxShadow: (t) =>
                  t.palette.mode === "dark"
                    ? "0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : "0 4px 14px rgba(0,0,0,0.08)",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {[
                { value: formatStat(stats.processes), label: "Processes" },
                {
                  value: formatStat(stats.relationships),
                  label: "Relationships",
                },
                { value: String(stats.depth), label: "Levels" },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && (
                    <Box
                      sx={{
                        alignSelf: "stretch",
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
                        width: { md: "auto", xl: "1px" },
                        height: { md: "1px", xl: "auto" },
                        my: { md: 0, xl: 0.9 },
                        mx: { md: 1.2, xl: 0 },
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      px: 1.6,
                      py: 0.75,
                      display: "flex",
                      alignItems: "baseline",
                      gap: 0.55,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "text.primary",
                        fontFamily: INTER,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: "-0.01em",
                        lineHeight: 1,
                      }}
                    >
                      {s.value}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.72rem",
                        fontWeight: 500,
                        color: "text.secondary",
                        fontFamily: INTER,
                        lineHeight: 1,
                      }}
                    >
                      {s.label}
                    </Typography>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          )}
        </Grid>

        {/* Right: detail */}
        <Grid
          size={{ xs: 12, md: 3 }}
          sx={{
            borderLeft: { xs: 0, md: `1px solid` },
            borderTop: { xs: `1px solid`, md: 0 },
            borderColor: (t) => `${softDivider(t)} !important`,
            p: 3,
            bgcolor: panelTint,
            overflowY: "auto",
            height: { md: "100%" },
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": {
              background: (t) => alpha(t.palette.text.primary, 0.14),
              borderRadius: 3,
            },
          }}
        >
          <Typography
            sx={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "text.secondary",
              mb: 1,
              fontFamily: INTER,
            }}
          >
            Selected Activity
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              mb: description ? 2 : 3,
              fontFamily: INTER,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {activeNode.title}
          </Typography>
          {description && (
            <Box
              sx={{
                p: 1.5,
                mb: 3,
                bgcolor: (t) => alpha(t.palette.text.primary, 0.025),
                border: (t) =>
                  `1px solid ${alpha(t.palette.text.primary, 0.05)}`,
                borderRadius: 2,
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  color: "text.secondary",
                  lineHeight: 1.55,
                  fontFamily: INTER,
                }}
              >
                {description}
              </Typography>
            </Box>
          )}
          <Stack spacing={2.5}>
            <RelationGroup
              label="Generalizations"
              color={axisColors.generalizations}
              items={generalizations}
              onSelect={navigateToNode}
            />
            <RelationGroup
              label="Specializations"
              color={axisColors.specializations}
              items={specializations}
              onSelect={navigateToNode}
            />
            <RelationGroup
              label="Parts"
              color={axisColors.parts}
              items={parts}
              onSelect={navigateToNode}
            />
            <RelationGroup
              label="Is Part Of"
              color={axisColors.isPartOf}
              items={isPartOf}
              onSelect={navigateToNode}
            />
            {generalizations.length === 0 &&
              specializations.length === 0 &&
              parts.length === 0 &&
              isPartOf.length === 0 && (
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    color: "text.disabled",
                    fontStyle: "italic",
                    fontFamily: INTER,
                  }}
                >
                  No relationships documented.
                </Typography>
              )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NavigateLandingSection;
