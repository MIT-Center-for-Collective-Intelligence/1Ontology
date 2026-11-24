import React, { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  ListItem,
  ListItemIcon,
  Tooltip,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { IAlgorithm, INode } from "@components/types/INode";
import { AlgorithmProposal } from "@components/types/IProposal";
import FlowTrack from "./FlowTrack";
import { SearchBox } from "../SearchBox/SearchBox";
import ExpandSearchResult from "../OntologyComponents/ExpandSearchResult";

/**
 * The generalizations of one activity rejected as "does not belong here",
 * in one box styled as on the node page: the property band, the linked rows
 * with Unlink, the search with its Link hits, and the search text as a new
 * node. All of it is recorded on the proposal; the hierarchy is not changed.
 */
export type Under = {
  id: string;
  title: string;
  /** A node that does not exist yet; created when the review is applied. */
  isNew?: boolean;
  /** Where a new node goes, when chosen. */
  parent?: { id: string; title: string } | null;
};

/** The generalizations the reviewer left it under; null until they acted. */
export const underOf = (p?: AlgorithmProposal | null): Under[] | null => {
  const d = p?.decision;
  if (!d) return null;
  if (Array.isArray(d.under)) return d.under;
  return d.movedTo ? [d.movedTo] : null;
};

type Props = {
  proposal: AlgorithmProposal;
  /** The activity's name, heading the panel. */
  title: string;
  /** Its flow, shown on request */
  algorithm: IAlgorithm | null;
  /** Whether the flow is shown: one switch for every activity of the step. */
  showFlow: boolean;
  onShowFlow: (show: boolean) => void;
  /** True shows the activity's parts in place of its flow. */
  parts?: boolean;
  /** The generalization it sits in now */
  current: { id: string; title: string };
  dark: boolean;
  titleOf: (id: string) => string;
  searchWithFuse: (query: string, nodeType?: any) => INode[];
  onPlace: (p: AlgorithmProposal, under: Under[]) => void;
  navigateToNode: (id: string) => void;
};

const PlacePanel = ({
  proposal,
  title,
  algorithm,
  showFlow,
  onShowFlow,
  parts,
  current,
  dark,
  titleOf,
  searchWithFuse,
  onPlace,
  navigateToNode,
}: Props) => {
  const c = {
    // the step 1 table's surface and lines
    card: dark ? "#1b1b1c" : "#fff",
    grid: dark ? "#2c2d2f" : "#e8eaed",
    newText: dark ? "#ffa94d" : "#c25100",
    // the node page's property band
    propBand: dark ? "#242425" : "#d0d5dd",
    muted: dark ? "#7c7c78" : "#6b6b68",
  };
  const line = `1px solid ${c.grid}`;

  // Until the reviewer acts, it is under its current generalization.
  const under = underOf(proposal) ?? [{ id: current.id, title: current.title }];
  const has = (id: string) => under.some((u) => u.id === id);
  const linked = new Set(under.map((u) => u.id));
  const add = (u: Under) => onPlace(proposal, [...under, u]);
  const remove = (id: string) =>
    onPlace(
      proposal,
      under.filter((u) => u.id !== id),
    );

  // The search, live as on the node page, over the hits' titles.
  const [query, setQuery] = useState("");
  const hits = query.trim()
    ? searchWithFuse(query.trim(), "activity")
        .filter((n) => n.id !== proposal.nodeId)
        .slice(0, 10)
    : [];
  // Titles for the hits and their listed specializations.
  const titles: { [id: string]: { title: string } } = {};
  for (const n of hits) {
    titles[n.id] = { title: n.title };
    for (const s of n.specializations?.flatMap((col) => col.nodes) ?? [])
      titles[s.id] = { title: s.title || titleOf(s.id) };
  }
  const toggle = (id: string) => {
    if (has(id)) remove(id);
    else add({ id, title: titles[id]?.title || titleOf(id) });
  };
  // The typed text becomes a new node, unless it names an existing one.
  const exact = hits[0]?.title.trim() === query.trim();
  const create = () => {
    add({ id: `new:${Date.now()}`, title: query.trim(), isNew: true });
    setQuery("");
  };
  // The plus of a hit, as on the node page: a new node under that hit.
  const createUnder = (id: string) => {
    const parent = { id, title: titles[id]?.title || titleOf(id) };
    add({
      id: `new:${Date.now()}`,
      title: `New ${parent.title}`,
      isNew: true,
      parent,
    });
  };

  return (
    <Box id={`place-${proposal.nodeId}`} sx={{ p: "16px", minWidth: 0 }}>
      {/* Which activity this is, with its flow and its node one click away */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          mb: "12px",
        }}
      >
        <Typography
          component="h3"
          sx={{
            flex: 1,
            minWidth: 0,
            m: 0,
            fontSize: 18,
            fontWeight: 600,
            lineHeight: "26px",
            py: "4px",
          }}
        >
          {title}
        </Typography>
        <Tooltip title="Open in new tab">
          <IconButton
            size="small"
            aria-label="Open in new tab"
            sx={{ p: "6px" }}
            onClick={() => navigateToNode(proposal.nodeId)}
          >
            <OpenInNewIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {/* Its flow, in a card of the same make as the one below; the header
          row opens and closes it */}
      <Box
        sx={{
          mb: "12px",
          border: line,
          borderRadius: "12px",
          overflow: "hidden",
          bgcolor: c.card,
        }}
      >
        <ButtonBase
          aria-expanded={showFlow}
          onClick={() => onShowFlow(!showFlow)}
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: "10px",
            width: "100%",
            boxSizing: "border-box",
            bgcolor: c.propBand,
            px: "20px",
            py: "8px",
            fontFamily: "inherit",
            textAlign: "left",
            "&:hover .flow-toggle": {
              bgcolor: "action.hover",
              color: "text.primary",
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: "-2px",
            },
          }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 15, fontWeight: 600, color: "text.primary" }}
          >
            {parts ? "Parts" : "Flow"}
          </Typography>
          <Box
            component="span"
            className="flow-toggle"
            sx={{
              ml: "auto",
              px: "8px",
              py: "2px",
              borderRadius: "6px",
              fontSize: 13,
              color: c.muted,
            }}
          >
            {showFlow ? "Collapse ▴" : "Expand ▾"}
          </Box>
        </ButtonBase>
        {showFlow && (
          <Box sx={{ px: "16px", py: "12px", overflowX: "auto" }}>
            {algorithm ? (
              <FlowTrack
                algorithm={algorithm}
                dark={dark}
                titleOf={titleOf}
                parts={parts}
              />
            ) : (
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                No proposal
              </Typography>
            )}
          </Box>
        )}
      </Box>
      {/* One box, as on the node page: the band, the linked rows, the search */}
      <Box
        sx={{
          border: line,
          borderRadius: "12px",
          overflow: "hidden",
          bgcolor: c.card,
        }}
      >
        <Box sx={{ bgcolor: c.propBand, px: "20px", py: "8px" }}>
          <Typography
            sx={{ fontSize: 15, fontWeight: 600, color: "text.primary" }}
          >
            Generalizations
          </Typography>
        </Box>
        <Box sx={{ px: "12px", py: "4px" }}>
          {under.map((u) => (
            <ListItem
              key={u.id}
              component="div"
              sx={{
                my: "4px",
                py: "2px",
                px: "8px",
                display: "flex",
                borderRadius: "25px",
                ":hover": { bgcolor: dark ? "#5f5e5d" : "#d9dfe6" },
              }}
            >
              <ListItemIcon sx={{ minWidth: "auto", mr: "8px" }}>
                <DragIndicatorIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <Typography
                sx={{
                  fontSize: 14,
                  cursor: u.isNew ? "default" : "pointer",
                  "&:hover": { color: u.isNew ? undefined : "primary.main" },
                }}
                noWrap
                title={u.title}
                onClick={() => !u.isNew && navigateToNode(u.id)}
              >
                {u.title}
              </Typography>
              {u.isNew && (
                <Typography
                  sx={{ ml: "8px", fontSize: 12, color: c.newText }}
                  noWrap
                >
                  {u.parent ? `new · under ${u.parent.title}` : "new"}
                </Typography>
              )}
              <Tooltip title="Unlink">
                <IconButton
                  sx={{ ml: "auto", borderRadius: "18px", p: "2px" }}
                  onClick={() => remove(u.id)}
                >
                  <LinkOffIcon sx={{ fontSize: 20, color: "orange" }} />
                </IconButton>
              </Tooltip>
            </ListItem>
          ))}
          {under.length === 0 && (
            <Typography
              sx={{
                px: "8px",
                py: "8px",
                fontSize: 14,
                color: "text.secondary",
              }}
            >
              Under nothing yet
            </Typography>
          )}
        </Box>
        {/* The node page's search, the new-node button, and the hits */}
        <Box sx={{ borderTop: line, px: "4px", py: "4px" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <SearchBox
                setSearch={setQuery}
                search={query}
                label="Search existing activities..."
                sx={{
                  "& .MuiOutlinedInput-root input": { fontSize: 14 },
                  "& .MuiSvgIcon-root": { fontSize: 20 },
                }}
              />
            </Box>
            <Tooltip title="Create what you searched as a new generalization">
              <Box component="span" sx={{ mr: "12px", flexShrink: 0 }}>
                <Button
                  onClick={create}
                  disabled={query.trim().length < 3 || exact}
                  sx={{
                    borderRadius: "30px",
                    px: "20px",
                    height: "40px",
                    fontSize: 13,
                    textTransform: "none",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    color: "#fff",
                    bgcolor: "primary.main",
                    "&:hover": { bgcolor: "primary.dark" },
                    "&.Mui-disabled": {
                      color: "text.disabled",
                      bgcolor: "action.disabledBackground",
                    },
                  }}
                >
                  Create new generalization
                </Button>
              </Box>
            </Tooltip>
          </Box>
          {query.trim() && (
            <Box
              sx={{
                mx: "12px",
                mb: "8px",
                borderRadius: "10px",
                background: dark
                  ? "linear-gradient(180deg, #0f0f0f 0%, #1f1f1f 100%)"
                  : "linear-gradient(180deg, #ffffff 0%, #f3f6ff 100%)",
                borderTop: `1px solid ${dark ? "#2d2d2d" : "#e9ecef"}`,
                borderBottom: `1px solid ${dark ? "#2d2d2d" : "#e9ecef"}`,
              }}
            >
              <Box
                sx={{
                  maxHeight: 400,
                  overflowY: "auto",
                  py: "6px",
                  px: "6px",
                  "& .MuiTypography-root": { fontSize: 14 },
                  "& .MuiSvgIcon-root": { fontSize: 20 },
                }}
              >
                <ExpandSearchResult
                  searchResultsForSelection={hits}
                  markItemAsChecked={toggle}
                  // shows the plus; the node is recorded, not created
                  handleCloning={createUnder}
                  checkedItems={linked}
                  user={undefined}
                  nodes={titles}
                  cloning={null}
                  disabledAddButton={false}
                  getNumOfGeneralizations={() => false}
                  selectedProperty="generalizations"
                  addACloneNodeQueue={createUnder}
                  currentVisibleNode={{ id: proposal.nodeId }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PlacePanel;
