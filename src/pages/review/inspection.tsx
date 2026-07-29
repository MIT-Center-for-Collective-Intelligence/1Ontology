import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Head from "next/head";
import { useRouter } from "next/router";

import InspectionItemCard from "@components/components/SomReview/InspectionItemCard";
import ThemeModeToggle from "@components/components/SomReview/ThemeModeToggle";
import { reviewInteractiveSurfaceSx } from "@components/components/SomReview/reviewStyles";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { Post } from "@components/lib/utils/Post";
import {
  SomInspectionItem,
  SomInspectionMutationResult,
  SomInspectionOverviewResponse,
} from "@components/types/ISomReview";

type ItemFilter = "all" | "not-aligned" | "disagreements" | "controls";

export const ReviewInspectionPage = () => {
  const [{ user }] = useAuth();
  const router = useRouter();
  const workspaceId = router.query.workspace === "buy" ? "buy" : "sell";
  const requestedReviewerId =
    typeof router.query.reviewer === "string" ? router.query.reviewer : "";
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
          },
          false,
        );
        setOverview(result);
        if (
          result.selectedReviewerId &&
          result.selectedReviewerId !== requestedReviewerId
        ) {
          await router.replace(
            {
              pathname: "/review/inspection",
              query: {
                workspace: workspaceId,
                reviewer: result.selectedReviewerId,
              },
            },
            undefined,
            { shallow: true },
          );
        }
      } catch (error: any) {
        setLoadError(
          error?.response?.status === 403
            ? "This page is restricted to the Society of Mind research team."
            : "The prior-review inspection could not be loaded.",
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [requestedReviewerId, router, workspaceId],
  );

  useEffect(() => {
    if (user && router.isReady) loadOverview();
  }, [loadOverview, router.isReady, user]);

  const selectReviewer = async (reviewerId: string) => {
    await router.replace(
      {
        pathname: "/review/inspection",
        query: { workspace: workspaceId, reviewer: reviewerId },
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
                        ? "sell-outline-followup"
                        : "buy-content-identity"),
                  },
                })
              }
              sx={{ minHeight: 44, fontWeight: 750 }}
            >
              Proposal review
            </Button>
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
                Inspect another reviewer&apos;s completed judgments in one
                scrollable page. Add a separate note only where you are not
                aligned.
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
              <Alert severity="info">
                Every saved proposal response is listed below. If you are
                aligned, continue scrolling without taking action. Mark an item
                as not aligned only when you want to record an issue for
                discussion; the prior response remains unchanged.
              </Alert>

              {overview.reviewers.length === 0 ? (
                <Alert severity="info">
                  No other reviewer has saved responses in this workspace yet.
                </Alert>
              ) : (
                <>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    alignItems={{ xs: "stretch", md: "center" }}
                    spacing={1.5}
                  >
                    <FormControl sx={{ minWidth: 260 }}>
                      <InputLabel id="prior-reviewer-label">
                        Prior reviewer
                      </InputLabel>
                      <Select
                        labelId="prior-reviewer-label"
                        value={overview.selectedReviewerId || ""}
                        label="Prior reviewer"
                        onChange={(event) =>
                          selectReviewer(String(event.target.value))
                        }
                      >
                        {overview.reviewers.map((reviewer) => (
                          <MenuItem
                            key={reviewer.reviewerId}
                            value={reviewer.reviewerId}
                          >
                            {reviewer.displayName} ({reviewer.responseCount})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      label="Search reviewed items"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </Stack>

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
                        label={`${
                          overview.items.filter((item) => item.exception).length
                        } not aligned`}
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
                      {visibleItems.map((item, index) => {
                        const previous = visibleItems[index - 1];
                        const newRound =
                          !previous || previous.datasetId !== item.datasetId;
                        return (
                          <React.Fragment
                            key={`${item.card.datasetVersion}-${item.card.proposalId}`}
                          >
                            {newRound && (
                              <Box sx={{ pt: index === 0 ? 0 : 2 }}>
                                <Typography
                                  component="h2"
                                  sx={{ fontSize: "1.15rem", fontWeight: 850 }}
                                >
                                  {item.datasetLabel}
                                </Typography>
                                {item.currentRound && (
                                  <Chip
                                    size="small"
                                    color="primary"
                                    label="Current round"
                                    sx={{ mt: 0.75 }}
                                  />
                                )}
                              </Box>
                            )}
                            <InspectionItemCard
                              item={item}
                              reviewerName={
                                selectedReviewer?.displayName ||
                                "Prior reviewer"
                              }
                              canAnnotate={
                                overview.selectedReviewerId !== user?.userId
                              }
                              onSaveException={saveException}
                            />
                          </React.Fragment>
                        );
                      })}
                    </Stack>
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
