import React, { useEffect, useState } from "react";
import { Box, LinearProgress, Paper, Typography } from "@mui/material";
import { Post } from "@components/lib/utils/Post";
import { SearchBox } from "../SearchBox/SearchBox";

/**
 * The sidebar's list of the nodes with proposals: each family a child's
 * proposal names, and each proposal that is the top of its own review. One
 * click opens that node's review. Drawn like the review's own lists.
 */
export type ReviewTargetRow = {
  id: string;
  title: string;
  proposals: number;
  pending: number;
};

type Props = {
  appName: string;
  /** The node whose review is open, if any; its row is marked. */
  currentId?: string | null;
  onOpen: (id: string) => void;
  dark: boolean;
};

const ProposalList = ({ appName, currentId, onOpen, dark }: Props) => {
  const [rows, setRows] = useState<ReviewTargetRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  // The node page's search box, over the listed titles.
  const [query, setQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setFailed(false);
    Post<{ nodes: ReviewTargetRow[] }>("/review/proposals", {
      action: "targets",
      appName,
    })
      .then((res) => {
        if (!cancelled) setRows(res.nodes || []);
      })
      .catch((e) => {
        console.error("proposal list", e);
        if (!cancelled) {
          setRows([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [appName]);

  // The review's own colours: its card, lines and step 2's picked row.
  const c = {
    card: dark ? "#1b1b1c" : "#fff",
    edge: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    line: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    itemText: dark ? "#b9b9b4" : "rgba(0,0,0,0.7)",
    itemHover: dark ? "#222" : "#f3f4f6",
    picked: dark ? "#46301e" : "#fbe9d7",
    pickedLine: dark ? "#b0733f" : "#e0a26b",
    muted: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
  };
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const q = query.trim().toLowerCase();
  const shown = rows?.filter((r) => !q || r.title.toLowerCase().includes(q));
  return (
    <Paper
      elevation={0}
      data-testid="proposal-list"
      sx={{
        mx: "11px",
        borderRadius: "12px",
        overflow: "hidden",
        border: `1px solid ${c.edge}`,
        bgcolor: c.card,
      }}
    >
      <Box
        sx={{
          px: "16px",
          py: "12px",
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
          Nodes with proposals
        </Typography>
      </Box>
      {!!rows?.length && (
        <Box sx={{ px: "4px", pt: "4px", borderBottom: `1px solid ${c.line}` }}>
          <SearchBox
            setSearch={setQuery}
            search={query}
            label="Search nodes with proposals..."
            sx={{
              "& .MuiOutlinedInput-root input": { fontSize: 14 },
              "& .MuiSvgIcon-root": { fontSize: 20 },
            }}
          />
        </Box>
      )}
      {rows === null ? (
        <LinearProgress />
      ) : rows.length === 0 || !shown?.length ? (
        <Typography
          sx={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "text.secondary",
            p: "16px",
          }}
        >
          {failed
            ? "The proposals could not be loaded"
            : rows.length === 0
              ? "No proposals"
              : "No node with proposals matches"}
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label="Nodes with proposals"
          sx={{
            m: 0,
            p: "8px",
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {shown.map((r) => {
            const on = r.id === currentId;
            return (
              <Box component="li" key={r.id}>
                <Box
                  component="button"
                  type="button"
                  aria-current={on ? "true" : undefined}
                  onClick={() => onOpen(r.id)}
                  sx={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    py: "10px",
                    px: "14px",
                    border: "1px solid",
                    borderColor: on ? c.pickedLine : "transparent",
                    borderRadius: "8px",
                    bgcolor: on ? c.picked : "transparent",
                    color: on ? (dark ? "#fff" : "text.primary") : c.itemText,
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    "&:hover": { bgcolor: on ? c.picked : c.itemHover },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: "1px",
                    },
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: on ? 600 : 400,
                      lineHeight: 1.4,
                      overflowWrap: "break-word",
                    }}
                  >
                    {r.title}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      display: "block",
                      mt: "2px",
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: c.muted,
                    }}
                  >
                    {r.pending
                      ? `${plural(r.pending, "proposal", "proposals")} to review`
                      : `${plural(r.proposals, "proposal", "proposals")}, all reviewed`}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

export default ProposalList;
