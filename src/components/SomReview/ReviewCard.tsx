import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import { SomReviewCard } from "../../types/ISomReview";
import ContextRenderer, {
  contextShowsStateComparison,
  DiffedTitle,
} from "./ContextRenderer";
import { reviewAccentColor } from "./reviewStyles";

export interface ReviewSubmission {
  decision: "agree" | "disagree";
  disagreementReason: string;
  suggestedCorrection: string;
  elapsedMs: number;
}

export interface ExistingReviewResponse {
  decision: "agree" | "disagree";
  disagreementReason: string;
  suggestedCorrection: string;
}

const stripStatePrefix = (text: string): string =>
  text.replace(/^(current|proposed)\s+title:\s*/i, "");

const StatePanel = ({
  label,
  accent,
  children,
}: {
  label: string;
  accent: "neutral" | "primary";
  children: React.ReactNode;
}) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 0,
      p: 2,
      borderRadius: 1.5,
      border: (theme) =>
        `2px solid ${
          accent === "primary"
            ? reviewAccentColor(theme)
            : theme.palette.divider
        }`,
      backgroundColor: (theme) =>
        accent === "primary"
          ? alpha(theme.palette.primary.main, 0.06)
          : "background.paper",
    }}
  >
    <Typography
      component="div"
      sx={{
        mb: 0.75,
        color: accent === "primary" ? reviewAccentColor : "text.secondary",
        fontSize: "0.875rem",
        fontWeight: 750,
        letterSpacing: 0,
      }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

const PanelField = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography
      sx={{
        color: "text.secondary",
        fontSize: "0.8rem",
        fontWeight: 750,
        lineHeight: 1.35,
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ mt: 0.25, fontSize: "1.05rem", lineHeight: 1.5 }}>
      {value}
    </Typography>
  </Box>
);

