/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Post } from "../../../src/lib/utils/Post";
import {
  inspectionLoadErrorMessage,
  ReviewInspectionPage,
} from "../../../src/pages/review/inspection";

jest.mock("../../../src/lib/utils/Post", () => ({
  Post: jest.fn(),
}));

const mockUser = { userId: "tom" };
jest.mock("../../../src/components/context/AuthContext", () => ({
  useAuth: () => [{ user: mockUser }],
}));

const replace = jest.fn().mockResolvedValue(true);
const push = jest.fn().mockResolvedValue(true);
let routerQuery: Record<string, string> = { workspace: "sell" };
const mockRouter = {
  isReady: true,
  get query() {
    return routerQuery;
  },
  push,
  replace,
};
jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("../../../src/components/hoc/withAuthUser", () => ({
  __esModule: true,
  default: () => (Component: React.ComponentType) => Component,
}));

jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => ({
  __esModule: true,
  default: () => <button type="button">Theme</button>,
}));

jest.mock("../../../src/components/SomReview/InspectionItemCard", () => ({
  __esModule: true,
  default: ({ item, reviewerName }: any) => (
    <article>
      <h2>{item.card.reviewerView.question}</h2>
      <p>{reviewerName}</p>
    </article>
  ),
}));

const item = (proposalId: string, question: string, proposalIndex: number) => ({
  datasetId: "sell-initial-review",
  datasetLabel: "Initial review",
  currentRound: false,
  issueLabel: "4. Undetected synonyms",
  proposalIndex,
  recordSource: "proposed-change" as const,
  currentlyApplicable: true,
  card: {
    proposalId,
    datasetVersion: "sell-v1",
    branch: "Sell",
    issueType: "duplicate-synonym" as const,
    proposalIndex,
    reviewerView: {
      question,
      currentState: "Before",
      proposedState: "After",
      reasoning: "Reason",
      context: {
        type: "duplicate-comparison" as const,
        parentTitle: "Sell",
        canonicalTitle: "Sell goods",
        candidateSynonymTitle: "Sell products",
      },
      agreeLabel: "They are synonyms",
      disagreeLabel: "They are not synonyms",
    },
  },
  subjectResponse: {
    decision: "agree" as const,
    disagreementReason: "",
    suggestedCorrection: "",
    reviewedAt: "2026-07-28T12:00:00.000Z",
  },
});

describe("Tom's prior-review inspection page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerQuery = { workspace: "sell" };
    (Post as jest.Mock).mockResolvedValue({
      workspaceId: "sell",
      workspaceLabel: "Sell",
      activeDatasetId: "sell-outline-followup",
      reviewers: [
        {
          reviewerId: "rob",
          displayName: "Rob Laubacher",
          responseCount: 2,
        },
      ],
      selectedReviewerId: "rob",
      tasks: [
        {
          key: "issue::duplicate-synonym",
          datasetId: "sell-initial-review",
          datasetLabel: "Initial review",
          datasetIds: ["sell-initial-review"],
          datasetLabels: ["Initial review"],
          roundCount: 1,
          currentRound: false,
          issueType: "duplicate-synonym",
          issueLabel: "Possible duplicate activities",
          responseCount: 2,
          agreeCount: 2,
          disagreeCount: 0,
          exceptionCount: 0,
          currentlyApplicableCount: 2,
        },
      ],
      items: [],
    });
  });

  it("shows a task dashboard instead of mixing every prior response", async () => {
    render(<ReviewInspectionPage />);

    expect(
      await screen.findByText("Possible duplicate activities"),
    ).toBeVisible();
    expect(
      screen.getByText(/Phase 1: Resolve meaning and identity/),
    ).toBeVisible();
    expect(screen.getByText("2 responses")).toBeVisible();
    expect(screen.getByLabelText("Prior reviewer")).toHaveTextContent(
      /Reviewing prior decisions by\s*Rob Laubacher \(2 responses\)/,
    );
    expect(
      screen.queryByRole("combobox", { name: "Prior reviewer" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("First reviewed proposal")).toBeNull();
    expect(
      screen.queryByText(/independent hierarchy scan/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Possible duplicate activities"));
    expect(push).toHaveBeenCalledWith(
      {
        pathname: "/review/inspection",
        query: {
          workspace: "sell",
          reviewer: "rob",
          task: "issue::duplicate-synonym",
        },
      },
      undefined,
      { shallow: true },
    );

    await waitFor(() =>
      expect(Post).toHaveBeenCalledWith(
        "/som-review/inspection/overview",
        { workspaceId: "sell" },
        false,
      ),
    );
    expect(
      (Post as jest.Mock).mock.calls.some(([url]) =>
        String(url).includes("lock-scan"),
      ),
    ).toBe(false);
  });

  it("shows all responses for one selected task on a scrollable page", async () => {
    routerQuery = {
      workspace: "sell",
      reviewer: "rob",
      task: "issue::duplicate-synonym",
    };
    (Post as jest.Mock).mockResolvedValue({
      workspaceId: "sell",
      workspaceLabel: "Sell",
      activeDatasetId: "sell-outline-followup",
      reviewers: [
        {
          reviewerId: "rob",
          displayName: "Rob Laubacher",
          responseCount: 2,
        },
      ],
      selectedReviewerId: "rob",
      selectedTaskKey: "issue::duplicate-synonym",
      tasks: [
        {
          key: "issue::duplicate-synonym",
          datasetId: "sell-initial-review",
          datasetLabel: "Initial review",
          datasetIds: ["sell-initial-review"],
          datasetLabels: ["Initial review"],
          roundCount: 1,
          currentRound: false,
          issueType: "duplicate-synonym",
          issueLabel: "Possible duplicate activities",
          responseCount: 2,
          agreeCount: 2,
          disagreeCount: 0,
          exceptionCount: 0,
          currentlyApplicableCount: 2,
        },
      ],
      items: [
        item("proposal-1", "First reviewed proposal", 0),
        item("proposal-2", "Second reviewed proposal", 1),
      ],
    });

    render(<ReviewInspectionPage />);

    expect(await screen.findByText("First reviewed proposal")).toBeVisible();
    expect(screen.getByText("Second reviewed proposal")).toBeVisible();
    expect(screen.getByText("2 shown")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Review navigation" }),
    ).toHaveTextContent("Proposal review/All review tasks");
    fireEvent.click(screen.getByRole("button", { name: "All review tasks" }));
    expect(replace).toHaveBeenCalledWith(
      {
        pathname: "/review/inspection",
        query: { workspace: "sell", reviewer: "rob" },
      },
      undefined,
      { shallow: true },
    );
    await waitFor(() =>
      expect(Post).toHaveBeenCalledWith(
        "/som-review/inspection/overview",
        {
          workspaceId: "sell",
          reviewerId: "rob",
          taskKey: "issue::duplicate-synonym",
        },
        false,
      ),
    );
  });

  it("classifies both supported forms of a research-team access error", () => {
    expect(
      inspectionLoadErrorMessage("Deliberation access is restricted"),
    ).toBe("This page is restricted to the Society of Mind research team.");
    expect(inspectionLoadErrorMessage({ response: { status: 403 } })).toBe(
      "This page is restricted to the Society of Mind research team.",
    );
  });
});
