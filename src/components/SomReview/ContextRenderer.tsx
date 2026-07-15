import React, { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import { diffWords } from "diff";

import { SomReviewContext } from "../../types/ISomReview";

const sectionLabelSx = {
  color: "text.secondary",
  fontSize: "0.875rem",
  fontWeight: 700,
};

const comparisonPanelSx = {
  flex: 1,
  minWidth: 0,
  p: 2,
  border: (theme: any) => `1px solid ${theme.palette.divider}`,
  borderRadius: 1.5,
  backgroundColor: "background.paper",
};

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
  }
};

/** Renders a title with changed words emphasized without relying on color. */
export const DiffedTitle = ({
  title,
  other,
  changedColor,
}: {
  title: string;
  other: string;
  changedColor: "error.main" | "success.main";
}) => (
  <Typography aria-label={title} sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
    <span aria-hidden="true">
      {diffWords(other, title)
        .filter((part) => !part.removed)
        .map((part, index) =>
          part.added ? (
            <Box
              key={`${part.value}-${index}`}
              component="mark"
              sx={{
                color: changedColor,
                backgroundColor: "action.selected",
                borderRadius: 0.5,
                fontWeight: 800,
                px: 0.25,
              }}
            >
              {part.value}
            </Box>
          ) : (
            <span key={`${part.value}-${index}`}>{part.value}</span>
          ),
        )}
    </span>
  </Typography>
);

const Disclosure = ({
  closedLabel,
  openLabel,
  children,
}: {
  closedLabel: string;
  openLabel: string;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Button
        variant="text"
        color="inherit"
        onClick={() => setOpen((value) => !value)}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        aria-expanded={open}
        sx={{
          minHeight: 44,
          px: 0.5,
          color: "text.secondary",
          fontWeight: 650,
        }}
      >
        {open ? openLabel : closedLabel}
      </Button>
      <Collapse in={open} unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
};

const TitleComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "title-comparison" }>;
}) => {
  const tasks = context.linkedTasks || [];
  if (tasks.length === 0) return null;

  return (
    <Disclosure
      closedLabel={`Show source ${tasks.length === 1 ? "task" : `tasks (${tasks.length})`}`}
      openLabel="Hide source tasks"
    >
      <List dense disablePadding sx={{ pl: 1, pb: 1 }}>
        {tasks.map((task) => (
          <ListItem key={task} disableGutters alignItems="flex-start">
            <ListItemText
              primary={task}
              primaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>
        ))}
      </List>
    </Disclosure>
  );
};

const OutlineItem = ({
  title,
  highlighted,
  indent = 0,
}: {
  title: string;
  highlighted?: boolean;
  indent?: number;
}) => (
  <Stack
    direction="row"
    alignItems="flex-start"
    spacing={0.75}
    sx={{
      ml: indent * 2.25,
      my: 0.5,
      p: highlighted ? 0.75 : 0,
      borderRadius: 1,
      backgroundColor: highlighted ? "warning.light" : "transparent",
      color: highlighted ? "warning.contrastText" : "text.primary",
    }}
  >
    <SubdirectoryArrowRightIcon
      aria-hidden="true"
      sx={{ mt: 0.35, flex: "0 0 auto", fontSize: 18, color: "text.secondary" }}
    />
    <Typography sx={{ fontWeight: highlighted ? 700 : 500, lineHeight: 1.45 }}>
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
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={comparisonPanelSx} aria-label="Current grouping">
          <Typography sx={sectionLabelSx}>Before</Typography>
          <Typography sx={{ mt: 1, fontWeight: 750 }}>
            {context.parentTitle}
          </Typography>
          {context.proposedChildren.map((child) => (
            <OutlineItem key={child} title={child} highlighted indent={1} />
          ))}
        </Box>
        <Box sx={comparisonPanelSx} aria-label="Proposed grouping">
          <Typography sx={sectionLabelSx}>After</Typography>
          <Typography sx={{ mt: 1, fontWeight: 750 }}>
            {context.parentTitle}
          </Typography>
          <OutlineItem title={context.proposedGroupTitle} indent={1} />
          {context.proposedChildren.map((child) => (
            <OutlineItem key={child} title={child} highlighted indent={2} />
          ))}
        </Box>
      </Stack>

      {unaffected.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Disclosure
            closedLabel={`${unaffected.length} other direct ${unaffected.length === 1 ? "child remains" : "children remain"} unchanged`}
            openLabel="Hide unchanged children"
          >
            <List dense disablePadding sx={{ pl: 1, pb: 1 }}>
              {unaffected.map((title) => (
                <ListItem key={title} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={title}
                    primaryTypographyProps={{ color: "text.secondary" }}
                  />
                </ListItem>
              ))}
            </List>
          </Disclosure>
        </Box>
      )}
    </Box>
  );
};

