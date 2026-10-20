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
  Checkbox,
  CircularProgress,
  Chip,
  LinearProgress,
  ScopedCssBaseline,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import {
  titleValidationTheme,
  titleValidationStyles as design,
} from "./titleValidationDesign";
import { Post } from "@components/lib/utils/Post";
import type {
  TitleAdequacy,
  TitleCreationDecision,
  TitleValidationDashboard,
  TitleValidationSession,
  TitleValidationSubmission,
  TitleValidationTask,
} from "@components/types/ITitleValidation";

type Rating = { adequacy: TitleAdequacy | ""; rank: number | null };
type Draft = {
  key: string;
  decision: TitleCreationDecision | "";
  titles: string[];
  ratings: Record<string, Rating>;
  cannotRank: boolean;
  confidence: number | null;
  notes: string;
  activeTimeMs: number;
  pendingSubmission?: TitleValidationSubmission;
};

function initialDraft(task: TitleValidationTask, key: string): Draft {
  return {
    key,
    decision: "",
    titles: [""],
    ratings: Object.fromEntries(
      (task.options ?? []).map((option) => [
        option.id,
        { adequacy: "", rank: null },
      ]),
    ),
    cannotRank: false,
    confidence: null,
    notes: "",
    activeTimeMs: 0,
  };
}

function readDraft(
  key: string,
  task: TitleValidationTask,
  earlierKeys: string[] = [],
): Draft {
  const base = initialDraft(task, key);
  try {
    const savedDrafts = [key, ...earlierKeys]
      .map((candidate) => {
        try {
          return JSON.parse(
            localStorage.getItem(candidate) ?? "null",
          ) as Partial<Draft> | null;
        } catch {
          return null;
        }
      })
      .filter((candidate) => candidate && typeof candidate === "object");
    const saved =
      savedDrafts.find((candidate) => candidate?.pendingSubmission) ||
      savedDrafts.find(
        (candidate) =>
          candidate?.decision ||
          (candidate?.confidence !== null &&
            candidate?.confidence !== undefined) ||
          candidate?.notes ||
          Object.values(candidate?.ratings || {}).some(
            (rating) => rating.adequacy,
          ),
      ) ||
      savedDrafts[0];
    if (!saved || typeof saved !== "object") return base;
    // Older versions let a reviewer pause manually. Restore their answers,
    // but discard that retired UI flag so a paused draft cannot hide the form.
    const { paused: _legacyPause, ...savedFields } = saved as Partial<Draft> & {
      paused?: unknown;
    };
    return {
      ...base,
      ...savedFields,
      key,
      titles: Array.isArray(saved.titles) ? saved.titles : base.titles,
      ratings: Object.fromEntries(
        (task.options ?? []).map((option) => [
          option.id,
          { ...base.ratings[option.id], ...saved.ratings?.[option.id] },
        ]),
      ),
      activeTimeMs:
        typeof saved.activeTimeMs === "number" &&
        Number.isFinite(saved.activeTimeMs)
          ? Math.max(0, saved.activeTimeMs)
          : 0,
    };
  } catch {
    return base;
  }
}

function storeDraft(key: string, draft: Draft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}

