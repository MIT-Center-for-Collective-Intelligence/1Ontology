import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import { alpha } from "@mui/material/styles";

import { SomReviewContext } from "../../types/ISomReview";
import { reviewAccentColor } from "./reviewStyles";

const CONTEXTS_WITH_STATE_COMPARISONS = new Set<SomReviewContext["type"]>([
  "title-split",
  "duplicate-comparison",
  "grouping-outline",
  "merge-action",
  "relocation-action",
  "addition-action",
  "merge-up-action",
  "metadata-edit",
  "polysemy-review",
  "collection-design",
  "sense-relocation-action",
]);

export const contextShowsStateComparison = (
  context: SomReviewContext,
): boolean => CONTEXTS_WITH_STATE_COMPARISONS.has(context.type);

const uniqueTextValues = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

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
    case "title-split":
      return <TitleSplit context={context} />;
    case "grouping-outline":
      return <GroupingOutline context={context} />;
    case "flat-list":
      return <FlatList context={context} />;
    case "duplicate-comparison":
      return <DuplicateComparison context={context} />;
    case "placement-comparison":
      return <PlacementNote context={context} />;
    case "overlap-comparison":
      return <OverlapComparison context={context} />;
    case "merge-action":
      return <MergeAction context={context} />;
    case "relocation-action":
      return <RelocationAction context={context} />;
    case "addition-action":
      return <AdditionAction context={context} />;
    case "merge-up-action":
      return <MergeUpAction context={context} />;
    case "metadata-edit":
      return <MetadataEdit context={context} />;
    case "polysemy-review":
      return <PolysemyReview context={context} />;
    case "collection-design":
      return <CollectionDesign context={context} />;
    case "sense-relocation-action":
      return <SenseRelocationAction context={context} />;
  }
};

