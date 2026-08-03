import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

const CalibrationReviewIntro = ({
  itemCount,
  onContinue,
}: {
  itemCount: number;
  onContinue: () => void;
}) => (
  <Stack
    justifyContent="center"
    spacing={2.25}
    sx={{ minHeight: "70dvh", maxWidth: 760, mx: "auto", py: 5 }}
  >
    <Typography
      component="h1"
      sx={{
        fontSize: { xs: "1.65rem", sm: "2rem" },
        fontWeight: 850,
      }}
    >
      Work activity repository review
    </Typography>

    <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
      MIT is developing a repository of work activities, arranged from more
      general to more specific. For example, &ldquo;Sell&rdquo; is a quite
      general activity, whereas &ldquo;Sell physical objects&rdquo; is more
      specific, and &ldquo;Sell food&rdquo; is more specific still.
    </Typography>

    <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
      By arranging work activities in this way, we hope to be able to draw
      inferences about important issues like the impact of new technologies or
      how workers in one occupation may be able to transfer their skills to
      another.
    </Typography>

    <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
      In the screens that follow, we&apos;ll seek your help in reviewing
      improvements to our repository that have been suggested by an AI tool.
    </Typography>

    <Box>
      <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
        Each screen will show you:
      </Typography>
      <Box
        component="ul"
        sx={{
          mt: 1,
          mb: 0,
          pl: 3.5,
          "& li": { mb: 0.75, pl: 0.5 },
        }}
      >
        <Typography
          component="li"
          sx={{ fontSize: "1.05rem", lineHeight: 1.6 }}
        >
          an example of the present state of the repository,
        </Typography>
        <Typography
          component="li"
          sx={{ fontSize: "1.05rem", lineHeight: 1.6 }}
        >
          an improvement proposed by the AI tool, and
        </Typography>
        <Typography
          component="li"
          sx={{ fontSize: "1.05rem", lineHeight: 1.6 }}
        >
          the source or sources from the US Department of Labor&apos;s O*NET
          database that serve as the basis for the work task under
          consideration.
        </Typography>
      </Box>
    </Box>

    <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
      We will ask whether you agree or disagree that the change proposed by the
      AI tool is an improvement. If you disagree, we&apos;ll ask you to explain
      why and suggest an alternative improvement.
    </Typography>

    <Typography sx={{ color: "text.secondary", lineHeight: 1.65 }}>
      We are asking you to review {itemCount}{" "}
      {itemCount === 1 ? "item" : "items"}, and each should take much less than
      a minute to complete. Thanks very much for your help!
    </Typography>

    <Button
      disableElevation
      variant="contained"
      endIcon={<ArrowForwardIcon />}
      onClick={onContinue}
      sx={{
        alignSelf: { xs: "stretch", sm: "flex-start" },
        minHeight: 50,
        px: 3,
        fontWeight: 800,
      }}
    >
      Begin review
    </Button>
  </Stack>
);

export default CalibrationReviewIntro;
