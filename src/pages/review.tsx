import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import Head from "next/head";
import { useRouter } from "next/router";

import withAuthUser from "@components/components/hoc/withAuthUser";
import { useAuth } from "@components/components/context/AuthContext";
import { Post } from "@components/lib/utils/Post";
import ReviewCard, {
  ReviewSubmission,
} from "@components/components/SomReview/ReviewCard";
import ReviewHistorySelect from "@components/components/SomReview/ReviewHistorySelect";
import ReviewFollowUpPanel from "@components/components/SomReview/ReviewFollowUpPanel";
import ReviewQueueSelector from "@components/components/SomReview/ReviewQueueSelector";
import ReviewTaskIntro from "@components/components/SomReview/ReviewTaskIntro";
import ThemeModeToggle from "@components/components/SomReview/ThemeModeToggle";
import TrustedPropagationControl from "@components/components/SomReview/TrustedPropagationControl";
import OntologyComparisonPanel from "@components/components/SomReview/OntologyComparisonPanel";
import ReviewWorkspaceSwitcher from "@components/components/SomReview/ReviewWorkspaceSwitcher";
import { reviewInteractiveSurfaceSx } from "@components/components/SomReview/reviewStyles";
import { clearReviewDraft } from "@components/lib/somReview/reviewDraft";
import {
  SomIssueType,
  SomIssueTypeOption,
  SomFollowUpSource,
  SomLinkedFollowUp,
  SomOverviewResponse,
  SomRespondResult,
  SomReviewCard,
  SomReviewHistoryItem,
  SomReviewWorkspaceOption,
  SomReviseResult,
  SomSessionResponse,
} from "@components/types/ISomReview";

type Phase =
  | "loading"
  | "select"
  | "intro"
  | "session"
  | "follow-up"
  | "sequence-complete"
  | "complete"
  | "empty";

interface LinkedReviewSequence {
  source: SomFollowUpSource;
  followUp: SomLinkedFollowUp;
}

interface FollowUpOffer {
  source: SomFollowUpSource;
  followUps: SomLinkedFollowUp[];
  sourceQueueCompleted: boolean;
}

interface CompletedSequence {
  sequence: LinkedReviewSequence;
  followUpQueueCompleted: boolean;
}

