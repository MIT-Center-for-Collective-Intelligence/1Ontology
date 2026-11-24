import React, { useState } from "react";
import { Box, TextField, Typography } from "@mui/material";
import { IAlgorithm } from "@components/types/INode";
import FlowTrack, { PickedTask } from "./FlowTrack";

/**
 * Under the generalization's flow: the accepted flows it was built from,
 * each drawn beside its name. A part picked or pointed at above stands out
 * in the flows that have it; the flow under the pointer is marked here and
 * its parts above.
 * Matching is by activity id only; a part bound to no activity matches none.
 */
export type InfluenceRow = {
  id: string;
  title: string;
  algorithm: IAlgorithm;
  /** The activity ids of this flow's steps. */
  has: Set<string>;
};

type Props = {
  rows: InfluenceRow[];
  /** The part picked in the flow above, if any. */
  pickedPart: PickedTask | null;
  /** The accepted flow under the pointer, if any. */
  pickedFlow: string | null;
  onPickFlow: (id: string | null) => void;
  onClearPart: () => void;
  dark: boolean;
  titleOf: (id: string) => string;
  /** True shows each specialization's parts in place of its flow. */
  parts?: boolean;
};

const SEARCH_FROM = 6;

const InfluenceList = ({
  rows,
  pickedPart,
  pickedFlow,
  onPickFlow,
  onClearPart,
  dark,
  titleOf,
  parts,
}: Props) => {
  const [query, setQuery] = useState("");
  // What the rows are, where the box names them.
  const what = parts ? "specializations" : "flows";
  const c = {
    grid: dark ? "#2c2d2f" : "#e8eaed",
    rowTint: dark ? "#202122" : "#f8f9fb",
  };
  const hasPicked = (r: InfluenceRow) =>
    !!pickedPart?.partId && r.has.has(pickedPart.partId);
  const q = query.trim().toLowerCase();
  // The rows keep their order, whatever is picked.
  const list = rows.filter((r) => !q || r.title.toLowerCase().includes(q));
  const supporters = rows.filter(hasPicked).length;
  return (
    <Box
      component="section"
      aria-label="Accepted flows"
      // a box of its own, a step darker than the generalized flow's
      sx={{
        border: `1px solid ${c.grid}`,
        borderRadius: "12px",
        overflow: "hidden",
        bgcolor: dark ? "#141416" : "#f4f5f7",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          minHeight: 40,
          boxSizing: "border-box",
          borderBottom: `1px solid ${c.grid}`,
          px: "20px",
          py: "6px",
        }}
      >
        <Typography
          data-testid="influence-head"
          // a quiet label, not a heading
          sx={{
            fontSize: 13,
            lineHeight: "20px",
            color: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
          }}
        >
          {pickedPart
            ? pickedPart.partId
              ? `${pickedPart.text} · in ${supporters} of ${rows.length} accepted ${what}`
              : `${pickedPart.text} · not linked to an activity, so no ${parts ? "specialization" : "flow"} can be matched to it`
            : parts
              ? "Parts of the accepted specializations"
              : "Accepted specialization flows"}
        </Typography>
        {pickedPart && (
          <Box
            component="button"
            type="button"
            onClick={onClearPart}
            sx={{
              p: 0,
              border: 0,
              bgcolor: "transparent",
              color: "text.secondary",
              fontFamily: "inherit",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
              "&:hover": { color: "text.primary" },
            }}
          >
            Clear
          </Box>
        )}
        {rows.length >= SEARCH_FROM && (
          <TextField
            size="small"
            placeholder={`Search accepted ${what}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{
              ml: "auto",
              width: 240,
              "& input": { fontSize: 13, py: "5px" },
            }}
          />
        )}
      </Box>
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          listStyle: "none",
        }}
      >
        {list.map((r) => {
          const on = pickedFlow === r.id;
          const has = hasPicked(r);
          return (
            <Box
              component="li"
              key={r.id}
              // under the pointer, or in focus, its parts are marked above
              tabIndex={0}
              data-on={on || undefined}
              data-has={pickedPart ? String(has) : undefined}
              onMouseEnter={() => onPickFlow(r.id)}
              onMouseLeave={() => onPickFlow(null)}
              onFocus={() => onPickFlow(r.id)}
              onBlur={() => onPickFlow(null)}
              sx={{
                bgcolor: on ? c.rowTint : "transparent",
                outline: "none",
                "&:focus-visible": {
                  boxShadow: (t) => `inset 0 0 0 2px ${t.palette.primary.main}`,
                },
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                // step 1's table: the name in its own column, then the flow
                alignItems: { md: "stretch" },
                borderTop: `1px solid ${c.grid}`,
                "&:first-of-type": { borderTop: 0 },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  width: { xs: "100%", md: 240 },
                  flexShrink: 0,
                  boxSizing: "border-box",
                  px: "12px",
                  py: "12px",
                  borderRight: { md: `1px solid ${c.grid}` },
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: "20px",
                  color: dark ? "#c9c9cc" : "#333",
                  // a flow without the picked part steps back
                  opacity: pickedPart && !has ? 0.45 : 1,
                }}
              >
                {r.title}
              </Box>
              {/* Its flow; with a part picked above, that part stands out */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflowX: "auto",
                  alignSelf: "center",
                  px: "12px",
                  py: "8px",
                  opacity: pickedPart && !has ? 0.45 : 1,
                }}
              >
                <FlowTrack
                  algorithm={r.algorithm}
                  dark={dark}
                  titleOf={titleOf}
                  parts={parts}
                  mark={(t) =>
                    pickedPart?.partId && t.partId !== pickedPart.partId
                      ? { dim: true }
                      : undefined
                  }
                />
              </Box>
            </Box>
          );
        })}
        {list.length === 0 && (
          <Box
            component="li"
            sx={{ px: "8px", py: "4px", fontSize: 13, color: "text.secondary" }}
          >
            No match
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default InfluenceList;
