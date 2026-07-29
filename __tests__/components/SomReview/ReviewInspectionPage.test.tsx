/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Post } from "../../../src/lib/utils/Post";
import { ReviewInspectionPage } from "../../../src/pages/review/inspection";

jest.mock("../../../src/lib/utils/Post", () => ({
  Post: jest.fn(),
}));

jest.mock("../../../src/components/context/AuthContext", () => ({
  useAuth: () => [{ user: { userId: "tom" } }],
}));

const replace = jest.fn().mockResolvedValue(true);
jest.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: { workspace: "sell" },
    push: jest.fn(),
    replace,
  }),
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
      items: [
        item("proposal-1", "First reviewed proposal", 0),
        item("proposal-2", "Second reviewed proposal", 1),
      ],
    });
  });

  it("shows every prior response immediately on one page without a scan gate", async () => {
    render(<ReviewInspectionPage />);

    expect(await screen.findByText("First reviewed proposal")).toBeVisible();
    expect(screen.getByText("Second reviewed proposal")).toBeVisible();
    expect(screen.getByText("2 shown")).toBeVisible();
    expect(
      screen.queryByText(/independent hierarchy scan/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lock scan/i })).toBeNull();

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
});
