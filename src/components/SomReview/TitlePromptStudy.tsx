import React from "react";
import Head from "next/head";
import { Alert, Box, Button, Container, Link, Paper, Stack, Typography } from "@mui/material";
import ThemeModeToggle from "./ThemeModeToggle";

export interface TitlePromptStudyData {
  version: string;
  label: string;
  explanation: string;
  prompt: string;
  outputFormat: string;
  outputSchema?: object;
  softwareChecks: string;
  promptSha256: string;
  sourceSha256: string;
  sourceFile?: string;
  collaborationUrl: string;
  model: string;
  modelVersion: string;
  reasoning: string;
  deployment: string;
  funding: string;
  costs: { knownUsd: number; unknownReservedUsd: number; attempts: number; totalTokens: number; asOf?: string };
  cases: Array<{
    id: string;
    title: string;
    semanticCaseId?: string;
    occurrenceIds?: string[];
    input: string;
    descriptions: Array<{ number: number; text: string; oNetId?: string }>;
    groups: Array<{ title: string; descriptionNumbers: number[]; reason: string }>;
    reason: string;
    observations: string[];
    rawOutput: string;
    status: string;
    requestedAt: string;
    attemptId: string;
    inputSha256: string;
    outputSha256: string;
  }>;
}

const disclosureSx = {
  mt: 1.5,
  "& > summary": { cursor: "pointer", fontWeight: 600, py: 1 },
};
const textSx = { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: "0.95rem", lineHeight: 1.65 };

