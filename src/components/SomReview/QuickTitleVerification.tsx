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
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  ScopedCssBaseline,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { titleValidationTheme } from "./titleValidationDesign";
import { Post } from "@components/lib/utils/Post";
import { quickReviewCsv } from "@components/lib/titleValidation/quickCsv";
import type {
  QuickPayload,
  quickSession,
} from "@components/lib/titleValidation/quick";

type View = ReturnType<typeof quickSession> & { preview: boolean };
const labels = [
  { value: "acceptable", label: "Acceptable" },
  { value: "not_acceptable", label: "Not acceptable" },
  { value: "unsure", label: "I’m not sure" },
];
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const message = (e: any) =>
  e?.response?.data?.error ||
  e?.message ||
  "Your answer could not be saved. Please retry.";
const storage = {
  get: (key: string) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  },
  set: (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* optional browser storage */
    }
  },
};

export default function QuickTitleVerification({
  preview = false,
  flagged = false,
  qa = false,
}: {
  preview?: boolean;
  flagged?: boolean;
  qa?: boolean;
}) {
  const [view, setView] = useState<View | null>(null),
    [payload, setPayload] = useState<QuickPayload | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [reviewer, setReviewer] = useState("preview-a"),
    [emails, setEmails] = useState("");
  const viewRef = useRef<View | null>(null),
    payloadRef = useRef<QuickPayload | null>(null),
    revision = useRef(0),
    busyRef = useRef(false),
    pendingRef = useRef<any>(null),
    blocked = useRef(false);
  const context = {
    pool: flagged ? "flagged" : "regular",
    qa,
    ...(preview ? { previewReviewer: reviewer } : {}),
  };
  async function request(action: string, extra: object = {}): Promise<any> {
    const path = "/som-review/title-validation/quick-" + action,
      body = { ...context, ...extra };
    if (!preview) return Post(path, body, false);
    const response = await fetch("/api" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(data.error), { status: response.status });
    return data;
  }
  const draftKey = (v: View) =>
    `quick-title-draft:${v.datasetVersion}:${v.reviewerKey}:${v.item?.id}`;
  const pendingKey = (v: View) =>
    `quick-title-pending:${v.reviewerKey}:${flagged ? "flagged" : "regular"}`;
  function applyView(next: View, recover = true) {
    viewRef.current = next;
    setView(next);
    revision.current = next.draft?.revision || 0;
    let p = next.draft?.payload || null;
    if (recover && p) {
      const local = storage.get(draftKey(next));
      if (
        local?.revision === revision.current &&
        local.payload?.caseId === p.caseId &&
        local.payload.activeTimeMs >= p.activeTimeMs
      ) {
        p = local.payload;
        setNotice("Your unfinished answers and timer have been restored.");
      }
    }
    payloadRef.current = p;
    setPayload(p);
  }
  async function load() {
    setError("");
    setBusy(true);
    busyRef.current = true;
    blocked.current = false;
    try {
      let next: View = await request("session");
      const old = storage.get(pendingKey(next));
      if (old) {
        next = await request("respond", old);
        storage.remove(pendingKey(next));
        setNotice(
          "Your previous submission was recovered and confirmed saved.",
        );
      }
      pendingRef.current = null;
      setPending(false);
      applyView(next);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  useEffect(() => {
    load();
  }, [reviewer, flagged, qa]); // Request identity stays fixed for each mounted reviewer page.
  function update(p: QuickPayload) {
    payloadRef.current = p;
    setPayload(p);
    const v = viewRef.current;
    if (
      v &&
      !storage.set(draftKey(v), { payload: p, revision: revision.current })
    )
      setNotice(
        "Browser recovery is unavailable. Keep this page open until your answer is saved.",
      );
  }
  async function save(final: boolean) {
    if (
      busyRef.current ||
      !payloadRef.current ||
      !viewRef.current ||
      blocked.current
    )
      return;
    const v = viewRef.current;
    const body = pendingRef.current || {
      payload: JSON.parse(JSON.stringify(payloadRef.current)),
      revision: revision.current,
    };
    if (!final && pendingRef.current) return;
    if (final) {
      pendingRef.current = body;
      setPending(true);
      storage.set(pendingKey(v), body);
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const next: View = await request(final ? "respond" : "checkpoint", body);
      if (final) {
        storage.remove(pendingKey(v));
        storage.remove(draftKey(v));
        pendingRef.current = null;
        setPending(false);
        setNotice("Your answer and review time are saved.");
        applyView(next, false);
      } else {
        revision.current = next.draft!.revision;
        viewRef.current = next;
        setView(next);
        storage.set(draftKey(next), {
          payload: payloadRef.current,
          revision: revision.current,
        });
        setNotice("Draft and review time saved.");
      }
    } catch (e: any) {
      setError(message(e));
      const status = e?.status || e?.response?.status;
      if (status === 400) {
        pendingRef.current = null;
        setPending(false);
        storage.remove(pendingKey(v));
      }
      if (status === 409) {
        blocked.current = true;
        setError(message(e) + " Use Reload saved review below.");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const caseKey = view?.item?.id;
  useEffect(() => {
    if (caseKey) document.getElementById("quick-review-heading")?.focus();
  }, [caseKey]);
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now(),
        delta = Math.max(0, Math.min(2000, now - last));
      last = now;
      if (
        document.visibilityState === "visible" &&
        !pendingRef.current &&
        payloadRef.current &&
        !blocked.current
      )
        update({
          ...payloadRef.current,
          activeTimeMs: payloadRef.current.activeTimeMs + delta,
        });
    };
    const timer = window.setInterval(tick, 1000),
      checkpoint = window.setInterval(() => {
        save(false);
      }, 10000);
    const visibility = () => {
      last = Date.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      clearInterval(checkpoint);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [caseKey, reviewer, flagged, qa]);
  async function manage(operation: string) {
    if (
      operation === "expand" &&
      !window.confirm(
        "Open the reserved 75 unflagged activities for all assigned reviewers? Existing answers will remain saved.",
      )
    )
      return;
    setBusy(true);
    try {
      await request("manage", {
        operation,
        reviewers: emails
          .split(/[,\n]/)
          .map((email) => ({ email: email.trim() }))
          .filter((r) => r.email),
      });
      setEmails("");
      await load();
      setNotice(
        operation === "expand"
          ? "The additional 75 activities are now available."
          : "Reviewer access updated.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportReviews() {
    try {
      const result = await request("export"),
        url = URL.createObjectURL(
          new Blob([quickReviewCsv(result)], {
            type: "text/csv;charset=utf-8",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "title-review-" + view?.datasetVersion + ".csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(message(e));
    }
  }
  // Background checkpoints must not interrupt typing. Only final delivery freezes an answer.
  const frozen = pending;
  return (
    <ThemeProvider theme={titleValidationTheme}>
      <ScopedCssBaseline>
        <Head>
          <title>Review activity titles</title>
        </Head>
        <Box
          component="main"
          sx={{
            minHeight: "100vh",
            background: "#f4f6f8",
            py: { xs: 2, md: 5 },
            px: 2,
          }}
        >
          <Box sx={{ maxWidth: 1120, mx: "auto" }}>
            <Typography variant="overline" color="text.secondary">
              MIT · Ontology of work activities
            </Typography>
            <Typography
              variant="h3"
              component="h1"
              id="quick-review-heading"
              tabIndex={-1}
              sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 700, mt: 1 }}
            >
              Review activity titles
            </Typography>
            <Typography sx={{ mt: 1, mb: 3, maxWidth: 800 }}>
              Read the O*NET description, then judge whether each title clearly
              and accurately describes the relevant activity for someone
              unfamiliar with the occupation. Judge only the activity named in
              the original title.
            </Typography>
            {qa && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Software test only. These answers are stored separately and
                never included in team reviews.
              </Alert>
            )}
            {flagged && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Flagged items — for Rob’s initial review. A keyword flag does
                not mean the proposal is wrong.
              </Alert>
            )}
            {preview && (
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {["preview-a", "preview-b", "preview-c"].map((uid) => (
                  <Button key={uid} onClick={() => setReviewer(uid)}>
                    {uid}
                  </Button>
                ))}
              </Stack>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {notice && (
              <Typography role="status" color="text.secondary" sx={{ mb: 2 }}>
                {notice}
              </Typography>
            )}
            {!view && (
              <Button disabled={busy} onClick={load}>
                {busy ? "Loading your review…" : "Reload saved review"}
              </Button>
            )}
            {view && (
              <>
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography fontWeight={600}>
                        {view.reviewerLabel} · {view.completed} of {view.total}{" "}
                        activities saved
                      </Typography>
                      <Typography aria-live="off">
                        This activity: {clock(payload?.activeTimeMs || 0)} ·
                        Total review time:{" "}
                        {clock(
                          view.savedActiveTimeMs + (payload?.activeTimeMs || 0),
                        )}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(100 * view.completed) / Math.max(1, view.total)}
                      sx={{ mt: 2 }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Timing runs automatically while this tab is visible and
                      pauses when it is hidden. Work in one sitting if
                      practical; note any interruptions below. Drafts save
                      automatically.
                    </Typography>
                  </CardContent>
                </Card>
                {view.item && payload ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "minmax(0,0.9fr) minmax(0,1.1fr)",
                      },
                      gap: 3,
                      alignItems: "start",
                    }}
                  >
                    <Card sx={{ position: { md: "sticky" }, top: 24 }}>
                      <CardContent>
                        <Typography variant="overline">
                          O*NET description
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 18,
                            lineHeight: 1.7,
                            mt: 1,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {view.item.description}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          variant="body2"
                          sx={{ mt: 2 }}
                        >
                          Original activity: {view.item.currentTitle}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {view.item.outcome === "Keep"
                            ? "The model kept the original title."
                            : view.item.outcome === "Split"
                              ? "The model proposed several activities from this description."
                              : "The model proposed one clarified title."}
                        </Typography>
                        <Accordion disableGutters elevation={0} sx={{ mt: 2 }}>
                          <AccordionSummary>Model explanation</AccordionSummary>
                          <AccordionDetails sx={{ whiteSpace: "pre-wrap" }}>
                            {view.item.modelReason}
                          </AccordionDetails>
                        </Accordion>
                      </CardContent>
                    </Card>
                    <Stack
                      component="form"
                      spacing={2}
                      onSubmit={(e) => {
                        e.preventDefault();
                        save(true);
                      }}
                    >
                      {view.questions.map((q) => (
                        <Card key={q.id}>
                          <CardContent>
                            <FormControl
                              component="fieldset"
                              fullWidth
                              disabled={frozen}
                            >
                              <FormLabel
                                component="legend"
                                sx={{
                                  color: "text.primary",
                                  fontWeight: 600,
                                  mb: 1,
                                }}
                              >
                                {q.label}
                              </FormLabel>
                              {q.title && (
                                <Typography
                                  sx={{
                                    fontSize: 20,
                                    fontWeight: 600,
                                    mb: 1,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {q.title}
                                </Typography>
                              )}
                              <RadioGroup
                                row
                                aria-label={q.label}
                                value={payload.ratings[q.id]?.value || ""}
                                onChange={(e) =>
                                  update({
                                    ...payloadRef.current!,
                                    ratings: {
                                      ...payloadRef.current!.ratings,
                                      [q.id]: {
                                        ...payloadRef.current!.ratings[q.id],
                                        value: e.target.value as any,
                                      },
                                    },
                                  })
                                }
                              >
                                {labels.map((r) => (
                                  <FormControlLabel
                                    key={r.value}
                                    value={r.value}
                                    control={<Radio />}
                                    label={r.label}
                                  />
                                ))}
                              </RadioGroup>
                              {["not_acceptable", "unsure"].includes(
                                payload.ratings[q.id]?.value,
                              ) && (
                                <TextField
                                  required
                                  disabled={frozen}
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  label={
                                    payload.ratings[q.id].value === "unsure"
                                      ? "What are you unsure about?"
                                      : "Why is it not acceptable?"
                                  }
                                  value={payload.ratings[q.id].explanation}
                                  inputProps={{ maxLength: 5000 }}
                                  sx={{ mt: 2 }}
                                  onChange={(e) =>
                                    update({
                                      ...payloadRef.current!,
                                      ratings: {
                                        ...payloadRef.current!.ratings,
                                        [q.id]: {
                                          ...payloadRef.current!.ratings[q.id],
                                          explanation: e.target.value,
                                        },
                                      },
                                    })
                                  }
                                />
                              )}
                            </FormControl>
                          </CardContent>
                        </Card>
                      ))}
                      <Card>
                        <CardContent>
                          <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            disabled={frozen}
                            label="Suggested correction, if useful (optional)"
                            value={payload.correction}
                            inputProps={{ maxLength: 5000 }}
                            onChange={(e) =>
                              update({
                                ...payloadRef.current!,
                                correction: e.target.value,
                              })
                            }
                          />
                          <TextField
                            fullWidth
                            multiline
                            disabled={frozen}
                            label="Interruptions or other comments (optional)"
                            value={payload.interruption}
                            inputProps={{ maxLength: 5000 }}
                            sx={{ mt: 2 }}
                            onChange={(e) =>
                              update({
                                ...payloadRef.current!,
                                interruption: e.target.value,
                              })
                            }
                          />
                        </CardContent>
                      </Card>
                      <Button
                        type="submit"
                        size="large"
                        variant="contained"
                        disabled={busy}
                      >
                        {busy
                          ? "Saving…"
                          : pending
                            ? "Retry saving this answer"
                            : "Save and continue"}
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Alert severity="success">
                    You have finished the {view.total} activities currently
                    assigned to you. Your answers and timing are saved.
                    {!flagged && view.regularLimit === 25
                      ? " Rob and Iman will let you know when the next batch is ready."
                      : ""}
                  </Alert>
                )}
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mt: 3, flexWrap: "wrap" }}
                >
                  <Button onClick={load} disabled={busy}>
                    Reload saved review
                  </Button>
                  {view.canReviewFlagged && (
                    <Button
                      href={
                        flagged
                          ? "/review/title-validation"
                          : "/review/title-validation?set=flagged"
                      }
                    >
                      {flagged ? "Regular activities" : "Rob’s flagged review"}
                    </Button>
                  )}
                  <Button href="/review/title-validation?workflow=earlier">
                    Earlier five-activity pilot
                  </Button>
                </Stack>
                <Accordion sx={{ mt: 3 }}>
                  <AccordionSummary>
                    Agents and prompts used for these proposals
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {String(
                        view.disclosure.provenance.model || "GPT-6.1 Sol",
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 2, whiteSpace: "pre-wrap" }}
                    >
                      {view.disclosure.prompt}
                    </Typography>
                    <Typography
                      component="pre"
                      sx={{
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(
                        view.disclosure.provenance,
                        (key, value) =>
                          key === "fundingRoute" ? undefined : value,
                        2,
                      )}
                    </Typography>
                    <Typography variant="body2">
                      The software requires a rating for each displayed question
                      and an explanation for rejected or uncertain answers. It
                      checks timing, assignments, and duplicate submissions. It
                      does not establish semantic correctness or apply ontology
                      changes.
                    </Typography>
                  </AccordionDetails>
                </Accordion>
                {view.canManage && (
                  <Accordion sx={{ mt: 2 }}>
                    <AccordionSummary>Coordinator tools</AccordionSummary>
                    <AccordionDetails>
                      <Typography sx={{ mb: 2 }}>
                        {quickCoordinatorCopy(view.selectionVersion)}
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        label="Existing reviewer account emails, one per line"
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                      />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        gap={1}
                        sx={{ mt: 2 }}
                      >
                        <Button
                          disabled={busy || !emails.trim()}
                          onClick={() => manage("add")}
                        >
                          Add reviewers
                        </Button>
                        <Button
                          disabled={
                            busy || view.regularLimit === 100 || flagged || qa
                          }
                          onClick={() => manage("expand")}
                        >
                          Open the next 75 activities
                        </Button>
                        <Button onClick={exportReviews}>
                          Download reviews and timing (CSV)
                        </Button>
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        Participating coordinators finish their regular reviews
                        before downloading other reviewers’ answers. Earlier
                        pilot records are preserved separately.
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                )}
              </>
            )}
          </Box>
        </Box>
      </ScopedCssBaseline>
    </ThemeProvider>
  );
}
import { quickCoordinatorCopy } from "../../lib/titleValidation/quickCoordinatorCopy";
