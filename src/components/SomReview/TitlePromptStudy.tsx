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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ThemeModeToggle from "./ThemeModeToggle";
import AgentTracePanel from "./AgentTracePanel";
import type {
  TitlePromptCase,
  TitlePromptGroup,
  TitlePromptStudyData,
} from "../../types/ITitlePromptStudy";
export type { TitlePromptStudyData } from "../../types/ITitlePromptStudy";

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

function GroupColumn({
  label,
  groups,
  reason,
  selected,
  onlySelected,
  onSelect,
}: {
  label: string;
  groups: TitlePromptGroup[];
  reason: string;
  selected: number;
  onlySelected: boolean;
  onSelect: (number: number) => void;
}) {
  const visible = onlySelected
    ? groups.filter((group) => group.descriptionNumbers.includes(selected))
    : groups;
  return (
    <Box component="section" aria-label={label} sx={{ minWidth: 0 }}>
      <Typography component="h3" variant="h6">
        {label}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1.5 }}>
        {groups.length} proposed {groups.length === 1 ? "group" : "groups"}
      </Typography>
      {reason && (
        <Box component="details" sx={disclosureSx}>
          <summary>Why these titles?</summary>
          <Typography>{reason}</Typography>
        </Box>
      )}
      {onlySelected && (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          {visible.length} groups containing description #{selected}
        </Typography>
      )}
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {visible.map((group, index) => (
          <Paper
            key={index}
            variant="outlined"
            sx={{
              p: 1.5,
              borderColor: group.descriptionNumbers.includes(selected)
                ? "primary.main"
                : "divider",
              borderWidth: group.descriptionNumbers.includes(selected) ? 2 : 1,
            }}
          >
            <Typography
              component="h4"
              sx={{ fontWeight: 750, lineHeight: 1.45 }}
            >
              {group.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {group.descriptionNumbers.length}{" "}
              {group.descriptionNumbers.length === 1
                ? "description"
                : "descriptions"}
            </Typography>
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={0.5}
              sx={{ mt: 1 }}
            >
              {group.descriptionNumbers.map((number, position) => (
                <Button
                  key={`${number}-${position}`}
                  size="small"
                  aria-label={`${label}: show description ${number}`}
                  aria-pressed={selected === number}
                  variant={selected === number ? "contained" : "outlined"}
                  disableElevation
                  onClick={() => onSelect(number)}
                  sx={{ minWidth: 44, minHeight: 44, px: 1 }}
                >
                  #{number}
                </Button>
              ))}
            </Stack>
            {group.reason && (
              <Box component="details" sx={disclosureSx}>
                <summary>Explanation</summary>
                <Typography>{group.reason}</Typography>
              </Box>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

function StudyTrace({
  item,
  data,
}: {
  item: TitlePromptCase;
  data: TitlePromptStudyData;
}) {
  return (
    <Box component="details" data-testid="prompt-study-trace" sx={disclosureSx}>
      <summary>Agents and prompts used for this proposal</summary>
      <Typography>
        {data.model} · model version {data.modelVersion} · reasoning:{" "}
        {data.reasoning}
      </Typography>
      <Typography sx={{ mt: 0.5 }}>{data.funding}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        Source: the numbered O*NET descriptions shown above.
      </Typography>
      <Typography component="h4" variant="h6" sx={{ mt: 2 }}>
        Exact model prompt
      </Typography>
      <Box component="pre" sx={textSx}>
        {data.prompt}
      </Box>
      <Box component="details" sx={disclosureSx}>
        <summary>Formatting instructions and software checks</summary>
        <Box component="pre" sx={textSx}>
          {data.outputFormat}
        </Box>
        <Typography>{data.softwareChecks}</Typography>
      </Box>
      <Box component="details" sx={disclosureSx}>
        <summary>Original input and answer</summary>
        <Typography component="h4" sx={{ fontWeight: 650 }}>
          Input
        </Typography>
        <Box component="pre" sx={textSx}>
          {item.input}
        </Box>
        <Typography component="h4" sx={{ fontWeight: 650 }}>
          Answer
        </Typography>
        <Box component="pre" sx={textSx}>
          {item.rawOutput || "No answer returned."}
        </Box>
      </Box>
    </Box>
  );
}

function ComparisonExample({
  item,
  data,
  index,
}: {
  item: TitlePromptCase;
  data: TitlePromptStudyData;
  index: number;
}) {
  const [selected, setSelected] = useState(item.descriptions[0]?.number || 1);
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [mobileVersion, setMobileVersion] = useState("previous");
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  const source = item.descriptions.find(
    (description) => description.number === selected,
  );
  const matching = item.descriptions.filter(
    (description) =>
      !search.trim() ||
      description.text.toLowerCase().includes(search.trim().toLowerCase()) ||
      String(description.number) === search.trim().replace(/^#/, ""),
  );
  const selectEvidence = (number: number) => {
    setSelected(number);
    evidenceHeading.current?.focus({ preventScroll: true });
    evidenceHeading.current?.scrollIntoView?.({
      block: "start",
      behavior: "smooth",
    });
  };
  return (
    <Paper
      component="article"
      id={item.id}
      aria-labelledby={`${item.id}-heading`}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, mt: 3, scrollMarginTop: 24 }}
    >
      <Typography color="text.secondary">
        Example {index + 1} of {data.cases.length} · {item.descriptions.length}{" "}
        O*NET {item.descriptions.length === 1 ? "description" : "descriptions"}
      </Typography>
      <Typography
        component="h2"
        variant="h5"
        id={`${item.id}-heading`}
        sx={{ mt: 1 }}
      >
        {item.title}
      </Typography>
      {item.comparisonIssue && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {item.comparisonIssue}
        </Alert>
      )}
      <Box
        component="section"
        aria-label="Shared O*NET evidence"
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
            The same evidence in both versions
          </Typography>
          <TextField
            select
            label="Description number"
            value={source ? selected : ""}
            size="small"
            SelectProps={{ native: true }}
            onChange={(event) => setSelected(Number(event.target.value))}
            sx={{ minWidth: 150 }}
          >
            {!source && <option value="">Choose a description</option>}
            {item.descriptions.map((description) => (
              <option key={description.number} value={description.number}>
                #{description.number} of {item.descriptions.length}
              </option>
            ))}
          </TextField>
        </Stack>
        <Typography
          sx={{ mt: 2, lineHeight: 1.7 }}
          data-testid="selected-description"
        >
          {source ? (
            <>
              <strong>#{source.number}.</strong> {source.text}
            </>
          ) : (
            "This number is not in the source descriptions. The original answer is preserved below."
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Choose a description number to see where each version places it.
          Highlighted groups contain that description.
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
            mt: 2,
          }}
          aria-live="polite"
        >
          {[
            { label: "Previous prompt", groups: item.previous?.groups },
            {
              label: "Rob’s new prompt",
              groups: item.status === "completed" ? item.groups : undefined,
            },
          ].map((version) => {
            const containing = version.groups?.filter((group) =>
              group.descriptionNumbers.includes(selected),
            );
            return (
              <Paper key={version.label} variant="outlined" sx={{ p: 1.5 }}>
                <Typography sx={{ fontWeight: 750 }}>
                  {version.label}: description #{selected}
                </Typography>
                {containing?.length ? (
                  containing.map((group, i) => (
                    <Typography key={i}>{group.title}</Typography>
                  ))
                ) : (
                  <Typography>
                    {version.groups
                      ? "No group includes this description."
                      : "Result unavailable."}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
        <Box component="details" sx={disclosureSx}>
          <summary>Browse all {item.descriptions.length} descriptions</summary>
          <TextField
            fullWidth
            label="Find a description by wording or number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            sx={{ my: 1 }}
          />
          <Typography variant="body2" role="status">
            {matching.length} of {item.descriptions.length} descriptions shown
          </Typography>
          <Box component="ol" sx={{ pl: 3, maxHeight: 420, overflowY: "auto" }}>
            {matching.map((description) => (
              <Box
                component="li"
                key={description.number}
                value={description.number}
                sx={{ mb: 1.5 }}
              >
                <Typography component="span" sx={{ lineHeight: 1.6 }}>
                  {description.text}
                </Typography>{" "}
                <Button
                  onClick={() => selectEvidence(description.number)}
                  size="small"
                  sx={{ minHeight: 44 }}
                >
                  Compare #{description.number}
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={onlySelected}
            onChange={(event) => setOnlySelected(event.target.checked)}
          />
        }
        label={`Show only groups containing description #${selected}`}
        sx={{ mb: 2 }}
      />
      <ToggleButtonGroup
        exclusive
        value={mobileVersion}
        onChange={(_, value) => value && setMobileVersion(value)}
        aria-label="Prompt version on small screens"
        sx={{ display: { xs: "flex", md: "none" }, mb: 2 }}
      >
        <ToggleButton value="previous" sx={{ flex: 1 }}>
          Previous prompt
        </ToggleButton>
        <ToggleButton value="new" sx={{ flex: 1 }}>
          Rob’s new prompt
        </ToggleButton>
      </ToggleButtonGroup>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
          },
          gap: { xs: 3, md: 4 },
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            display: {
              xs: mobileVersion === "previous" ? "block" : "none",
              md: "block",
            },
          }}
        >
          {item.previous ? (
            <GroupColumn
              label="Previous prompt"
              groups={item.previous.groups}
              reason={item.previous.reason}
              selected={selected}
              onlySelected={onlySelected}
              onSelect={selectEvidence}
            />
          ) : (
            <Alert severity="info">
              Previous results are unavailable for this example.
            </Alert>
          )}
          {item.previous && <AgentTracePanel trace={item.previous.trace} />}
        </Box>
        <Box
          sx={{
            minWidth: 0,
            display: {
              xs: mobileVersion === "new" ? "block" : "none",
              md: "block",
            },
          }}
        >
          {item.status === "completed" ? (
            <GroupColumn
              label="Rob’s new prompt"
              groups={item.groups}
              reason={item.reason}
              selected={selected}
              onlySelected={onlySelected}
              onSelect={selectEvidence}
            />
          ) : (
            <Alert severity="warning">
              This request did not produce a complete result. No proposal is
              inferred from it.
            </Alert>
          )}
          {item.observations.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Box
                component="details"
                sx={{
                  "& > summary": {
                    cursor: "pointer",
                    fontWeight: 650,
                    py: 0.5,
                  },
                }}
              >
                <summary>
                  {item.observations.length}{" "}
                  {item.observations.length === 1 ? "point" : "points"} to check
                </summary>
                <Box component="ul" sx={{ pl: 2.5, mb: 1 }}>
                  {item.observations.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </Box>
                These automated checks do not decide whether the proposal makes
                sense.
              </Box>
            </Alert>
          )}
          <StudyTrace item={item} data={data} />
        </Box>
      </Box>
    </Paper>
  );
}

export default function TitlePromptStudy({
  data,
}: {
  data: TitlePromptStudyData;
}) {
  const [selectedId, setSelectedId] = useState(data.cases[0]?.id || "");
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
        <title>Compare title prompts | Ontology</title>
      </Head>
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 2, sm: 4 }, overflowWrap: "anywhere" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap={2}
        >
          <Button href="/review?dataset=ontology-title-testbed">
            Back to review
          </Button>
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
          Compare title-clarification results
        </Typography>
        <Typography sx={{ mt: 1.5, maxWidth: 850 }}>
          Compare the previous prompt with Rob’s new wording on the same 18
          examples. Look for clear titles, useful distinctions, and descriptions
          that belong together.
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          These are saved proposals for discussion. Comparing them does not
          change the ontology or your earlier responses.
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          The previous run used GPT-5.6 Sol; Rob’s wording used GPT-6 Astra.
          Both the prompt and model changed, so this comparison cannot isolate
          the effect of the prompt. Results shown are from the saved 2 and 13
          September runs.
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          useFlexGap
          flexWrap="wrap"
          gap={1}
          sx={{ mt: 2 }}
        >
          <Button
            variant="outlined"
            href={data.collaborationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Discuss the prompts in Google Docs
          </Button>
          <Button href="/review?dataset=ontology-title-testbed">
            Open the original review round
          </Button>
        </Stack>
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
                label="Choose a title"
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
                  sx={{ minHeight: 44, whiteSpace: "nowrap" }}
                >
                  Previous
                </Button>
                <Button
                  variant="outlined"
                  disabled={index === data.cases.length - 1}
                  onClick={() => choose(data.cases[index + 1].id)}
                  sx={{ minHeight: 44, whiteSpace: "nowrap" }}
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
              data={data}
              index={index}
            />
          </>
        ) : (
          <Alert severity="info" sx={{ mt: 3 }}>
            No comparison examples are available.
          </Alert>
        )}
      </Container>
    </>
  );
}
