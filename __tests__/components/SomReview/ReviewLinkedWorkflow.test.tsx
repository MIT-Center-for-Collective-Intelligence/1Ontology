/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Post } from "../../../src/lib/utils/Post";
import { ReviewPage } from "../../../src/pages/review";
import {
  SomLinkedFollowUp,
  SomReviewCard,
} from "../../../src/types/ISomReview";

jest.mock("../../../src/lib/utils/Post", () => ({
  Post: jest.fn(),
}));

jest.mock("../../../src/components/context/AuthContext", () => {
  const authState = { user: { userId: "reviewer-1" } };
  return { useAuth: () => [authState] };
});

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../src/components/hoc/withAuthUser", () => ({
  __esModule: true,
  default: () => (Component: React.ComponentType) => Component,
}));

jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => ({
  __esModule: true,
  default: () => <button type="button">Theme</button>,
}));

jest.mock("../../../src/components/SomReview/ReviewHistorySelect", () => ({
  __esModule: true,
  default: ({ history, onSelect, selectedProposalId }: any) => {
    if (!history.length) return null;
    const item = history[1] || history[0];
    return (
      <button
        type="button"
        aria-label={`Open saved answer ${item.proposalIndex + 1}`}
        onClick={() => onSelect(item.proposalId)}
      >
        {selectedProposalId
          ? `Revising item ${item.proposalIndex + 1}`
          : "Open a saved answer"}
      </button>
    );
  },
}));

jest.mock("../../../src/components/SomReview/ReviewCard", () => ({
  __esModule: true,
  default: ({ card, onSubmit }: any) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          decision: "agree",
          disagreementReason: "",
          suggestedCorrection: "",
          elapsedMs: 100,
        })
      }
    >
      Submit {card.proposalId}
    </button>
  ),
}));

const card = (
  proposalId: string,
  issueType: "placement" | "relocation",
  question: string,
  proposalIndex = 0,
): SomReviewCard => ({
  proposalId,
  datasetVersion: "dataset-1",
  issueType,
  proposalIndex,
  reviewerView: {
    question,
    currentState: "Current",
    proposedState: "Proposed",
    reasoning: "Reason",
    context:
      issueType === "placement"
        ? {
            type: "placement-comparison",
            nodeTitle: "Sell Contract",
            currentParentTitle: "Sell",
            placementIssue: "wrong-parent",
          }
        : {
            type: "relocation-action",
            nodeTitle: "Sell Contract",
            currentParentTitle: "Sell",
            currentCollection: "main",
            proposedParentTitle: "Sign Contract",
            proposedCollection: "main",
            childTitles: [],
          },
    agreeLabel: "Agree",
    disagreeLabel: "Disagree",
  },
});

const diagnosis = card(
  "placement-1",
  "placement",
  'Is "Sell Contract" misplaced under "Sell"?',
);
const action = card(
  "relocation-1",
  "relocation",
  'Should "Sell Contract" move from "Sell" to "Sign Contract"?',
);
const followUp: SomLinkedFollowUp = {
  proposalId: action.proposalId,
  issueType: "relocation",
  issueLabel: "14. Review approved relocations",
  question: action.reviewerView.question,
  sources: [
    {
      proposalId: diagnosis.proposalId,
      issueType: "placement",
      issueLabel: "10. Wrong place within Sub-branch",
      question: diagnosis.reviewerView.question,
    },
  ],
};

