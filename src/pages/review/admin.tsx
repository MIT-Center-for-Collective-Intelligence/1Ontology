import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Head from "next/head";
import { useRouter } from "next/router";

import DeliberationDashboard from "@components/components/SomReview/DeliberationDashboard";
import DeliberationDialog from "@components/components/SomReview/DeliberationDialog";
import ThemeModeToggle from "@components/components/SomReview/ThemeModeToggle";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import { Post } from "@components/lib/utils/Post";
import {
  SomDeliberationCommentStance,
  SomDeliberationMutationResult,
  SomDeliberationOverviewResponse,
  SomDeliberationProposalResponse,
  SomDeliberationResolutionDecision,
  SomReviewDecision,
} from "@components/types/ISomReview";

export const DeliberationAdminPage = () => {
  const [{ user }] = useAuth();
  const router = useRouter();
  const [overview, setOverview] =
    useState<SomDeliberationOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [detail, setDetail] = useState<SomDeliberationProposalResponse | null>(
    null,
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError("");
    try {
      const result = await Post<SomDeliberationOverviewResponse>(
        "/som-review/admin/overview",
        {},
        false,
      );
      setOverview(result);
    } catch (error: any) {
      const denied = error?.response?.status === 403;
      setOverviewError(
        denied
          ? "This page is restricted to the Society of Mind research team."
          : "The deliberation queue could not be loaded. Please try again.",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadOverview();
  }, [loadOverview, user]);

  const loadProposal = useCallback(async (proposalId: string) => {
    if (!proposalId) return;
    setLoadingDetail(true);
    setDetailError("");
    try {
      const result = await Post<SomDeliberationProposalResponse>(
        "/som-review/admin/proposal",
        { proposalId },
        false,
      );
      setDetail(result);
    } catch (error: any) {
      setDetailError(
        error?.response?.data?.error ||
          "This deliberation could not be loaded. Please try again.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openProposal = useCallback(
    (proposalId: string) => {
      setSelectedProposalId(proposalId);
      setDetail(null);
      loadProposal(proposalId);
    },
    [loadProposal],
  );

  const closeProposal = useCallback(() => {
    setSelectedProposalId("");
    setDetail(null);
    setDetailError("");
  }, []);

  const mutate = useCallback(
    async (endpoint: string, data: Record<string, unknown>) => {
      if (!selectedProposalId) throw new Error("No proposal is selected");
      await Post<SomDeliberationMutationResult>(
        endpoint,
        { proposalId: selectedProposalId, ...data },
        false,
      );
      await Promise.all([loadProposal(selectedProposalId), loadOverview()]);
    },
    [loadOverview, loadProposal, selectedProposalId],
  );

  return (
    <>
      <Head>
        <title>Group deliberation | 1Ontology</title>
      </Head>
      <Box
        component="main"
        sx={{
          minHeight: "100dvh",
          backgroundColor: "background.default",
          py: 3,
        }}
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
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push("/review")}
              sx={{ minHeight: 46, fontWeight: 700 }}
            >
              Individual review
            </Button>
            <ThemeModeToggle />
          </Stack>
          {loadingOverview && (
            <Stack alignItems="center" sx={{ py: 18 }}>
              <CircularProgress aria-label="Loading group deliberation" />
            </Stack>
          )}
          {!loadingOverview && overviewError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" onClick={loadOverview}>
                  Retry
                </Button>
              }
            >
              {overviewError}
            </Alert>
          )}
          {!loadingOverview && overview && (
            <DeliberationDashboard overview={overview} onOpen={openProposal} />
          )}
        </Container>
      </Box>
      <DeliberationDialog
        open={Boolean(selectedProposalId)}
        loading={loadingDetail}
        detail={detail}
        loadError={detailError}
        onClose={closeProposal}
        onRefresh={() => loadProposal(selectedProposalId)}
        onComment={(stance: SomDeliberationCommentStance, body: string) =>
          mutate("/som-review/admin/comment", { stance, body })
        }
        onPosition={(decision: SomReviewDecision, rationale: string) =>
          mutate("/som-review/admin/position", { decision, rationale })
        }
        onResolve={(
          decision: SomDeliberationResolutionDecision,
          rationale: string,
        ) => mutate("/som-review/admin/resolve", { decision, rationale })}
      />
    </>
  );
};

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(DeliberationAdminPage);
