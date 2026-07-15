/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ThemeModeToggle from "../../../src/components/SomReview/ThemeModeToggle";
import { useThemeManager } from "../../../src/lib/hooks/useThemeManager";

jest.mock("../../../src/lib/hooks/useThemeManager", () => ({
  useThemeManager: jest.fn(),
}));

const mockedUseThemeManager = useThemeManager as jest.MockedFunction<
  typeof useThemeManager
>;

describe("Society of Mind theme switch", () => {
  it("offers light mode while the app is dark", () => {
    const handleThemeSwitch = jest.fn();
    mockedUseThemeManager.mockReturnValue({
      isDark: true,
      handleThemeSwitch,
      isAuthenticated: true,
      isAuthLoading: false,
    });
    render(<ThemeModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Use light mode" }));
    expect(handleThemeSwitch).toHaveBeenCalledTimes(1);
  });

  it("offers dark mode while the app is light", () => {
    mockedUseThemeManager.mockReturnValue({
      isDark: false,
      handleThemeSwitch: jest.fn(),
      isAuthenticated: true,
      isAuthLoading: false,
    });
    render(<ThemeModeToggle />);
    expect(screen.getByRole("button", { name: "Use dark mode" })).toBeEnabled();
  });
});
