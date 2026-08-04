import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Container,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import Head from "next/head";
import { useRouter } from "next/router";

import InspectionItemCard from "@components/components/SomReview/InspectionItemCard";
import ThemeModeToggle from "@components/components/SomReview/ThemeModeToggle";
import { reviewInteractiveSurfaceSx } from "@components/components/SomReview/reviewStyles";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { Post } from "@components/lib/utils/Post";
import { reviewPathForIssueTypes } from "@components/lib/somReview/reviewDependencies";
import {
  SomInspectionItem,
  SomInspectionMutationResult,
  SomInspectionOverviewResponse,
} from "@components/types/ISomReview";

type ItemFilter = "all" | "not-aligned" | "disagreements" | "controls";

export const inspectionLoadErrorMessage = (error: any): string => {
  const status = error?.response?.status ?? error?.status;
  const message =
    typeof error === "string"
      ? error
      : error?.response?.data?.error || error?.message || "";
  return status === 403 || message === "Deliberation access is restricted"
    ? "This page is restricted to the Society of Mind research team."
    : "The prior-review inspection could not be loaded.";
};

export const ReviewInspectionPage = () => {
  const [{ user }] = useAuth();
  const router = useRouter();
  const workspaceId = router.query.workspace === "buy" ? "buy" : "sell";
  const requestedReviewerId =
    typeof router.query.reviewer === "string" ? router.query.reviewer : "";
  const requestedTaskKey =
    typeof router.query.task === "string" ? router.query.task : "";
  const [overview, setOverview] =
    useState<SomInspectionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");

  const loadOverview = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setLoadError("");
      try {
        const result = await Post<SomInspectionOverviewResponse>(
          "/som-review/inspection/overview",
          {
            workspaceId,
            ...(requestedReviewerId ? { reviewerId: requestedReviewerId } : {}),
            ...(requestedTaskKey ? { taskKey: requestedTaskKey } : {}),
          },
          false,
        );
        setOverview(result);
        if (
          result.selectedReviewerId &&
          (result.selectedReviewerId !== requestedReviewerId ||
            Boolean(
              result.selectedTaskKey &&
              result.selectedTaskKey !== requestedTaskKey,
            ))
        ) {
          await router.replace(
            {
              pathname: "/review/inspection",
              query: {
                workspace: workspaceId,
                reviewer: result.selectedReviewerId,
                ...(result.selectedTaskKey
                  ? { task: result.selectedTaskKey }
                  : {}),
              },
            },
            undefined,
            { shallow: true },
          );
        }
      } catch (error: any) {
        setLoadError(inspectionLoadErrorMessage(error));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [requestedReviewerId, requestedTaskKey, router, workspaceId],
  );

  useEffect(() => {
    if (user && router.isReady) loadOverview();
  }, [loadOverview, router.isReady, user]);

  const selectTask = async (taskKey: string) => {
    await router.push(
      {
        pathname: "/review/inspection",
        query: {
          workspace: workspaceId,
          reviewer: overview?.selectedReviewerId || requestedReviewerId,
          task: taskKey,
        },
      },
      undefined,
      { shallow: true },
    );
  };

  const returnToTasks = async () => {
    await router.replace(
      {
        pathname: "/review/inspection",
        query: {
          workspace: workspaceId,
          reviewer: overview?.selectedReviewerId || requestedReviewerId,
        },
      },
      undefined,
      { shallow: true },
    );
  };

  const saveException = async (
    item: SomInspectionItem,
    rationale: string,
    suggestedAlternative: string,
    clear = false,
  ) => {
    if (!overview?.selectedReviewerId) {
      throw new Error("No prior reviewer is selected");
    }
    await Post<SomInspectionMutationResult>(
      "/som-review/inspection/exception",
      {
        workspaceId,
        datasetVersion: item.card.datasetVersion,
        proposalId: item.card.proposalId,
        subjectReviewerId: overview.selectedReviewerId,
        rationale,
        suggestedAlternative,
        clear,
      },
      false,
    );
    await loadOverview(true);
  };

  const selectedReviewer = overview?.reviewers.find(
    (reviewer) => reviewer.reviewerId === overview.selectedReviewerId,
  );
  const selectedTask = overview?.tasks.find(
    (task) => task.key === overview.selectedTaskKey,
  );
  const inspectingOwnReview =
    Boolean(overview?.selectedReviewerId) &&
    overview?.selectedReviewerId === user?.userId;
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (overview?.items || []).filter((item) => {
      if (itemFilter === "not-aligned" && !item.exception) return false;
      if (
        itemFilter === "disagreements" &&
        item.subjectResponse.decision !== "disagree"
      ) {
        return false;
      }
      if (
        itemFilter === "controls" &&
        item.recordSource !== "status-quo-audit"
      ) {
        return false;
      }
      if (!normalizedSearch) return true;
      return [
        item.card.reviewerView.question,
        item.card.reviewerView.currentState,
        item.card.reviewerView.proposedState,
        item.subjectResponse.disagreementReason,
        item.subjectResponse.suggestedCorrection,
        item.issueLabel,
        item.datasetLabel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [itemFilter, overview?.items, search]);
  const taskGroups = useMemo(() => {
    const tasks = overview?.tasks || [];
    return reviewPathForIssueTypes(tasks.map((task) => task.issueType)).map(
      (step) => ({
        ...step,
        tasks: tasks.filter((task) => step.issueTypes.includes(task.issueType)),
      }),
    );
  }, [overview?.tasks]);
  const visibleItemGroups = useMemo(() => {
    const groups: Array<{
      datasetId: string;
      datasetLabel: string;
      currentRound: boolean;
      items: SomInspectionItem[];
    }> = [];
    for (const item of visibleItems) {
      const existing = groups.find(
        (group) => group.datasetId === item.datasetId,
      );
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({
          datasetId: item.datasetId,
          datasetLabel: item.datasetLabel,
          currentRound: item.currentRound,
          items: [item],
        });
      }
    }
    return groups;
  }, [visibleItems]);

  return (
    <>
      <Head>
        <title>Prior-review inspection | 1Ontology</title>
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
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Breadcrumbs
              aria-label="Review navigation"
              sx={{
                minWidth: 0,
                "& .MuiBreadcrumbs-ol": { flexWrap: "wrap" },
              }}
            >
              <Button
                disableElevation
                color="inherit"
                startIcon={<ArrowBackIcon />}
                onClick={() =>
                  router.push({
                    pathname: "/review",
                    query: {
                      dataset:
                        overview?.activeDatasetId ||
                        (workspaceId === "sell"
                          ? "sell-semantic-coverage"
                          : "buy-content-identity"),
                    },
                  })
                }
                sx={{ minHeight: 44, fontWeight: 750, whiteSpace: "nowrap" }}
              >
                Proposal review
              </Button>
              {selectedTask && (
                <Button
                  disableElevation
                  color="inherit"
                  onClick={returnToTasks}
                  sx={{ minHeight: 44, fontWeight: 750, whiteSpace: "nowrap" }}
                >
                  All review tasks
                </Button>
              )}
            </Breadcrumbs>
            <ThemeModeToggle />
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "1.5rem", sm: "1.8rem" },
                  fontWeight: 850,
                }}
              >
                Prior-review inspection
              </Typography>
              <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                {selectedTask
                  ? `Review every saved judgment for ${selectedTask.issueLabel} on one page.`
                  : "Choose one completed review task, then inspect all of its saved judgments together."}
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={workspaceId}
              onChange={(_, value) => {
                if (!value || value === workspaceId) return;
                router.push({
                  pathname: "/review/inspection",
                  query: { workspace: value },
                });
              }}
              aria-label="Ontology sub-branch"
            >
              <ToggleButton value="sell">Sell</ToggleButton>
              <ToggleButton value="buy">Buy</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {loading && (
            <Stack alignItems="center" sx={{ py: 16 }}>
              <CircularProgress aria-label="Loading prior-review inspection" />
            </Stack>
          )}
          {!loading && loadError && (
            <Alert
              severity="error"
              sx={{ mt: 3 }}
              action={
                <Button color="inherit" onClick={() => loadOverview()}>
                  Retry
                </Button>
              }
            >
              {loadError}
            </Alert>
          )}

          {!loading && overview && !loadError && (
            <Stack spacing={2.5} sx={{ mt: 3 }}>
              {overview.reviewers.length === 0 ? (
                <Alert severity="info">
                  No reviewer has saved inspectable responses in this workspace
                  yet.
                </Alert>
              ) : (
                <>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    alignItems={{ xs: "stretch", md: "center" }}
                    spacing={1.5}
                  >
                    <Box sx={{ minWidth: 260 }} aria-label="Prior reviewer">
                      <Typography
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                        }}
                      >
                        Reviewing prior decisions by
                      </Typography>
                      <Typography sx={{ mt: 0.25, fontWeight: 800 }}>
                        {selectedReviewer?.displayName || "Robert Laubacher"} (
                        {selectedReviewer?.responseCount || 0} responses)
                      </Typography>
                    </Box>
                    {selectedTask && (
                      <TextField
                        fullWidth
                        label="Search this review task"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    )}
                  </Stack>

                  {!selectedTask && (
                    <>
                      <Alert
                        severity={inspectingOwnReview ? "success" : "info"}
                      >
                        {inspectingOwnReview
                          ? "These are your saved answers, combined by decision type across review rounds. Open a task to check every answer, rationale, and proposed alternative before another reviewer inspects them."
                          : "The tasks below combine the same decision type across review rounds and group related work into phases. Open one task to inspect all of its responses together."}
                      </Alert>
                      <Stack spacing={3}>
                        {taskGroups.map((group) => (
                          <Box key={group.id}>
                            <Typography
                              component="h2"
                              sx={{ fontSize: "1.1rem", fontWeight: 850 }}
                            >
                              Phase {group.number}: {group.title}
                            </Typography>
                            <Typography
                              sx={{
                                mt: 0.35,
                                mb: 1.25,
                                color: "text.secondary",
                              }}
                            >
                              {group.description}
                            </Typography>
                            <Stack spacing={1.25}>
                              {group.tasks.map((task) => (
                                <Card
                                  key={task.key}
                                  variant="outlined"
                                  sx={{ borderRadius: 2 }}
                                >
                                  <CardActionArea
                                    onClick={() => selectTask(task.key)}
                                    sx={{ p: { xs: 1.75, sm: 2.25 } }}
                                  >
                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      alignItems={{
                                        xs: "stretch",
                                        sm: "center",
                                      }}
                                      justifyContent="space-between"
                                      spacing={1.5}
                                    >
                                      <Box sx={{ minWidth: 0 }}>
                                        <Stack
                                          direction="row"
                                          alignItems="center"
                                          flexWrap="wrap"
                                          gap={0.75}
                                        >
                                          <Typography
                                            component="h3"
                                            sx={{
                                              fontSize: "1.05rem",
                                              fontWeight: 850,
                                            }}
                                          >
                                            {task.issueLabel}
                                          </Typography>
                                          {task.currentRound && (
                                            <Chip
                                              size="small"
                                              color="primary"
                                              label="Includes current round"
                                            />
                                          )}
                                        </Stack>
                                        <Typography
                                          sx={{
                                            mt: 0.45,
                                            color: "text.secondary",
                                            lineHeight: 1.45,
                                          }}
                                        >
                                          {task.roundCount === 1
                                            ? task.datasetLabel
                                            : `Combined across ${task.roundCount} review rounds`}
                                        </Typography>
                                        <Stack
                                          direction="row"
                                          flexWrap="wrap"
                                          gap={0.75}
                                          sx={{ mt: 1 }}
                                        >
                                          <Chip
                                            size="small"
                                            label={`${task.responseCount} responses`}
                                            variant="outlined"
                                          />
                                          <Chip
                                            size="small"
                                            label={`${task.agreeCount} agreed`}
                                            color="success"
                                            variant="outlined"
                                          />
                                          <Chip
                                            size="small"
                                            label={`${task.disagreeCount} disagreed`}
                                            color="error"
                                            variant="outlined"
                                          />
                                          {task.exceptionCount > 0 && (
                                            <Chip
                                              size="small"
                                              label={`${task.exceptionCount} not aligned`}
                                              color="warning"
                                              variant="outlined"
                                            />
                                          )}
                                        </Stack>
                                      </Box>
                                      <ArrowForwardIcon
                                        aria-hidden="true"
                                        color="action"
                                      />
                                    </Stack>
                                  </CardActionArea>
                                </Card>
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}

                  {selectedTask && (
                    <>
                      <Alert
                        severity={inspectingOwnReview ? "success" : "info"}
                        action={
                          inspectingOwnReview ? (
                            <Button
                              color="inherit"
                              startIcon={<EditNoteOutlinedIcon />}
                              onClick={() =>
                                router.push({
                                  pathname: "/review",
                                  query: {
                                    dataset: selectedTask.datasetId,
                                    issue: selectedTask.issueType,
                                  },
                                })
                              }
                            >
                              Edit my answers
                            </Button>
                          ) : undefined
                        }
                      >
                        {inspectingOwnReview
                          ? "This is your own review. Use Edit my answers to revise this task; inspection notes are intentionally disabled for self-review."
                          : "If you are aligned, continue scrolling without taking action. Mark an item as not aligned only when you want to preserve a separate issue for discussion; the prior response remains unchanged."}
                      </Alert>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        spacing={1.5}
                      >
                        <ToggleButtonGroup
                          exclusive
                          size="small"
                          value={itemFilter}
                          onChange={(_, value) => value && setItemFilter(value)}
                          aria-label="Reviewed item filter"
                        >
                          <ToggleButton value="all">All</ToggleButton>
                          <ToggleButton value="not-aligned">
                            Not aligned
                          </ToggleButton>
                          <ToggleButton value="disagreements">
                            Disagreements
                          </ToggleButton>
                          <ToggleButton value="controls">Controls</ToggleButton>
                        </ToggleButtonGroup>
                        <Stack direction="row" spacing={0.75}>
                          <Chip
                            label={`${visibleItems.length} shown`}
                            variant="outlined"
                          />
                          <Chip
                            label={`${selectedTask.exceptionCount} not aligned`}
                            color="warning"
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>

                      {visibleItems.length === 0 ? (
                        <Alert severity="info">
                          No reviewed items match the current filters.
                        </Alert>
                      ) : (
                        <Stack spacing={1.5}>
                          <Box>
                            <Typography
                              component="h2"
                              sx={{ fontSize: "1.15rem", fontWeight: 850 }}
                            >
                              {selectedTask.issueLabel}
                            </Typography>
                            <Typography
                              sx={{ mt: 0.35, color: "text.secondary" }}
                            >
                              {selectedTask.roundCount === 1
                                ? selectedTask.datasetLabel
                                : `${selectedTask.roundCount} review rounds combined`}
                            </Typography>
                          </Box>
                          {visibleItemGroups.map((group) => (
                            <Box key={group.datasetId}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                flexWrap="wrap"
                                gap={0.75}
                                sx={{ mb: 1 }}
                              >
                                <Typography
                                  component="h3"
                                  sx={{ fontWeight: 850 }}
                                >
                                  {group.datasetLabel}
                                </Typography>
                                {group.currentRound && (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    label="Current round"
                                  />
                                )}
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`${group.items.length} responses`}
                                />
                              </Stack>
                              <Stack spacing={1.5}>
                                {group.items.map((item) => (
                                  <InspectionItemCard
                                    key={`${item.card.datasetVersion}-${item.card.proposalId}`}
                                    item={item}
                                    reviewerName={
                                      selectedReviewer?.displayName ||
                                      "Prior reviewer"
                                    }
                                    canAnnotate={!inspectingOwnReview}
                                    onSaveException={saveException}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </>
                  )}
                </>
              )}
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
})(ReviewInspectionPage);
