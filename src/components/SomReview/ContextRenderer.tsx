import React from "react";
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import { diffWords } from "diff";

import { SomReviewContext } from "../../types/ISomReview";

const ContextRenderer = ({ context }: { context: SomReviewContext }) => {
  switch (context.type) {
    case "title-comparison":
      return <TitleComparison context={context} />;
    case "grouping-outline":
      return <GroupingOutline context={context} />;
    case "flat-list":
      return <FlatList context={context} />;
    case "duplicate-comparison":
      return <DuplicateComparison context={context} />;
    case "placement-comparison":
      return <PlacementComparison context={context} />;
    case "overlap-comparison":
      return <OverlapComparison context={context} />;
    default:
      return null;
  }
};

const highlightSx = {
  backgroundColor: (theme: any) =>
    theme.palette.mode === "dark"
      ? "rgba(255, 213, 79, 0.18)"
      : "rgba(255, 213, 79, 0.45)",
  borderRadius: "4px",
  px: 0.5,
};

/* ------------------------------ title clarity ----------------------------- */

/** Renders a title with the words that differ from the other title emphasized. */
export const DiffedTitle = ({
  title,
  other,
  changedColor,
}: {
  title: string;
  other: string;
  changedColor: "error.main" | "success.main";
}) => (
  <Typography sx={{ fontWeight: 500 }}>
    {diffWords(other, title)
      .filter((part) => !part.removed)
      .map((part, index) =>
        part.added ? (
          <Box
            key={index}
            component="span"
            sx={{ color: changedColor, fontWeight: 700 }}
          >
            {part.value}
          </Box>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
  </Typography>
);

const TitleComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "title-comparison" }>;
}) => {
  const tasks = context.linkedTasks || [];
  if (tasks.length === 0) return null;

  return (
    <Box>
      <Typography
        variant="caption"
        component="div"
        sx={{
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "text.secondary",
          mb: 0.25,
        }}
      >
        {tasks.length === 1 ? "O*NET Task:" : "O*NET Tasks:"}
      </Typography>
      <List dense disablePadding>
        {tasks.map((task) => (
          <ListItem key={task} disableGutters sx={{ py: 0.25 }}>
            <ListItemText primary={task} sx={{ my: 0 }} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

const OutlineItem = ({
  title,
  highlighted,
  dimmed,
  indent = 0,
}: {
  title: string;
  highlighted?: boolean;
  dimmed?: boolean;
  indent?: number;
}) => (
  <Stack
    direction="row"
    alignItems="center"
    spacing={0.5}
    sx={{ pl: indent * 3, py: 0.25 }}
  >
    <SubdirectoryArrowRightIcon sx={{ fontSize: 14, color: "text.disabled" }} />
    <Typography
      component="span"
      sx={
        highlighted
          ? highlightSx
          : dimmed
            ? { color: "text.secondary" }
            : undefined
      }
    >
      {title}
    </Typography>
  </Stack>
);

const GroupingOutline = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "grouping-outline" }>;
}) => {
  const unaffected = context.unaffectedChildren || [];
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Chip label="Before" size="small" sx={{ mb: 1 }} />
        <Typography sx={{ fontWeight: 600 }}>{context.parentTitle}</Typography>
        {context.proposedChildren.map((child) => (
          <OutlineItem key={child} title={child} highlighted indent={1} />
        ))}
        {unaffected.map((child) => (
          <OutlineItem key={child} title={child} dimmed indent={1} />
        ))}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Chip label="After" size="small" color="primary" sx={{ mb: 1 }} />
        <Typography sx={{ fontWeight: 600 }}>{context.parentTitle}</Typography>
        <OutlineItem title={context.proposedGroupTitle} indent={1} />
        {context.proposedChildren.map((child) => (
          <OutlineItem key={child} title={child} highlighted indent={2} />
        ))}
        {unaffected.map((child) => (
          <OutlineItem key={child} title={child} dimmed indent={1} />
        ))}
      </Box>
    </Stack>
  );
};

const FlatList = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "flat-list" }>;
}) => (
  <Box sx={{ mt: 1 }}>
    <Typography sx={{ fontWeight: 600 }}>{context.parentTitle}</Typography>
    {context.currentChildren.map((child) => (
      <OutlineItem key={child} title={child} indent={1} />
    ))}
  </Box>
);

/* ----------------- experimental issue types (feature-flagged) -------------- */

const LabeledValue = ({ label, value }: { label: string; value: string }) => (
  <Box sx={{ mb: 1 }}>
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", textTransform: "uppercase" }}
    >
      {label}
    </Typography>
    <Typography>{value}</Typography>
  </Box>
);

const DuplicateComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "duplicate-comparison" }>;
}) => (
  <Box sx={{ mt: 1 }}>
    <LabeledValue label="Parent" value={context.parentTitle} />
    <LabeledValue label="First title" value={context.canonicalTitle} />
    <LabeledValue label="Second title" value={context.candidateSynonymTitle} />
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      This question is only about whether the two titles name the same activity.
      Merging is a separate, later decision.
    </Typography>
  </Box>
);

const PlacementComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "placement-comparison" }>;
}) => (
  <Box sx={{ mt: 1 }}>
    <LabeledValue label="Activity" value={context.nodeTitle} />
    <LabeledValue label="Current parent" value={context.currentParentTitle} />
    {context.currentBucket ? (
      <LabeledValue label="Current bucket" value={context.currentBucket} />
    ) : null}
    {context.candidateHome ? (
      <LabeledValue
        label="Possible alternative home"
        value={context.candidateHome}
      />
    ) : null}
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      Agreeing only marks the current placement as wrong. Choosing the final
      destination and moving the activity are separate, later steps.
    </Typography>
  </Box>
);

const OverlapComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "overlap-comparison" }>;
}) => (
  <Box sx={{ mt: 1 }}>
    <LabeledValue label="Parent" value={context.parentTitle} />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Box sx={{ flex: 1 }}>
        <LabeledValue
          label={`In "${context.firstCollection}"`}
          value={context.firstTitle}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        <LabeledValue
          label={`In "${context.secondCollection}"`}
          value={context.secondTitle}
        />
      </Box>
    </Stack>
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      Agreeing only marks a possible overlap. It does not approve merging
      anything.
    </Typography>
  </Box>
);

export default ContextRenderer;
