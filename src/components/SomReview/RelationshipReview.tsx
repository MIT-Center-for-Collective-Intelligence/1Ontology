import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  ScopedCssBaseline,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { titleValidationTheme } from "./titleValidationDesign";
import { getIdToken } from "../../lib/firestoreClient/auth";
import { reconcileSession } from "../../lib/relationshipReview/clientState";
import type {
  RelationshipCase,
  RelationshipDecision,
  RelationshipFeedback,
  RelationshipSession,
} from "../../types/IRelationshipReview";

async function request(
  action: string,
  body: unknown = {},
  preview = false,
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!preview) headers.Authorization = "Bearer " + (await getIdToken());
  const response = await fetch("/api/som-review/relationships/" + action, {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(data.error || "Could not reach the review. Please retry."),
      { status: response.status, code: data.code },
    );
  return data;
}
type Draft = {
  decision: RelationshipDecision | "";
  note: string;
  correction: string;
  revision: number;
  pending?: Record<string, unknown>;
  dirty: boolean;
};
function ExactTrace({ caseId, preview }: { caseId: string; preview: boolean }) {
  const [trace, setTrace] = useState<unknown>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setTrace((await request("trace", { caseId }, preview)).trace);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ mt: 2 }}>
      <Button variant="outlined" onClick={load} disabled={busy}>
        {busy ? "Loading…" : "Show exact requests and outputs"}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {trace !== null && (
        <Typography
          component="pre"
          sx={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            maxHeight: 480,
            overflow: "auto",
            mt: 2,
          }}
          tabIndex={0}
        >
          {JSON.stringify(trace, null, 2)}
        </Typography>
      )}
    </Box>
  );
}
function FeedbackForm({
  item,
  session,
  onSaved,
  memory,
}: {
  item: RelationshipCase;
  session: RelationshipSession;
  onSaved: (answer: RelationshipFeedback) => void;
  memory: Record<string, Draft>;
}) {
  const saved = session.feedback[item.id];
  const latestSaved = useRef(saved);
  if (
    saved &&
    (!latestSaved.current || saved.revision > latestSaved.current.revision)
  )
    latestSaved.current = saved;
  const key = `relationship-review:${session.reviewerKey}:${session.dataset.version}:${session.datasetSha256}:${item.id}`;
  const [draft, setDraft] = useState<Draft>(() => {
    const base: Draft = {
      decision: saved?.decision || "",
      note: saved?.note || "",
      correction: saved?.correction || "",
      revision: saved?.revision || 0,
      dirty: false,
    };
    try {
      const prior =
        memory[key] || JSON.parse(sessionStorage.getItem(key) || "null");
      if (
        prior &&
        ["", "agree", "disagree", "discuss"].includes(prior.decision) &&
        typeof prior.note === "string" &&
        typeof prior.correction === "string" &&
        Number.isSafeInteger(prior.revision)
      )
        return { ...prior, dirty: true };
    } catch {}
    return base;
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stored, setStored] = useState(true),
    [rejected, setRejected] = useState(false),
    [conflict, setConflict] = useState<RelationshipFeedback | null>(null);
  useEffect(() => {
    if (draft.dirty || draft.pending) {
      memory[key] = draft;
      try {
        sessionStorage.setItem(key, JSON.stringify(draft));
        setStored(true);
      } catch {
        setStored(false);
      }
    }
  }, [key, draft, memory]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (draft.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.dirty]);
  const edit = (value: Partial<Draft>) => {
    setError("");
    setDraft((d) => ({ ...d, ...value, dirty: true }));
  };
  async function save() {
    if (!draft.decision) return;
    const pending = draft.pending || {
      caseId: item.id,
      datasetVersion: session.dataset.version,
      datasetSha256: session.datasetSha256,
      decision: draft.decision,
      note: draft.note,
      correction: draft.correction,
      revision: draft.revision,
      requestId: crypto.randomUUID(),
      reviewerKey: session.reviewerKey,
    };
    setDraft((d) => ({ ...d, pending, dirty: true }));
    setBusy(true);
    setError("");
    memory[key] = { ...draft, pending, dirty: true };
    try {
      sessionStorage.setItem(key, JSON.stringify(memory[key]));
      setStored(true);
    } catch {
      setStored(false);
    }
    try {
      const { answer } = await request("save", pending, session.preview);
      onSaved(answer);
      if (
        latestSaved.current &&
        latestSaved.current.revision > answer.revision
      ) {
        setConflict(latestSaved.current);
        setError(
          "Your earlier save was confirmed, but a newer response is already saved. Your draft is retained for you to compare.",
        );
        return;
      }
      setDraft({
        decision: answer.decision,
        note: answer.note,
        correction: answer.correction,
        revision: answer.revision,
        dirty: false,
      });
      if (memory[key]?.pending?.requestId === pending.requestId)
        delete memory[key];
      try {
        if (
          JSON.parse(sessionStorage.getItem(key) || "null")?.pending
            ?.requestId === pending.requestId
        )
          sessionStorage.removeItem(key);
      } catch {}
    } catch (e: any) {
      setError(e.message);
      if (e.status === 400 || e.status === 413) setRejected(true);
      if (e.code === "revision_conflict")
        try {
          const latest = await request("session", {}, session.preview);
          const current = latest.feedback[item.id];
          if (current) {
            onSaved(current);
            setConflict(current);
          }
        } catch {}
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          Your judgment
        </Typography>
        <Typography sx={{ mb: 2 }}>
          Do you agree with the complete proposed placement above? Your answer
          records feedback; it does not change the ontology.
        </Typography>
        {draft.pending && !busy && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            A save needs confirmation. Retry it before changing your answer.
          </Alert>
        )}
        {conflict && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography>
              A newer response is saved: {conflict.decision}.{" "}
              {conflict.correction} {conflict.note}
            </Typography>
            <Button
              onClick={() => {
                setDraft((d) => ({
                  ...d,
                  revision: conflict.revision,
                  pending: undefined,
                  dirty: true,
                }));
                setConflict(null);
                setError("");
              }}
            >
              Keep my draft and edit the latest answer
            </Button>
            <Typography variant="body2">
              This restores editing. You will still need to press Save feedback.
            </Typography>
          </Alert>
        )}
        {rejected && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            The server did not accept this draft.{" "}
            <Button
              onClick={() => {
                setDraft((d) => ({ ...d, pending: undefined, dirty: true }));
                setRejected(false);
                setError("");
              }}
            >
              Edit my draft
            </Button>
          </Alert>
        )}
        <FormControl disabled={busy || !!draft.pending}>
          <FormLabel id="relationship-judgment">Choose your response</FormLabel>
          <RadioGroup
            aria-labelledby="relationship-judgment"
            value={draft.decision}
            onChange={(e) =>
              edit({ decision: e.target.value as RelationshipDecision })
            }
          >
            <FormControlLabel
              value="agree"
              control={<Radio />}
              label="Agree with the proposed placement"
            />
            <FormControlLabel
              value="disagree"
              control={<Radio />}
              label="Disagree — I would use a different placement"
            />
            <FormControlLabel
              value="discuss"
              control={<Radio />}
              label="Needs discussion — I’m not ready to decide"
            />
          </RadioGroup>
        </FormControl>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Suggested placement (optional)"
            helperText="Use activity names; this is a suggestion, not an automatic change."
            value={draft.correction}
            disabled={busy || !!draft.pending}
            inputProps={{ maxLength: 2000 }}
            onChange={(e) => edit({ correction: e.target.value })}
            fullWidth
          />
          <TextField
            label="Comments or examples (optional)"
            multiline
            minRows={3}
            value={draft.note}
            disabled={busy || !!draft.pending}
            inputProps={{ maxLength: 8000 }}
            onChange={(e) => edit({ note: e.target.value })}
            fullWidth
          />
          {error && (
            <Alert severity="error" role="alert">
              {error} Your draft is retained.
            </Alert>
          )}
          <Box role="status" aria-live="polite">
            <Typography color="text.secondary">
              {busy
                ? "Saving…"
                : draft.dirty
                  ? stored
                    ? "Not saved yet — draft kept in this tab."
                    : "Not saved yet — keep this tab open until your answer is saved."
                  : saved
                    ? session.preview
                      ? "Saved in local preview."
                      : "Saved to your account."
                    : "No response saved for this activity yet."}
            </Typography>
          </Box>
          {saved && (
            <Typography variant="body2" color="text.secondary">
              Last saved: {new Date(saved.savedAt).toLocaleString()} · revision{" "}
              {saved.revision}
              {draft.revision < saved.revision
                ? ` · ${saved.decision}: ${saved.note}`
                : ""}
            </Typography>
          )}
          <Button
            variant="contained"
            disabled={busy || !draft.decision || (!draft.dirty && !!saved)}
            onClick={save}
            sx={{ alignSelf: "flex-start" }}
          >
            {busy ? "Saving…" : draft.pending ? "Retry save" : "Save feedback"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
export default function RelationshipReview({
  preview = false,
}: {
  preview?: boolean;
}) {
  const drafts = useRef<Record<string, Draft>>({});
  const activityHeading = useRef<HTMLHeadingElement | null>(null),
    navigationRequested = useRef(false);
  const [session, setSession] = useState<RelationshipSession | null>(null),
    [error, setError] = useState(""),
    [index, setIndex] = useState(0),
    [filter, setFilter] = useState("all"),
    [queueIds, setQueueIds] = useState<string[] | null>(null),
    [tomFeedback, setTomFeedback] = useState<Record<
      string,
      RelationshipFeedback
    > | null>(null),
    [tomError, setTomError] = useState("");
  async function load() {
    setError("");
    try {
      const loaded = await request("session", {}, preview);
      const wanted = new URLSearchParams(window.location.search).get(
        "activity",
      );
      const selected = loaded.dataset.cases.findIndex(
        (c: RelationshipCase) => c.id === wanted,
      );
      setSession((current) => reconcileSession(current, loaded));
      if (selected >= 0) setIndex(selected);
      else if (wanted)
        setError(
          "That activity is not in this review set. Choose an activity below.",
        );
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const data = session?.dataset;
  // Freeze a selected queue so saving never advances or hides the current card.
  const items =
    data?.cases.filter((c) => queueIds === null || queueIds.includes(c.id)) ||
    [];
  function chooseFilter(value: string) {
    navigationRequested.current = true;
    setFilter(value);
    setIndex(0);
    setQueueIds(
      value === "all"
        ? null
        : (data?.cases || [])
            .filter(
              (c) =>
                (value === "unreviewed" && !session?.feedback[c.id]) ||
                (value === "changes" && c.analysis.judgment === "change") ||
                (value === "discussion" &&
                  (c.analysis.judgment === "discuss" ||
                    c.challenge.verdict === "needs-discussion" ||
                    c.mechanicalIssues.length > 0)),
            )
            .map((c) => c.id),
    );
  }
  const item = items[Math.min(index, Math.max(0, items.length - 1))];
  function navigate(next: number) {
    navigationRequested.current = true;
    setIndex(next);
  }
  useEffect(() => {
    if (item) {
      const url = new URL(window.location.href);
      url.searchParams.set("activity", item.id);
      window.history.replaceState(window.history.state, "", url);
    }
    if (item && navigationRequested.current) {
      navigationRequested.current = false;
      activityHeading.current?.focus({ preventScroll: true });
      activityHeading.current?.scrollIntoView?.({ block: "start" });
    }
  }, [item?.id]);
  async function loadTomFeedback() {
    setTomError("");
    try {
      setTomFeedback((await request("tom-feedback")).feedback);
    } catch (e: any) {
      setTomError(e.message);
    }
  }
  const names = new Map(data?.candidates.map((n) => [n.id, n.title]) || []);
  for (const n of item?.currentParents || []) names.set(n.id, n.title);
  const title = (id: string) =>
    names.get(id) || "Unresolved activity reference";
  const completed = session ? Object.keys(session.feedback).length : 0;
  return (
    <ThemeProvider theme={titleValidationTheme}>
      <ScopedCssBaseline>
        <Head>
          <title>Review activity relationships</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <Box
          component="main"
          sx={{
            minHeight: "100vh",
            bgcolor: "#F7F6F2",
            py: { xs: 3, md: 5 },
            px: { xs: 2, md: 4 },
            overflowWrap: "anywhere",
          }}
        >
          <Box sx={{ maxWidth: 1120, mx: "auto" }}>
            <Typography variant="overline" color="primary">
              Society of Mind · Ontology review
            </Typography>
            <Typography component="h1" variant="h4" sx={{ mt: 1, mb: 2 }}>
              Where does this activity belong?
            </Typography>
            <Typography sx={{ maxWidth: 850, mb: 3 }}>
              Review one activity at a time. A more specific activity should
              always be a kind of its broader activity. Consider whether the
              suggested placement fits that meaning and would make the hierarchy
              useful.
            </Typography>
            {error && (
              <Alert
                severity="error"
                action={<Button onClick={load}>Retry</Button>}
              >
                {error}
              </Alert>
            )}
            {!session && !error && (
              <Typography role="status">Loading proposals…</Typography>
            )}
            {session && data && (
              <>
                {session.canViewTomFeedback && (
                  <Accordion sx={{ mb: 3 }}>
                    <AccordionSummary
                      expandIcon={<span aria-hidden="true">＋</span>}
                    >
                      Tom’s saved feedback
                    </AccordionSummary>
                    <AccordionDetails>
                      <Button variant="outlined" onClick={loadTomFeedback}>
                        Load latest feedback
                      </Button>
                      {tomError && <Alert severity="error">{tomError}</Alert>}
                      {tomFeedback && (
                        <Typography sx={{ mt: 2 }}>
                          {Object.keys(tomFeedback).length} of{" "}
                          {data.cases.length} activities reviewed by Tom.
                        </Typography>
                      )}
                      {data.cases
                        .filter((c) => tomFeedback?.[c.id])
                        .map((c) => (
                          <Box key={c.id} sx={{ mt: 2 }}>
                            <Typography component="h3" variant="h6">
                              {c.title} · {tomFeedback![c.id].decision}
                            </Typography>
                            <Typography sx={{ whiteSpace: "pre-wrap" }}>
                              {tomFeedback![c.id].correction}{" "}
                              {tomFeedback![c.id].note}
                            </Typography>
                            <Button
                              href={
                                "/review/relationships?activity=" +
                                encodeURIComponent(c.id)
                              }
                            >
                              View activity
                            </Button>
                          </Box>
                        ))}
                    </AccordionDetails>
                  </Accordion>
                )}
                {session.preview && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Local software preview. These answers are separate from
                    production feedback.
                  </Alert>
                )}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Typography>
                    {completed} of {data.cases.length} reviewed
                  </Typography>
                  <Typography color="text.secondary">
                    Reviewing as {session.reviewerLabel}
                  </Typography>
                </Stack>
                <LinearProgress
                  value={(completed / data.cases.length) * 100}
                  variant="determinate"
                  aria-label="Activities reviewed"
                  sx={{ mb: 3, height: 6, borderRadius: 3 }}
                />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ mb: 3 }}
                >
                  <TextField
                    select
                    label="Show"
                    value={filter}
                    onChange={(e) => chooseFilter(e.target.value)}
                    sx={{ minWidth: 210 }}
                  >
                    <MenuItem value="all">All activities</MenuItem>
                    <MenuItem value="unreviewed">Not reviewed yet</MenuItem>
                    <MenuItem value="changes">Suggested changes</MenuItem>
                    <MenuItem value="discussion">Needs discussion</MenuItem>
                  </TextField>
                  {items.length > 0 && (
                    <TextField
                      select
                      fullWidth
                      label="Activity"
                      value={item.id}
                      onChange={(e) =>
                        navigate(
                          items.findIndex((c) => c.id === e.target.value),
                        )
                      }
                    >
                      {items.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.title}
                          {session.feedback[c.id] ? " · reviewed" : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Stack>
                {!item && (
                  <Alert severity="success">
                    There are no activities in this view. Choose “All
                    activities” to continue.
                  </Alert>
                )}
                {item && (
                  <Stack spacing={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                        <Stack
                          direction="row"
                          flexWrap="wrap"
                          gap={1}
                          sx={{ mb: 2 }}
                        >
                          <Chip label={`Level ${item.level}`} size="small" />
                          {item.scope !== "top-four-levels" && (
                            <Chip
                              label="Reason’s immediate child"
                              size="small"
                            />
                          )}
                          <Chip
                            color={
                              item.analysis.judgment === "change"
                                ? "primary"
                                : "default"
                            }
                            label={
                              item.analysis.judgment === "keep"
                                ? "Keep placement"
                                : item.analysis.judgment === "change"
                                  ? "Suggested change"
                                  : "For discussion"
                            }
                            size="small"
                          />
                        </Stack>
                        <Typography
                          component="h2"
                          variant="h4"
                          sx={{ mb: 2 }}
                          ref={activityHeading}
                          tabIndex={-1}
                        >
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: "1.125rem", mb: 3 }}>
                          {item.analysis.summary}
                        </Typography>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                            gap: 2,
                            mb: 3,
                          }}
                        >
                          <Box
                            sx={{ p: 2.5, bgcolor: "#F2F3EF", borderRadius: 2 }}
                          >
                            <Typography component="h3" variant="h6">
                              Current broader activities
                            </Typography>
                            <Box component="ul" sx={{ pl: 3, mb: 0 }}>
                              {item.currentParents.map((p) => (
                                <Typography component="li" key={p.id}>
                                  {p.title}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              p: 2.5,
                              bgcolor: "#EAF3F0",
                              border: "1px solid #BDD5CD",
                              borderRadius: 2,
                            }}
                          >
                            <Typography component="h3" variant="h6">
                              Proposed broader activities
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Complete suggested placement
                            </Typography>
                            <Box component="ul" sx={{ pl: 3, mb: 0 }}>
                              {item.analysis.proposedParents.map((p) => (
                                <Typography component="li" key={p.nodeId}>
                                  {title(p.nodeId)}
                                  {item.currentParents.some(
                                    (n) => n.id === p.nodeId,
                                  )
                                    ? " (retain)"
                                    : " (add)"}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                        {(item.challenge.verdict === "needs-discussion" ||
                          item.mechanicalIssues.length > 0) && (
                          <Alert severity="warning" sx={{ mb: 3 }}>
                            This case needs discussion. {item.challenge.reason}{" "}
                            {item.mechanicalIssues.length > 0
                              ? "A structural check also flagged this recommendation; treat it as unresolved."
                              : ""}
                          </Alert>
                        )}
                        {!!item.interProposalIssues?.length && (
                          <Alert severity="warning" sx={{ mb: 3 }}>
                            {item.interProposalIssues.join(" ")}
                          </Alert>
                        )}
                        <Typography sx={{ mb: 2 }}>
                          <strong>Example:</strong> {item.analysis.example}
                        </Typography>
                        <Typography sx={{ mb: 2 }}>
                          <strong>Reason to be cautious:</strong>{" "}
                          {item.analysis.caution ||
                            "No additional concern was supplied by the model."}
                        </Typography>
                        <Accordion>
                          <AccordionSummary
                            expandIcon={<span aria-hidden="true">＋</span>}
                          >
                            Reasoning and alternatives
                          </AccordionSummary>
                          <AccordionDetails>
                            {item.analysis.proposedParents.map((p) => (
                              <Typography key={p.nodeId} sx={{ mb: 1.5 }}>
                                <strong>{title(p.nodeId)}:</strong> {p.reason}{" "}
                                {p.whyCloser}
                              </Typography>
                            ))}
                            {item.analysis.alternatives.map((p) => (
                              <Typography key={p.nodeId} sx={{ mb: 1 }}>
                                <strong>Why not {title(p.nodeId)}?</strong>{" "}
                                {p.whyNotPreferred}
                              </Typography>
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      </CardContent>
                    </Card>
                    <FeedbackForm
                      key={session.reviewerKey + data.version + item.id}
                      item={item}
                      session={session}
                      memory={drafts.current}
                      onSaved={(answer) =>
                        setSession((s) =>
                          s &&
                          (!s.feedback[answer.caseId] ||
                            s.feedback[answer.caseId].revision <=
                              answer.revision)
                            ? {
                                ...s,
                                feedback: {
                                  ...s.feedback,
                                  [answer.caseId]: answer,
                                },
                              }
                            : s,
                        )
                      }
                    />
                    <Stack direction="row" justifyContent="space-between">
                      <Button
                        variant="outlined"
                        disabled={index <= 0}
                        onClick={() => navigate(index - 1)}
                      >
                        Previous
                      </Button>
                      <Typography sx={{ alignSelf: "center" }}>
                        {Math.min(index + 1, items.length)} / {items.length}
                      </Typography>
                      <Button
                        variant="outlined"
                        disabled={index >= items.length - 1}
                        onClick={() => navigate(index + 1)}
                      >
                        Next
                      </Button>
                    </Stack>
                    <Accordion>
                      <AccordionSummary
                        expandIcon={<span aria-hidden="true">＋</span>}
                      >
                        Activity meanings and current context
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography component="h3" variant="h6">
                          {item.title}
                        </Typography>
                        {item.meetingEvidence && (
                          <Alert severity="info" sx={{ my: 2 }}>
                            Tom previously described Reason as a fallback under
                            Create information. This analysis includes that
                            history; it does not assume every current child
                            belongs there.
                          </Alert>
                        )}
                        <Typography sx={{ whiteSpace: "pre-wrap", mb: 2 }}>
                          {item.description || "No description recorded."}
                        </Typography>
                        <Typography sx={{ mb: 2 }}>
                          <strong>Meaning tested by the model:</strong>{" "}
                          {item.analysis.meaning}
                        </Typography>
                        <Typography sx={{ mb: 2 }}>
                          <strong>Definition concern:</strong>{" "}
                          {item.analysis.definitionConflict || "None supplied."}
                        </Typography>
                        {item.currentParents.map((p) => (
                          <Box key={p.id} sx={{ mb: 2 }}>
                            <Typography component="h4" variant="h6">
                              {p.title}
                            </Typography>
                            <Typography>
                              {p.description || "No description recorded."}
                            </Typography>
                            {item.analysis.currentLinks
                              .filter((l) => l.parentId === p.id)
                              .map((l) => (
                                <Box key={l.parentId}>
                                  <Typography>{l.reason}</Typography>
                                  <Typography>
                                    <strong>Counterexample considered:</strong>{" "}
                                    {l.counterexample}
                                  </Typography>
                                </Box>
                              ))}
                          </Box>
                        ))}
                        <Typography>
                          <strong>Current immediate children:</strong>{" "}
                          {item.children.map((n) => n.title).join("; ") ||
                            "None."}
                        </Typography>
                        {data.candidates
                          .filter(
                            (n) =>
                              item.analysis.proposedParents.some(
                                (p) => p.nodeId === n.id,
                              ) ||
                              item.analysis.alternatives.some(
                                (p) => p.nodeId === n.id,
                              ),
                          )
                          .filter(
                            (n) =>
                              !item.currentParents.some((p) => p.id === n.id),
                          )
                          .map((n) => (
                            <Box key={n.id} sx={{ mt: 2 }}>
                              <Typography component="h4" variant="h6">
                                {n.title}
                              </Typography>
                              <Typography>
                                {n.description || "No description recorded."}
                              </Typography>
                            </Box>
                          ))}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 2 }}
                        >
                          Current descriptions and placements are context to
                          examine, not independently validated definitions.
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 2 }}
                        >
                          {data.usefulnessNote}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                    <Accordion>
                      <AccordionSummary
                        expandIcon={<span aria-hidden="true">＋</span>}
                      >
                        Agents and prompts used for this proposal
                      </AccordionSummary>
                      <AccordionDetails sx={{ overflowWrap: "anywhere" }}>
                        <Typography>
                          {data.model} · {data.modelVersion} · {data.reasoning}{" "}
                          reasoning · {data.fundingRoute}
                        </Typography>
                        <Typography sx={{ mt: 1 }}>
                          Source: {data.sourceApp}, captured{" "}
                          {data.sourceCapturedAt}. {data.scopeExplanation}
                        </Typography>
                        <Typography sx={{ mt: 1 }}>
                          {data.candidateLimit}
                        </Typography>
                        <Typography sx={{ mt: 2 }}>
                          <strong>Challenge pass:</strong>{" "}
                          {item.challenge.reason}{" "}
                          {item.challenge.issues.join(" ")}
                        </Typography>
                        <Typography sx={{ mt: 2 }}>
                          <strong>Deterministic checks:</strong> source IDs and
                          coverage; complete parent assessment; matching
                          keep/change status; no duplicate, self, descendant or
                          heading parent; supported candidate references. These
                          checks do not establish semantic correctness.
                        </Typography>
                        <Typography
                          component="pre"
                          sx={{ whiteSpace: "pre-wrap", fontSize: 13, mt: 2 }}
                        >
                          {data.prompt}
                        </Typography>
                        <Typography
                          component="pre"
                          sx={{ whiteSpace: "pre-wrap", fontSize: 13, mt: 2 }}
                        >
                          {data.challengePrompt}
                        </Typography>
                        <Typography
                          component="pre"
                          sx={{ whiteSpace: "pre-wrap", fontSize: 12, mt: 2 }}
                        >
                          {JSON.stringify(
                            {
                              datasetVersion: data.version,
                              datasetSha256: session.datasetSha256,
                              sourceSha256: data.sourceSha256,
                              subjectNodeId: item.id,
                              responseId: item.responseId,
                              requestSha256: item.requestSha256,
                              challengeResponseId: item.challengeResponseId,
                              mechanicalIssues: item.mechanicalIssues,
                            },
                            null,
                            2,
                          )}
                        </Typography>
                        <ExactTrace
                          key={item.id}
                          caseId={item.id}
                          preview={session.preview}
                        />
                      </AccordionDetails>
                    </Accordion>
                  </Stack>
                )}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 4 }}
                >
                  All suggestions await expert review. Saving an answer never
                  changes an ontology node or relationship.
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </ScopedCssBaseline>
    </ThemeProvider>
  );
}
