import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Post } from "../../lib/utils/Post";
import { formatOutlineText } from "../../lib/somReview/outline";
import {
  SomOntologyOutlineResponse,
  SomOntologyOutlineSnapshot,
} from "../../types/ISomReview";
import { reviewAccentColor } from "./reviewStyles";

interface OutlineChild {
  childId: string;
  collectionName: string;
}

export const OUTLINE_COLLECTION_COLORS = {
  light: "#9C3D00",
  dark: "#FFB15C",
} as const;

const normalizeCollection = (value: string): string => {
  const normalized = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  return !normalized ||
    normalized.toLowerCase() === "default" ||
    normalized.toLowerCase() === "main"
    ? "main"
    : normalized;
};

const getCollectionKey = (
  parentNodeId: string,
  collectionName: string,
): string =>
  JSON.stringify([parentNodeId, normalizeCollection(collectionName)]);

const getOutlineIndentLevel = (indentLevel: number): number =>
  Math.min(indentLevel, 20);

const treeScrollbarSx = {
  maxHeight: { xs: 420, md: 560 },
  overflow: "auto",
  px: 1,
  py: 1.25,
  "&::-webkit-scrollbar": { width: 8 },
  "&::-webkit-scrollbar-thumb": {
    borderRadius: 8,
    backgroundColor: (theme: { palette: { mode: string } }) =>
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.18)"
        : "rgba(0,0,0,0.18)",
  },
  "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
} as const;

