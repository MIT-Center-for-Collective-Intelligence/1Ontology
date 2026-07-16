import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { SomIssueType } from "../../types/ISomReview";
import { ISSUE_INTRODUCTIONS } from "./reviewCopy";

const ReviewTaskIntro = ({
  issueType,
  label,
  itemCount,
  resuming,
  onContinue,
  onBack,
  headerAction,
}: {
  issueType: SomIssueType;
  label: string;
  itemCount: number;
  resuming: boolean;
  onContinue: () => void;
  onBack: () => void;
  headerAction?: React.ReactNode;
}) => (
  <Box>
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
    >
      <Button
        disableElevation
        variant="outlined"
        color="inherit"
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{ minHeight: 48, fontWeight: 700 }}
      >
        All review types
      </Button>
      {headerAction}
    </Stack>

    <Box sx={{ maxWidth: 720, pt: { xs: 6, sm: 9 }, pb: 8 }}>
      <Typography
        component="p"
        sx={{ color: "text.secondary", fontWeight: 750 }}
      >
        Before you begin
      </Typography>
      <Typography
        component="h1"
        sx={{ mt: 1, fontSize: { xs: "1.65rem", sm: "2rem" }, fontWeight: 800 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 2,
          fontSize: { xs: "1.05rem", sm: "1.15rem" },
          lineHeight: 1.7,
        }}
      >
        {ISSUE_INTRODUCTIONS[issueType]}
      </Typography>
      <Typography sx={{ mt: 2, color: "text.secondary", lineHeight: 1.55 }}>
        {itemCount} {itemCount === 1 ? "review item is" : "review items are"}{" "}
        ready. You will see one item at a time.
      </Typography>
      <Button
        variant="contained"
        disableElevation
        size="large"
        endIcon={<ArrowForwardIcon />}
        onClick={onContinue}
        sx={{ mt: 4, minHeight: 54, minWidth: 190, fontWeight: 750 }}
      >
        {resuming ? "Resume review" : "Begin review"}
      </Button>
    </Box>
  </Box>
);

export default ReviewTaskIntro;
