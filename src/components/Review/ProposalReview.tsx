import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import { IAlgorithm, INode } from "@components/types/INode";
import { User } from "@components/types/IAuth";
import {
  AlgorithmProposal,
  FlowKind,
  PartsInheritance,
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
  applyPartsToAlgorithm,
  proposalToAlgorithm,
} from "@components/lib/review/algorithmBridge";
import AlignedFlows, { AlignedRow } from "./AlignedFlows";
import FlowTrack, { PickedTask } from "./FlowTrack";
import InfluenceList from "./InfluenceList";
import PartsEditor from "./PartsEditor";
import { SearchBox } from "../SearchBox/SearchBox";
import ExpandSearchResult from "../OntologyComponents/ExpandSearchResult";
import PlacePanel, { underOf } from "./PlacePanel";
import SaveBar from "./SaveBar";
import InheritedPartsViewer, {
  PreviewRow,
} from "../StructuredProperty/InheritedPartsViewer";
import { inheritanceOf } from "@components/lib/review/partsInheritance";
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

// How long the demo "Regenerate with AI" pretends to work before it
// rebuilds the flow by rule.
const REBUILD_DEMO_MS = 900;
const REASONS = ["Wrong step", "Missing step", "Not enough evidence", "Other"];
// Said on what is blocked while the step on screen has unsaved changes.
const SAVE_FIRST = "Save your changes first";
// Where step 2 remembers, in this browser, whether its Flow card is open.
const PLACE_FLOW_KEY = "review.placeFlow";
// Where this browser remembers what it reviews: parts or flows.
const FOCUS_KEY = "review.focus";
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
// What of a proposal a reviewer sets in steps 1 and 3: its answer and flow.
const answerOf = (d: ReviewDoc) =>
  JSON.stringify([
    d.status,
    d.decision && [
      d.decision.steps,
      d.decision.kind,
      d.decision.algorithm,
      d.decision.reason,
      !!d.decision.doesNotBelong,
    ],
  ]);
