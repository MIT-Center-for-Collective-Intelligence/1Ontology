/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ThemeProvider,
  createTheme,
  getContrastRatio,
  useTheme,
} from "@mui/material/styles";
import ReviewTheme from "../../../src/components/SomReview/ReviewTheme";
import {
  titleValidationTheme,
  darkTitleValidationTheme,
} from "../../../src/components/SomReview/titleValidationDesign";

function Probe() {
  const theme = useTheme();
  return (
    <p>
      {theme.palette.mode}:{theme.palette.background.paper}
    </p>
  );
}
test("review surfaces follow a profile's mode and retain their scoped design", () => {
  const view = render(
    <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
      <ReviewTheme>
        <Probe />
      </ReviewTheme>
    </ThemeProvider>,
  );
  expect(screen.getByText("dark:#1C2825")).toBeVisible();
  view.rerender(
    <ThemeProvider theme={createTheme({ palette: { mode: "light" } })}>
      <ReviewTheme>
        <Probe />
      </ReviewTheme>
    </ThemeProvider>,
  );
  expect(screen.getByText("light:#FFFFFF")).toBeVisible();
});
test.each([titleValidationTheme, darkTitleValidationTheme])(
  "review text and button labels have readable contrast in $palette.mode mode",
  (theme) => {
    for (const background of [
      theme.palette.background.default,
      theme.palette.background.paper,
    ]) {
      expect(
        getContrastRatio(theme.palette.text.primary, background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(theme.palette.text.secondary, background),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      getContrastRatio(
        theme.palette.primary.main,
        theme.palette.primary.contrastText,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  },
);