/** Renders a title with changed words emphasized without relying on color. */
export const DiffedTitle = ({
  title,
  other,
}: {
  title: string;
  other: string;
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
                color: "text.primary",
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
  initiallyOpen = false,
  children,
}: {
  closedLabel: string;
  openLabel: string;
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Box>
      <Button
        disableElevation
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
  const tasks = uniqueTextValues(context.linkedTasks || []);
  if (tasks.length === 0) return null;

  return (
    <Disclosure
      closedLabel={`Show source O*NET evidence${tasks.length > 1 ? ` (${tasks.length})` : ""}`}
      openLabel="Hide source O*NET evidence"
      initiallyOpen
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

const TitleSplit = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "title-split" }>;
}) => {
  const tasks = uniqueTextValues(context.linkedTasks || []);
  const statusLabel = {
    current: "Keep current node",
    existing: "Already in ontology",
    new: "New node",
  } as const;

  return (
    <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ mb: 3 }}>
      <Box sx={comparisonPanelSx}>
        <Typography sx={sectionLabelSx}>Before</Typography>
        <Typography sx={{ mt: 0.75, fontSize: "1.05rem", fontWeight: 750 }}>
          {context.currentTitle}
        </Typography>
        <Typography sx={{ ...sectionLabelSx, mt: 2 }}>
          Source O*NET evidence
        </Typography>
        <List component="ol" dense disablePadding sx={{ pl: 3, mt: 0.5 }}>
          {tasks.map((task, index) => (
            <ListItem
              component="li"
              key={`${index + 1}-${task}`}
              disableGutters
              alignItems="flex-start"
              sx={{ display: "list-item", pl: 0.5 }}
            >
              <ListItemText
                primary={task}
                primaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <Box sx={comparisonPanelSx}>
        <Typography sx={sectionLabelSx}>After</Typography>
        <Stack divider={<Divider flexItem />} sx={{ mt: 0.5 }}>
          {context.proposedNodes.map((node) => (
            <Box key={`${node.status}-${node.title}`} sx={{ py: 1.25 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 750 }}>
                  {node.title}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={statusLabel[node.status]}
                  sx={{ fontWeight: 650 }}
                />
              </Stack>
              <Typography sx={{ mt: 0.75, lineHeight: 1.5 }}>
                {node.reason}
              </Typography>
              <Typography
                sx={{ mt: 0.75, color: "text.secondary", fontWeight: 650 }}
              >
                Uses source{" "}
                {node.sourceTaskIndexes.length === 1 ? "item" : "items"}{" "}
                {node.sourceTaskIndexes.join(", ")}
              </Typography>
            </Box>
          ))}
        </Stack>
        {context.deferredTaskIndexes.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography sx={sectionLabelSx}>
              Needs separate placement review
            </Typography>
            <Typography sx={{ mt: 0.5 }}>
              Source{" "}
              {context.deferredTaskIndexes.length === 1 ? "item" : "items"}{" "}
              {context.deferredTaskIndexes.join(", ")}
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
};

const OutlineItem = ({
  title,
  highlighted,
  indent = 0,
  statusLabel,
}: {
  title: string;
  highlighted?: boolean;
  indent?: number;
  statusLabel?: string;
}) => (
  <Stack
    data-outline-item={title}
    data-highlighted={highlighted ? "true" : "false"}
    direction="row"
    alignItems="flex-start"
    spacing={0.75}
    sx={{
      ml: indent * 2.25,
      my: 0.5,
      p: highlighted ? 0.75 : 0,
      borderRadius: 1,
      border: (theme) =>
        highlighted
          ? `1px solid ${reviewAccentColor(theme)}`
          : "1px solid transparent",
      backgroundColor: (theme) =>
        highlighted
          ? alpha(
              theme.palette.primary.main,
              theme.palette.mode === "dark" ? 0.2 : 0.1,
            )
          : "transparent",
      color: "text.primary",
    }}
  >
    <SubdirectoryArrowRightIcon
      aria-hidden="true"
      sx={{ mt: 0.35, flex: "0 0 auto", fontSize: 18, color: "text.secondary" }}
    />
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{ fontWeight: highlighted ? 700 : 500, lineHeight: 1.45 }}
      >
        {title}
      </Typography>
      {statusLabel && (
        <Typography
          sx={{
            mt: 0.25,
            color: "text.secondary",
            fontSize: "0.8rem",
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          {statusLabel}
        </Typography>
      )}
    </Box>
  </Stack>
);

const GroupingOutline = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "grouping-outline" }>;
}) => {
  const sortTitles = (titles: string[]) =>
    [...titles].sort((left, right) => left.localeCompare(right, "en"));
  const proposedChildren = sortTitles(context.proposedChildren);
  const unaffected = sortTitles(context.unaffectedChildren || []);
  const proposedTitles = new Set(context.proposedChildren);
  const currentChildren = sortTitles([
    ...new Set([...context.proposedChildren, ...unaffected]),
  ]);
  const remainingChildren = unaffected.length > 0 && (
    <Box sx={{ mt: 1.5 }}>
      <Divider sx={{ mb: 1.25 }} />
      <Typography sx={sectionLabelSx}>
        Children not included in the new grouping
      </Typography>
      {unaffected.map((title) => (
        <OutlineItem key={title} title={title} indent={1} />
      ))}
    </Box>
  );

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={comparisonPanelSx} aria-label="Current grouping">
          <Typography sx={sectionLabelSx}>Before</Typography>
          <Typography sx={{ mt: 1, fontWeight: 750 }}>
            {context.parentTitle}
          </Typography>
          {currentChildren.map((child) => (
            <OutlineItem
              key={child}
              title={child}
              highlighted={proposedTitles.has(child)}
              indent={1}
            />
          ))}
        </Box>
        <Box sx={comparisonPanelSx} aria-label="Proposed grouping">
          <Typography sx={sectionLabelSx}>After</Typography>
          <Typography sx={{ mt: 1, fontWeight: 750 }}>
            {context.parentTitle}
          </Typography>
          <OutlineItem
            title={context.proposedGroupTitle}
            highlighted
            indent={1}
            statusLabel="Proposed new group (not currently in the ontology)"
          />
          {proposedChildren.map((child) => (
            <OutlineItem key={child} title={child} highlighted indent={2} />
          ))}
          {remainingChildren}
        </Box>
      </Stack>
      <Box sx={{ mt: 1 }}>
        <SourceTasks tasks={context.sourceTasks || []} />
      </Box>
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
    <Typography sx={{ mt: 1, fontWeight: 750 }}>
      {context.parentTitle}
    </Typography>
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

const CollectionNote = ({ value }: { value: string }) => (
  <Typography sx={{ mt: 0.25, color: "text.secondary", fontSize: "0.85rem" }}>
    Collection: {!value || value === "main" ? "Default" : value}
  </Typography>
);

const ChildOutline = ({
  titles,
  highlighted = false,
  emptyLabel = "No direct children",
  indent = 1,
}: {
  titles: string[];
  highlighted?: boolean;
  emptyLabel?: string;
  indent?: number;
}) =>
  titles.length > 0 ? (
    <Box
      sx={{
        mt: 0.75,
        columns: { xs: 1, sm: titles.length > 8 ? 2 : 1 },
        columnGap: 2,
      }}
    >
      {[...titles]
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((title) => (
          <Box key={title} sx={{ breakInside: "avoid" }}>
            <OutlineItem
              title={title}
              highlighted={highlighted}
              indent={indent}
            />
          </Box>
        ))}
    </Box>
  ) : (
    <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
      {emptyLabel}
    </Typography>
  );

const PlacementNote = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "placement-comparison" }>;
}) => {
  return (
    <Box>
      <SourceTasks tasks={context.sourceTasks || []} />
      <BoundaryNote>
        {context.placementIssue === "wrong-verb"
          ? "If you agree that this is not a selling activity, its appropriate location will be reviewed in a separate step."
          : "If you agree that this activity is misplaced, its appropriate location will be reviewed in a separate step."}
      </BoundaryNote>
    </Box>
  );
};

