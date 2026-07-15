import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import { SomReviewCard } from "../../types/ISomReview";
import ContextRenderer, { DiffedTitle } from "./ContextRenderer";

export interface ReviewSubmission {
  decision: "agree" | "disagree";
  disagreementReason: string;
  suggestedCorrection: string;
  elapsedMs: number;
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
      p: 1.75,
      borderRadius: "10px",
      border: (theme) =>
        `1px solid ${
          accent === "primary"
            ? alpha(theme.palette.primary.main, 0.4)
            : theme.palette.divider
        }`,
      backgroundColor: (theme) =>
        accent === "primary"
          ? alpha(theme.palette.primary.main, 0.05)
          : "transparent",
    }}
  >
    <Typography
      variant="caption"
      component="div"
      sx={{
        mb: 0.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: accent === "primary" ? "primary.main" : "text.secondary",
      }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

const ReviewCard = ({
  card,
  onSubmit,
}: {
  card: SomReviewCard;
  onSubmit: (submission: ReviewSubmission) => Promise<void>;
}) => {
  const [disagreeing, setDisagreeing] = useState(false);
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const shownAtRef = useRef<number>(Date.now());
  const draftKey = `som-review-draft-${card.datasetVersion}-${card.proposalId}`;

  useEffect(() => {
    shownAtRef.current = Date.now();

    try {
      const draft = window.sessionStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        setDisagreeing(true);
        setReason(parsed.reason || "");
        setCorrection(parsed.correction || "");
      }
    } catch {}
  }, [card.proposalId]);

  const persistDraft = (nextReason: string, nextCorrection: string) => {
    try {
      window.sessionStorage.setItem(
        draftKey,
        JSON.stringify({ reason: nextReason, correction: nextCorrection }),
      );
    } catch {}
  };

  const clearDraft = () => {
    try {
      window.sessionStorage.removeItem(draftKey);
    } catch {}
  };

  const submit = async (decision: "agree" | "disagree") => {
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

  // For title changes, show the diffed titles inside the state panels instead
  // of repeating the same titles twice.
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

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        minHeight: 420,
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: "14px",
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 2.5, sm: 3.5 }, pb: 2 }}>
        <Typography
          variant="h6"
          component="h2"
          sx={{ mb: 2.5, fontWeight: 600, lineHeight: 1.4 }}
        >
          {view.question}
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <StatePanel label="Current" accent="neutral">
            {titleDiff ? (
              <DiffedTitle
                title={titleDiff.current}
                other={titleDiff.proposed}
                changedColor="error.main"
              />
            ) : (
              <Typography>{stripStatePrefix(view.currentState)}</Typography>
            )}
          </StatePanel>
          <StatePanel label="Proposed" accent="primary">
            {titleDiff ? (
              <DiffedTitle
                title={titleDiff.proposed}
                other={titleDiff.current}
                changedColor="success.main"
              />
            ) : (
              <Typography>{stripStatePrefix(view.proposedState)}</Typography>
            )}
          </StatePanel>
        </Stack>

        <Box
          sx={{
            mb: 2,
            pl: 1.75,
            borderLeft: (theme) => `3px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "text.secondary",
              mb: 0.25,
            }}
          >
            Reasoning
          </Typography>
          <Typography sx={{ color: "text.primary" }}>
            {view.reasoning}
          </Typography>
        </Box>

        <ContextRenderer context={view.context} />
      </Box>

      <Box
        sx={{
          px: { xs: 2.5, sm: 3.5 },
          py: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: (theme) => alpha(theme.palette.action.hover, 0.03),
        }}
      >
        {saveError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                disabled={saving}
                onClick={() => submit(disagreeing ? "disagree" : "agree")}
              >
                Retry
              </Button>
            }
          >
            Your response could not be saved. Nothing was lost — please retry.
          </Alert>
        )}

        {!disagreeing ? (
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              color="success"
              size="large"
              disableElevation
              startIcon={
                saving ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <CheckIcon />
                )
              }
              disabled={saving}
              onClick={() => submit("agree")}
              sx={{
                minWidth: 150,
                textTransform: "none",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              {view.agreeLabel}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              startIcon={<CloseIcon />}
              disabled={saving}
              onClick={() => setDisagreeing(true)}
              sx={{
                minWidth: 150,
                textTransform: "none",
                borderRadius: "10px",
                color: "text.secondary",
              }}
            >
              {view.disagreeLabel}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TextField
              label="Why do you disagree?"
              required
              multiline
              minRows={2}
              maxRows={4}
              size="small"
              value={reason}
              autoFocus
              onChange={(event) => {
                setReason(event.target.value);
                persistDraft(event.target.value, correction);
              }}
              error={reason.length > 0 && !reasonValid}
              helperText={
                reason.length > 0 && !reasonValid
                  ? "The explanation cannot be blank."
                  : " "
              }
            />
            <TextField
              label="Suggested correction (optional)"
              multiline
              maxRows={3}
              size="small"
              value={correction}
              onChange={(event) => {
                setCorrection(event.target.value);
                persistDraft(reason, event.target.value);
              }}
            />
            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button
                disabled={saving}
                onClick={() => {
                  setDisagreeing(false);
                  setSaveError(false);
                  setReason("");
                  setCorrection("");
                  clearDraft();
                }}
                sx={{ textTransform: "none", color: "text.secondary" }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="error"
                disableElevation
                disabled={!reasonValid || saving}
                startIcon={
                  saving ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <CloseIcon />
                  )
                }
                onClick={() => submit("disagree")}
                sx={{
                  minWidth: 190,
                  textTransform: "none",
                  borderRadius: "10px",
                }}
              >
                Submit disagreement
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Paper>
  );
};

export default ReviewCard;
