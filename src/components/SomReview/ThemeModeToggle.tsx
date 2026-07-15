import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

import { useThemeManager } from "../../lib/hooks/useThemeManager";

const ThemeModeToggle = () => {
  const { isDark, handleThemeSwitch, isAuthLoading } = useThemeManager();
  const label = isDark ? "Use light mode" : "Use dark mode";

  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          disabled={isAuthLoading}
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
          {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default ThemeModeToggle;