const OutlineNode = ({
  nodeId,
  nodesById,
  childrenByParent,
  expanded,
  expandedCollections,
  showEvidence,
  ancestors,
  onToggle,
  onToggleCollection,
  indentLevel,
}: {
  nodeId: string;
  nodesById: Map<string, SomOntologyOutlineSnapshot["nodes"][number]>;
  childrenByParent: Map<string, OutlineChild[]>;
  expanded: Set<string>;
  expandedCollections: Set<string>;
  showEvidence: boolean;
  ancestors: Set<string>;
  onToggle: (nodeId: string) => void;
  onToggleCollection: (collectionKey: string) => void;
  indentLevel: number;
}) => {
  const node = nodesById.get(nodeId);
  if (!node || (!showEvidence && node.evidence)) return null;

  const children = (childrenByParent.get(nodeId) || []).filter((child) => {
    const childNode = nodesById.get(child.childId);
    return childNode && (showEvidence || !childNode.evidence);
  });
  const groupedChildren = new Map<string, OutlineChild[]>();
  for (const child of children) {
    const collectionName = normalizeCollection(child.collectionName);
    groupedChildren.set(collectionName, [
      ...(groupedChildren.get(collectionName) || []),
      child,
    ]);
  }
  const groups = [...groupedChildren.entries()]
    .map(([collectionName, entries]) => ({
      collectionName,
      entries: [...entries].sort((left, right) =>
        (nodesById.get(left.childId)?.title || "").localeCompare(
          nodesById.get(right.childId)?.title || "",
          "en",
        ),
      ),
    }))
    .sort((left, right) =>
      left.collectionName.localeCompare(right.collectionName, "en"),
    );
  const mainChildren =
    groups.find((group) => group.collectionName === "main")?.entries || [];
  const collectionGroups = groups.filter(
    (group) => group.collectionName !== "main",
  );
  const hasChildren = mainChildren.length > 0 || collectionGroups.length > 0;
  const isExpanded = expanded.has(nodeId);
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(nodeId);
  const nodeIndentLevel = getOutlineIndentLevel(indentLevel);
  const collectionIndentLevel = getOutlineIndentLevel(indentLevel + 1);
  const isEvidence = Boolean(node.evidence);
  const isRoot = indentLevel === 0;
  const renderChild = (
    child: OutlineChild,
    childIndentLevel: number,
    keyPrefix: string,
  ) => {
    const childKey = `${keyPrefix}-${child.childId}`;
    if (nextAncestors.has(child.childId)) {
      return (
        <Typography
          key={childKey}
          sx={{
            ml: `${getOutlineIndentLevel(childIndentLevel) * 14 + 30}px`,
            py: 0.5,
            color: "warning.main",
            fontSize: "0.85rem",
          }}
        >
          {nodesById.get(child.childId)?.title} (circular reference)
        </Typography>
      );
    }

    return (
      <OutlineNode
        key={childKey}
        nodeId={child.childId}
        nodesById={nodesById}
        childrenByParent={childrenByParent}
        expanded={expanded}
        expandedCollections={expandedCollections}
        showEvidence={showEvidence}
        ancestors={nextAncestors}
        onToggle={onToggle}
        onToggleCollection={onToggleCollection}
        indentLevel={childIndentLevel}
      />
    );
  };

  return (
    <Box
      role="treeitem"
      aria-label={`Node: ${node.title}`}
      aria-expanded={hasChildren ? isExpanded : undefined}
      data-outline-kind="node"
      data-outline-indent-level={nodeIndentLevel}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={0.5}
        sx={{
          minHeight: 34,
          pl: `${nodeIndentLevel * 14}px`,
          py: 0.2,
          pr: 0.75,
          borderRadius: 1,
          transition: "background-color 0.15s ease",
          "&:hover": {
            backgroundColor: (theme) =>
              alpha(
                theme.palette.text.primary,
                theme.palette.mode === "dark" ? 0.06 : 0.04,
              ),
          },
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.title}`}
            onClick={() => onToggle(nodeId)}
            sx={{
              width: 30,
              height: 30,
              flex: "0 0 auto",
              color: "text.secondary",
              "&:hover": {
                color: reviewAccentColor,
                backgroundColor: (theme) =>
                  alpha(reviewAccentColor(theme), 0.12),
              },
            }}
          >
            {isExpanded ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </IconButton>
        ) : (
          <Box aria-hidden="true" sx={{ width: 30, flex: "0 0 auto" }} />
        )}
        <Box sx={{ minWidth: 0, pt: 0.45 }}>
          <Typography
            sx={{
              fontSize: isRoot ? "0.98rem" : isEvidence ? "0.84rem" : "0.9rem",
              fontWeight: isRoot ? 800 : isEvidence ? 500 : 600,
              fontStyle: isEvidence ? "italic" : "normal",
              lineHeight: 1.35,
              overflowWrap: "anywhere",
              color: isEvidence ? "text.secondary" : "text.primary",
            }}
          >
            {node.title}
          </Typography>
          {node.synonyms.length > 0 && (
            <Typography
              data-outline-kind="synonyms"
              sx={{
                mt: 0.2,
                color: "text.secondary",
                fontSize: "0.72rem",
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              Synonyms: {node.synonyms.join("; ")}
            </Typography>
          )}
        </Box>
      </Stack>

      {hasChildren && isExpanded && (
        <Box
          role="group"
          data-outline-guide="node"
          sx={{
            position: "relative",
            "&::before": {
              position: "absolute",
              top: 0,
              bottom: 4,
              left: `${nodeIndentLevel * 14 + 15}px`,
              width: 0,
              borderLeft: "1px solid",
              borderColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(248, 248, 248, 0.18)"
                  : "rgba(26, 26, 26, 0.14)",
              content: '""',
              pointerEvents: "none",
            },
          }}
        >
          {mainChildren.map((child) =>
            renderChild(child, indentLevel + 1, `${nodeId}-main`),
          )}
          {collectionGroups.map((group) => {
            const collectionKey = getCollectionKey(
              nodeId,
              group.collectionName,
            );
            const isCollectionExpanded = expandedCollections.has(collectionKey);

            return (
              <Box
                key={collectionKey}
                role="treeitem"
                aria-label={`Collection: ${group.collectionName}`}
                aria-expanded={isCollectionExpanded}
                data-outline-kind="collection"
                data-outline-indent-level={collectionIndentLevel}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{
                    minHeight: 30,
                    ml: `${collectionIndentLevel * 14}px`,
                    mr: 0.5,
                    my: 0.35,
                    py: 0.25,
                    pl: 0.25,
                    pr: 1,
                    width: "fit-content",
                    maxWidth: "calc(100% - 8px)",
                    borderRadius: 1.25,
                    backgroundColor: (theme) =>
                      alpha(
                        reviewAccentColor(theme),
                        theme.palette.mode === "dark" ? 0.14 : 0.09,
                      ),
                    transition: "background-color 0.15s ease",
                    "&:hover": {
                      backgroundColor: (theme) =>
                        alpha(
                          reviewAccentColor(theme),
                          theme.palette.mode === "dark" ? 0.2 : 0.14,
                        ),
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label={`${
                      isCollectionExpanded ? "Collapse" : "Expand"
                    } collection ${group.collectionName}`}
                    onClick={() => onToggleCollection(collectionKey)}
                    sx={{
                      width: 24,
                      height: 24,
                      flex: "0 0 auto",
                      color: (theme) =>
                        OUTLINE_COLLECTION_COLORS[theme.palette.mode],
                    }}
                  >
                    {isCollectionExpanded ? (
                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                  <Typography
                    component="div"
                    data-outline-kind="collection-label"
                    sx={{
                      minWidth: 0,
                      pt: 0.35,
                      color: (theme) =>
                        OUTLINE_COLLECTION_COLORS[theme.palette.mode],
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      lineHeight: 1.3,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {group.collectionName}
                  </Typography>
                </Stack>
                {isCollectionExpanded && (
                  <Box
                    role="group"
                    data-outline-guide="collection"
                    sx={{
                      position: "relative",
                      "&::before": {
                        position: "absolute",
                        top: 0,
                        bottom: 4,
                        left: `${collectionIndentLevel * 14 + 12}px`,
                        width: 0,
                        borderLeft: "1px solid",
                        borderColor: (theme) =>
                          alpha(
                            reviewAccentColor(theme),
                            theme.palette.mode === "dark" ? 0.45 : 0.35,
                          ),
                        content: '""',
                        pointerEvents: "none",
                      },
                    }}
                  >
                    {group.entries.map((child) =>
                      renderChild(child, indentLevel + 2, collectionKey),
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

const OutlineColumn = ({
  heading,
  snapshot,
  showEvidence,
  tone,
  downloadName,
}: {
  heading: string;
  snapshot: SomOntologyOutlineSnapshot;
  showEvidence: boolean;
  tone: "original" | "selected";
  downloadName: string;
}) => {
  const nodesById = useMemo(
    () => new Map(snapshot.nodes.map((node) => [node.id, node])),
    [snapshot.nodes],
  );
  const childrenByParent = useMemo(() => {
    const result = new Map<string, OutlineChild[]>();
    for (const edge of snapshot.edges) {
      result.set(edge.parentId, [
        ...(result.get(edge.parentId) || []),
        {
          childId: edge.childId,
          collectionName: edge.collectionName,
        },
      ]);
    }
    return result;
  }, [snapshot.edges]);
  const expandableNodeIds = useMemo(
    () =>
      snapshot.nodes
        .filter((node) => {
          if (!showEvidence && node.evidence) return false;
          return (childrenByParent.get(node.id) || []).some((child) => {
            const childNode = nodesById.get(child.childId);
            return childNode && (showEvidence || !childNode.evidence);
          });
        })
        .map((node) => node.id),
    [childrenByParent, nodesById, showEvidence, snapshot.nodes],
  );
  const expandableCollectionKeys = useMemo(() => {
    const result = new Set<string>();
    for (const [parentNodeId, children] of childrenByParent.entries()) {
      for (const child of children) {
        const childNode = nodesById.get(child.childId);
        if (
          normalizeCollection(child.collectionName) !== "main" &&
          childNode &&
          (showEvidence || !childNode.evidence)
        ) {
          result.add(getCollectionKey(parentNodeId, child.collectionName));
        }
      }
    }
    return [...result];
  }, [childrenByParent, nodesById, showEvidence]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([snapshot.rootNodeId]),
  );
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    () => new Set(expandableCollectionKeys),
  );
  const previousRootNodeIdRef = useRef(snapshot.rootNodeId);
  const previousCollectionKeysRef = useRef(expandableCollectionKeys);

  // Full reset only when the outline snapshot itself changes — not when the
  // reviewer toggles O*NET evidence (that would wipe their open nodes).
  useEffect(() => {
    if (previousRootNodeIdRef.current === snapshot.rootNodeId) return;
    previousRootNodeIdRef.current = snapshot.rootNodeId;
    previousCollectionKeysRef.current = expandableCollectionKeys;
    setExpanded(new Set([snapshot.rootNodeId]));
    setExpandedCollections(new Set(expandableCollectionKeys));
  }, [expandableCollectionKeys, snapshot.rootNodeId]);

  // When evidence visibility changes, keep open nodes/collections; only prune
  // hidden ones and auto-expand collections that just became available.
  useEffect(() => {
    const previousKeys = new Set(previousCollectionKeysRef.current);
    previousCollectionKeysRef.current = expandableCollectionKeys;

    setExpanded((current) => {
      const next = new Set(
        [...current].filter((id) => {
          const node = nodesById.get(id);
          return Boolean(node && (showEvidence || !node.evidence));
        }),
      );
      if (
        next.size === current.size &&
        [...next].every((id) => current.has(id))
      ) {
        return current;
      }
      return next;
    });
    setExpandedCollections((current) => {
      const valid = new Set(expandableCollectionKeys);
      const next = new Set([...current].filter((key) => valid.has(key)));
      for (const key of valid) {
        if (!previousKeys.has(key)) next.add(key);
      }
      if (
        next.size === current.size &&
        [...next].every((key) => current.has(key))
      ) {
        return current;
      }
      return next;
    });
  }, [expandableCollectionKeys, nodesById, showEvidence]);

  const visibleNodeCount = snapshot.nodes.filter(
    (node) => showEvidence || !node.evidence,
  ).length;
  const allExpanded =
    expandableNodeIds.length > 0 &&
    expandableNodeIds.every((id) => expanded.has(id)) &&
    expandableCollectionKeys.every((key) => expandedCollections.has(key));

  return (
    <Box
      component="section"
      aria-label={`${heading} ontology outline`}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "background.paper",
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? "0 8px 24px rgba(0,0,0,0.28)"
            : "0 8px 24px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          borderLeft: 3,
          borderLeftColor: (theme) =>
            tone === "original"
              ? theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.28)"
                : "rgba(15, 23, 42, 0.28)"
              : reviewAccentColor(theme),
          px: 1.5,
          py: 1.35,
          background: (theme) =>
            theme.palette.mode === "dark"
              ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.04)} 0%, transparent 100%)`
              : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, transparent 100%)`,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} mb={0.35}>
            <Typography
              component="h3"
              sx={{ fontSize: "0.95rem", fontWeight: 800, letterSpacing: 0.01 }}
            >
              {heading}
            </Typography>
            <Chip
              size="small"
              label={`${visibleNodeCount} nodes`}
              sx={{
                height: 22,
                fontWeight: 700,
                fontSize: "0.7rem",
                color: "text.secondary",
                backgroundColor: (theme) =>
                  alpha(
                    theme.palette.text.primary,
                    theme.palette.mode === "dark" ? 0.1 : 0.06,
                  ),
              }}
            />
          </Stack>
          <Typography
            title={snapshot.ontologyName}
            sx={{
              color: "text.secondary",
              fontSize: "0.76rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {snapshot.ontologyName}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={`Download ${heading.toLowerCase()} outline`}>
            <IconButton
              size="small"
              aria-label={`Download ${heading.toLowerCase()} outline`}
              onClick={() => {
                const blob = new Blob(
                  [formatOutlineText(snapshot, showEvidence)],
                  { type: "text/plain;charset=utf-8" },
                );
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = downloadName;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DownloadOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={allExpanded ? "Collapse all" : "Expand all"}>
            <IconButton
              size="small"
              aria-label={`${allExpanded ? "Collapse" : "Expand"} all ${heading.toLowerCase()} nodes`}
              onClick={() => {
                if (allExpanded) {
                  setExpanded(new Set());
                  setExpandedCollections(new Set());
                } else {
                  setExpanded(new Set(expandableNodeIds));
                  setExpandedCollections(new Set(expandableCollectionKeys));
                }
              }}
              sx={{
                borderRadius: 1.25,
                backgroundColor: (theme) =>
                  alpha(
                    theme.palette.text.primary,
                    theme.palette.mode === "dark" ? 0.06 : 0.04,
                  ),
                "&:hover": {
                  color: reviewAccentColor,
                  backgroundColor: (theme) =>
                    alpha(
                      reviewAccentColor(theme),
                      theme.palette.mode === "dark" ? 0.16 : 0.1,
                    ),
                },
              }}
            >
              {allExpanded ? (
                <UnfoldLessIcon fontSize="small" />
              ) : (
                <UnfoldMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Box
        role="tree"
        aria-label={`${heading} ${snapshot.rootTitle} hierarchy`}
        sx={treeScrollbarSx}
      >
        <OutlineNode
          nodeId={snapshot.rootNodeId}
          nodesById={nodesById}
          childrenByParent={childrenByParent}
          expanded={expanded}
          expandedCollections={expandedCollections}
          showEvidence={showEvidence}
          ancestors={new Set()}
          onToggle={(nodeId) =>
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(nodeId)) next.delete(nodeId);
              else next.add(nodeId);
              return next;
            })
          }
          onToggleCollection={(collectionKey) =>
            setExpandedCollections((current) => {
              const next = new Set(current);
              if (next.has(collectionKey)) next.delete(collectionKey);
              else next.add(collectionKey);
              return next;
            })
          }
          indentLevel={0}
        />
      </Box>
    </Box>
  );
};

const OntologyComparisonPanel = ({
  datasetId,
  branch,
  roundLabel,
  currentRound,
  initiallyExpanded = false,
}: {
  datasetId: string;
  branch: string;
  roundLabel: string;
  currentRound: boolean;
  initiallyExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [outline, setOutline] = useState<SomOntologyOutlineResponse | null>(
    null,
  );
  const [showEvidence, setShowEvidence] = useState(false);

  const loadOutline = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await Post<SomOntologyOutlineResponse>(
        "/som-review/outline",
        { datasetId },
        false,
      );
      setOutline(result);
    } catch {
      setLoadError("The ontology outlines could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    if (expanded && !outline && !loading && !loadError) loadOutline();
  }, [expanded, loadError, loadOutline, loading, outline]);

  return (
    <Accordion
      expanded={expanded}
      disableGutters
      elevation={0}
      onChange={(_, nextExpanded) => {
        setExpanded(nextExpanded);
      }}
      sx={{
        mt: 4,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        backgroundImage: "none",
        backgroundColor: "background.paper",
        "&::before": { display: "none" },
        "&.Mui-expanded": {
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? `0 0 0 1px ${alpha(reviewAccentColor(theme), 0.28)}`
              : `0 0 0 1px ${alpha(reviewAccentColor(theme), 0.2)}`,
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="ontology-comparison-content"
        id="ontology-comparison-header"
        sx={{
          px: { xs: 1.25, sm: 2 },
          minHeight: 72,
          "& .MuiAccordionSummary-content": { minWidth: 0, my: 1.25 },
          "&:hover": {
            backgroundColor: (theme) =>
              alpha(
                reviewAccentColor(theme),
                theme.palette.mode === "dark" ? 0.06 : 0.04,
              ),
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 1.5,
              flex: "0 0 auto",
              color: reviewAccentColor,
              backgroundColor: (theme) =>
                alpha(
                  reviewAccentColor(theme),
                  theme.palette.mode === "dark" ? 0.16 : 0.1,
                ),
            }}
          >
            <AccountTreeOutlinedIcon fontSize="small" />
          </Box>
          <Box minWidth={0}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.02rem" }}>
              Compare {branch} hierarchy
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.85rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {roundLabel} alongside the original sub-ontology
            </Typography>
          </Box>
        </Stack>
      </AccordionSummary>
      <AccordionDetails
        id="ontology-comparison-content"
        sx={{ px: { xs: 1.25, sm: 2 }, pt: 0, pb: 2.25 }}
      >
        {loading && (
          <Stack alignItems="center" spacing={1.25} sx={{ py: 6 }}>
            <CircularProgress
              size={32}
              aria-label="Loading ontology outlines"
            />
            <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
              Loading outlines…
            </Typography>
          </Stack>
        )}
        {!loading && loadError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={loadOutline}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}
        {!loading && outline && (
          <Stack spacing={1.75}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              spacing={1}
              sx={{
                px: 1.25,
                py: 1,
                borderRadius: 1.5,
                border: 1,
                borderColor: "divider",
                backgroundColor: (theme) =>
                  alpha(
                    theme.palette.text.primary,
                    theme.palette.mode === "dark" ? 0.04 : 0.02,
                  ),
              }}
            >
              <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
                Collection labels and recorded synonyms are preserved.
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Tooltip title="Chevrons expand descendants. A vertical guide line connects each expanded node or collection to its children. Main-collection children appear directly under their parent.">
                  <IconButton
                    size="small"
                    aria-label="Explain hierarchy controls"
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={showEvidence}
                      onChange={(event) =>
                        setShowEvidence(event.target.checked)
                      }
                      sx={{
                        color: "text.secondary",
                        "&.Mui-checked": { color: reviewAccentColor },
                      }}
                    />
                  }
                  label="Include O*NET evidence"
                  sx={{
                    mr: 0,
                    ml: { xs: 0, sm: 1 },
                    px: 0.75,
                    py: 0.15,
                    borderRadius: 1.25,
                    backgroundColor: (theme) =>
                      showEvidence
                        ? alpha(
                            reviewAccentColor(theme),
                            theme.palette.mode === "dark" ? 0.14 : 0.08,
                          )
                        : "transparent",
                    "& .MuiFormControlLabel-label": {
                      fontSize: "0.86rem",
                      fontWeight: showEvidence ? 700 : 500,
                    },
                  }}
                />
              </Stack>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "1fr 1fr" },
                gap: 1.75,
                alignItems: "start",
              }}
            >
              <OutlineColumn
                heading="Original"
                snapshot={outline.original}
                showEvidence={showEvidence}
                tone="original"
                downloadName={`${branch.toLowerCase()}-original-outline.txt`}
              />
              <OutlineColumn
                heading={currentRound ? "Current" : "Selected round"}
                snapshot={outline.selected}
                showEvidence={showEvidence}
                tone="selected"
                downloadName={`${branch.toLowerCase()}-${datasetId}-outline.txt`}
              />
            </Box>
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default OntologyComparisonPanel;
