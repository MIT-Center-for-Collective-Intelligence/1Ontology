import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import {
  titleValidationTheme,
  darkTitleValidationTheme,
} from "./titleValidationDesign";

/** Keep review styling scoped while following the platform's saved profile mode. */
export default function ReviewTheme({ children }: { children: ReactNode }) {
  const profileTheme = useTheme();
  return (
    <ThemeProvider
      theme={
        profileTheme.palette.mode === "dark"
          ? darkTitleValidationTheme
          : titleValidationTheme
      }
    >
      {children}
    </ThemeProvider>
  );
}
