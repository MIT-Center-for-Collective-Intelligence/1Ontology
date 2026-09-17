/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Page, { getStaticProps } from "../../../src/pages/title-model-comparison";

const mockReplace = jest.fn();
let mockAuthenticated = true;
jest.mock("next/router", () => ({
  useRouter: () => ({ replace: mockReplace, asPath: "/title-model-comparison" }),
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
  window.history.replaceState(null, "", "/title-model-comparison");
});

it("passes the archived comparison and judgments through the real authentication wrapper", () => {
  const { props } = getStaticProps();
  const { container } = render(<Page {...props} />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Compare four models and the judging agent" }),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Choose an example").querySelectorAll("option"),
  ).toHaveLength(18);
  expect(
    screen.getByRole("heading", { level: 2, name: "Review Programming" }),
  ).toBeInTheDocument();
  for (const letter of ["A", "B", "C", "D"])
    expect(screen.getByTestId(`model-option-${letter}`)).toBeInTheDocument();
  const total = ["prompt-violation", "major", "minor", "no-issues", "unavailable"]
    .map((key) => Number(screen.getByTestId(`verdict-count-${key}`).firstChild?.textContent))
    .reduce((sum, count) => sum + count, 0);
  expect(total).toBe(72);

  fireEvent.click(screen.getByLabelText("Show model names"));
  const table = screen.getByRole("table", { name: "Judging agent findings by model" });
  expect(within(table).getAllByRole("row")).toHaveLength(5);
  expect(
    screen.queryAllByRole("button", { name: /agree|apply|submit|save|approve/i }),
  ).toHaveLength(0);
  expect(container.textContent).not.toMatch(/SHA-256|[a-f0-9]{64}|requestId|attempt/i);
  expect(mockReplace).not.toHaveBeenCalled();
});

it("preserves the existing sign-in redirect", () => {
  mockAuthenticated = false;
  render(<Page {...getStaticProps().props} />);
  expect(mockReplace).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: "/signin",
      query: { from: "/title-model-comparison" },
    }),
  );
});

it("opens a review-card link using the original title including its synonym annotation", () => {
  window.history.replaceState(
    null,
    "",
    "/title-model-comparison?title=" +
      encodeURIComponent("Measure Equipment (Synonyms: Evaluate Equipment)"),
  );
  render(<Page {...getStaticProps().props} />);
  expect(
    screen.getByRole("heading", { name: "Measure Equipment", level: 2 }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Choose an example")).toHaveValue("case-5");
});
