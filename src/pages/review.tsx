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
import Head from "next/head";
import { useRouter } from "next/router";

import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { Post } from "@components/lib/utils/Post";
import ReviewCard, {
  ReviewSubmission,
} from "@components/components/SomReview/ReviewCard";
import ReviewHistorySelect from "@components/components/SomReview/ReviewHistorySelect";
import ReviewQueueSelector from "@components/components/SomReview/ReviewQueueSelector";
import ReviewTaskIntro from "@components/components/SomReview/ReviewTaskIntro";
import ThemeModeToggle from "@components/components/SomReview/ThemeModeToggle";
import { reviewInteractiveSurfaceSx } from "@components/components/SomReview/reviewStyles";
import {
  SomIssueType,
  SomIssueTypeOption,
  SomOverviewResponse,
  SomRespondResult,
  SomReviewCard,
  SomReviewHistoryItem,
  SomReviseResult,
  SomSessionResponse,
} from "@components/types/ISomReview";

type Phase = "loading" | "select" | "intro" | "session" | "complete" | "empty";

export const ReviewPage = () => {
  const [{ user }] = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [issueTypes, setIssueTypes] = useState<SomIssueTypeOption[]>([]);
  const [issueType, setIssueType] = useState<SomIssueType | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [cards, setCards] = useState<SomReviewCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<SomReviewHistoryItem[]>([]);
  const [revisionProposalId, setRevisionProposalId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [canDeliberate, setCanDeliberate] = useState(false);
  const [retryIssueType, setRetryIssueType] = useState<SomIssueType | null>(
    null,
  );

  const loadOverview = useCallback(async () => {
    setPhase("loading");
    setLoadError("");
    setRetryIssueType(null);
    try {
      const overview = await Post<SomOverviewResponse>("/som-review/overview");
      setDatasetVersion(overview.datasetVersion);
      setIssueTypes(overview.issueTypes);
      setCanDeliberate(overview.canDeliberate);
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
    setIssueType(issue);
    setPhase("loading");
    setLoadError("");
    setRetryIssueType(null);
    try {
      const result = await Post<SomSessionResponse>("/som-review/session", {
        issueType: issue,
      });
      setIssueType(issue);
      if (result.done || !result.session || !result.cards?.length) {
        setSessionId("");
        setCards([]);
        setCursor(0);
        setHistory([]);
        setRevisionProposalId("");
        setPhase("empty");
        return;
      }
      setSessionId(result.session.id);
      setCards(result.cards);
      setCursor(result.session.cursor);
      setHistory(result.history || []);
      setRevisionProposalId("");
      setPhase(
        result.session.cursor >= result.cards.length ? "complete" : "session",
      );
    } catch {
      setLoadError(
        "The review session could not be started. Please try again.",
      );
      setRetryIssueType(issue);
      setPhase("select");
    }
  }, []);

  const introStorageKey = useCallback(
    (issue: SomIssueType) =>
      `som-review-task-intro-${datasetVersion || "current"}-${issue}`,
    [datasetVersion],
  );

  const chooseIssueType = useCallback(
    (issue: SomIssueType) => {
      setLoadError("");
      setRetryIssueType(null);
      try {
        if (window.localStorage.getItem(introStorageKey(issue)) === "seen") {
          startSession(issue);
          return;
        }
      } catch {
        // The introduction remains available if browser storage is unavailable.
      }
      setIssueType(issue);
      setPhase("intro");
    },
    [introStorageKey, startSession],
  );

  const continueFromIntro = useCallback(() => {
    if (!issueType) return;
    try {
      window.localStorage.setItem(introStorageKey(issueType), "seen");
    } catch {
      // The review can continue even when browser storage is unavailable.
    }
    startSession(issueType);
  }, [introStorageKey, issueType, startSession]);

  const leaveIntro = useCallback(() => {
    setLoadError("");
    setRetryIssueType(null);
    setIssueType(null);
    setPhase("select");
  }, []);

  const submitResponse = useCallback(
    async (submission: ReviewSubmission) => {
      const card = cards[cursor];
      if (!card || !sessionId || !user?.userId) {
        throw new Error("The active review session is unavailable");
      }
      const reviewedAt = new Date().toISOString();
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
            reviewedAt,
            elapsedMs: Math.max(0, Math.round(submission.elapsedMs)),
          },
        },
        false,
      );
      setHistory((currentHistory) =>
        [
          ...currentHistory.filter(
            (item) => item.proposalId !== card.proposalId,
          ),
          {
            proposalId: card.proposalId,
            proposalIndex: cards.findIndex(
              (candidate) => candidate.proposalId === card.proposalId,
            ),
            question: card.reviewerView.question,
            decision: submission.decision,
            disagreementReason: submission.disagreementReason,
            suggestedCorrection: submission.suggestedCorrection,
            reviewedAt,
          },
        ].sort((left, right) => left.proposalIndex - right.proposalIndex),
      );
      setCursor(result.cursor);
      if (result.completed) setPhase("complete");
    },
    [cards, cursor, sessionId, user?.userId],
  );

  const revisionItem = history.find(
    (item) => item.proposalId === revisionProposalId,
  );
  const revisionCard = revisionItem
    ? cards.find((card) => card.proposalId === revisionItem.proposalId)
    : undefined;

  const submitRevision = useCallback(
    async (submission: ReviewSubmission) => {
      const item = history.find(
        (candidate) => candidate.proposalId === revisionProposalId,
      );
      const card = item
        ? cards.find((candidate) => candidate.proposalId === item.proposalId)
        : undefined;
      if (!item || !card || !sessionId || !user?.userId) {
        throw new Error("The earlier review is unavailable");
      }

      const reviewedAt = new Date().toISOString();
      const result = await Post<SomReviseResult>(
        "/som-review/revise",
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
            reviewedAt,
            elapsedMs: Math.max(0, Math.round(submission.elapsedMs)),
          },
        },
        false,
      );

      if (result.changed) {
        setHistory((currentHistory) =>
          currentHistory.map((historyItem) =>
            historyItem.proposalId === item.proposalId
              ? {
                  ...historyItem,
                  decision: submission.decision,
                  disagreementReason: submission.disagreementReason,
                  suggestedCorrection: submission.suggestedCorrection,
                  reviewedAt,
                }
              : historyItem,
          ),
        );
      }
      setRevisionProposalId("");
      setPhase(cursor >= cards.length ? "complete" : "session");
    },
    [cards, cursor, history, revisionProposalId, sessionId, user?.userId],
  );

  const selectRevision = useCallback(
    (proposalId: string) => {
      if (!history.some((item) => item.proposalId === proposalId)) return;
      setLoadError("");
      setRevisionProposalId(proposalId);
      setPhase("session");
    },
    [history],
  );

  const cancelRevision = useCallback(() => {
    setRevisionProposalId("");
    setPhase(cursor >= cards.length ? "complete" : "session");
  }, [cards.length, cursor]);

  const exitToSelector = useCallback(() => {
    setIssueType(null);
    setSessionId("");
    setCards([]);
    setCursor(0);
    setHistory([]);
    setRevisionProposalId("");
    setRetryIssueType(null);
    loadOverview();
  }, [loadOverview]);

  const currentCard = cards[cursor];
  const activeCard = revisionCard || currentCard;
  const selectedIssue = issueTypes.find((issue) => issue.id === issueType);
  const issueLabel = selectedIssue?.label || "Proposal review";

  return (
    <>
      <Head>
        <title>Proposal review | 1Ontology</title>
      </Head>
      <Box
        component="main"
        sx={[
          reviewInteractiveSurfaceSx,
          {
            minHeight: "100dvh",
            backgroundColor: "background.default",
            py: { xs: 2, sm: 3 },
          },
        ]}
      >
        <Container maxWidth="md">
          {loadError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setLoadError("")}
              action={
                phase === "select" ? (
                  <Button
                    disableElevation
                    color="inherit"
                    onClick={() =>
                      retryIssueType
                        ? startSession(retryIssueType)
                        : loadOverview()
                    }
                  >
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
              onStart={chooseIssueType}
              canDeliberate={canDeliberate}
              onOpenDeliberation={() => router.push("/review/admin")}
              headerAction={<ThemeModeToggle />}
            />
          )}

          {phase === "intro" && selectedIssue && (
            <ReviewTaskIntro
              issueType={selectedIssue.id}
              label={selectedIssue.label}
              itemCount={selectedIssue.pending}
              resuming={Boolean(selectedIssue.activeSession)}
              onContinue={continueFromIntro}
              onBack={leaveIntro}
              headerAction={<ThemeModeToggle />}
            />
          )}

          {phase === "session" && activeCard && user?.userId && (
            <Box>
              <Stack spacing={1.25} sx={{ mb: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Button
                    disableElevation
                    variant="outlined"
                    color="inherit"
                    startIcon={<ArrowBackIcon />}
                    onClick={exitToSelector}
                    sx={{
                      minHeight: 48,
                      fontWeight: 700,
                      width: { xs: "100%", sm: "auto" },
                    }}
                  >
                    Save and exit
                  </Button>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="flex-end"
                    spacing={1}
                    sx={{ width: { xs: "100%", sm: "auto" }, minWidth: 0 }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <ReviewHistorySelect
                        history={history}
                        selectedProposalId={revisionProposalId}
                        onSelect={selectRevision}
                      />
                    </Box>
                    <ThemeModeToggle />
                  </Stack>
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
                    {revisionItem ? (
                      <>
                        Revising item {revisionItem.proposalIndex + 1} of{" "}
                        {cards.length}
                      </>
                    ) : (
                      <>
                        Item {cursor + 1} of {cards.length}
                      </>
                    )}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(cursor / cards.length) * 100}
                  aria-label={`${cursor} of ${cards.length} items completed`}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Stack>
              {revisionItem && (
                <Alert
                  severity="info"
                  sx={{ mb: 2 }}
                  action={
                    <Button
                      disableElevation
                      color="inherit"
                      onClick={cancelRevision}
                      sx={{ minHeight: 40, fontWeight: 700 }}
                    >
                      Keep saved answer
                    </Button>
                  }
                >
                  You are revising item {revisionItem.proposalIndex + 1}. Saved
                  answer:{" "}
                  <strong>
                    {revisionItem.decision === "agree" ? "Agreed" : "Disagreed"}
                  </strong>
                  . No change is made until you submit a revised answer. Your
                  progress remains at {cursor} of {cards.length} items
                  completed.
                </Alert>
              )}
              <ReviewCard
                key={
                  activeCard.proposalId +
                  "-" +
                  (revisionItem?.reviewedAt || "new")
                }
                card={activeCard}
                reviewerId={user.userId}
                mode={revisionItem ? "revise" : "review"}
                initialResponse={
                  revisionItem
                    ? {
                        decision: revisionItem.decision,
                        disagreementReason:
                          revisionItem.disagreementReason || "",
                        suggestedCorrection:
                          revisionItem.suggestedCorrection || "",
                      }
                    : undefined
                }
                onSubmit={revisionItem ? submitRevision : submitResponse}
              />
            </Box>
          )}

          {phase === "session" && (!activeCard || !user?.userId) && (
            <Alert
              severity="error"
              action={
                <Button disableElevation onClick={exitToSelector}>
                  Exit
                </Button>
              }
            >
              The current review item is unavailable.
            </Alert>
          )}

          {phase === "complete" && (
            <Stack sx={{ py: 2 }}>
              <Stack direction="row" justifyContent="flex-end">
                <ThemeModeToggle />
              </Stack>
              <Stack
                alignItems="center"
                spacing={2.5}
                sx={{ py: 10, textAlign: "center" }}
              >
                <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
                <Box>
                  <Typography
                    variant="h5"
                    component="h1"
                    sx={{ fontWeight: 800 }}
                  >
                    Review type complete
                  </Typography>
                  <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
                    {cards.length} {cards.length === 1 ? "item" : "items"}{" "}
                    reviewed
                  </Typography>
                </Box>
                <ReviewHistorySelect
                  history={history}
                  selectedProposalId={revisionProposalId}
                  onSelect={selectRevision}
                />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  <Button
                    disableElevation
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
                      disableElevation
                      onClick={() => startSession(issueType)}
                      sx={{ minHeight: 50, fontWeight: 750 }}
                    >
                      Check for new proposals
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Stack>
          )}

          {phase === "empty" && (
            <Stack sx={{ py: 2 }}>
              <Stack direction="row" justifyContent="flex-end">
                <ThemeModeToggle />
              </Stack>
              <Stack
                alignItems="center"
                spacing={2.5}
                sx={{ py: 10, textAlign: "center" }}
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
                  disableElevation
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={exitToSelector}
                  sx={{ minHeight: 50, fontWeight: 700 }}
                >
                  All review types
                </Button>
              </Stack>
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
