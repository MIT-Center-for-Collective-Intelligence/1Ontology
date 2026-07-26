import React from "react";
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { SomReviewWorkspaceOption } from "../../types/ISomReview";

const ReviewWorkspaceSwitcher = ({
  workspaces,
  workspaceId,
  datasetId,
  disabled = false,
  onChange,
}: {
  workspaces: SomReviewWorkspaceOption[];
  workspaceId: string;
  datasetId: string;
  disabled?: boolean;
  onChange: (datasetId: string) => void;
}) => {
  const workspace =
    workspaces.find((candidate) => candidate.id === workspaceId) ||
    workspaces[0];
  const selectedRound = workspace?.rounds.find(
    (round) => round.id === datasetId,
  );

  if (!workspace) return null;

  return (
    <Box
      component="section"
      aria-labelledby="review-workspace-heading"
      sx={{
        borderTop: 1,
        borderBottom: 1,
        borderColor: "divider",
        py: 2,
        mb: 3,
      }}
    >
      <Stack spacing={1.75}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography
              id="review-workspace-heading"
              component="h2"
              sx={{ fontSize: "1rem", fontWeight: 800 }}
            >
              Review workspace
            </Typography>
            <Typography
              sx={{ mt: 0.25, color: "text.secondary", lineHeight: 1.45 }}
            >
              Switch sub-ontology without mixing review progress.
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={workspace.id}
            aria-label="Sub-ontology"
            onChange={(_, nextWorkspaceId: string | null) => {
              if (!nextWorkspaceId || nextWorkspaceId === workspace.id) return;
              const nextWorkspace = workspaces.find(
                (candidate) => candidate.id === nextWorkspaceId,
              );
              if (nextWorkspace) onChange(nextWorkspace.activeDatasetId);
            }}
            sx={{
              alignSelf: { xs: "stretch", sm: "center" },
              "& .MuiToggleButton-root": {
                flex: { xs: 1, sm: "0 0 auto" },
                minWidth: { sm: 92 },
                minHeight: 42,
                px: 2,
                fontWeight: 750,
                letterSpacing: 0,
              },
            }}
          >
            {workspaces.map((candidate) => (
              <ToggleButton
                key={candidate.id}
                value={candidate.id}
                disabled={disabled}
                aria-label={`${candidate.label} sub-ontology`}
              >
                {candidate.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.25}
        >
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel id="review-round-label">Review round</InputLabel>
            <Select
              labelId="review-round-label"
              label="Review round"
              value={selectedRound?.id || workspace.activeDatasetId}
              disabled={disabled}
              onChange={(event) => onChange(String(event.target.value))}
            >
              {workspace.rounds.map((round) => (
                <MenuItem key={round.id} value={round.id}>
                  {round.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Chip
            label={selectedRound?.current ? "Current hierarchy" : "Past round"}
            color={selectedRound?.current ? "primary" : "default"}
            variant="outlined"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>
      </Stack>
    </Box>
  );
};

export default ReviewWorkspaceSwitcher;
