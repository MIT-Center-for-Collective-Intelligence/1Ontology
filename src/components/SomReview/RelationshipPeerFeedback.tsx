import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { relationshipRequest } from "../../lib/relationshipReview/client";
import { relationshipFeedbackSnapshotJson } from "../../types/IRelationshipReview";
import type {
  PeerDecision,
  PeerFeedback,
  PeerFeedbackQuery,
  PeerFeedbackResponse,
  PeerFeedbackRow,
  PeerReviewer,
  RelationshipFeedback,
  RelationshipSession,
  SavePeerFeedbackRequest,
} from "../../types/IRelationshipReview";

const people = ["tom", "rob"] as const;
const labels = { tom: "Tom", rob: "Rob" } as const;
const other = (person: PeerReviewer): PeerReviewer =>
  person === "tom" ? "rob" : "tom";

type Draft = {
  decision: PeerDecision | "";
  note: string;
  expectedRevision: number;
  targetRevision: number | null;
  targetHash: string | null;
  dirty: boolean;
  pending: Readonly<SavePeerFeedbackRequest> | null;
  pendingTargetJson: string | null;
  error: string;
  needsRebase: boolean;
};
type Entry = {
  query: PeerFeedbackQuery;
  reviewerKey: string;
  author: PeerReviewer | null;
  target: PeerReviewer | null;
  data: PeerFeedbackResponse | null;
  draft: Draft;
  loading: boolean;
  readError: string;
  saving: boolean;
  readSeq: number;
  saveSeq: number;
  notify: () => void;
  isAlive: () => boolean;
};

const targetRow = (e: Entry) =>
  e.data?.reviewers.find((row) => row.reviewer === e.target);
const hash = (row?: PeerFeedbackRow): string | null =>
  row?.feedback && /^[a-f0-9]{64}$/i.test(row.feedbackSha256 ?? "")
    ? row.feedbackSha256!
    : null;
const earlier = (row: PeerFeedbackRow) =>
  !!row.response &&
  (!row.feedback ||
    row.response.targetRevision !== row.feedback.revision ||
    row.response.targetFeedbackSha256 !== row.feedbackSha256);

