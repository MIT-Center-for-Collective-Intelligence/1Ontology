import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Container,
  Fade,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import UndoIcon from "@mui/icons-material/Undo";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { Post } from "@components/lib/utils/Post";
import ReviewCard, {
  ReviewSubmission,
} from "@components/components/SomReview/ReviewCard";
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

const ISSUE_DESCRIPTIONS: Partial<Record<SomIssueType, string>> = {
  "title-clarity":
    "Is the proposed activity title clearer than the current one?",
  "sibling-grouping":
    "Does the proposed grouping of sibling activities make sense?",
  "duplicate-synonym": "Do two titles name the same activity?",
  placement: "Is an activity sitting in the wrong place?",
  "structural-overlap": "Could two activities overlap?",
};

const ReviewPage = () => {
  const [{ user }] = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [issueTypes, setIssueTypes] = useState<SomIssueTypeOption[]>([]);
  const [issueType, setIssueType] = useState<SomIssueType | null>(null);
  const [cards, setCards] = useState<SomReviewCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [undoing, setUndoing] = useState(false);

  const loadOverview = useCallback(async () => {
    setPhase("loading");
    setLoadError("");
    try {
      const overview = await Post<SomOverviewResponse>("/som-review/overview");
      setIssueTypes(overview.issueTypes.filter((issue) => issue.enabled));
      setPhase("select");
    } catch {
      setLoadError("The review queue could not be loaded.");
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
      if (result.done || !result.session || !result.cards?.length) {
        setIssueType(issue);
        setPhase("empty");
        return;
      }
      setIssueType(issue);
      setCards(result.cards);
      setCursor(result.session.cursor);
      setPhase(
        result.session.cursor >= result.cards.length ? "complete" : "session",
      );
    } catch {
      setLoadError("The session could not be started. Please try again.");
      setPhase("select");
    }
  }, []);

  const submitResponse = useCallback(
    async (submission: ReviewSubmission) => {
      const card = cards[cursor];
      const result = await Post<SomRespondResult>(
        "/som-review/respond",
        {
          response: {
            schemaVersion: "som-review-v1",
            datasetVersion: card.datasetVersion,
            proposalId: card.proposalId,
            reviewerId: user?.userId,
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
    [cards, cursor, user?.userId],
  );

  const undoPrevious = useCallback(async () => {
    if (!issueType || cursor === 0) return;
    setUndoing(true);
    try {
      const result = await Post<SomUndoResult>(
        "/som-review/undo",
        { issueType },
        false,
      );
      setCursor(result.cursor);
      setPhase("session");
    } catch {
      setLoadError("Undo failed. Please try again.");
    } finally {
      setUndoing(false);
    }
  }, [issueType, cursor]);

  const exitToSelector = useCallback(() => {
    setIssueType(null);
    setCards([]);
    setCursor(0);
    loadOverview();
  }, [loadOverview]);

  const currentCard = cards[cursor];
  const issueLabel = issueTypes.find((issue) => issue.id === issueType)?.label;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        py: { xs: 3, sm: 5 },
      }}
    >
      <Container maxWidth="sm" sx={{ maxWidth: { sm: "720px !important" } }}>
        {loadError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setLoadError("")}
          >
            {loadError}
          </Alert>
        )}

        {phase === "loading" && (
          <Stack alignItems="center" sx={{ py: 12 }}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {phase === "select" && (
          <Box>
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontWeight: 700, mb: 0.5 }}
            >
              Proposal review
            </Typography>
            <Typography sx={{ color: "text.secondary", mb: 4 }}>
              Your answers record judgments only — nothing changes the ontology.
            </Typography>
            <Stack spacing={1.5}>
              {issueTypes.map((issue) => (
                <Card
                  key={issue.id}
                  variant="outlined"
                  sx={{
                    borderRadius: "12px",
                    opacity: issue.pending === 0 ? 0.6 : 1,
                  }}
                >
                  <CardActionArea
                    disabled={issue.pending === 0}
                    onClick={() => startSession(issue.id)}
                    sx={{ p: 2.25 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>
                          {issue.label}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {ISSUE_DESCRIPTIONS[issue.id] || ""}
                        </Typography>
                      </Box>
                      {issue.pending === 0 ? (
                        <Chip
                          icon={<CheckCircleOutlineIcon />}
                          label="Done"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          label={`${issue.pending} left`}
                          size="small"
                          color="primary"
                        />
                      )}
                      {issue.pending > 0 && (
                        <ArrowForwardIcon
                          fontSize="small"
                          sx={{ color: "text.disabled" }}
                        />
                      )}
                    </Stack>
                  </CardActionArea>
                </Card>
              ))}
              {issueTypes.length === 0 && !loadError && (
                <Typography sx={{ color: "text.secondary" }}>
                  No review queues are available right now.
                </Typography>
              )}
            </Stack>
          </Box>
        )}

        {phase === "session" && currentCard && (
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Tooltip title="Save and exit">
                <IconButton
                  onClick={exitToSelector}
                  size="small"
                  aria-label="Save and exit"
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", flex: 1 }}
                noWrap
              >
                {issueLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "text.secondary" }}
              >
                {cursor + 1} of {cards.length}
              </Typography>
              <Tooltip title="Undo previous answer">
                <span>
                  <IconButton
                    size="small"
                    disabled={cursor === 0 || undoing}
                    onClick={undoPrevious}
                    aria-label="Undo previous answer"
                  >
                    {undoing ? (
                      <CircularProgress size={16} />
                    ) : (
                      <UndoIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(cursor / cards.length) * 100}
              sx={{ mb: 2, borderRadius: 1, height: 4 }}
            />
            <Fade in key={currentCard.proposalId} timeout={250}>
              <Box>
                <ReviewCard card={currentCard} onSubmit={submitResponse} />
              </Box>
            </Fade>
          </Box>
        )}

        {phase === "complete" && (
          <Stack
            alignItems="center"
            spacing={2.5}
            sx={{ py: 10, textAlign: "center" }}
          >
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 52 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Session complete
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                You reviewed {cards.length}{" "}
                {cards.length === 1 ? "proposal" : "proposals"}.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={exitToSelector}
                sx={{ textTransform: "none", borderRadius: "10px" }}
              >
                All queues
              </Button>
              {issueType && (
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => startSession(issueType)}
                  sx={{ textTransform: "none", borderRadius: "10px" }}
                >
                  Review more
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        {phase === "empty" && (
          <Stack
            alignItems="center"
            spacing={2.5}
            sx={{ py: 10, textAlign: "center" }}
          >
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 52 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Nothing left to review in this queue.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={exitToSelector}
              sx={{ textTransform: "none", borderRadius: "10px" }}
            >
              All queues
            </Button>
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(ReviewPage);
