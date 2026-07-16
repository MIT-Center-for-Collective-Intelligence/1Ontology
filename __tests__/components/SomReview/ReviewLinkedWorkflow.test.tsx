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
  default: () => null,
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
): SomReviewCard => ({
  proposalId,
  datasetVersion: "dataset-1",
  issueType,
  proposalIndex: 0,
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
  issueLabel: "Apply approved relocations",
  question: action.reviewerView.question,
  sources: [
    {
      proposalId: diagnosis.proposalId,
      issueType: "placement",
      issueLabel: "11. Wrong place within Sell",
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
              label: "11. Wrong place within Sell",
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
              label: "Apply approved relocations",
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
        name: "Start 11. Wrong place within Sell review, 1 remaining",
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
        name: "Return to 11. Wrong place within Sell",
      }),
    );

    await waitFor(() =>
      expect(postMock).toHaveBeenLastCalledWith("/som-review/session", {
        issueType: "placement",
      }),
    );
  });
});
