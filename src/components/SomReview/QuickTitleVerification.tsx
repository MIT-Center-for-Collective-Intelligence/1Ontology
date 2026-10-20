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
  FormHelperText,
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
import { postQuickReview } from "@components/lib/titleValidation/quickRequest";
import { sourceReviewCsv } from "@components/lib/titleValidation/sourceCsv";
import type { QuickPayload } from "@components/lib/titleValidation/quick";
import type { sourceSession } from "@components/lib/titleValidation/sourceReview";
import {
  recoverBrowserDraft,
  ReviewDraftWriter,
  type DraftFrame,
} from "@components/lib/titleValidation/draftSync";

type View = ReturnType<typeof sourceSession> & {
  preview: boolean;
  canUseReviewLinks?: boolean;
};
const labels = [
  { value: "acceptable", label: "Acceptable" },
  { value: "not_acceptable", label: "Not acceptable" },
  { value: "unsure", label: "I’m not sure" },
];
// Keep one stable local identity so removing the test-account switcher does not
// discard existing preview drafts. Production always uses the signed-in user.
const previewReviewer = "preview-a";
const message = (e: any) =>
  e?.response?.data?.error ||
  (typeof e === "string" ? e : "") ||
  e?.message ||
  "Your answer could not be saved. Please retry.";
