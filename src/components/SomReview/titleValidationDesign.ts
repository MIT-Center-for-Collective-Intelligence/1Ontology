import { alpha, createTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/system";

const systemFont =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Apply with a ThemeProvider around this page only. */
function createReviewTheme(mode: "light" | "dark") {
  const dark = mode === "dark";
  const ink = dark ? "#EDF5F1" : "#243330";
  const teal = dark ? "#83D6C6" : "#176B63";
  const border = dark ? "#40544C" : "#D9E0DC";
  const paper = dark ? "#1C2825" : "#FFFFFF";
  const focusRing = alpha(teal, 0.24);
  return createTheme({
    palette: {
      mode,
      primary: {
        main: teal,
        dark: dark ? "#58BBA9" : "#10534D",
        contrastText: dark ? "#102520" : "#FFFFFF",
      },
      background: { default: dark ? "#111918" : "#F7F6F2", paper },
      text: { primary: ink, secondary: dark ? "#B5C8C0" : "#586762" },
      divider: border,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: systemFont,
      body1: { fontSize: "1rem", lineHeight: 1.65 },
      body2: { fontSize: "0.875rem", lineHeight: 1.6 },
      h4: { fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.025em" },
      h5: { fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em" },
      h6: { fontWeight: 650, lineHeight: 1.35 },
      subtitle2: { fontWeight: 700, letterSpacing: "0.01em" },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 8,
            fontWeight: 650,
            textTransform: "none",
            paddingInline: 18,
            "&.Mui-focusVisible": {
              outline: `3px solid ${teal}`,
              outlineOffset: 3,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderColor: border,
            boxShadow: dark ? "none" : "0 2px 16px rgba(36, 51, 48, 0.035)",
          },
        },
      },
      MuiAccordion: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${border}`,
            borderRadius: "12px !important",
            backgroundImage: "none",
            "&::before": { display: "none" },
          },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            minHeight: 52,
            "&.Mui-focusVisible": {
              outline: `3px solid ${teal}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: paper,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: dark ? "#8DA99D" : "#7D9187",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: dark ? teal : "#738C82",
            },
            "&.Mui-focused": { boxShadow: `0 0 0 3px ${focusRing}` },
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: { root: { minHeight: 44 } },
      },
      MuiRadio: {
        styleOverrides: {
          root: {
            color: dark ? "#A6BDB2" : "#64746D",
            "&.Mui-checked": { color: teal },
            "&.Mui-focusVisible": {
              outline: `3px solid ${teal}`,
              outlineOffset: 1,
            },
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: dark ? "#A6BDB2" : "#64746D",
            "&.Mui-checked": { color: teal },
            "&.Mui-focusVisible": {
              outline: `3px solid ${teal}`,
              outlineOffset: 1,
            },
          },
        },
      },
    },
  });
}
export const titleValidationTheme = createReviewTheme("light");
export const darkTitleValidationTheme = createReviewTheme("dark");

type StyleKey =
  | "page"
  | "container"
  | "masthead"
  | "workCard"
  | "evidence"
  | "formSection"
  | "optionCard"
  | "confidenceGroup"
  | "saveBar"
  | "dashboard"
  | "heading";

export const titleValidationStyles: Record<StyleKey, SxProps<Theme>> = {
  page: {
    minHeight: "100vh",
    bgcolor: "background.default",
    color: "text.primary",
    px: { xs: 2, sm: 3, lg: 5 },
    py: { xs: 3, sm: 5, lg: 7 },
    scrollPaddingBottom: 24,
  },
  container: {
    width: "100%",
    maxWidth: 1240,
    mx: "auto",
  },
  masthead: {
    mb: { xs: 3, md: 4 },
    pb: { xs: 2.5, md: 3 },
    borderBottom: 1,
    borderColor: "divider",
    display: "flex",
    flexDirection: { xs: "column", md: "row" },
    justifyContent: "space-between",
    alignItems: { xs: "flex-start", md: "flex-end" },
    gap: 2,
  },
  workCard: {
    bgcolor: "background.paper",
    border: 1,
    borderColor: "divider",
    borderRadius: 3,
    overflow: "visible",
    "& .MuiCardContent-root": {
      p: { xs: 2.5, sm: 4, lg: 5 },
      "&:last-child": { pb: { xs: 2.5, sm: 4, lg: 5 } },
    },
  },
  evidence: {
    bgcolor: ({ palette }) => (palette.mode === "dark" ? "#16211E" : "#FBFCFA"),
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    p: { xs: 2.5, sm: 3 },
    minWidth: 0,
    overflowWrap: "anywhere",
    "& .MuiTypography-root": { maxWidth: "72ch" },
  },
  formSection: {
    minWidth: 0,
    pt: 3,
    borderTop: 1,
    borderColor: "divider",
    "& .MuiFormLabel-root": { color: "text.primary", fontWeight: 650, mb: 1 },
  },
  optionCard: {
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
    p: { xs: 2.5, sm: 3 },
    minWidth: 0,
    overflowWrap: "anywhere",
    "&:focus-within": {
      boxShadow: ({ palette }) =>
        `0 0 0 3px ${alpha(palette.primary.main, 0.24)}`,
    },
  },
  confidenceGroup: {
    "& .MuiRadioGroup-root": { display: "flex", flexWrap: "wrap", gap: 1 },
    "& .MuiFormControlLabel-root": {
      m: 0,
      minWidth: 56,
      pr: 1.5,
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      '&[data-selected="true"]': {
        borderColor: "primary.main",
        bgcolor: ({ palette }) =>
          palette.mode === "dark" ? "#25463C" : "#EDF5F1",
      },
    },
  },
  saveBar: {
    mt: 1,
    pt: 3,
    borderTop: 1,
    borderColor: "divider",
    display: "flex",
    flexDirection: { xs: "column", sm: "row" },
    alignItems: { xs: "stretch", sm: "center" },
    gap: 1.5,
    "& .MuiButton-root": { width: { xs: "100%", sm: "auto" } },
  },
  dashboard: {
    mt: 4,
    bgcolor: "background.paper",
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    "& .MuiAccordionDetails-root": { p: { xs: 2.5, sm: 3 } },
  },
  heading: {
    color: "text.primary",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
    fontSize: { xs: "1.75rem", sm: "2.125rem" },
  },
};
