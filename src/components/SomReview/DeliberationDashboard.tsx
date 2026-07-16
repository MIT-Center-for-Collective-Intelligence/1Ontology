import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import {
  SomDeliberationOverviewResponse,
  SomDeliberationProposalSummary,
  SomDeliberationRecommendation,
  SomIssueType,
} from "../../types/ISomReview";

type QueueFilter = "attention" | "ready" | "resolved" | "all";

const ISSUE_LABELS: Record<SomIssueType, string> = {
  "title-clarity": "Title clarity",
  "sibling-grouping": "Sibling grouping",
  "duplicate-synonym": "Duplicate or synonym",
  placement: "Placement",
  "wrong-verb": "Wrong main verb",
  "structural-overlap": "Structural overlap",
  "node-merge": "Merge nodes",
  relocation: "Exact relocation",
  "missing-activity": "Missing activity",
  "redundant-node": "Redundant node",
};

const RECOMMENDATION_LABELS: Record<SomDeliberationRecommendation, string> = {
  "awaiting-core-review": "Awaiting core review",
  "ready-to-accept": "Ready to accept",
  "ready-to-reject": "Ready to reject",
  "needs-deliberation": "Needs discussion",
};

const recommendationColor = (
  recommendation: SomDeliberationRecommendation,
): "default" | "success" | "error" | "warning" => {
  switch (recommendation) {
    case "ready-to-accept":
      return "success";
    case "ready-to-reject":
      return "error";
    case "needs-deliberation":
      return "warning";
    default:
      return "default";
  }
};

const supportLabel = (support: number | null): string =>
  support === null ? "No votes" : `${Math.round(support * 100)}% agree`;

const SupportMetric = ({
  label,
  support,
}: {
  label: string;
  support: number | null;
}) => (
  <Box sx={{ flex: 1, minWidth: 160 }}>
    <Stack direction="row" justifyContent="space-between" spacing={1}>
      <Typography sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
        {supportLabel(support)}
      </Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={(support || 0) * 100}
      aria-label={`${label}: ${supportLabel(support)}`}
      sx={{ mt: 0.75, height: 8, borderRadius: 1 }}
    />
  </Box>
);

const resolutionLabel = (
  proposal: SomDeliberationProposalSummary,
): string | null => {
  if (!proposal.resolution) return null;
  switch (proposal.resolution.decision) {
    case "accept":
      return "Accepted";
    case "reject":
      return "Rejected";
    case "defer":
      return "Deferred";
  }
};

const matchesQueue = (
  proposal: SomDeliberationProposalSummary,
  filter: QueueFilter,
): boolean => {
  if (filter === "all") return true;
  if (filter === "resolved") return Boolean(proposal.resolution);
  if (proposal.resolution) return false;
  if (filter === "ready") {
    return (
      proposal.aggregate.recommendation === "ready-to-accept" ||
      proposal.aggregate.recommendation === "ready-to-reject"
    );
  }
  return (
    proposal.aggregate.recommendation === "needs-deliberation" ||
    proposal.aggregate.recommendation === "awaiting-core-review"
  );
};

const queueRank = (proposal: SomDeliberationProposalSummary): number => {
  if (proposal.resolution) return 3;
  if (proposal.aggregate.recommendation === "needs-deliberation") return 0;
  if (proposal.aggregate.recommendation === "awaiting-core-review") return 1;
  return 2;
};