export default function TitlePromptStudy({ data }: { data: TitlePromptStudyData }) {
  return <>
    <Head><title>{data.label} | Ontology</title></Head>
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 }, overflowWrap: "anywhere" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Button href="/review?dataset=ontology-title-testbed">Back to the original 18-item review</Button>
        <ThemeModeToggle />
      </Stack>
      <Typography component="h1" variant="h4" sx={{ mt: 3, fontSize: { xs: "1.75rem", sm: "2.25rem" }, fontWeight: 700, lineHeight: 1.2 }}>{data.label}</Typography>
      <Typography sx={{ mt: 2 }}>{data.explanation}</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>
        Proposals for discussion. These examples do not establish accuracy.
        This page does not save judgments or change the ontology.
      </Alert>
      <Typography sx={{ mt: 2 }}>
        Review the proposed titles against their O*NET descriptions. Bring a concrete example to the shared document
        if a title or grouping needs a better instruction.
      </Typography>
      <Button sx={{ mt: 2 }} variant="outlined" href={data.collaborationUrl} target="_blank" rel="noopener noreferrer">
        Discuss the prompts in Google Docs
      </Button>
      <Box component="details" sx={disclosureSx}>
        <summary>Read Rob’s prompt</summary>
        <Box component="pre" sx={textSx}>{data.prompt}</Box>
      </Box>
      <Box component="nav" aria-label="Title examples" sx={{ my: 3 }}>
        <Typography component="h2" variant="h6">{data.cases.length} examples</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={1.5} sx={{ mt: 1 }}>
          {data.cases.map(item => <Link key={item.id} href={`#${item.id}`}>{item.title}</Link>)}
        </Stack>
      </Box>
      {data.cases.map((item, index) => <Paper component="article" key={item.id} id={item.id}
        aria-labelledby={`${item.id}-heading`} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3, scrollMarginTop: 24 }}>
        <Typography color="text.secondary">Example {index + 1} of {data.cases.length} · {item.descriptions.length} O*NET description{item.descriptions.length === 1 ? "" : "s"}</Typography>
        <Typography component="h2" variant="h5" id={`${item.id}-heading`} sx={{ mt: 1 }}>{item.title}</Typography>
        {item.status !== "completed" && <Alert severity="warning" sx={{ mt: 2 }}>This request did not produce a complete result. No proposal is inferred from it.</Alert>}
        {item.reason && <Typography sx={{ mt: 2 }}>{item.reason}</Typography>}
        {item.groups.length > 0 && <Typography sx={{ mt: 2.5, fontWeight: 600 }}>
          {item.groups.length === 1 ? "Proposed title" : `Proposed groups (${item.groups.length})`}
        </Typography>}
        {item.groups.map((group, groupIndex) => <Box key={groupIndex} sx={{ mt: 2.5 }}>
          <Typography component="h3" variant="h6">{group.title}</Typography>
          <Typography sx={{ mt: 0.5 }}>{group.reason}</Typography>
          <Box component="details" sx={disclosureSx}>
            <summary>O*NET descriptions for {group.title} ({group.descriptionNumbers.length})</summary>
            <Box component="ul" sx={{ pl: 2.5 }}>
              {group.descriptionNumbers.map((number, position) => <Box component="li" key={`${number}-${position}`} sx={{ mb: 1.5 }}>
                <strong>#{number}.</strong> {item.descriptions.find(source => source.number === number)?.text || "Unknown description number — inspect the original output below."}
              </Box>)}
            </Box>
          </Box>
        </Box>)}
        {item.observations.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>Questions to inspect</Typography>
          <Box component="ul" sx={{ pl: 2.5, mb: 0 }}>{item.observations.map((note, i) => <li key={i}>{note}</li>)}</Box>
          These checks do not decide whether the proposal makes sense.
        </Alert>}
        <Box component="details" sx={disclosureSx}>
          <summary>All original O*NET descriptions ({item.descriptions.length})</summary>
          <Box component="ol" sx={{ pl: 3 }}>{item.descriptions.map(source => <Box component="li" key={source.number} value={source.number} sx={{ mb: 1.5 }}>{source.text}
            {source.oNetId && <Typography variant="caption" component="div" color="text.secondary">O*NET record {source.oNetId}</Typography>}
          </Box>)}</Box>
        </Box>
        <Box component="details" data-testid="prompt-study-trace" sx={disclosureSx}>
          <summary>Agents and prompts used for this proposal</summary>
          <Typography>{data.model} · {data.modelVersion} · reasoning: {data.reasoning}</Typography>
          <Typography>{data.funding} · Azure deployment: {data.deployment}</Typography>
          <Typography>Requested: {item.requestedAt} · Status: {item.status}</Typography>
          <Typography component="h3" variant="h6" sx={{ mt: 2 }}>Exact model prompt</Typography>
          <Box component="pre" sx={textSx}>{data.prompt}</Box>
          <Typography component="h3" variant="h6">Separate output-format instructions</Typography>
          <Box component="pre" sx={textSx}>{data.outputFormat}</Box>
          {data.outputSchema && <Box component="details" sx={disclosureSx}>
            <summary>Exact structured output format</summary>
            <Box component="pre" sx={textSx}>{JSON.stringify(data.outputSchema, null, 2)}</Box>
          </Box>}
          <Typography component="h3" variant="h6">Exact case input</Typography>
          <Box component="pre" sx={textSx}>{item.input}</Box>
          <Typography component="h3" variant="h6">Original model answer</Typography>
          <Box component="pre" sx={textSx}>{item.rawOutput || "No answer returned."}</Box>
          <Typography component="h3" variant="h6">Software checks (ordinary code)</Typography>
          <Typography>{data.softwareChecks}</Typography>
          <Typography component="h3" variant="h6" sx={{ mt: 2 }}>Source provenance</Typography>
          <Box component="pre" sx={textSx}>{`Experiment: ${data.version}\nAttempt: ${item.attemptId}\nSource file: ${data.sourceFile || "See source archive"}\nTitle-evidence case: ${item.semanticCaseId || item.id}\nOntology occurrences: ${(item.occurrenceIds || []).join(", ")}\nOntology source SHA-256: ${data.sourceSha256}\nPrompt SHA-256: ${data.promptSha256}\nInput SHA-256: ${item.inputSha256}\nOutput SHA-256: ${item.outputSha256}`}</Box>
        </Box>
      </Paper>)}
      <Typography component="h2" variant="h6">Usage for this work</Typography>
      <Typography>{data.costs.attempts} ACCESS requests; {data.costs.totalTokens.toLocaleString()} metered tokens.
        Estimated inference cost: ${data.costs.knownUsd.toFixed(4)}; additional reservation for unknown usage: ${data.costs.unknownReservedUsd.toFixed(4)}.
        These totals include title generation, model-assisted checks, and failed or recovered requests.
        These are telemetry estimates, not invoices.</Typography>
      {data.costs.asOf && <Typography color="text.secondary">Usage snapshot: {data.costs.asOf}</Typography>}
      <Typography sx={{ mt: 1 }} color="text.secondary">Model choice, larger-scale review, WordNet alignment, and final ontology placement remain later decisions.</Typography>
    </Container>
  </>;
}
