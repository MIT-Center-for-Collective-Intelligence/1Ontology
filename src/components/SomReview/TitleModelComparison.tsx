import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import ThemeModeToggle from "./ThemeModeToggle";
import { reviewInteractiveSurfaceSx, reviewToneChipSx } from "./reviewStyles";
import {
  CHECK_LABELS,
  OPTION_LETTERS,
  RULE_LABELS,
  VERDICT_COLORS,
  VERDICT_KEYS,
  VERDICT_LABELS,
  citedGroupLabels,
  citedGroupNumbers,
  countVerdicts,
  modelDisplayName,
  verdictKey,
  type TitleVerdictKey,
} from "../../lib/somReview/titleModelComparison";
import type {
  TitleJudgeSeverity,
  TitleJudgmentStatus,
  TitleModelComparisonCase,
  TitleModelComparisonData,
  TitleModelComparisonModel,
  TitleModelComparisonOption,
  TitleOptionLetter,
} from "../../types/ITitleModelComparison";
export type { TitleModelComparisonData } from "../../types/ITitleModelComparison";

const disclosureSx = {
  mt: 1.5,
  "& > summary": { cursor: "pointer", fontWeight: 650, py: 1.25 },
};
const textSx = {
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontFamily: "inherit",
  fontSize: "0.95rem",
  lineHeight: 1.65,
};
const smallTextSx = { fontSize: "0.9rem", lineHeight: 1.5 };

type Tone = "error" | "warning" | "info" | "success" | "default";

// Tone borders stay visible on light backgrounds, where this theme's warning
// color is pale; the text label always carries the meaning.
const toneBorder = (tone: Tone) => (theme: Theme) => {
  if (tone === "default") return theme.palette.text.disabled;
  if (theme.palette.mode === "dark") return theme.palette[tone].main;
  return tone === "warning" ? "#b86200" : theme.palette[tone].main;
};

// Tinted chips keep text at full contrast in both themes, as on the review screens.
const toneChipSx = (tone: Tone): SxProps<Theme> =>
  tone === "default"
    ? { fontWeight: 700, maxWidth: "100%", color: "text.primary" }
    : {
        ...reviewToneChipSx(tone),
        maxWidth: "100%",
        border: 1,
        borderColor: toneBorder(tone),
      };

function VerdictChip({ verdict }: { verdict: TitleVerdictKey }) {
  const tone = VERDICT_COLORS[verdict];
  return (
    <Chip
      size="small"
      label={VERDICT_LABELS[verdict]}
      color={tone}
      data-testid="verdict-chip"
      sx={toneChipSx(tone)}
    />
  );
}

const optionLabel = (
  letter: TitleOptionLetter,
  model: TitleModelComparisonModel | undefined,
  showNames: boolean,
) =>
  showNames && model
    ? `Option ${letter} · ${modelDisplayName(model)}`
    : `Option ${letter}`;

const trimClause = (text: string) => text.trim().replace(/[\s;,.:]+$/, "");

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const unavailableExplanation = (status: TitleJudgmentStatus) => {
  if (status === "missing") return "No judgment was recorded.";
  if (status === "stale")
    return "The recorded judgment was made for a different request and is not shown.";
  if (status === "unparseable") return "The recorded judgment could not be read and is not shown.";
  return "The model judge’s response did not pass validation and is not shown.";
};

function DescriptionButtons({
  numbers,
  known,
  highlighted,
  onHighlight,
  label,
}: {
  numbers: number[];
  known: Set<number>;
  highlighted: number | null;
  onHighlight: (number: number) => void;
  label: (number: number) => string;
}) {
  return (
    <>
      {numbers.map((number, position) =>
        known.has(number) ? (
          <Button
            key={`${number}-${position}`}
            size="small"
            aria-label={label(number)}
            aria-pressed={highlighted === number}
            variant={highlighted === number ? "contained" : "outlined"}
            disableElevation
            onClick={() => onHighlight(number)}
            sx={{ minWidth: 44, minHeight: 44, px: 1 }}
          >
            #{number}
          </Button>
        ) : (
          <Typography
            key={`${number}-${position}`}
            component="span"
            sx={{ ...smallTextSx, alignSelf: "center" }}
          >
            #{number} (not a linked description)
          </Typography>
        ),
      )}
    </>
  );
}

