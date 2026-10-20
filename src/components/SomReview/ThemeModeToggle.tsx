import React from "react";
import {
  Alert,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

import { useThemeManager } from "../../lib/hooks/useThemeManager";

const ThemeModeToggle = ({ showLabel = false }: { showLabel?: boolean }) => {
  const { isDark, handleThemeSwitch, isAuthLoading, isSaving, saveError } =
    useThemeManager();
  const label = isDark ? "Use light mode" : "Use dark mode";
  const icon = isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />;

  return (
    <Stack
      spacing={1}
      alignItems="flex-start"
      sx={{ flexShrink: 0, maxWidth: 340 }}
    >
      {showLabel ? (
        <Button
          variant="outlined"
          aria-label={label}
          disabled={isAuthLoading || isSaving}
          startIcon={icon}
          onClick={handleThemeSwitch}
        >
          {label}
        </Button>
      ) : (
        <Tooltip title={label}>
          <span>
            <IconButton
              aria-label={label}
              disabled={isAuthLoading || isSaving}
              onClick={handleThemeSwitch}
              sx={{
                width: 48,
                height: 48,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                backgroundColor: "background.paper",
                color: "text.primary",
                "&:hover": { backgroundColor: "action.hover" },
              }}
            >
              {icon}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {isSaving && (
        <Typography role="status" variant="caption">
          Saving appearance…
        </Typography>
      )}
      {saveError && <Alert severity="error">{saveError}</Alert>}
    </Stack>
  );
};

export default ThemeModeToggle;
