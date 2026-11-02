import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IAlgorithm, INode } from "@components/types/INode";
import { User } from "@components/types/IAuth";
import {
  AlgorithmProposal,
  FlowKind,
  ProposalOutcome,
  ProposalStep,
  ReviewDoc,
} from "@components/types/IProposal";
import { Post } from "@components/lib/utils/Post";
import { ReactFlowProvider } from "@xyflow/react";
import AlgorithmFlowVisualizer from "../NodBody/AlgorithmFlowVisualizer";
import { PartOption } from "../NodBody/AlgorithmFlowVisualizer/FlowUIComponents";
import {
  algorithmToProposal,
  proposalToAlgorithm,
} from "@components/lib/review/algorithmBridge";
import { useProposalIndex } from "./ProposalIndexContext";
import InlineFlow from "./InlineFlow";
import AlignedFlows, { AlignedRow } from "./AlignedFlows";
import PlacePanel, { Family } from "./PlacePanel";
import {
  deriveParentFlow,
  flowSignature,
} from "@components/lib/review/deriveParent";

type Props = {
  currentVisibleNode: INode;
  relatedNodes: { [id: string]: INode };
  fetchNode: (nodeId: string, force?: boolean) => Promise<INode | null>;
  navigateToNode: (nodeId: string) => void;
  searchWithFuse: (query: string, nodeType?: any) => INode[];
  appName?: string;
  user: User;
};

