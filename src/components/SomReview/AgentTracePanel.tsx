import React, { useId, useMemo, useState } from "react";
import { Box, Button, Chip, Collapse, Stack, Typography } from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import SearchIcon from "@mui/icons-material/Search";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";

import {
  SomAgentTrace,
  SomAgentTraceRole,
  SomAgentTraceStage,
} from "../../types/ISomReview";
import { reviewAccentColor } from "./reviewStyles";

const StageIcon = ({ role }: { role: SomAgentTraceRole }) => {
  if (role === "issue-detection") return <SearchIcon fontSize="small" />;
  if (role === "solution-generation")
    return <LightbulbOutlinedIcon fontSize="small" />;
  if (role === "proposal-generation")
    return <ArticleOutlinedIcon fontSize="small" />;
  if (role === "content-verification")
    return <VerifiedOutlinedIcon fontSize="small" />;
  return <FactCheckOutlinedIcon fontSize="small" />;
};

const PromptControl = ({
  stage,
  controlId,
  expanded,
  onToggle,
}: {
  stage: SomAgentTraceStage;
  controlId: string;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const controlLabel =
    stage.promptLabel === "Prompt unavailable"
      ? "prompt status"
      : stage.promptLabel.toLowerCase();
  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controlId}
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: (theme) =>
                theme.transitions.create("transform", {
                  duration: theme.transitions.duration.shortest,
                }),
            }}
          />
        }
        sx={{ minHeight: 36, px: 0.75, fontWeight: 700 }}
      >
        {expanded ? `Hide ${controlLabel}` : `View ${controlLabel}`}
      </Button>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box id={controlId} sx={{ mt: 1.25 }}>
          <Typography
            sx={{
              mb: 0.75,
              color: "text.secondary",
              fontSize: "0.78rem",
              fontWeight: 700,
            }}
          >
            Version: {stage.promptVersion}
          </Typography>
          {stage.promptDisclosureNote && (
            <Typography
              sx={{
                mb: 1,
                color: "text.secondary",
                fontSize: "0.8rem",
                lineHeight: 1.45,
              }}
            >
              {stage.promptDisclosureNote}
            </Typography>
          )}
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              backgroundColor: "background.default",
              color: "text.primary",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: "0.8rem",
              lineHeight: 1.55,
            }}
          >
            {stage.prompt}
          </Box>
        </Box>
      </Collapse>
    </>
  );
};

const AgentTracePanel = ({
  trace,
  prominent = false,
}: {
  trace: SomAgentTrace;
  prominent?: boolean;
}) => {
  const instanceId = useId().replace(/[^a-z0-9_-]/gi, "-");
  const traceContentId = `agent-trace-content-${instanceId}`;
  const [expanded, setExpanded] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    () => new Set(),
  );
  const sharedExecutionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const stage of trace.stages) {
      if (!stage.sharedExecutionId) continue;
      counts.set(
        stage.sharedExecutionId,
        (counts.get(stage.sharedExecutionId) || 0) + 1,
      );
    }
    return counts;
  }, [trace.stages]);

  const togglePrompt = (stageId: string) => {
    setExpandedPrompts((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  return (
    <Box
      sx={{
        mt: prominent ? 0 : 3,
        mb: prominent ? 3 : 0,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Button
        fullWidth
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={traceContentId}
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: (theme) =>
                theme.transitions.create("transform", {
                  duration: theme.transitions.duration.shortest,
                }),
            }}
          />
        }
        sx={{
          justifyContent: "space-between",
          py: 1.5,
          px: 0,
          color: "text.primary",
          textAlign: "left",
          "& .MuiButton-endIcon": { ml: 2 },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 750, lineHeight: 1.35 }}>
            {trace.title}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              color: "text.secondary",
              fontSize: "0.85rem",
              fontWeight: 400,
              lineHeight: 1.45,
            }}
          >
            {trace.summary}
          </Typography>
        </Box>
      </Button>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box id={traceContentId} sx={{ pb: 1.5 }}>
          <Typography
            sx={{
              pb: 1.5,
              color: "text.secondary",
              fontSize: "0.82rem",
              lineHeight: 1.5,
            }}
          >
            {trace.runtimeInputNote}
          </Typography>

          {trace.stages.map((stage, index) => {
            const stageKey = `${stage.id}:${index}`;
            const promptExpanded = expandedPrompts.has(stageKey);
            const shared =
              stage.sharedExecutionId &&
              (sharedExecutionCounts.get(stage.sharedExecutionId) || 0) > 1;
            return (
              <Box
                key={stageKey}
                sx={{
                  py: 1.75,
                  borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "flex-start", sm: "flex-start" }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      mt: { sm: 0.15 },
                      width: 32,
                      height: 32,
                      flex: "0 0 32px",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      color: reviewAccentColor,
                      backgroundColor: (theme) => theme.palette.action.hover,
                    }}
                  >
                    <StageIcon role={stage.role} />
                  </Box>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={{ xs: 0.4, md: 1 }}
                      alignItems={{ xs: "flex-start", md: "baseline" }}
                    >
                      <Typography sx={{ fontWeight: 750, lineHeight: 1.4 }}>
                        {stage.sequence}. {stage.roleLabel}
                      </Typography>
                      <Typography
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.82rem",
                          lineHeight: 1.4,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {stage.actorName} ({stage.actorId})
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mt: 0.75 }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        label={stage.actorKindLabel}
                        sx={{ height: 26, borderRadius: 1 }}
                      />
                      {shared && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label="Shared execution"
                          sx={{ height: 26, borderRadius: 1 }}
                        />
                      )}
                    </Stack>

                    <Typography
                      sx={{ mt: 1, fontSize: "0.9rem", lineHeight: 1.5 }}
                    >
                      {stage.summary}
                    </Typography>
                    {stage.sharedExecutionNote && (
                      <Typography
                        sx={{
                          mt: 0.75,
                          color: "text.secondary",
                          fontSize: "0.82rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {stage.sharedExecutionNote}
                      </Typography>
                    )}
                    <PromptControl
                      stage={stage}
                      controlId={`agent-prompt-${instanceId}-${stage.id.replace(
                        /[^a-z0-9_-]/gi,
                        "-",
                      )}-${index}`}
                      expanded={promptExpanded}
                      onToggle={() => togglePrompt(stageKey)}
                    />
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default AgentTracePanel;