// The proposals that differ from what is stored, and how many changes that
// is: one for an answer or a flow, one for each generalization linked or
// unlinked. An activity not yet placed counts as under `home`.
const unsavedIn = (docs: ReviewDoc[], stored: ReviewDoc[], home: string) => {
  const before = new Map(stored.map((d) => [d.id, d]));
  const list: ReviewDoc[] = [];
  let count = 0;
  for (const d of docs) {
    const was = before.get(d.id);
    if (!was) continue;
    if (answerOf(d) !== answerOf(was)) {
      list.push(d);
      count++;
      continue;
    }
    const ids = (x: ReviewDoc) =>
      (underOf(x) ?? [{ id: home }]).map((u) => u.id);
    const [a, b] = [ids(d), ids(was)];
    const n =
      a.filter((id) => !b.includes(id)).length +
      b.filter((id) => !a.includes(id)).length;
    if (n) list.push(d);
    count += n;
  }
  return { list, count };
};
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

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
  const app = appName || "";
  const nodeId = currentVisibleNode.id;

  // The proposals as on screen, and as stored: an edit changes the first
  // only, until the step is saved.
  const [docs, setDocs] = useState<ReviewDoc[]>([]);
  const [stored, setStored] = useState<ReviewDoc[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  // The step asked for while this one has unsaved changes.
  const [leaveFor, setLeaveFor] = useState<number | null>(null);
  const [nodes, setNodes] = useState<{ [id: string]: INode }>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  // The step on screen: set to the step the work is at when the proposals
  // load, and from there wherever the reviewer goes.
  const [stage, setStage] = useState<number | null>(null);
  // The furthest step the reviewer has been on in this visit: a step they
  // have not opened yet gets no check, even if it needs nothing.
  const [reached, setReached] = useState(0);
  useEffect(
    () => setReached((r) => (stage === null ? 0 : Math.max(r, stage))),
    [stage],
  );
  const [view, setView] = useState<"flow" | "lineup">("flow");
  // What is reviewed: each activity's parts, or the flow they run in. A
  // family at the parts stage shows parts; the small switch under the step
  // bar overrides that, and this browser remembers the choice.
  const [focus, setFocusState] = useState<"flow" | "parts">("flow");
  const parts = focus === "parts";
  const setFocus = (f: "flow" | "parts") => {
    setFocusState(f);
    try {
      window.localStorage.setItem(FOCUS_KEY, f);
    } catch {
      // storage is blocked: the choice holds for this visit only
    }
  };
  // The word for what is reviewed, where the screen names it.
  const w = parts
    ? { flow: "parts", flows: "parts" }
    : { flow: "flow", flows: "flows" };
  // The rows to list, by decision; one choice for both views.
  const [filter, setFilter] = useState("all");
  // The "?" of the step bar: a few lines about the step on screen.
  const [help, setHelp] = useState(false);
  // The step of the parent's flow whose support is shown beside it.
  const [evidence, setEvidence] = useState<PickedTask | null>(null);
  // Step 3: the accepted flow whose parts are marked in the flow above.
  const [influenceOf, setInfluenceOf] = useState<string | null>(null);
  // Step 3, parts: the specialization whose inheritance is previewed, and
  // the search for an activity to add as a generalized part.
  const [previewOf, setPreviewOf] = useState<string | null>(null);
  const [partQuery, setPartQuery] = useState("");
  // Step 3's "Regenerate with AI" is a demo: no LLM is called yet. It waits
  // a moment, then rebuilds the flow from the accepted flows by rule.
  const [rebuilding, setRebuilding] = useState(false);
  const rebuildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rebuildTimer.current) clearTimeout(rebuildTimer.current);
    },
    [],
  );
  // On a phone the step bar scrolls sideways: keep the current step in it.
  const stepNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = stepNavRef.current;
    const on = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && on && nav.scrollWidth > nav.clientWidth)
      nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
  }, [stage]);
  // Step 2: the rejected activity whose generalizations are on screen, and
  // whether its flow is shown, which holds from one activity to the next.
  const [placeFor, setPlaceFor] = useState<string | null>(null);
  // Open unless this browser last left it closed.
  const [placeFlow, setPlaceFlowState] = useState(() => {
    try {
      return window.localStorage.getItem(PLACE_FLOW_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const setPlaceFlow = (open: boolean) => {
    setPlaceFlowState(open);
    try {
      window.localStorage.setItem(PLACE_FLOW_KEY, open ? "open" : "closed");
    } catch {
      // storage is blocked: the choice holds for this visit only
    }
  };

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

  // Step 1's default answer: a specialization nobody answered belongs here.
  const withDefaults = (list: ReviewDoc[]) =>
    isFamily
      ? list.map((d) =>
          d.kind === "algorithm" &&
          d.nodeId !== nodeId &&
          d.status === "pending"
            ? ({
                ...d,
                status: "accepted",
                decision: { outcome: "accepted", by: user?.uname },
              } as ReviewDoc)
            : d,
        )
      : list;
  // Load the children, their proposals, and the activities the steps point to.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setEditing(null);
      setRejectFor(null);
      setStage(null);
      setSaveState("idle");
      setLeaveFor(null);
      setPlaceFor(null);
      setInfluenceOf(null);
      setPreviewOf(null);
      setPartQuery("");
      setEvidence(null);
      const ids = isFamily ? childLinks.map((c) => c.id) : [nodeId];
      const got: { [id: string]: INode } = {};
      await Promise.all(
        ids.map(async (id) => {
          const n = relatedNodes[id] || (await fetchNode(id));
          if (n) got[id] = n;
        }),
      );
      const got_ = await Post<{ proposals: ReviewDoc[] }>("/review/proposals", {
        action: "list",
        appName: app,
        nodeIds: [...ids, nodeId],
        parentId: nodeId,
      });
      // A proposal belongs to the family its parentId names: a child's
      // proposal that is the top of its own review (no parent) is not
      // reviewed here.
      const res = {
        proposals: got_.proposals.filter(
          (d) => d.nodeId === nodeId || d.parentId === nodeId,
        ),
      };
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
      // Open on the step the work is at; from there the reviewer moves.
      const kids = res.proposals.filter(
        (d) => d.kind === "algorithm" && d.nodeId !== nodeId,
      );
      const allDecided =
        kids.length > 0 && kids.every((d) => isDecided(d.status));
      const toPlace = kids.some(
        (d) => d.decision?.doesNotBelong && !underOf(d)?.length,
      );
      setStage(!allDecided ? 1 : toPlace ? 2 : 3);
      let chosen: string | null = null;
      try {
        chosen = window.localStorage.getItem(FOCUS_KEY);
      } catch {
        chosen = null;
      }
      setFocusState(
        chosen === "parts" || chosen === "flow"
          ? chosen
          : res.proposals.some((d) => d.stage === "parts")
            ? "parts"
            : "flow",
      );
      setNodes(got);
      // An unanswered specialization starts on Yes; it is stored as
      // unanswered until the step is saved.
      setDocs(withDefaults(res.proposals));
      setStored(res.proposals);
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
  // A task's generalizations, nearest first: its direct ones, then the rest
  // of its path to the root.
  const algorithms = useMemo(() => {
    const m: { [nodeId: string]: AlgorithmProposal } = {};
    for (const d of docs) if (d.kind === "algorithm") m[d.nodeId] = d;
    return m;
  }, [docs]);
  const stepsOf = (p: AlgorithmProposal) => p.decision?.steps || p.steps;
  // Placed while it is under a generalization: until the reviewer acts
  // that is this node, so only one unlinked from everything waits.
  const placedUnder = (p?: AlgorithmProposal | null) =>
    underOf(p)?.length !== 0;
  const kindOf = (p: AlgorithmProposal) => p.decision?.kind || p.flowKind;
  // A part's generalizations, nearest first, as far as the loaded nodes go.
  const ancestorsOf = useCallback(
    (id: string) => {
      const out: string[] = [];
      const queue = [id];
      while (queue.length && out.length < 50) {
        const n = nodes[queue[0]] || relatedNodes[queue[0]];
        queue.shift();
        for (const c of n?.generalizations || [])
          for (const g of c.nodes)
            if (g.id !== id && !out.includes(g.id)) {
              out.push(g.id);
              queue.push(g.id);
            }
      }
      return out;
    },
    [nodes, relatedNodes],
  );
  // How each accepted specialization inherits the generalized parts `gen`:
  // what the generation returns, and what the decision stores.
  const inheritanceFor = (gen: ProposalStep[]): PartsInheritance =>
    inheritanceOf(
      gen,
      Object.values(algorithms)
        .filter(
          (d) =>
            d.nodeId !== nodeId &&
            (d.status === "accepted" || d.status === "edited"),
        )
        .map((d) => ({ id: d.nodeId, steps: stepsOf(d) })),
      ancestorsOf,
    );

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
  // A decision is made on screen; saving the step writes it.
  const decide = (
    p: AlgorithmProposal,
    outcome: ProposalOutcome,
    extra: {
      steps?: ProposalStep[];
      kind?: FlowKind;
      reason?: string;
      algorithm?: IAlgorithm;
      inheritance?: PartsInheritance;
      doesNotBelong?: boolean;
    } = {},
  ) => {
    const decision = {
      outcome,
      ...extra,
      ...(extra.doesNotBelong ? { under: null } : {}),
      by: user?.uname,
      at: new Date(),
    };
    patchDoc(p.id, { status: outcome, decision });
    setEditing(null);
    setRejectFor(null);
  };
  const undecide = (p: AlgorithmProposal) =>
    patchDoc(p.id, { status: "pending", decision: null });

  // The generalizations a rejected activity should be under (recorded only;
  // the hierarchy is not changed).
  const place = (
    p: AlgorithmProposal,
    under: { id: string; title: string }[],
  ) => {
    if (!p.decision) return;
    // It stays on screen once it has a place, until another is picked.
    setPlaceFor((f) => f ?? p.nodeId);
    patchDoc(p.id, { decision: { ...p.decision, under } });
  };

  // What the step on screen changed and has not saved.
  const unsaved = useMemo(
    () => unsavedIn(docs, stored, nodeId),
    [docs, stored, nodeId],
  );
  const dirty = unsaved.count > 0;
  // Every unsaved change, in one request. True once it is stored.
  const save = async (sent: ReviewDoc[] = docs) => {
    const changed = sent === docs ? unsaved : unsavedIn(sent, stored, nodeId);
    if (!changed.count || saveState === "saving") return false;
    setSaveState("saving");
    try {
      await Post("/review/proposals", {
        action: "save",
        appName: app,
        changes: changed.list.map((d) => ({
          proposalId: d.id,
          outcome: d.status === "pending" ? null : d.status,
          steps: d.decision?.steps,
          kind: d.decision?.kind,
          reason: d.decision?.reason,
          algorithm: d.decision?.algorithm,
          inheritance: d.decision?.inheritance,
          doesNotBelong: d.decision?.doesNotBelong,
          under: d.decision?.under,
        })),
      });
      setStored(sent);
      setSaveState("idle");
      return true;
    } catch (e) {
      console.error(e);
      setSaveState("error");
      return false;
    }
  };
  const discard = () => {
    setDocs(withDefaults(stored));
    setSaveState("idle");
    setEditing(null);
    setRejectFor(null);
  };
  // Ctrl or Cmd with S saves; closing the tab with unsaved changes asks.
  const saveRef = useRef<() => unknown>(save);
  saveRef.current = () => save();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const ask = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);
  // The parent's flow, built from its accepted specializations, written as a
  // pending proposal of its own.
  const propose = async (algorithm: IAlgorithm, from: string[]) => {
    const { steps, kind } = algorithmToProposal(algorithm);
    try {
      const res = await Post<{ ok: boolean; proposal?: ReviewDoc }>(
        "/review/proposals",
        {
          action: "propose",
          appName: app,
          nodeId,
          nodeTitle: currentVisibleNode.title,
          // the top of its review: no family above takes it up
          parentId: null,
          algorithm,
          steps,
          kind,
          from,
          inheritance: inheritanceFor(steps),
        },
      );
      if (res.ok && res.proposal) {
        const doc = res.proposal;
        // written already: it is no unsaved change
        setDocs((prev) => [...prev.filter((d) => d.id !== doc.id), doc]);
        setStored((prev) => [...prev.filter((d) => d.id !== doc.id), doc]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- presentation helpers ----------
  // One faint neutral line for the dividers inside a panel, and a slightly
  // stronger one around a panel, so it does not blend into the page.
  const line = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const colors = {
    ok: dark ? "#8fd7ad" : "#2a8a5c",
    warn: dark ? "#e9bf6b" : "#8d5a0d",
    bad: dark ? "#e39b85" : "#b3401f",
  };
  // The tree the canvas edits; built from the steps when none was stored.
  const algorithmOf = (p: AlgorithmProposal): IAlgorithm =>
    p.decision?.algorithm ||
    p.algorithm ||
    proposalToAlgorithm(titleOf(p.nodeId), stepsOf(p), kindOf(p), p.flowNote);
  const edge = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)";
  const cardSx = {
    borderRadius: "12px",
    overflow: "hidden",
    border: `1px solid ${edge}`,
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
  const RejectPanel = ({ p }: { p: AlgorithmProposal }) => {
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
          border: `1px solid ${line}`,
          borderRadius: "8px",
          p: "16px",
        }}
      >
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
              borderRadius: "6px !important",
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
              <span title={under}>
                It does not belong under {shortText(under, 40)}
              </span>
            }
          />
        )}
        {under && (
          <Typography sx={{ ...T.small, color: "text.secondary", ml: 3.5 }}>
            It moves to Reorganize specializations; its{" "}
            {parts ? "parts stay" : "flow stays"} rejected.
          </Typography>
        )}
        <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            disableElevation
            disabled={!reason && !notHere}
            sx={{
              ...filledSx(gh.red, gh.redHover),
              "&.Mui-disabled": {
                color: "#fff",
                bgcolor: gh.red,
                opacity: 0.5,
              },
            }}
            onClick={() =>
              decide(p, "rejected", {
                reason: reason || (notHere ? "Does not belong here" : ""),
                doesNotBelong: notHere,
              })
            }
          >
            Reject
          </Button>
        </Stack>
      </Box>
    );
  };

  // ---------- editor ----------
  // Reviewing parts, a plain parts list works on the proposal's parts;
  // reviewing flows, the React Flow canvas works on its tree.
  const Editor = ({ p }: { p: AlgorithmProposal }) => {
    if (!parts) return <FlowEditor p={p} />;
    return (
      <PartsEditor
        nodeId={p.nodeId}
        steps={stepsOf(p)}
        titleOf={titleOf}
        searchWithFuse={searchWithFuse}
        onSave={(steps, changed) =>
          decide(p, changed ? "edited" : "accepted", {
            steps,
            kind: kindOf(p),
            ...(p.nodeId === nodeId
              ? { inheritance: inheritanceFor(steps) }
              : {}),
            // a flow, when there is one, keeps its shape around the new parts
            ...(p.algorithm || p.decision?.algorithm
              ? { algorithm: applyPartsToAlgorithm(algorithmOf(p), steps) }
              : {}),
          })
        }
        onClose={() => setEditing(null)}
      />
    );
  };
  const FlowEditor = ({ p }: { p: AlgorithmProposal }) => {
    // The React Flow editor works on the platform's algorithm tree; the
    // proposal's steps are re-derived from it on save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const initial = useMemo(() => algorithmOf(p), [p.id, p.status]);
    const [alg, setAlg] = useState<IAlgorithm>(initial);
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
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="success"
            size="small"
            disableElevation
            sx={{ borderRadius: "6px", px: 2 }}
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
          <Button size="small" color="inherit" onClick={() => setEditing(null)}>
            Close
          </Button>
          {derived.unbound.length > 0 && (
            <Typography sx={{ ...T.small, color: colors.warn, ml: 1 }}>
              {plural(derived.unbound.length, "step", "steps")} not linked to an
              activity
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  // GitHub's buttons: a neutral face with a border for Edit and Undo, a
  // green or red fill with white text for the decisions.
  const gh = {
    face: dark ? "#21262d" : "#f6f8fa",
    faceHover: dark ? "#30363d" : "#f3f4f6",
    border: dark ? "#30363d" : "#d0d7de",
    green: dark ? "#238636" : "#2da44e",
    greenHover: dark ? "#2ea043" : "#2c974b",
    greenBorder: dark ? "rgba(240,246,252,0.1)" : "rgba(27,31,36,0.15)",
    red: dark ? "#da3633" : "#cf222e",
    redHover: dark ? "#b62324" : "#a40e26",
  };
  const buttonSx = {
    minWidth: 0,
    px: 2,
    py: 0.6,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.5,
    borderRadius: "6px",
    border: "1px solid",
  };
  const faceSx = (color?: string) => ({
    ...buttonSx,
    color: color || "text.primary",
    bgcolor: gh.face,
    borderColor: gh.border,
    "&:hover": { bgcolor: gh.faceHover, borderColor: gh.border },
  });
  const filledSx = (bg: string, hover: string) => ({
    ...buttonSx,
    color: "#fff",
    bgcolor: bg,
    borderColor: gh.greenBorder,
    "&:hover": { bgcolor: hover, borderColor: gh.greenBorder },
  });
  // Step 3's header buttons: filled grey pills.
  // A muted grey: the theme's secondary text is close to white when dark.
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  const ghostSx = {
    minWidth: 0,
    px: "16px",
    py: "10px",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: "20px",
    borderRadius: "999px",
    whiteSpace: "nowrap",
    color: dark ? "#f0f0f2" : "#24292f",
    bgcolor: dark ? "#34343a" : "#eaecef",
    "&:hover": { bgcolor: dark ? "#3e3e45" : "#dfe2e6" },
    // a ring on keyboard focus only
    "&.Mui-focusVisible, &:focus-visible": {
      boxShadow: "0 0 0 3px #5a5a6059",
    },
    "&.Mui-disabled": { color: muted },
    "& .MuiButton-startIcon": { ml: 0, mr: "8px" },
  };
  // A decided flow in a word, beside its Undo: "Accepted" or "Edited" in
  // green, "Rejected" in red with its reason on hover.
  const statusLine = (p?: AlgorithmProposal) => {
    if (!p || p.status === "pending") return null;
    const word = OUTCOME_LABEL[p.status];
    return (
      <Box
        component="span"
        title={p.decision?.reason || undefined}
        sx={{
          ...T.text,
          fontWeight: 600,
          whiteSpace: "nowrap",
          color: p.status === "rejected" ? colors.bad : colors.ok,
        }}
      >
        {word}
      </Box>
    );
  };
  const OutcomeControls = ({
    p,
    onRebuild,
    belongs,
  }: {
    p: AlgorithmProposal;
    /** Step 1: Yes or No to "Belongs to this generalization?". */
    belongs?: boolean;
    /** Step 3: a Rebuild button takes the place of Reject. */
    onRebuild?: () => void;
  }) => {
    // Step 1: both answers stay on screen and the one given is filled; it
    // is changed by the other, and taken back by clicking it again. A flow
    // rejected for another reason keeps its word and Undo.
    const no = p.status === "rejected" && !!p.decision?.doesNotBelong;
    const yes = p.status === "accepted" || p.status === "edited";
    if (belongs && (p.status === "pending" || yes || no))
      return (
        <Box
          role="group"
          aria-label="Belongs to this generalization?"
          // one control of two options; the one given is filled
          sx={{
            display: "inline-flex",
            gap: "2px",
            p: "2px",
            border: `1px solid ${dark ? "#333338" : "#d0d7de"}`,
            borderRadius: "8px",
          }}
        >
          {(
            [
              ["No", "✕", no],
              ["Yes", "✓", yes],
            ] as const
          ).map(([word, mark, on]) => (
            <Box
              key={word}
              component="button"
              type="button"
              aria-pressed={on}
              onClick={() =>
                on
                  ? undecide(p)
                  : word === "Yes"
                    ? decide(p, "accepted")
                    : decide(p, "rejected", {
                        reason: "Does not belong here",
                        doesNotBelong: true,
                      })
              }
              sx={{
                border: 0,
                borderRadius: "6px",
                px: "10px",
                py: "4px",
                fontFamily: "inherit",
                fontSize: 12,
                lineHeight: "18px",
                fontWeight: on ? 500 : 400,
                whiteSpace: "nowrap",
                cursor: "pointer",
                color: on ? (dark ? "#fff" : "#111") : "#8a8a90",
                bgcolor: on ? (dark ? "#3a3a40" : "#e4e6ea") : "transparent",
                "&:hover": { color: dark ? "#fff" : "#111" },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: "1px",
                },
              }}
            >
              {on && <span aria-hidden>{mark} </span>}
              {word}
            </Box>
          ))}
        </Box>
      );
    // Step 3: Regenerate and Edit stay whatever was decided; the flow is
    // accepted from the bar under the step.
    if (onRebuild)
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Button
            size="small"
            sx={ghostSx}
            startIcon={<AutoAwesomeIcon sx={{ fontSize: "15px !important" }} />}
            disabled={rebuilding}
            onClick={onRebuild}
          >
            {rebuilding ? "Regenerating…" : "Regenerate with AI"}
          </Button>
          <Button
            size="small"
            sx={ghostSx}
            onClick={() => {
              setEditing(editing === p.nodeId ? null : p.nodeId);
              setRejectFor(null);
            }}
          >
            {editing === p.nodeId ? "Close" : "Edit"}
          </Button>
        </Stack>
      );
    if (p.status !== "pending")
      return (
        <Stack direction="row" alignItems="center" gap={1.5}>
          {statusLine(p)}
          <Button size="small" sx={faceSx()} onClick={() => undecide(p)}>
            Undo
          </Button>
        </Stack>
      );
    const open = editing === p.nodeId;
    const rejecting = rejectFor === p.nodeId;
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Button
          size="small"
          sx={faceSx()}
          onClick={() => {
            setEditing(open ? null : p.nodeId);
            setRejectFor(null);
          }}
        >
          {open ? "Close" : "Edit"}
        </Button>
        {/* Reject opens the reason panel; while it is open the same
            button is a plain Cancel */}
        <Button
          size="small"
          disableElevation
          sx={
            rejecting
              ? {
                  ...faceSx(gh.red),
                  borderColor: gh.red,
                  "&:hover": { bgcolor: gh.faceHover, borderColor: gh.red },
                }
              : filledSx(gh.red, gh.redHover)
          }
          onClick={() => {
            setRejectFor(rejecting ? null : p.nodeId);
            setEditing(null);
          }}
        >
          {rejecting ? "Cancel" : "Reject"}
        </Button>
        <Button
          size="small"
          disableElevation
          sx={filledSx(gh.green, gh.greenHover)}
          onClick={() => decide(p, "accepted")}
        >
          Accept
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
  const pending = total - decided;
  const reviewed = total > 0 && pending === 0;
  const parentProposal = algorithms[nodeId] as AlgorithmProposal | undefined;
  const derived = useMemo(() => {
    if (!reviewed || !accepted.length) return null;
    const flows = accepted.map((r) =>
      algorithmOf(r.proposal as AlgorithmProposal),
    );
    return deriveParentFlow(currentVisibleNode.title, flows, titleOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewed, docs, nodes, currentVisibleNode.title]);
  const derivedSig = derived ? flowSignature(derived.algorithm) : "";
  // Step 3, parts: how each accepted specialization inherits from the
  // generalization as it stands on screen, edits included.
  const inheritance = useMemo(
    () => (parentProposal ? inheritanceFor(stepsOf(parentProposal)) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parentProposal, docs, ancestorsOf],
  );
  // Only a parent flow that was built from the children can go stale, and
  // only while it is still pending: one the generator wrote, or one the
  // reviewer has decided on, is left as it is.
  const stale =
    !!parentProposal &&
    !!parentProposal.derived &&
    parentProposal.status === "pending" &&
    !!derived &&
    flowSignature(algorithmOf(parentProposal)) !== derivedSig;

  // The parent's proposal is written once every child is reviewed, and
  // written again when the accepted flows it was built from have changed.
  // Not from answers that are still unsaved.
  const wantPropose =
    reviewed && !!derived && (!parentProposal || stale) && !dirty;
  useEffect(() => {
    if (wantPropose && derived)
      propose(
        derived.algorithm,
        accepted.map((r) => r.id),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPropose, derivedSig]);

  if (loading) return <LinearProgress sx={{ my: 2 }} />;
  // Nothing to review: neither the activity nor its specializations have a
  // proposal.
  const p = algorithms[nodeId];
  if (!p && !Object.keys(algorithms).length)
    return (
      <Paper elevation={0} sx={{ ...cardSx, px: 3, py: 4 }}>
        <Typography
          data-testid="no-proposals"
          sx={{
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.5,
            color: "primary.main",
          }}
        >
          There are no proposals for this activity
        </Typography>
      </Paper>
    );
  // ---------- leaf: its own proposal ----------
  if (!isFamily && p)
    return (
      <Section title={<Typography sx={T.title}>Algorithm proposal</Typography>}>
        <Box sx={{ mb: 1 }}>
          <OutcomeControls p={p} />
        </Box>
        {rejectFor === nodeId && (
          <Box sx={{ mb: 2 }}>
            <RejectPanel p={p} />
          </Box>
        )}
        <Editor p={p} />
        <SaveBar
          unsaved={unsaved.count}
          state={saveState}
          onSave={() => save()}
          onDiscard={discard}
          dark={dark}
        />
      </Section>
    );

  // ---------- family: three steps, one on screen ----------
  const moveOut = withProposal.filter(
    (r) => r.proposal?.decision?.doesNotBelong,
  );
  const unplaced = moveOut.filter((r) => !placedUnder(r.proposal));
  // This node, as the generalization each outlier starts under.
  const currentFamily = { id: nodeId, title: currentVisibleNode.title };
  const active = stage ?? 1;
  // Step 2 shows one activity at a time: the one picked, or the first that
  // still needs a place.
  const placing =
    moveOut.find((r) => r.id === placeFor) ?? unplaced[0] ?? moveOut[0];
  // The step 1 table's colours, for step 2's list.
  const tableSx = {
    card: dark ? "#1b1b1c" : "#fff",
    grid: dark ? "#2c2d2f" : "#e8eaed",
    rowTint: dark ? "#202122" : "#f8f9fb",
    // step 2's list: muted rows, and the chosen one in an orange tint
    // with a thin orange outline
    itemText: dark ? "#b9b9b4" : "rgba(0,0,0,0.7)",
    itemHover: dark ? "#222" : "#f3f4f6",
    picked: dark ? "#46301e" : "#fbe9d7",
    pickedLine: dark ? "#b0733f" : "#e0a26b",
  };
  // The steps as tabs: a number, or a check once the step is complete.
  const parentDecided = !!parentProposal && isDecided(parentProposal.status);
  const waitsFor = [
    parts
      ? "Answer every activity to continue"
      : "Answer every flow to continue",
    "Give every activity a generalization to continue",
    `Accept the generalized ${w.flow} to finish`,
  ];
  // A step is ready once its work is done, and done once that is saved.
  const ready = [
    reviewed,
    reviewed && !unplaced.length,
    reviewed && !unplaced.length && parentDecided,
  ];
  // How many steps, from the first, are ready.
  const lead = ready.indexOf(false) < 0 ? 3 : ready.indexOf(false);
  const steps = [
    `Review specialization ${w.flows}`,
    "Reorganize specializations",
    `Build generalized ${w.flow}`,
  ].map((label, i) => {
    // A later step waits for unsaved changes here, as it does for the
    // steps before it to be ready; the reason is said on hover.
    const unsavedHere = dirty && i + 1 > active;
    return {
      n: i + 1,
      label,
      // done: ready, saved, and the reviewer has been on it
      done: i < lead && reached > i && !(dirty && i + 1 >= active),
      locked: unsavedHere || i > lead,
      why: unsavedHere ? SAVE_FIRST : i > lead ? waitsFor[lead] : undefined,
    };
  });
  // Leaving a step with unsaved changes asks first.
  const goTo = (n: number) => {
    if (n === active) return;
    if (dirty) setLeaveFor(n);
    else setStage(n);
  };
  const onLeave = async (choice: "save" | "discard" | "cancel") => {
    const to = leaveFor;
    setLeaveFor(null);
    if (to === null || choice === "cancel") return;
    if (choice === "save") {
      if (await save()) setStage(to);
      return;
    }
    discard();
    // a later step may have opened only because of what was discarded
    if (to < active) setStage(to);
  };
  // The workflow at the top of the container: three equal columns, each a
  // number badge and the step's name, with a green check once it is done.
  const stepC = {
    bar: dark ? "#1d1d21" : "#f4f5f7",
    line: dark ? "#2a2a2f" : "#e1e4e8",
    on: dark ? "#2a2a2f" : "#fff",
    badgeOn: dark ? "#3a3a40" : "#e4e6ea",
    todo: dark ? "#a9a9ae" : "#57575c",
    done: dark ? "#8a8a90" : "#77777c",
    check: dark ? "#3fb950" : "#2da44e",
  };
  const stepNav = (
    <Box
      ref={stepNavRef}
      component="nav"
      aria-label="Review steps"
      sx={{
        display: "grid",
        // a phone: columns as wide as their titles, in a bar that scrolls
        gridTemplateColumns: {
          xs: "repeat(3, minmax(170px, 1fr))",
          sm: "repeat(3, 1fr)",
        },
        gap: "4px",
        p: "8px",
        boxSizing: "border-box",
        bgcolor: stepC.bar,
        borderBottom: `1px solid ${stepC.line}`,
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {steps.map((s) => {
        const on = active === s.n;
        return (
          <Box
            key={s.n}
            component="button"
            type="button"
            data-testid={`stage-${s.n}`}
            data-state={s.done ? "done" : "todo"}
            aria-current={on ? "step" : undefined}
            disabled={s.locked}
            title={s.why}
            onClick={() => goTo(s.n)}
            sx={{
              minWidth: 0,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              px: "12px",
              py: "9px",
              border: 0,
              borderRadius: "8px",
              bgcolor: on ? stepC.on : "transparent",
              color: on ? "primary.main" : s.done ? stepC.done : stepC.todo,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: on ? 600 : 400,
              lineHeight: "20px",
              textAlign: "left",
              cursor: "pointer",
              transition: "background-color 120ms",
              "&:hover": { bgcolor: on ? stepC.on : "action.hover" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "1px",
              },
              // a step that waits for the ones before it
              "&:disabled": {
                cursor: "not-allowed",
                opacity: 0.5,
                bgcolor: "transparent",
              },
            }}
          >
            <Box
              component="span"
              sx={{
                minWidth: 18,
                height: 18,
                flexShrink: 0,
                boxSizing: "border-box",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                bgcolor: on ? stepC.badgeOn : stepC.line,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                fontWeight: 400,
                lineHeight: 1,
              }}
            >
              {s.n}
            </Box>
            <Box
              component="span"
              sx={{
                minWidth: 0,
                whiteSpace: { xs: "nowrap", sm: "normal" },
              }}
            >
              {s.label}
            </Box>
            {/* A finished step gets a green check; an unfinished one, nothing */}
            {s.done && (
              <CheckIcon
                titleAccess="Completed"
                sx={{ ml: "8px", fontSize: 16, color: stepC.check }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
  // What Help shows between the step bar and the step, in the node page's
  // instruction box: a lead with its key words, then what can be done.
  const name = currentVisibleNode.title;
  const about: { lead: [string, string, string]; items: string[] }[] = [
    {
      lead: [
        "Look at each ",
        parts ? "specialization's parts" : "specialization flow",
        ` and say whether the activity belongs under ${name}.`,
      ],
      items: [
        `Yes keeps it here and accepts its ${w.flow}; No sends it to step 2`,
        "Click the other answer to change it, or the same one to take it back",
        `Click an activity's name to edit its ${w.flow}`,
        parts
          ? "Parts the specializations share are in columns; the rest are under Own parts"
          : "Flow draws each flow as it is; Line up puts the steps the flows share in columns",
        `Save your answers; Next opens once every ${parts ? "activity" : "flow"} has one`,
      ],
    },
    {
      lead: [
        "Choose the ",
        "Generalization(s)",
        ` each activity rejected from ${name} should be under.`,
      ],
      items: [
        "Unlink a generalization it should not be under",
        "Search existing activities, or create what you searched as a new generalization",
        "Each activity needs at least one generalization",
        "Save the links; Next opens once each has a generalization",
        "Nothing changes in the ontology until the review is applied",
      ],
    },
    {
      lead: ["Review the ", `generalized ${w.flow}`, ` built for ${name}.`],
      items: parts
        ? [
            "It has the parts that at least half of the accepted specializations have",
            "Step through the specializations with ‹ › or pick one to see how it will inherit them: = the same part, › a specialized part, + a part of its own, × a part it does not inherit",
            "Drag a part to reorder, or Edit the parts; the comparison follows",
            "If the accepted parts change before you decide, they are rebuilt from them",
          ]
        : [
            "It has the steps that at least half of the accepted flows have",
            "Click a step to see which accepted flows have it; point at a flow to see its steps",
            "If the accepted flows change before you decide, it is rebuilt from them",
          ],
    },
  ];
  // A help sentence with the node's name picked out wherever it occurs.
  const named = (text: string) =>
    text.split(name).flatMap((part, i) =>
      i
        ? [
            <Box
              key={i}
              component="b"
              sx={{ fontWeight: 600, color: "text.primary" }}
            >
              {name}
            </Box>,
            part,
          ]
        : [part],
    );
  const stepHelp = help ? (
    <Box
      id="review-step-help"
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        mx: "16px",
        my: "12px",
        pl: "16px",
        pr: "8px",
        py: "10px",
        borderRadius: "12px",
        backgroundColor: dark ? "#2d271e" : "#fcf8f1",
        border: "1px solid",
        borderColor: dark ? "#443928" : "#f9ebd3",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: 14, lineHeight: "22px", color: "text.primary" }}
        >
          {about[active - 1].lead[0]}
          <Box component="strong" sx={{ color: "orange", fontWeight: 700 }}>
            {about[active - 1].lead[1]}
          </Box>
          {named(about[active - 1].lead[2])}
        </Typography>
        <Box
          component="ul"
          sx={{
            m: 0,
            mt: "4px",
            pl: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            "& li": {
              fontSize: 13,
              lineHeight: "20px",
              color: dark ? "#aaa" : "#666",
            },
          }}
        >
          {about[active - 1].items.map((t) => (
            <li key={t}>{named(t)}</li>
          ))}
        </Box>
      </Box>
      <IconButton
        size="small"
        aria-label="Close help"
        onClick={() => setHelp(false)}
        sx={{ flexShrink: 0, p: "3px", color: "text.secondary" }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  ) : (
    <Box
      component="button"
      type="button"
      onClick={() => setHelp(true)}
      // a quiet link right under the stepper, the same on every step
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        px: "24px",
        py: "12px",
        border: 0,
        bgcolor: "transparent",
        color: dark ? "#8a8a90" : "#6b6b70",
        fontFamily: "inherit",
        fontSize: 13,
        lineHeight: "20px",
        cursor: "pointer",
        "&:hover": { color: "text.primary" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: "-2px",
        },
      }}
    >
      <HelpOutlineIcon sx={{ fontSize: 16 }} />
      How this step works
    </Box>
  );
  // A small Parts | Flow toggle at the right of the help line, until the
  // proposals say which they hold.
  const focusSwitch = (
    <Box
      role="group"
      aria-label="What to review"
      data-testid="review-focus"
      sx={{
        display: "inline-flex",
        flexShrink: 0,
        p: "3px",
        mr: "16px",
        ...(help ? { mt: "12px" } : {}),
        borderRadius: "999px",
        bgcolor: dark ? "#202024" : "#e9ebee",
      }}
    >
      {(["parts", "flow"] as const).map((f) => {
        const on = focus === f;
        return (
          <Box
            key={f}
            component="button"
            type="button"
            aria-label={`Review ${f}`}
            aria-pressed={on}
            onClick={() => !on && setFocus(f)}
            sx={{
              border: 0,
              cursor: "pointer",
              px: "12px",
              py: "5px",
              borderRadius: "999px",
              fontFamily: "inherit",
              fontSize: 12.5,
              lineHeight: 1.4,
              fontWeight: on ? 500 : 400,
              color: on
                ? dark
                  ? "#fff"
                  : "text.primary"
                : dark
                  ? "#a9a9ae"
                  : "#6b6b70",
              bgcolor: on ? (dark ? "#3a3a40" : "#fff") : "transparent",
              "&:hover": { color: dark ? "#fff" : "text.primary" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "-2px",
              },
            }}
          >
            {f === "parts" ? "Parts" : "Flow"}
          </Box>
        );
      })}
    </Box>
  );
  // The bar pinned under the step: Previous, what is saved, Save, Next.
  // Step 3 saves by accepting: the flow as it stands is what is stored,
  // edited or not.
  const flowShown =
    reviewed && accepted.length > 0 && !!derived && !!parentProposal;
  const acceptAndSave = () => {
    const p = parentProposal;
    if (!p || p.status !== "pending") return save();
    const algorithm = algorithmOf(p);
    const { steps, kind } = algorithmToProposal(algorithm);
    const next = docs.map((d) =>
      d.id === p.id
        ? ({
            ...d,
            status: "accepted",
            decision: {
              outcome: "accepted",
              algorithm,
              steps,
              kind,
              inheritance: inheritanceFor(steps),
              by: user?.uname,
              at: new Date(),
            },
          } as ReviewDoc)
        : d,
    );
    setDocs(next);
    setEditing(null);
    return save(next);
  };
  const onLast = active === 3 && flowShown;
  saveRef.current = onLast ? acceptAndSave : () => save();
  const stepFooter = (
    <SaveBar
      unsaved={unsaved.count}
      state={saveState}
      hint={
        dirty
          ? SAVE_FIRST
          : ready[active - 1] || active === 3
            ? undefined
            : waitsFor[active - 1]
      }
      previous={{ onClick: () => goTo(active - 1), disabled: active === 1 }}
      next={
        active < 3
          ? { label: steps[active].label, onClick: () => setStage(active + 1) }
          : undefined
      }
      last={
        onLast
          ? {
              saveLabel: "Accept and save",
              mustSave: parentProposal?.status === "pending",
              // the node's own hash: the review closes in place
              doneHref: `#${nodeId}`,
            }
          : undefined
      }
      onSave={onLast ? acceptAndSave : () => save()}
      onDiscard={discard}
      leaving={leaveFor !== null}
      onLeave={onLeave}
      dark={dark}
    />
  );
  // What a step shows when it has nothing to work on yet.
  const idle = (text: string) => (
    <Typography sx={{ fontSize: 14, color: "text.secondary", p: "16px" }}>
      {text}
    </Typography>
  );
  // A two-way switch drawn as a segmented control.
  const Segmented = ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string; count?: number }[];
  }) => (
    <Box
      sx={{
        display: "inline-flex",
        p: "3px",
        gap: "2px",
        borderRadius: "8px",
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
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            sx={{
              border: 0,
              cursor: "pointer",
              px: 1.5,
              py: 0.5,
              borderRadius: "6px",
              fontSize: 13,
              fontWeight: on ? 600 : 500,
              fontFamily: "inherit",
              lineHeight: 1.5,
              color: on ? "text.primary" : "text.secondary",
              bgcolor: on ? (dark ? "#1b1b1c" : "#fff") : "transparent",
              boxShadow: on ? "0 1px 2px rgba(0,0,0,0.14)" : "none",
              "&:hover": { color: "text.primary" },
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <Box
                component="span"
                sx={{ ml: "6px", fontWeight: 400, color: muted }}
              >
                {o.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );

  // The accepted flows that do the picked step, by the activity id the
  // steps are bound to; names are not compared.
  const partIdsOf = (a: IAlgorithm) => {
    const ids = new Set<string>();
    const walk = (x: any) => {
      if (x.type === "task" && x.partId) ids.add(x.partId);
      (x.sub_activities || []).forEach(walk);
    };
    walk(a);
    return ids;
  };

  const childRows: AlignedRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    algorithm: r.proposal ? algorithmOf(r.proposal) : null,
    active: editing === r.id,
    counted: r.proposal?.status !== "rejected",
    hidden:
      filter !== "all" &&
      (r.proposal?.status === "edited" ? "accepted" : r.proposal?.status) !==
        filter,
  }));
  // Step 3: one flow to judge, in a box of the same make as step 2's.
  const flowHead = (label: React.ReactNode, side: React.ReactNode) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "8px",
        minHeight: 44,
        boxSizing: "border-box",
        bgcolor: dark ? "#242425" : "#d0d5dd",
        pl: "20px",
        pr: "12px",
        py: "10px",
      }}
    >
      <Box sx={{ minWidth: 0 }}>{label}</Box>
      <Box
        sx={{
          ml: "auto",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {side}
      </Box>
    </Box>
  );
  const flowBox = (
    label: React.ReactNode,
    side: React.ReactNode,
    body: React.ReactNode,
  ) =>
    // parts: the head and the comparison sit in the step's panel as they
    // are; flows: in a box of their own, with the accepted flows under it
    parts ? (
      <>
        {flowHead(label, side)}
        {body}
      </>
    ) : (
      <Box
        sx={{
          border: `1px solid ${tableSx.grid}`,
          borderRadius: "12px",
          overflow: "hidden",
          bgcolor: tableSx.card,
        }}
      >
        {flowHead(label, side)}
        {body}
      </Box>
    );
  const generalized = () => {
    if (!parentProposal || !derived) return null;
    const p = parentProposal;
    const current = algorithmOf(p);
    // Each part of the flow once, in reading order, with where it comes
    // from: the accepted flows (by activity id), an activity that exists but
    // that none of them has, or a step bound to no activity in the ontology.
    const listed: PickedTask[] = [];
    const walkParts = (a: any) => {
      if (a.type === "task") {
        const text =
          a.name?.trim() || (a.partId ? titleOf(a.partId) : "") || "…";
        const key = a.partId || text;
        if (!listed.some((x) => x.key === key))
          listed.push({ key, partId: a.partId || null, text });
      }
      (a.sub_activities || []).forEach(walkParts);
    };
    walkParts(current);
    const acceptedIds = accepted.map((r) =>
      partIdsOf(algorithmOf(r.proposal as AlgorithmProposal)),
    );
    const support = (t: PickedTask) =>
      t.partId ? acceptedIds.filter((ids) => ids.has(t.partId!)).length : 0;
    const exists = (t: PickedTask) =>
      !!t.partId && !!(nodes[t.partId] || relatedNodes[t.partId]);
    // Only what is not the usual case is said: a flow the reviewer edited,
    // or one the generator wrote instead of the accepted flows.
    const origin =
      p.status === "edited"
        ? "Edited by reviewer"
        : p.derived
          ? null
          : "Written by the generator";
    // What each step says on hover: how many accepted flows have it. Only a
    // step that is not an activity in the ontology carries a badge, "new".
    const influence = accepted.map((r, i) => ({
      id: r.id,
      title: r.title,
      algorithm: algorithmOf(r.proposal as AlgorithmProposal),
      has: acceptedIds[i],
    }));
    const picked = influence.find((r) => r.id === influenceOf);
    const markOf = (t: PickedTask) => {
      const n = support(t);
      // a step the picked accepted flow does not have steps back
      const dim = !!picked && !(t.partId && picked.has.has(t.partId));
      if (n)
        return { tip: `in ${n} of ${accepted.length} accepted flows`, dim };
      return exists(t)
        ? { tip: "an existing activity, in no accepted flow", dim }
        : {
            badge: "new",
            tone: "new" as const,
            tip: "not an activity in the ontology yet",
            dim,
          };
    };
    // Parts: how each accepted specialization will inherit from the
    // generalization as proposed, one at a time, in the node page's view.
    const genSteps = stepsOf(p);
    const shown = accepted.find((r) => r.id === previewOf) ?? accepted[0];
    const partOf = (steps: ProposalStep[]) => (id: string) => {
      const s = steps.find((x) => x.id === id);
      return {
        id,
        title: s?.title || titleOf(id),
        optional: s?.role === "optional",
        ...(s?.isNew ? { isNew: true, parent: s.parent ?? null } : {}),
      };
    };
    const SYMBOL = {
      same: "=",
      specialized: ">",
      added: "+",
      notInherited: "x",
    } as const;
    const previewFor = (r: (typeof accepted)[number]) => {
      const specSteps = stepsOf(r.proposal as AlgorithmProposal);
      const rows: PreviewRow[] = (inheritance[r.id] || []).map((m) => ({
        from: m.generalizedPartIds.map(partOf(genSteps)),
        to: m.specializationPartIds.map(partOf(specSteps)),
        symbol: SYMBOL[m.relation],
      }));
      return {
        title: currentVisibleNode.title,
        rows,
        pick: {
          options: accepted.map((a) => ({ id: a.id, title: a.title })),
          value: r.id,
          onChange: setPreviewOf,
        },
        onReorder: (ids: string[]) =>
          setParts(
            ids
              .map((id) => genSteps.find((x) => x.id === id))
              .filter((x): x is ProposalStep => !!x),
          ),
        ...(editing === nodeId
          ? {
              onRemove: (id: string) =>
                setParts(genSteps.filter((x) => x.id !== id)),
            }
          : {}),
      };
    };
    // The generalized parts reordered, one removed or one added: an edit,
    // kept on screen until the step is saved.
    const setParts = (steps: ProposalStep[]) => {
      if (steps.map((x) => x.id).join() === genSteps.map((x) => x.id).join())
        return;
      patchDoc(p.id, {
        status: "edited",
        decision: {
          outcome: "edited",
          steps,
          kind: kindOf(p),
          ...(p.algorithm || p.decision?.algorithm
            ? { algorithm: applyPartsToAlgorithm(algorithmOf(p), steps) }
            : {}),
          inheritance: inheritanceFor(steps),
          by: user?.uname,
          at: new Date(),
        },
      });
    };
    // Editing: the node page's search under the comparison; a hit's Link
    // adds it as a generalized part, Unlink takes it out again.
    const partHits = partQuery.trim()
      ? searchWithFuse(partQuery.trim(), "activity")
          .filter((n) => n.id !== nodeId)
          .slice(0, 10)
      : [];
    const hitTitles: { [id: string]: { title: string } } = {};
    for (const n of partHits) {
      hitTitles[n.id] = { title: n.title };
      for (const s of n.specializations?.flatMap((col) => col.nodes) ?? [])
        hitTitles[s.id] = { title: s.title || titleOf(s.id) };
    }
    const hasPart = (id: string) => genSteps.some((s) => s.id === id);
    const togglePart = (id: string) =>
      setParts(
        hasPart(id)
          ? genSteps.filter((s) => s.id !== id)
          : [...genSteps, { id, title: hitTitles[id]?.title || titleOf(id) }],
      );
    // As in step 2: the typed text becomes a new part, unless it names an
    // existing one; a hit's plus makes a new part under that hit.
    const exactHit = partHits[0]?.title.trim() === partQuery.trim();
    const createPart = () => {
      setParts([
        ...genSteps,
        { id: `new:${Date.now()}`, title: partQuery.trim(), isNew: true },
      ]);
      setPartQuery("");
    };
    const createPartUnder = (id: string) => {
      const parent = { id, title: hitTitles[id]?.title || titleOf(id) };
      setParts([
        ...genSteps,
        {
          id: `new:${Date.now()}`,
          title: `New ${parent.title}`,
          isNew: true,
          parent,
        },
      ]);
    };
    const partsBody = (
      <>
        {rebuilding && <LinearProgress />}
        <Box
          data-testid="inheritance-preview"
          sx={{ p: "18px", opacity: rebuilding ? 0.4 : 1 }}
        >
          {shown && (
            <InheritedPartsViewer key={shown.id} preview={previewFor(shown)} />
          )}
        </Box>
        {editing === nodeId && (
          <Box
            data-testid="parts-search"
            sx={{
              borderTop: `1px solid ${tableSx.grid}`,
              px: "4px",
              py: "4px",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <SearchBox
                  setSearch={setPartQuery}
                  search={partQuery}
                  label="Search existing activities..."
                  sx={{
                    "& .MuiOutlinedInput-root input": { fontSize: 14 },
                    "& .MuiSvgIcon-root": { fontSize: 20 },
                  }}
                />
              </Box>
              <Tooltip title="Create what you searched as a new part">
                <Box component="span" sx={{ mr: "12px", flexShrink: 0 }}>
                  <Button
                    onClick={createPart}
                    disabled={partQuery.trim().length < 3 || exactHit}
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
                    Create new part
                  </Button>
                </Box>
              </Tooltip>
            </Box>
            {partQuery.trim() && (
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
                    searchResultsForSelection={partHits}
                    markItemAsChecked={togglePart}
                    // shows the plus; the part is recorded, not created
                    handleCloning={createPartUnder}
                    checkedItems={new Set(genSteps.map((s) => s.id))}
                    user={undefined}
                    nodes={hitTitles}
                    cloning={null}
                    disabledAddButton={false}
                    getNumOfGeneralizations={() => false}
                    selectedProperty="parts"
                    addACloneNodeQueue={createPartUnder}
                    currentVisibleNode={{ id: nodeId }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        )}
      </>
    );
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          p: parts ? 0 : "16px",
          bgcolor: tableSx.card,
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {flowBox(
            <>
              {/* what this is and where it stands, then the node's name */}
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: "18px",
                  color: "primary.main",
                }}
              >
                Review generalized {w.flow} for
              </Typography>
              {/* the title, with where the flow came from as a tag beside
                  it: a square label, not a button */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  columnGap: "12px",
                }}
              >
                <Typography
                  component="h3"
                  sx={{
                    m: 0,
                    fontSize: 22,
                    fontWeight: 600,
                    lineHeight: "30px",
                    color: dark ? "#e6e6e3" : "text.primary",
                  }}
                >
                  {currentVisibleNode.title}
                </Typography>
                {origin && (
                  <Typography
                    component="span"
                    data-testid="flow-origin"
                    sx={{
                      px: "8px",
                      py: "3px",
                      borderRadius: "4px",
                      bgcolor: dark ? "#2e2e33" : "#eaecef",
                      fontSize: 12,
                      fontWeight: 400,
                      lineHeight: "16px",
                      whiteSpace: "nowrap",
                      color: dark ? "#a9a9ae" : "#57575c",
                      cursor: "default",
                    }}
                  >
                    {origin}
                  </Typography>
                )}
              </Box>
            </>,
            <>
              <OutcomeControls
                p={p}
                onRebuild={() => {
                  setRebuilding(true);
                  setEditing(null);
                  rebuildTimer.current = setTimeout(async () => {
                    const from = accepted.map((r) => r.id);
                    if (p.status === "pending")
                      await propose(derived.algorithm, from);
                    else {
                      // decided already: rebuilt on screen, unsaved until
                      // it is accepted again
                      const { steps, kind } = algorithmToProposal(
                        derived.algorithm,
                      );
                      patchDoc(p.id, {
                        status: "pending",
                        decision: null,
                        algorithm: derived.algorithm,
                        steps,
                        flowKind: kind,
                        derived: { from },
                      });
                    }
                    setRebuilding(false);
                  }, REBUILD_DEMO_MS);
                }}
              />
            </>,
            parts ? (
              partsBody
            ) : (
              <>
                {rebuilding && <LinearProgress />}
                <Box
                  data-testid="generalized-flow"
                  // the flow being judged: drawn larger than the ones below,
                  // with room around it (48px once zoomed)
                  sx={{
                    px: "16px",
                    py: "40px",
                    overflowX: "auto",
                    opacity: rebuilding ? 0.4 : 1,
                    zoom: 1.2,
                  }}
                >
                  <FlowTrack
                    algorithm={current}
                    dark={dark}
                    titleOf={titleOf}
                    parts={parts}
                    mark={markOf}
                    onPick={(task) => {
                      setInfluenceOf(null);
                      setEvidence(evidence?.key === task.key ? null : task);
                    }}
                    picked={evidence?.key}
                  />
                </Box>
                {/* The editor opens under the flow, which stays as saved */}
                {editing === nodeId && (
                  <Box
                    sx={{
                      px: "16px",
                      pb: "16px",
                      borderTop: `1px solid ${tableSx.grid}`,
                    }}
                  >
                    <Editor p={p} />
                  </Box>
                )}
              </>
            ),
          )}
          {/* What it was built from, apart from it; the parts preview
              carries its own list */}
          {!parts && (
            <InfluenceList
              rows={influence}
              pickedPart={evidence}
              pickedFlow={influenceOf}
              onPickFlow={setInfluenceOf}
              onClearPart={() => setEvidence(null)}
              dark={dark}
              titleOf={titleOf}
              parts={parts}
            />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Typography
        data-testid="review-intro"
        sx={{
          fontSize: 14,
          fontWeight: 400,
          lineHeight: "22px",
          color: "text.secondary",
          maxWidth: 900,
          // the same gap as to the header above
          mb: "16px",
          // the node and the three things to do stand out from the sentence
          "& strong": { fontWeight: 600, color: "text.primary" },
        }}
      >
        Review and consolidate the workflows associated with{" "}
        <strong>{currentVisibleNode.title}</strong>. Start by evaluating each
        specialization&apos;s <strong>proposed {w.flow}</strong>, then verify
        how the <strong>activities are organized</strong>. Finally, review the{" "}
        <strong>{parts ? "combined parts" : "combined workflow"}</strong>{" "}
        generated from your accepted proposals before applying the changes.
      </Typography>
      {/* One container: the stepper, the help link, the step's panel, and
          the action bar as its bottom edge. Clipped without scrolling, so
          the bar inside can stick to the page. */}
      <Box
        sx={{
          border: `1px solid ${stepC.line}`,
          borderRadius: "12px",
          overflow: "clip",
          bgcolor: dark ? "#17171a" : "#fafbfc",
        }}
      >
        {stepNav}
        <Box
          sx={{
            display: "flex",
            alignItems: help ? "flex-start" : "center",
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>{stepHelp}</Box>
          {focusSwitch}
        </Box>
        <Paper
          elevation={0}
          sx={{
            mx: "16px",
            mb: "16px",
            border: `1px solid ${stepC.line}`,
            borderRadius: "12px",
            overflow: "hidden",
            bgcolor: dark ? "#1a1a1a" : "#fff",
          }}
        >
          {/* 1. The children's flows: each from the left, or lined up by task */}
          {active === 1 && (
            <>
              {total > 1 && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    p: "16px",
                    borderBottom: `1px solid ${line}`,
                  }}
                >
                  <Segmented
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: "all", label: "All", count: total },
                      { value: "pending", label: "Pending", count: pending },
                      {
                        value: "accepted",
                        label: "Belongs",
                        count: accepted.length,
                      },
                      {
                        value: "rejected",
                        label: "Does not belong",
                        count: decided - accepted.length,
                      },
                    ]}
                  />
                  {!parts && (
                    <Box sx={{ ml: "auto" }}>
                      <Segmented
                        value={view}
                        onChange={(v) => setView(v as "flow" | "lineup")}
                        options={[
                          { value: "flow", label: "Flow" },
                          { value: "lineup", label: "Line up" },
                        ]}
                      />
                    </Box>
                  )}
                </Box>
              )}
              <AlignedFlows
                dark={dark}
                titleOf={titleOf}
                columns={parts || view === "lineup"}
                parts={parts}
                heading="O*Net activities"
                corner="Shared parts"
                actionsHeading="Belongs to this generalization?"
                rows={childRows}
                onTitleClick={(row) => {
                  if (algorithms[row.id])
                    setEditing(editing === row.id ? null : row.id);
                  else navigateToNode(row.id);
                }}
                renderActions={(row) => {
                  if (row.id === nodeId) return null;
                  const p = algorithms[row.id];
                  if (p) return <OutcomeControls p={p} belongs />;
                  const r = rows.find((x) => x.id === row.id);
                  return r?.isFamily ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      sx={{ borderRadius: "6px" }}
                      onClick={() => navigateToNode(row.id)}
                    >
                      Open its specializations
                    </Button>
                  ) : null;
                }}
                renderBelow={(row) => {
                  if (row.id === nodeId) return null;
                  const p = algorithms[row.id];
                  if (!p) return null;
                  return editing === row.id ? <Editor p={p} /> : null;
                }}
              />
            </>
          )}

          {/* 2. Rejected as "does not belong": where do they go */}
          {active === 2 &&
            (moveOut.length === 0 ? (
              idle(
                `Nothing to reorganize. A specialization comes here when its flow is rejected as not belonging under ${currentVisibleNode.title}.`,
              )
            ) : (
              // The activities on the left, in the look of the step 1 table;
              // the generalizations of the chosen one on the right.
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  bgcolor: tableSx.card,
                }}
              >
                <Box
                  component="ul"
                  aria-label="Rejected specializations"
                  sx={{
                    m: 0,
                    p: "8px",
                    boxSizing: "border-box",
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    flex: { md: "0 0 300px" },
                    maxHeight: { xs: 220, md: 640 },
                    overflowY: "auto",
                    borderRight: { md: `1px solid ${tableSx.grid}` },
                    borderBottom: { xs: `1px solid ${tableSx.grid}`, md: 0 },
                  }}
                >
                  {moveOut.map((r) => {
                    const on = r.id === placing?.id;
                    return (
                      <Box component="li" key={r.id}>
                        <Box
                          component="button"
                          type="button"
                          aria-current={on ? "true" : undefined}
                          onClick={() => setPlaceFor(r.id)}
                          sx={{
                            display: "block",
                            width: "100%",
                            boxSizing: "border-box",
                            py: "12px",
                            px: "14px",
                            // every item has the 1px border, so the chosen one's
                            // outline does not move its text
                            border: "1px solid",
                            borderColor: on
                              ? tableSx.pickedLine
                              : "transparent",
                            borderRadius: "8px",
                            bgcolor: on ? tableSx.picked : "transparent",
                            color: on
                              ? dark
                                ? "#fff"
                                : "text.primary"
                              : tableSx.itemText,
                            fontFamily: "inherit",
                            textAlign: "left",
                            cursor: "pointer",
                            "&:hover": {
                              bgcolor: on ? tableSx.picked : tableSx.itemHover,
                            },
                            "&:focus-visible": {
                              outline: "2px solid",
                              outlineColor: "primary.main",
                              outlineOffset: "1px",
                            },
                          }}
                        >
                          <Typography
                            component="span"
                            title={r.title}
                            sx={{
                              fontSize: 14,
                              fontWeight: on ? 600 : 400,
                              lineHeight: 1.4,
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {r.title}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                {placing && (
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <PlacePanel
                      key={placing.id}
                      proposal={placing.proposal as AlgorithmProposal}
                      title={placing.title}
                      showFlow={placeFlow}
                      onShowFlow={setPlaceFlow}
                      algorithm={algorithmOf(
                        placing.proposal as AlgorithmProposal,
                      )}
                      current={currentFamily}
                      dark={dark}
                      titleOf={titleOf}
                      searchWithFuse={searchWithFuse}
                      onPlace={place}
                      navigateToNode={navigateToNode}
                      parts={parts}
                    />
                  </Box>
                )}
              </Box>
            ))}

          {/* 3. The parent's own flow, from the accepted ones */}
          {active === 3 &&
            (!reviewed ? (
              idle(
                parts
                  ? "Built once every specialization's parts are reviewed."
                  : "Built once every specialization flow is reviewed.",
              )
            ) : !accepted.length ? (
              idle(`No accepted ${w.flow} to build from.`)
            ) : !derived || !parentProposal ? (
              <LinearProgress sx={{ my: 2 }} />
            ) : (
              generalized()
            ))}
        </Paper>
        {stepFooter}
      </Box>
    </Box>
  );
};

export default ProposalReview;