const ReviewCard = ({
  card,
  reviewerId,
  onSubmit,
  initialResponse,
  mode = "review",
}: {
  card: SomReviewCard;
  reviewerId: string;
  onSubmit: (submission: ReviewSubmission) => Promise<void>;
  initialResponse?: ExistingReviewResponse;
  mode?: "review" | "revise";
}) => {
  const [disagreeing, setDisagreeing] = useState(false);
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const shownAtRef = useRef<number>(Date.now());
  const draftKey = useMemo(
    () =>
      [
        "som-review-draft",
        reviewerId,
        card.datasetVersion,
        card.proposalId,
        mode === "revise" ? "revise" : null,
      ]
        .filter(Boolean)
        .join("-"),
    [card.datasetVersion, card.proposalId, mode, reviewerId],
  );
  const initialDecision = initialResponse?.decision;
  const initialReason = initialResponse?.disagreementReason || "";
  const initialCorrection = initialResponse?.suggestedCorrection || "";

  useEffect(() => {
    shownAtRef.current = Date.now();
    const startsWithDisagreement =
      mode === "revise" && initialDecision === "disagree";
    setDisagreeing(startsWithDisagreement);
    setReason(startsWithDisagreement ? initialReason : "");
    setCorrection(startsWithDisagreement ? initialCorrection : "");
    setSaveError(false);

    try {
      const draft = window.sessionStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        setDisagreeing(Boolean(parsed.open));
        setReason(typeof parsed.reason === "string" ? parsed.reason : "");
        setCorrection(
          typeof parsed.correction === "string" ? parsed.correction : "",
        );
      }
    } catch {
      // A malformed local draft should never block the review queue.
    }

    const focusTimer = window.setTimeout(() => headingRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [draftKey, initialCorrection, initialDecision, initialReason, mode]);

  const persistDraft = (
    open: boolean,
    nextReason: string,
    nextCorrection: string,
  ) => {
    try {
      window.sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          open,
          reason: nextReason,
          correction: nextCorrection,
        }),
      );
    } catch {
      // Storage can be unavailable in private browsing; server progress remains.
    }
  };

  const clearDraft = () => {
    try {
      window.sessionStorage.removeItem(draftKey);
    } catch {
      // The saved response is authoritative even if local cleanup fails.
    }
  };

  const submit = async (decision: "agree" | "disagree") => {
    if (saving || (decision === "disagree" && !reason.trim())) return;
    setSaving(true);
    setSaveError(false);
    try {
      await onSubmit({
        decision,
        disagreementReason: decision === "disagree" ? reason.trim() : "",
        suggestedCorrection: decision === "disagree" ? correction.trim() : "",
        elapsedMs: Date.now() - shownAtRef.current,
      });
      clearDraft();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const view = card.reviewerView;
  const reasonValid = reason.trim().length > 0;
  const titleDiff =
    view.context.type === "title-comparison" &&
    typeof view.context.proposedTitle === "string" &&
    view.context.proposedTitle.trim().length > 0 &&
    view.context.proposedTitle !== view.context.currentTitle
      ? {
          current: view.context.currentTitle,
          proposed: view.context.proposedTitle,
        }
      : null;
  const showStatePanels = !contextShowsStateComparison(view.context);
  const placementContext =
    view.context.type === "placement-comparison" ? view.context : null;
  const wrongVerb = placementContext?.placementIssue === "wrong-verb";
  const agreeLabel = wrongVerb
    ? "Yes, different action"
    : placementContext
      ? "Yes, misplaced"
      : view.agreeLabel;
  const disagreeLabel = wrongVerb
    ? "No, it belongs under Sell"
    : placementContext
      ? "No, keep here"
      : view.disagreeLabel;

  return (
    <Box
      aria-busy={saving}
      sx={{
        width: "100%",
      }}
    >
      <Typography
        ref={headingRef}
        tabIndex={-1}
        variant="h5"
        component="h2"
        sx={{
          mb: 3,
          fontSize: { xs: "1.25rem", sm: "1.4rem" },
          fontWeight: 750,
          lineHeight: 1.4,
          letterSpacing: 0,
          "&:focus": { outline: "none" },
        }}
      >
        {view.question}
      </Typography>

      {showStatePanels && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <StatePanel
            label={placementContext ? "Current location" : "Current"}
            accent="neutral"
          >
            {placementContext ? (
              <Stack spacing={1.5}>
                <PanelField
                  label="Current parent"
                  value={placementContext.currentParentTitle}
                />
                {placementContext.currentBucket && (
                  <PanelField
                    label="Current category"
                    value={placementContext.currentBucket}
                  />
                )}
              </Stack>
            ) : titleDiff ? (
              <DiffedTitle
                title={titleDiff.current}
                other={titleDiff.proposed}
              />
            ) : (
              <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.5 }}>
                {stripStatePrefix(view.currentState)}
              </Typography>
            )}
          </StatePanel>
          <StatePanel
            label={placementContext ? "Recommended finding" : "Proposed"}
            accent="primary"
          >
            {placementContext ? (
              <Typography
                sx={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.5 }}
              >
                &quot;{placementContext.nodeTitle}&quot;{" "}
                {wrongVerb ? "is not a kind of selling and " : ""}does not
                belong under &quot;{placementContext.currentParentTitle}&quot;.
              </Typography>
            ) : titleDiff ? (
              <DiffedTitle
                title={titleDiff.proposed}
                other={titleDiff.current}
              />
            ) : (
              <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.5 }}>
                {stripStatePrefix(view.proposedState)}
              </Typography>
            )}
          </StatePanel>
        </Stack>
      )}

      <Box sx={{ mb: 3 }}>
        <Typography
          component="h3"
          sx={{
            mb: 0.75,
            color: "text.secondary",
            fontSize: "0.875rem",
            fontWeight: 750,
            letterSpacing: 0,
          }}
        >
          Why this recommendation was made
        </Typography>
        <Typography sx={{ fontSize: "1rem", lineHeight: 1.6 }}>
          {view.reasoning}
        </Typography>
      </Box>

      <ContextRenderer context={view.context} />

      <Box
        sx={{
          mt: 3,
          py: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: "background.default",
        }}
      >
        {saveError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                disableElevation
                color="inherit"
                disabled={saving}
                onClick={() => submit(disagreeing ? "disagree" : "agree")}
                sx={{ minHeight: 44, fontWeight: 700 }}
              >
                Retry
              </Button>
            }
          >
            Your answer was not saved. This item is still open.
          </Alert>
        )}

        {!disagreeing ? (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="center"
          >
            <Button
              variant="contained"
              disableElevation
              color="success"
              size="large"
              startIcon={
                saving ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <CheckIcon />
                )
              }
              disabled={saving}
              onClick={() => submit("agree")}
              sx={{
                width: { xs: "100%", sm: "auto" },
                minWidth: 180,
                minHeight: 52,
                borderRadius: 1.5,
                fontSize: "1rem",
                fontWeight: 750,
              }}
            >
              {agreeLabel}
            </Button>
            <Button
              disableElevation
              variant="outlined"
              color="inherit"
              size="large"
              startIcon={<CloseIcon />}
              disabled={saving}
              onClick={() => {
                setDisagreeing(true);
                persistDraft(true, reason, correction);
              }}
              sx={{
                width: { xs: "100%", sm: "auto" },
                minWidth: 180,
                minHeight: 52,
                borderRadius: 1.5,
                color: "text.primary",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              {disagreeLabel}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TextField
              label={
                placementContext
                  ? wrongVerb
                    ? `Why is "${placementContext.nodeTitle}" still a kind of selling?`
                    : `Why should "${placementContext.nodeTitle}" stay under "${placementContext.currentParentTitle}"?`
                  : "Why do you disagree?"
              }
              required
              multiline
              minRows={2}
              maxRows={4}
              value={reason}
              autoFocus
              onChange={(event) => {
                setReason(event.target.value);
                persistDraft(true, event.target.value, correction);
              }}
              error={reason.length > 0 && !reasonValid}
              helperText={
                reason.length > 0 && !reasonValid
                  ? "Enter at least one non-space character."
                  : ""
              }
              inputProps={{ maxLength: 2000 }}
            />
            <TextField
              label={
                placementContext
                  ? "Other placement suggestion (optional)"
                  : "Suggested correction (optional)"
              }
              multiline
              maxRows={3}
              value={correction}
              inputProps={{ maxLength: 2000 }}
              onChange={(event) => {
                setCorrection(event.target.value);
                persistDraft(true, reason, event.target.value);
              }}
            />
            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              spacing={1.5}
              justifyContent="flex-end"
            >
              <Button
                disableElevation
                startIcon={<ArrowBackIcon />}
                disabled={saving}
                onClick={() => {
                  setDisagreeing(false);
                  setSaveError(false);
                  setReason("");
                  setCorrection("");
                  clearDraft();
                }}
                sx={{ minHeight: 48, color: "text.primary", fontWeight: 650 }}
              >
                {mode === "revise"
                  ? "Choose a different answer"
                  : "Back to choices"}
              </Button>
              <Button
                variant="contained"
                disableElevation
                color="error"
                disabled={!reasonValid || saving}
                startIcon={
                  saving ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <CloseIcon />
                  )
                }
                onClick={() => submit("disagree")}
                sx={{
                  minWidth: 210,
                  minHeight: 52,
                  borderRadius: 1.5,
                  fontSize: "1rem",
                  fontWeight: 750,
                }}
              >
                {mode === "revise"
                  ? "Save revised answer"
                  : placementContext
                    ? "Keep current placement"
                    : "Save disagreement"}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default ReviewCard;
