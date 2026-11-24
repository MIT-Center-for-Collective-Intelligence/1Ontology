import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  MenuItem,
  ListItemText,
  ListItemIcon,
  ListItem,
  List,
  Link,
  Button,
  TextField,
  useTheme,
  alpha,
  Popover,
  InputBase,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import InheritedPartsLegend, {
  getDefaultInheritedPartsLegendItems,
} from "../Common/InheritedPartsLegend";
import {
  ILinkNode,
  INode,
  InheritedPartsDetail,
} from "@components/types/INode";
import SyncedSpinner from "@components/components/SyncedSpinner";
import {
  computeOrderRuns,
  getPartGeneralizationSources,
  orderBracketsAt,
} from "@components/lib/utils/partsHelper";
import {
  ORDER_RUN_ROW_INSET_PX,
  orderRunBracketSx,
  orderRunBracketWrapperSx,
  orderRunRowSx,
} from "@components/lib/utils/partsOrderStyles";
import { makeResolvedOf } from "@components/lib/hooks/useResolvedParts";
import { OPTIONAL_PART_SYMBOL } from "@components/lib/CONSTANTS";

const SYMBOL_COL_SX = {
  minWidth: 28,
  width: 28,
  justifyContent: "center",
  display: "flex",
  alignItems: "center",
} as const;

/** A part as the preview lists it. */
export type PreviewPart = {
  id: string;
  title: string;
  optional?: boolean;
  /** Not a node yet; "new" is said beside it, with its parent when picked. */
  isNew?: boolean;
  parent?: { id: string; title: string } | null;
};
/** One row of the preview: the generalized parts on the left, the
 * specialization's on the right, the symbol between. Several on a side when
 * parts merge or split. */
export type PreviewRow = {
  from: PreviewPart[];
  to: PreviewPart[];
  symbol: "=" | ">" | "x" | "+";
};
/** The view the other way round, with unsaved data: a proposed
 * generalization is the focused node on the left, raised, its parts
 * draggable; one of its specializations is on the right, with a picker to
 * step through them. */
export type InheritancePreview = {
  /** The generalization's name. */
  title: string;
  rows: PreviewRow[];
  /** The specialization shown, and the others to step or search to. */
  pick: {
    options: { id: string; title: string }[];
    value: string;
    onChange: (id: string) => void;
  };
  /** The generalized parts in their new order after a drag. */
  onReorder?: (ids: string[]) => void;
  /** Editing: each generalized part gets the node page's remove button. */
  onRemove?: (id: string) => void;
};
const PREVIEW_TIP: { [symbol: string]: string } = {
  "=": "The same part",
  ">": "A specialized version of the generalized part",
  "+": "A part of its own; the generalization does not have it",
  x: "A generalized part it does not inherit",
};

const formatPartTitle = (
  title: string,
  isOptional: boolean,
  optionalChange?: "added" | "removed" | "none",
) => {
  if (optionalChange === "added") {
    return (
      <Box component="span" sx={{ display: "inline" }}>
        {title}{" "}
        <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
          {`+${OPTIONAL_PART_SYMBOL}`}
        </Box>
      </Box>
    );
  } else if (optionalChange === "removed") {
    return (
      <Box component="span" sx={{ display: "inline" }}>
        {title}{" "}
        <Box
          component="span"
          sx={{
            textDecoration: "line-through",
            color: "#ff9500",
            fontWeight: "bold",
          }}
        >
          {OPTIONAL_PART_SYMBOL}
        </Box>
      </Box>
    );
  } else if (isOptional) {
    return (
      <Box component="span" sx={{ display: "inline" }}>
        {title}{" "}
        <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
          {OPTIONAL_PART_SYMBOL}
        </Box>
      </Box>
    );
  }

  return title;
};

/** The symbol between a generalization's part and the node's, in orange. */
const SymbolIcon = ({ symbol }: { symbol: string }) =>
  symbol === "x" ? (
    <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
  ) : symbol === ">" ? (
    <ArrowForwardIosIcon
      sx={{ fontSize: 20, color: "orange", p: 0.2, borderRadius: "50%" }}
    />
  ) : symbol === "=" ? (
    <DragHandleIcon sx={{ fontSize: 20, color: "orange" }} />
  ) : symbol === "+" ? (
    <AddIcon sx={{ fontSize: 20, color: "orange" }} />
  ) : null;

/** A part row of the view, dimmed and italic when the node lacks the part. */
const partRowSx = (isDarkMode: boolean, isMissing: boolean) =>
  ({
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    pr: 0,
    minHeight: 0,
    boxSizing: "border-box",
    position: "relative",
    pl: `${ORDER_RUN_ROW_INSET_PX}px`,
    py: "4px",
    // Missing parts (gen has it, node doesn't) — de-emphasised
    ...(isMissing && {
      opacity: 0.5,
      fontStyle: "italic",
    }),
    borderRadius: "50px",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    "&:hover": {
      backgroundColor: isDarkMode
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)",
      boxShadow: isDarkMode
        ? "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
        : "0 4px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",
    },
    "&:hover .part-remove-button, &:focus-within .part-remove-button": {
      opacity: 1,
      pointerEvents: "auto",
    },
    // Restore full opacity on hover so the add-button is easy to click
    ...(isMissing && {
      "&:hover": {
        opacity: 0.8,
        backgroundColor: isDarkMode
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.04)",
        boxShadow: isDarkMode
          ? "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "0 4px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",
      },
    }),
  }) as const;