const FlatList = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "flat-list" }>;
}) => (
  <Box sx={comparisonPanelSx}>
    <Typography sx={sectionLabelSx}>Current direct children</Typography>
    <Typography sx={{ mt: 1, fontWeight: 750 }}>{context.parentTitle}</Typography>
    {context.currentChildren.map((child) => (
      <OutlineItem key={child} title={child} indent={1} />
    ))}
  </Box>
);

const LabeledValue = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography sx={sectionLabelSx}>{label}</Typography>
    <Typography sx={{ mt: 0.5, fontSize: "1.05rem", fontWeight: 650 }}>
      {value}
    </Typography>
  </Box>
);

const BoundaryNote = ({ children }: { children: React.ReactNode }) => (
  <Typography
    sx={{
      mt: 2,
      pt: 1.5,
      borderTop: (theme) => `1px solid ${theme.palette.divider}`,
      color: "text.secondary",
      fontSize: "0.95rem",
      lineHeight: 1.5,
    }}
  >
    {children}
  </Typography>
);

const DuplicateComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "duplicate-comparison" }>;
}) => (
  <Box>
    <Typography sx={{ mb: 1.5, color: "text.secondary" }}>
      Both titles are under <strong>{context.parentTitle}</strong>.
    </Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Box sx={comparisonPanelSx}>
        <LabeledValue label="First title" value={context.canonicalTitle} />
      </Box>
      <Box sx={comparisonPanelSx}>
        <LabeledValue
          label="Second title"
          value={context.candidateSynonymTitle}
        />
      </Box>
    </Stack>
    <BoundaryNote>
      This decision only records whether the titles name the same activity. It
      does not merge or delete anything.
    </BoundaryNote>
  </Box>
);

const PlacementComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "placement-comparison" }>;
}) => (
  <Box>
    <Box sx={comparisonPanelSx}>
      <LabeledValue label="Activity" value={context.nodeTitle} />
      <Divider sx={{ my: 1.5 }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <LabeledValue label="Current parent" value={context.currentParentTitle} />
        </Box>
        {context.currentBucket && (
          <Box sx={{ flex: 1 }}>
            <LabeledValue label="Current collection" value={context.currentBucket} />
          </Box>
        )}
      </Stack>
      {context.candidateHome && (
        <Box sx={{ mt: 2 }}>
          <LabeledValue
            label="Possible home (not part of this decision)"
            value={context.candidateHome}
          />
        </Box>
      )}
    </Box>
    <BoundaryNote>
      Agreeing only marks the current placement for follow-up. It does not move
      the activity or choose its final destination.
    </BoundaryNote>
  </Box>
);

const OverlapComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "overlap-comparison" }>;
}) => (
  <Box>
    <Typography sx={{ mb: 1.5, color: "text.secondary" }}>
      Both collections are under <strong>{context.parentTitle}</strong>.
    </Typography>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Box sx={comparisonPanelSx}>
        <LabeledValue label={context.firstCollection} value={context.firstTitle} />
      </Box>
      <Box sx={comparisonPanelSx}>
        <LabeledValue label={context.secondCollection} value={context.secondTitle} />
      </Box>
    </Stack>
    <BoundaryNote>
      Agreeing only marks a possible overlap for follow-up. It does not merge
      either activity.
    </BoundaryNote>
  </Box>
);

export default ContextRenderer;