describe("linked proposal review journey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem(
      "som-review-task-intro-dataset-1-placement",
      "seen",
    );
  });

  it("opens the exact follow-up and returns to the preserved source queue", async () => {
    const postMock = Post as jest.Mock;
    postMock.mockImplementation((url: string, body: any) => {
      if (url === "/som-review/overview") {
        return Promise.resolve({
          datasetVersion: "dataset-1",
          canDeliberate: false,
          readyFollowUps: [],
          issueTypes: [
            {
              id: "placement",
              label: "10. Wrong place within Sub-branch",
              stage: "within-branch",
              robTaskIds: [11],
              reviewed: 0,
              pending: 1,
              waiting: 0,
              notApplicable: 0,
              total: 1,
              enabled: true,
            },
            {
              id: "relocation",
              label: "14. Review approved relocations",
              stage: "final-action",
              robTaskIds: [11],
              reviewed: 0,
              pending: 0,
              waiting: 1,
              notApplicable: 0,
              total: 1,
              enabled: true,
            },
          ],
        });
      }
      if (url === "/som-review/session" && body.issueType === "placement") {
        return Promise.resolve({
          session: {
            id: "placement-session",
            issueType: "placement",
            datasetVersion: "dataset-1",
            cursor: 0,
            total: 1,
          },
          cards: [diagnosis],
          history: [],
          historyCards: [],
        });
      }
      if (url === "/som-review/session" && body.issueType === "relocation") {
        return Promise.resolve({
          focusedProposalId: "relocation-1",
          session: {
            id: "relocation-session",
            issueType: "relocation",
            datasetVersion: "dataset-1",
            cursor: 0,
            total: 1,
          },
          cards: [action],
          history: [],
          historyCards: [],
        });
      }
      if (
        url === "/som-review/respond" &&
        body.response.proposalId === "placement-1"
      ) {
        return Promise.resolve({
          ok: true,
          cursor: 1,
          completed: true,
          followUps: [followUp],
        });
      }
      if (
        url === "/som-review/respond" &&
        body.response.proposalId === "relocation-1"
      ) {
        return Promise.resolve({
          ok: true,
          cursor: 1,
          completed: true,
          followUps: [],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<ReviewPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start 10. Wrong place within Sub-branch review, 1 remaining",
      }),
    );
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/som-review/session", {
        issueType: "placement",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit placement-1" }),
    );

    expect(
      await screen.findByText("Continue with the related decision"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Review this next: ${followUp.question}`,
      }),
    );

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/som-review/session", {
        issueType: "relocation",
        preferredProposalId: "relocation-1",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit relocation-1" }),
    );

    expect(
      await screen.findByText("Related decisions completed"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Return to 10. Wrong place within Sub-branch",
      }),
    );

    await waitFor(() =>
      expect(postMock).toHaveBeenLastCalledWith("/som-review/session", {
        issueType: "placement",
      }),
    );
  });

  it("replaces queue progress with an unambiguous saved-answer status while revising", async () => {
    const postMock = Post as jest.Mock;
    const queueCards = Array.from({ length: 47 }, (_, index) =>
      card(
        `placement-${index + 1}`,
        "placement",
        `Is proposal ${index + 1} misplaced?`,
        index,
      ),
    );
    const savedHistory = queueCards.slice(0, 30).map((savedCard, index) => ({
      proposalId: savedCard.proposalId,
      proposalIndex: index,
      question: savedCard.reviewerView.question,
      decision: "agree" as const,
      disagreementReason: "",
      suggestedCorrection: "",
      reviewedAt: `2026-07-16T10:${String(index).padStart(2, "0")}:00.000Z`,
    }));

    postMock.mockImplementation((url: string, body: any) => {
      if (url === "/som-review/overview") {
        return Promise.resolve({
          datasetVersion: "dataset-1",
          canDeliberate: false,
          readyFollowUps: [],
          issueTypes: [
            {
              id: "placement",
              label: "10. Wrong place within Sub-branch",
              stage: "within-branch",
              robTaskIds: [11],
              reviewed: 30,
              pending: 17,
              waiting: 0,
              notApplicable: 0,
              total: 47,
              enabled: true,
              activeSession: { cursor: 30, total: 47 },
            },
          ],
        });
      }
      if (url === "/som-review/session" && body.issueType === "placement") {
        return Promise.resolve({
          session: {
            id: "placement-session",
            issueType: "placement",
            datasetVersion: "dataset-1",
            cursor: 30,
            total: 47,
          },
          cards: queueCards,
          history: savedHistory,
          historyCards: queueCards.slice(0, 30),
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<ReviewPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Resume 10. Wrong place within Sub-branch review, 17 remaining",
      }),
    );

    expect(
      await screen.findByRole("progressbar", {
        name: "30 of 47 items completed",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Open saved answer 2" }),
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Saved item 2 of 47")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Reviewing saved item 2 of 47. Queue progress remains 30 of 47 reviewed.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reviewing a saved answer")).toBeInTheDocument();
    expect(
      screen.getByText("Queue remains 30 of 47 reviewed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep saved answer" }),
    ).toBeInTheDocument();
  });
});