const LIST_SX = {
  borderRadius: "16px",
  position: "relative",
  zIndex: 1,
  backgroundColor: "transparent",
  pt: 1,
  pb: 3.5,
  pl: 0.5,
  pr: 1.5,
  mt: 0.5,
  mb: 1,
} as const;

/** Both sides empty: neither the generalization nor the node has parts. */
const noPartsRow = (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "calc(50% - 35px) 70px calc(50% - 35px)",
      alignItems: "center",
      position: "relative",
      zIndex: 1,
      py: 2.5,
    }}
  >
    {["generalization", "node"].map((side) => (
      <Typography
        key={side}
        sx={{
          gridColumn: side === "generalization" ? 1 : 3,
          px: 2,
          textAlign: "center",
          color: "text.secondary",
          fontStyle: "italic",
          fontSize: "0.95rem",
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        No parts available
      </Typography>
    ))}
  </Box>
);

const PREVIEW_COLS = "minmax(0, 1fr) 48px minmax(0, 1fr)";
const MENU_ROW = 36;
/** The legend cut to the symbols the preview uses. */
const PREVIEW_LEGEND = new Set(["=", ">", "x", "+"]);

/** The preview: the generalization's parts, raised and draggable, against
 * the picked specialization's, flat; the symbols between them. One grid, so
 * the parts line up: title strips, then the PARTS headings, then a row per
 * part. A merged generalized part spans the rows of the parts that
 * specialize it; a split specialization part spans the rows of the parts it
 * specializes. */
const PreviewView = ({
  preview,
  dark,
}: {
  preview: InheritancePreview;
  dark: boolean;
}) => {
  const c = {
    raised: dark ? "#2a2a2e" : "#fff",
    raisedLine: dark ? "#45454b" : "#d0d5dd",
    raisedStrip: dark ? "#38383e" : "#eef0f3",
    raisedStripLine: dark ? "#4a4a50" : "#d0d5dd",
    flatLine: dark ? "#2e2e33" : "#e3e5e8",
    flatStrip: dark ? "#232326" : "#f6f7f9",
    name: dark ? "#f0f0f2" : "#1f1f23",
    other: dark ? "#a9a9ae" : "#57575c",
    missing: dark ? "#5e5e64" : "#9a9aa0",
    heading: "#8a8a90",
    headingRight: "#6e6e74",
    arrow: "#6e6e74",
    icon: "#a9a9ae",
    grip: "#8a8a90",
    pill: dark ? "#2c2c31" : "#f3f4f6",
    pillLine: dark ? "#3e3e45" : "#d0d5dd",
    pillText: dark ? "#e6e6e3" : "#24292f",
    menu: dark ? "#2a2a2f" : "#fff",
    current: dark ? "#3a3a40" : "#e9ebee",
    newText: dark ? "#ffa94d" : "#c25100",
  };
  const { options, value, onChange } = preview.pick;
  const at = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const step = (d: number) =>
    options.length &&
    onChange(options[(at + d + options.length) % options.length].id);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const close = () => {
    setAnchor(null);
    setQuery("");
  };
  const hits = options.filter((o) =>
    o.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const keyOf = (row: PreviewRow) =>
    row.from.map((p) => p.id).join("+") || `+${row.to[0]?.id}`;
  const headingSx = (color: string) => ({
    gridRow: 2,
    alignSelf: "end",
    px: "22px",
    pb: "4px",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color,
  });
  const cell = (
    key: string,
    col: 1 | 2 | 3,
    row: number,
    span: number,
    content: React.ReactNode,
  ) => (
    <Box
      key={key}
      data-cell={col === 1 ? "from" : col === 3 ? "to" : undefined}
      sx={{
        gridColumn: col,
        gridRow: span > 1 ? `${row} / span ${span}` : row,
        display: "flex",
        alignItems: "center",
        justifyContent: col === 2 ? "center" : undefined,
        minWidth: 0,
        px: col === 2 ? 0 : "18px",
        py: "4px",
      }}
    >
      {content}
    </Box>
  );
  return (
    <Box data-testid="inherited-parts-preview">
      <Box sx={{ position: "relative" }}>
        {/* The cards behind the rows: the generalization raised, the
          specialization flat */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "calc((100% - 48px) / 2)",
            boxSizing: "border-box",
            bgcolor: c.raised,
            border: `1px solid ${c.raisedLine}`,
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "calc((100% - 48px) / 2)",
            boxSizing: "border-box",
            border: `1px solid ${c.flatLine}`,
            borderRadius: "14px",
            pointerEvents: "none",
          }}
        />
        {/* Row 1: the title strips, row 2: the PARTS headings */}
        <Box
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: PREVIEW_COLS,
            gridTemplateRows: "minmax(84px, auto) 28px",
          }}
        >
          <Typography
            component="h4"
            sx={{
              gridColumn: 1,
              gridRow: 1,
              m: 0,
              mt: "1px",
              ml: "1px",
              px: "22px",
              display: "flex",
              alignItems: "center",
              minWidth: 0,
              bgcolor: c.raisedStrip,
              borderBottom: `1px solid ${c.raisedStripLine}`,
              borderRadius: "13px 13px 0 0",
              fontSize: 19,
              fontWeight: 600,
              lineHeight: 1.3,
              color: dark ? "#fff" : "text.primary",
              overflowWrap: "break-word",
            }}
          >
            {preview.title}
          </Typography>
          <Box
            aria-hidden
            sx={{
              gridColumn: 2,
              gridRow: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRightAltIcon sx={{ color: c.arrow, fontSize: "50px" }} />
          </Box>
          {/* The specialization shown: step with the arrows, or pick one */}
          <Box
            sx={{
              gridColumn: 3,
              gridRow: 1,
              mt: "1px",
              mr: "1px",
              px: "16px",
              py: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minWidth: 0,
              bgcolor: c.flatStrip,
              borderBottom: `1px solid ${c.flatLine}`,
              borderRadius: "13px 13px 0 0",
            }}
          >
            <Typography
              sx={{ fontSize: 12, lineHeight: 1.3, color: c.heading }}
            >
              {options.length
                ? `Specialization ${at + 1}/${options.length}`
                : "Specialization"}
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                maxWidth: "100%",
                minWidth: 0,
              }}
            >
              <IconButton
                aria-label="Previous specialization"
                onClick={() => step(-1)}
                sx={{ width: 30, height: 30, color: c.icon, flexShrink: 0 }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Box
                component="button"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={!!anchor}
                onClick={(e: React.MouseEvent<HTMLElement>) =>
                  setAnchor(e.currentTarget)
                }
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  minWidth: 0,
                  px: "12px",
                  py: "5px",
                  borderRadius: "999px",
                  border: `1px solid ${c.pillLine}`,
                  bgcolor: c.pill,
                  color: c.pillText,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  textAlign: "center",
                  cursor: "pointer",
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "1px",
                  },
                }}
              >
                {/* a long name wraps; the strip grows with it */}
                <Box
                  component="span"
                  sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                  {options[at]?.title}
                </Box>
                <ArrowDropDownIcon
                  sx={{ fontSize: 20, ml: "2px", flexShrink: 0 }}
                />
              </Box>
              <IconButton
                aria-label="Next specialization"
                onClick={() => step(1)}
                sx={{ width: 30, height: 30, color: c.icon, flexShrink: 0 }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          <Typography sx={{ gridColumn: 1, ...headingSx(c.heading) }}>
            Parts
          </Typography>
          <Typography sx={{ gridColumn: 3, ...headingSx(c.headingRight) }}>
            Parts
          </Typography>
        </Box>
        <Popover
          open={!!anchor}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          transformOrigin={{ vertical: "top", horizontal: "center" }}
          slotProps={{
            paper: {
              sx: {
                width: 260,
                mt: "4px",
                bgcolor: c.menu,
                backgroundImage: "none",
                border: `1px solid ${c.pillLine}`,
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,.35)",
              },
            },
          }}
        >
          <InputBase
            autoFocus
            placeholder="Search specializations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputProps={{ "aria-label": "Search specializations" }}
            sx={{
              width: "100%",
              px: "12px",
              py: "8px",
              fontSize: 13.5,
              color: c.name,
              borderBottom: `1px solid ${c.pillLine}`,
            }}
          />
          <Box
            component="ul"
            role="listbox"
            aria-label="Specializations"
            sx={{
              m: 0,
              p: "4px",
              listStyle: "none",
              maxHeight: MENU_ROW * 8,
              overflowY: "auto",
            }}
          >
            {hits.map((o) => (
              <Box
                component="li"
                key={o.id}
                role="option"
                aria-selected={o.id === value}
                onClick={() => {
                  onChange(o.id);
                  close();
                }}
                sx={{
                  px: "10px",
                  py: "8px",
                  borderRadius: "6px",
                  fontSize: 13.5,
                  lineHeight: 1.4,
                  color: c.name,
                  cursor: "pointer",
                  bgcolor: o.id === value ? c.current : "transparent",
                  "&:hover": { bgcolor: c.current },
                }}
              >
                {o.title}
              </Box>
            ))}
            {!hits.length && (
              <Typography
                sx={{ px: "10px", py: "8px", fontSize: 13, color: c.heading }}
              >
                No specialization found
              </Typography>
            )}
          </Box>
        </Popover>
        <DragDropContext
          onDragEnd={(r) => {
            if (!r.destination || r.destination.index === r.source.index)
              return;
            const rows = [...preview.rows];
            const [moved] = rows.splice(r.source.index, 1);
            rows.splice(r.destination.index, 0, moved);
            preview.onReorder?.(rows.flatMap((x) => x.from.map((p) => p.id)));
          }}
        >
          <Droppable droppableId="generalized-parts">
            {(dp) => (
              <Box
                component="ul"
                aria-label="Parts"
                ref={dp.innerRef}
                {...dp.droppableProps}
                sx={{
                  position: "relative",
                  listStyle: "none",
                  m: 0,
                  p: 0,
                  pb: "10px",
                }}
              >
                {preview.rows.map((row, index) => {
                  const missing = row.symbol === "x";
                  const n = Math.max(row.from.length, row.to.length, 1);
                  // merged: each specialization part gets its own symbol
                  const merged = row.from.length <= 1 && row.to.length > 1;
                  const canDrag = !!preview.onReorder && row.from.length > 0;
                  const symbol = (key: string, r: number, span: number) =>
                    cell(
                      key,
                      2,
                      r,
                      span,
                      <Tooltip title={PREVIEW_TIP[row.symbol]} placement="top">
                        <Box
                          component="span"
                          sx={{
                            display: "inline-flex",
                            opacity: missing ? 0.6 : 1,
                          }}
                        >
                          <SymbolIcon symbol={row.symbol} />
                        </Box>
                      </Tooltip>,
                    );
                  return (
                    <Draggable
                      key={keyOf(row)}
                      draggableId={keyOf(row)}
                      index={index}
                      isDragDisabled={!canDrag}
                    >
                      {(d, snap) => (
                        <Box
                          component="li"
                          ref={d.innerRef}
                          {...d.draggableProps}
                          {...(row.from.length ? {} : d.dragHandleProps)}
                          data-pair={row.symbol}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: PREVIEW_COLS,
                            gridAutoRows: "minmax(35px, auto)",
                            alignItems: "center",
                            borderRadius: "50px",
                            bgcolor: snap.isDragging
                              ? c.current
                              : "transparent",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover .part-remove-button, &:focus-within .part-remove-button":
                              { opacity: 1, pointerEvents: "auto" },
                            "&:hover": {
                              backgroundColor: dark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(0,0,0,0.04)",
                              boxShadow: dark
                                ? "0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
                                : "0 4px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",
                            },
                          }}
                        >
                          {row.from.map((p, i) =>
                            cell(
                              p.id,
                              1,
                              i + 1,
                              row.from.length === 1 ? n : 1,
                              <>
                                {/* the grip on the row's first part */}
                                {i === 0 ? (
                                  <Box
                                    component="span"
                                    {...d.dragHandleProps}
                                    aria-label={`Drag ${p.title}`}
                                    sx={{
                                      display: "inline-flex",
                                      flexShrink: 0,
                                      mr: "12px",
                                      color: c.grip,
                                      cursor: canDrag ? "grab" : "default",
                                      opacity: canDrag ? 1 : 0.4,
                                    }}
                                  >
                                    <DragIndicatorIcon sx={{ fontSize: 18 }} />
                                  </Box>
                                ) : (
                                  <Box sx={{ width: 30, flexShrink: 0 }} />
                                )}
                                <Typography
                                  component="span"
                                  sx={{
                                    fontSize: 14.5,
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    color: c.name,
                                    overflowWrap: "break-word",
                                    minWidth: 0,
                                  }}
                                >
                                  {formatPartTitle(p.title, !!p.optional)}
                                </Typography>
                                {p.isNew && (
                                  <Typography
                                    component="span"
                                    sx={{
                                      ml: "8px",
                                      fontSize: 12,
                                      color: c.newText,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {p.parent
                                      ? `new · under ${p.parent.title}`
                                      : "new"}
                                  </Typography>
                                )}
                                {preview.onRemove && (
                                  <Tooltip title="Remove part" placement="top">
                                    <Box
                                      component="span"
                                      className="part-remove-button"
                                      sx={{
                                        display: "inline-flex",
                                        ml: "auto",
                                        pl: "6px",
                                        opacity: 0,
                                        pointerEvents: "none",
                                        transition: "opacity 0.2s ease-in-out",
                                        "&:focus-within": {
                                          opacity: 1,
                                          pointerEvents: "auto",
                                        },
                                      }}
                                    >
                                      <IconButton
                                        sx={{ p: 0.5 }}
                                        aria-label={`Remove ${p.title}`}
                                        onClick={() => preview.onRemove?.(p.id)}
                                      >
                                        <DeleteOutlineIcon
                                          sx={{ fontSize: 20, color: "red" }}
                                        />
                                      </IconButton>
                                    </Box>
                                  </Tooltip>
                                )}
                              </>,
                            ),
                          )}
                          {merged
                            ? row.to.map((p, i) =>
                                symbol(`s-${p.id}`, i + 1, 1),
                              )
                            : symbol("s", 1, n)}
                          {missing
                            ? null
                            : row.to.map((p, i) =>
                                cell(
                                  p.id,
                                  3,
                                  i + 1,
                                  row.to.length === 1 ? n : 1,
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontSize: 13.5,
                                      lineHeight: 1.4,
                                      color: c.other,
                                      overflowWrap: "break-word",
                                      minWidth: 0,
                                    }}
                                  >
                                    {formatPartTitle(p.title, !!p.optional)}
                                  </Typography>,
                                ),
                              )}
                        </Box>
                      )}
                    </Draggable>
                  );
                })}
                {dp.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
        {!preview.rows.length && (
          <Typography
            sx={{
              position: "relative",
              px: "18px",
              pb: "14px",
              fontSize: 13.5,
              color: c.missing,
              fontStyle: "italic",
            }}
          >
            No parts
          </Typography>
        )}
      </Box>
      <InheritedPartsLegend
        sx={{ px: 2, pr: 3 }}
        legendItems={getDefaultInheritedPartsLegendItems().filter((i) =>
          PREVIEW_LEGEND.has(i.symbol || ""),
        )}
      />
    </Box>
  );
};