function FindingItem({
  severity,
  kind,
  source,
  groupLabels,
  descriptionNumbers,
  evidenceQuote,
  quoteUnmatched,
  explanation,
  known,
  highlighted,
  onHighlight,
  letter,
}: {
  severity: TitleJudgeSeverity;
  kind: string;
  source: string;
  groupLabels: string[];
  descriptionNumbers: number[];
  evidenceQuote?: string;
  quoteUnmatched?: boolean;
  explanation: string;
  known: Set<number>;
  highlighted: number | null;
  onHighlight: (number: number) => void;
  letter: TitleOptionLetter;
}) {
  const tone = VERDICT_COLORS[severity];
  return (
    <Box
      component="li"
      sx={{
        mt: 1.5,
        p: 1.5,
        border: 1,
        borderColor: "divider",
        borderLeftWidth: 4,
        borderLeftColor: toneBorder(tone),
        borderRadius: 1,
      }}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        alignItems="center"
      >
        <Chip
          size="small"
          label={VERDICT_LABELS[severity]}
          color={tone}
          sx={toneChipSx(tone)}
        />
        <Typography component="span" sx={{ fontWeight: 700, lineHeight: 1.45 }}>
          {kind}
        </Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 0.5 }}>
        {source}
      </Typography>
      {groupLabels.map((groupLabel, index) => (
        <Typography key={index} sx={{ mt: 0.75, fontWeight: 600, lineHeight: 1.45 }}>
          {groupLabel}
        </Typography>
      ))}
      {descriptionNumbers.length > 0 && (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={0.5}
          alignItems="center"
          sx={{ mt: 0.75 }}
        >
          <Typography component="span" sx={{ ...smallTextSx, mr: 0.5 }}>
            {descriptionNumbers.length === 1 ? "Description" : "Descriptions"}
          </Typography>
          <DescriptionButtons
            numbers={descriptionNumbers}
            known={known}
            highlighted={highlighted}
            onHighlight={onHighlight}
            label={(number) =>
              `Option ${letter} finding: highlight description ${number}`
            }
          />
        </Stack>
      )}
      {evidenceQuote?.trim() && (
        <Box
          component="blockquote"
          sx={{
            my: 1,
            mx: 0,
            pl: 1.5,
            borderLeft: 3,
            borderColor: "divider",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          “{evidenceQuote.trim()}”
        </Box>
      )}
      {quoteUnmatched && (
        <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 0.5 }}>
          The quoted words could not be matched exactly to a description.
        </Typography>
      )}
      <Typography sx={{ mt: 0.75, lineHeight: 1.6 }}>{explanation}</Typography>
    </Box>
  );
}