const questionIssues = (view: View, payload: QuickPayload) =>
  Object.fromEntries(
    view.questions.flatMap((q) => {
      const rating = payload.ratings[q.id];
      if (!rating || !labels.some((r) => r.value === rating.value))
        return [[q.id, "Choose one of the three ratings before continuing."]];
      if (
        ["not_acceptable", "unsure"].includes(rating.value) &&
        !rating.explanation?.trim()
      )
        return [[q.id, "Please explain this answer before continuing."]];
      return [];
    }),
  );
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
    [validationAttempted, setValidationAttempted] = useState(false),
    [paused, setPaused] = useState(false),
    [draftError, setDraftError] = useState(""),
    [exporting, setExporting] = useState<"self" | "team" | null>(null),
    [exportError, setExportError] = useState<{
      scope: "self" | "team";
      text: string;
    } | null>(null),
    [recoveryFeedback, setRecoveryFeedback] = useState<{
      severity: "success" | "error";
      text: string;
    } | null>(null),
    [download, setDownload] = useState<{
      url: string;
      filename: string;
      label: string;
    } | null>(null),
    [emails, setEmails] = useState(""),
    [reviewerFeedback, setReviewerFeedback] = useState<{
      severity: "success" | "error";
      text: string;
    } | null>(null);
  const viewRef = useRef<View | null>(null),
    payloadRef = useRef<QuickPayload | null>(null),
    revision = useRef(0),
    busyRef = useRef(false),
    pendingRef = useRef<any>(null),
    blocked = useRef(false),
    pausedRef = useRef(false),
    lastActiveTick = useRef(Date.now()),
    writerRef = useRef<ReviewDraftWriter<View> | null>(null),
    checkpointJournal = useRef<DraftFrame | undefined>(),
    editTimer = useRef<number | undefined>(),
    downloadUrl = useRef<string | null>(null),
    csvDownloadUrl = useRef<string | null>(null),
    exportRef = useRef(false);
  const context = {
    pool: flagged ? "flagged" : "regular",
    qa,
    sourceReview: true,
    ...(preview ? { previewReviewer } : {}),
  };
  async function request(action: string, extra: object = {}): Promise<any> {
    const path =
        "/som-review/title-validation/quick-" +
        (action === "manage" ? "" : "source-") +
        action,
      body = {
        ...context,
        ...extra,
        packageVersion: viewRef.current?.datasetVersion,
      };
    return postQuickReview(path, body, preview);
  }
  const draftKey = (v: View) =>
    `source-title-draft:${v.datasetVersion}:${v.reviewerKey}:${v.item?.id}`;
  const pendingKey = (v: View) =>
    `source-title-pending:${v.datasetVersion}:${v.reviewerKey}:${flagged ? "flagged" : "regular"}`;
  const pauseKey = (v: View) =>
    `source-title-paused:${v.datasetVersion}:${v.reviewerKey}:${v.item?.id}`;
  function applyView(next: View, recover = true) {
    setValidationAttempted(false);
    viewRef.current = next;
    setView(next);
    revision.current = next.draft?.revision || 0;
    let p = next.draft?.payload || null;
    const local = recover ? storage.get(draftKey(next)) : null;
    if (recover && p) {
      try {
        p = recoverBrowserDraft(next.draft!, local).payload;
        if (local) setNotice("Your unfinished review has been restored.");
      } catch (e) {
        blocked.current = true;
        p = local.payload;
        setError(message(e));
      }
    }
    payloadRef.current = p;
    setPayload(p);
    checkpointJournal.current = undefined;
    setDraftError("");
    const writer = next.draft
      ? new ReviewDraftWriter<View>(
          next.draft,
          (attempt) => request("checkpoint", attempt),
          () => request("session"),
          (attempt) => {
            if (writerRef.current !== writer) return;
            checkpointJournal.current = attempt;
            revision.current = writer!.revision;
            persistDraft();
          },
          (saved) => {
            if (writerRef.current !== writer) return;
            revision.current = saved.draft!.revision;
            viewRef.current = saved;
            setView(saved);
            setDraftError("");
          },
        )
      : null;
    writerRef.current = writer;
    // A mismatched draft is preserved until the reviewer explicitly reloads it.
    if (!blocked.current) persistDraft();
    pausedRef.current = Boolean(next.item && storage.get(pauseKey(next)));
    setPaused(pausedRef.current);
    lastActiveTick.current = Date.now();
  }
  async function load() {
    window.clearTimeout(editTimer.current);
    setError("");
    setBusy(true);
    busyRef.current = true;
    blocked.current = false;
    try {
      await writerRef.current?.settle();
      let next: View = await request("session");
      const old = storage.get(pendingKey(next));
      if (old) {
        try {
          const delivery = old.awaitingCheckpoint
            ? {
                payload: old.payload,
                revision: recoverBrowserDraft(
                  next.draft!,
                  storage.get(draftKey(next)),
                ).revision,
              }
            : old;
          storage.set(pendingKey(next), delivery);
          next = await request("respond", delivery);
          storage.remove(pendingKey(next));
          setNotice(
            "Your previous submission was recovered and confirmed saved.",
          );
        } catch (e: any) {
          if (e?.status !== 400) throw e;
          // A definite rejection can be corrected. Preserve even an older
          // browser's frozen submission when no newer local draft exists.
          const local = storage.get(draftKey(next));
          if (
            old.payload?.caseId === next.item?.id &&
            old.payload?.submissionId === next.draft?.payload.submissionId &&
            old.revision === next.draft?.revision &&
            (!local || local.payload?.activeTimeMs < old.payload.activeTimeMs)
          )
            storage.set(draftKey(next), {
              payload: old.payload,
              revision: old.revision,
            });
          storage.remove(pendingKey(next));
          pendingRef.current = null;
          setPending(false);
          applyView(next);
          setValidationAttempted(true);
          setError(
            message(e) +
              " Your choices are still here; complete the highlighted questions and save again.",
          );
          return;
        }
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
  }, [flagged, qa]); // Request identity stays fixed for each mounted reviewer page.
  useEffect(
    () => () => {
      window.clearTimeout(editTimer.current);
      writerRef.current = null;
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      if (csvDownloadUrl.current) URL.revokeObjectURL(csvDownloadUrl.current);
    },
    [],
  );
  function persistDraft() {
    const v = viewRef.current;
    if (
      v &&
      payloadRef.current &&
      !storage.set(draftKey(v), {
        payload: payloadRef.current,
        revision: revision.current,
        ...(checkpointJournal.current
          ? { checkpoint: checkpointJournal.current }
          : {}),
      })
    )
      setNotice(
        "Browser recovery is unavailable. Keep this page open until your answer is saved.",
      );
  }
  function update(p: QuickPayload, edited = true) {
    payloadRef.current = p;
    persistDraft();
    if (edited) {
      setPayload(p);
      window.clearTimeout(editTimer.current);
      editTimer.current = window.setTimeout(() => {
        save(false);
      }, 2000);
    }
  }
  function recordActiveTime() {
    const now = Date.now(),
      delta = Math.max(0, Math.min(2000, now - lastActiveTick.current));
    lastActiveTick.current = now;
    if (
      document.visibilityState === "visible" &&
      !pausedRef.current &&
      !pendingRef.current &&
      payloadRef.current &&
      !blocked.current
    )
      update(
        {
          ...payloadRef.current,
          activeTimeMs: payloadRef.current.activeTimeMs + delta,
        },
        false,
      );
  }
  function togglePause() {
    if (!viewRef.current?.item || pendingRef.current) return;
    // Flush the last fraction of active time before pausing; on resume this
    // resets the clock while still paused, so none of the break is counted.
    recordActiveTime();
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    storage.set(pauseKey(viewRef.current), pausedRef.current);
    if (pausedRef.current) save(false);
  }
  async function save(final: boolean) {
    if (!final) {
      const writer = writerRef.current;
      if (
        busyRef.current ||
        pendingRef.current ||
        !writer ||
        !payloadRef.current ||
        blocked.current ||
        writer.writing
      )
        return;
      recordActiveTime();
      try {
        await writer.checkpoint(payloadRef.current);
      } catch (e: any) {
        if (writerRef.current !== writer) return;
        setDraftError("Your changes are kept on this device. " + message(e));
        if ((e?.status || e?.response?.status) === 409) {
          blocked.current = true;
          setError(message(e));
        }
      }
      return;
    }
    if (
      busyRef.current ||
      !payloadRef.current ||
      !viewRef.current ||
      blocked.current ||
      (final && pausedRef.current)
    )
      return;
    recordActiveTime();
    const v = viewRef.current;
    if (final && !pendingRef.current) {
      setValidationAttempted(true);
      const first = Object.keys(questionIssues(v, payloadRef.current))[0];
      if (first) {
        document.getElementById("quick-question-" + first)?.focus();
        return;
      }
    }
    window.clearTimeout(editTimer.current);
    let body = pendingRef.current || {
      payload: JSON.parse(JSON.stringify(payloadRef.current)),
      awaitingCheckpoint: true,
    };
    pendingRef.current = body;
    setPending(true);
    storage.set(pendingKey(v), body);
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (body.awaitingCheckpoint) {
        await writerRef.current?.settle();
        body = {
          payload: body.payload,
          revision: writerRef.current?.revision ?? revision.current,
        };
        pendingRef.current = body;
        storage.set(pendingKey(v), body);
      }
      const next: View = await request("respond", body);
      storage.remove(pendingKey(v));
      storage.remove(draftKey(v));
      storage.remove(pauseKey(v));
      pendingRef.current = null;
      setPending(false);
      setNotice("Your answer and review time are saved.");
      applyView(next, false);
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
        setError(
          message(e) + " Refresh this page to recover the saved review.",
        );
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
    lastActiveTick.current = Date.now();
    const timer = window.setInterval(recordActiveTime, 1000),
      checkpoint = window.setInterval(() => {
        save(false);
      }, 30000);
    const visibility = () => {
      lastActiveTick.current = Date.now();
      if (document.visibilityState === "hidden") save(false);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      clearInterval(checkpoint);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [caseKey, flagged, qa]);
  async function manage(operation: string) {
    if (
      operation === "expand" &&
      !window.confirm(
        "Open the reserved 75 unflagged activities for all assigned reviewers? Existing answers will remain saved.",
      )
    )
      return;
    setBusy(true);
    busyRef.current = true;
    setReviewerFeedback(null);
    try {
      await writerRef.current?.settle();
      const result = await request("manage", {
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
      if (operation === "add")
        setReviewerFeedback({
          severity: "success",
          text:
            [
              result.addedReviewers?.length
                ? `Added as reviewer: ${result.addedReviewers.join(", ")}.`
                : "",
              result.alreadyAssigned?.length
                ? `Already has reviewer access: ${result.alreadyAssigned.join(", ")}.`
                : "",
            ]
              .filter(Boolean)
              .join(" ") || "Reviewer access confirmed.",
        });
    } catch (e) {
      setError(message(e));
      if (operation === "add")
        setReviewerFeedback({ severity: "error", text: message(e) });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  async function exportReviews(scope: "self" | "team") {
    if (exportRef.current) return;
    exportRef.current = true;
    setExporting(scope);
    setExportError(null);
    try {
      const result = await request("export", { scope });
      const url = URL.createObjectURL(
        new Blob([sourceReviewCsv(result)], { type: "text/csv;charset=utf-8" }),
      );
      if (csvDownloadUrl.current) URL.revokeObjectURL(csvDownloadUrl.current);
      csvDownloadUrl.current = url;
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "title-review-" + scope + "-" + view?.datasetVersion + ".csv";
      a.style.display = "none";
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        a.remove();
      }
    } catch (e) {
      setExportError({ scope, text: message(e) });
    } finally {
      exportRef.current = false;
      setExporting(null);
    }
  }
  function publishDownload(blob: Blob, filename: string, label: string) {
    const url = URL.createObjectURL(blob);
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    downloadUrl.current = url;
    setDownload({ url, filename, label });
  }
  async function recoverConflict() {
    const v = viewRef.current;
    if (!v || !payloadRef.current) return;
    const copy = {
      payload: payloadRef.current,
      revision: revision.current,
      checkpoint: checkpointJournal.current,
      pending: pendingRef.current,
    };
    publishDownload(
      new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" }),
      "unsent-review-recovery.json",
      "Download my unsent choices",
    );
    if (!storage.set(draftKey(v) + ":recovery:" + Date.now(), copy)) {
      setRecoveryFeedback({
        severity: "error",
        text: "This browser could not keep a recovery copy. Download your unsent choices before reloading.",
      });
      return;
    }
    storage.remove(draftKey(v));
    storage.remove(pendingKey(v));
    pendingRef.current = null;
    setPending(false);
    writerRef.current = null;
    setRecoveryFeedback({
      severity: "success",
      text: "Your unsent choices are preserved in a separate recovery copy. The form now loads the saved version.",
    });
    await load();
  }
  // Background checkpoints leave fields editable; a break or final delivery locks them.
  const frozen = pending || paused || blocked.current;
  const showOptionalComments = Object.values(payload?.ratings || {}).some(
    (rating) => rating.value === "not_acceptable",
  );
  const issues =
    validationAttempted && view && payload ? questionIssues(view, payload) : {};
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
              unfamiliar with the occupation. Review all the linked activities
              together on this page. Each proposed title has its own rating.
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
            {error && (!view?.item || !payload) && (
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
                {busy ? "Loading your review…" : "Try loading again"}
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
                        {preview ? "Local preview" : view.reviewerLabel} ·{" "}
                        {view.completed} of {view.total} O*NET descriptions
                        saved
                      </Typography>
                      {view.item && payload && (
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography role="status" sx={{ fontWeight: 600 }}>
                            <Box
                              component="span"
                              aria-hidden="true"
                              sx={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: paused
                                  ? "text.disabled"
                                  : "success.main",
                                mr: 1,
                              }}
                            />
                            {paused ? "Paused" : "Reviewing"}
                          </Typography>
                          <Button
                            variant="outlined"
                            onClick={togglePause}
                            disabled={pending}
                          >
                            {paused ? "Resume review" : "Pause review"}
                          </Button>
                        </Stack>
                      )}
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
                      Drafts save automatically. Save and continue submits this
                      page.
                    </Typography>
                    {draftError && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        {draftError}{" "}
                        {!blocked.current && (
                          <Button onClick={() => save(false)}>
                            Retry draft save
                          </Button>
                        )}
                      </Alert>
                    )}
                    {blocked.current && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        Your unsent choices are still here. To use the version
                        saved by another tab, keep a recovery copy and reload
                        it.
                        <Button onClick={recoverConflict}>
                          Keep my copy and load saved version
                        </Button>
                      </Alert>
                    )}
                    {paused && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        Review paused. Resume when you’re ready to continue.
                      </Alert>
                    )}
                    {view.historicalCompleted > 0 && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                      >
                        Your {view.historicalCompleted} earlier activity reviews
                        are preserved. Their proposed-title ratings are filled
                        in below when available. Progress here counts the new
                        pages that show all linked activities together.
                      </Typography>
                    )}
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
                          {view.item.activities.length} linked{" "}
                          {view.item.activities.length === 1
                            ? "activity"
                            : "activities"}{" "}
                          · {view.questions.length} proposed{" "}
                          {view.questions.length === 1 ? "title" : "titles"} to
                          review
                        </Typography>
                      </CardContent>
                    </Card>
                    <Stack
                      component="form"
                      noValidate
                      spacing={2}
                      onSubmit={(e) => {
                        e.preventDefault();
                        save(true);
                      }}
                    >
                      {Object.keys(issues).length > 0 && (
                        <Alert severity="error">
                          Please complete the highlighted questions before
                          saving. Your choices and review time are still here.
                        </Alert>
                      )}
                      {view.questions.map((q) => (
                        <Card key={q.id}>
                          <CardContent>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              Original activity: {q.originalTitle}
                            </Typography>
                            <FormControl
                              component="fieldset"
                              fullWidth
                              disabled={frozen}
                              error={Boolean(issues[q.id])}
                              id={"quick-question-" + q.id}
                              tabIndex={-1}
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
                              {view.draft?.legacyReferences.some(
                                (r) => r.questionId === q.id,
                              ) && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mb: 1 }}
                                >
                                  Your earlier rating has been restored. Your
                                  original review remains saved.
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
                              {issues[q.id] && (
                                <FormHelperText>{issues[q.id]}</FormHelperText>
                              )}
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
                            <Accordion
                              disableGutters
                              elevation={0}
                              sx={{ mt: 1 }}
                            >
                              <AccordionSummary>
                                Model explanation
                              </AccordionSummary>
                              <AccordionDetails sx={{ whiteSpace: "pre-wrap" }}>
                                {q.reason}
                              </AccordionDetails>
                            </Accordion>
                          </CardContent>
                        </Card>
                      ))}
                      {view.item.activities
                        .filter((a) => !a.proposals.length)
                        .map((a) => (
                          <Alert key={a.id} severity="warning">
                            <strong>{a.currentTitle}</strong> is also linked to
                            this description, but has no saved model proposal.
                            There is no proposed title to rate. This missing
                            output remains recorded for follow-up.
                          </Alert>
                        ))}
                      {showOptionalComments && (
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
                      )}
                      <Button
                        type="submit"
                        size="large"
                        variant="contained"
                        disabled={busy || paused || blocked.current}
                      >
                        {busy
                          ? "Saving…"
                          : pending
                            ? "Retry saving this answer"
                            : "Save and continue"}
                      </Button>
                      {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                  </Box>
                ) : (
                  <Alert severity="success">
                    You have finished the {view.total} O*NET descriptions
                    currently assigned to you. Your answers and timing are
                    saved.
                    {!flagged && view.regularLimit === 25
                      ? " Rob and Iman will let you know when the next batch is ready."
                      : ""}
                  </Alert>
                )}
                <Card sx={{ mt: 3 }}>
                  <CardContent>
                    <Typography fontWeight={600}>
                      Download submitted reviews
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, mb: 2 }}
                    >
                      Your CSV includes your submitted answers and timing,
                      including earlier reviews. Unsubmitted drafts are not
                      included.
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                      <Button
                        variant="outlined"
                        onClick={() => exportReviews("self")}
                        disabled={
                          exporting !== null ||
                          !(
                            view.exports?.ownSubmitted ??
                            view.completed + (view.historicalCompleted || 0)
                          )
                        }
                      >
                        {exporting === "self"
                          ? "Preparing your CSV…"
                          : "Download my reviews and timing (CSV)"}
                      </Button>
                    </Stack>
                    {!(
                      view.exports?.ownSubmitted ??
                      view.completed + (view.historicalCompleted || 0)
                    ) && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Submit a review to make your CSV available.
                      </Typography>
                    )}
                    {exportError?.scope === "self" && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        {exportError.text}
                      </Alert>
                    )}
                    {recoveryFeedback && (
                      <Alert
                        severity={recoveryFeedback.severity}
                        sx={{ mt: 2 }}
                      >
                        {recoveryFeedback.text}
                      </Alert>
                    )}
                    {download && (
                      <Button
                        component="a"
                        href={download.url}
                        download={download.filename}
                        sx={{ mt: 1 }}
                      >
                        {download.label}
                      </Button>
                    )}
                  </CardContent>
                </Card>
                {view.canUseReviewLinks && (
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
                        {flagged
                          ? "Regular activities"
                          : "Rob’s flagged review"}
                      </Button>
                    )}
                    {/* Earlier pilot navigation temporarily hidden; keep its route and reviews.
                    <Button href="/review/title-validation?workflow=earlier">
                      Earlier five-activity pilot
                    </Button>
                    */}
                  </Stack>
                )}
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
                        {quickCoordinatorCopy(view.selectionVersion, true)}
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        label="Existing reviewer account emails, one per line"
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        helperText="Create an ontology account first. Adding a reviewer gives that existing account access to this review."
                      />
                      {reviewerFeedback && (
                        <Alert
                          severity={reviewerFeedback.severity}
                          sx={{ mt: 2 }}
                        >
                          {reviewerFeedback.text}
                        </Alert>
                      )}
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
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 3, mb: 1 }}
                      >
                        Download all submitted team reviews and timing at any
                        point, even while your own reviews are in progress.
                        Unsubmitted drafts are not included.
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => exportReviews("team")}
                        disabled={
                          exporting !== null || !view.exports?.teamAllowed
                        }
                      >
                        {exporting === "team"
                          ? "Preparing team CSV…"
                          : "Download team reviews and timing (CSV)"}
                      </Button>
                      {exportError?.scope === "team" && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          {exportError.text}
                        </Alert>
                      )}
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
