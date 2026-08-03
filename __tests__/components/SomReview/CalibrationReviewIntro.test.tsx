/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import CalibrationReviewIntro from "../../../src/components/SomReview/CalibrationReviewIntro";

describe("CalibrationReviewIntro", () => {
  it("explains the repository and inserts the frozen assignment size", () => {
    const onContinue = jest.fn();
    render(<CalibrationReviewIntro itemCount={35} onContinue={onContinue} />);

    expect(
      screen.getByRole("heading", {
        name: "Work activity repository review",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/arranged from more general to more specific/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/US Department of Labor's O\*NET database/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/asking you to review 35 items/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Begin review" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
