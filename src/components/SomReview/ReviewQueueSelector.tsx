import React from "react";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";

import { SomIssueType, SomIssueTypeOption } from "../../types/ISomReview";

const ISSUE_DESCRIPTIONS: Record<SomIssueType, string> = {
  "title-clarity": "Judge whether an activity title is clear and precise.",
  "sibling-grouping":
    "Judge whether related activities belong under a proposed group.",
  "duplicate-synonym":
    "Judge whether two titles describe the same activity.",
  placement: "Judge whether an activity is under the wrong parent.",
  "structural-overlap":
    "Flag concepts that may be repeated across nearby collections.",
};

const IssueIcon = ({ issueType }: { issueType: SomIssueType }) => {
  const sx = { fontSize: 28 };
  switch (issueType) {
    case "title-clarity":
      return <DriveFileRenameOutlineIcon sx={sx} />;
    case "sibling-grouping":
      return <AccountTreeOutlinedIcon sx={sx} />;
    case "duplicate-synonym":
      return <ContentCopyOutlinedIcon sx={sx} />;
    case "placement":
      return <ErrorOutlineIcon sx={sx} />;
    case "structural-overlap":
      return <HubOutlinedIcon sx={sx} />;
  }
};

const QueueStatus = ({ issue }: { issue: SomIssueTypeOption }) => {
  if (!issue.enabled) {
    return <Chip label="Unavailable" size="small" variant="outlined" />;
  }
  if (issue.total === 0) {
    return <Chip label="No items" size="small" variant="outlined" />;
  }
  if (issue.pending === 0) {
    return (
      <Chip
        icon={<CheckCircleOutlineIcon />}
        label="Done"
        size="small"
        variant="outlined"
      />
    );
  }
  if (issue.activeSession) {
    return (
      <Chip
        label={`Resume ${issue.activeSession.cursor + 1} of ${issue.activeSession.total}`}
        size="small"
        color="primary"
      />
    );
  }
  return (
    <Chip label={`${issue.pending} to review`} size="small" color="primary" />
  );
};

const ReviewQueueSelector = ({
  issueTypes,
  onStart,
}: {
  issueTypes: SomIssueTypeOption[];
  onStart: (issueType: SomIssueType) => void;
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
      <Chip label="Sell ontology" variant="outlined" />
    </Stack>
    <Typography sx={{ mb: 3.5, color: "text.secondary", lineHeight: 1.55 }}>
      Reviews are recorded separately from ontology changes. Choose one type of
      issue to review.
    </Typography>

    <Stack spacing={1.5}>
      {issueTypes.map((issue) => {
        const available = issue.enabled && issue.pending > 0;
        return (
          <Card
            key={issue.id}
            variant="outlined"
            sx={{
              borderRadius: 2,
              opacity: available ? 1 : 0.72,
              overflow: "hidden",
            }}
          >
            <CardActionArea
              disabled={!available}
              onClick={() => onStart(issue.id)}
              aria-label={
                available
                  ? `${issue.activeSession ? "Resume" : "Start"} ${issue.label} review, ${issue.pending} remaining`
                  : `${issue.label}, no review items available`
              }
              sx={{ p: { xs: 2, sm: 2.5 }, minHeight: 104 }}
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
                    color: available ? "primary.main" : "text.disabled",
                    backgroundColor: "action.hover",
                  }}
                >
                  <IssueIcon issueType={issue.id} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "1.05rem",
                      fontWeight: 750,
                      lineHeight: 1.35,
                    }}
                  >
                    {issue.label}
                  </Typography>
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
                </Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    gridColumn: { xs: "2", sm: "3" },
                    justifySelf: { xs: "start", sm: "end" },
                  }}
                >
                  <QueueStatus issue={issue} />
                  {available && (
                    <ArrowForwardIcon
                      aria-hidden="true"
                      sx={{ color: "text.secondary" }}
                    />
                  )}
                </Stack>
              </Box>
            </CardActionArea>
          </Card>
        );
      })}
      {issueTypes.length === 0 && (
        <Alert severity="info">No review queues are available right now.</Alert>
      )}
    </Stack>
  </Box>
);

export default ReviewQueueSelector;
