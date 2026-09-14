/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Page, { getStaticProps } from "../../../src/pages/title-prompt-study";

const mockReplace = jest.fn();
let mockAuthenticated = true;
jest.mock("next/router", () => ({
  useRouter: () => ({ replace: mockReplace, asPath: "/title-prompt-study" }),
}));
jest.mock("../../../src/components/context/AuthContext", () => ({
  useAuth: () => [
    { isAuthenticated: mockAuthenticated, isAuthInitialized: true },
  ],
}));
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => (
  <button>Theme</button>
));
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockAuthenticated = true;
  window.history.replaceState(null, "", "/title-prompt-study");
});

it("passes the archived comparison through the real authentication wrapper", () => {
  const { props } = getStaticProps();
  render(<Page {...props} />);
  expect(
    screen.getByRole("heading", {
      name: "Compare title-clarification results",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Choose a title").querySelectorAll("option"),
  ).toHaveLength(18);
  expect(
    screen.getByRole("heading", {
      name: "Review Programming Compliance and Quality",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Review Broadcast Programming" }),
  ).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("preserves the existing sign-in redirect", () => {
  mockAuthenticated = false;
  render(<Page {...getStaticProps().props} />);
  expect(mockReplace).toHaveBeenCalledWith(
    expect.objectContaining({ query: { from: "/title-prompt-study" } }),
  );
});

it("opens a review-card link using the original title including its synonym annotation", () => {
  window.history.replaceState(
    null,
    "",
    "/title-prompt-study?title=" +
      encodeURIComponent("Measure Equipment (Synonyms: Evaluate Equipment)"),
  );
  render(<Page {...getStaticProps().props} />);
  expect(
    screen.getByRole("heading", { name: "Measure Equipment", level: 2 }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Choose a title")).toHaveValue("case-5");
});
