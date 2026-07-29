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
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import Head from "next/head";

import ReviewCard, {
  ReviewSubmission,
} from "@components/components/SomReview/ReviewCard";
import ThemeModeToggle from "@components/components/SomReview/ThemeModeToggle";
import { reviewInteractiveSurfaceSx } from "@components/components/SomReview/reviewStyles";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { Post } from "@components/lib/utils/Post";
import {
  SomCalibrationOverviewResponse,
  SomCalibrationRespondResult,
} from "@components/types/ISomReview";

export const CalibrationReviewPage = () => {
  const [{ user }] = useAuth();
  const [overview, setOverview] =
    useState<SomCalibrationOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [started, setStarted] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await Post<SomCalibrationOverviewResponse>(
        "/som-review/calibration/overview",
        {},
        false,
      );
      setOverview(result);
      if ((result.active?.cursor || 0) > 0) setStarted(true);
    } catch {
      setLoadError("The review assignment could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadOverview();
  }, [loadOverview, user]);

  const assignment = overview?.active;
  const card = assignment?.cards[0];
  const completed = assignment
    ? assignment.cursor >= assignment.total
    : false;

  const submitResponse = async (submission: ReviewSubmission) => {
    if (!assignment || !card || !user?.userId) {
      throw new Error("The active calibration item is unavailable");
    }
    await Post<SomCalibrationRespondResult>(
      "/som-review/calibration/respond",
      {
        assignmentId: assignment.id,
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
    await loadOverview();
  };

  return (
    <>
      <Head>
        <title>Ontology calibration | 1Ontology</title>
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
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Typography sx={{ fontWeight: 850 }}>1Ontology review</Typography>
            <ThemeModeToggle />
          </Stack>

          {loading && (
            <Stack alignItems="center" sx={{ py: 18 }}>
              <CircularProgress aria-label="Loading calibration assignment" />
            </Stack>
          )}
          {!loading && loadError && (
            <Alert
              severity="error"
              sx={{ mt: 3 }}
              action={
                <Button color="inherit" onClick={loadOverview}>
                  Retry
                </Button>
              }
            >
              {loadError}
            </Alert>
          )}
          {!loading && !loadError && !assignment && (
            <Alert severity="info" sx={{ mt: 3 }}>
              No calibration assignment is currently available.
            </Alert>
          )}

          {!loading && !loadError && assignment && !started && !completed && (
            <Stack
              justifyContent="center"
              spacing={3}
              sx={{ minHeight: "70dvh", maxWidth: 720, mx: "auto" }}
            >
              <Box>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: "1.65rem", sm: "2rem" },
                    fontWeight: 850,
                  }}
                >
                  {assignment.title}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.75,
                    color: "text.secondary",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                  }}
                >
                  {assignment.taskLabel}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
                {assignment.introduction}
              </Typography>
              <Typography sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                Review all {assignment.total} items in this task set. Your
                answers are saved independently and will not change the
                questions shown to other reviewers.
              </Typography>
              <Button
                disableElevation
                variant="contained"
                onClick={() => setStarted(true)}
                sx={{
                  alignSelf: { xs: "stretch", sm: "flex-start" },
                  minHeight: 50,
                  px: 3,
                  fontWeight: 800,
                }}
              >
                Begin review
              </Button>
            </Stack>
          )}

          {!loading &&
            !loadError &&
            assignment &&
            started &&
            !completed &&
            card &&
            user?.userId && (
              <Stack spacing={2.5} sx={{ mt: 3 }}>
                <Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Typography sx={{ fontWeight: 800 }}>
                      {assignment.taskLabel}
                    </Typography>
                    <Typography
                      sx={{ color: "text.secondary", fontSize: "0.9rem" }}
                    >
                      {assignment.cursor + 1} of {assignment.total}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(assignment.cursor / assignment.total) * 100}
                    aria-label={`${assignment.cursor} of ${assignment.total} items completed`}
                    sx={{ mt: 1, height: 5 }}
                  />
                </Box>
                <ReviewCard
                  key={card.proposalId}
                  card={card}
                  reviewerId={user.userId}
                  onSubmit={submitResponse}
                />
              </Stack>
            )}

          {!loading && !loadError && assignment && completed && (
            <Stack
              alignItems="center"
              spacing={2}
              sx={{ py: 14, textAlign: "center" }}
            >
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
              <Typography
                component="h1"
                sx={{ fontSize: "1.55rem", fontWeight: 850 }}
              >
                Assignment complete
              </Typography>
              <Typography sx={{ maxWidth: 620, color: "text.secondary" }}>
                Your {assignment.total} responses were saved. Please wait for
                the research team to release the next task set.
              </Typography>
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
})(CalibrationReviewPage);