interface GeneralizationNode {
  id: string;
  title: string;
}

interface PartNode {
  id: string;
  title: string;
  isInherited: boolean;
}

interface InheritedPartsViewerProps {
  selectedProperty?: string;
  getAllGeneralizations?: () => GeneralizationNode[];
  nodes?: { [id: string]: any };
  fetchNode?: (nodeId: string) => Promise<INode | null>;
  readOnly?: boolean;
  setDisplayDetails?: any;
  displayDetails?: boolean;
  inheritedPartsDetails?: InheritedPartsDetail[] | null;
  inheritedPartsRepairing?: boolean;
  currentVisibleNode?: any;
  resolvedParts?: ILinkNode[];
  /** Unsaved data to show instead of the node's: the same view and
   * symbols, with no header and the legend cut to the symbols it uses. */
  preview?: InheritancePreview;
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
}

const InheritedPartsViewer: React.FC<InheritedPartsViewerProps> = ({
  selectedProperty = "parts",
  getAllGeneralizations = () => [],
  nodes = {},
  fetchNode,
  readOnly = false,
  setDisplayDetails,
  displayDetails = false,
  inheritedPartsDetails,
  inheritedPartsRepairing,
  currentVisibleNode,
  resolvedParts = [],
  triggerSearch,
  addPart,
  removePart,
  navigateToNode,
  preview,
}) => {
  const isDarkMode = useTheme().palette.mode === "dark";
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const [hoveredPartIndex, setHoveredPartIndex] = React.useState<number | null>(
    null,
  );
  // Exclude the current node itself — a root node should not appear as its
  // own generalization on the left side of the inheritance viewer.
  const generalizations: GeneralizationNode[] = getAllGeneralizations().filter(
    (g) => g.id !== currentVisibleNode?.id,
  );

  // All lists come from the RESOLVED view (ref chain), never raw storage.
  const resolvedOf = useMemo(() => makeResolvedOf(nodes), [nodes]);

  useEffect(() => {
    // Set the first generalization as the active tab initially
    if (generalizations.length > 0 && !activeTab) {
      setActiveTab(generalizations[0].id);
    } else if (
      generalizations.length > 0 &&
      !generalizations.find((g) => g.id === activeTab)
    ) {
      // If the active tab is no longer in the list, reset to the first one
      setActiveTab(generalizations[0].id);
    } else if (generalizations.length === 0) {
      // Clear active tab if there are no generalizations
      setActiveTab(null);
    }
  }, [currentVisibleNode?.id]); // Use node ID to avoid infinite loop

  if (selectedProperty !== "parts") return null;

  if (preview) return <PreviewView preview={preview} dark={isDarkMode} />;

  const getPartOptionalStatus = (partId: string, nodeId: string): boolean => {
    return !!resolvedOf(nodeId).find((n) => n.id === partId)?.optional;
  };

  const getCurrentPartOptionalStatus = (partId: string): boolean => {
    return !!resolvedParts.find((n) => n.id === partId)?.optional;
  };

  // Which gen this part is inherited through right now: the user's pick (via)
  // if still valid, else the overall source, else the first gen that provides
  // the part with the same owner. Undefined for owned parts or no match.
  const getPartCurrentSourceGenId = (partId: string): string | undefined => {
    const part = resolvedParts.find((n) => n.id === partId);
    if (!part?.inheritedFrom) return undefined;
    const withOwners = getPartGeneralizationSources(
      partId,
      generalizations,
      nodes,
    ).map((p) => {
      const genPart = resolvedOf(p.generalizationId).find(
        (n) => n.id === partId,
      );
      return {
        genId: p.generalizationId,
        owner: genPart?.inheritedFrom || p.generalizationId,
      };
    });
    if (part.via && withOwners.some((s) => s.genId === part.via)) {
      return part.via;
    }
    const matching = withOwners
      .filter((s) => s.owner === part.inheritedFrom)
      .map((s) => s.genId);
    const overallSource = currentVisibleNode?.partsInheritance?.source ?? "";
    return matching.includes(overallSource) ? overallSource : matching[0];
  };

  // The generalization title a part is specifically inherited from: the
  // picked gen (via) when recorded, else the gen its owner resolves through.
  const getPartSpecificSourceTitle = (partId: string): string | null => {
    const part = resolvedParts.find((n) => n.id === partId);
    if (!part?.inheritedFrom) return null;
    const providers = getPartGeneralizationSources(
      partId,
      generalizations,
      nodes,
    );
    if (providers.length < 2) return null;
    const picked = part.via
      ? providers.find((p) => p.generalizationId === part.via)
      : undefined;
    const current =
      picked ??
      providers.find((p) => {
        const genPart = resolvedOf(p.generalizationId).find(
          (n) => n.id === partId,
        );
        return (
          (genPart?.inheritedFrom || p.generalizationId) === part.inheritedFrom
        );
      });
    return (
      current?.generalizationTitle ?? nodes[part.inheritedFrom]?.title ?? null
    );
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    const genTitle =
      generalizations.find((g) => g.id === generalizationId)?.title ?? "";
    // Check if node has any parts at all
    const hasParts = resolvedParts.length > 0;
    // The generalization can still have parts when this node has none.
    const generalizationParts = (resolvedOf(generalizationId) ?? []).filter(
      (part: ILinkNode) => !!part?.id,
    );

    if (!hasParts && generalizationParts.length === 0) {
      return noPartsRow;
    }

    // Check if there is cached data for this generalization
    const cachedGeneralizationData = inheritedPartsDetails?.find(
      (calc) => calc.generalizationId === generalizationId,
    );

    if (hasParts && (!inheritedPartsDetails || !cachedGeneralizationData)) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 2,
          }}
        >
          <SyncedSpinner size={16} />
          <Typography
            variant="body2"
            sx={{
              color: (theme) =>
                theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d",
              fontStyle: "italic",
              fontSize: "0.75rem",
            }}
          >
            Loading...
          </Typography>
        </Box>
      );
    }

    const annotatedDetails = cachedGeneralizationData?.details || [];
    // No parts on this node: show each generalization part in the left box.
    const details = hasParts
      ? annotatedDetails
      : generalizationParts.map((part: ILinkNode) => {
          const annotated = annotatedDetails.find(
            (entry: any) => entry.from === part.id,
          );
          return {
            from: part.id,
            to: "",
            symbol: "x",
            fromTitle:
              nodes[part.id]?.title || part.title || annotated?.fromTitle || "",
            fromOptional: !!(part.optional ?? annotated?.fromOptional),
            toTitle: "",
            toOptional: false,
            optionalChange: "none" as const,
            hops: -1,
          };
        });
    const orderRuns = computeOrderRuns(
      details,
      resolvedOf(generalizationId).map((p: ILinkNode) => p.id),
    );

    return (
      <Box>
        <List dense disablePadding sx={LIST_SX}>
          {details.map((entry, index) => {
            const brackets = orderBracketsAt(orderRuns, index);
            const isMissing = entry.symbol === "x";
            // Read the part's optional state live from parts (details is just
            // the reference), so the badge updates on toggle without a recompute.
            const liveToOptional = entry.to
              ? getCurrentPartOptionalStatus(entry.to)
              : !!entry.toOptional;
            const liveOptionalChange: "added" | "removed" | "none" =
              entry.from && entry.to
                ? entry.fromOptional === liveToOptional
                  ? "none"
                  : liveToOptional
                    ? "added"
                    : "removed"
                : "none";
            return (
              <React.Fragment key={`${entry.from}-${entry.to}`}>
                <ListItem
                  dense
                  disableGutters
                  onMouseEnter={() => setHoveredPartIndex(index)}
                  onMouseLeave={() => setHoveredPartIndex(null)}
                  sx={partRowSx(isDarkMode, isMissing)}
                >
                  {brackets.length > 0 && (
                    <Box sx={orderRunBracketWrapperSx()}>
                      {brackets.map((seg) => (
                        <Box
                          key={seg.depth}
                          sx={orderRunBracketSx(seg, isDarkMode)}
                        />
                      ))}
                    </Box>
                  )}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {!readOnly &&
                      entry.from &&
                      entry.symbol !== "x" &&
                      entry.symbol !== "=" && (
                        <ListItemIcon sx={{ minWidth: "auto" }}>
                          <Tooltip title="Search it below" placement="left">
                            <IconButton
                              sx={{ p: 0.4 }}
                              onClick={() =>
                                triggerSearch({
                                  id: entry.from,
                                  title: nodes[entry.from]?.title || "Unknown",
                                })
                              }
                            >
                              <SearchIcon
                                sx={{ fontSize: 19, color: "orange" }}
                              />
                            </IconButton>
                          </Tooltip>
                        </ListItemIcon>
                      )}

                    <ListItemText
                      primary={
                        entry.from ? (
                          <Link
                            underline={!!navigateToNode ? "hover" : "none"}
                            onClick={(e) => {
                              if (!navigateToNode) return;

                              if (e.metaKey || e.ctrlKey) {
                                const url = `${window.location.origin}${window.location.pathname}#${entry.from}`;
                                window.open(url, "_blank");
                              } else {
                                navigateToNode(entry.from);
                              }
                            }}
                            sx={{
                              cursor: !!navigateToNode ? "pointer" : "",
                              color: (them) =>
                                them.palette.mode === "dark"
                                  ? "white"
                                  : "black",
                              fontSize: "0.9rem",
                            }}
                          >
                            {formatPartTitle(
                              entry.fromTitle,
                              entry.fromOptional || false,
                            )}
                          </Link>
                        ) : null
                      }
                      sx={{ flex: 1, minWidth: 0, my: 0 }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.5,
                      flexShrink: 0,
                      width: "70px",
                    }}
                  >
                    {!readOnly && entry.symbol === "=" && !!removePart && (
                      <Tooltip title={"Remove part"} placement="top">
                        <Box
                          component="span"
                          className="part-remove-button"
                          sx={{
                            display: "inline-flex",
                            opacity: 0,
                            pointerEvents: "none",
                            transition: "opacity 0.2s ease-in-out",
                            "&:focus-within": {
                              opacity: 1,
                              pointerEvents: "auto",
                            },
                          }}
                        >
                          <IconButton
                            sx={{ p: 0.5 }}
                            onClick={() => {
                              removePart(entry.to);
                            }}
                          >
                            <DeleteOutlineIcon
                              sx={{
                                fontSize: 20,
                                color: "red",
                              }}
                            />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    )}

                    {!readOnly && entry.symbol === "x" && !!addPart && (
                      <Tooltip title={"Add Part"} placement="top">
                        <IconButton
                          sx={{ p: 0.5 }}
                          onClick={() => {
                            addPart(entry.from);
                          }}
                        >
                          <AddIcon
                            sx={{
                              fontSize: 20,
                              color: "green",
                              border: "1px solid green",
                              borderRadius: "50%",
                            }}
                          />
                        </IconButton>
                      </Tooltip>
                    )}

                    <ListItemIcon sx={SYMBOL_COL_SX}>
                      {entry.symbol === "x" ? (
                        <Tooltip
                          title={`"${genTitle}" has this part, but this node does not inherit it.`}
                          placement="top"
                        >
                          <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                        </Tooltip>
                      ) : entry.symbol === ">" ? (
                        <Tooltip
                          title={`"${genTitle}" has the part "${entry.fromTitle}". This node has "${entry.toTitle}", a descendant of it.`}
                          placement="top"
                        >
                          <ArrowForwardIosIcon
                            sx={{
                              fontSize: 20,
                              color: "orange",
                              p: 0.2,
                              borderRadius: "50%",
                            }}
                          />
                        </Tooltip>
                      ) : entry.symbol === "=" ? (
                        // A part specifically inherited through ANOTHER gen is
                        // not "equal" on this tab — hide the symbol but keep its
                        // space so the row columns stay aligned.
                        (() => {
                          const src = getPartCurrentSourceGenId(entry.to);
                          return (
                            <Tooltip
                              title={`This part is inherited from "${genTitle}". If it changes in the generalization, it changes in this node too.`}
                              placement="top"
                            >
                              <DragHandleIcon
                                sx={{
                                  fontSize: 20,
                                  color: "orange",
                                  visibility:
                                    src === undefined ||
                                    src === generalizationId
                                      ? "visible"
                                      : "hidden",
                                }}
                              />
                            </Tooltip>
                          );
                        })()
                      ) : entry.symbol === "+" ? (
                        <Tooltip
                          title={`This part was added directly to this node. "${genTitle}" does not have it, so it is not inherited.`}
                          placement="top"
                        >
                          <AddIcon sx={{ fontSize: 20, color: "orange" }} />
                        </Tooltip>
                      ) : null}
                    </ListItemIcon>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <ListItemText
                      primary={
                        entry.to ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              width: "100%",
                            }}
                          >
                            <Link
                              underline={!!navigateToNode ? "hover" : "none"}
                              onClick={(e) => {
                                if (!navigateToNode) return;

                                if (e.metaKey || e.ctrlKey) {
                                  const url = `${window.location.origin}${window.location.pathname}#${entry.to}`;
                                  window.open(url, "_blank");
                                } else {
                                  navigateToNode(entry.to);
                                }
                              }}
                              sx={{
                                cursor: !!navigateToNode ? "pointer" : "",
                                color: (them) =>
                                  them.palette.mode === "dark"
                                    ? "white"
                                    : "black",
                                fontSize: "0.9rem",
                              }}
                            >
                              {formatPartTitle(
                                entry.toTitle,
                                liveToOptional,
                                liveOptionalChange,
                              )}
                            </Link>
                            {(() => {
                              const sourceTitle = getPartSpecificSourceTitle(
                                entry.to,
                              );
                              return sourceTitle ? (
                                <Typography
                                  sx={{
                                    ml: "auto",
                                    flexShrink: 0,
                                    fontSize: "0.72rem",
                                    fontStyle: "italic",
                                    color: "gray",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {`(Inherited from "${sourceTitle}")`}
                                </Typography>
                              ) : null;
                            })()}
                          </Box>
                        ) : null
                      }
                      sx={{ flex: 1, minWidth: 0, my: 0 }}
                    />
                  </Box>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      </Box>
    );
  };
  // Get active generalization directly from generalizations array
  const activeGeneralization = generalizations.find((g) => g.id === activeTab);
  const activeGenId = activeGeneralization?.id;
  const activeGenTitle = activeGeneralization?.title;

  if (generalizations.length <= 0) {
    return null; // No generalizations and no own parts (root without parts)
  }

  return (
    <Box>
      {!displayDetails && (
        <Button
          variant="outlined"
          sx={{
            borderRadius: "25px",
            p: 0.5,
            px: 2,
            ml: "10px",
            mb: "9px",
          }}
          onClick={() => {
            setDisplayDetails((prev: boolean) => !prev);
          }}
        >
          <KeyboardArrowDownIcon />
          Parts inherited from ...
        </Button>
      )}
      {displayDetails && (
        <Box
          sx={{
            /*             px: "10px", */
            mt: "8px",
            backgroundColor: (theme) =>
              theme.palette.mode === "light" ? "#fafbfc" : "#1e1e1f",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: (theme: any) =>
                `1.5px solid ${theme.palette.mode === "light" ? "#f0f0f0" : "#333"}`,
              mb: "10px",
              py: "15px",
              px: "10px",
            }}
          >
            <Typography
              sx={{ ml: "7px", fontSize: "19px", fontWeight: "bold" }}
            >
              {"Parts inherited from generalizations:"}
            </Typography>

            {!triggerSearch && (
              <Button
                sx={{
                  border: "1px solid gray",
                  p: 0,
                  backgroundColor: "",
                  color: "gray",
                  borderRadius: "25px",
                }}
                onClick={() => {
                  setDisplayDetails(false);
                }}
              >
                Hide
              </Button>
            )}
          </Box>

          {activeGenId && activeGenTitle && (
            <Box
              key={activeGenId}
              sx={{ position: "relative", pt: 4, mx: 1.5 }}
            >
              {inheritedPartsRepairing && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    zIndex: 2,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <SyncedSpinner size={16} />
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: "orange",
                      lineHeight: 1,
                    }}
                  >
                    Calculating inheritance…
                  </Typography>
                </Box>
              )}
              {/* Visual Boxes for Left and Right Panels */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 4,
                  left: 0,
                  width: "calc(50% - 35px)",
                  border: (theme) =>
                    `1px solid ${alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.15 : 0.2)}`,
                  backgroundColor: (theme) =>
                    alpha(
                      theme.palette.background.paper,
                      theme.palette.mode === "dark" ? 0.4 : 0.7,
                    ),
                  backdropFilter: "blur(12px)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`
                      : `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  borderRadius: "16px",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 4,
                  right: 0,
                  width: "calc(50% - 35px)",
                  border: (theme) =>
                    `1px solid ${alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.15 : 0.2)}`,
                  backgroundColor: (theme) =>
                    alpha(
                      theme.palette.background.paper,
                      theme.palette.mode === "dark" ? 0.4 : 0.7,
                    ),
                  backdropFilter: "blur(12px)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`
                      : `0 8px 32px ${alpha(theme.palette.common.black, 0.05)}`,
                  borderRadius: "16px",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: 40,
                  position: "relative",
                  width: "100%",
                  mt: 0,
                  mb: 3.5,
                  zIndex: 1,
                }}
              >
                {/* Left Text */}
                <Box
                  sx={{
                    width: "calc(50% - 35px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 2,
                    boxSizing: "border-box",
                  }}
                >
                  {generalizations.length > 1 ? (
                    <TextField
                      size="small"
                      value={activeGenId}
                      onChange={(e) => setActiveTab(e.target.value)}
                      select
                      label="Generalizations"
                      sx={{
                        width: "100%",
                        maxWidth: "100%",
                        "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
                          backgroundColor: (theme) =>
                            theme.palette.background.paper,
                          px: "6px",
                          borderRadius: "4px",
                        },
                        "& .MuiSelect-select": {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                        },
                      }}
                      slotProps={{
                        input: {
                          sx: {
                            height: "40px",
                            borderRadius: "12px",
                            color: "text.primary",
                            fontWeight: 700,
                            fontSize: "1.15rem",
                            backgroundColor: (theme) =>
                              theme.palette.background.paper,
                          },
                        },
                        inputLabel: {
                          sx: {
                            color: "grey",
                            "&.Mui-focused": {
                              color: "#f2a43a",
                            },
                          },
                        },
                        select: {
                          MenuProps: {
                            PaperProps: {
                              sx: {
                                border: "2px solid orange",
                                borderRadius: "12px",
                                "&::-webkit-scrollbar": { display: "none" },
                              },
                            },
                            MenuListProps: {
                              sx: { paddingTop: 0, paddingBottom: 0 },
                            },
                          },
                          renderValue: () => (
                            <Box
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                textAlign: "center",
                                width: "100%",
                              }}
                            >
                              {activeGenTitle}
                            </Box>
                          ),
                        },
                      }}
                    >
                      {generalizations.map((gen) => (
                        <MenuItem
                          key={gen.id}
                          value={gen.id}
                          sx={{
                            border: "1px solid gray",
                            borderRadius: "25px",
                            my: "4px",
                            mx: "8px",
                            justifyContent: "center",
                          }}
                        >
                          <Typography sx={{ textAlign: "center" }}>
                            {gen.title}
                          </Typography>
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Tooltip title={activeGenTitle}>
                      <Typography
                        sx={{
                          color: "orange",
                          fontWeight: 700,
                          fontSize: "1.15rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: "center",
                        }}
                      >
                        {activeGenTitle}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>

                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "40px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <ArrowRightAltIcon
                    sx={{ color: "orange", fontSize: "50px" }}
                  />
                </Box>

                <Box
                  sx={{
                    width: "calc(50% - 35px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 2,
                    boxSizing: "border-box",
                  }}
                >
                  <Tooltip title={currentVisibleNode?.title}>
                    <Typography
                      sx={{
                        color: "orange",
                        fontWeight: 700,
                        fontSize: "1.15rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "default",
                        textAlign: "center",
                      }}
                    >
                      {currentVisibleNode?.title}
                    </Typography>
                  </Tooltip>
                </Box>
              </Box>

              {getTabContent(activeGenId)}
            </Box>
          )}

          <InheritedPartsLegend sx={{ px: 2, pr: 3 }} />
        </Box>
      )}
    </Box>
  );
};

export default InheritedPartsViewer;
