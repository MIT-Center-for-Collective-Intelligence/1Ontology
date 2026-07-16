/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewTaskIntro from "../../../src/components/SomReview/ReviewTaskIntro";

describe("ReviewTaskIntro", () => {
  it("explains the decision boundary once before a placement queue", () => {
    const onContinue = jest.fn();
    const onBack = jest.fn();
    render(
      <ReviewTaskIntro
        issueType="placement"
        label="11. Wrong place within Sell"
        itemCount={7}
        resuming={false}
        onContinue={onContinue}
        onBack={onBack}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "11. Wrong place within Sell" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/decide only whether its present placement is wrong/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "7 review items are ready. You will see one item at a time.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Begin review" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "All review types" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
