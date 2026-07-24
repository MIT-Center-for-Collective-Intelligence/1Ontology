import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { SOM_REVIEW_PATH } from "../../lib/somReview/reviewDependencies";
import { SomIssueType, SomIssueTypeOption } from "../../types/ISomReview";

type StepStatus =
  | "complete"
  | "current"
  | "later"
  | "available"
  | "contextual"
  | "optional";

const statusForStep = (
  issues: SomIssueTypeOption[],
  contextual?: boolean,
  optional?: boolean,
): StepStatus => {
  const relevant = issues.filter((issue) => issue.enabled && issue.total > 0);
  if (relevant.some((issue) => !issue.released)) return "later";
  if (optional) return "optional";
  if (
    relevant.length === 0 ||
    relevant.every((issue) => issue.pending === 0 && issue.waiting === 0)
  ) {
    return "complete";
  }
  if (contextual) {
    return relevant.some((issue) => issue.pending > 0)
      ? "available"
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

const statusLabel = (status: StepStatus): string => {
  switch (status) {
    case "complete":
      return "Done";
    case "current":
      return "Current phase";
    case "later":
      return "Later";
    case "available":
      return "Available now";
    case "contextual":
      return "Unlocks as needed";
    case "optional":
      return "Optional";
  }
};

const PhaseMarker = ({
  number,
  status,
}: {
  number: number;
  status: StepStatus;
}) => (
  <Box
    aria-hidden="true"
    sx={{
      width: 36,
      height: 36,
      flex: "0 0 36px",
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      border: 2,
      borderColor:
        status === "current" || status === "available"
          ? "primary.main"
          : status === "complete"
            ? "success.main"
            : "divider",
      backgroundColor:
        status === "current"
          ? "primary.main"
          : status === "complete"
            ? "success.main"
            : "background.paper",
      color:
        status === "current" || status === "complete"
          ? "primary.contrastText"
          : status === "available"
            ? "primary.main"
            : "text.secondary",
      fontSize: "0.9rem",
      fontWeight: 800,
    }}
  >
    {status === "complete" ? <CheckIcon sx={{ fontSize: 21 }} /> : number}
  </Box>
);

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
    .flatMap((step) => step.issues)
    .find(
      (issue) =>
        issue.enabled &&
        issue.released &&
        issue.pending > 0 &&
        (issue.blockedBy || []).length === 0,
    );
  const nextStep = nextIssue
    ? steps.find((step) => step.issueTypes.includes(nextIssue.id))
    : undefined;

  return (
    <Box
      component="section"
      aria-labelledby="review-path-heading"
      sx={{
        borderTop: 1,
        borderBottom: 1,
        borderColor: "divider",
        py: 2,
        mb: 3.5,
      }}
    >
      <Typography
        id="review-path-heading"
        component="h2"
        sx={{ fontSize: "1.15rem", fontWeight: 800 }}
      >
        Guided review path
      </Typography>
      <Typography sx={{ mt: 0.3, color: "text.secondary", lineHeight: 1.45 }}>
        Complete this phase first. Its approved changes must then be applied and
        the remaining proposals regenerated before later phases open.
      </Typography>
      <Box
        component="ol"
        aria-label="Review phases"
        sx={{
          listStyle: "none",
          p: 0,
          mt: 2,
          mb: 0,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(5, minmax(0, 1fr))",
          },
          gap: { xs: 1, md: 1.5 },
        }}
      >
        {steps.map((step) => (
          <Box
            component="li"
            key={step.id}
            aria-current={step.status === "current" ? "step" : undefined}
            sx={{
              minWidth: 0,
              py: 0.75,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <PhaseMarker number={step.number} status={step.status} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: step.status === "current" ? 800 : 700,
                    lineHeight: 1.25,
                    color:
                      step.status === "later"
                        ? "text.secondary"
                        : "text.primary",
                  }}
                >
                  {step.title}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.35}>
                  {step.status === "later" && (
                    <LockOutlinedIcon
                      aria-hidden="true"
                      sx={{ color: "text.secondary", fontSize: 14 }}
                    />
                  )}
                  <Typography
                    sx={{
                      mt: 0.15,
                      color:
                        step.status === "current" || step.status === "available"
                          ? "primary.main"
                          : "text.secondary",
                      fontSize: "0.78rem",
                      fontWeight: 650,
                      lineHeight: 1.25,
                    }}
                  >
                    {statusLabel(step.status)}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Box>
        ))}
      </Box>
      {nextIssue && nextStep && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{
            mt: 1.5,
            py: 1.5,
            px: { xs: 1.5, sm: 2 },
            borderLeft: 4,
            borderColor: "primary.main",
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.35 }}>
              Next: {nextStep.title}
            </Typography>
            <Typography
              sx={{ mt: 0.25, color: "text.secondary", lineHeight: 1.45 }}
            >
              {nextStep.description}
            </Typography>
          </Box>
          <Button
            disableElevation
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => onStart(nextIssue.id)}
            sx={{ minHeight: 46, flex: "0 0 auto", fontWeight: 750 }}
          >
            {nextIssue.activeSession ? "Continue" : "Start"} {nextIssue.label}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default ReviewPath;