function JudgeFindings({
  option,
  known,
  highlighted,
  onHighlight,
}: {
  option: TitleModelComparisonOption;
  known: Set<number>;
  highlighted: number | null;
  onHighlight: (number: number) => void;
}) {
  const { judgment, groups, letter } = option;
  const valid = judgment.status === "valid";
  const hasItems =
    judgment.softwareFindings.length > 0 || judgment.issues.length > 0;
  return (
    <Box
      data-testid={`judge-findings-${letter}`}
      sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: "divider" }}
    >
      <Typography component="h4" sx={{ fontWeight: 750, lineHeight: 1.45 }}>
        Judging agent findings
      </Typography>
      {hasItems && (
        <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
          {judgment.softwareFindings.map((finding, index) => (
            <FindingItem
              key={`software-${index}`}
              severity={finding.severity}
              kind={CHECK_LABELS[finding.check]}
              source="Software check"
              groupLabels={citedGroupLabels(groups, finding.groupNumbers)}
              descriptionNumbers={finding.descriptionNumbers}
              explanation={finding.explanation}
              known={known}
              highlighted={highlighted}
              onHighlight={onHighlight}
              letter={letter}
            />
          ))}
          {judgment.issues.map((issue, index) => (
            <FindingItem
              key={`judge-${index}`}
              severity={issue.severity}
              kind={RULE_LABELS[issue.rule]}
              source="Model judge"
              groupLabels={citedGroupLabels(groups, issue.groupNumbers)}
              descriptionNumbers={issue.descriptionNumbers}
              evidenceQuote={issue.evidenceQuote}
              quoteUnmatched={issue.quoteUnmatched}
              explanation={issue.explanation}
              known={known}
              highlighted={highlighted}
              onHighlight={onHighlight}
              letter={letter}
            />
          ))}
        </Box>
      )}
      {valid ? (
        <>
          {judgment.summary && (
            <Typography sx={{ mt: 1.5, lineHeight: 1.6 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                Summary:
              </Box>{" "}
              {judgment.summary}
            </Typography>
          )}
          {judgment.otherQuoteWarning && (
            <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 0.75 }}>
              The quoted words could not be matched exactly to a description.
            </Typography>
          )}
        </>
      ) : (
        <Box
          sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>Judgment unavailable</Typography>
          <Typography sx={{ mt: 0.25, lineHeight: 1.6 }}>
            {unavailableExplanation(judgment.status)}
          </Typography>
          {judgment.softwareFindings.length > 0 && (
            <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 0.5 }}>
              The software check findings above are still shown.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function OptionColumn({
  option,
  model,
  showNames,
  showFindings,
  highlighted,
  onHighlight,
  known,
  mobileLetter,
}: {
  option: TitleModelComparisonOption;
  model?: TitleModelComparisonModel;
  showNames: boolean;
  showFindings: boolean;
  highlighted: number | null;
  onHighlight: (number: number) => void;
  known: Set<number>;
  mobileLetter: TitleOptionLetter;
}) {
  const { letter, groups, judgment } = option;
  const cited = citedGroupNumbers(judgment);
  const completed = option.status === "completed";
  return (
    <Box
      component="section"
      aria-label={`Option ${letter}`}
      data-testid={`model-option-${letter}`}
      data-compact-selected={mobileLetter === letter ? "true" : "false"}
      sx={{
        minWidth: 0,
        display: { xs: mobileLetter === letter ? "block" : "none", lg: "block" },
      }}
    >
      <Typography
        component="h3"
        variant="h6"
        sx={{ lineHeight: 1.35, fontWeight: 750 }}
      >
        {optionLabel(letter, model, showNames)}
      </Typography>
      {showFindings && (
        <Box sx={{ mt: 1 }}>
          <VerdictChip verdict={verdictKey(judgment.verdict)} />
        </Box>
      )}
      {completed ? (
        <>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {plural(groups.length, "proposed group")}
          </Typography>
          {option.reason && (
            <Box component="details" sx={disclosureSx}>
              <summary>Why these titles?</summary>
              <Typography sx={{ lineHeight: 1.6 }}>{option.reason}</Typography>
            </Box>
          )}
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {groups.map((group, index) => {
              const contains =
                highlighted !== null && group.descriptionNumbers.includes(highlighted);
              return (
                <Paper
                  key={index}
                  variant="outlined"
                  data-testid={`model-option-${letter}-group-${index + 1}`}
                  data-highlighted={contains ? "true" : "false"}
                  sx={{
                    p: 1.5,
                    borderColor: contains ? "primary.main" : "divider",
                    borderWidth: contains ? 2 : 1,
                  }}
                >
                  <Typography
                    component="h4"
                    sx={{ fontWeight: 750, lineHeight: 1.45 }}
                  >
                    {group.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 0.4 }}>
                    {plural(group.descriptionNumbers.length, "description")}
                  </Typography>
                  {contains && (
                    <Typography
                      sx={{ ...smallTextSx, mt: 0.4, fontWeight: 650, color: "text.primary" }}
                    >
                      Contains description #{highlighted}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    useFlexGap
                    gap={0.5}
                    sx={{ mt: 1 }}
                  >
                    <DescriptionButtons
                      numbers={group.descriptionNumbers}
                      known={known}
                      highlighted={highlighted}
                      onHighlight={onHighlight}
                      label={(number) =>
                        `Option ${letter}: highlight description ${number}`
                      }
                    />
                  </Stack>
                  {showFindings && cited.has(index + 1) && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label="Judging agent: see findings"
                      sx={{ mt: 1, maxWidth: "100%" }}
                    />
                  )}
                  {group.reason && (
                    <Box component="details" sx={disclosureSx}>
                      <summary>Reason</summary>
                      <Typography sx={{ lineHeight: 1.6 }}>{group.reason}</Typography>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </>
      ) : (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          This request did not produce a complete result. No proposal is
          inferred from it.
        </Alert>
      )}
      {option.observations.length > 0 && (
        <Box component="details" sx={disclosureSx}>
          <summary>{plural(option.observations.length, "software note")}</summary>
          <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
            {option.observations.map((note, index) => (
              <Box component="li" key={index} sx={{ mb: 0.5, lineHeight: 1.6 }}>
                {note}
              </Box>
            ))}
          </Box>
          <Typography color="text.secondary" sx={smallTextSx}>
            These automated notes do not decide whether the proposal makes
            sense.
          </Typography>
        </Box>
      )}
      {showFindings && (
        <JudgeFindings
          option={option}
          known={known}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
      )}
    </Box>
  );
}

function ComparisonExample({
  item,
  index,
  total,
  models,
  showNames,
  showFindings,
  mobileLetter,
  setMobileLetter,
}: {
  item: TitleModelComparisonCase;
  index: number;
  total: number;
  models: Map<string, TitleModelComparisonModel>;
  showNames: boolean;
  showFindings: boolean;
  mobileLetter: TitleOptionLetter;
  setMobileLetter: (letter: TitleOptionLetter) => void;
}) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  const known = new Set(item.descriptions.map((description) => description.number));
  const count = item.descriptions.length;
  const source = item.descriptions.find(
    (description) => description.number === highlighted,
  );
  const toggle = (number: number) =>
    setHighlighted((current) => (current === number ? null : number));
  return (
    <Paper
      component="article"
      id={item.id}
      aria-labelledby={`${item.id}-heading`}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, mt: 3, scrollMarginTop: 24 }}
    >
      <Typography color="text.secondary">
        Example {index + 1} of {total}
      </Typography>
      <Typography
        component="h2"
        variant="h5"
        id={`${item.id}-heading`}
        sx={{ mt: 0.5, fontWeight: 750 }}
      >
        {item.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {plural(count, "O*NET description")}
      </Typography>
      <Box
        component="section"
        aria-label="O*NET evidence"
        sx={{ my: 2.5, p: 2, bgcolor: "action.hover", borderRadius: 1 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          gap={1.5}
          alignItems={{ sm: "center" }}
        >
          <Typography
            component="h3"
            variant="h6"
            ref={evidenceHeading}
            tabIndex={-1}
            sx={{ scrollMarginTop: 16 }}
          >
            The same evidence for all four options
          </Typography>
          <TextField
            select
            label="Highlight description"
            value={highlighted === null ? "" : String(highlighted)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            onChange={(event) =>
              setHighlighted(event.target.value ? Number(event.target.value) : null)
            }
            sx={{ minWidth: 180 }}
          >
            <option value="">None</option>
            {item.descriptions.map((description) => (
              <option key={description.number} value={description.number}>
                #{description.number} of {count}
              </option>
            ))}
          </TextField>
        </Stack>
        <Box aria-live="polite">
          {source ? (
            <>
              <Typography
                sx={{ mt: 2, lineHeight: 1.7 }}
                data-testid="highlighted-description"
              >
                <strong>#{source.number}.</strong> {source.text}
              </Typography>
              <Box
                data-testid="highlight-placement"
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 1,
                  mt: 1.5,
                }}
              >
                {item.options.map((option) => {
                  const containing = option.groups.filter((group) =>
                    group.descriptionNumbers.includes(source.number),
                  );
                  return (
                    <Paper key={option.letter} variant="outlined" sx={{ p: 1.25 }}>
                      <Typography sx={{ fontWeight: 700, lineHeight: 1.4 }}>
                        {optionLabel(option.letter, models.get(option.modelId), showNames)}
                      </Typography>
                      {containing.length ? (
                        containing.map((group, i) => (
                          <Typography key={i} sx={{ lineHeight: 1.5 }}>
                            {group.title}
                          </Typography>
                        ))
                      ) : (
                        <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
                          {option.status === "completed"
                            ? "No group includes this description."
                            : "Result unavailable."}
                        </Typography>
                      )}
                    </Paper>
                  );
                })}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
              Choose a description to see where each option places it.
              Highlighted groups contain that description.
            </Typography>
          )}
        </Box>
        <Box component="details" sx={disclosureSx}>
          <summary>
            {count === 1 ? "Show the description" : `Show all ${count} descriptions`}
          </summary>
          <Box
            component="ol"
            sx={{ pl: 3, my: 0.5, maxHeight: 420, overflowY: "auto" }}
          >
            {item.descriptions.map((description) => (
              <Box
                component="li"
                key={description.number}
                value={description.number}
                sx={{ mb: 1.25 }}
              >
                <Typography component="span" sx={{ lineHeight: 1.6 }}>
                  {description.text}
                </Typography>{" "}
                <Button
                  size="small"
                  aria-pressed={highlighted === description.number}
                  variant={highlighted === description.number ? "contained" : "text"}
                  disableElevation
                  onClick={() => toggle(description.number)}
                  sx={{ minHeight: 44 }}
                >
                  Highlight #{description.number}
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <ToggleButtonGroup
        exclusive
        value={mobileLetter}
        onChange={(_, value) => value && setMobileLetter(value)}
        aria-label="Option on small screens"
        sx={{ display: { xs: "flex", lg: "none" }, mb: 2 }}
      >
        {OPTION_LETTERS.map((letter) => (
          <ToggleButton
            key={letter}
            value={letter}
            sx={{ flex: 1, minHeight: 44, fontWeight: 700 }}
          >
            {letter}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: { xs: 3, lg: 3 },
        }}
      >
        {item.options.map((option) => (
          <OptionColumn
            key={option.letter}
            option={option}
            model={models.get(option.modelId)}
            showNames={showNames}
            showFindings={showFindings}
            highlighted={highlighted}
            onHighlight={toggle}
            known={known}
            mobileLetter={mobileLetter}
          />
        ))}
      </Box>
    </Paper>
  );
}

function JudgeOverview({
  data,
  showNames,
}: {
  data: TitleModelComparisonData;
  showNames: boolean;
}) {
  const options = data.cases.flatMap((item) => item.options);
  const counts = countVerdicts(options);
  const { execution } = data;
  const runLine = execution
    ? [execution.runner, execution.model, execution.runDate].filter(Boolean).join(" · ")
    : "";
  const hasRunDetails = Boolean(
    execution &&
      (execution.method || execution.stability || execution.limitations?.length),
  );
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="judge-overview-heading"
      sx={{ mt: 3, p: { xs: 2, sm: 3 } }}
    >
      <Typography
        component="h2"
        variant="h5"
        id="judge-overview-heading"
        sx={{ fontWeight: 750 }}
      >
        Judging agent overview
      </Typography>
      <Typography sx={{ mt: 1, maxWidth: 850, lineHeight: 1.6 }}>
        Verdicts for all {options.length} proposals. Each verdict is the most
        severe finding from the software checks and the model judge.
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: "none",
          p: 0,
          m: 0,
          mt: 2,
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(5, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        {VERDICT_KEYS.map((key) => (
          <Box
            component="li"
            key={key}
            data-testid={`verdict-count-${key}`}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: "divider",
              borderTopWidth: 4,
              borderTopColor: toneBorder(VERDICT_COLORS[key]),
              borderRadius: 1,
            }}
          >
            <Typography sx={{ fontSize: "1.75rem", fontWeight: 750, lineHeight: 1.2 }}>
              {counts[key]}
            </Typography>
            <Typography sx={{ lineHeight: 1.4 }}>{VERDICT_LABELS[key]}</Typography>
          </Box>
        ))}
      </Box>
      {counts.unavailable === options.length && options.length > 0 && (
        <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
          No model judgments have been recorded yet. Software check findings
          are still shown with each option.
        </Typography>
      )}
      {runLine && (
        <Typography sx={{ mt: 1.5 }} data-testid="judge-run-line">
          Judging agent run: {runLine}
        </Typography>
      )}
      {hasRunDetails && execution && (
        <Box component="details" sx={disclosureSx}>
          <summary>How the judging agent was run</summary>
          {execution.method && (
            <Typography sx={{ lineHeight: 1.6 }}>{execution.method}</Typography>
          )}
          {execution.stability && (
            <Typography sx={{ mt: 1, lineHeight: 1.6 }}>{execution.stability}</Typography>
          )}
          {execution.limitations?.length ? (
            <>
              <Typography component="h3" sx={{ mt: 1.5, fontWeight: 700 }}>
                Limitations
              </Typography>
              <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                {execution.limitations.map((limitation, index) => (
                  <Box component="li" key={index} sx={{ mb: 0.5, lineHeight: 1.6 }}>
                    {limitation}
                  </Box>
                ))}
              </Box>
            </>
          ) : null}
        </Box>
      )}
      {showNames && (
        <>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              mt: 2.5,
              "& th, & td": { overflowWrap: "normal", wordBreak: "normal" },
              "& thead th": { verticalAlign: "bottom", minWidth: 88, fontWeight: 700 },
              "& tbody td": { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
            }}
          >
            <Table size="small" aria-label="Judging agent findings by model">
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col">Model</TableCell>
                  <TableCell component="th" scope="col" align="right">Proposed groups</TableCell>
                  <TableCell component="th" scope="col" align="right">Prompt violations</TableCell>
                  <TableCell component="th" scope="col" align="right">Major</TableCell>
                  <TableCell component="th" scope="col" align="right">Minor</TableCell>
                  <TableCell component="th" scope="col" align="right">No issues</TableCell>
                  <TableCell component="th" scope="col" align="right">Unavailable</TableCell>
                  <TableCell component="th" scope="col" align="right">
                    Estimated generation cost for {data.cases.length} examples
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.models.map((model) => {
                  const modelCounts = countVerdicts(
                    options.filter((option) => option.modelId === model.id),
                  );
                  return (
                    <TableRow key={model.id}>
                      <TableCell component="th" scope="row" sx={{ minWidth: 170 }}>
                        {modelDisplayName(model)}
                      </TableCell>
                      <TableCell align="right">{model.groupCount}</TableCell>
                      <TableCell align="right">{modelCounts["prompt-violation"]}</TableCell>
                      <TableCell align="right">{modelCounts.major}</TableCell>
                      <TableCell align="right">{modelCounts.minor}</TableCell>
                      <TableCell align="right">{modelCounts["no-issues"]}</TableCell>
                      <TableCell align="right">{modelCounts.unavailable}</TableCell>
                      <TableCell align="right">
                        ${model.generationCostUsd.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 1 }}>
            Estimated from usage telemetry in US dollars, not invoices. They
            cover generating the proposals, not running the judging agent.
          </Typography>
        </>
      )}
    </Paper>
  );
}

function PromptDisclosures({ data }: { data: TitleModelComparisonData }) {
  const correction = data.wordingCorrection;
  return (
    <Box
      component="section"
      aria-labelledby="prompts-heading"
      sx={{ mt: 4, maxWidth: 1000 }}
    >
      <Typography
        component="h2"
        variant="h5"
        id="prompts-heading"
        sx={{ fontWeight: 750 }}
      >
        Prompts and instructions
      </Typography>
      <Box component="details" sx={disclosureSx}>
        <summary>Exact title prompt and clarification</summary>
        <Typography component="h3" sx={{ fontWeight: 700, mt: 1 }}>
          Prompt given to all four models
        </Typography>
        <Box component="pre" sx={textSx}>
          {data.prompt}
        </Box>
        <Typography component="h3" sx={{ fontWeight: 700, mt: 2 }}>
          Rob’s clarification
        </Typography>
        <Box component="pre" sx={textSx}>
          {data.clarification}
        </Box>
        {correction && (
          <Typography sx={{ mt: 2, lineHeight: 1.6 }} data-testid="wording-correction">
            One wording correction was made before the runs. The prompt as
            received read “{trimClause(correction.original)}”; the models
            received “{trimClause(correction.replacement)}”.{" "}
            {correction.reason}
          </Typography>
        )}
        <Typography component="h3" sx={{ fontWeight: 700, mt: 2 }}>
          Output format
        </Typography>
        <Box component="pre" sx={textSx}>
          {data.outputFormat}
        </Box>
        <Typography component="h3" sx={{ fontWeight: 700, mt: 2 }}>
          Software notes
        </Typography>
        <Typography sx={{ lineHeight: 1.6 }}>{data.softwareChecks}</Typography>
        <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 1.5 }}>
          Funding: {data.funding}
        </Typography>
      </Box>
      <Box component="details" sx={disclosureSx}>
        <summary>Judging agent instructions</summary>
        <Typography color="text.secondary" sx={{ ...smallTextSx, mt: 1 }}>
          Instructions version: {data.judge.promptVersion}
        </Typography>
        <Box component="pre" sx={textSx}>
          {data.judge.instructions}
        </Box>
        <Typography component="h3" sx={{ fontWeight: 700, mt: 2 }}>
          Software checks
        </Typography>
        <Typography sx={{ lineHeight: 1.6 }}>{data.judge.softwareChecks}</Typography>
        <Typography component="h3" sx={{ fontWeight: 700, mt: 2 }}>
          How judgments are checked
        </Typography>
        <Typography sx={{ lineHeight: 1.6 }}>{data.judge.validationRules}</Typography>
        <Box component="details" sx={disclosureSx}>
          <summary>Output format</summary>
          <Box
            component="pre"
            sx={{
              ...textSx,
              fontFamily: "monospace",
              fontSize: "0.85rem",
              maxHeight: 480,
              overflow: "auto",
            }}
          >
            {JSON.stringify(data.judge.schema, null, 2)}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function TitleModelComparison({
  data,
}: {
  data: TitleModelComparisonData;
}) {
  const [selectedId, setSelectedId] = useState(data.cases[0]?.id || "");
  const [mobileLetter, setMobileLetter] = useState<TitleOptionLetter>("A");
  const [showNames, setShowNames] = useState(false);
  const [showFindings, setShowFindings] = useState(true);
  useEffect(() => {
    const readLocation = () => {
      const id = window.location.hash.slice(1);
      const title = new URLSearchParams(window.location.search).get("title");
      const match = data.cases.find(
        (item) => item.title === title || item.originalTitle === title,
      );
      setSelectedId(
        data.cases.some((item) => item.id === id)
          ? id
          : match?.id || data.cases[0]?.id || "",
      );
    };
    readLocation();
    window.addEventListener("hashchange", readLocation);
    window.addEventListener("popstate", readLocation);
    return () => {
      window.removeEventListener("hashchange", readLocation);
      window.removeEventListener("popstate", readLocation);
    };
  }, [data.cases]);
  const index = Math.max(
    0,
    data.cases.findIndex((item) => item.id === selectedId),
  );
  const item = data.cases[index];
  const models = new Map(data.models.map((model) => [model.id as string, model]));
  const choose = (id: string) => {
    if (!data.cases.some((candidate) => candidate.id === id)) return;
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("title");
    url.hash = id;
    window.history.pushState(null, "", url);
  };
  return (
    <>
      <Head>
        <title>Compare models and the judging agent | Ontology</title>
      </Head>
      <Container
        maxWidth="xl"
        sx={{ py: { xs: 2, sm: 4 }, overflowWrap: "anywhere", ...reviewInteractiveSurfaceSx }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
        >
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5}>
            <Button href="/review" sx={{ minHeight: 44 }}>
              Back to review
            </Button>
            <Button href="/title-prompt-study" sx={{ minHeight: 44 }}>
              Compare title prompts
            </Button>
          </Stack>
          <ThemeModeToggle />
        </Stack>
        <Typography
          component="h1"
          variant="h4"
          sx={{
            mt: 2,
            fontSize: { xs: "1.75rem", sm: "2.25rem" },
            fontWeight: 750,
          }}
        >
          Compare four models and the judging agent
        </Typography>
        <Typography sx={{ mt: 1.5, maxWidth: 850, lineHeight: 1.6 }}>
          The same {data.cases.length} examples, run with Rob’s very short
          prompt from September 15, with B(ii) corrected to “inadequate”. GPT-6
          Astra’s saved September 15 answers (Max reasoning) appear with
          answers from GPT-5.6 Sol, GPT-5.6 Terra, and GPT-5.4 Mini, run on
          September 16 with medium reasoning.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 850, lineHeight: 1.6 }}>
          {data.lettersNote}
        </Typography>
        <Alert
          severity="info"
          sx={{ mt: 2, "& .MuiAlert-message": { fontSize: "1rem", lineHeight: 1.6 } }}
        >
          These are saved proposals and automated findings for discussion. The
          judging agent reports possible problems. It does not approve, repair,
          or apply changes, and its findings are not expert judgments. Nothing
          here changes the ontology.
        </Alert>
        <Box
          role="group"
          aria-label="Display options"
          sx={{
            mt: 2,
            px: 2,
            py: 0.5,
            display: "flex",
            flexWrap: "wrap",
            columnGap: 4,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={showNames}
                onChange={(event) => setShowNames(event.target.checked)}
              />
            }
            label="Show model names"
            sx={{ minHeight: 44, mr: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showFindings}
                onChange={(event) => setShowFindings(event.target.checked)}
              />
            }
            label="Show judging agent findings"
            sx={{ minHeight: 44, mr: 0 }}
          />
        </Box>
        {showFindings && <JudgeOverview data={data} showNames={showNames} />}
        {item ? (
          <>
            <Stack
              component="nav"
              aria-label="Title examples"
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 3 }}
            >
              <TextField
                select
                label="Choose an example"
                value={item.id}
                onChange={(event) => choose(event.target.value)}
                SelectProps={{ native: true }}
                fullWidth
              >
                {data.cases.map((candidate, i) => (
                  <option key={candidate.id} value={candidate.id}>
                    {i + 1}. {candidate.title}
                  </option>
                ))}
              </TextField>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  disabled={index === 0}
                  onClick={() => choose(data.cases[index - 1].id)}
                  sx={{ minHeight: 44, whiteSpace: "nowrap", flex: { xs: 1, sm: "none" } }}
                >
                  Previous
                </Button>
                <Button
                  variant="outlined"
                  disabled={index === data.cases.length - 1}
                  onClick={() => choose(data.cases[index + 1].id)}
                  sx={{ minHeight: 44, whiteSpace: "nowrap", flex: { xs: 1, sm: "none" } }}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              gap={1}
              alignItems="center"
              sx={{ mt: 1.5 }}
            >
              <Chip
                label={`${index + 1} of ${data.cases.length} examples`}
                variant="outlined"
              />
              <Button href={`#${item.id}`} sx={{ minHeight: 44 }}>
                Link to this example
              </Button>
            </Stack>
            <ComparisonExample
              key={item.id}
              item={item}
              index={index}
              total={data.cases.length}
              models={models}
              showNames={showNames}
              showFindings={showFindings}
              mobileLetter={mobileLetter}
              setMobileLetter={setMobileLetter}
            />
          </>
        ) : (
          <Alert severity="info" sx={{ mt: 3 }}>
            No comparison examples are available.
          </Alert>
        )}
        <PromptDisclosures data={data} />
      </Container>
    </>
  );
}
