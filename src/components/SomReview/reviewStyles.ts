import { alpha, Theme } from "@mui/material/styles";
import { SystemStyleObject } from "@mui/system";

export const REVIEW_PRIMARY_ACTION_TEXT = "#1a1a1a";
export const REVIEW_PRIMARY_ACTION_HOVER = "#ff9f5c";
export const REVIEW_ACCENT_COLORS = {
  light: "#8a3500",
  dark: "#ffb47c",
} as const;

export const reviewAccentColor = (theme: Theme): string =>
  REVIEW_ACCENT_COLORS[theme.palette.mode];

export const reviewWarningTextColor = (theme: Theme): string =>
  theme.palette.mode === "dark" ? theme.palette.warning.main : "#7a3d00";

export const reviewInteractiveSurfaceSx: SystemStyleObject<Theme> = {
  "& .MuiButton-containedPrimary": {
    color: REVIEW_PRIMARY_ACTION_TEXT,
    "&:hover": {
      color: REVIEW_PRIMARY_ACTION_TEXT,
      backgroundColor: REVIEW_PRIMARY_ACTION_HOVER,
    },
  },
  "& .MuiButton-outlinedPrimary": {
    color: reviewAccentColor,
    borderColor: reviewAccentColor,
    "&:hover": {
      borderColor: reviewAccentColor,
      backgroundColor: (theme) => alpha(reviewAccentColor(theme), 0.08),
    },
  },
  "& .MuiButton-textPrimary": {
    color: reviewAccentColor,
    "&:hover": {
      backgroundColor: (theme) => alpha(reviewAccentColor(theme), 0.08),
    },
  },
  "& .MuiButtonBase-root:focus-visible": {
    outline: (theme) => `3px solid ${reviewAccentColor(theme)}`,
    outlineOffset: 3,
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: reviewAccentColor,
    borderWidth: 2,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: reviewAccentColor,
  },
  "& .MuiLinearProgress-barColorPrimary": {
    backgroundColor: reviewAccentColor,
  },
  "& .MuiCircularProgress-colorPrimary": {
    color: reviewAccentColor,
  },
  "& .MuiToggleButton-root.Mui-selected": {
    color: "text.primary",
    borderColor: reviewAccentColor,
    backgroundColor: (theme) =>
      alpha(
        reviewAccentColor(theme),
        theme.palette.mode === "dark" ? 0.2 : 0.1,
      ),
    "&:hover": {
      backgroundColor: (theme) =>
        alpha(
          reviewAccentColor(theme),
          theme.palette.mode === "dark" ? 0.28 : 0.16,
        ),
    },
  },
};

export type ReviewTone = "success" | "error" | "warning" | "info";

export const reviewToneChipSx = (
  tone: ReviewTone,
): SystemStyleObject<Theme> => ({
  color: "text.primary",
  fontWeight: 700,
  backgroundColor: (theme) =>
    alpha(theme.palette[tone].main, theme.palette.mode === "dark" ? 0.2 : 0.1),
});
