import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";

import {
  SomDeliberationCommentStance,
  SomDeliberationProposalResponse,
  SomDeliberationResolutionDecision,
  SomReviewDecision,
} from "../../types/ISomReview";
import ContextRenderer from "./ContextRenderer";

const percent = (value: number | null): string =>
  value === null ? "No responses" : `${Math.round(value * 100)}% agree`;

const dateLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const stanceLabel = (stance: SomDeliberationCommentStance): string => {
  switch (stance) {
    case "support":
      return "Reason to support";
    case "oppose":
      return "Reason to oppose";
    case "question":
      return "Open question";
    case "synthesis":
      return "Synthesis";
  }
};

const stanceColor = (
  stance: SomDeliberationCommentStance,
): "success" | "error" | "warning" | "info" => {
  switch (stance) {
    case "support":
      return "success";
    case "oppose":
      return "error";
    case "question":
      return "warning";
    case "synthesis":
      return "info";
  }
};

const StatePanel = ({
  label,
  value,
  proposed,
}: {
  label: string;
  value: string;
  proposed?: boolean;
}) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 0,
      p: 2,
      borderRadius: 1.5,
      border: (theme) =>
        `2px solid ${
          proposed
            ? alpha(theme.palette.primary.main, 0.55)
            : theme.palette.divider
        }`,
      backgroundColor: (theme) =>
        proposed ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
    }}
  >
    <Typography
      sx={{
        color: proposed ? "primary.main" : "text.secondary",
        fontWeight: 750,
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ mt: 0.75, fontSize: "1.02rem", lineHeight: 1.55 }}>
      {value}
    </Typography>
  </Box>
);