const DeliberationDashboard = ({
  overview,
  onOpen,
}: {
  overview: SomDeliberationOverviewResponse;
  onOpen: (proposalId: string) => void;
}) => {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("attention");
  const [issueFilter, setIssueFilter] = useState<SomIssueType | "all">("all");
  const [search, setSearch] = useState("");

  const issues = useMemo(
    () => [
      ...new Set(overview.proposals.map((proposal) => proposal.issueType)),
    ],
    [overview.proposals],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return overview.proposals
      .filter((proposal) => matchesQueue(proposal, queueFilter))
      .filter(
        (proposal) =>
          issueFilter === "all" || proposal.issueType === issueFilter,
      )
      .filter(
        (proposal) =>
          !query ||
          proposal.question.toLowerCase().includes(query) ||
          proposal.currentState.toLowerCase().includes(query) ||
          proposal.proposedState.toLowerCase().includes(query),
      )
      .sort(
        (first, second) =>
          queueRank(first) - queueRank(second) ||
          second.aggregate.totalResponses - first.aggregate.totalResponses ||
          first.question.localeCompare(second.question),
      );
  }, [issueFilter, overview.proposals, queueFilter, search]);

  const attentionCount = overview.proposals.filter(
    (proposal) => !proposal.resolution && matchesQueue(proposal, "attention"),
  ).length;
  const readyCount = overview.proposals.filter(
    (proposal) => !proposal.resolution && matchesQueue(proposal, "ready"),
  ).length;
  const resolvedCount = overview.proposals.filter(
    (proposal) => proposal.resolution,
  ).length;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography
            component="h1"
            sx={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: 0 }}
          >
            Group deliberation
          </Typography>
          <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
            Sell ontology proposals
          </Typography>
        </Box>
        <Chip
          icon={<ForumOutlinedIcon />}
          label={`${overview.access.roleLabel} access`}
          variant="outlined"
          sx={{ minHeight: 36 }}
        />
      </Stack>

      {overview.remainingIndependentReviews > 0 && (
        <Alert severity="info" sx={{ mt: 2.5 }}>
          {overview.remainingIndependentReviews} proposals remain in your
          independent review. Their group results stay hidden until you record
          your own judgment.
        </Alert>
      )}

      <Box
        sx={{
          mt: 3,
          py: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        {[
          ["Needs attention", attentionCount],
          ["Ready", readyCount],
          ["Resolved", resolvedCount],
        ].map(([label, count]) => (
          <Box key={label}>
            <Typography sx={{ color: "text.secondary" }}>{label}</Typography>
            <Typography sx={{ mt: 0.25, fontSize: "1.55rem", fontWeight: 800 }}>
              {count}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack
        direction={{ xs: "column", lg: "row" }}
        alignItems={{ xs: "stretch", lg: "center" }}
        spacing={1.5}
        sx={{ mt: 3 }}
      >
        <ToggleButtonGroup
          exclusive
          value={queueFilter}
          onChange={(_, value: QueueFilter | null) =>
            value && setQueueFilter(value)
          }
          aria-label="Deliberation queue"
          sx={{
            alignSelf: { xs: "stretch", lg: "auto" },
            "& .MuiToggleButton-root": {
              flex: { xs: 1, lg: "initial" },
              minHeight: 46,
              px: { xs: 1, sm: 2 },
              fontWeight: 700,
            },
          }}
        >
          <ToggleButton value="attention">Attention</ToggleButton>
          <ToggleButton value="ready">Ready</ToggleButton>
          <ToggleButton value="resolved">Resolved</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
        <Select
          value={issueFilter}
          onChange={(event) =>
            setIssueFilter(event.target.value as SomIssueType | "all")
          }
          aria-label="Filter by issue type"
          sx={{ minWidth: 190, minHeight: 46 }}
        >
          <MenuItem value="all">All issue types</MenuItem>
          {issues.map((issue) => (
            <MenuItem key={issue} value={issue}>
              {ISSUE_LABELS[issue]}
            </MenuItem>
          ))}
        </Select>
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search proposals"
          aria-label="Search proposals"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon aria-hidden="true" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Stack spacing={1.5} sx={{ mt: 2.5 }}>
        {filtered.map((proposal) => {
          const resolved = resolutionLabel(proposal);
          return (
            <Paper
              key={proposal.proposalId}
              variant="outlined"
              sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                alignItems={{ xs: "stretch", md: "center" }}
                spacing={2.5}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 1 }}
                  >
                    <Chip
                      size="small"
                      label={
                        resolved ||
                        RECOMMENDATION_LABELS[proposal.aggregate.recommendation]
                      }
                      color={
                        resolved
                          ? "info"
                          : recommendationColor(
                              proposal.aggregate.recommendation,
                            )
                      }
                    />
                    <Typography
                      sx={{ color: "text.secondary", fontSize: "0.875rem" }}
                    >
                      {proposal.aggregate.totalResponses} responses
                    </Typography>
                    {proposal.commentCount > 0 && (
                      <Typography
                        sx={{ color: "text.secondary", fontSize: "0.875rem" }}
                      >
                        {proposal.commentCount} comments
                      </Typography>
                    )}
                  </Stack>
                  <Typography
                    component="h2"
                    sx={{
                      fontSize: "1.08rem",
                      fontWeight: 750,
                      lineHeight: 1.45,
                    }}
                  >
                    {proposal.question}
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2.5}
                    sx={{ mt: 2 }}
                  >
                    <SupportMetric
                      label="Core team"
                      support={proposal.aggregate.coreWeightedSupport}
                    />
                    <SupportMetric
                      label="All reviewers"
                      support={proposal.aggregate.allWeightedSupport}
                    />
                  </Stack>
                  {(proposal.aggregate.stewardSplit ||
                    proposal.aggregate.stewardDissent) && (
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.75}
                      sx={{ mt: 1.5, color: "warning.main" }}
                    >
                      <WarningAmberOutlinedIcon fontSize="small" />
                      <Typography sx={{ fontWeight: 700 }}>
                        Senior-steward disagreement requires discussion
                      </Typography>
                    </Stack>
                  )}
                </Box>
                <Button
                  variant="outlined"
                  endIcon={
                    resolved ? <CheckCircleOutlineIcon /> : <ArrowForwardIcon />
                  }
                  onClick={() => onOpen(proposal.proposalId)}
                  sx={{ minHeight: 48, minWidth: 170, fontWeight: 750 }}
                >
                  Open deliberation
                </Button>
              </Stack>
            </Paper>
          );
        })}
        {filtered.length === 0 && (
          <Paper
            variant="outlined"
            sx={{ p: 5, textAlign: "center", borderRadius: 2 }}
          >
            <Typography sx={{ color: "text.secondary" }}>
              No proposals match these filters.
            </Typography>
          </Paper>
        )}
      </Stack>

      <Box
        sx={{
          mt: 3,
          py: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography sx={{ mb: 1, fontWeight: 750 }}>
          Private weighting model
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {overview.roleWeights.map((role) => (
            <Chip
              key={role.role}
              label={`${role.label}: ${role.weight}x`}
              variant="outlined"
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default DeliberationDashboard;