const REASONS = ["Wrong step", "Missing step", "Not enough evidence", "Other"];
const OUTCOME_LABEL: Record<string, string> = {
  accepted: "Accepted",
  edited: "Edited",
  rejected: "Rejected",
};
// One type scale for the whole page: 14 card titles, 13 text, 12 secondary.
const T = {
  title: { fontSize: 14, fontWeight: 600, lineHeight: 1.4 },
  text: { fontSize: 13, lineHeight: 1.5 },
  small: { fontSize: 12, lineHeight: 1.45 },
  label: { fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
};
const shortText = (t: string, max = 70) =>
  t.length > max ? t.slice(0, max - 1) + "…" : t;
const isDecided = (s: ProposalOutcome) => s !== "pending";

const ProposalReview = ({
  currentVisibleNode,
  relatedNodes,
  fetchNode,
  navigateToNode,
  searchWithFuse,
  appName,
  user,
}: Props) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { refresh: refreshIndex } = useProposalIndex();
  const app = appName || "";
  const nodeId = currentVisibleNode.id;

  const [docs, setDocs] = useState<ReviewDoc[]>([]);
  const [nodes, setNodes] = useState<{ [id: string]: INode }>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [aligned, setAligned] = useState(false);
  const [families, setFamilies] = useState<Family[] | null>(null);
  // A left-out task to outline in the rows that do it.
  const [highlight, setHighlight] = useState<string | null>(null);
  // Which of the three stacked cards are open; null = follow the work.
  const [manualOpen, setManualOpen] = useState<Set<number> | null>(null);
  const [compare, setCompare] = useState(false);

  const childLinks = useMemo(
    () =>
      currentVisibleNode.specializations.flatMap((c) =>
        c.nodes.map((n) => ({
          id: n.id,
          collection: c.collectionName || "main",
        })),
      ),
    [currentVisibleNode.specializations],
  );
  const isFamily = childLinks.length > 0;

  // Load the children, their proposals, and the activities the steps point to.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setEditing(null);
      setRejectFor(null);
      setHighlight(null);
      setFamilies(null);
      setManualOpen(null);
      setCompare(false);
      const ids = isFamily ? childLinks.map((c) => c.id) : [nodeId];
      const got: { [id: string]: INode } = {};
      await Promise.all(
        ids.map(async (id) => {
          const n = relatedNodes[id] || (await fetchNode(id));
          if (n) got[id] = n;
        }),
      );
      const res = await Post<{ proposals: ReviewDoc[] }>("/review/proposals", {
        action: "list",
        appName: app,
        nodeIds: [...ids, nodeId],
        parentId: nodeId,
      });
      const stepIds = new Set<string>();
      for (const d of res.proposals)
        if (d.kind === "algorithm")
          for (const s of [...d.steps, ...(d.decision?.steps || [])])
            stepIds.add(s.id);
      await Promise.all(
        [...stepIds].map(async (id) => {
          if (got[id] || relatedNodes[id]) return;
          const n = await fetchNode(id);
          if (n) got[id] = n;
        }),
      );
      if (cancelled) return;
      setNodes(got);
      setDocs(res.proposals);
      setLoading(false);
    })().catch((e) => {
      console.error(e);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, app]);

  const titleOf = useCallback(
    (id: string) =>
      nodes[id]?.title ||
      relatedNodes[id]?.title ||
      (id === nodeId ? currentVisibleNode.title : id),
    [nodes, relatedNodes, nodeId, currentVisibleNode.title],
  );

  const algorithms = useMemo(() => {
    const m: { [nodeId: string]: AlgorithmProposal } = {};
    for (const d of docs) if (d.kind === "algorithm") m[d.nodeId] = d;
    return m;
  }, [docs]);
  const stepsOf = (p: AlgorithmProposal) => p.decision?.steps || p.steps;
  const kindOf = (p: AlgorithmProposal) => p.decision?.kind || p.flowKind;

  const rows = useMemo(
    () =>
      childLinks.map((c) => {
        const n = nodes[c.id] || relatedNodes[c.id];
        return {
          id: c.id,
          title: n?.title || titleOf(c.id),
          collection: c.collection,
          proposal: algorithms[c.id] as AlgorithmProposal | undefined,
          isFamily:
            !!n && n.specializations.some((col) => col.nodes.length > 0),
        };
      }),
    [childLinks, nodes, relatedNodes, algorithms, titleOf],
  );
  const total = rows.filter((r) => r.proposal).length;
  const decided = rows.filter(
    (r) => r.proposal && isDecided(r.proposal.status),
  ).length;

  // ---------- writes ----------
  const patchDoc = (id: string, patch: Partial<AlgorithmProposal>) =>
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? ({ ...d, ...patch } as ReviewDoc) : d)),
    );
  const decide = async (
    p: AlgorithmProposal,
    outcome: ProposalOutcome,
    extra: {
      steps?: ProposalStep[];
      kind?: FlowKind;
      reason?: string;
      algorithm?: IAlgorithm;
      doesNotBelong?: boolean;
    } = {},
  ) => {
    const decision = {
      outcome,
      ...extra,
      ...(extra.doesNotBelong ? { movedTo: null } : {}),
      by: user?.uname,
      at: new Date(),
    };
    patchDoc(p.id, { status: outcome, decision });
    setEditing(null);
    setRejectFor(null);
    try {
      await Post("/review/proposals", {
        action: "decide",
        appName: app,
        proposalId: p.id,
        outcome,
        ...extra,
      });
      refreshIndex();
    } catch (e) {
      console.error(e);
      patchDoc(p.id, { status: p.status, decision: p.decision });
    }
  };
  const undecide = async (p: AlgorithmProposal) => {
    patchDoc(p.id, { status: "pending", decision: null });
    try {
      await Post("/review/proposals", {
        action: "undecide",
        appName: app,
        proposalId: p.id,
      });
      refreshIndex();
    } catch (e) {
      console.error(e);
      patchDoc(p.id, { status: p.status, decision: p.decision });
    }
  };

  // Where a rejected activity goes (recorded only; the hierarchy is not changed).
  const place = async (
    p: AlgorithmProposal,
    movedTo: { id: string; title: string } | null,
    doesNotBelong: boolean,
  ) => {
    if (!p.decision) return;
    const before = p.decision;
    patchDoc(p.id, { decision: { ...before, movedTo, doesNotBelong } });
    try {
      await Post("/review/proposals", {
        action: "place",
        appName: app,
        proposalId: p.id,
        movedTo,
        doesNotBelong,
      });
    } catch (e) {
      console.error(e);
      patchDoc(p.id, { decision: before });
    }
  };
  // The parent's flow, built from its accepted specializations, written as a
  // pending proposal of its own.
  const propose = async (algorithm: IAlgorithm, from: string[]) => {
    const { steps, kind } = algorithmToProposal(algorithm);
    const parent = currentVisibleNode.generalizations.flatMap(
      (c) => c.nodes,
    )[0];
    try {
      const res = await Post<{ ok: boolean; proposal?: ReviewDoc }>(
        "/review/proposals",
        {
          action: "propose",
          appName: app,
          nodeId,
          nodeTitle: currentVisibleNode.title,
          parentId: parent?.id || null,
          algorithm,
          steps,
          kind,
          from,
        },
      );
      if (res.ok && res.proposal) {
        const doc = res.proposal;
        setDocs((prev) => [...prev.filter((d) => d.id !== doc.id), doc]);
        refreshIndex();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- presentation helpers ----------
  const line = dark ? "#333" : "#e6e9ec";
  const colors = {
    ok: dark ? "#8fd7ad" : "#2a8a5c",
    warn: dark ? "#e9bf6b" : "#8d5a0d",
    bad: dark ? "#e39b85" : "#b3401f",
    warnBg: dark ? "#3d2f12" : "#fff4de",
  };
  const Tag = ({
    k,
    children,
  }: {
    k: keyof typeof colors;
    children: React.ReactNode;
  }) => (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.7,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color: colors[k],
      }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: colors[k],
          flexShrink: 0,
        }}
      />
      {children}
    </Box>
  );
  // A two-way switch drawn as a segmented control.
  const Segmented = ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string; hint?: string }[];
  }) => (
    <Box
      sx={{
        display: "inline-flex",
        p: "3px",
        gap: "2px",
        borderRadius: "10px",
        bgcolor: dark ? "#2a2b2d" : "#eceff3",
        flexShrink: 0,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Box
            key={o.value}
            component="button"
            type="button"
            title={o.hint}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            sx={{
              border: 0,
              cursor: "pointer",
              px: 1.5,
              py: 0.5,
              borderRadius: "8px",
              fontSize: 13,
              fontWeight: on ? 600 : 500,
              fontFamily: "inherit",
              lineHeight: 1.5,
              color: on ? "text.primary" : "text.secondary",
              bgcolor: on ? (dark ? "#1b1b1c" : "#fff") : "transparent",
              boxShadow: on ? "0 1px 2px rgba(0,0,0,0.14)" : "none",
              transition: "background-color 120ms, color 120ms",
              "&:hover": { color: "text.primary" },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
  // The tree the canvas edits; built from the steps when none was stored.
  const algorithmOf = (p: AlgorithmProposal): IAlgorithm =>
    p.decision?.algorithm ||
    p.algorithm ||
    proposalToAlgorithm(titleOf(p.nodeId), stepsOf(p), kindOf(p), p.flowNote);
  const cardSx = {
    borderRadius: "16px",
    mb: 2,
    overflow: "hidden",
    border: "1px solid",
    borderColor: line,
    bgcolor: dark ? "#1b1b1c" : "#fff",
  };
  const Section = ({
    title,
    children,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <Paper elevation={0} sx={cardSx}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 3,
          py: 2,
          gap: 1,
          borderBottom: "1px solid",
          borderColor: line,
        }}
      >
        {title}
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Paper>
  );

  // ---------- rejection ----------
  const RejectPanel = ({
    p,
    onCancel,
  }: {
    p: AlgorithmProposal;
    onCancel: () => void;
  }) => {
    const [reasons, setReasons] = useState<string[]>([]);
    const [note, setNote] = useState("");
    const [notHere, setNotHere] = useState(false);
    const reason = [...reasons, note.trim()].filter(Boolean).join(" — ");
    const under = p.parentId
      ? p.parentId === nodeId
        ? currentVisibleNode.title
        : titleOf(p.parentId)
      : null;
    return (
      <Box
        sx={{
          border: "1px solid",
          borderColor: colors.bad,
          borderRadius: "12px",
          p: 2,
        }}
      >
        <Typography sx={{ ...T.label, fontSize: 13, mb: 0.25 }}>
          Reject this proposal
        </Typography>
        <Typography sx={{ ...T.small, color: "text.secondary", mb: 1.5 }}>
          Pick what is wrong, add a note if it helps, or both.
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={reasons}
          onChange={(_, v: string[]) => setReasons(v)}
          sx={{
            flexWrap: "wrap",
            gap: 1,
            "& .MuiToggleButtonGroup-grouped": {
              border: "1px solid",
              borderColor: `${line} !important`,
              borderRadius: "8px !important",
              px: 1.5,
              py: 0.4,
              fontSize: 13,
              lineHeight: 1.5,
              textTransform: "none",
            },
            "& .Mui-selected": {
              borderColor: `${colors.bad} !important`,
              color: `${colors.bad} !important`,
            },
          }}
        >
          {REASONS.map((r) => (
            <ToggleButton key={r} value={r}>
              {r}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          sx={{ mt: 1.5 }}
        />
        {under && (
          <FormControlLabel
            sx={{ mt: 1, "& .MuiFormControlLabel-label": { fontSize: 13 } }}
            control={
              <Checkbox
                size="small"
                color="warning"
                checked={notHere}
                onChange={(e) => setNotHere(e.target.checked)}
              />
            }
            label={
              <>
                It does not belong under {shortText(under, 40)}{" "}
                <Box component="span" sx={{ color: "text.secondary" }}>
                  — you will be asked where it goes
                </Box>
              </>
            }
          />
        )}
        <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            color="error"
            variant="contained"
            disableElevation
            disabled={!reason && !notHere}
            sx={{ borderRadius: "8px", px: 2 }}
            onClick={() =>
              decide(p, "rejected", {
                reason: reason || (notHere ? "Does not belong here" : ""),
                doesNotBelong: notHere,
              })
            }
          >
            Reject
          </Button>
          <Button size="small" color="inherit" onClick={onCancel}>
            Cancel
          </Button>
        </Stack>
      </Box>
    );
  };

  // ---------- editor ----------
  const Editor = ({ p }: { p: AlgorithmProposal }) => {
    // The React Flow editor works on the platform's algorithm tree; the
    // proposal's steps are re-derived from it on save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const initial = useMemo(() => algorithmOf(p), [p.id, p.status]);
    const [alg, setAlg] = useState<IAlgorithm>(initial);
    const [rejecting, setRejecting] = useState(false);
    const derived = algorithmToProposal(alg);
    const changed =
      derived.steps.map((s) => s.id).join() !==
        p.steps.map((s) => s.id).join() || derived.kind !== p.flowKind;
    // Activities a step can point to: the proposal's own steps plus the
    // activities loaded so far.
    const partOptions: PartOption[] = (() => {
      const ids = new Set<string>();
      for (const s of [...p.steps, ...derived.steps]) ids.add(s.id);
      for (const n of [...Object.values(nodes), ...Object.values(relatedNodes)])
        if (n.nodeType === "activity" && ids.size < 400) ids.add(n.id);
      ids.delete(p.nodeId);
      return [...ids]
        .map((id) => ({ id, title: titleOf(id) }))
        .sort((x, y) => x.title.localeCompare(y.title));
    })();
    const close = () => {
      setEditing(null);
      setRejectFor(null);
    };
    return (
      <Box>
        <Box sx={{ my: 1 }}>
          <ReactFlowProvider>
            <AlgorithmFlowVisualizer
              algorithm={alg}
              isDarkMode={dark}
              editing
              parts={partOptions}
              onChange={setAlg}
            />
          </ReactFlowProvider>
        </Box>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <InlineFlow algorithm={alg} dark={dark} titleOf={titleOf} />
          {derived.unbound.length > 0 && (
            <Tag k="warn">
              {derived.unbound.length} step
              {derived.unbound.length > 1 ? "s" : ""} not linked to an activity
            </Tag>
          )}
        </Stack>
        {rejecting && (
          <Box sx={{ mt: 2 }}>
            <RejectPanel p={p} onCancel={() => setRejecting(false)} />
          </Box>
        )}
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="success"
            size="small"
            disableElevation
            onClick={() =>
              decide(p, changed ? "edited" : "accepted", {
                steps: derived.steps,
                kind: derived.kind,
                algorithm: alg,
              })
            }
          >
            Save and accept
          </Button>
          <Button
            color="error"
            size="small"
            disabled={rejecting}
            onClick={() => setRejecting(true)}
          >
            Reject…
          </Button>
          <Button size="small" color="inherit" onClick={close}>
            Close
          </Button>
        </Stack>
      </Box>
    );
  };

  const OutcomeControls = ({ p }: { p: AlgorithmProposal }) => {
    if (p.status !== "pending")
      return (
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{ textAlign: "right" }}>
            <Tag k={p.status === "rejected" ? "bad" : "ok"}>
              {OUTCOME_LABEL[p.status]}
            </Tag>
            {p.decision?.reason && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                title={p.decision.reason}
                sx={{ maxWidth: 260 }}
              >
                {shortText(p.decision.reason, 60)}
              </Typography>
            )}
          </Box>
          <Button size="small" color="inherit" onClick={() => undecide(p)}>
            Undo
          </Button>
        </Stack>
      );
    const open = editing === p.nodeId;
    return (
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Button
          size="small"
          color="inherit"
          sx={{ mr: 1 }}
          onClick={() => {
            setEditing(open ? null : p.nodeId);
            setRejectFor(null);
          }}
        >
          {open ? "Close" : "Edit"}
        </Button>
        <Button
          size="small"
          variant="contained"
          color="success"
          disableElevation
          sx={{ borderRadius: "8px", px: 2 }}
          onClick={() => decide(p, "accepted")}
        >
          Accept
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          sx={{ borderRadius: "8px", px: 2 }}
          onClick={() => {
            setRejectFor(rejectFor === p.nodeId ? null : p.nodeId);
            setEditing(null);
          }}
        >
          Reject
        </Button>
      </Stack>
    );
  };

  // ---------- the family's state (hooks before the early returns) ----------
  const withProposal = rows.filter((r) => r.proposal);
  const accepted = withProposal.filter(
    (r) =>
      r.proposal &&
      (r.proposal.status === "accepted" || r.proposal.status === "edited"),
  );
  const rejectedCount = withProposal.filter(
    (r) => r.proposal?.status === "rejected",
  ).length;
  const pending = total - decided;
  const reviewed = total > 0 && pending === 0;
  const needsPlacing = withProposal.some(
    (r) => r.proposal?.decision?.doesNotBelong && !r.proposal.decision.movedTo,
  );
  const parentProposal = algorithms[nodeId] as AlgorithmProposal | undefined;
  const derived =
    reviewed && accepted.length
      ? deriveParentFlow(
          currentVisibleNode.title,
          accepted.map((r) => algorithmOf(r.proposal as AlgorithmProposal)),
          titleOf,
        )
      : null;
  const derivedSig = derived ? flowSignature(derived.algorithm) : "";
  // Only a parent flow that was built from the children can go stale; one
  // the generator wrote is reviewed as it is.
  const stale =
    !!parentProposal &&
    !!parentProposal.derived &&
    parentProposal.status === "pending" &&
    !!derived &&
    flowSignature(algorithmOf(parentProposal)) !== derivedSig;

  // The parent's proposal is written once every child is reviewed.
  const wantPropose = reviewed && !!derived && !parentProposal;
  useEffect(() => {
    if (wantPropose && derived)
      propose(
        derived.algorithm,
        accepted.map((r) => r.id),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPropose]);
  // The other families, loaded once something needs placing.
  useEffect(() => {
    if (!needsPlacing || families || loading) return;
    let cancelled = false;
    Post<{ families: Family[] }>("/review/proposals", {
      action: "families",
      appName: app,
      excludeParentId: nodeId,
    })
      .then((res) => {
        if (!cancelled) setFamilies(res.families || []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setFamilies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsPlacing, families, loading, app, nodeId]);

  // ---------- leaf: its own proposal ----------
  if (loading) return <LinearProgress sx={{ my: 2 }} />;
  if (!isFamily) {
    const p = algorithms[nodeId];
    const parent = currentVisibleNode.generalizations.flatMap(
      (c) => c.nodes,
    )[0];
    return (
      <Section title={<Typography sx={T.title}>Algorithm proposal</Typography>}>
        {!p ? (
          <Typography color="text.secondary">
            No proposal has been generated for this activity.
          </Typography>
        ) : (
          <>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <OutcomeControls p={p} />
              {parent && (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => navigateToNode(parent.id)}
                >
                  See all proposals under “
                  {shortText(parent.title || titleOf(parent.id), 40)}”
                </Button>
              )}
            </Stack>
            {rejectFor === nodeId && (
              <Box sx={{ mb: 2 }}>
                <RejectPanel p={p} onCancel={() => setRejectFor(null)} />
              </Box>
            )}
            <Editor p={p} />
          </>
        )}
      </Section>
    );
  }

  // ---------- family: three stacked cards ----------
  const accentOf = (p?: AlgorithmProposal) =>
    !p || p.status === "pending"
      ? undefined
      : p.status === "rejected"
        ? colors.bad
        : colors.ok;
  const proposalOf = (row: AlignedRow) =>
    row.id === nodeId ? parentProposal : algorithms[row.id];
  const moveOut = withProposal.filter(
    (r) => r.proposal?.decision?.doesNotBelong,
  );
  const unplaced = moveOut.filter((r) => !r.proposal?.decision?.movedTo);

  // Open the card the work is at, unless the reviewer chose otherwise.
  const autoOpen = !reviewed ? 1 : unplaced.length ? 2 : 3;
  const openSet = manualOpen ?? new Set([autoOpen]);
  const toggle = (n: number) =>
    setManualOpen((prev) => {
      const next = new Set(prev ?? openSet);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  // A plain function, not a component: a component defined here would be a
  // new type on every render and remount the editor inside it.
  const stackCard = ({
    n,
    name,
    summary,
    disabled,
    extra,
    children,
  }: {
    n: number;
    name: string;
    summary?: React.ReactNode;
    disabled?: boolean;
    /** Controls on the right of the header (not part of the toggle). */
    extra?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    const open = openSet.has(n) && !disabled;
    return (
      <Paper elevation={0} sx={{ ...cardSx, opacity: disabled ? 0.55 : 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            pl: 2.5,
            pr: 1.5,
            minHeight: 48,
            borderBottom: open ? "1px solid" : 0,
            borderColor: line,
          }}
        >
          <Box
            component="button"
            type="button"
            disabled={disabled}
            onClick={() => toggle(n)}
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              py: 1.25,
              border: 0,
              bgcolor: "transparent",
              color: "text.primary",
              fontFamily: "inherit",
              textAlign: "left",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                bgcolor: open ? "primary.main" : dark ? "#2a2b2d" : "#e9ecef",
                color: open ? "#fff" : "text.secondary",
              }}
            >
              {n}
            </Box>
            <Typography sx={T.title}>{name}</Typography>
            {summary && (
              <Typography
                sx={{ ...T.text, color: "text.secondary", minWidth: 0 }}
                noWrap
              >
                {summary}
              </Typography>
            )}
          </Box>
          {open && extra}
          {!disabled && (
            <Box
              component="button"
              type="button"
              aria-label={open ? "Collapse" : "Expand"}
              onClick={() => toggle(n)}
              sx={{
                border: 0,
                bgcolor: "transparent",
                color: "text.secondary",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                borderRadius: "8px",
                "&:hover": { bgcolor: dark ? "#2a2b2d" : "#f0f2f4" },
              }}
            >
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  transition: "transform 150ms",
                  transform: open ? "rotate(180deg)" : "none",
                }}
              />
            </Box>
          )}
        </Box>
        {open && children}
      </Paper>
    );
  };

  const flowsSummary =
    total === 0
      ? "no proposals yet"
      : reviewed
        ? `${total} of ${total} reviewed · ${accepted.length} accepted, ${rejectedCount} rejected`
        : `${decided} of ${total} reviewed`;
  const moveSummary = !moveOut.length
    ? "empty until a rejected flow is marked as not belonging here"
    : unplaced.length
      ? `${unplaced.length} activit${unplaced.length === 1 ? "y" : "ies"} to place`
      : moveOut.length === 1
        ? `moving to ${moveOut[0].proposal?.decision?.movedTo?.title || "…"}`
        : `${moveOut.length} activities placed`;
  const parentSummary = !reviewed
    ? "available once every flow above is reviewed"
    : !accepted.length
      ? "needs at least one accepted flow to build from"
      : parentProposal && parentProposal.status !== "pending"
        ? OUTCOME_LABEL[parentProposal.status]
        : `built from the ${accepted.length} accepted flow${accepted.length === 1 ? "" : "s"} above`;
  const legend = (text: string) => (
    <Typography
      sx={{
        ...T.small,
        color: "text.secondary",
        px: 2.5,
        py: 1.25,
        borderTop: "1px solid",
        borderColor: line,
      }}
    >
      {text}
    </Typography>
  );

  const childRows: AlignedRow[] = [...rows]
    // children without a proposal go last
    .sort((x, y) => Number(!x.proposal) - Number(!y.proposal))
    .map((r) => ({
      id: r.id,
      title: r.title,
      algorithm: r.proposal ? algorithmOf(r.proposal) : null,
      accent: accentOf(r.proposal),
      active: editing === r.id,
      counted: r.proposal?.status !== "rejected",
      note: r.proposal?.decision?.doesNotBelong ? (
        <Box
          component="span"
          sx={{
            color: r.proposal.decision.movedTo ? colors.ok : colors.warn,
          }}
        >
          {r.proposal.decision.movedTo
            ? `Moving to ${r.proposal.decision.movedTo.title}`
            : "Does not belong here · see Move out"}
        </Box>
      ) : undefined,
    }));
  const parentRow: AlignedRow | null =
    reviewed && derived && parentProposal
      ? {
          id: nodeId,
          title: currentVisibleNode.title,
          algorithm: algorithmOf(parentProposal),
          pinned: true,
          accent: accentOf(parentProposal) || "#1976d2",
          active: editing === nodeId,
          note: `Built from the ${derived.total} accepted flow${derived.total === 1 ? "" : "s"}`,
        }
      : null;
  const doers = highlight
    ? accepted.filter((r) =>
        algorithmToProposal(
          algorithmOf(r.proposal as AlgorithmProposal),
        ).steps.some((s) => s.id === highlight),
      )
    : [];
  const lineSx = { ...T.label, pt: "2px" };
  const lineText = { ...T.text, color: "text.secondary" };

  return (
    <Box>
      {/* 1. The children's flows */}
      {stackCard({
        n: 1,
        name: `Specializations of ${currentVisibleNode.title}`,
        summary: flowsSummary,
        extra:
          total > 1 ? (
            <Segmented
              value={aligned ? "aligned" : "flow"}
              onChange={(v) => setAligned(v === "aligned")}
              options={[
                {
                  value: "flow",
                  label: "Flow",
                  hint: "Each flow from the left",
                },
                {
                  value: "aligned",
                  label: "Line up",
                  hint: "One column per task the flows share",
                },
              ]}
            />
          ) : null,
        children: (
          <>
            {total === 0 ? (
              <Typography
                sx={{ ...T.text, color: "text.secondary", px: 2.5, py: 2.5 }}
              >
                No proposals have been generated for these specializations yet.
              </Typography>
            ) : (
              <AlignedFlows
                dark={dark}
                titleOf={titleOf}
                aligned={aligned}
                highlightKey={highlight}
                rows={childRows}
                onTitleClick={(row) =>
                  proposalOf(row)
                    ? setEditing(editing === row.id ? null : row.id)
                    : navigateToNode(row.id)
                }
                renderActions={(row) => {
                  const p = proposalOf(row);
                  if (p) return <OutcomeControls p={p} />;
                  const r = rows.find((x) => x.id === row.id);
                  return r?.isFamily ? (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => navigateToNode(row.id)}
                    >
                      Open its specializations
                    </Button>
                  ) : null;
                }}
                renderBelow={(row) => {
                  const p = proposalOf(row);
                  if (!p) return null;
                  if (editing === row.id) return <Editor p={p} />;
                  if (rejectFor === row.id)
                    return (
                      <RejectPanel p={p} onCancel={() => setRejectFor(null)} />
                    );
                  return null;
                }}
              />
            )}
            {total > 0 &&
              legend(
                aligned
                  ? "Columns are the tasks that two or more flows share, in their usual order. Green counts are tasks done by at least half of the flows, so they go into the generalization. Switch to Flow to see loops, conditions and the steps only one flow has."
                  : "Tinted steps are tasks that two or more flows share. Click a title to open the editor.",
              )}
          </>
        ),
      })}

      {/* 2. Rejected as "does not belong": where do they go */}
      {stackCard({
        n: 2,
        name: "Move out",
        summary: moveSummary,
        disabled: moveOut.length === 0,
        children:
          moveOut.length === 0 ? (
            <Typography
              sx={{ ...T.text, color: "text.secondary", px: 2.5, py: 2.5 }}
            >
              Nothing to move. Rejecting a flow with “It does not belong under{" "}
              {currentVisibleNode.title}” lists the activity here.
            </Typography>
          ) : (
            <AlignedFlows
              dark={dark}
              titleOf={titleOf}
              heading="Activity"
              actionsHeading="Where to"
              rows={moveOut.map((r) => {
                const d = r.proposal?.decision;
                return {
                  id: r.id,
                  title: r.title,
                  algorithm: algorithmOf(r.proposal as AlgorithmProposal),
                  accent: d?.movedTo ? colors.ok : colors.bad,
                  counted: false,
                  note: d?.movedTo ? (
                    <Box component="span" sx={{ color: colors.ok }}>
                      Moving to {d.movedTo.title || titleOf(d.movedTo.id)}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ color: colors.bad }}>
                      Rejected{d?.reason ? ` · ${d.reason}` : ""}
                    </Box>
                  ),
                };
              })}
              onTitleClick={(row) => navigateToNode(row.id)}
              renderActions={(row) => {
                const p = algorithms[row.id];
                if (!p) return null;
                return p.decision?.movedTo ? (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => place(p, null, true)}
                  >
                    Undo
                  </Button>
                ) : null;
              }}
              renderBelow={(row) => {
                const p = algorithms[row.id];
                if (!p || p.decision?.movedTo) return null;
                return (
                  <PlacePanel
                    proposal={p}
                    title={row.title}
                    parentId={nodeId}
                    parentTitle={currentVisibleNode.title}
                    families={families}
                    dark={dark}
                    searchWithFuse={searchWithFuse}
                    onPlace={place}
                    navigateToNode={navigateToNode}
                  />
                );
              }}
            />
          ),
      })}

      {/* 3. The parent's own flow, from the accepted ones */}
      {stackCard({
        n: 3,
        name: `Flow for ${currentVisibleNode.title}`,
        summary: parentSummary,
        disabled: !reviewed || !accepted.length,
        children: (
          <>
            {!parentRow || !derived ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : (
              <>
                <AlignedFlows
                  dark={dark}
                  titleOf={titleOf}
                  heading="Generalization"
                  rows={[parentRow]}
                  onTitleClick={() =>
                    setEditing(editing === nodeId ? null : nodeId)
                  }
                  renderActions={() =>
                    parentProposal ? (
                      <OutcomeControls p={parentProposal} />
                    ) : null
                  }
                  renderBelow={() => {
                    if (!parentProposal) return null;
                    if (editing === nodeId)
                      return <Editor p={parentProposal} />;
                    if (rejectFor === nodeId)
                      return (
                        <RejectPanel
                          p={parentProposal}
                          onCancel={() => setRejectFor(null)}
                        />
                      );
                    return null;
                  }}
                />
                <Box
                  sx={{
                    px: 2.5,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: line,
                    display: "grid",
                    gridTemplateColumns: "96px minmax(0, 1fr)",
                    rowGap: 1.25,
                    columnGap: 2,
                    alignItems: "baseline",
                  }}
                >
                  {stale && (
                    <>
                      <Typography sx={{ ...lineSx, color: colors.warn }}>
                        Changed
                      </Typography>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Typography sx={lineText}>
                          The accepted flows changed since this was built.
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          sx={{ borderRadius: "8px" }}
                          onClick={() =>
                            propose(
                              derived.algorithm,
                              accepted.map((r) => r.id),
                            )
                          }
                        >
                          Rebuild
                        </Button>
                      </Stack>
                    </>
                  )}
                  <Typography sx={lineSx}>Left out</Typography>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.75,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {derived.leftOut.length ? (
                      derived.leftOut.map((x) => {
                        const on = highlight === x.id;
                        return (
                          <Box
                            key={x.id}
                            component="button"
                            type="button"
                            aria-pressed={on}
                            title={`${titleOf(x.id)}: in ${x.count} of ${derived.total} accepted flows. Click to see which.`}
                            onClick={() => {
                              setHighlight(on ? null : x.id);
                              if (!on) setCompare(true);
                            }}
                            sx={{
                              display: "inline-flex",
                              alignItems: "baseline",
                              gap: 0.5,
                              px: 1,
                              py: 0.25,
                              borderRadius: "7px",
                              border: 0,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 12,
                              color: "text.primary",
                              bgcolor: dark ? "#2a2b2d" : "#eef1f4",
                              whiteSpace: "nowrap",
                              boxShadow: on
                                ? `0 0 0 2px ${colors.warn}`
                                : "none",
                            }}
                          >
                            {titleOf(x.id)}
                            <Box
                              component="span"
                              sx={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: "text.secondary",
                              }}
                            >
                              {x.count}/{derived.total}
                            </Box>
                          </Box>
                        );
                      })
                    ) : (
                      <Typography sx={lineText}>
                        nothing — every task made it
                      </Typography>
                    )}
                  </Box>
                  {highlight && (
                    <>
                      <Box />
                      <Stack
                        direction="row"
                        alignItems="center"
                        gap={1.5}
                        flexWrap="wrap"
                        sx={{
                          ...T.text,
                          color: colors.warn,
                          bgcolor: colors.warnBg,
                          borderRadius: "8px",
                          px: 1.25,
                          py: 0.75,
                          width: "fit-content",
                        }}
                      >
                        <span>
                          {doers.length} of the {derived.total} accepted flows
                          do <b>{titleOf(highlight)}</b>:{" "}
                          {doers.map((d) => shortText(d.title, 40)).join("; ")}.
                          {doers.length > 1
                            ? ` They could share a new specialization under ${currentVisibleNode.title}.`
                            : ""}
                        </span>
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => setHighlight(null)}
                        >
                          Clear
                        </Button>
                      </Stack>
                    </>
                  )}
                  <Typography sx={lineSx}>Compare</Typography>
                  <Typography
                    sx={{
                      ...T.text,
                      color: "primary.main",
                      cursor: "pointer",
                      width: "fit-content",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.25,
                    }}
                    onClick={() => setCompare(!compare)}
                  >
                    {compare ? "Hide" : "Show"} the {derived.total} flows lined
                    up with this one
                    <ExpandMoreIcon
                      fontSize="small"
                      sx={{
                        transition: "transform 150ms",
                        transform: compare ? "rotate(180deg)" : "none",
                      }}
                    />
                  </Typography>
                </Box>
                {compare && (
                  <Box sx={{ borderTop: "1px solid", borderColor: line }}>
                    <AlignedFlows
                      dark={dark}
                      titleOf={titleOf}
                      aligned
                      highlightKey={highlight}
                      heading="Where each step comes from"
                      actionsHeading=""
                      rows={[
                        ...childRows.filter((r) =>
                          accepted.some((a) => a.id === r.id),
                        ),
                        { ...parentRow, active: false },
                      ]}
                      onTitleClick={(row) =>
                        row.id !== nodeId && navigateToNode(row.id)
                      }
                      renderActions={() => null}
                    />
                  </Box>
                )}
              </>
            )}
          </>
        ),
      })}
    </Box>
  );
};

export default ProposalReview;
