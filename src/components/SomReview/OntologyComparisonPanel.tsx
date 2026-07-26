import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";

import { Post } from "../../lib/utils/Post";
import {
  SomOntologyOutlineResponse,
  SomOntologyOutlineSnapshot,
} from "../../types/ISomReview";

interface OutlineChild {
  childId: string;
  collectionName: string;
}

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
          py: 0.25,
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.title}`}
            onClick={() => onToggle(nodeId)}
            sx={{ width: 30, height: 30, flex: "0 0 auto" }}
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
        <Typography
          sx={{
            minWidth: 0,
            pt: 0.45,
            fontSize: "0.9rem",
            fontWeight: indentLevel === 0 ? 800 : 600,
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {node.title}
        </Typography>
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
                  ? "rgba(248, 248, 248, 0.24)"
                  : "rgba(26, 26, 26, 0.2)",
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
                  alignItems="flex-start"
                  spacing={0.5}
                  sx={{
                    minHeight: 30,
                    pl: `${collectionIndentLevel * 14}px`,
                    py: 0.2,
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
                        theme.palette.mode === "dark" ? "#FFB15C" : "#9C3D00",
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
                        theme.palette.mode === "dark" ? "#FFB15C" : "#9C3D00",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      lineHeight: 1.3,
                      textTransform: "uppercase",
                      letterSpacing: 0,
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
                          theme.palette.mode === "dark"
                            ? "rgba(255, 177, 92, 0.5)"
                            : "rgba(156, 61, 0, 0.42)",
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
}: {
  heading: string;
  snapshot: SomOntologyOutlineSnapshot;
  showEvidence: boolean;
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

  useEffect(() => {
    setExpanded(new Set([snapshot.rootNodeId]));
    setExpandedCollections(new Set(expandableCollectionKeys));
  }, [expandableCollectionKeys, snapshot.rootNodeId, showEvidence]);

  const visibleNodeCount = snapshot.nodes.filter(
    (node) => showEvidence || !node.evidence,
  ).length;

  return (
    <Box
      component="section"
      aria-label={`${heading} ontology outline`}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        backgroundColor: "background.paper",
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
          px: 1.5,
          py: 1.25,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h3"
            sx={{ fontSize: "0.95rem", fontWeight: 800 }}
          >
            {heading}
          </Typography>
          <Typography
            title={snapshot.ontologyName}
            sx={{
              mt: 0.15,
              color: "text.secondary",
              fontSize: "0.78rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {visibleNodeCount} nodes · {snapshot.ontologyName}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Expand all">
            <IconButton
              size="small"
              aria-label={`Expand all ${heading.toLowerCase()} nodes`}
              onClick={() => {
                setExpanded(new Set(expandableNodeIds));
                setExpandedCollections(new Set(expandableCollectionKeys));
              }}
            >
              <UnfoldMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Collapse all">
            <IconButton
              size="small"
              aria-label={`Collapse all ${heading.toLowerCase()} nodes`}
              onClick={() => {
                setExpanded(new Set());
                setExpandedCollections(new Set());
              }}
            >
              <UnfoldLessIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Box
        role="tree"
        aria-label={`${heading} ${snapshot.rootTitle} hierarchy`}
        sx={{
          maxHeight: { xs: 420, md: 560 },
          overflow: "auto",
          px: 1,
          py: 1,
        }}
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
}: {
  datasetId: string;
  branch: string;
  roundLabel: string;
  currentRound: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [outline, setOutline] = useState<SomOntologyOutlineResponse | null>(
    null,
  );
  const [showEvidence, setShowEvidence] = useState(false);

  const loadOutline = async () => {
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
  };

  return (
    <Accordion
      expanded={expanded}
      disableGutters
      elevation={0}
      onChange={(_, nextExpanded) => {
        setExpanded(nextExpanded);
        if (nextExpanded && !outline && !loading) loadOutline();
      }}
      sx={{
        mt: 4,
        borderTop: 1,
        borderBottom: 1,
        borderColor: "divider",
        backgroundImage: "none",
        "&::before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="ontology-comparison-content"
        id="ontology-comparison-header"
        sx={{
          px: { xs: 1, sm: 1.5 },
          minHeight: 64,
          "& .MuiAccordionSummary-content": { minWidth: 0 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} minWidth={0}>
          <AccountTreeOutlinedIcon color="primary" />
          <Box minWidth={0}>
            <Typography sx={{ fontWeight: 800 }}>
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
        sx={{ px: { xs: 1, sm: 1.5 }, pt: 0, pb: 2 }}
      >
        {loading && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress
              size={32}
              aria-label="Loading ontology outlines"
            />
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
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={0.75}
            >
              <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
                Expand either outline independently. Collection labels are
                preserved.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={showEvidence}
                    onChange={(event) => setShowEvidence(event.target.checked)}
                  />
                }
                label="Include O*NET evidence"
                sx={{ mr: 0 }}
              />
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "1fr 1fr" },
                gap: 1.5,
                alignItems: "start",
              }}
            >
              <OutlineColumn
                heading="Original"
                snapshot={outline.original}
                showEvidence={showEvidence}
              />
              <OutlineColumn
                heading={currentRound ? "Current" : "Selected round"}
                snapshot={outline.selected}
                showEvidence={showEvidence}
              />
            </Box>
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default OntologyComparisonPanel;
