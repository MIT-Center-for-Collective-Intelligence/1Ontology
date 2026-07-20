import React from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { SOM_REVIEW_PATH } from "../../lib/somReview/reviewDependencies";
import { SomIssueType, SomIssueTypeOption } from "../../types/ISomReview";

type StepStatus = "complete" | "current" | "later" | "contextual" | "optional";

const statusForStep = (
  issues: SomIssueTypeOption[],
  contextual?: boolean,
  optional?: boolean,
): StepStatus => {
  if (optional) return "optional";
  const relevant = issues.filter((issue) => issue.enabled && issue.total > 0);
  if (
    relevant.length === 0 ||
    relevant.every((issue) => issue.pending === 0 && issue.waiting === 0)
  ) {
    return "complete";
  }
  if (contextual) {
    return relevant.some((issue) => issue.pending > 0)
      ? "current"
      : "contextual";
  }
  if (
    relevant.some(
      (issue) => issue.pending > 0 && (issue.blockedBy || []).length === 0,
    )
  ) {
    return "current";
  }
  return "later";
};

const StatusChip = ({ status }: { status: StepStatus }) => {
  if (status === "complete") {
    return (
      <Chip
        icon={<CheckCircleOutlineIcon />}
        label="Complete"
        color="success"
        size="small"
        variant="outlined"
      />
    );
  }
  if (status === "current") {
    return <Chip label="Current" color="primary" size="small" />;
  }
  if (status === "later") {
    return (
      <Chip
        icon={<LockOutlinedIcon />}
        label="Later"
        size="small"
        variant="outlined"
      />
    );
  }
  return (
    <Chip
      label={status === "optional" ? "Optional" : "As decisions unlock it"}
      size="small"
      variant="outlined"
    />
  );
};

const ReviewPath = ({
  issueTypes,
  onStart,
}: {
  issueTypes: SomIssueTypeOption[];
  onStart: (issueType: SomIssueType) => void;
}) => {
  const issuesById = new Map(issueTypes.map((issue) => [issue.id, issue]));
  const steps = SOM_REVIEW_PATH.map((step) => {
    const issues = step.issueTypes.flatMap((id) => {
      const issue = issuesById.get(id);
      return issue ? [issue] : [];
    });
    return {
      ...step,
      issues,
      status: statusForStep(issues, step.contextual, step.optional),
    };
  });
  const nextIssue = steps
    .filter((step) => !step.contextual && !step.optional)
    .flatMap((step) => step.issues)
    .find(
      (issue) =>
        issue.enabled &&
        issue.pending > 0 &&
        (issue.blockedBy || []).length === 0,
    );

  return (
    <Box
      component="section"
      aria-labelledby="review-path-heading"
      sx={{
        borderTop: 1,
        borderBottom: 1,
        borderColor: "divider",
        py: 2.25,
        mb: 3.5,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            id="review-path-heading"
            component="h2"
            sx={{ fontSize: "1.15rem", fontWeight: 800 }}
          >
            Guided review path
          </Typography>
          <Typography
            sx={{ mt: 0.35, color: "text.secondary", lineHeight: 1.5 }}
          >
            Complete each required phase before starting proposals that depend
            on it.
          </Typography>
        </Box>
        {nextIssue && (
          <Button
            disableElevation
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => onStart(nextIssue.id)}
            sx={{ minHeight: 46, flex: "0 0 auto", fontWeight: 750 }}
          >
            {nextIssue.activeSession ? "Continue" : "Start"} {nextIssue.label}
          </Button>
        )}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(5, minmax(0, 1fr))",
          },
          gap: 0,
        }}
      >
        {steps.map((step, index) => (
          <Box
            key={step.id}
            sx={{
              minWidth: 0,
              py: { xs: 1.25, md: 0.5 },
              px: { xs: 0, md: 1.5 },
              borderTop: {
                xs: index === 0 ? 0 : 1,
                md: index < 2 ? 0 : 1,
                xl: 0,
              },
              borderLeft: {
                xs: 0,
                md: index % 2 === 0 ? 0 : 1,
                xl: index === 0 ? 0 : 1,
              },
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
            >
              <Typography sx={{ fontWeight: 800, lineHeight: 1.35 }}>
                {step.number}. {step.title}
              </Typography>
              <StatusChip status={step.status} />
            </Stack>
            <Typography
              sx={{
                mt: 0.55,
                color: "text.secondary",
                fontSize: "0.88rem",
                lineHeight: 1.45,
              }}
            >
              {step.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ReviewPath;