const MergeAction = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "merge-action" }>;
}) => {
  const movedChildren = new Set(context.absorbedChildren);
  const canonicalParentTitle =
    context.canonicalParentTitle || context.parentTitle;
  const absorbedParentTitle =
    context.absorbedParentTitle || context.parentTitle;
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={comparisonPanelSx} aria-label="Nodes before merge">
        <Typography sx={sectionLabelSx}>Before</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.canonicalTitle}
        </Typography>
        <Typography sx={{ mt: 0.25, color: "text.secondary" }}>
          Under {canonicalParentTitle}
        </Typography>
        <CollectionNote value={context.canonicalCollection} />
        <ChildOutline titles={context.canonicalChildren} />
        <Divider sx={{ my: 1.5 }} />
        <Typography sx={{ fontWeight: 750 }}>
          {context.absorbedTitle}
        </Typography>
        <Typography sx={{ mt: 0.25, color: "text.secondary" }}>
          Under {absorbedParentTitle}
        </Typography>
        <CollectionNote value={context.absorbedCollection} />
        <ChildOutline titles={context.absorbedChildren} highlighted />
      </Box>
      <Box sx={comparisonPanelSx} aria-label="Node after merge">
        <Typography sx={sectionLabelSx}>After</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.canonicalTitle}
        </Typography>
        <Typography sx={{ mt: 0.25, color: "text.secondary" }}>
          Remains under {canonicalParentTitle}
        </Typography>
        <CollectionNote value={context.canonicalCollection} />
        {context.absorbedBecomesSynonym && (
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            Synonym: <strong>{context.absorbedTitle}</strong>
          </Typography>
        )}
        <Typography sx={{ ...sectionLabelSx, mt: 1.5 }}>
          Direct children after consolidation
        </Typography>
        <Box
          sx={{
            mt: 0.5,
            columns: {
              xs: 1,
              sm: context.resultingChildren.length > 8 ? 2 : 1,
            },
            columnGap: 2,
          }}
        >
          {[...context.resultingChildren]
            .sort((left, right) => left.localeCompare(right, "en"))
            .map((title) => (
              <Box key={title} sx={{ breakInside: "avoid" }}>
                <OutlineItem
                  title={title}
                  highlighted={movedChildren.has(title)}
                  indent={1}
                />
              </Box>
            ))}
        </Box>
        {context.resultingChildren.length === 0 && (
          <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
            No direct children
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

const RelocationAction = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "relocation-action" }>;
}) => (
  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
    <Box sx={comparisonPanelSx} aria-label="Placement before relocation">
      <Typography sx={sectionLabelSx}>Before</Typography>
      <Typography sx={{ mt: 1, fontWeight: 750 }}>
        {context.currentParentTitle}
      </Typography>
      <CollectionNote value={context.currentCollection} />
      <OutlineItem title={context.nodeTitle} highlighted indent={1} />
      <ChildOutline titles={context.childTitles} indent={2} />
    </Box>
    <Box sx={comparisonPanelSx} aria-label="Placement after relocation">
      <Typography sx={sectionLabelSx}>After</Typography>
      <Typography sx={{ mt: 1, fontWeight: 750 }}>
        {context.proposedParentTitle}
      </Typography>
      <CollectionNote value={context.proposedCollection} />
      <OutlineItem title={context.nodeTitle} highlighted indent={1} />
      <ChildOutline titles={context.childTitles} indent={2} />
    </Box>
  </Stack>
);

