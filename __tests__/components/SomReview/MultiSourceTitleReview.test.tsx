/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MultiSourceReview } from "../../../src/pages/review/multi-source-title-review";
import type { MultiSourceSession } from "../../../src/lib/titleValidation/multiSourceContract";

jest.mock("../../../src/components/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock(
  "../../../src/components/hoc/withAuthUser",
  () => () => (Component: React.ComponentType) => Component,
);
jest.mock("../../../src/lib/firestoreClient/auth", () => ({
  getIdToken: async () => "review-token",
}));

const firstCase = {
  id: "a1",
  originalTitle: "Inspect equipment",
  reason: "",
  descriptions: [
    {
      number: 1,
      sourceId: "123",
      text: "Inspect production equipment for wear.",
    },
    {
      number: 2,
      sourceId: "456",
      text: "Examine rental equipment after return.",
    },
  ],
  groups: [
    {
      id: "g1",
      title: "Inspect production equipment",
      descriptionNumbers: [1, 2],
      reason: "",
    },
    {
      id: "g2",
      title: "Inspect returned equipment",
      descriptionNumbers: [2],
      reason: "",
    },
  ],
};
const secondCase = {
  ...firstCase,
  id: "a2",
  originalTitle: "Prepare equipment",
};
const session: MultiSourceSession = {
  version: "test-v1",
  reviewerLabel: "Test reviewer",
  cases: [firstCase, secondCase],
  reviews: {},
};
const answer = {
  titles: {
    g1: { rating: "acceptable", comment: "" },
    g2: { rating: "not_acceptable", comment: "" },
  },
  categorization: { rating: "unsure", comment: "Description 2 appears twice." },
  revision: 1,
  updatedAt: "2026-11-10T20:00:00Z",
} as const;
const mockFetch = jest.fn();
const reply = (data: object) => ({ ok: true, json: async () => data });
const radio = (group: string, label: string) =>
  within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", {
    name: label,
  });

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
});

test("requires and saves title judgments and categorization separately, with numbered source evidence", async () => {
  mockFetch
    .mockResolvedValueOnce(reply(session))
    .mockResolvedValueOnce(reply(answer));
  render(<MultiSourceReview />);
  await screen.findByText("Inspect production equipment for wear.");
  expect(screen.getByText("Assigned descriptions: 1, 2")).toBeInTheDocument();
  expect(screen.getByText("Assigned descriptions: 2")).toBeInTheDocument();
  fireEvent.click(radio("Title quality for group 1", "Acceptable"));
  fireEvent.click(radio("Title quality for group 2", "Not acceptable"));
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  expect(
    screen.getByText(
      "Choose a rating for every proposed title and for categorization.",
    ),
  ).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  fireEvent.click(radio("Categorization of descriptions", "I’m not sure"));
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "Categorization of descriptions notes (optional)",
    }),
    {
      target: { value: "Description 2 appears twice." },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  await screen.findByText("Review saved.");
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFetch.mock.calls[1][0]).toBe(
    "/api/som-review/multi-source-title-review",
  );
  expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer review-token",
  );
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
    version: session.version,
    caseId: firstCase.id,
    titles: answer.titles,
    categorization: answer.categorization,
    expectedRevision: 0,
  });
  expect(screen.getByText(/1 of 2 activities reviewed/)).toBeInTheDocument();
});

test("restores a prior review and confirms before discarding an edited case", async () => {
  mockFetch.mockResolvedValueOnce(
    reply({ ...session, reviews: { a1: answer } }),
  );
  const confirm = jest
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  try {
    render(<MultiSourceReview />);
    await screen.findByRole("heading", { name: "2. Prepare equipment" });
    fireEvent.click(radio("Title quality for group 1", "Acceptable"));
    fireEvent.click(screen.getByRole("button", { name: "Previous activity" }));
    expect(
      screen.getByRole("heading", { name: "2. Prepare equipment" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous activity" }));
    expect(
      screen.getByRole("heading", { name: "1. Inspect equipment" }),
    ).toBeInTheDocument();
    expect(radio("Title quality for group 1", "Acceptable")).toBeChecked();
    expect(
      radio("Categorization of descriptions", "I’m not sure"),
    ).toBeChecked();
    expect(
      screen.getByRole("textbox", {
        name: "Categorization of descriptions notes (optional)",
      }),
    ).toHaveValue("Description 2 appears twice.");
    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
  } finally {
    confirm.mockRestore();
  }
});
