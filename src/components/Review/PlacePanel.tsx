import React, { useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { INode } from "@components/types/INode";
import { AlgorithmProposal } from "@components/types/IProposal";

/**
 * Under a flow rejected as "does not belong here": the other families whose
 * children share tasks with it, best match first, so the reviewer can say
 * where it goes. The choice is recorded on the proposal; the hierarchy is
 * not changed here.
 */
export type Family = {
  id: string;
  title: string;
  count: number;
  common: { id: string; title: string; n: number }[];
};

type Props = {
  proposal: AlgorithmProposal;
  title: string;
  parentId: string;
  parentTitle: string;
  /** null while loading */
  families: Family[] | null;
  dark: boolean;
  searchWithFuse: (query: string, nodeType?: any) => INode[];
  onPlace: (
    p: AlgorithmProposal,
    movedTo: { id: string; title: string } | null,
    doesNotBelong: boolean,
  ) => void;
  navigateToNode: (id: string) => void;
};

const PlacePanel = ({
  proposal,
  title,
  parentId,
  parentTitle,
  families,
  dark,
  searchWithFuse,
  onPlace,
  navigateToNode,
}: Props) => {
  const c = {
    ok: dark ? "#8fd7ad" : "#2a8a5c",
    muted: dark ? "#8a9299" : "#6b7680",
    line: dark ? "#333" : "#e6e9ec",
    track: dark ? "#2a2b2d" : "#eceff3",
    tint: dark ? "#25382a" : "#e2f2e5",
  };
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const mine = new Set(
    (proposal.decision?.steps || proposal.steps).map((s) => s.id),
  );
  const ranked = (families || [])
    .map((f) => {
      const hit = f.common.filter((x) => mine.has(x.id)).length;
      return { ...f, hit, score: f.common.length ? hit / f.common.length : 0 };
    })
    .sort((a, b) => b.score - a.score || b.hit - a.hit);
  const shown = showAll ? ranked : ranked.filter((f) => f.hit > 0);
  const hidden = ranked.length - shown.length;
  const found = query.trim()
    ? searchWithFuse(query, "activity")
        .filter((n) => n.id !== parentId && n.id !== proposal.nodeId)
        .slice(0, 6)
    : [];
  const short = (t: string, n = 60) =>
    t.length > n ? t.slice(0, n - 1) + "…" : t;
  const pill = (t: string, on: boolean) => (
    <Box
      key={t}
      component="span"
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: "7px",
        fontSize: 12,
        bgcolor: on ? c.tint : c.track,
        whiteSpace: "nowrap",
      }}
    >
      {t}
    </Box>
  );
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: c.line,
        borderRadius: "12px",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
          Where does “{short(title)}” belong?
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          Generalizations whose specializations do the same tasks, best match
          first.
        </Typography>
      </Box>
      {families === null ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          Loading…
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "180px minmax(0, 1fr) max-content",
            rowGap: 1,
            columnGap: 2,
            alignItems: "center",
          }}
        >
          {shown.map((f) => (
            <React.Fragment key={f.id}>
              <Box>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    cursor: "pointer",
                    "&:hover": { color: "primary.main" },
                  }}
                  onClick={() => navigateToNode(f.id)}
                >
                  {f.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  {f.count} specialization{f.count === 1 ? "" : "s"} with
                  proposals
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  flexWrap: "wrap",
                  minHeight: 36,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: f.hit ? c.ok : c.muted,
                    mr: 0.5,
                  }}
                >
                  {f.hit} of {f.common.length}
                </Typography>
                {f.common.map((x) => pill(x.title, mine.has(x.id)))}
              </Box>
              <Button
                size="small"
                variant={f === shown[0] && f.hit ? "contained" : "outlined"}
                color={f === shown[0] && f.hit ? "success" : "inherit"}
                disableElevation
                sx={{ borderRadius: "8px" }}
                onClick={() =>
                  onPlace(proposal, { id: f.id, title: f.title }, true)
                }
              >
                Move here
              </Button>
            </React.Fragment>
          ))}
          {shown.length === 0 && (
            <Typography
              sx={{
                fontSize: 13,
                color: "text.secondary",
                gridColumn: "1 / -1",
              }}
            >
              No other family shares a task with it.
            </Typography>
          )}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
              Somewhere else
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              any activity
            </Typography>
          </Box>
          <Box sx={{ gridColumn: "2 / -1" }}>
            <TextField
              size="small"
              placeholder="Search for a generalization…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{
                width: 360,
                maxWidth: "100%",
                "& .MuiInputBase-input": { fontSize: 13, py: 0.9 },
              }}
            />
            {found.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  mt: 1,
                }}
              >
                {found.map((n) => (
                  <Box
                    key={n.id}
                    sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                  >
                    <Typography sx={{ fontSize: 13, flex: 1 }} noWrap>
                      {n.title}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      sx={{ borderRadius: "8px" }}
                      onClick={() =>
                        onPlace(proposal, { id: n.id, title: n.title }, true)
                      }
                    >
                      Move there
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {hidden > 0 && (
          <Button size="small" color="inherit" onClick={() => setShowAll(true)}>
            Show {hidden} more with no matching task
          </Button>
        )}
        <Button
          size="small"
          color="inherit"
          onClick={() => onPlace(proposal, null, false)}
        >
          Keep it under {short(parentTitle, 40)} after all
        </Button>
      </Box>
    </Box>
  );
};

export default PlacePanel;
