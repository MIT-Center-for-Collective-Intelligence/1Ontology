/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewFollowUpPanel from "../../../src/components/SomReview/ReviewFollowUpPanel";
import { SomLinkedFollowUp } from "../../../src/types/ISomReview";

const followUp: SomLinkedFollowUp = {
  proposalId: "relocation-1",
  issueType: "relocation",
  issueLabel: "14. Review approved relocations",
  question: 'Should "Sell Contract" move to "Sign Contract"?',
  sources: [
    {
      proposalId: "placement-1",
      issueType: "placement",
      issueLabel: "10. Wrong place within Sub-branch",
      question: 'Is "Sell Contract" misplaced under "Sell"?',
    },
  ],
};

describe("linked follow-up panel", () => {
  it("opens the exact related proposal from the persistent overview", () => {
    const onReview = jest.fn();
    render(<ReviewFollowUpPanel followUps={[followUp]} onReview={onReview} />);

    expect(screen.getByText("Ready related decisions")).toBeInTheDocument();
    expect(screen.getByText(followUp.question)).toBeInTheDocument();
    expect(
      screen.getByText("Follows 10. Wrong place within Sub-branch"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Review this next: ${followUp.question}`,
      }),
    );
    expect(onReview).toHaveBeenCalledWith(followUp);
  });

  it("lets a reviewer deliberately continue the original queue", () => {
    const onContinue = jest.fn();
    render(
      <ReviewFollowUpPanel
        variant="handoff"
        sourceLabel="10. Wrong place within Sub-branch"
        followUps={[followUp]}
        onReview={jest.fn()}
        onContinue={onContinue}
        continueLabel="Continue 10. Wrong place within Sub-branch"
      />,
    );

    expect(
      screen.getByText("Continue with the related decision"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Continue 10. Wrong place within Sub-branch",
      }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