function FeedbackText({ feedback }: { feedback: RelationshipFeedback }) {
  return (
    <Stack
      spacing={0.5}
      sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
    >
      <Typography variant="body2">
        Proposal decision: {feedback.decision}
      </Typography>
      <Typography variant="body2">Note: {feedback.note || "None"}</Typography>
      <Typography variant="body2">
        Correction: {feedback.correction || "None"}
      </Typography>
      <Typography variant="body2">
        Revisit later: {feedback.revisitLater ? "Yes" : "No"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Review revision {feedback.revision}
      </Typography>
    </Stack>
  );
}

function isBound(data: PeerFeedbackResponse, q: PeerFeedbackQuery) {
  if (
    data?.caseId !== q.caseId ||
    data.datasetVersion !== q.datasetVersion ||
    data.datasetSha256 !== q.datasetSha256 ||
    !Array.isArray(data.reviewers) ||
    data.reviewers.length !== 2
  )
    return false;
  return people.every((person) => {
    const row = data.reviewers.find(
      (candidate) => candidate.reviewer === person,
    );
    if (
      !row ||
      !Object.prototype.hasOwnProperty.call(row, "feedback") ||
      !Object.prototype.hasOwnProperty.call(row, "response")
    )
      return false;
    const { feedback: f, response: r } = row;
    return (
      (!f ||
        (f.caseId === q.caseId && f.datasetVersion === q.datasetVersion)) &&
      (!r ||
        (r.caseId === q.caseId &&
          r.datasetVersion === q.datasetVersion &&
          ["agree", "disagree"].includes(r.decision) &&
          typeof r.note === "string" &&
          Number.isSafeInteger(r.revision) &&
          r.revision > 0 &&
          r.targetReviewer === person &&
          r.authorReviewer === other(person) &&
          r.targetFeedback?.caseId === q.caseId &&
          r.targetFeedback.datasetVersion === q.datasetVersion &&
          r.targetFeedback.revision === r.targetRevision))
    );
  });
}

function receiptMatches(
  r: PeerFeedback,
  p: Readonly<SavePeerFeedbackRequest>,
  author: PeerReviewer | null,
  targetJson: string | null,
) {
  return (
    r?.caseId === p.caseId &&
    r.datasetVersion === p.datasetVersion &&
    r.authorReviewer === author &&
    r.targetReviewer === p.targetReviewer &&
    r.targetRevision === p.targetRevision &&
    r.targetFeedbackSha256 === p.targetFeedbackSha256 &&
    r.decision === p.decision &&
    r.note === (p.note ?? "") &&
    r.revision === p.revision + 1 &&
    r.targetFeedback?.caseId === p.caseId &&
    r.targetFeedback.datasetVersion === p.datasetVersion &&
    r.targetFeedback.revision === p.targetRevision &&
    targetJson !== null &&
    relationshipFeedbackSnapshotJson(r.targetFeedback) === targetJson
  );
}

function reconcile(e: Entry) {
  const row = targetRow(e);
  if (!row) return;
  const d = e.draft,
    expectedRevision = row.response?.revision ?? 0;
  const targetRevision = row.feedback?.revision ?? null,
    targetHash = hash(row);
  if (d.dirty || d.pending || d.needsRebase) {
    if (
      d.expectedRevision !== expectedRevision ||
      d.targetRevision !== targetRevision ||
      d.targetHash !== targetHash
    )
      d.needsRebase = true;
    return;
  }
  const stale = earlier(row);
  Object.assign(d, {
    expectedRevision,
    targetRevision,
    targetHash,
    decision: stale ? "" : (row.response?.decision ?? ""),
    note: stale ? "" : (row.response?.note ?? ""),
    needsRebase: stale,
  });
}

async function read(e: Entry) {
  const sequence = ++e.readSeq;
  e.loading = true;
  e.readError = "";
  e.notify();
  try {
    const data: PeerFeedbackResponse = await relationshipRequest(
      "peer-feedback",
      e.query,
    );
    if (sequence !== e.readSeq) return;
    if (!isBound(data, e.query)) throw new Error("Unbound read");
    const previous = e.data;
    // Preserve newer confirmed responses, including their saved target snapshots.
    e.data = {
      ...data,
      reviewers: data.reviewers.map((row) => {
        const saved = previous?.reviewers.find(
          (candidate) => candidate.reviewer === row.reviewer,
        )?.response;
        return saved &&
          (!row.response || saved.revision >= row.response.revision)
          ? { ...row, response: saved }
          : row;
      }),
    };
    reconcile(e);
  } catch {
    if (sequence === e.readSeq)
      e.readError =
        "Shared feedback could not be loaded or verified. Retry to obtain current feedback.";
  } finally {
    if (sequence === e.readSeq) {
      e.loading = false;
      e.notify();
    }
  }
}

async function send(e: Entry) {
  const body = e.draft.pending;
  if (!body || e.saving) return;
  const sequence = ++e.saveSeq;
  e.saving = true;
  e.draft.error = "";
  ++e.readSeq;
  e.loading = false;
  e.notify();
  let refresh = false;
  try {
    const result = await relationshipRequest("save-peer", body);
    if (sequence !== e.saveSeq || e.draft.pending !== body) return;
    const receipt: PeerFeedback | undefined = result?.answer;
    if (
      !receipt ||
      !receiptMatches(receipt, body, e.author, e.draft.pendingTargetJson)
    )
      throw new Error("Unbound save receipt");
    ++e.readSeq;
    e.loading = false;
    // A replay envelope can be old: install the receipt, not its original-review rows.
    if (e.data)
      e.data = {
        ...e.data,
        reviewers: e.data.reviewers.map((row) =>
          row.reviewer === body.targetReviewer &&
          (!row.response || row.response.revision <= receipt.revision)
            ? { ...row, response: receipt }
            : row,
        ),
      };
    Object.assign(e.draft, {
      pending: null,
      pendingTargetJson: null,
      dirty: false,
      error: "",
      needsRebase: false,
    });
    reconcile(e);
    refresh = true;
  } catch (error) {
    if (sequence !== e.saveSeq || e.draft.pending !== body) return;
    const failure = error as {
      status?: number;
      statusCode?: number;
      response?: { status?: number };
    };
    const status =
      failure?.status ?? failure?.statusCode ?? failure?.response?.status;
    if (
      status &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 499
    ) {
      e.draft.pending = null;
      e.draft.pendingTargetJson = null;
      e.draft.error =
        status === 409
          ? "The feedback or your saved response changed. Review updated feedback before saving."
          : "The save was rejected. Check your response or refresh and try again.";
      if (status === 409) {
        e.draft.needsRebase = true;
        refresh = true;
      }
    } else {
      e.draft.error =
        "The save could not be confirmed. Retry save resends the identical request.";
    }
  } finally {
    if (sequence === e.saveSeq) {
      e.saving = false;
      e.notify();
      if (refresh && e.isAlive()) void read(e);
    }
  }
}

function ready(e: Entry) {
  const row = targetRow(e),
    d = e.draft;
  return (
    !!row?.feedback &&
    !!hash(row) &&
    !!d.decision &&
    d.dirty &&
    !d.pending &&
    !d.needsRebase &&
    !e.saving &&
    !e.loading &&
    !e.readError &&
    d.expectedRevision === (row.response?.revision ?? 0) &&
    d.targetRevision === row.feedback.revision &&
    d.targetHash === hash(row)
  );
}

function submit(e: Entry) {
  const d = e.draft;
  // Retrying must never rebuild an uncertain body or generate another request ID.
  if (!d.pending) {
    if (!ready(e)) return;
    try {
      // Retain exactly what was seen even if a read refreshes the live target
      // while the save receipt is lost. This is never sent as a body field.
      d.pendingTargetJson = relationshipFeedbackSnapshotJson(
        targetRow(e)!.feedback!,
      );
      d.pending = Object.freeze({
        ...e.query,
        reviewerKey: e.reviewerKey,
        targetReviewer: e.target!,
        targetRevision: d.targetRevision!,
        targetFeedbackSha256: d.targetHash!,
        decision: d.decision as PeerDecision,
        note: d.note.trim(),
        revision: d.expectedRevision,
        requestId: crypto.randomUUID(),
      });
    } catch {
      d.error = "A secure request ID could not be created. Please reload.";
      e.notify();
      return;
    }
  }
  void send(e);
}

export function RelationshipPeerFeedback({
  session,
  caseId,
}: {
  session: RelationshipSession;
  caseId: string;
}) {
  const entries = useRef(new Map<string, Entry>());
  const active = useRef(""),
    alive = useRef(false);
  const [, render] = useState(0);
  const query: PeerFeedbackQuery = {
    datasetVersion: session.dataset.version,
    datasetSha256: session.datasetSha256,
    caseId,
  };
  const key = JSON.stringify([
    session.reviewerKey,
    query.datasetVersion,
    query.datasetSha256,
    caseId,
  ]);
  const author =
    session.peerReviewer === "tom" || session.peerReviewer === "rob"
      ? session.peerReviewer
      : null;
  const allowed = !session.preview && session.canViewPeerFeedback === true;
  if (!entries.current.has(key)) {
    entries.current.set(key, {
      query,
      reviewerKey: session.reviewerKey,
      author,
      target: author ? other(author) : null,
      data: null,
      loading: false,
      saving: false,
      readError: "",
      readSeq: 0,
      saveSeq: 0,
      draft: {
        decision: "",
        note: "",
        expectedRevision: 0,
        targetRevision: null,
        targetHash: null,
        dirty: false,
        pending: null,
        pendingTargetJson: null,
        error: "",
        needsRebase: false,
      },
      notify: () => {
        if (alive.current && active.current === key)
          render((value) => value + 1);
      },
      isAlive: () => alive.current,
    });
  }
  const entry = entries.current.get(key)!;
  const ownReviewRevision = session.feedback[caseId]?.revision;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    active.current = allowed ? key : "";
    if (allowed) void read(entry);
  }, [entry, allowed, key, ownReviewRevision]);
  const d = entry.draft;
  const data = entry.data && isBound(entry.data, query) ? entry.data : null;
  const canRespond = allowed && author !== null && author === entry.author;
  const edit = (patch: { decision?: PeerDecision; note?: string }) => {
    if (active.current !== key || !canRespond || d.pending || d.needsRebase)
      return;
    Object.assign(d, patch, { dirty: true, error: "" });
    entry.notify();
  };

  return (
    <Stack
      component="section"
      spacing={2}
      aria-label="Tom and Rob’s feedback"
      sx={{ color: "text.primary" }}
    >
      <Typography variant="h6" component="h2">
        Tom and Rob’s feedback
      </Typography>
      <Typography variant="body2" color="text.secondary">
        These responses are separate from your own proposal judgment. Your
        proposal form is unchanged.
      </Typography>
      {!allowed ? (
        <Typography color="text.secondary">
          Peer feedback is unavailable
          {session.preview ? " in preview." : " for this reviewer."}
        </Typography>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              type="button"
              variant="outlined"
              color="inherit"
              disabled={entry.loading}
              onClick={() => {
                if (active.current === key) void read(entry);
              }}
            >
              {entry.readError ? "Retry loading feedback" : "Refresh feedback"}
            </Button>
            {entry.loading && (
              <CircularProgress
                size={18}
                aria-label="Loading shared feedback"
              />
            )}
          </Stack>
          {entry.readError && <Alert severity="error">{entry.readError}</Alert>}
          {!data && (
            <Typography color="text.secondary">
              {entry.loading
                ? "Loading shared feedback…"
                : "Feedback is unavailable right now."}
            </Typography>
          )}
          {data &&
            people.map((person) => {
              const row = data.reviewers.find(
                (candidate) => candidate.reviewer === person,
              )!;
              const response = row.response,
                label = labels[person],
                stale = earlier(row);
              const editable = canRespond && person === entry.target;
              const hasCurrent = !!row.feedback && !!hash(row);
              const locked =
                !!d.pending ||
                d.needsRebase ||
                !hasCurrent ||
                entry.saving ||
                entry.loading ||
                !!entry.readError;
              return (
                <Box
                  key={person}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  <Typography component="h3" variant="subtitle1">
                    {label}’s original review
                  </Typography>
                  {row.feedback ? (
                    <FeedbackText feedback={row.feedback} />
                  ) : (
                    <Typography color="text.secondary">
                      No original review saved yet.
                    </Typography>
                  )}
                  {response ? (
                    <Stack spacing={1} sx={{ mt: 2 }}>
                      {stale && (
                        <Alert severity="warning">
                          This response refers to earlier feedback
                        </Alert>
                      )}
                      <Typography variant="body2">
                        Saved response by {labels[response.authorReviewer]}:{" "}
                        {response.decision === "agree" ? "Agree" : "Disagree"}
                      </Typography>
                      {response.note && (
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          Note: {response.note}
                        </Typography>
                      )}
                      {stale && (
                        <Box>
                          <Typography variant="subtitle2">
                            Saved target feedback (revision{" "}
                            {response.targetRevision})
                          </Typography>
                          <FeedbackText feedback={response.targetFeedback} />
                        </Box>
                      )}
                    </Stack>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 2 }}
                    >
                      No saved response from {labels[other(person)]}.
                    </Typography>
                  )}
                  {editable && (
                    <Stack
                      spacing={1.5}
                      sx={{ mt: 2 }}
                      role="group"
                      aria-label={`Response to ${label}’s feedback`}
                    >
                      {!hasCurrent && (
                        <Typography variant="body2" color="text.secondary">
                          A response requires {label}’s saved original review
                          and current verification.
                        </Typography>
                      )}
                      {d.error && <Alert severity="error">{d.error}</Alert>}
                      {d.pending && (
                        <Alert severity="info">
                          Edits are locked. Retry save sends the same request,
                          even if feedback changed.
                        </Alert>
                      )}
                      {d.needsRebase && (
                        <Stack spacing={1}>
                          <Alert severity="warning">
                            Feedback or your saved response changed. Confirm any
                            pending save first; then review updated feedback to
                            clear your previous choice and note.
                          </Alert>
                          <Button
                            type="button"
                            variant="outlined"
                            color="inherit"
                            aria-label={`Review updated feedback from ${label}`}
                            disabled={
                              !!d.pending ||
                              entry.saving ||
                              entry.loading ||
                              !!entry.readError ||
                              !hasCurrent
                            }
                            onClick={() => {
                              if (
                                active.current !== key ||
                                !d.needsRebase ||
                                d.pending ||
                                entry.saving ||
                                entry.loading ||
                                entry.readError ||
                                !hasCurrent ||
                                targetRow(entry) !== row
                              )
                                return;
                              Object.assign(d, {
                                expectedRevision: row.response?.revision ?? 0,
                                targetRevision: row.feedback!.revision,
                                targetHash: hash(row),
                                decision: "",
                                note: "",
                                dirty: true,
                                error: "",
                                needsRebase: false,
                              });
                              entry.notify();
                            }}
                          >
                            Review updated feedback
                          </Button>
                        </Stack>
                      )}
                      <FormControl component="fieldset" disabled={locked}>
                        <FormLabel component="legend">
                          Your response to {label}’s feedback
                        </FormLabel>
                        <RadioGroup
                          name={`peer-response-${person}-${caseId}`}
                          value={d.decision}
                          aria-label={`Your response to ${label}’s feedback`}
                          onChange={(_, value) =>
                            edit({ decision: value as PeerDecision })
                          }
                        >
                          <FormControlLabel
                            value="agree"
                            control={<Radio color="default" />}
                            label="Agree with this feedback"
                          />
                          <FormControlLabel
                            value="disagree"
                            control={<Radio color="default" />}
                            label="Disagree with this feedback"
                          />
                        </RadioGroup>
                      </FormControl>
                      <TextField
                        multiline
                        minRows={2}
                        value={d.note}
                        disabled={locked}
                        label={`Optional note for ${label}’s feedback`}
                        onChange={(event) => edit({ note: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="contained"
                        color="inherit"
                        aria-label={`${d.pending ? "Retry save" : "Save response"} to ${label}’s feedback`}
                        disabled={entry.saving || (!d.pending && !ready(entry))}
                        onClick={() => {
                          if (active.current === key && canRespond)
                            submit(entry);
                        }}
                      >
                        {entry.saving
                          ? "Saving response…"
                          : d.pending
                            ? "Retry save"
                            : "Save response"}
                      </Button>
                    </Stack>
                  )}
                </Box>
              );
            })}
          {!canRespond && (
            <Typography variant="body2" color="text.secondary">
              Shared responses are read-only for coordinators and other
              reviewers.
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

export default RelationshipPeerFeedback;