function errorText(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  const serverError = (error as { response?: { data?: { error?: unknown } } })
    ?.response?.data?.error;
  if (typeof serverError === "string") return serverError;
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

async function request<T>(
  path: string,
  body: object,
  preview: boolean,
): Promise<T> {
  if (!preview) return (await Post(path, body, false)) as T;
  const response = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : `Request failed (${response.status}).`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data as T;
}

const optionLetter = (index: number): string => String.fromCharCode(65 + index);
const sourceLabels: Record<string, string> = {
  original: "Original titles",
  model: "Model proposals",
  human: "Independent human titles",
};

export default function HumanTitleValidation({
  preview,
  practice = false,
}: {
  preview: boolean;
  practice?: boolean;
}) {
  const [previewReviewer, setPreviewReviewer] = useState("preview-a");
  const [session, setSession] = useState<TitleValidationSession | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [draftStored, setDraftStored] = useState(true);
  const [notice, setNotice] = useState("");
  const [managementStatus, setManagementStatus] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [reviewerLines, setReviewerLines] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboard, setDashboard] = useState<TitleValidationDashboard | null>(
    null,
  );
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const savingRef = useRef(false);
  const requestNumber = useRef(0);
  const lastTick = useRef(Date.now());
  const reviewArea = useRef<HTMLDivElement>(null);
  const taskHeading = useRef<HTMLHeadingElement>(null);
  const advanceFocus = useRef(false);
  const task = session?.task;
  const taskKey =
    task && session
      ? `human-title-validation/${encodeURIComponent(session.studyId)}/${encodeURIComponent(session.reviewerKey)}/${task.stage}/${encodeURIComponent(task.caseId)}`
      : "";
  const identityFor = (reviewer = previewReviewer) =>
    preview
      ? { previewReviewer: reviewer }
      : practice
        ? { workspace: "practice" }
        : {};

  async function refreshSession(
    reviewer = previewReviewer,
    quiet = false,
  ): Promise<TitleValidationSession | undefined> {
    const number = ++requestNumber.current;
    if (!quiet) setLoadingSession(true);
    try {
      const next = await request<TitleValidationSession>(
        "/som-review/title-validation/session",
        identityFor(reviewer),
        preview,
      );
      if (number === requestNumber.current) {
        if (session?.phase === "waiting" && next.task) {
          setNotice("Comparisons are ready. You can continue your review.");
          advanceFocus.current = true;
        }
        setSession(next);
        setLastCheckedAt(Date.now());
        setError("");
      }
      return number === requestNumber.current ? next : undefined;
    } catch (caught) {
      if (number === requestNumber.current) setError(errorText(caught));
      return undefined;
    } finally {
      if (number === requestNumber.current && !quiet) setLoadingSession(false);
    }
  }

  useEffect(() => {
    setSession(null);
    setDashboard(null);
    void refreshSession(previewReviewer);
    // A changed reviewer starts a separate session and draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, practice, previewReviewer]);

  useEffect(() => {
    const earlierKeys =
      practice && session && task
        ? (session.draftReviewerKeys || []).map(
            (key) =>
              `human-title-validation/${encodeURIComponent(session.studyId)}/${encodeURIComponent(key)}/${task.stage}/${encodeURIComponent(task.caseId)}`,
          )
        : [];
    const next = task && taskKey ? readDraft(taskKey, task, earlierKeys) : null;
    setDraft(next);
    setDraftRecovered(
      Boolean(
        next &&
        (next.decision ||
          next.notes ||
          next.pendingSubmission ||
          next.confidence !== null),
      ),
    );
    setInvalidField("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskKey]);

  useEffect(() => {
    if (taskKey && draft?.key === taskKey)
      setDraftStored(storeDraft(taskKey, draft));
  }, [taskKey, draft]);

  useEffect(() => {
    if (!invalidField) return;
    const field = reviewArea.current?.querySelector<HTMLElement>(
      `[data-review-field="${invalidField}"]`,
    );
    const invalidInput =
      invalidField === "titles"
        ? field?.querySelector<HTMLElement>(".Mui-error input")
        : null;
    const rankControl =
      invalidField === "ranks"
        ? field?.querySelector<HTMLElement>('[role="combobox"]')
        : null;
    (
      rankControl ||
      invalidInput ||
      field?.querySelector<HTMLElement>(
        'input:not(:disabled):not([type="hidden"]):not([aria-hidden="true"]), textarea:not(:disabled), [role="combobox"], button:not(:disabled)',
      )
    )?.focus();
  }, [invalidField, error]);

  useEffect(() => {
    if (advanceFocus.current && !saving && (!task || draft?.key === taskKey)) {
      taskHeading.current?.focus();
      advanceFocus.current = false;
    }
  }, [taskKey, draft?.key, session?.phase, saving]);

  useEffect(() => {
    if (
      !taskKey ||
      !draft ||
      draft.key !== taskKey ||
      draft.pendingSubmission ||
      saving
    )
      return;
    const resetClock = () => {
      lastTick.current = Date.now();
    };
    resetClock();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(2000, Math.max(0, now - lastTick.current));
      lastTick.current = now;
      if (!document.hidden && document.hasFocus() && !savingRef.current) {
        setDraft((previous) =>
          previous && !previous.pendingSubmission
            ? { ...previous, activeTimeMs: previous.activeTimeMs + elapsed }
            : previous,
        );
      }
    }, 1000);
    document.addEventListener("visibilitychange", resetClock);
    window.addEventListener("focus", resetClock);
    window.addEventListener("blur", resetClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resetClock);
      window.removeEventListener("focus", resetClock);
      window.removeEventListener("blur", resetClock);
    };
  }, [taskKey, draft?.key, draft?.pendingSubmission, saving]);

  useEffect(() => {
    if (session?.phase !== "waiting") return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshSession(previewReviewer, true);
    }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, previewReviewer]);

  function changeDraft(change: Partial<Draft>): void {
    setDraft((previous) => (previous ? { ...previous, ...change } : previous));
    setError("");
    setInvalidField("");
    setNotice("");
  }

  async function submit(payload: TitleValidationSubmission): Promise<void> {
    if (!session || !task || !taskKey || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const next = await request<TitleValidationSession>(
        "/som-review/title-validation/respond",
        {
          studyId: session.studyId,
          submission: payload,
          ...identityFor(),
        },
        preview,
      );
      if (next.task?.caseId === task.caseId && next.task.stage === task.stage) {
        setSession(next);
        setError(
          "The server still shows this task. Check the current task before continuing.",
        );
      } else {
        removeDraft(taskKey);
        setDraft(null);
        setSession(next);
        setDashboard(null);
        setNotice("Your answer was saved.");
        advanceFocus.current = true;
      }
    } catch (caught) {
      const status =
        (caught as { status?: number; response?: { status?: number } })
          ?.status ??
        (caught as { response?: { status?: number } })?.response?.status;
      if (status && status >= 400 && status < 500) {
        setDraft((previous) =>
          previous ? { ...previous, pendingSubmission: undefined } : previous,
        );
        setError(errorText(caught));
      } else {
        setError(
          `${errorText(caught)} Your answer may have arrived. Retry sends the same answer, or check the current task.`,
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function save(): void {
    if (
      !task ||
      !draft ||
      draft.key !== taskKey ||
      draft.pendingSubmission ||
      savingRef.current
    )
      return;
    if (draft.confidence === null) {
      validationError("Choose your confidence from 1 to 5.", "confidence");
      return;
    }
    let payload: TitleValidationSubmission;
    const submissionId =
      window.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (task.stage === "create") {
      if (!draft.decision) {
        validationError(
          "Choose how you would title this activity.",
          "decision",
        );
        return;
      }
      const titles =
        draft.decision === "keep"
          ? [task.currentTitle]
          : draft.titles.map((title) => title.trim());
      if (
        titles.some((title) => !title || title.length > 400) ||
        new Set(titles).size !== titles.length ||
        titles.length > 20 ||
        (draft.decision === "split" && titles.length < 2)
      ) {
        validationError(
          "Enter every title before saving. Several titles needs at least two.",
          "titles",
        );
        return;
      }
      payload = {
        kind: "create",
        caseId: task.caseId,
        decision: draft.decision,
        titles,
        confidence: draft.confidence,
        notes: draft.notes.trim(),
        activeTimeMs: Math.round(draft.activeTimeMs),
        submissionId,
      };
    } else {
      const options = task.options ?? [];
      if (!options.length) {
        setError("No alternatives are available. Refresh the task.");
        return;
      }
      if (options.some((option) => !draft.ratings[option.id]?.adequacy)) {
        validationError("Judge every alternative before saving.", "ratings");
        return;
      }
      if (
        !draft.cannotRank &&
        options.some((option) => draft.ratings[option.id]?.rank === null)
      ) {
        validationError(
          "Rank every alternative, or choose “I cannot rank these.”",
          "ranks",
        );
        return;
      }
      if (
        !draft.cannotRank &&
        !options.some((option) => draft.ratings[option.id]?.rank === 1)
      ) {
        validationError(
          "Give your preferred alternative rank 1. Equal ranks are allowed.",
          "ranks",
        );
        return;
      }
      const needsNote =
        draft.cannotRank ||
        options.some(
          (option) =>
            draft.ratings[option.id]?.adequacy === "needs_work" ||
            draft.ratings[option.id]?.adequacy === "unsure",
        );
      if (needsNote && !draft.notes.trim()) {
        validationError(
          "Add a note explaining what needs work or what is uncertain.",
          "notes",
        );
        return;
      }
      payload = {
        kind: "evaluate",
        caseId: task.caseId,
        ratings: options.map((option) => ({
          optionId: option.id,
          adequacy: draft.ratings[option.id].adequacy as TitleAdequacy,
          rank: draft.cannotRank ? null : draft.ratings[option.id].rank,
        })),
        cannotRank: draft.cannotRank,
        confidence: draft.confidence,
        notes: draft.notes.trim(),
        activeTimeMs: Math.round(draft.activeTimeMs),
        submissionId,
      };
    }
    const frozen = { ...draft, pendingSubmission: payload };
    setDraft(frozen);
    storeDraft(taskKey, frozen);
    void submit(payload);
  }

  function validationError(message: string, field: string): void {
    setError(message);
    setInvalidField(field);
  }

  async function checkCurrentTask(): Promise<void> {
    const oldKey = taskKey;
    const oldTask = task;
    const next = await refreshSession();
    const completedKey =
      oldTask?.stage === "create" ? "creationDone" : "evaluationDone";
    if (
      next &&
      oldTask &&
      next.progress[completedKey] > (session?.progress[completedKey] ?? 0)
    ) {
      removeDraft(oldKey);
      setNotice("Your answer was saved.");
      advanceFocus.current = true;
    } else if (next && oldTask && next.task?.caseId === oldTask.caseId) {
      setNotice(
        "Receipt is still unconfirmed. Use Retry the same answer to send it again safely.",
      );
    }
  }

  async function loadDashboard(): Promise<void> {
    if (!session?.studyId || !session.canManage) return;
    setDashboardBusy(true);
    setDashboardError("");
    try {
      setDashboard(
        await request<TitleValidationDashboard>(
          "/som-review/title-validation/dashboard",
          {
            studyId: session.studyId,
            ...identityFor(),
          },
          preview,
        ),
      );
    } catch (caught) {
      setDashboardError(errorText(caught));
    } finally {
      setDashboardBusy(false);
    }
  }

  async function manage(operation: "create" | "start" | "join"): Promise<void> {
    if (!session?.canManage || manageBusy) return;
    let reviewers: { reviewerId: string; label: string }[] | undefined;
    if (operation === "create") {
      const lines = reviewerLines
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      reviewers = lines.map((line) => {
        const divider = line.indexOf("|");
        return divider < 0
          ? { reviewerId: "", label: "" }
          : {
              reviewerId: line.slice(0, divider).trim(),
              label: line.slice(divider + 1).trim(),
            };
      });
      if (
        reviewers.length < 3 ||
        reviewers.length > 10 ||
        reviewers.some((row) => !row.reviewerId || !row.label) ||
        new Set(reviewers.map((row) => row.reviewerId)).size !==
          reviewers.length
      ) {
        setError(
          "Enter 3–10 lines as account email | display name, with a different account on each line.",
        );
        return;
      }
    }
    setManageBusy(true);
    setManagementStatus("Updating pilot…");
    setError("");
    try {
      await request<unknown>(
        "/som-review/title-validation/manage",
        {
          ...(operation === "create"
            ? { operation, reviewers }
            : { studyId: session.studyId, operation }),
          ...identityFor(),
        },
        preview,
      );
      setManagementStatus(
        {
          create: "Pilot created as a draft.",
          start: "Pilot opened.",
          join: "You have joined as a reviewer. Your answers will be saved with the team’s reviews.",
        }[operation],
      );
      await refreshSession();
      if (dashboardOpen && operation !== "create") await loadDashboard();
    } catch (caught) {
      setManagementStatus(
        "The pilot could not be updated. Check the message above and try again.",
      );
      setError(errorText(caught));
    } finally {
      setManageBusy(false);
    }
  }

  async function exportJson(): Promise<void> {
    if (!session?.studyId) return;
    setDashboardError("");
    try {
      const data = await request<unknown>(
        "/som-review/title-validation/export",
        {
          studyId: session.studyId,
          ...identityFor(),
        },
        preview,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `title-review-${session.studyId.replace(/[^a-z0-9_-]/gi, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setDashboardError(errorText(caught));
    }
  }

  const locked = saving || Boolean(draft?.pendingSubmission);
  const showSetup = session?.canManage && !session.studyId;
  const waiting = session?.phase === "waiting";
  const completedTasks = practice
    ? session?.phase === "create"
      ? session.progress.creationDone
      : session?.progress.evaluationDone || 0
    : (session?.progress.creationDone || 0) +
      (session?.progress.evaluationDone || 0);
  const assignedTasks = practice
    ? session?.progress.creationTotal || 0
    : (session?.progress.creationTotal || 0) +
      (session?.progress.evaluationTotal || 0);

  return (
    <ThemeProvider theme={titleValidationTheme}>
      <ScopedCssBaseline>
        <Head>
          <title>
            {practice ? "Human title review · Your copy" : "Human title review"}
          </title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <Box sx={design.page}>
          <Box sx={design.container}>
            <Box component="header" sx={design.masthead}>
              <Stack spacing={1.2} sx={{ maxWidth: 650 }}>
                <Typography
                  variant="overline"
                  sx={{
                    fontWeight: 750,
                    letterSpacing: ".16em",
                    color: "primary.main",
                  }}
                >
                  MIT CCI · Society of Mind
                </Typography>
                <Typography variant="h4" component="h1" sx={design.heading}>
                  Human title review
                </Typography>
                <Typography color="text.secondary">
                  Clearer activity titles begin with your judgment.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {practice
                    ? "Write your titles for all five activities, then compare the alternatives. You can pause and return at any time."
                    : "Five-activity staff try-out. Read the source, create your titles, then compare alternatives for other activities."}
                </Typography>
                <Chip
                  label={
                    practice
                      ? "Your five-activity review"
                      : "Staff pilot · questions are provisional"
                  }
                  size="small"
                  variant="outlined"
                  sx={{
                    alignSelf: "flex-start",
                    color: "text.secondary",
                    borderColor: "divider",
                  }}
                />
              </Stack>
              <Stack
                spacing={1.5}
                sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0 }}
              >
                {preview && (
                  <Typography variant="caption" color="text.secondary">
                    Local preview · practice responses stay on this computer.
                  </Typography>
                )}
                {preview && (
                  <TextField
                    select
                    size="small"
                    label="Preview reviewer"
                    value={previewReviewer}
                    disabled={locked || manageBusy || loadingSession}
                    onChange={(event) => {
                      requestNumber.current += 1;
                      setSession(null);
                      setDraft(null);
                      setDashboard(null);
                      setNotice("");
                      setPreviewReviewer(event.target.value);
                    }}
                    fullWidth
                  >
                    {["preview-a", "preview-b", "preview-c"].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {session?.studyId && (
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>
                        {practice
                          ? session.phase === "create"
                            ? "1. Write your titles"
                            : session.phase === "evaluate"
                              ? "2. Compare alternatives"
                              : "Review complete"
                          : session.reviewerLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {completedTasks} of {assignedTasks} complete
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={
                        assignedTasks
                          ? (completedTasks / assignedTasks) * 100
                          : 0
                      }
                      aria-label="Your review progress"
                      aria-valuetext={`${completedTasks} of ${assignedTasks} reviews complete`}
                      sx={{ height: 6, borderRadius: 10, bgcolor: "#E5ECE8" }}
                    />
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ gap: 1 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Titles {session.progress.creationDone}/
                        {session.progress.creationTotal}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Comparisons {session.progress.evaluationDone}/
                        {session.progress.evaluationTotal}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Box>

            {practice && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 650 }}>
                  Earlier review copy
                </Typography>
                <Typography>
                  Open the team review page to participate with the other
                  reviewers. Your earlier saved work is preserved.
                </Typography>
                <Button href="/review/title-validation">
                  Open team review
                </Button>
              </Alert>
            )}
            {!practice &&
              !preview &&
              session?.canManage &&
              session.studyId &&
              session.phase === "unassigned" &&
              session.studyStatus === "active" && (
                <Box sx={{ mb: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => void manage("join")}
                    disabled={manageBusy}
                  >
                    Join as reviewer
                  </Button>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Work through the same five activities. Your answers will be
                    saved with the team’s reviews, under your own account.
                    Everyone’s existing answers and progress stay in place.
                  </Typography>
                </Box>
              )}

            {error && (
              <Alert
                id="review-form-error"
                severity="error"
                sx={{ mb: 2 }}
                role="alert"
              >
                {error}
                {!session && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      color="inherit"
                      variant="outlined"
                      disabled={loadingSession}
                      onClick={() => void refreshSession()}
                    >
                      Try loading again
                    </Button>
                  </Box>
                )}
              </Alert>
            )}
            <Typography
              role="status"
              aria-live="polite"
              sx={{
                minHeight: notice ? 28 : 0,
                mb: notice ? 2 : 0,
                color: "primary.dark",
              }}
            >
              {notice}
            </Typography>
            {loadingSession && !session && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography>Loading review…</Typography>
              </Box>
            )}

            {showSetup && (
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
                  <Stack spacing={2.5}>
                    <Typography
                      variant="h5"
                      component="h2"
                      ref={taskHeading}
                      tabIndex={-1}
                    >
                      Set up a study
                    </Typography>
                    <Typography>
                      Coordinator only: add 3–10 reviewers. Enter one person per
                      line.
                    </Typography>
                    <TextField
                      multiline
                      minRows={5}
                      fullWidth
                      label="Reviewers"
                      value={reviewerLines}
                      onChange={(event) => setReviewerLines(event.target.value)}
                      placeholder="account@example.org | Display name"
                      helperText="Use each reviewer’s existing ontology account email and a name they will recognize."
                    />
                    <Box>
                      <Button
                        variant="contained"
                        disabled={manageBusy}
                        onClick={() => void manage("create")}
                      >
                        Create study
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {session && !showSetup && !task && (
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
                  <Stack spacing={2}>
                    <Typography
                      variant="h5"
                      component="h2"
                      ref={taskHeading}
                      tabIndex={-1}
                    >
                      {session.studyStatus === "draft"
                        ? "Pilot is ready"
                        : session.studyStatus === "paused"
                          ? "Pilot paused"
                          : session.studyStatus === "closed"
                            ? "Pilot closed"
                            : waiting
                              ? "Waiting for everyone to finish"
                              : session.phase === "complete"
                                ? "Your reviews are complete"
                                : "No review assigned"}
                    </Typography>
                    <Typography>
                      {session.message ||
                        (waiting
                          ? "Comparisons open after every reviewer finishes their independent titles. This page checks for updates while it is visible."
                          : session.phase === "unassigned"
                            ? "You are not assigned to this study."
                            : session.studyStatus === "paused"
                              ? "The study is paused by the coordinator."
                              : "There is no task to review right now.")}
                    </Typography>
                    {waiting && lastCheckedAt && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        role="status"
                      >
                        Status checked at{" "}
                        {new Date(lastCheckedAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        . This page checks for updates automatically.
                      </Typography>
                    )}
                    <Box>
                      <Button
                        variant="outlined"
                        disabled={loadingSession}
                        onClick={() => void refreshSession()}
                      >
                        {loadingSession ? "Checking…" : "Refresh status"}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {task && draft?.key === taskKey && (
              <Card variant="outlined" sx={design.workCard}>
                <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
                  <Stack spacing={3}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{ sm: "center" }}
                    >
                      <Typography
                        variant="h5"
                        component="h2"
                        ref={taskHeading}
                        tabIndex={-1}
                      >
                        {task.stage === "create"
                          ? "Write your title"
                          : "Compare the titles"}
                      </Typography>
                    </Stack>
                    <>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "minmax(0,1fr)",
                            md: "minmax(0,5fr) minmax(0,7fr)",
                          },
                          gap: { xs: 3, md: 5 },
                          alignItems: "start",
                        }}
                      >
                        <Box
                          component="aside"
                          sx={{
                            position: { md: "sticky" },
                            top: { md: 24 },
                            minWidth: 0,
                          }}
                        >
                          <Box sx={design.evidence}>
                            <Typography
                              variant="overline"
                              sx={{
                                color: "primary.main",
                                fontWeight: 700,
                                letterSpacing: ".1em",
                              }}
                            >
                              Source evidence
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                            >
                              Current title
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{
                                overflowWrap: "anywhere",
                                mb: 3,
                                fontSize: "1.5rem",
                                lineHeight: 1.35,
                              }}
                            >
                              {task.currentTitle}
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                            >
                              Full activity description
                            </Typography>
                            <Typography
                              sx={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {task.description}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 2, px: 1 }}
                          >
                            Judge only the activity named in the current title.
                            Use the complete description as your evidence.
                          </Typography>
                        </Box>
                        <Stack
                          spacing={3}
                          ref={reviewArea}
                          sx={{
                            minWidth: 0,
                            "& .MuiFormLabel-root": {
                              fontWeight: 650,
                              color: "text.primary",
                            },
                          }}
                        >
                          {!draftStored && (
                            <Alert severity="warning">
                              This browser could not save your draft. Keep this
                              page open until you submit your answer.
                            </Alert>
                          )}
                          {draftStored && (
                            <Typography
                              variant="caption"
                              role="status"
                              color="text.secondary"
                            >
                              {draftRecovered
                                ? "Your draft was restored. "
                                : ""}
                              Draft saved on this device. Submit to save it to
                              the study.
                            </Typography>
                          )}
                          {task.stage === "create" ? (
                            <>
                              <Accordion
                                disableGutters
                                elevation={0}
                                sx={{
                                  border: 1,
                                  borderColor: "divider",
                                  borderRadius: "8px !important",
                                }}
                              >
                                <AccordionSummary
                                  expandIcon={<span aria-hidden="true">⌄</span>}
                                >
                                  How to write a useful title
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Stack spacing={1.5}>
                                    <Typography>
                                      Keep the title if it clearly and
                                      accurately conveys the relevant activity
                                      to someone unfamiliar with the occupation.
                                      We need adequate wording, not perfect
                                      wording.
                                    </Typography>
                                    <Typography>
                                      Focus only on the original activity.
                                      Preserve its verb and object, allowing
                                      ordinary grammatical changes. Add only
                                      useful details supported by the
                                      description, including how, why, or
                                      context. Do not add other activities
                                      mentioned in the same sentence.
                                    </Typography>
                                    <Typography>
                                      If the description distinguishes different
                                      types of the same object, you may propose
                                      a title for each. Do not split just
                                      because several methods, purposes, or
                                      tools are listed.
                                    </Typography>
                                    <Typography>
                                      Keep titles compact. Aim for about seven
                                      words, but use more when needed for
                                      clarity or essential details. If evidence
                                      is unclear, give your best tentative title
                                      and explain the uncertainty in a comment.
                                    </Typography>
                                  </Stack>
                                </AccordionDetails>
                              </Accordion>
                              <FormControl
                                component="fieldset"
                                disabled={locked}
                                data-review-field="decision"
                                error={invalidField === "decision"}
                                aria-describedby={
                                  invalidField === "decision"
                                    ? "review-form-error"
                                    : undefined
                                }
                              >
                                <FormLabel component="legend">
                                  What would you do with the current title?
                                </FormLabel>
                                <RadioGroup
                                  sx={{
                                    gap: 1,
                                    "& .MuiFormControlLabel-root": {
                                      m: 0,
                                      px: 1.5,
                                      py: 1,
                                      border: "1px solid",
                                      borderColor: "divider",
                                      borderRadius: 2,
                                      alignItems: "center",
                                      transition: "background-color 120ms ease",
                                      "&:hover": { bgcolor: "#F5F8F5" },
                                      '&[data-selected="true"]': {
                                        borderColor: "primary.main",
                                        bgcolor: "#EDF5F1",
                                      },
                                    },
                                  }}
                                  value={draft.decision}
                                  onChange={(event) => {
                                    const decision = event.target
                                      .value as TitleCreationDecision;
                                    changeDraft({
                                      decision,
                                      titles:
                                        decision === "split"
                                          ? ["", ""]
                                          : decision === "clarify"
                                            ? [""]
                                            : [task.currentTitle],
                                    });
                                  }}
                                >
                                  <FormControlLabel
                                    data-selected={draft.decision === "keep"}
                                    value="keep"
                                    control={<Radio />}
                                    label="Keep it"
                                  />
                                  <FormControlLabel
                                    data-selected={draft.decision === "clarify"}
                                    value="clarify"
                                    control={<Radio />}
                                    label="Use one clearer title"
                                  />
                                  <FormControlLabel
                                    data-selected={draft.decision === "split"}
                                    value="split"
                                    control={<Radio />}
                                    label="Use several titles"
                                  />
                                </RadioGroup>
                              </FormControl>
                              {draft.decision === "keep" && (
                                <Typography>
                                  Title to save:{" "}
                                  <strong>{task.currentTitle}</strong>
                                </Typography>
                              )}
                              {(draft.decision === "clarify" ||
                                draft.decision === "split") && (
                                <Stack spacing={2} data-review-field="titles">
                                  {draft.titles.map((title, index) => (
                                    <Stack
                                      key={index}
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={1}
                                      alignItems={{ sm: "flex-start" }}
                                    >
                                      <TextField
                                        id={`review-title-${index}`}
                                        error={
                                          invalidField === "titles" &&
                                          (!title.trim() ||
                                            title.length > 400 ||
                                            draft.titles.findIndex(
                                              (t) => t.trim() === title.trim(),
                                            ) !== index)
                                        }
                                        inputProps={{
                                          "aria-describedby":
                                            invalidField === "titles"
                                              ? "review-form-error"
                                              : undefined,
                                        }}
                                        fullWidth
                                        label={
                                          draft.decision === "split"
                                            ? `Title ${index + 1}`
                                            : "Your title"
                                        }
                                        value={title}
                                        disabled={locked}
                                        onChange={(event) =>
                                          changeDraft({
                                            titles: draft.titles.map(
                                              (value, row) =>
                                                row === index
                                                  ? event.target.value
                                                  : value,
                                            ),
                                          })
                                        }
                                      />
                                      {draft.decision === "split" && (
                                        <Button
                                          disabled={
                                            locked || draft.titles.length <= 2
                                          }
                                          aria-label={`Remove title ${index + 1}`}
                                          onClick={() => {
                                            changeDraft({
                                              titles: draft.titles.filter(
                                                (_, row) => row !== index,
                                              ),
                                            });
                                            window.setTimeout(
                                              () =>
                                                document
                                                  .getElementById(
                                                    `review-title-${Math.min(index, draft.titles.length - 2)}`,
                                                  )
                                                  ?.focus(),
                                              0,
                                            );
                                          }}
                                          sx={{
                                            alignSelf: {
                                              xs: "flex-start",
                                              sm: "center",
                                            },
                                          }}
                                        >
                                          Remove
                                        </Button>
                                      )}
                                    </Stack>
                                  ))}
                                  {draft.decision === "split" && (
                                    <Box>
                                      <Button
                                        disabled={
                                          locked || draft.titles.length >= 20
                                        }
                                        onClick={() =>
                                          changeDraft({
                                            titles: [...draft.titles, ""],
                                          })
                                        }
                                      >
                                        Add another title
                                      </Button>
                                    </Box>
                                  )}
                                </Stack>
                              )}
                            </>
                          ) : (
                            <>
                              <Typography>
                                Does each alternative clearly and accurately
                                convey the relevant activity? It needs to be
                                adequate, not perfectly worded. Then rank your
                                preference. Alternatives may contain one title
                                or several. Identical alternatives are shown
                                once. Equal ranks mean equally preferred; use
                                “Unsure” or “I cannot rank these” for
                                uncertainty.
                              </Typography>
                              {(task.options ?? []).map((option, index) => {
                                const rating = draft.ratings[option.id] ?? {
                                  adequacy: "",
                                  rank: null,
                                };
                                return (
                                  <Box key={option.id} sx={design.optionCard}>
                                    <Stack spacing={2}>
                                      <Typography variant="h6" component="h3">
                                        Alternative {optionLetter(index)}
                                      </Typography>
                                      <Box component="ul" sx={{ m: 0, pl: 3 }}>
                                        {option.titles.map((title, row) => (
                                          <Typography
                                            component="li"
                                            key={row}
                                            sx={{
                                              whiteSpace: "pre-wrap",
                                              overflowWrap: "anywhere",
                                            }}
                                          >
                                            {title}
                                          </Typography>
                                        ))}
                                      </Box>
                                      <FormControl
                                        component="fieldset"
                                        disabled={locked}
                                        data-review-field={
                                          !rating.adequacy
                                            ? "ratings"
                                            : undefined
                                        }
                                        error={
                                          invalidField === "ratings" &&
                                          !rating.adequacy
                                        }
                                        aria-describedby={
                                          invalidField === "ratings"
                                            ? "review-form-error"
                                            : undefined
                                        }
                                      >
                                        <FormLabel component="legend">
                                          How well does alternative{" "}
                                          {optionLetter(index)} describe the
                                          activity?
                                        </FormLabel>
                                        <RadioGroup
                                          name={`adequacy-${task.caseId}-${option.id}`}
                                          value={rating.adequacy}
                                          onChange={(event) =>
                                            changeDraft({
                                              ratings: {
                                                ...draft.ratings,
                                                [option.id]: {
                                                  ...rating,
                                                  adequacy: event.target
                                                    .value as TitleAdequacy,
                                                },
                                              },
                                            })
                                          }
                                        >
                                          <FormControlLabel
                                            value="adequate"
                                            control={<Radio />}
                                            label="Adequate"
                                          />
                                          <FormControlLabel
                                            value="needs_work"
                                            control={<Radio />}
                                            label="Needs work"
                                          />
                                          <FormControlLabel
                                            value="unsure"
                                            control={<Radio />}
                                            label="Unsure"
                                          />
                                        </RadioGroup>
                                      </FormControl>
                                      <TextField
                                        data-review-field={
                                          rating.rank === null ||
                                          invalidField === "ranks"
                                            ? "ranks"
                                            : undefined
                                        }
                                        error={invalidField === "ranks"}
                                        helperText="1 = most preferred. Equal ranks are allowed."
                                        select
                                        label={`Preference rank for alternative ${optionLetter(index)}`}
                                        value={rating.rank ?? ""}
                                        disabled={locked || draft.cannotRank}
                                        fullWidth
                                        onChange={(event) =>
                                          changeDraft({
                                            ratings: {
                                              ...draft.ratings,
                                              [option.id]: {
                                                ...rating,
                                                rank:
                                                  event.target.value === ""
                                                    ? null
                                                    : Number(
                                                        event.target.value,
                                                      ),
                                              },
                                            },
                                          })
                                        }
                                      >
                                        <MenuItem value="">
                                          Choose a rank
                                        </MenuItem>
                                        {(task.options ?? []).map((_, rank) => (
                                          <MenuItem key={rank} value={rank + 1}>
                                            {rank + 1}
                                          </MenuItem>
                                        ))}
                                      </TextField>
                                    </Stack>
                                  </Box>
                                );
                              })}
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={draft.cannotRank}
                                    disabled={locked}
                                    onChange={(event) => {
                                      const cannotRank = event.target.checked;
                                      changeDraft({
                                        cannotRank,
                                        ratings: cannotRank
                                          ? Object.fromEntries(
                                              Object.entries(draft.ratings).map(
                                                ([id, rating]) => [
                                                  id,
                                                  { ...rating, rank: null },
                                                ],
                                              ),
                                            )
                                          : draft.ratings,
                                      });
                                    }}
                                  />
                                }
                                label="I cannot rank these alternatives"
                              />
                            </>
                          )}
                          <Divider />
                          <FormControl
                            component="fieldset"
                            disabled={locked}
                            sx={design.confidenceGroup}
                            data-review-field="confidence"
                            error={invalidField === "confidence"}
                            aria-describedby={
                              invalidField === "confidence"
                                ? "review-form-error"
                                : undefined
                            }
                          >
                            <FormLabel component="legend">
                              How confident are you overall? 1 is low; 5 is
                              high.
                            </FormLabel>
                            <RadioGroup
                              row
                              name={`confidence-${task.caseId}-${task.stage}`}
                              value={draft.confidence ?? ""}
                              onChange={(event) =>
                                changeDraft({
                                  confidence: Number(event.target.value),
                                })
                              }
                            >
                              {[1, 2, 3, 4, 5].map((value) => (
                                <FormControlLabel
                                  key={value}
                                  data-selected={draft.confidence === value}
                                  value={value}
                                  control={<Radio />}
                                  label={String(value)}
                                />
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <TextField
                            data-review-field="notes"
                            error={invalidField === "notes"}
                            fullWidth
                            multiline
                            minRows={3}
                            label="Comments"
                            value={draft.notes}
                            disabled={locked}
                            onChange={(event) =>
                              changeDraft({ notes: event.target.value })
                            }
                            helperText={
                              task.stage === "evaluate"
                                ? "Required if anything needs work, you are unsure, or you cannot rank. Otherwise optional."
                                : "Optional. Explain any choice or uncertainty in your own words."
                            }
                          />
                          <Stack sx={design.saveBar}>
                            <Button
                              variant="contained"
                              disabled={saving}
                              onClick={
                                draft.pendingSubmission
                                  ? () =>
                                      void submit(
                                        draft.pendingSubmission as TitleValidationSubmission,
                                      )
                                  : save
                              }
                            >
                              {saving
                                ? "Saving…"
                                : draft.pendingSubmission
                                  ? "Retry the same answer"
                                  : "Save and continue"}
                            </Button>
                            {draft.pendingSubmission && (
                              <Button
                                variant="outlined"
                                disabled={loadingSession || saving}
                                onClick={() => void checkCurrentTask()}
                              >
                                Check current task
                              </Button>
                            )}
                          </Stack>
                          {draft.pendingSubmission && (
                            <Typography variant="body2" color="text.secondary">
                              Receipt of this answer is still unconfirmed. Retry
                              sends the same answer safely, or check the current
                              task.
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {session?.disclosure && (
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary
                  expandIcon={<span aria-hidden="true">⌄</span>}
                >
                  Agents and prompts used for this pilot
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Typography>
                      Model that generated the retained proposals:{" "}
                      {session.disclosure.model}.
                    </Typography>
                    <Typography>{session.disclosure.selection}</Typography>
                    <Typography
                      variant="body2"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      Prompt SHA-256: {session.disclosure.promptSha256}. Frozen
                      source snapshot SHA-256:{" "}
                      {session.disclosure.sourceSnapshotSha256}.
                    </Typography>
                    <Typography variant="body2">
                      Software checks assignment, required answers, and
                      duplicate submissions. It does not establish semantic
                      correctness. The review app makes no model requests and
                      cannot apply changes to the ontology.
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        fontFamily: "monospace",
                        fontSize: 13,
                      }}
                    >
                      {session.disclosure.prompt}
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
            {session?.canManage && Boolean(session.studyId) && (
              <Accordion
                expanded={dashboardOpen}
                onChange={(_, expanded) => {
                  setDashboardOpen(expanded);
                  if (expanded) void loadDashboard();
                }}
                sx={design.dashboard}
              >
                <AccordionSummary
                  expandIcon={<span aria-hidden="true">⌄</span>}
                >
                  <Typography variant="h6">Coordinator overview</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2.5}>
                    <Typography color="text.secondary">
                      Progress and review patterns for this study. No
                      statistical significance test or automatic approval is
                      provided.
                    </Typography>
                    {dashboardError && (
                      <Alert severity="error">{dashboardError}</Alert>
                    )}
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        variant="outlined"
                        disabled={dashboardBusy}
                        onClick={() => void loadDashboard()}
                      >
                        {dashboardBusy ? "Refreshing…" : "Refresh overview"}
                      </Button>
                      <Button
                        variant="outlined"
                        disabled={!dashboard?.comparisons.length}
                        onClick={() => void exportJson()}
                      >
                        Export JSON
                      </Button>
                      {session.studyStatus === "draft" && (
                        <Button
                          variant="contained"
                          disabled={manageBusy}
                          onClick={() => void manage("start")}
                        >
                          Open pilot
                        </Button>
                      )}
                    </Stack>
                    <Typography
                      role="status"
                      aria-live="polite"
                      variant="body2"
                      color="text.secondary"
                    >
                      {managementStatus}
                    </Typography>
                    {dashboard && (
                      <>
                        <Typography>
                          Status: {dashboard.status} · Cases:{" "}
                          {dashboard.caseCount} · Reviewers:{" "}
                          {dashboard.reviewerCount}
                        </Typography>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "repeat(3,minmax(0,1fr))",
                            },
                            gap: 2,
                          }}
                        >
                          {[
                            [
                              dashboard.completedCreations,
                              "Independent titles saved",
                            ],
                            [
                              dashboard.completedEvaluations,
                              "Comparisons saved",
                            ],
                            [
                              Math.max(
                                0,
                                dashboard.expectedEvaluations -
                                  dashboard.completedEvaluations,
                              ),
                              "Comparisons remaining",
                            ],
                          ].map(([value, label]) => (
                            <Box
                              key={label}
                              sx={{
                                p: 2.5,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 2,
                                bgcolor: "#FBFCFA",
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: "2rem",
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                }}
                              >
                                {value}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1 }}
                              >
                                {label}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 700 }}
                          >
                            Progress by reviewer
                          </Typography>
                          {dashboard.byReviewer.map((row, index) => (
                            <Box
                              key={`${row.label}-${index}`}
                              sx={{
                                overflowWrap: "anywhere",
                                py: 1.5,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 650, mb: 1 }}
                              >
                                {row.label}: titles {row.creationDone}/
                                {row.creationTotal}, comparisons{" "}
                                {row.evaluationDone}/{row.evaluationTotal}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                aria-label={`Progress for ${row.label}`}
                                value={
                                  row.creationTotal + row.evaluationTotal
                                    ? ((row.creationDone + row.evaluationDone) /
                                        (row.creationTotal +
                                          row.evaluationTotal)) *
                                      100
                                    : 0
                                }
                                sx={{
                                  height: 4,
                                  borderRadius: 2,
                                  bgcolor: "#E5ECE8",
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                        <Typography>
                          Median active time: titles{" "}
                          {dashboard.medianCreationActiveSeconds === null
                            ? "—"
                            : `${dashboard.medianCreationActiveSeconds} seconds`}
                          ; comparisons{" "}
                          {dashboard.medianEvaluationActiveSeconds === null
                            ? "—"
                            : `${dashboard.medianEvaluationActiveSeconds} seconds`}
                        </Typography>
                        {dashboard.comparisons.length > 0 &&
                          dashboard.completedEvaluations > 0 && (
                            <Typography>
                              Activities with differing judgments:{" "}
                              {dashboard.disagreementCases}
                            </Typography>
                          )}
                        {dashboard.comparisons.length > 0 && (
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              Adequacy by source
                            </Typography>
                            {dashboard.comparisons.map((row, index) => (
                              <Box
                                key={`${row.source}-${index}`}
                                sx={{
                                  overflowWrap: "anywhere",
                                  p: 2,
                                  mt: 1,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 2,
                                }}
                              >
                                <Typography sx={{ fontWeight: 650 }}>
                                  {sourceLabels[row.source] || row.source}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {row.adequate} adequate, {row.needsWork} needs
                                  work, {row.unsure} unsure;{" "}
                                  {row.preferredOrTied} preferred or tied (
                                  {row.judgments} judgments)
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                        {dashboard.byOutcome.length > 0 && (
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              Coverage by proposed change
                            </Typography>
                            {dashboard.byOutcome.map((row) => (
                              <Typography key={row.outcome}>
                                {row.outcome}: {row.cases} activities,{" "}
                                {row.completedEvaluations} completed comparisons
                              </Typography>
                            ))}
                          </Box>
                        )}
                        {dashboard.activityDetails?.length > 0 && (
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              Activity details
                            </Typography>
                            {dashboard.activityDetails.map((activity) => (
                              <Accordion key={activity.caseId}>
                                <AccordionSummary
                                  expandIcon={<span aria-hidden="true">⌄</span>}
                                >
                                  {activity.currentTitle}
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Stack
                                    spacing={1.5}
                                    sx={{ overflowWrap: "anywhere" }}
                                  >
                                    <Typography>
                                      {activity.description}
                                    </Typography>
                                    <Typography>
                                      Original: {activity.currentTitle}
                                    </Typography>
                                    <Typography>
                                      Model: {activity.modelTitles.join("; ")}
                                    </Typography>
                                    <Typography>
                                      Independent human title:{" "}
                                      {activity.human
                                        ? `${activity.human.titles.join("; ")} (${activity.human.reviewerLabel}, confidence ${activity.human.confidence}/5)`
                                        : "Not submitted yet"}
                                    </Typography>
                                    {activity.additionalHumans?.map(
                                      (human, i) => (
                                        <Typography key={`additional-${i}`}>
                                          Additional human title:{" "}
                                          {human.titles.join("; ")} (
                                          {human.reviewerLabel}, confidence{" "}
                                          {human.confidence}/5). Saved for team
                                          review; existing comparison
                                          alternatives are unchanged.
                                        </Typography>
                                      ),
                                    )}
                                    {activity.evaluations.map(
                                      (evaluation, i) => (
                                        <Box key={i}>
                                          <Typography sx={{ fontWeight: 700 }}>
                                            {evaluation.reviewerLabel} ·
                                            confidence {evaluation.confidence}/5
                                            · {evaluation.activeSeconds} active
                                            seconds
                                          </Typography>
                                          {evaluation.alternatives.map(
                                            (alternative, j) => (
                                              <Typography key={j}>
                                                {alternative.sources.join(
                                                  " / ",
                                                )}
                                                :{" "}
                                                {alternative.titles.join("; ")}{" "}
                                                —{" "}
                                                {alternative.adequacy ===
                                                "needs_work"
                                                  ? "needs work"
                                                  : alternative.adequacy}
                                                ;{" "}
                                                {alternative.rank === null
                                                  ? "unranked"
                                                  : `rank ${alternative.rank}`}
                                              </Typography>
                                            ),
                                          )}
                                        </Box>
                                      ),
                                    )}
                                  </Stack>
                                </AccordionDetails>
                              </Accordion>
                            ))}
                          </Box>
                        )}
                        {dashboard.notes.length > 0 && (
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700 }}
                            >
                              Reviewer notes
                            </Typography>
                            <Stack spacing={1}>
                              {dashboard.notes.map((note, index) => (
                                <Box
                                  key={index}
                                  sx={{
                                    borderTop: 1,
                                    borderColor: "divider",
                                    pt: 1,
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {note.currentTitle} · {note.reviewerLabel} ·{" "}
                                    {note.stage === "create"
                                      ? "Title creation"
                                      : "Comparison"}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      whiteSpace: "pre-wrap",
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {note.text}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        )}
                        {dashboard.caution && (
                          <Alert severity="info">{dashboard.caution}</Alert>
                        )}
                      </>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        </Box>
      </ScopedCssBaseline>
    </ThemeProvider>
  );
}