const SupportBar = ({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) => (
  <Box sx={{ flex: 1, minWidth: 200 }}>
    <Stack direction="row" justifyContent="space-between" spacing={1}>
      <Typography sx={{ color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontWeight: 750 }}>{percent(value)}</Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={(value || 0) * 100}
      aria-label={`${label}: ${percent(value)}`}
      sx={{ mt: 0.75, height: 10, borderRadius: 1 }}
    />
  </Box>
);

const DeliberationDialog = ({
  open,
  loading,
  detail,
  loadError,
  onClose,
  onRefresh,
  onComment,
  onPosition,
  onResolve,
}: {
  open: boolean;
  loading: boolean;
  detail: SomDeliberationProposalResponse | null;
  loadError: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onComment: (
    stance: SomDeliberationCommentStance,
    body: string,
  ) => Promise<void>;
  onPosition: (decision: SomReviewDecision, rationale: string) => Promise<void>;
  onResolve: (
    decision: SomDeliberationResolutionDecision,
    rationale: string,
  ) => Promise<void>;
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [commentStance, setCommentStance] =
    useState<SomDeliberationCommentStance>("question");
  const [commentBody, setCommentBody] = useState("");
  const [positionDecision, setPositionDecision] =
    useState<SomReviewDecision>("agree");
  const [positionRationale, setPositionRationale] = useState("");
  const [resolutionDecision, setResolutionDecision] =
    useState<SomDeliberationResolutionDecision>("defer");
  const [resolutionRationale, setResolutionRationale] = useState("");
  const [saving, setSaving] = useState<
    "comment" | "position" | "resolution" | ""
  >("");
  const [mutationError, setMutationError] = useState("");

  useEffect(() => {
    setCommentStance("question");
    setCommentBody("");
    setPositionDecision(detail?.myEffectiveDecision || "agree");
    setPositionRationale("");
    setResolutionDecision(detail?.resolution?.decision || "defer");
    setResolutionRationale(detail?.resolution?.rationale || "");
    setMutationError("");
  }, [
    detail?.card.proposalId,
    detail?.myEffectiveDecision,
    detail?.resolution,
  ]);

  const mutate = async (
    type: "comment" | "position" | "resolution",
    action: () => Promise<void>,
  ) => {
    setSaving(type);
    setMutationError("");
    try {
      await action();
      if (type === "comment") setCommentBody("");
      if (type === "position") setPositionRationale("");
    } catch (error: any) {
      setMutationError(
        error?.response?.data?.error ||
          "The change could not be saved. Please try again.",
      );
    } finally {
      setSaving("");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="lg"
      aria-labelledby="deliberation-dialog-title"
      PaperProps={{ sx: { borderRadius: { xs: 0, md: 2 } } }}
    >
      <Box component="header" sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ForumOutlinedIcon color="primary" />
          <Typography
            id="deliberation-dialog-title"
            component="h2"
            sx={{ flex: 1, fontSize: "1.25rem", fontWeight: 800 }}
          >
            Proposal deliberation
          </Typography>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                aria-label="Refresh deliberation"
                onClick={onRefresh}
                disabled={loading || Boolean(saving)}
                sx={{ width: 46, height: 46 }}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Close">
            <span>
              <IconButton
                aria-label="Close deliberation"
                onClick={onClose}
                disabled={Boolean(saving)}
                sx={{ width: 46, height: 46 }}
              >
                <CloseIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
        {loading && (
          <Stack alignItems="center" sx={{ py: 14 }}>
            <CircularProgress aria-label="Loading deliberation" />
          </Stack>
        )}
        {!loading && loadError && <Alert severity="error">{loadError}</Alert>}
        {!loading && detail && (
          <Stack spacing={4}>
            {mutationError && (
              <Alert severity="error" onClose={() => setMutationError("")}>
                {mutationError}
              </Alert>
            )}
            {detail.resolution && (
              <Alert severity="info" icon={<CheckIcon />}>
                <Typography sx={{ fontWeight: 750 }}>
                  Final resolution: {detail.resolution.decision}
                </Typography>
                <Typography sx={{ mt: 0.5 }}>
                  {detail.resolution.rationale}
                </Typography>
                <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                  {detail.resolution.resolvedByName} ·{" "}
                  {dateLabel(detail.resolution.resolvedAt)}
                </Typography>
              </Alert>
            )}

            <Box component="section" aria-labelledby="proposal-evidence-title">
              <Typography
                id="proposal-evidence-title"
                component="h3"
                sx={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1.45 }}
              >
                {detail.card.reviewerView.question}
              </Typography>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ mt: 2.5 }}
              >
                <StatePanel
                  label="Current"
                  value={detail.card.reviewerView.currentState}
                />
                <StatePanel
                  label="Proposed"
                  value={detail.card.reviewerView.proposedState}
                  proposed
                />
              </Stack>
              <Box sx={{ mt: 2.5 }}>
                <Typography sx={{ color: "text.secondary", fontWeight: 750 }}>
                  Proposal rationale
                </Typography>
                <Typography sx={{ mt: 0.75, lineHeight: 1.65 }}>
                  {detail.card.reviewerView.reasoning}
                </Typography>
              </Box>
              <Box sx={{ mt: 2.5 }}>
                <ContextRenderer context={detail.card.reviewerView.context} />
              </Box>
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="weighted-result-title">
              <Typography
                id="weighted-result-title"
                component="h3"
                sx={{ fontSize: "1.15rem", fontWeight: 800 }}
              >
                Weighted result
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                sx={{ mt: 2 }}
              >
                <SupportBar
                  label="Core team"
                  value={detail.aggregate.coreWeightedSupport}
                />
                <SupportBar
                  label="All reviewers"
                  value={detail.aggregate.allWeightedSupport}
                />
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
                {detail.aggregate.roleSummaries.map((role) => (
                  <Chip
                    key={role.role}
                    label={`${role.label}: ${role.responses} responses · ${role.weight}x each`}
                    variant="outlined"
                  />
                ))}
              </Stack>
              {!detail.aggregate.quorumMet && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  At least two core-team judgments are required for a ready
                  recommendation.
                </Alert>
              )}
              {(detail.aggregate.stewardSplit ||
                detail.aggregate.stewardDissent) && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  A senior steward disagrees with the emerging direction. Keep
                  this proposal in deliberation.
                </Alert>
              )}
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="participants-title">
              <Typography
                id="participants-title"
                component="h3"
                sx={{ fontSize: "1.15rem", fontWeight: 800 }}
              >
                Reviewer positions
              </Typography>
              <Stack spacing={0} sx={{ mt: 1.5 }}>
                {detail.participants.map((participant) => (
                  <Box
                    key={participant.reviewerId}
                    sx={{
                      py: 2,
                      borderBottom: (theme) =>
                        `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      alignItems={{ xs: "flex-start", md: "center" }}
                      spacing={1.5}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 750 }}>
                          {participant.displayName}
                        </Typography>
                        <Stack
                          direction="row"
                          flexWrap="wrap"
                          gap={0.75}
                          sx={{ mt: 0.75 }}
                        >
                          <Chip
                            size="small"
                            label={`${participant.roleLabel} · ${participant.weight}x`}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={
                              participant.effectiveDecision === "agree"
                                ? "Agree"
                                : "Disagree"
                            }
                            color={
                              participant.effectiveDecision === "agree"
                                ? "success"
                                : "error"
                            }
                          />
                          {participant.revised && (
                            <Chip size="small" label="Revised" color="info" />
                          )}
                        </Stack>
                      </Box>
                      <Typography
                        sx={{ color: "text.secondary", fontSize: "0.875rem" }}
                      >
                        {dateLabel(participant.reviewedAt)}
                      </Typography>
                    </Stack>
                    {participant.rationale && (
                      <Typography sx={{ mt: 1.25, lineHeight: 1.6 }}>
                        {participant.rationale}
                      </Typography>
                    )}
                  </Box>
                ))}
                {detail.participants.length === 0 && (
                  <Typography sx={{ py: 2, color: "text.secondary" }}>
                    No independent reviews yet.
                  </Typography>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="discussion-title">
              <Typography
                id="discussion-title"
                component="h3"
                sx={{ fontSize: "1.15rem", fontWeight: 800 }}
              >
                Discussion
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                {detail.comments.map((comment) => (
                  <Box
                    key={comment.id}
                    sx={{
                      p: 2,
                      borderRadius: 1.5,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1}
                    >
                      <Typography sx={{ fontWeight: 750 }}>
                        {comment.authorName}
                      </Typography>
                      <Chip
                        size="small"
                        label={stanceLabel(comment.stance)}
                        color={stanceColor(comment.stance)}
                      />
                      <Typography
                        sx={{
                          ml: { sm: "auto !important" },
                          color: "text.secondary",
                          fontSize: "0.875rem",
                        }}
                      >
                        {dateLabel(comment.createdAt)}
                      </Typography>
                    </Stack>
                    <Typography sx={{ mt: 1, lineHeight: 1.6 }}>
                      {comment.body}
                    </Typography>
                  </Box>
                ))}
                {detail.comments.length === 0 && (
                  <Typography sx={{ color: "text.secondary" }}>
                    No discussion comments yet.
                  </Typography>
                )}
              </Stack>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Select
                  value={commentStance}
                  onChange={(event) =>
                    setCommentStance(
                      event.target.value as SomDeliberationCommentStance,
                    )
                  }
                  aria-label="Comment type"
                  sx={{ alignSelf: { sm: "flex-start" }, minWidth: 220 }}
                >
                  <MenuItem value="support">Reason to support</MenuItem>
                  <MenuItem value="oppose">Reason to oppose</MenuItem>
                  <MenuItem value="question">Open question</MenuItem>
                  <MenuItem value="synthesis">Synthesis</MenuItem>
                </Select>
                <TextField
                  label="Discussion comment"
                  multiline
                  minRows={3}
                  maxRows={8}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  inputProps={{ maxLength: 2000 }}
                />
                <Button
                  variant="contained"
                  startIcon={
                    saving === "comment" ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <ForumOutlinedIcon />
                    )
                  }
                  disabled={commentBody.trim().length < 3 || Boolean(saving)}
                  onClick={() =>
                    mutate("comment", () =>
                      onComment(commentStance, commentBody.trim()),
                    )
                  }
                  sx={{ alignSelf: { sm: "flex-start" }, minHeight: 48 }}
                >
                  Add comment
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box component="section" aria-labelledby="revise-position-title">
              <Typography
                id="revise-position-title"
                component="h3"
                sx={{ fontSize: "1.15rem", fontWeight: 800 }}
              >
                Revise my judgment
              </Typography>
              {detail.myOriginalDecision ? (
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  <ToggleButtonGroup
                    exclusive
                    value={positionDecision}
                    onChange={(_, value: SomReviewDecision | null) =>
                      value && setPositionDecision(value)
                    }
                    aria-label="Revised judgment"
                    sx={{ alignSelf: { sm: "flex-start" } }}
                  >
                    <ToggleButton
                      value="agree"
                      sx={{ minWidth: 130, minHeight: 46, fontWeight: 700 }}
                    >
                      Agree
                    </ToggleButton>
                    <ToggleButton
                      value="disagree"
                      sx={{ minWidth: 130, minHeight: 46, fontWeight: 700 }}
                    >
                      Disagree
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <TextField
                    label="Reason for the revised judgment"
                    required
                    multiline
                    minRows={2}
                    maxRows={6}
                    value={positionRationale}
                    onChange={(event) =>
                      setPositionRationale(event.target.value)
                    }
                    inputProps={{ maxLength: 2000 }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={
                      saving === "position" ? (
                        <CircularProgress size={20} />
                      ) : (
                        <SaveOutlinedIcon />
                      )
                    }
                    disabled={
                      positionRationale.trim().length < 3 || Boolean(saving)
                    }
                    onClick={() =>
                      mutate("position", () =>
                        onPosition(positionDecision, positionRationale.trim()),
                      )
                    }
                    sx={{ alignSelf: { sm: "flex-start" }, minHeight: 48 }}
                  >
                    Save revised judgment
                  </Button>
                </Stack>
              ) : (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  Complete this proposal in the independent review queue before
                  recording a revised judgment.
                </Alert>
              )}
            </Box>

            {detail.access.canFinalize && (
              <>
                <Divider />
                <Box component="section" aria-labelledby="resolution-title">
                  <Typography
                    id="resolution-title"
                    component="h3"
                    sx={{ fontSize: "1.15rem", fontWeight: 800 }}
                  >
                    Final resolution
                  </Typography>
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    This records the group outcome only. It does not apply any
                    ontology change.
                  </Alert>
                  <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                    <ToggleButtonGroup
                      exclusive
                      value={resolutionDecision}
                      onChange={(
                        _,
                        value: SomDeliberationResolutionDecision | null,
                      ) => value && setResolutionDecision(value)}
                      aria-label="Final resolution"
                      sx={{
                        alignSelf: { sm: "flex-start" },
                        "& .MuiToggleButton-root": {
                          minWidth: { xs: 94, sm: 120 },
                          minHeight: 46,
                          fontWeight: 700,
                        },
                      }}
                    >
                      <ToggleButton value="accept">Accept</ToggleButton>
                      <ToggleButton value="reject">Reject</ToggleButton>
                      <ToggleButton value="defer">Defer</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField
                      label="Resolution rationale"
                      required
                      multiline
                      minRows={3}
                      maxRows={8}
                      value={resolutionRationale}
                      onChange={(event) =>
                        setResolutionRationale(event.target.value)
                      }
                      inputProps={{ maxLength: 2000 }}
                    />
                    <Button
                      variant="contained"
                      startIcon={
                        saving === "resolution" ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          <CheckIcon />
                        )
                      }
                      disabled={
                        resolutionRationale.trim().length < 3 || Boolean(saving)
                      }
                      onClick={() =>
                        mutate("resolution", () =>
                          onResolve(
                            resolutionDecision,
                            resolutionRationale.trim(),
                          ),
                        )
                      }
                      sx={{ alignSelf: { sm: "flex-start" }, minHeight: 48 }}
                    >
                      {detail.resolution
                        ? "Update final resolution"
                        : "Record final resolution"}
                    </Button>
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Button
          color="inherit"
          onClick={onClose}
          disabled={Boolean(saving)}
          sx={{ minHeight: 46, fontWeight: 700 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeliberationDialog;
