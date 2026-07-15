import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import UndoIcon from "@mui/icons-material/Undo";
import Head from "next/head";

import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { Post } from "@components/lib/utils/Post";
import ReviewCard, {
  ReviewSubmission,
} from "@components/components/SomReview/ReviewCard";
import ReviewQueueSelector from "@components/components/SomReview/ReviewQueueSelector";
import {
  SomIssueType,
  SomIssueTypeOption,
  SomOverviewResponse,
  SomRespondResult,
  SomReviewCard,
  SomSessionResponse,
  SomUndoResult,
} from "@components/types/ISomReview";

type Phase = "loading" | "select" | "session" | "complete" | "empty";

export const ReviewPage = () => {
  const [{ user }] = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [issueTypes, setIssueTypes] = useState<SomIssueTypeOption[]>([]);
  const [issueType, setIssueType] = useState<SomIssueType | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [cards, setCards] = useState<SomReviewCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [undoing, setUndoing] = useState(false);

  const loadOverview = useCallback(async () => {
    setPhase("loading");
    setLoadError("");
    try {
      const overview = await Post<SomOverviewResponse>("/som-review/overview");
      setIssueTypes(overview.issueTypes);
      setPhase("select");
    } catch {
      setLoadError("The review queues could not be loaded. Please try again.");
      setPhase("select");
    }
  }, []);

  useEffect(() => {
    if (user) loadOverview();
  }, [user, loadOverview]);

  const startSession = useCallback(async (issue: SomIssueType) => {
    setPhase("loading");
    setLoadError("");
    try {
      const result = await Post<SomSessionResponse>("/som-review/session", {
        issueType: issue,
      });
      setIssueType(issue);
      if (result.done || !result.session || !result.cards?.length) {
        setSessionId("");
        setCards([]);
        setCursor(0);
        setPhase("empty");
        return;
      }
      setSessionId(result.session.id);
      setCards(result.cards);
      setCursor(result.session.cursor);
      setPhase(
        result.session.cursor >= result.cards.length ? "complete" : "session",
      );
    } catch {
      setLoadError("The review session could not be started. Please try again.");
      setPhase("select");
    }
  }, []);

  const submitResponse = useCallback(
    async (submission: ReviewSubmission) => {
      const card = cards[cursor];
      if (!card || !sessionId || !user?.userId) {
        throw new Error("The active review session is unavailable");
      }
      const result = await Post<SomRespondResult>(
        "/som-review/respond",
        {
          sessionId,
          response: {
            schemaVersion: "som-review-v1",
            datasetVersion: card.datasetVersion,
            proposalId: card.proposalId,
            reviewerId: user.userId,
            decision: submission.decision,
            disagreementReason: submission.disagreementReason,
            suggestedCorrection: submission.suggestedCorrection,
            reviewedAt: new Date().toISOString(),
            elapsedMs: Math.max(0, Math.round(submission.elapsedMs)),
          },
        },
        false,
      );
      setCursor(result.cursor);
      if (result.completed) setPhase("complete");
    },
    [cards, cursor, sessionId, user?.userId],
  );

  const undoPrevious = useCallback(async () => {
    if (!issueType || !sessionId || cursor === 0) return;
    setUndoing(true);
    setLoadError("");
    try {
      const result = await Post<SomUndoResult>(
        "/som-review/undo",
        { issueType, sessionId },
        false,
      );
      setCursor(result.cursor);
      setPhase("session");
    } catch {
      setLoadError("The previous answer could not be undone. Please try again.");
    } finally {
      setUndoing(false);
    }
  }, [issueType, sessionId, cursor]);

  const exitToSelector = useCallback(() => {
    setIssueType(null);
    setSessionId("");
    setCards([]);
    setCursor(0);
    loadOverview();
  }, [loadOverview]);

  const currentCard = cards[cursor];
  const selectedIssue = issueTypes.find((issue) => issue.id === issueType);
  const issueLabel = selectedIssue?.label || "Proposal review";

  return (
    <>
      <Head>
        <title>Proposal review | 1Ontology</title>
      </Head>
      <Box
        component="main"
        sx={{
          minHeight: "100dvh",
          backgroundColor: "background.default",
          py: { xs: 2, sm: 3 },
        }}
      >
        <Container maxWidth="md">
          {loadError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setLoadError("")}
              action={
                phase === "select" ? (
                  <Button color="inherit" onClick={loadOverview}>
                    Retry
                  </Button>
                ) : undefined
              }
            >
              {loadError}
            </Alert>
          )}

          {phase === "loading" && (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 18 }}>
              <CircularProgress size={36} aria-label="Loading review queue" />
            </Stack>
          )}

          {phase === "select" && (
            <ReviewQueueSelector
              issueTypes={issueTypes}
              onStart={startSession}
            />
          )}

          {phase === "session" && currentCard && user?.userId && (
            <Box>
              <Stack spacing={1.25} sx={{ mb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<ArrowBackIcon />}
                    onClick={exitToSelector}
                    sx={{ minHeight: 46, fontWeight: 700 }}
                  >
                    Save and exit
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    startIcon={
                      undoing ? <CircularProgress size={18} /> : <UndoIcon />
                    }
                    disabled={cursor === 0 || undoing}
                    onClick={undoPrevious}
                    sx={{ minHeight: 46, fontWeight: 700 }}
                  >
                    Undo last answer
                  </Button>
                </Stack>
                <Stack
                  direction="row"
                  alignItems="baseline"
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Typography
                    component="h1"
                    sx={{ fontSize: "1rem", fontWeight: 750 }}
                  >
                    {issueLabel}
                  </Typography>
                  <Typography
                    aria-live="polite"
                    sx={{
                      flex: "0 0 auto",
                      color: "text.secondary",
                      fontWeight: 700,
                    }}
                  >
                    Item {cursor + 1} of {cards.length}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(cursor / cards.length) * 100}
                  aria-label={`${cursor} of ${cards.length} items completed`}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Stack>
              <ReviewCard
                key={currentCard.proposalId}
                card={currentCard}
                reviewerId={user.userId}
                onSubmit={submitResponse}
              />
            </Box>
          )}

          {phase === "session" && (!currentCard || !user?.userId) && (
            <Alert severity="error" action={<Button onClick={exitToSelector}>Exit</Button>}>
              The current review item is unavailable.
            </Alert>
          )}

          {phase === "complete" && (
            <Stack
              alignItems="center"
              spacing={2.5}
              sx={{ py: 12, textAlign: "center" }}
            >
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
              <Box>
                <Typography
                  variant="h5"
                  component="h1"
                  sx={{ fontWeight: 800 }}
                >
                  Review set complete
                </Typography>
                <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
                  {cards.length} {cards.length === 1 ? "item" : "items"} reviewed
                </Typography>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<UndoIcon />}
                  disabled={!sessionId || cursor === 0 || undoing}
                  onClick={undoPrevious}
                  sx={{ minHeight: 50, fontWeight: 700 }}
                >
                  Undo last answer
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={exitToSelector}
                  sx={{ minHeight: 50, fontWeight: 700 }}
                >
                  All review types
                </Button>
                {issueType && (
                  <Button
                    variant="contained"
                    onClick={() => startSession(issueType)}
                    sx={{ minHeight: 50, fontWeight: 750 }}
                  >
                    Review another set
                  </Button>
                )}
              </Stack>
            </Stack>
          )}

          {phase === "empty" && (
            <Stack
              alignItems="center"
              spacing={2.5}
              sx={{ py: 12, textAlign: "center" }}
            >
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
              <Typography
                variant="h5"
                component="h1"
                sx={{ fontWeight: 800 }}
              >
                Nothing left in this review type
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={exitToSelector}
                sx={{ minHeight: 50, fontWeight: 700 }}
              >
                All review types
              </Button>
            </Stack>
          )}
        </Container>
      </Box>
    </>
  );
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(ReviewPage);