export const ReviewPage = () => {
  const [{ user }] = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const datasetIdRef = useRef("");
  const autoOpenedTaskRef = useRef("");
  const [datasetId, setDatasetId] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [workspaceId, setWorkspaceId] = useState("buy");
  const [workspaces, setWorkspaces] = useState<SomReviewWorkspaceOption[]>([]);
  const [roundLabel, setRoundLabel] = useState("");
  const [currentRound, setCurrentRound] = useState(true);
  const [branch, setBranch] = useState("Sell");
  const [ontologyName, setOntologyName] = useState("Ontology");
  const [issueTypes, setIssueTypes] = useState<SomIssueTypeOption[]>([]);
  const [readyFollowUps, setReadyFollowUps] = useState<SomLinkedFollowUp[]>([]);
  const [issueType, setIssueType] = useState<SomIssueType | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [cards, setCards] = useState<SomReviewCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<SomReviewHistoryItem[]>([]);
  const [historyCards, setHistoryCards] = useState<SomReviewCard[]>([]);
  const [revisionProposalId, setRevisionProposalId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [canDeliberate, setCanDeliberate] = useState(false);
  const [canInspectPriorReview, setCanInspectPriorReview] = useState(false);
  const [trustedPropagationAllowed, setTrustedPropagationAllowed] =
    useState(false);
  const [trustedPropagationEnabled, setTrustedPropagationEnabled] =
    useState(false);
  const [retryIssueType, setRetryIssueType] = useState<SomIssueType | null>(
    null,
  );
  const [followUpOffer, setFollowUpOffer] = useState<FollowUpOffer | null>(
    null,
  );
  const [activeSequence, setActiveSequence] =
    useState<LinkedReviewSequence | null>(null);
  const [completedSequence, setCompletedSequence] =
    useState<CompletedSequence | null>(null);

  const applyOverview = useCallback((overview: SomOverviewResponse) => {
    datasetIdRef.current = overview.datasetId;
    setDatasetId(overview.datasetId);
    setDatasetVersion(overview.datasetVersion);
    setWorkspaceId(overview.workspaceId);
    setWorkspaces(overview.workspaces);
    setRoundLabel(overview.roundLabel);
    setCurrentRound(overview.currentRound);
    setBranch(overview.branch);
    setOntologyName(overview.ontologyName);
    setIssueTypes(overview.issueTypes);
    setReadyFollowUps(overview.readyFollowUps || []);
    setCanDeliberate(overview.canDeliberate);
    setCanInspectPriorReview(overview.canInspectPriorReview);
    setTrustedPropagationAllowed(Boolean(overview.trustedPropagation?.allowed));
  }, []);

  const loadOverview = useCallback(
    async (
      requestedDatasetId?: string,
    ): Promise<SomOverviewResponse | null> => {
      setPhase("loading");
      setLoadError("");
      setRetryIssueType(null);
      try {
        const targetDatasetId = requestedDatasetId || datasetIdRef.current;
        const overview = await Post<SomOverviewResponse>(
          "/som-review/overview",
          targetDatasetId ? { datasetId: targetDatasetId } : {},
        );
        applyOverview(overview);
        setPhase("select");
        return overview;
      } catch {
        setLoadError(
          "The review queues could not be loaded. Please try again.",
        );
        setPhase("select");
        return null;
      }
    },
    [applyOverview],
  );

  useEffect(() => {
    if (!user?.userId || !trustedPropagationAllowed) {
      setTrustedPropagationEnabled(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(
        `som-review-continuous-expert-${user.userId}`,
      );
      setTrustedPropagationEnabled(stored === null ? true : stored === "true");
    } catch {
      setTrustedPropagationEnabled(true);
    }
  }, [trustedPropagationAllowed, user?.userId]);

  const updateTrustedPropagation = useCallback(
    (enabled: boolean) => {
      setTrustedPropagationEnabled(enabled);
      if (!user?.userId) return;
      try {
        window.localStorage.setItem(
          `som-review-continuous-expert-${user.userId}`,
          String(enabled),
        );
      } catch {
        // The current page can retain the setting when storage is unavailable.
      }
    },
    [user?.userId],
  );

  useEffect(() => {
    if (!user || !router.isReady) return;
    const queryDatasetId =
      typeof router.query.dataset === "string"
        ? router.query.dataset
        : undefined;
    if (
      datasetIdRef.current &&
      (!queryDatasetId || queryDatasetId === datasetIdRef.current)
    ) {
      return;
    }
    loadOverview(queryDatasetId);
  }, [loadOverview, router.isReady, router.query.dataset, user]);

  const clearActiveReview = useCallback(() => {
    setIssueType(null);
    setSessionId("");
    setCards([]);
    setCursor(0);
    setHistory([]);
    setHistoryCards([]);
    setRevisionProposalId("");
    setRetryIssueType(null);
    setFollowUpOffer(null);
    setActiveSequence(null);
    setCompletedSequence(null);
  }, []);

  const switchDataset = useCallback(
    async (nextDatasetId: string) => {
      if (!nextDatasetId || nextDatasetId === datasetIdRef.current) return;
      clearActiveReview();
      datasetIdRef.current = nextDatasetId;
      await router.replace(
        {
          pathname: "/review",
          query: { dataset: nextDatasetId },
        },
        undefined,
        { shallow: true },
      );
      await loadOverview(nextDatasetId);
    },
    [clearActiveReview, loadOverview, router],
  );

  const startSession = useCallback(
    async (
      issue: SomIssueType,
      options: {
        preferredProposalId?: string;
        sequence?: LinkedReviewSequence | null;
        historyOnly?: boolean;
      } = {},
    ) => {
      setIssueType(issue);
      setPhase("loading");
      setLoadError("");
      setRetryIssueType(null);
      setFollowUpOffer(null);
      setCompletedSequence(null);
      setActiveSequence(options.sequence || null);
      try {
        const result = await Post<SomSessionResponse>("/som-review/session", {
          datasetId: datasetIdRef.current,
          issueType: issue,
          ...(options.preferredProposalId
            ? { preferredProposalId: options.preferredProposalId }
            : {}),
          ...(options.historyOnly ? { historyOnly: true } : {}),
        });
        if (
          options.preferredProposalId &&
          result.focusedProposalId !== options.preferredProposalId
        ) {
          throw new Error("The related follow-up could not be focused");
        }
        setIssueType(issue);
        setHistory(result.history || []);
        setHistoryCards(result.historyCards || []);
        setRevisionProposalId("");
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
        setActiveSequence(null);
        setLoadError(
          options.preferredProposalId
            ? "That related follow-up could not be opened. It may already have been reviewed."
            : "The review session could not be started. Please try again.",
        );
        setRetryIssueType(options.preferredProposalId ? null : issue);
        setPhase("select");
      }
    },
    [],
  );

  const startLinkedFollowUp = useCallback(
    (followUp: SomLinkedFollowUp, source?: SomFollowUpSource) => {
      const linkedSource = source || followUp.sources[0];
      if (!linkedSource) {
        return startSession(followUp.issueType, {
          preferredProposalId: followUp.proposalId,
        });
      }
      return startSession(followUp.issueType, {
        preferredProposalId: followUp.proposalId,
        sequence: { source: linkedSource, followUp },
      });
    },
    [startSession],
  );

  const continueContinuousReview = useCallback(async () => {
    clearActiveReview();
    const overview = await loadOverview();
    if (!overview) return;

    const nextFollowUp = overview.readyFollowUps?.[0];
    if (nextFollowUp) {
      await startLinkedFollowUp(nextFollowUp);
      return;
    }
    const nextIssue = overview.issueTypes.find(
      (candidate) =>
        candidate.enabled &&
        candidate.released &&
        candidate.pending > 0 &&
        !(candidate.blockedBy || []).length,
    );
    if (nextIssue) {
      await startSession(nextIssue.id);
      return;
    }
    setPhase("select");
  }, [clearActiveReview, loadOverview, startLinkedFollowUp, startSession]);

  const introStorageKey = useCallback(
    (issue: SomIssueType) =>
      `som-review-task-intro-${datasetVersion || "current"}-${issue}`,
    [datasetVersion],
  );

  const chooseIssueType = useCallback(
    (issue: SomIssueType) => {
      setLoadError("");
      setRetryIssueType(null);
      setFollowUpOffer(null);
      setActiveSequence(null);
      setCompletedSequence(null);
      const selectedQueue = issueTypes.find(
        (candidate) => candidate.id === issue,
      );
      if (selectedQueue?.blockedBy?.length && selectedQueue.reviewed > 0) {
        startSession(issue, { historyOnly: true });
        return;
      }
      if (
        selectedQueue &&
        selectedQueue.pending === 0 &&
        selectedQueue.reviewed > 0
      ) {
        startSession(issue);
        return;
      }
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
    [introStorageKey, issueTypes, startSession],
  );

  useEffect(() => {
    if (!router.isReady || phase !== "select" || !datasetId) return;
    const requestedIssue =
      typeof router.query.issue === "string" ? router.query.issue : "";
    const issue = issueTypes.find(
      (candidate) => candidate.id === requestedIssue,
    );
    if (!issue) return;
    const requestKey = `${datasetId}:${issue.id}`;
    if (autoOpenedTaskRef.current === requestKey) return;
    autoOpenedTaskRef.current = requestKey;
    void router
      .replace(
        { pathname: "/review", query: { dataset: datasetId } },
        undefined,
        { shallow: true },
      )
      .then(() => chooseIssueType(issue.id));
  }, [
    chooseIssueType,
    datasetId,
    issueTypes,
    phase,
    router,
    router.isReady,
    router.query.issue,
  ]);

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
          ...(trustedPropagationAllowed && currentRound
            ? { trustedPropagation: trustedPropagationEnabled }
            : {}),
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
            proposalIndex:
              card.proposalIndex ??
              cards.findIndex(
                (candidate) => candidate.proposalId === card.proposalId,
              ),
            question: card.reviewerView.question,
            decision: submission.decision,
            disagreementReason: submission.disagreementReason,
            suggestedCorrection: submission.suggestedCorrection,
            reviewedAt,
            fastTracked: result.propagation?.status === "ready",
          },
        ].sort((left, right) => left.proposalIndex - right.proposalIndex),
      );
      setHistoryCards((currentCards) =>
        currentCards.some(
          (historyCard) => historyCard.proposalId === card.proposalId,
        )
          ? currentCards
          : [...currentCards, card].sort(
              (left, right) =>
                (left.proposalIndex ?? 0) - (right.proposalIndex ?? 0),
            ),
      );
      setCursor(result.cursor);
      const followUps = result.followUps || [];
      if (followUps.length > 0) {
        const sourceIssue = issueTypes.find(
          (candidate) => candidate.id === card.issueType,
        );
        const source = {
          proposalId: card.proposalId,
          issueType: card.issueType,
          issueLabel: sourceIssue?.label || "Earlier review",
          question: card.reviewerView.question,
        };
        if (
          trustedPropagationAllowed &&
          currentRound &&
          trustedPropagationEnabled
        ) {
          await startLinkedFollowUp(followUps[0], source);
          return;
        }
        setFollowUpOffer({
          source,
          followUps,
          sourceQueueCompleted: result.completed,
        });
        setPhase("follow-up");
        return;
      }
      if (activeSequence?.followUp.proposalId === card.proposalId) {
        if (
          trustedPropagationAllowed &&
          currentRound &&
          trustedPropagationEnabled
        ) {
          await continueContinuousReview();
          return;
        }
        setCompletedSequence({
          sequence: activeSequence,
          followUpQueueCompleted: result.completed,
        });
        setPhase("sequence-complete");
        return;
      }
      if (result.completed) {
        if (
          trustedPropagationAllowed &&
          currentRound &&
          trustedPropagationEnabled
        ) {
          await continueContinuousReview();
          return;
        }
        setPhase("complete");
      }
    },
    [
      activeSequence,
      cards,
      currentRound,
      cursor,
      continueContinuousReview,
      issueTypes,
      sessionId,
      startLinkedFollowUp,
      trustedPropagationAllowed,
      trustedPropagationEnabled,
      user?.userId,
    ],
  );

  const revisionItem = history.find(
    (item) => item.proposalId === revisionProposalId,
  );
  const revisionCard = revisionItem
    ? historyCards.find((card) => card.proposalId === revisionItem.proposalId)
    : undefined;

  const submitRevision = useCallback(
    async (submission: ReviewSubmission) => {
      const item = history.find(
        (candidate) => candidate.proposalId === revisionProposalId,
      );
      const card = item
        ? historyCards.find(
            (candidate) => candidate.proposalId === item.proposalId,
          )
        : undefined;
      if (!item || !card || !user?.userId) {
        throw new Error("The earlier review is unavailable");
      }

      const reviewedAt = new Date().toISOString();
      const result = await Post<SomReviseResult>(
        "/som-review/revise",
        {
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
          ...(trustedPropagationAllowed && currentRound
            ? {
                trustedPropagation:
                  Boolean(item.fastTracked) || trustedPropagationEnabled,
              }
            : {}),
        },
        false,
      );

      if (result.changed || result.propagation) {
        setHistory((currentHistory) =>
          currentHistory.map((historyItem) =>
            historyItem.proposalId === item.proposalId
              ? {
                  ...historyItem,
                  decision: submission.decision,
                  disagreementReason: submission.disagreementReason,
                  suggestedCorrection: submission.suggestedCorrection,
                  reviewedAt,
                  fastTracked:
                    result.propagation?.status === "ready" ||
                    (result.propagation === undefined &&
                      historyItem.fastTracked),
                }
              : historyItem,
          ),
        );
      }

      const followUps = result.followUps || [];
      if (followUps.length > 0) {
        const sourceIssue = issueTypes.find(
          (candidate) => candidate.id === card.issueType,
        );
        const source = {
          proposalId: card.proposalId,
          issueType: card.issueType,
          issueLabel: sourceIssue?.label || "Earlier review",
          question: card.reviewerView.question,
        };
        setRevisionProposalId("");
        if (
          trustedPropagationAllowed &&
          currentRound &&
          trustedPropagationEnabled
        ) {
          await startLinkedFollowUp(followUps[0], source);
          return;
        }
        setFollowUpOffer({
          source,
          followUps,
          sourceQueueCompleted: cards.length === 0 || cursor >= cards.length,
        });
        setPhase("follow-up");
        return;
      }

      if (result.changed) {
        if (issueType) {
          const selectedQueue = issueTypes.find(
            (candidate) => candidate.id === issueType,
          );
          await startSession(issueType, {
            historyOnly: Boolean(selectedQueue?.blockedBy?.length),
          });
          return;
        }
      }
      setRevisionProposalId("");
      setPhase(
        cards.length === 0
          ? "empty"
          : cursor >= cards.length
            ? "complete"
            : "session",
      );
    },
    [
      cards.length,
      currentRound,
      cursor,
      history,
      historyCards,
      issueTypes,
      issueType,
      revisionProposalId,
      startLinkedFollowUp,
      startSession,
      trustedPropagationAllowed,
      trustedPropagationEnabled,
      user?.userId,
    ],
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
    if (revisionCard && user?.userId) {
      clearReviewDraft({
        reviewerId: user.userId,
        datasetVersion: revisionCard.datasetVersion,
        proposalId: revisionCard.proposalId,
        mode: "revise",
      });
    }
    setRevisionProposalId("");
    setPhase(
      cards.length === 0
        ? "empty"
        : cursor >= cards.length
          ? "complete"
          : "session",
    );
  }, [cards.length, cursor, revisionCard, user?.userId]);

  const exitToSelector = useCallback(() => {
    clearActiveReview();
    loadOverview();
  }, [clearActiveReview, loadOverview]);

  const continueOriginalQueue = useCallback(() => {
    if (!followUpOffer) return;
    setActiveSequence(null);
    setFollowUpOffer(null);
    setPhase(followUpOffer.sourceQueueCompleted ? "complete" : "session");
  }, [followUpOffer]);

  const returnToSourceQueue = useCallback(() => {
    if (!completedSequence) return;
    const sourceIssueType = completedSequence.sequence.source.issueType;
    setCompletedSequence(null);
    setActiveSequence(null);
    startSession(sourceIssueType);
  }, [completedSequence, startSession]);

  const continueFollowUpQueue = useCallback(() => {
    if (!completedSequence) return;
    const followUpIssueType = completedSequence.sequence.followUp.issueType;
    setCompletedSequence(null);
    setActiveSequence(null);
    startSession(followUpIssueType);
  }, [completedSequence, startSession]);

  const currentCard = cards[cursor];
  const activeCard = revisionCard || currentCard;
  const selectedIssue = issueTypes.find((issue) => issue.id === issueType);
  const issueLabel = selectedIssue?.label || "Proposal review";
  const issueTotal = selectedIssue?.total || cards.length;
  const availableReviewTotal =
    history.length + Math.max(0, cards.length - cursor);

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
        <Container maxWidth="lg">
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

          {phase !== "loading" && trustedPropagationAllowed && currentRound && (
            <TrustedPropagationControl
              enabled={trustedPropagationEnabled}
              onChange={updateTrustedPropagation}
            />
          )}

          {phase === "loading" && (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 18 }}>
              <CircularProgress size={36} aria-label="Loading review queue" />
            </Stack>
          )}

          {phase === "select" && (
            <ReviewQueueSelector
              issueTypes={issueTypes}
              branch={branch}
              ontologyName={ontologyName}
              onStart={chooseIssueType}
              readyFollowUps={readyFollowUps}
              onStartFollowUp={(followUp) => startLinkedFollowUp(followUp)}
              canDeliberate={canDeliberate}
              onOpenDeliberation={() =>
                router.push({
                  pathname: "/review/admin",
                  query: { dataset: datasetId },
                })
              }
              canInspectPriorReview={canInspectPriorReview}
              onOpenInspection={() =>
                router.push({
                  pathname: "/review/inspection",
                  query: { workspace: workspaceId },
                })
              }
              headerAction={<ThemeModeToggle />}
              workspaceControls={
                <>
                  <ReviewWorkspaceSwitcher
                    workspaces={workspaces}
                    workspaceId={workspaceId}
                    datasetId={datasetId}
                    onChange={switchDataset}
                  />
                  {!currentRound && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                      You are reviewing a past round. Revisions are saved with
                      that round, but they will not affect the current ontology
                      until its decisions are propagated again.
                    </Alert>
                  )}
                </>
              }
            />
          )}

          {phase === "follow-up" && followUpOffer && (
            <Stack sx={{ py: 2 }}>
              <Stack direction="row" justifyContent="flex-end">
                <ThemeModeToggle />
              </Stack>
              <ReviewFollowUpPanel
                variant="handoff"
                sourceLabel={followUpOffer.source.issueLabel}
                followUps={followUpOffer.followUps}
                onReview={(followUp) =>
                  startLinkedFollowUp(followUp, followUpOffer.source)
                }
                onContinue={continueOriginalQueue}
                continueLabel={`${
                  followUpOffer.sourceQueueCompleted ? "Finish" : "Continue"
                } ${followUpOffer.source.issueLabel}`}
              />
            </Stack>
          )}

          {phase === "follow-up" && !followUpOffer && (
            <Alert
              severity="error"
              action={
                <Button disableElevation onClick={exitToSelector}>
                  All review types
                </Button>
              }
            >
              The related follow-up is unavailable. Return to all review types
              and try again.
            </Alert>
          )}

          {phase === "intro" && selectedIssue && (
            <ReviewTaskIntro
              issueType={selectedIssue.id}
              branch={branch}
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
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "baseline" }}
                  justifyContent="space-between"
                  spacing={{ xs: 0.25, sm: 2 }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    spacing={1}
                  >
                    <Typography
                      component="h1"
                      sx={{ fontSize: "1rem", fontWeight: 750 }}
                    >
                      {issueLabel}
                    </Typography>
                    <Chip
                      label={`${branch} sub-branch`}
                      color="primary"
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 750 }}
                    />
                  </Stack>
                  <Typography
                    aria-live="polite"
                    sx={{
                      flex: "0 0 auto",
                      color: "text.secondary",
                      fontWeight: 700,
                      alignSelf: { xs: "flex-end", sm: "auto" },
                    }}
                  >
                    {revisionItem ? (
                      <>
                        Saved item {revisionItem.proposalIndex + 1} of{" "}
                        {issueTotal}
                      </>
                    ) : (
                      <>
                        Item {(currentCard?.proposalIndex ?? cursor) + 1} of{" "}
                        {issueTotal}
                      </>
                    )}
                  </Typography>
                </Stack>
                {revisionItem ? (
                  <Box
                    role="status"
                    aria-label={`Reviewing saved item ${
                      revisionItem.proposalIndex + 1
                    } of ${issueTotal}. Queue progress remains ${history.length} of ${availableReviewTotal} reviewed.`}
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      gap: 0.75,
                      borderLeft: 4,
                      borderColor: "info.main",
                      borderRadius: 1,
                      backgroundColor: "action.hover",
                      px: 1.5,
                      py: 1.1,
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <HistoryOutlinedIcon
                        aria-hidden="true"
                        color="info"
                        sx={{ fontSize: 22 }}
                      />
                      <Typography sx={{ fontWeight: 750 }}>
                        Reviewing a saved answer
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{ color: "text.secondary", fontWeight: 650 }}
                    >
                      Queue remains {history.length} of {availableReviewTotal}{" "}
                      reviewed
                    </Typography>
                  </Box>
                ) : (
                  <LinearProgress
                    variant="determinate"
                    value={
                      availableReviewTotal === 0
                        ? 100
                        : (history.length / availableReviewTotal) * 100
                    }
                    aria-label={
                      availableReviewTotal === 0
                        ? "All available items completed"
                        : `${history.length} of ${availableReviewTotal} items completed`
                    }
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                )}
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
                  <Stack spacing={0.5}>
                    <Typography component="div">
                      Saved answer:{" "}
                      <strong>
                        {revisionItem.decision === "agree"
                          ? "Agreed"
                          : "Disagreed"}
                      </strong>
                      .
                    </Typography>
                    {revisionItem.decision === "disagree" && (
                      <>
                        <Typography
                          component="div"
                          sx={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          Saved rationale:{" "}
                          <strong>
                            {revisionItem.disagreementReason ||
                              "No written rationale was saved."}
                          </strong>
                        </Typography>
                        {revisionItem.suggestedCorrection && (
                          <Typography
                            component="div"
                            sx={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            Saved suggestion:{" "}
                            <strong>{revisionItem.suggestedCorrection}</strong>
                          </Typography>
                        )}
                      </>
                    )}
                    <Typography component="div">
                      The form below starts with this saved response. Submit a
                      revision to replace it, or keep the saved answer to return
                      to your current review position.
                    </Typography>
                  </Stack>
                </Alert>
              )}
              {!revisionItem &&
                activeSequence?.followUp.proposalId ===
                  activeCard.proposalId && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Related follow-up from{" "}
                    <strong>{activeSequence.source.issueLabel}</strong>. This is
                    a separate decision. After answering it, you can return to
                    the original review queue.
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
                        reviewedAt: revisionItem.reviewedAt,
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

          {phase === "sequence-complete" && completedSequence && (
            <Stack sx={{ py: 2 }}>
              <Stack direction="row" justifyContent="flex-end">
                <ThemeModeToggle />
              </Stack>
              <Stack
                alignItems="center"
                spacing={2.5}
                sx={{ py: { xs: 7, sm: 10 }, textAlign: "center" }}
              >
                <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
                <Box>
                  <Typography
                    variant="h5"
                    component="h1"
                    sx={{ fontWeight: 800 }}
                  >
                    Related decisions completed
                  </Typography>
                  <Typography
                    sx={{ mt: 0.75, color: "text.secondary", lineHeight: 1.55 }}
                  >
                    You reviewed the diagnosis and its exact follow-up as two
                    separate decisions.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: "100%",
                    borderTop: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    py: 2,
                  }}
                >
                  <Typography sx={{ fontWeight: 750 }}>
                    {completedSequence.sequence.source.issueLabel}
                  </Typography>
                  <Typography sx={{ mt: 0.4, color: "text.secondary" }}>
                    {completedSequence.sequence.source.question}
                  </Typography>
                  <Typography sx={{ mt: 1.5, fontWeight: 750 }}>
                    {completedSequence.sequence.followUp.issueLabel}
                  </Typography>
                  <Typography sx={{ mt: 0.4, color: "text.secondary" }}>
                    {completedSequence.sequence.followUp.question}
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  <Button
                    disableElevation
                    variant="contained"
                    startIcon={<ArrowBackIcon />}
                    onClick={returnToSourceQueue}
                    sx={{ minHeight: 50, fontWeight: 750 }}
                  >
                    Return to {completedSequence.sequence.source.issueLabel}
                  </Button>
                  {completedSequence.followUpQueueCompleted ? (
                    <Button
                      disableElevation
                      variant="outlined"
                      onClick={exitToSelector}
                      sx={{ minHeight: 50, fontWeight: 700 }}
                    >
                      All review types
                    </Button>
                  ) : (
                    <Button
                      disableElevation
                      variant="outlined"
                      onClick={continueFollowUpQueue}
                      sx={{ minHeight: 50, fontWeight: 700 }}
                    >
                      Continue {completedSequence.sequence.followUp.issueLabel}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Stack>
          )}

          {phase === "sequence-complete" && !completedSequence && (
            <Alert
              severity="error"
              action={
                <Button disableElevation onClick={exitToSelector}>
                  All review types
                </Button>
              }
            >
              The completed review sequence is unavailable. Return to all review
              types and try again.
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
                    {history.length}{" "}
                    {history.length === 1 ? "judgment" : "judgments"} available
                    to revise
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
                  All available proposals reviewed
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  {history.length > 0
                    ? `You can revise any of your ${history.length} saved ${
                        history.length === 1 ? "judgment" : "judgments"
                      } below.`
                    : "No proposals are currently available for this review type."}
                </Typography>
                <ReviewHistorySelect
                  history={history}
                  selectedProposalId={revisionProposalId}
                  onSelect={selectRevision}
                />
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

          {phase !== "loading" && datasetId && (
            <OntologyComparisonPanel
              key={datasetId}
              datasetId={datasetId}
              branch={branch}
              roundLabel={roundLabel}
              currentRound={currentRound}
            />
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
