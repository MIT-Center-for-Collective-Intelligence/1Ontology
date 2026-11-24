import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { INode } from "@components/types/INode";
import { ProposalStep } from "@components/types/IProposal";
import { OPTIONAL_PART_SYMBOL } from "@components/lib/CONSTANTS";
import { SearchBox } from "../SearchBox/SearchBox";

/**
 * A proposal's parts as a plain list, as the node page lists them: drag to
 * reorder, mark optional, remove, and a search to add an activity as a
 * part. Nothing is written to the ontology; the parts go back on the
 * proposal when they are saved.
 */
type Part = { id: string; title: string; optional: boolean };

type Props = {
  nodeId: string;
  /** The proposal's parts as decided so far. */
  steps: ProposalStep[];
  titleOf: (id: string) => string;
  searchWithFuse: (query: string, nodeType?: any) => INode[];
  onSave: (steps: ProposalStep[], changed: boolean) => void;
  onClose: () => void;
};

const MAX_HITS = 12;

const PartsEditor = ({
  nodeId,
  steps,
  titleOf,
  searchWithFuse,
  onSave,
  onClose,
}: Props) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = {
    line: dark ? "#3a3a40" : "#d0d5dd",
    row: dark ? "#1f1f22" : "#fff",
    rowHover: dark ? "#27272b" : "#f6f7f9",
    handle: dark ? "#8a8a90" : "#9aa0a6",
    optional: "#ff9500",
  };
  const [parts, setParts] = useState<Part[]>(() =>
    steps.map((s) => ({
      id: s.id,
      title: s.title,
      optional: s.role === "optional",
    })),
  );
  const [query, setQuery] = useState("");
  const has = (id: string) => parts.some((p) => p.id === id);
  const add = (id: string, title: string) => {
    if (!has(id)) setParts((ps) => [...ps, { id, title, optional: false }]);
    setQuery("");
  };
  const hits = query.trim()
    ? searchWithFuse(query.trim(), "activity")
        .filter((n) => n.id !== nodeId && !has(n.id))
        .slice(0, MAX_HITS)
    : [];

  // The parts as steps: a kept step keeps its wording and role, a new one
  // is named after its activity.
  const out: ProposalStep[] = parts.map((p) => {
    const was = steps.find((s) => s.id === p.id);
    const role = p.optional
      ? "optional"
      : was?.role === "optional"
        ? undefined
        : was?.role;
    return {
      id: p.id,
      title: was?.title || p.title || titleOf(p.id),
      ...(role ? { role } : {}),
    };
  });
  const changed =
    out.length !== steps.length ||
    out.some(
      (s, i) =>
        s.id !== steps[i].id ||
        (s.role === "optional") !== (steps[i].role === "optional"),
    );

  const row = (p: Part, i: number) => (
    <Draggable key={p.id} draggableId={p.id} index={i}>
      {(d, snap) => (
        <Box
          component="li"
          ref={d.innerRef}
          {...d.draggableProps}
          data-part={p.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            px: "10px",
            py: "6px",
            border: `1px solid ${c.line}`,
            borderRadius: "8px",
            bgcolor: snap.isDragging ? c.rowHover : c.row,
            "&:hover": { bgcolor: c.rowHover },
          }}
        >
          <Box
            component="span"
            {...d.dragHandleProps}
            aria-label={`Drag ${p.title}`}
            sx={{
              display: "inline-flex",
              color: c.handle,
              cursor: "grab",
              flexShrink: 0,
            }}
          >
            <DragHandleIcon fontSize="small" />
          </Box>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14 }}>
            {p.title}
          </Typography>
          {/* The optional mark, as on the node page: lit when the part is */}
          <Tooltip
            title={p.optional ? "Optional part" : "Mark as optional"}
            placement="top"
          >
            <Box
              component="button"
              type="button"
              aria-pressed={p.optional}
              aria-label={
                p.optional
                  ? `Make ${p.title} required`
                  : `Mark ${p.title} optional`
              }
              onClick={() =>
                setParts((ps) =>
                  ps.map((x) =>
                    x.id === p.id ? { ...x, optional: !x.optional } : x,
                  ),
                )
              }
              sx={{
                width: 22,
                height: 22,
                p: 0,
                borderRadius: "6px",
                border: `1px solid ${p.optional ? c.optional : c.line}`,
                bgcolor: "transparent",
                color: p.optional ? c.optional : c.handle,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {OPTIONAL_PART_SYMBOL}
            </Box>
          </Tooltip>
          <IconButton
            size="small"
            aria-label={`Remove ${p.title}`}
            onClick={() => setParts((ps) => ps.filter((x) => x.id !== p.id))}
            sx={{ p: "2px", color: c.handle }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}
    </Draggable>
  );

  return (
    <Box data-testid="parts-editor" sx={{ pt: 1 }}>
      <DragDropContext
        onDragEnd={(r) => {
          if (!r.destination) return;
          const to = r.destination.index;
          setParts((ps) => {
            const next = [...ps];
            const [moved] = next.splice(r.source.index, 1);
            next.splice(to, 0, moved);
            return next;
          });
        }}
      >
        <Droppable droppableId="parts">
          {(dp) => (
            <Box
              component="ul"
              aria-label="Parts"
              ref={dp.innerRef}
              {...dp.droppableProps}
              sx={{
                listStyle: "none",
                m: 0,
                p: 0,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {parts.map(row)}
              {dp.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
      {parts.length === 0 && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1 }}>
          No parts
        </Typography>
      )}
      {/* An activity to add as a part, found as on the node page */}
      <Box sx={{ mt: 1 }}>
        <SearchBox
          setSearch={setQuery}
          search={query}
          label="Search activities to add as parts..."
          sx={{
            "& .MuiOutlinedInput-root input": { fontSize: 14 },
            "& .MuiSvgIcon-root": { fontSize: 20 },
          }}
        />
        {hits.length > 0 && (
          <Box
            component="ul"
            aria-label="Activities found"
            sx={{
              listStyle: "none",
              m: 0,
              p: 0,
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {hits.map((n) => (
              <Box
                component="li"
                key={n.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                  {n.title}
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ textTransform: "none", flexShrink: 0 }}
                  onClick={() => add(n.id, n.title)}
                >
                  Add part
                </Button>
              </Box>
            ))}
          </Box>
        )}
        {query.trim() && hits.length === 0 && (
          <Typography
            sx={{ px: 1, py: 0.5, fontSize: 13, color: "text.secondary" }}
          >
            No activity found
          </Typography>
        )}
      </Box>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          color="success"
          size="small"
          disableElevation
          sx={{ borderRadius: "6px", px: 2, textTransform: "none" }}
          onClick={() => onSave(out, changed)}
        >
          Save and accept
        </Button>
        <Button
          size="small"
          color="inherit"
          sx={{ textTransform: "none" }}
          onClick={onClose}
        >
          Close
        </Button>
      </Stack>
    </Box>
  );
};

export default PartsEditor;