const AdditionAction = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "addition-action" }>;
}) => (
  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
    <Box sx={comparisonPanelSx} aria-label="Ontology before addition">
      <Typography sx={sectionLabelSx}>Before</Typography>
      <Typography sx={{ mt: 1, fontWeight: 750 }}>
        {context.parentTitle}
      </Typography>
      <Typography sx={{ mt: 1, color: "text.secondary", lineHeight: 1.5 }}>
        No direct child named &quot;{context.proposedTitle}&quot;.
      </Typography>
    </Box>
    <Box sx={comparisonPanelSx} aria-label="Ontology after addition">
      <Typography sx={sectionLabelSx}>After</Typography>
      <Typography sx={{ mt: 1, fontWeight: 750 }}>
        {context.parentTitle}
      </Typography>
      <OutlineItem title={context.proposedTitle} highlighted indent={1} />
      <Typography sx={{ mt: 1.25, lineHeight: 1.55 }}>
        {context.description}
      </Typography>
      {context.examples.length > 0 && (
        <Typography sx={{ mt: 1, color: "text.secondary", lineHeight: 1.5 }}>
          Examples: {context.examples.join(", ")}
        </Typography>
      )}
    </Box>
  </Stack>
);

const MergeUpAction = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "merge-up-action" }>;
}) => (
  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
    <Box sx={comparisonPanelSx} aria-label="Hierarchy before wrapper removal">
      <Typography sx={sectionLabelSx}>Before</Typography>
      <Typography sx={{ mt: 1, fontWeight: 750 }}>
        {context.parentTitle}
      </Typography>
      <CollectionNote value={context.parentCollection} />
      <OutlineItem title={context.nodeTitle} highlighted indent={1} />
      {context.childTitles.map((title) => (
        <OutlineItem key={title} title={title} highlighted indent={2} />
      ))}
    </Box>
    <Box sx={comparisonPanelSx} aria-label="Hierarchy after wrapper removal">
      <Typography sx={sectionLabelSx}>After</Typography>
      <Typography sx={{ mt: 1, fontWeight: 750 }}>
        {context.parentTitle}
      </Typography>
      <CollectionNote value={context.parentCollection} />
      {context.childTitles.map((title) => (
        <OutlineItem key={title} title={title} highlighted indent={1} />
      ))}
    </Box>
  </Stack>
);

const SourceTasks = ({ tasks }: { tasks: string[] }) => {
  const uniqueTasks = uniqueTextValues(tasks);
  return uniqueTasks.length > 0 ? (
    <Disclosure
      closedLabel={`Show source O*NET evidence${uniqueTasks.length > 1 ? ` (${uniqueTasks.length})` : ""}`}
      openLabel="Hide source O*NET evidence"
      initiallyOpen
    >
      <List dense disablePadding sx={{ pl: 1, pb: 1 }}>
        {uniqueTasks.map((task) => (
          <ListItem key={task} disableGutters alignItems="flex-start">
            <ListItemText
              primary={task}
              primaryTypographyProps={{ sx: { lineHeight: 1.5 } }}
            />
          </ListItem>
        ))}
      </List>
    </Disclosure>
  ) : null;
};

