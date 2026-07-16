import React from "react";
import { Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { SomLinkedFollowUp } from "../../types/ISomReview";
import { reviewIconColor } from "./reviewStyles";

const ReviewFollowUpPanel = ({
  followUps,
  onReview,
  variant = "overview",
  sourceLabel,
  onContinue,
  continueLabel,
}: {
  followUps: SomLinkedFollowUp[];
  onReview: (followUp: SomLinkedFollowUp) => void;
  variant?: "overview" | "handoff";
  sourceLabel?: string;
  onContinue?: () => void;
  continueLabel?: string;
}) => {
  if (followUps.length === 0) return null;
  const isHandoff = variant === "handoff";

  return (
    <Box
      component="section"
      aria-labelledby={`${variant}-follow-up-heading`}
      sx={{
        py: isHandoff ? { xs: 2, sm: 3 } : 0,
        mb: isHandoff ? 0 : 4,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
            width: 44,
            height: 44,
            borderRadius: 1.5,
            color: reviewIconColor,
            backgroundColor: "action.hover",
          }}
        >
          <AltRouteOutlinedIcon aria-hidden="true" />
        </Box>
        <Box>
          <Typography
            id={`${variant}-follow-up-heading`}
            component={isHandoff ? "h1" : "h2"}
            sx={{
              fontSize: isHandoff ? "1.5rem" : "1.2rem",
              fontWeight: 800,
              lineHeight: 1.3,
            }}
          >
            {isHandoff
              ? "Continue with the related decision"
              : "Ready related decisions"}
          </Typography>
          <Typography
            sx={{ mt: 0.5, color: "text.secondary", lineHeight: 1.5 }}
          >
            {isHandoff
              ? "Your answer unlocked a separate follow-up. Review it now while this activity is fresh in mind."
              : "These actions became available after earlier diagnoses. Open the exact follow-up directly instead of searching its queue."}
          </Typography>
          {sourceLabel && (
            <Typography sx={{ mt: 0.75, fontWeight: 700 }}>
              Earlier review: {sourceLabel}
            </Typography>
          )}
        </Box>
      </Stack>

      <Stack spacing={1.5} sx={{ mt: 2.5 }}>
        {followUps.map((followUp) => (
          <Box
            key={followUp.proposalId}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              p: { xs: 1.75, sm: 2 },
              backgroundColor: "background.paper",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              gap={1.5}
            >
              <Box sx={{ minWidth: 0 }}>
                <Chip
                  label={followUp.issueLabel}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 1, maxWidth: "100%", fontWeight: 700 }}
                />
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 750 }}>
                  {followUp.question}
                </Typography>
                {!isHandoff && followUp.sources.length > 0 && (
                  <Typography
                    sx={{
                      mt: 0.65,
                      color: "text.secondary",
                      fontSize: "0.9rem",
                    }}
                  >
                    Follows{" "}
                    {followUp.sources
                      .map((source) => source.issueLabel)
                      .join(", ")}
                  </Typography>
                )}
              </Box>
              <Button
                disableElevation
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => onReview(followUp)}
                aria-label={`Review this next: ${followUp.question}`}
                sx={{
                  flex: "0 0 auto",
                  minHeight: 48,
                  fontWeight: 750,
                  whiteSpace: "nowrap",
                }}
              >
                Review this next
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>

      {isHandoff && onContinue && continueLabel && (
        <>
          <Divider sx={{ my: 2.5 }} />
          <Button
            disableElevation
            variant="outlined"
            onClick={onContinue}
            sx={{ minHeight: 48, fontWeight: 700 }}
          >
            {continueLabel}
          </Button>
        </>
      )}
    </Box>
  );
};

export default ReviewFollowUpPanel;
