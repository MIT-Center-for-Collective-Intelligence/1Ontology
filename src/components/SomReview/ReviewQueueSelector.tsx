import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, SxProps, Theme } from "@mui/material/styles";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PlaylistAddOutlinedIcon from "@mui/icons-material/PlaylistAddOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";

import {
  SomIssueType,
  SomIssueTypeOption,
  SomLinkedFollowUp,
} from "../../types/ISomReview";
import { SOM_REVIEW_STAGES } from "../../lib/somReview/reviewTaxonomy";
import { SOM_REVIEW_PATH } from "../../lib/somReview/reviewDependencies";
import { SELL_ONTOLOGY_NAME } from "../../lib/somReview/ontologyConfig";
import { ISSUE_DESCRIPTIONS } from "./reviewCopy";
import { reviewAccentColor, reviewIconColor } from "./reviewStyles";
import ReviewFollowUpPanel from "./ReviewFollowUpPanel";
import ReviewPath from "./ReviewPath";

const reviewPathStepByIssue = new Map(
  SOM_REVIEW_PATH.flatMap((step) =>
    step.issueTypes.map((issueType) => [issueType, step] as const),
  ),
);

const blockingPhaseSummary = (
  blockers: SomIssueTypeOption["blockedBy"],
): string => {
  const labels = Array.from(
    new Set(
      blockers.map((blocker) => {
        const step = reviewPathStepByIssue.get(blocker.id);
        return step ? `Phase ${step.number}: ${step.title}` : blocker.label;
      }),
    ),
  );
  if (labels.length <= 1) return labels[0] || "the earlier phase";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

const activeQueueStatusSx: SxProps<Theme> = {
  backgroundColor: (theme) =>
    alpha(
      theme.palette.primary.main,
      theme.palette.mode === "dark" ? 0.2 : 0.1,
    ),
  boxShadow: (theme) => `inset 0 0 0 1px ${reviewAccentColor(theme)}`,
  color: "text.primary",
  fontWeight: 700,
  "& .MuiChip-label": {
    color: "inherit",
  },
};

const IssueIcon = ({ issueType }: { issueType: SomIssueType }) => {
  const sx = { fontSize: 28 };
  switch (issueType) {
    case "title-clarity":
      return <DriveFileRenameOutlineIcon sx={sx} />;
    case "flat-list-grouping":
    case "compound-object-grouping":
    case "collection-design":
      return <AccountTreeOutlinedIcon sx={sx} />;
    case "synonym-enrichment":
    case "description-enrichment":
      return <PlaylistAddOutlinedIcon sx={sx} />;
    case "mistaken-synonym":
      return <RemoveCircleOutlineIcon sx={sx} />;
    case "duplicate-synonym":
      return <ContentCopyOutlinedIcon sx={sx} />;
    case "polysemy":
      return <AltRouteOutlinedIcon sx={sx} />;
    case "placement":
      return <ErrorOutlineIcon sx={sx} />;
    case "wrong-verb":
      return <SwapHorizOutlinedIcon sx={sx} />;
    case "misc-facet-duplicate":
      return <HubOutlinedIcon sx={sx} />;
    case "node-merge":
      return <CallMergeOutlinedIcon sx={sx} />;
    case "relocation":
    case "sense-relocation":
      return <AltRouteOutlinedIcon sx={sx} />;
    case "missing-activity":
      return <PlaylistAddOutlinedIcon sx={sx} />;
    case "redundant-node":
      return <RemoveCircleOutlineIcon sx={sx} />;
  }
};

const QueueStatus = ({ issue }: { issue: SomIssueTypeOption }) => {
  if (!issue.enabled) {
    return <Chip label="Unavailable" size="small" variant="outlined" />;
  }
  if (!issue.released) {
    return (
      <Chip
        icon={<LockOutlinedIcon />}
        label="Awaiting regenerated proposals"
        size="small"
        variant="outlined"
      />
    );
  }
  if (issue.total === 0) {
    return (
      <Chip label="No review items found" size="small" variant="outlined" />
    );
  }
  if ((issue.blockedBy || []).length > 0 && issue.pending > 0) {
    return (
      <Chip
        icon={<LockOutlinedIcon />}
        label={
          issue.reviewed > 0
            ? `${issue.reviewed} reviewed; new items locked`
            : "Earlier phase required"
        }
        size="small"
        variant="outlined"
      />
    );
  }
  if (issue.pending === 0 && issue.reviewed > 0) {
    return (
      <Chip
        icon={<CheckCircleOutlineIcon />}
        label={`${issue.reviewed} reviewed`}
        size="small"
        variant="outlined"
      />
    );
  }
  if (issue.pending === 0 && issue.waiting > 0) {
    return (
      <Chip
        icon={<LockOutlinedIcon />}
        label="Related review required"
        size="small"
        variant="outlined"
      />
    );
  }
  if (issue.pending === 0 && issue.notApplicable > 0) {
    return <Chip label="Not needed" size="small" variant="outlined" />;
  }
  if (issue.pending === 0) {
    return (
      <Chip
        icon={<CheckCircleOutlineIcon />}
        label="Reviewed"
        size="small"
        variant="outlined"
      />
    );
  }
  if (issue.activeSession) {
    const availableTotal = issue.reviewed + issue.pending;
    return (
      <Chip
        label={`In progress: ${issue.reviewed} of ${availableTotal} reviewed`}
        size="small"
        variant="outlined"
        sx={activeQueueStatusSx}
      />
    );
  }
  return (
    <Chip
      label={`${issue.pending} ready to review`}
      size="small"
      variant="outlined"
      sx={activeQueueStatusSx}
    />
  );
};

const ReviewQueueSelector = ({
  issueTypes,
  onStart,
  canDeliberate = false,
  onOpenDeliberation,
  headerAction,
  readyFollowUps = [],
  onStartFollowUp,
}: {
  issueTypes: SomIssueTypeOption[];
  onStart: (issueType: SomIssueType) => void;
  canDeliberate?: boolean;
  onOpenDeliberation?: () => void;
  headerAction?: React.ReactNode;
  readyFollowUps?: SomLinkedFollowUp[];
  onStartFollowUp?: (followUp: SomLinkedFollowUp) => void;
}) => (
  <Box>
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      spacing={1}
      sx={{ mb: 1.5 }}
    >
      <Typography
        component="h1"
        sx={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: 0 }}
      >
        Proposal review
      </Typography>
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        sx={{ width: { xs: "100%", sm: "auto" }, maxWidth: "100%" }}
      >
        <Chip
          label={SELL_ONTOLOGY_NAME}
          title={SELL_ONTOLOGY_NAME}
          variant="outlined"
          sx={{
            maxWidth: "100%",
            "& .MuiChip-label": {
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }}
        />
        {canDeliberate && onOpenDeliberation && (
          <Button
            disableElevation
            variant="outlined"
            startIcon={<GroupsOutlinedIcon />}
            onClick={onOpenDeliberation}
            sx={{ minHeight: 46, fontWeight: 750 }}
          >
            Group deliberation
          </Button>
        )}
        {headerAction}
      </Stack>
    </Stack>
    <Typography sx={{ mb: 3.5, color: "text.secondary", lineHeight: 1.55 }}>
      Reviews are recorded separately from ontology changes. Choose one type of
      issue to review.
    </Typography>

    <ReviewPath issueTypes={issueTypes} onStart={onStart} />

    {onStartFollowUp && (
      <ReviewFollowUpPanel
        followUps={readyFollowUps}
        onReview={onStartFollowUp}
      />
    )}

    <Stack spacing={4}>
      {SOM_REVIEW_STAGES.map((stage) => {
        const stageIssues = issueTypes.filter(
          (issue) => issue.stage === stage.id,
        );
        if (!stageIssues.length) return null;
        return (
          <Box
            key={stage.id}
            component="section"
            aria-labelledby={`${stage.id}-heading`}
          >
            <Typography
              id={`${stage.id}-heading`}
              component="h2"
              sx={{ fontSize: "1.2rem", fontWeight: 800 }}
            >
              {stage.title}
            </Typography>
            <Typography sx={{ mt: 0.35, mb: 1.5, color: "text.secondary" }}>
              {stage.description}
            </Typography>
            <Stack spacing={1.25}>
              {stageIssues.map((issue) => {
                const hasNewItems = issue.pending > 0;
                const hasSavedItems = issue.reviewed > 0;
                const blockers = issue.blockedBy || [];
                const blocked = blockers.length > 0 && hasNewItems;
                const completedOnly = !hasNewItems && hasSavedItems;
                const available =
                  issue.enabled &&
                  issue.released &&
                  (hasSavedItems || (hasNewItems && !blocked));
                const blockerPhases = blockingPhaseSummary(blockers);
                const unavailableLabel = !issue.released
                  ? `${issue.label}; ${issue.releaseMessage || "waiting for regenerated proposals"}`
                  : blocked
                    ? `${issue.label}; complete ${blockerPhases} first`
                    : issue.waiting
                      ? `${issue.label}; review its related diagnosis first`
                      : `${issue.label}, no review items available`;
                return (
                  <Card
                    key={issue.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      overflow: "hidden",
                      backgroundColor: available
                        ? "background.paper"
                        : "action.hover",
                      "& .MuiCardActionArea-root.Mui-disabled": {
                        opacity: 1,
                      },
                    }}
                  >
                    <CardActionArea
                      disabled={!available}
                      onClick={() => onStart(issue.id)}
                      aria-label={
                        blocked && hasSavedItems
                          ? `Review completed items in ${issue.label}, ${issue.reviewed} saved; complete ${blockerPhases} before new items`
                          : completedOnly
                            ? `Review completed items in ${issue.label}, ${issue.reviewed} saved`
                            : available
                              ? `${issue.activeSession ? "Resume" : "Start"} ${issue.label} review, ${issue.pending} remaining`
                              : unavailableLabel
                      }
                      sx={{ p: { xs: 1.75, sm: 2 }, minHeight: 92 }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "48px minmax(0, 1fr)",
                            sm: "48px minmax(0, 1fr) auto",
                          },
                          alignItems: "center",
                          columnGap: 2,
                          rowGap: 1.25,
                        }}
                      >
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: 1.5,
                            color: available
                              ? reviewIconColor
                              : "text.secondary",
                            backgroundColor: "action.hover",
                          }}
                        >
                          <IssueIcon issueType={issue.id} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                            spacing={1}
                          >
                            <Typography
                              sx={{
                                fontSize: "1.05rem",
                                fontWeight: 750,
                                lineHeight: 1.35,
                              }}
                            >
                              {issue.label}
                            </Typography>
                            {issue.optional && (
                              <Chip
                                label="Optional for initial restructuring"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                          <Typography
                            sx={{
                              mt: 0.35,
                              color: "text.secondary",
                              fontSize: "0.95rem",
                              lineHeight: 1.45,
                            }}
                          >
                            {ISSUE_DESCRIPTIONS[issue.id]}
                          </Typography>
                          {issue.pending === 0 && issue.waiting > 0 && (
                            <Typography
                              sx={{
                                mt: 0.6,
                                color: "text.primary",
                                fontSize: "0.9rem",
                                fontWeight: 650,
                                lineHeight: 1.4,
                              }}
                            >
                              {hasSavedItems
                                ? "No new items are ready. You can revisit your saved judgments; related actions require their diagnoses first."
                                : "Review its related diagnosis first. If you agree, this action will become available."}
                            </Typography>
                          )}
                          {blocked && (
                            <Typography
                              sx={{
                                mt: 0.6,
                                color: "text.primary",
                                fontSize: "0.9rem",
                                fontWeight: 650,
                                lineHeight: 1.4,
                              }}
                            >
                              Complete {blockerPhases} first.
                            </Typography>
                          )}
                          {!issue.released && (
                            <Typography
                              sx={{
                                mt: 0.6,
                                color: "text.primary",
                                fontSize: "0.9rem",
                                fontWeight: 650,
                                lineHeight: 1.4,
                              }}
                            >
                              {issue.releaseMessage ||
                                "Available after earlier decisions are applied and this proposal set is regenerated."}
                            </Typography>
                          )}
                        </Box>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{
                            gridColumn: { xs: "2", sm: "3" },
                            justifySelf: { xs: "start", sm: "end" },
                          }}
                        >
                          <QueueStatus issue={issue} />
                          {completedOnly ? (
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={0.6}
                              sx={{ color: "text.primary" }}
                            >
                              <HistoryOutlinedIcon
                                aria-hidden="true"
                                sx={{ fontSize: 20 }}
                              />
                              <Typography
                                sx={{
                                  fontSize: "0.9rem",
                                  fontWeight: 750,
                                }}
                              >
                                Review completed items
                              </Typography>
                              <ArrowForwardIcon
                                aria-hidden="true"
                                sx={{ color: "text.secondary" }}
                              />
                            </Stack>
                          ) : available ? (
                            <ArrowForwardIcon
                              aria-hidden="true"
                              sx={{ color: "text.secondary" }}
                            />
                          ) : null}
                        </Stack>
                      </Box>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        );
      })}
      {issueTypes.length === 0 && (
        <Alert severity="info">No review queues are available right now.</Alert>
      )}
    </Stack>
  </Box>
);

export default ReviewQueueSelector;