const SynonymValues = ({ values }: { values: string[] }) =>
  values.length ? (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={1}
      sx={{ mt: 1 }}
    >
      {values.map((value) => (
        <Chip key={value} label={value} variant="outlined" />
      ))}
    </Stack>
  ) : (
    <Typography sx={{ mt: 1, color: "text.secondary" }}>None</Typography>
  );

const MetadataEdit = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "metadata-edit" }>;
}) => {
  const removedSynonyms = (context.currentValues || []).filter(
    (value) => !(context.proposedValues || []).includes(value),
  );
  const isRemovalReview =
    context.field === "synonyms" &&
    context.synonymScope === "all-recorded" &&
    removedSynonyms.length > 0;

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={comparisonPanelSx} aria-label="Metadata before change">
          <Typography sx={sectionLabelSx}>Before</Typography>
          {isRemovalReview ? (
            <>
              <Typography sx={{ mt: 1, fontWeight: 750 }}>
                {removedSynonyms.join(", ")}
              </Typography>
              <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                Recorded as{" "}
                {removedSynonyms.length === 1 ? "a synonym" : "synonyms"} of
              </Typography>
              <Typography sx={{ mt: 0.35, fontWeight: 700 }}>
                {context.nodeTitle}
              </Typography>
            </>
          ) : (
            <Typography sx={{ mt: 1, fontWeight: 750 }}>
              {context.nodeTitle}
            </Typography>
          )}
          <Typography sx={{ ...sectionLabelSx, mt: 1.25 }}>
            {context.field === "synonyms"
              ? context.synonymScope === "all-recorded"
                ? "Current recorded synonyms"
                : "Current structured synonyms"
              : "Current description"}
          </Typography>
          {context.field === "synonyms" ? (
            <SynonymValues values={context.currentValues || []} />
          ) : (
            <Typography
              sx={{ mt: 1, lineHeight: 1.55, color: "text.secondary" }}
            >
              {context.currentText || "No description"}
            </Typography>
          )}
        </Box>
        <Box sx={comparisonPanelSx} aria-label="Metadata after change">
          <Typography sx={sectionLabelSx}>After</Typography>
          {isRemovalReview ? (
            <Typography sx={{ mt: 1, fontWeight: 750, lineHeight: 1.5 }}>
              Remove {removedSynonyms.join(", ")} from the synonyms recorded for{" "}
              {context.nodeTitle}
            </Typography>
          ) : (
            <Typography sx={{ mt: 1, fontWeight: 750 }}>
              {context.nodeTitle}
            </Typography>
          )}
          <Typography sx={{ ...sectionLabelSx, mt: 1.25 }}>
            {context.field === "synonyms"
              ? context.synonymScope === "all-recorded"
                ? "Recorded synonyms after this change"
                : "Proposed structured synonyms"
              : "Proposed description"}
          </Typography>
          {context.field === "synonyms" ? (
            <SynonymValues values={context.proposedValues || []} />
          ) : (
            <Typography sx={{ mt: 1, lineHeight: 1.55 }}>
              {context.proposedText}
            </Typography>
          )}
        </Box>
      </Stack>
      <Box sx={{ mt: 1 }}>
        <SourceTasks tasks={context.sourceTasks || []} />
      </Box>
    </Box>
  );
};

const PolysemyReview = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "polysemy-review" }>;
}) => (
  <Box>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={comparisonPanelSx} aria-label="Meaning before separation">
        <Typography sx={sectionLabelSx}>Before</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.currentParentTitle}
        </Typography>
        <OutlineItem title={context.nodeTitle} highlighted indent={1} />
      </Box>
      <Box sx={comparisonPanelSx} aria-label="Meanings after separation">
        <Typography sx={sectionLabelSx}>After</Typography>
        {context.proposedSenses.map((sense) => (
          <Box key={sense.title} sx={{ mt: 1.25 }}>
            <Typography sx={{ fontWeight: 750 }}>{sense.title}</Typography>
            <Typography sx={{ mt: 0.35, lineHeight: 1.5 }}>
              {sense.meaning}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
    <Box sx={{ mt: 1 }}>
      <SourceTasks tasks={context.sourceTasks} />
    </Box>
    <BoundaryNote>
      If you agree that the title combines distinct meanings, where each meaning
      belongs will be reviewed in a separate step.
    </BoundaryNote>
  </Box>
);

const CollectionDesign = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "collection-design" }>;
}) => (
  <Box>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={comparisonPanelSx} aria-label="Collections before redesign">
        <Typography sx={sectionLabelSx}>Before</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.parentTitle}
        </Typography>
        {context.currentChildren.map((title) => (
          <OutlineItem key={title} title={title} highlighted indent={1} />
        ))}
      </Box>
      <Box sx={comparisonPanelSx} aria-label="Collections after redesign">
        <Typography sx={sectionLabelSx}>After</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.parentTitle}
        </Typography>
        <Typography
          sx={{ mt: 1.25, color: reviewAccentColor, fontWeight: 750 }}
        >
          Collection: {context.proposedCollectionName}
        </Typography>
        {context.proposedBranches.map((branch) => (
          <Box key={branch.title}>
            <OutlineItem
              title={branch.title}
              highlighted
              indent={1}
              statusLabel={
                branch.status === "new" ? "Proposed new activity" : undefined
              }
            />
            {branch.children.map((title) => (
              <OutlineItem key={title} title={title} highlighted indent={2} />
            ))}
          </Box>
        ))}
      </Box>
    </Stack>
    <Box sx={{ mt: 1 }}>
      <SourceTasks tasks={context.sourceTasks || []} />
    </Box>
  </Box>
);

const SenseRelocationAction = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "sense-relocation-action" }>;
}) => (
  <Box>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={comparisonPanelSx} aria-label="Combined sense before relocation">
        <Typography sx={sectionLabelSx}>Before</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.currentParentTitle}
        </Typography>
        <CollectionNote value={context.currentCollection} />
        <OutlineItem title={context.nodeTitle} highlighted indent={1} />
      </Box>
      <Box
        sx={comparisonPanelSx}
        aria-label="Separated senses after relocation"
      >
        <Typography sx={sectionLabelSx}>After</Typography>
        <LabeledValue
          label={`Retain under ${context.retainedParentTitle}`}
          value={context.retainedSenseTitle}
        />
        <Divider sx={{ my: 1.5 }} />
        <LabeledValue
          label={`Move under ${context.proposedParentTitle}`}
          value={context.movedSenseTitle}
        />
      </Box>
    </Stack>
    <Box sx={{ mt: 1 }}>
      <SourceTasks tasks={context.sourceTasks} />
    </Box>
  </Box>
);

const DuplicateComparison = ({
  context,
}: {
  context: Extract<SomReviewContext, { type: "duplicate-comparison" }>;
}) => (
  <Box>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Box
        sx={comparisonPanelSx}
        aria-label="Separate node before synonym change"
      >
        <Typography sx={sectionLabelSx}>Before</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.candidateSynonymTitle}
        </Typography>
        <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
          Separate node under{" "}
          {context.candidateParentTitle || context.parentTitle}
        </Typography>
      </Box>
      <Box sx={comparisonPanelSx} aria-label="Proposed synonym relationship">
        <Typography sx={sectionLabelSx}>After</Typography>
        <Typography sx={{ mt: 1, fontWeight: 750 }}>
          {context.canonicalTitle}
        </Typography>
        <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
          Keep under {context.canonicalParentTitle || context.parentTitle} and
          record {context.candidateSynonymTitle} as a synonym
        </Typography>
      </Box>
    </Stack>
    <Box sx={{ mt: 1 }}>
      <SourceTasks tasks={context.sourceTasks || []} />
    </Box>
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
        <LabeledValue
          label={context.firstCollection}
          value={context.firstTitle}
        />
      </Box>
      <Box sx={comparisonPanelSx}>
        <LabeledValue
          label={context.secondCollection}
          value={context.secondTitle}
        />
      </Box>
    </Stack>
    <BoundaryNote>
      Agreeing only marks a possible overlap for follow-up. It does not merge
      either activity.
    </BoundaryNote>
  </Box>
);

export default ContextRenderer;
